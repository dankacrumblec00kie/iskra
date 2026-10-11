import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { LoginInput, RegisterInput } from "@/lib/shared/validation";
import { getDummyHash, hashPassword, verifyPassword } from "../auth/password";
import { conflict, unauthorized } from "../errors";
import { rateLimit } from "../rate-limit";

const findByEmail = (email: string) =>
  db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
    .limit(1);

export async function registerUser(input: RegisterInput, ip: string) {
  await rateLimit(`register:${ip}`, 10, 3600);

  const [existing] = await findByEmail(input.email);
  if (existing) throw conflict("Этот e-mail уже зарегистрирован. Попробуйте войти", "EMAIL_TAKEN");

  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      acceptedTermsAt: new Date(),
    })
    .returning({ id: users.id });
  return user;
}

export async function loginUser(input: LoginInput, ip: string) {
  // Два счётчика: по адресу (перебор многих аккаунтов) и по e-mail (перебор одного)
  await rateLimit(`login:ip:${ip}`, 20, 300);
  await rateLimit(`login:email:${input.email}`, 10, 900);

  const [user] = await findByEmail(input.email);
  // Для несуществующего e-mail всё равно считаем хэш, чтобы время ответа было одинаковым
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || !user.passwordHash || !valid) throw unauthorized("Неверный e-mail или пароль");
  return { id: user.id };
}

/** Вход через OAuth: находим по id провайдера, иначе привязываем к e-mail, иначе создаём. */
export async function upsertGoogleUser(profile: { sub: string; email: string }) {
  const [byGoogle] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.googleId, profile.sub))
    .limit(1);
  if (byGoogle) return byGoogle;

  const [byEmail] = await findByEmail(profile.email);
  if (byEmail) {
    await db.update(users).set({ googleId: profile.sub }).where(eq(users.id, byEmail.id));
    return { id: byEmail.id };
  }

  const [created] = await db
    .insert(users)
    .values({ email: profile.email.toLowerCase(), googleId: profile.sub, acceptedTermsAt: new Date() })
    .returning({ id: users.id });
  return created;
}
