import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Мягкое свечение на фоне */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-spark opacity-20 blur-[120px]"
        aria-hidden
      />
      <Link href="/" className="relative mb-8" aria-label="Искра — на главную">
        <Logo size="lg" />
      </Link>
      <div className="relative w-full max-w-md animate-slide-up rounded-[2rem] bg-surface p-6 ring-1 ring-line sm:p-8">
        {children}
      </div>
      <p className="relative mt-6 text-xs text-faint">Только для совершеннолетних · 18+</p>
    </div>
  );
}
