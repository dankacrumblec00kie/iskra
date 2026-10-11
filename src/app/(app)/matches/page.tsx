import type { Metadata } from "next";
import { MatchesScreen } from "@/components/chat/matches-screen";

export const metadata: Metadata = { title: "Чаты" };

export default function Page() {
  return <MatchesScreen />;
}
