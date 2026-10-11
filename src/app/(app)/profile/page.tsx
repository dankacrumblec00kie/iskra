import type { Metadata } from "next";
import { MyProfileScreen } from "@/components/profile/my-profile-screen";

export const metadata: Metadata = { title: "Профиль" };

export default function Page() {
  return <MyProfileScreen />;
}
