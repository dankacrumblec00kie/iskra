"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { z } from "zod";
import { reachGoal } from "@/components/analytics";
import { Logo } from "@/components/logo";
import { CityPicker, type CityValue } from "@/components/profile/city-picker";
import { InterestPicker } from "@/components/profile/interest-picker";
import { PhotoManager } from "@/components/profile/photo-manager";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Segmented, Textarea } from "@/components/ui/field";
import { ErrorState, ScreenLoader } from "@/components/ui/misc";
import { api, ApiRequestError, errorMessage } from "@/lib/client/api";
import { useMe } from "@/lib/client/hooks";
import {
  GENDER_LABEL,
  GENDERS,
  GOAL_EMOJI,
  GOAL_LABEL,
  GOALS,
  LIMITS,
  LOOKING_FOR,
  LOOKING_FOR_LABEL,
  type Gender,
  type Goal,
  type LookingFor,
} from "@/lib/shared/constants";
import type { Me } from "@/lib/shared/types";
import { onboardingSchema } from "@/lib/shared/validation";

const STEPS = [
  { title: "Давайте знакомиться", text: "Имя увидят другие, дата рождения нужна только для возраста" },
  { title: "Кто вы и кого ищете", text: "От этого зависит, кого мы покажем вам и кому покажем вас" },
  { title: "Зачем вы здесь?", text: "Это поможет найти людей с похожими ожиданиями" },
  { title: "Где вы находитесь?", text: "Покажем людей рядом. Точный адрес никто не увидит" },
  { title: "Добавьте фото", text: "С фотографией анкету лайкают в разы чаще. Нужно хотя бы одно" },
  { title: "Расскажите о себе", text: "Интересы и пара строк — повод начать разговор" },
] as const;

const shape = onboardingSchema.shape;

/** Собирает сообщения об ошибках zod в объект { поле: текст }. */
function collect(...results: { field: string; result: z.ZodSafeParseResult<unknown> }[]) {
  const errors: Record<string, string> = {};
  for (const { field, result } of results) {
    if (!result.success) errors[field] = result.error.issues[0].message;
  }
  return errors;
}

