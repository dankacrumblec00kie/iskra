import clsx from "clsx";
import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { Spinner } from "./misc";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "gold";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 select-none";

const variants: Record<Variant, string> = {
  primary: "bg-spark text-white glow-brand hover:brightness-110",
  secondary: "bg-surface-2 text-fg hover:bg-surface-3",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  outline: "border border-line text-fg hover:bg-surface-2",
  danger: "bg-danger/15 text-danger hover:bg-danger/25",
  gold: "bg-gold text-black hover:brightness-105",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-7 text-base",
};

type StyleProps = { variant?: Variant; size?: Size; block?: boolean };

export const buttonClass = ({ variant = "primary", size = "md", block }: StyleProps = {}) =>
  clsx(base, variants[variant], sizes[size], block && "w-full");

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  StyleProps & { loading?: boolean; icon?: ReactNode };

export function Button({
  variant,
  size,
  block,
  loading,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(buttonClass({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
}

export function LinkButton({
  variant,
  size,
  block,
  className,
  ...props
}: ComponentProps<typeof Link> & StyleProps) {
  return <Link className={clsx(buttonClass({ variant, size, block }), className)} {...props} />;
}

/** Круглая кнопка-иконка (шапки экранов, действия в карточках). */
export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted transition",
        "hover:bg-surface-2 hover:text-fg active:scale-95 disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
