import type { Metadata } from "next";
import { NearbyScreen } from "@/components/nearby/nearby-screen";

export const metadata: Metadata = { title: "Рядом" };

export default function Page() {
  return <NearbyScreen />;
}
