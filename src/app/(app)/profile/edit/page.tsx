import type { Metadata } from "next";
import { EditProfileScreen } from "@/components/profile/edit-profile-screen";

export const metadata: Metadata = { title: "Редактирование анкеты" };

export default function Page() {
  return <EditProfileScreen />;
}