export function OnboardingWizard() {
  const router = useRouter();
  const { data: me, error: meError, mutate } = useMe();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [lookingFor, setLookingFor] = useState<LookingFor | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [city, setCity] = useState<CityValue | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (meError?.status === 401) router.replace("/login");
    else if (me?.onboarded) router.replace("/discover");
  }, [me, meError, router]);

  if (meError && meError.status !== 401) {
    return <ErrorState message={meError.message} onRetry={() => mutate()} />;
  }
  if (!me || me.onboarded) return <ScreenLoader />;

  const photos = me.photos;

  /** Проверка полей текущего шага; возвращает true, если можно идти дальше. */
  function validate(current: number) {
    let next: Record<string, string> = {};
    if (current === 0) {
      next = collect(
        { field: "name", result: shape.name.safeParse(name) },
        { field: "birthDate", result: shape.birthDate.safeParse(birthDate) },
      );
    } else if (current === 1) {
      next = collect(
        { field: "gender", result: shape.gender.safeParse(gender) },
        { field: "lookingFor", result: shape.lookingFor.safeParse(lookingFor) },
      );
    } else if (current === 2) {
      next = collect({ field: "goal", result: shape.goal.safeParse(goal) });
    } else if (current === 3) {
      if (!city) next.city = "Выберите город из списка";
    } else if (current === 4) {
      if (photos.length === 0) next.photos = "Добавьте хотя бы одну фотографию";
    } else {
      next = collect({ field: "bio", result: shape.bio.safeParse(bio) });
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function goNext() {
    if (!validate(step)) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }

    setSubmitting(true);
    try {
      const updated = await api<Me>("/api/me/onboarding", {
        method: "POST",
        body: { name, birthDate, gender, lookingFor, goal, bio, interests, ...city },
      });
      reachGoal("onboarding_complete");
      await mutate(updated, { revalidate: false });
      router.replace("/discover");
    } catch (error) {
      if (error instanceof ApiRequestError && Object.keys(error.fields).length) {
        setErrors(error.fields);
        // Возвращаем на шаг с первой ошибкой
        const field = Object.keys(error.fields)[0];
        const stepByField: Record<string, number> = {
          name: 0, birthDate: 0, gender: 1, lookingFor: 1, goal: 2, city: 3, lat: 3, lng: 3,
        };
        if (field in stepByField) setStep(stepByField[field]);
      } else {
        setErrors({ form: errorMessage(error) });
      }
      setSubmitting(false);
    }
  }

  const { title, text } = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-4 pb-6">
      <header className="flex h-12 items-center gap-2">
        {step > 0 ? (
          <IconButton label="Назад" onClick={() => setStep(step - 1)} className="-ml-2">
            <ArrowLeft className="size-5" />
          </IconButton>
        ) : (
          <Logo size="sm" />
        )}
        <span className="ml-auto text-sm font-semibold text-faint">
          {step + 1} / {STEPS.length}
        </span>
      </header>

      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
      >
        <div className="h-full rounded-full bg-spark transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div key={step} className="mt-8 flex flex-1 animate-slide-up flex-col">
        <h1 className="font-display text-2xl leading-tight font-bold">{title}</h1>
        <p className="mt-2 mb-7 text-sm leading-relaxed text-muted">{text}</p>

        {step === 0 && (
          <div className="flex flex-col gap-5">
            <Field label="Имя" htmlFor="name" error={errors.name}>
              <Input
                id="name"
                value={name}
                maxLength={LIMITS.nameMax}
                autoComplete="given-name"
                autoFocus
                placeholder="Как к вам обращаться"
                invalid={Boolean(errors.name)}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field
              label="Дата рождения"
              htmlFor="birthDate"
              error={errors.birthDate}
              hint="Сервис только для совершеннолетних. Изменить дату позже нельзя"
            >
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                autoComplete="bday"
                invalid={Boolean(errors.birthDate)}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-7">
            <Field label="Я" error={errors.gender}>
              <Segmented
                value={gender}
                onChange={setGender}
                options={GENDERS.map((value) => ({ value, label: GENDER_LABEL[value] }))}
              />
            </Field>
            <Field label="Показывать мне" error={errors.lookingFor}>
              <Segmented
                value={lookingFor}
                onChange={setLookingFor}
                options={LOOKING_FOR.map((value) => ({ value, label: LOOKING_FOR_LABEL[value] }))}
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <Field error={errors.goal}>
            <Segmented
              columns={2}
              value={goal}
              onChange={setGoal}
              options={GOALS.map((value) => ({ value, label: GOAL_LABEL[value], emoji: GOAL_EMOJI[value] }))}
            />
          </Field>
        )}

        {step === 3 && <CityPicker value={city} onChange={setCity} error={errors.city} />}

        {step === 4 && (
          <div>
            <PhotoManager photos={photos} onChange={(next) => mutate({ ...me, photos: next }, { revalidate: false })} />
            {errors.photos && (
              <p className="mt-3 text-sm text-danger" role="alert">
                {errors.photos}
              </p>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-7">
            <Field
              label="О себе"
              htmlFor="bio"
              error={errors.bio}
              hint={`${bio.length} / ${LIMITS.bioMax}. Можно пропустить и заполнить позже`}
            >
              <Textarea
                id="bio"
                rows={4}
                value={bio}
                maxLength={LIMITS.bioMax}
                placeholder="Чем занимаетесь, что любите, что ищете"
                invalid={Boolean(errors.bio)}
                onChange={(e) => setBio(e.target.value)}
              />
            </Field>
            <InterestPicker value={interests} onChange={setInterests} />
          </div>
        )}
      </div>

      {errors.form && (
        <p className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {errors.form}
        </p>
      )}

      <div className="sticky bottom-0 -mx-5 mt-6 bg-gradient-to-t from-bg via-bg to-transparent px-5 pt-6 pb-2">
        <Button size="lg" block loading={submitting} onClick={goNext}>
          {step === STEPS.length - 1 ? "Начать знакомиться" : "Дальше"}
          {step < STEPS.length - 1 && <ArrowRight className="size-5" />}
        </Button>
      </div>
    </div>
  );
}
