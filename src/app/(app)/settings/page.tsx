import type { Metadata } from "next";
import { SettingsScreen } from "@/components/settings/settings-screen";

export const metadata: Metadata = { title: "Настройки" };

export default function Page() {
  return <SettingsScreen />;
}
