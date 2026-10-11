import type { Metadata } from "next";
import { PremiumScreen } from "@/components/premium/premium-screen";

export const metadata: Metadata = { title: "Premium" };

export default function Page() {
  return <PremiumScreen />;
}
