"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip, Switch } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client/api";
import {
  bumpSearchVersion,
  setSessionFilters,
  useSessionFilters,
  type SessionFilters,
} from "@/lib/client/filters-store";
import { useMe } from "@/lib/client/hooks";
import { GOAL_EMOJI, GOAL_LABEL, GOALS, LIMITS, LOOKING_FOR, LOOKING_FOR_LABEL, type LookingFor } from "@/lib/shared/constants";
import { INTERESTS } from "@/lib/shared/interests";
import type { Me } from "@/lib/shared/types";

type Draft = SessionFilters & {
  lookingFor: LookingFor;
  ageMin: number;
  ageMax: number;
  maxDistanceKm: number;
};

/** Двойной ползунок диапазона возраста на двух нативных input[type=range]. */
function AgeRange({ min, max, onChange }: { min: number; max: number; onChange: (min: number, max: number) => void }) {
  const span = LIMITS.maxAge - LIMITS.minAge;
  const left = ((min - LIMITS.minAge) / span) * 100;
  const right = ((max - LIMITS.minAge) / span) * 100;
  return (
    <div className="dual-range relative h-6">
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-3" />
      <div
        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-spark"
        style={{ left: `${left}%`, right: `${100 - right}%` }}
      />
      <input
        type="range"
        min={LIMITS.minAge}
        max={LIMITS.maxAge}
        value={min}
        aria-label="Минимальный возраст"
        onChange={(e) => onChange(Math.min(Number(e.target.value), max), max)}
        className="absolute inset-0 w-full"
      />
      <input
        type="range"
        min={LIMITS.minAge}
        max={LIMITS.maxAge}
        value={max}
        aria-label="Максимальный возраст"
        onChange={(e) => onChange(min, Math.max(Number(e.target.value), min))}
        className="absolute inset-0 w-full"
      />
    </div>
  );
}

export function FiltersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Фильтры">
      {/* Содержимое монтируется при открытии и берёт актуальные значения как начальные */}
      {open && <FiltersForm onClose={onClose} />}
    </Sheet>
  );
}

function FiltersForm({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { data: me, mutate } = useMe();
  const session = useSessionFilters();
  const profile = me?.profile;

  const [draft, setDraft] = useState<Draft>({
    ...session,
    lookingFor: profile?.lookingFor ?? "everyone",
    ageMin: profile?.ageMin ?? LIMITS.minAge,
    ageMax: profile?.ageMax ?? 45,
    maxDistanceKm: profile?.maxDistanceKm ?? 100,
  });
  const [saving, setSaving] = useState(false);
  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));

  async function apply() {
    if (!profile) return;
    setSaving(true);
    try {
      const changed =
        draft.lookingFor !== profile.lookingFor ||
        draft.ageMin !== profile.ageMin ||
        draft.ageMax !== profile.ageMax ||
        draft.maxDistanceKm !== profile.maxDistanceKm;
      if (changed) {
        const updated = await api<Me>("/api/me", {
          method: "PATCH",
          body: {
            lookingFor: draft.lookingFor,
            ageMin: draft.ageMin,
            ageMax: draft.ageMax,
            maxDistanceKm: draft.maxDistanceKm,
          },
        });
        await mutate(updated, { revalidate: false });
        bumpSearchVersion();
      }
      setSessionFilters({ goal: draft.goal, interests: draft.interests, online: draft.online });
      onClose();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
    setSaving(false);
  }

  function toggleInterest(slug: string) {
    patch({
      interests: draft.interests.includes(slug)
        ? draft.interests.filter((s) => s !== slug)
        : [...draft.interests, slug].slice(0, 5),
    });
  }

  const anywhere = draft.maxDistanceKm >= LIMITS.maxDistanceKm;

  return (
    <div className="flex flex-col gap-7">
      <section>
        <h3 className="mb-3 text-sm font-semibold">Показывать мне</h3>
        <div className="flex gap-2">
          {LOOKING_FOR.map((value) => (
            <Chip key={value} active={draft.lookingFor === value} onClick={() => patch({ lookingFor: value })} className="flex-1 justify-center">
              {LOOKING_FOR_LABEL[value]}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Возраст</h3>
          <span className="text-sm text-muted">
            {draft.ageMin}–{draft.ageMax}
          </span>
        </div>
        <AgeRange min={draft.ageMin} max={draft.ageMax} onChange={(ageMin, ageMax) => patch({ ageMin, ageMax })} />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Расстояние</h3>
          <span className="text-sm text-muted">{anywhere ? "неважно" : `до ${draft.maxDistanceKm} км`}</span>
        </div>
        <input
          type="range"
          min={1}
          max={LIMITS.maxDistanceKm}
          value={draft.maxDistanceKm}
          aria-label="Максимальное расстояние"
          onChange={(e) => patch({ maxDistanceKm: Number(e.target.value) })}
          className="single-range w-full"
        />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Цель знакомства</h3>
        <div className="flex flex-wrap gap-2">
          <Chip active={draft.goal === null} onClick={() => patch({ goal: null })}>
            Любая
          </Chip>
          {GOALS.map((goal) => (
            <Chip key={goal} active={draft.goal === goal} onClick={() => patch({ goal })}>
              <span aria-hidden>{GOAL_EMOJI[goal]}</span>
              {GOAL_LABEL[goal]}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Интересы</h3>
          <span className="text-xs text-faint">до 5 · подойдёт любой из выбранных</span>
        </div>
        <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto pr-1">
          {INTERESTS.map((interest) => (
            <Chip
              key={interest.slug}
              active={draft.interests.includes(interest.slug)}
              onClick={() => toggleInterest(interest.slug)}
            >
              <span aria-hidden>{interest.emoji}</span>
              {interest.label}
            </Chip>
          ))}
        </div>
      </section>

      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-semibold">Только в сети</span>
          <span className="block text-xs text-muted">Были активны последние 5 минут</span>
        </span>
        <Switch checked={draft.online} onChange={(online) => patch({ online })} label="Только в сети" />
      </label>

      <div className="sticky bottom-0 -mx-5 flex gap-2 bg-surface px-5 pt-3 pb-1">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => patch({ goal: null, interests: [], online: false })}
          disabled={saving}
        >
          Сбросить
        </Button>
        <Button size="lg" className="flex-1" loading={saving} onClick={apply}>
          Показать анкеты
        </Button>
      </div>
    </div>
  );
}
