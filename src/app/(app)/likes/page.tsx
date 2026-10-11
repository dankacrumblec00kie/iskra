import type { Metadata } from "next";
import { LikesScreen } from "@/components/likes/likes-screen";

export const metadata: Metadata = { title: "Лайки" };

export default function Page() {
  return <LikesScreen />;
}
