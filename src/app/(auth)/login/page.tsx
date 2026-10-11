import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold">С возвращением</h1>
      <p className="mt-2 mb-6 text-sm text-muted">Войдите, чтобы продолжить знакомства</p>
      <AuthForm mode="login" />
      <p className="mt-6 text-center text-sm text-muted">
        Ещё нет аккаунта?{" "}
        <Link href="/register" className="font-semibold text-brand hover:underline">
          Создать анкету
        </Link>
      </p>
    </>
  );
}
