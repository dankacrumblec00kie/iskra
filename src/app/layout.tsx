import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { Analytics } from "@/components/analytics";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Искра — знакомства рядом", template: "%s · Искра" },
  description:
    "Искра — приложение для знакомств: свайпы, люди рядом, взаимные симпатии и чат. Только 18+.",
  applicationName: "Искра",
  appleWebApp: { capable: true, title: "Искра", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0d0a10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${manrope.variable} ${unbounded.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
