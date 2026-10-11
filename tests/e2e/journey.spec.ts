import { expect, test } from "@playwright/test";
import sharp from "sharp";

// Главный пользовательский путь целиком: регистрация → анкета → лайк → мэтч → чат → покупка.
// Требует DEMO_MODE=true и демо-анкет в базе: в этом режиме анкеты из сида отвечают взаимностью.

const email = `e2e-${Date.now()}@test.local`;
const password = "correct-horse-battery";

test("новый пользователь проходит путь от регистрации до переписки и покупки", async ({ page }) => {
  // Внешний геокодер подменяем: тест не должен зависеть от стороннего сервиса
  await page.route("**/api/geo/search**", (route) =>
    route.fulfill({
      json: { places: [{ name: "Москва", region: "Москва", country: "Россия", lat: 55.7558, lng: 37.6173 }] },
    }),
  );

  await test.step("регистрация: ошибки валидации и успешная отправка", async () => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Создать аккаунт" }).click();
    await expect(page.getByText("Введите корректный e-mail")).toBeVisible();

    await page.getByLabel("E-mail").fill(email);
    await page.getByRole("textbox", { name: "Пароль" }).fill("short");
    await page.getByRole("button", { name: "Создать аккаунт" }).click();
    await expect(page.getByText("Пароль — минимум 8 символов")).toBeVisible();

    await page.getByRole("textbox", { name: "Пароль" }).fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Создать аккаунт" }).click();
    await page.waitForURL("**/onboarding");
  });

  await test.step("анкета: шесть шагов", async () => {
    const next = page.getByRole("button", { name: "Дальше" });

    // Несовершеннолетних не пускаем
    await page.getByLabel("Имя").fill("Тестер");
    await page.getByLabel("Дата рождения").fill("2015-01-01");
    await next.click();
    await expect(page.getByText("Сервис доступен только с 18 лет")).toBeVisible();
    await page.getByLabel("Дата рождения").fill("1998-05-10");
    await next.click();

    await page.getByRole("radio", { name: "Женщина" }).click();
    await page.getByRole("radio", { name: "Всех" }).click();
    await next.click();

    await page.getByRole("radio", { name: /Свидания/ }).click();
    await next.click();

    await page.getByLabel("Город").fill("Моск");
    await page.getByRole("option", { name: /Москва/ }).click();
    await next.click();

    // Без фото дальше нельзя
    await next.click();
    await expect(page.getByText("Добавьте хотя бы одну фотографию")).toBeVisible();
    const photo = await sharp({ create: { width: 900, height: 1200, channels: 3, background: "#d9668a" } })
      .jpeg()
      .toBuffer();
    await page.locator('input[type="file"]').setInputFiles({ name: "me.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect(page.getByAltText("Фото 1")).toBeVisible();
    await next.click();

    await page.getByLabel("О себе").fill("Пишу автотесты и люблю, когда они зелёные.");
    await page.getByRole("button", { name: /Кофе/ }).click();
    await page.getByRole("button", { name: /Технологии/ }).click();
    await page.getByRole("button", { name: "Начать знакомиться" }).click();
    await page.waitForURL("**/discover");
  });

  await test.step("лента: лайк приводит к взаимной симпатии", async () => {
    // В демо-режиме первой идёт анкета, которая уже лайкнула новичка
    await expect(page.getByText("Вы понравились")).toBeVisible();
    await page.getByRole("button", { name: "Нравится", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Взаимная симпатия" })).toBeVisible();
    await page.getByRole("link", { name: "Написать сообщение" }).click();
    await page.waitForURL("**/chat/**");
  });

  await test.step("чат: сообщение отправляется, собеседник отвечает", async () => {
    await page.getByLabel("Текст сообщения").fill("Привет! Это сообщение из автотеста");
    await page.getByRole("button", { name: "Отправить" }).click();
    const log = page.getByRole("log");
    await expect(log.getByText("Привет! Это сообщение из автотеста")).toBeVisible();
    await expect(log.getByText(/Приятно познакомиться/)).toBeVisible({ timeout: 20_000 });
  });

  await test.step("лайки скрыты без подписки", async () => {
    await page.goto("/likes");
    await expect(page.getByText(/Вы понравились \d+/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Скрытая анкета/ }).first()).toBeVisible();
  });

  await test.step("покупка Premium через тестовую кассу открывает лайки", async () => {
    await page.goto("/premium");
    await page.getByRole("button", { name: /Оформить за/ }).click();
    await page.waitForURL("**/premium/checkout/**");
    await page.getByRole("button", { name: /^Оплатить/ }).click();
    await expect(page.getByText("Оплата прошла")).toBeVisible();

    await page.getByRole("link", { name: "Посмотреть, кто лайкнул" }).click();
    await page.waitForURL("**/likes");
    await expect(page.getByText(/вашего ответа/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Лайкнуть в ответ/ }).first()).toBeVisible();
  });

  await test.step("фильтры: настройки поиска сохраняются, лента перестраивается", async () => {
    await page.goto("/discover");
    await page.getByRole("button", { name: "Фильтры" }).click();
    const filters = page.getByRole("dialog", { name: "Фильтры" });
    await filters.getByRole("button", { name: "Мужчин", exact: true }).click();
    await filters.getByRole("button", { name: /Серьёзные отношения/ }).click();
    await filters.getByRole("button", { name: "Показать анкеты" }).click();
    await expect(filters).toBeHidden();

    // Значок на кнопке показывает число активных фильтров
    await expect(page.getByRole("button", { name: "Фильтры" })).toContainText("1");

    // «Показывать мне» — постоянная настройка: она дошла до профиля
    await page.goto("/profile");
    await expect(page.getByText("Мужчин", { exact: true })).toBeVisible();
  });

  await test.step("выход и повторный вход", async () => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Выйти" }).click();
    await page.waitForURL((url) => url.pathname === "/");

    // Без сессии закрытые страницы недоступны
    await page.goto("/discover");
    await page.waitForURL("**/login**");

    await page.getByLabel("E-mail").fill(email);
    await page.getByRole("textbox", { name: "Пароль" }).fill("wrong-password");
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.getByText("Неверный e-mail или пароль")).toBeVisible();

    await page.getByRole("textbox", { name: "Пароль" }).fill(password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await page.waitForURL("**/discover");
  });
});
