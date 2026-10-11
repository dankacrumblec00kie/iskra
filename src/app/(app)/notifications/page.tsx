import type { Metadata } from "next";
import { NotificationsScreen } from "@/components/notifications/notifications-screen";

export const metadata: Metadata = { title: "Уведомления" };

export default function Page() {
  return <NotificationsScreen />;
}
