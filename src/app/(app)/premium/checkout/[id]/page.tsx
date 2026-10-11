import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutScreen } from "@/components/premium/checkout-screen";
import { ScreenLoader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Оплата" };

// id из адреса известен только во время запроса, поэтому экран рендерится внутри Suspense.
// key гарантирует чистое состояние при переходе между двумя страницами одного маршрута.
export default function Page({ params }: PageProps<"/premium/checkout/[id]">) {
  return (
    <Suspense fallback={<ScreenLoader />}>
      {params.then(({ id }) => (
        <CheckoutScreen key={id} paymentId={id} />
      ))}
    </Suspense>
  );
}
