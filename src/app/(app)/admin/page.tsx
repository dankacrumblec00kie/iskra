import type { Metadata } from "next";
import { AdminScreen } from "@/components/admin/admin-screen";

export const metadata: Metadata = { title: "Модерация" };

export default function Page() {
  return <AdminScreen />;
}
