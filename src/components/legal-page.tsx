import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";

/** Каркас текстовых страниц (правила, конфиденциальность). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/" aria-label="На главную">
        <Logo />
      </Link>
      <h1 className="mt-10 font-display text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-faint">Редакция от {updated}</p>
      <div className="mt-8 flex flex-col gap-6 leading-relaxed text-fg/85 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-fg [&_li]:ml-5 [&_li]:list-disc [&_ul]:mt-2 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
      <p className="mt-12 border-t border-line pt-6 text-sm text-faint">
        «Искра» — учебный проект. Тексты на этой странице описывают, как устроено приложение, и не заменяют юридические документы:
        перед запуском для реальных пользователей их должен подготовить юрист.
      </p>
    </div>
  );
}
