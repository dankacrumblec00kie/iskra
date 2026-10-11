import type { Metadata } from "next";
import { Suspense } from "react";
import { UserProfileScreen } from "@/components/profile/user-profile-screen";
import { ScreenLoader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Анкета" };

// id из адреса известен только во время запроса, поэтому экран рендерится внутри Suspense.
// key гарантирует чистое состояние при переходе между двумя страницами одного маршрута.
export default function Page({ params }: PageProps<"/u/[id]">) {
  return (
    <Suspense fallback={<ScreenLoader />}>
      {params.then(({ id }) => (
        <UserProfileScreen key={id} userId={id} />
      ))}
    </Suspense>
  );
}
