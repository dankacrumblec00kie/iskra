import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatScreen } from "@/components/chat/chat-screen";
import { ScreenLoader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Чат" };

// id из адреса известен только во время запроса, поэтому экран рендерится внутри Suspense.
// key гарантирует чистое состояние при переходе между двумя страницами одного маршрута.
export default function Page({ params }: PageProps<"/chat/[id]">) {
  return (
    <Suspense fallback={<ScreenLoader />}>
      {params.then(({ id }) => (
        <ChatScreen key={id} matchId={id} />
      ))}
    </Suspense>
  );
}
