import Script from "next/script";

// Яндекс.Метрика. Подключается, только если задан NEXT_PUBLIC_YM_ID,
// поэтому в разработке и без счётчика сторонний код не грузится.
const counterId = process.env.NEXT_PUBLIC_YM_ID;

export function Analytics() {
  if (!counterId || !/^\d+$/.test(counterId)) return null;

  return (
    <Script id="yandex-metrika" strategy="afterInteractive">
      {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
ym(${counterId},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true});`}
    </Script>
  );
}

/** Отправка цели в Метрику из клиентского кода: reachGoal("match"). */
export function reachGoal(goal: string) {
  if (!counterId || typeof window === "undefined") return;
  const ym = (window as unknown as { ym?: (id: number, action: string, goal: string) => void }).ym;
  ym?.(Number(counterId), "reachGoal", goal);
}
