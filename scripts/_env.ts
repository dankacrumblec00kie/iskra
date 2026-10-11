// Скрипты запускаются вне Next.js, поэтому .env-файлы подгружаем сами.
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
