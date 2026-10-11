"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Screen } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented, Textarea } from "@/components/ui/field";
import { ScreenLoader } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
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
} from "@/lib/shared/constants";
import type { Me } from "@/lib/shared/types";
import { profilePatchSchema } from "@/lib/shared/validation";
import { CityPicker, type CityValue } from "./city-picker";
import { InterestPicker } from "./interest-picker";
import { PhotoManager } from "./photo-manager";

export function EditProfileScreen() {
  const { data: me, mutate } = useMe();
  if (!me?.profile) return <ScreenLoader />;
  // Форма монтируется, когда данные уже есть, и берёт их как начальные значения
  return <EditForm me={me} onSaved={(updated) => mutate(updated, { revalidate: false })} onPhotos={(photos) => mutate({ ...me, photos }, { revalidate: false })} />;
}

function EditForm({
  me,
  onSaved,
  onPhotos,
}: {
  me: Me;
  onSaved: (me: Me) => void;
  onPhotos: (photos: Me["photos"]) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const profile = me.profile!;

  const [name, setName] = useState(profile.name);
  const [gender, setGender] = useState(profile.gender);
  const [lookingFor, setLookingFor] = useState(profile.lookingFor);
  const [goal, setGoal] = useState(profile.goal);
  const [bio, setBio] = useState(profile.bio);
  const [job, setJob] = useState(profile.job);
  const [height, setHeight] = useState(profile.heightCm ? String(profile.heightCm) : "");
  const [city, setCity] = useState<CityValue | null>(
    profile.lat !== null && profile.lng !== null ? { city: profile.city, lat: profile.lat, lng: profile.lng } : null,
  );
  const [interests, setInterests] = useState(me.interests);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!city) {
      setErrors({ city: "Выберите город из списка" });
      return;
    }
    const parsed = profilePatchSchema.safeParse({
      name,
      gender,
      lookingFor,
      goal,
      bio,
      job,
      heightCm: height ? Number(height) : null,
      interests,
      ...city,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? "form")] ??= issue.message;
      setErrors(next);
      toast("Проверьте поля формы", "error");
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      onSaved(await api<Me>("/api/me", { method: "PATCH", body: parsed.data }));
      toast("Анкета сохранена", "success");
      router.push("/profile");
    } catch (error) {
      if (error instanceof ApiRequestError) setErrors(error.fields);
      toast(errorMessage(error), "error");
      setSaving(false);
    }
  }

  return (
    <Screen title="Редактирование" back="/profile">
      <div className="flex flex-col gap-8">
        <section>
          <h2 className="mb-3 font-display text-base font-bold">Фотографии</h2>
          <PhotoManager photos={me.photos} onChange={onPhotos} />
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="font-display text-base font-bold">Основное</h2>
          <Field label="Имя" htmlFor="name" error={errors.name}>
            <Input id="name" value={name} maxLength={LIMITS.nameMax} invalid={Boolean(errors.name)} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Я" error={errors.gender}>
            <Segmented value={gender} onChange={setGender} options={GENDERS.map((value) => ({ value, label: GENDER_LABEL[value] }))} />
          </Field>
          <Field label="Показывать мне" error={errors.lookingFor}>
            <Segmented
              value={lookingFor}
              onChange={setLookingFor}
              options={LOOKING_FOR.map((value) => ({ value, label: LOOKING_FOR_LABEL[value] }))}
            />
          </Field>
          <Field label="Цель знакомства" error={errors.goal}>
            <Segmented
              columns={2}
              value={goal}
              onChange={setGoal}
              options={GOALS.map((value) => ({ value, label: GOAL_LABEL[value], emoji: GOAL_EMOJI[value] }))}
            />
          </Field>
          <CityPicker value={city} onChange={setCity} error={errors.city ?? errors.lat} />
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="font-display text-base font-bold">О себе</h2>
          <Field label="Пара слов" htmlFor="bio" error={errors.bio} hint={`${bio.length} / ${LIMITS.bioMax}`}>
            <Textarea id="bio" rows={5} value={bio} maxLength={LIMITS.bioMax} invalid={Boolean(errors.bio)} onChange={(e) => setBio(e.target.value)} />
          </Field>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field label="Чем занимаетесь" htmlFor="job" error={errors.job}>
              <Input id="job" value={job} maxLength={LIMITS.jobMax} placeholder="Профессия или учёба" invalid={Boolean(errors.job)} onChange={(e) => setJob(e.target.value)} />
            </Field>
            <Field label="Рост, см" htmlFor="height" error={errors.heightCm}>
              <Input
                id="height"
                inputMode="numeric"
                value={height}
                maxLength={3}
                placeholder="—"
                invalid={Boolean(errors.heightCm)}
                onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))}
              />
            </Field>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-base font-bold">Интересы</h2>
          <InterestPicker value={interests} onChange={setInterests} />
        </section>
      </div>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-8 bg-gradient-to-t from-bg via-bg to-transparent px-4 pt-8 pb-3 lg:bottom-0">
        <Button size="lg" block loading={saving} onClick={save}>
          Сохранить
        </Button>
      </div>
    </Screen>
  );
}
