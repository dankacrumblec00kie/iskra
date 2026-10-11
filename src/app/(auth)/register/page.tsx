import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Регистрация" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold">Создайте анкету</h1>
      <p className="mt-2 mb-6 text-sm text-muted">Это займёт пару минут. Дальше — только знакомства</p>
      <AuthForm mode="register" />
      <p className="mt-6 text-center text-sm text-muted">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Войти
        </Link>
      </p>
    </>
  );
}
