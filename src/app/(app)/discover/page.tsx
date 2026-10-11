import type { Metadata } from "next";
import { SwipeDeck } from "@/components/discover/swipe-deck";

export const metadata: Metadata = { title: "Лента" };

export default function DiscoverPage() {
  return <SwipeDeck />;
}
