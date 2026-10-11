// npm run push:keys — генерирует пару VAPID-ключей для web push.
// Вывод нужно добавить в .env.local (и в переменные окружения на хостинге).
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:you@example.com");
