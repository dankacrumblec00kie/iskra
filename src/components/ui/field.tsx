import clsx from "clsx";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

const control =
  "w-full rounded-2xl border bg-surface px-4 text-[15px] text-fg placeholder:text-faint transition " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-60";

/** Обёртка поля: подпись, подсказка и текст ошибки, связанные с полем для скринридеров. */
export function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
}: {
  label?: string;
  error?: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-muted">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-faint">{hint}</p>
      )}
    </div>
  );
}

export function Input({
  invalid,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={clsx(control, "h-12", invalid ? "border-danger" : "border-line", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Textarea({
  invalid,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={clsx(control, "resize-none py-3 leading-relaxed", invalid ? "border-danger" : "border-line", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

/** Выбор одного варианта из нескольких крупными кнопками (пол, цель знакомства). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  columns = 3,
}: {
  options: readonly { value: T; label: string; emoji?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  columns?: 2 | 3;
}) {
  return (
    <div className={clsx("grid gap-2", columns === 2 ? "grid-cols-2" : "grid-cols-3")} role="radiogroup">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={clsx(
              "flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition active:scale-[0.97]",
              active
                ? "border-brand bg-brand-soft text-fg"
                : "border-line bg-surface text-muted hover:border-white/25 hover:text-fg",
            )}
          >
            {option.emoji && <span aria-hidden>{option.emoji}</span>}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
