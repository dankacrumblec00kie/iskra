"use client";

import { Eye, EyeOff, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { api, ApiRequestError } from "@/lib/client/api";
import { useConfig } from "@/lib/client/hooks";
import { loginSchema, registerSchema } from "@/lib/shared/validation";

type Mode = "login" | "register";

/** Путь возврата после входа. Только внутренние адреса — защита от open redirect. */
function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/discover";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: config } = useConfig();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState<"form" | "demo" | null>(null);

  async function submit(payload: unknown, kind: "form" | "demo") {
    setPending(kind);
    setFormError("");
    try {
      await api(`/api/auth/${mode === "register" && kind === "form" ? "register" : "login"}`, {
        method: "POST",
        body: payload,
      });
      // Сбрасываем кэш данных предыдущего пользователя, если он был
      await mutate(() => true, undefined, { revalidate: false });
      router.replace(mode === "register" && kind === "form" ? "/onboarding" : nextPath());
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setFields(error.fields);
        if (Object.keys(error.fields).length === 0) setFormError(error.message);
      } else {
        setFormError("Что-то пошло не так. Попробуйте ещё раз");
      }
      setPending(null);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    // Та же схема, что и на сервере: ошибки видны сразу, без запроса
    const parsed =
      mode === "register"
        ? registerSchema.safeParse({ email, password, acceptTerms })
        : loginSchema.safeParse({ email, password });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "_");
        next[key] ??= issue.message;
      }
      setFields(next);
      return;
    }
    setFields({});
    void submit(parsed.data, "form");
  }

  const clearError = (name: string) =>
    setFields((current) => (name in current ? { ...current, [name]: "" } : current));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="E-mail" htmlFor="email" error={fields.email}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          invalid={Boolean(fields.email)}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError("email");
          }}
        />
      </Field>

      <Field
        label="Пароль"
        htmlFor="password"
        error={fields.password}
        hint={mode === "register" ? "Минимум 8 символов" : undefined}
      >
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            placeholder="••••••••"
            value={password}
            invalid={Boolean(fields.password)}
            className="pr-12"
            onChange={(e) => {
              setPassword(e.target.value);
              clearError("password");
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-faint hover:text-fg"
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </Field>

      {mode === "register" && (
        <Field error={fields.acceptTerms}>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug text-muted">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                clearError("acceptTerms");
              }}
              className="mt-0.5 size-5 shrink-0 accent-[#ff4d6d]"
            />
            <span>
              Мне исполнилось 18 лет, я принимаю{" "}
              <Link href="/terms" className="text-fg underline underline-offset-2">
                правила сервиса
              </Link>{" "}
              и{" "}
              <Link href="/privacy" className="text-fg underline underline-offset-2">
                политику конфиденциальности
              </Link>
            </span>
          </label>
        </Field>
      )}

      {formError && (
        <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" block loading={pending === "form"} disabled={pending !== null}>
        {mode === "register" ? "Создать аккаунт" : "Войти"}
      </Button>

      {config?.googleAuth && (
        // Обычная ссылка: OAuth — это полноценный переход на сайт Google и обратно
        <a
          href="/api/auth/google"
          className="flex h-13 items-center justify-center gap-3 rounded-full border border-line font-semibold transition hover:bg-surface-2"
        >
          <GoogleIcon /> Продолжить с Google
        </a>
      )}

      {mode === "login" && config?.demoMode && (
        <Button
          variant="secondary"
          size="lg"
          block
          icon={<Sparkles className="size-4 text-gold" />}
          loading={pending === "demo"}
          disabled={pending !== null}
          onClick={() => submit({ email: "demo@iskra.app", password: "demo1234" }, "demo")}
        >
          Войти в демо-аккаунт
        </Button>
      )}
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.600-.2-2.300H12v4.500h6.500a5.500 5.500 0 0 1-2.400 3.600v3h3.900c2.300-2.100 3.500-5.200 3.500-8.800Z" />
      <path fill="#34A853" d="M12 24c3.200 0 6-1.100 8-2.900l-3.900-3c-1.100.7-2.500 1.200-4.100 1.200-3.100 0-5.800-2.100-6.700-5H1.300v3.100A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.300 14.300a7.200 7.200 0 0 1 0-4.600V6.600H1.300a12 12 0 0 0 0 10.800l4-3.100Z" />
      <path fill="#EA4335" d="M12 4.800c1.800 0 3.300.6 4.600 1.800L20 3.100A12 12 0 0 0 1.300 6.600l4 3.100c.9-2.900 3.600-4.900 6.700-4.900Z" />
    </svg>
  );
}
