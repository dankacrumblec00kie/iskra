"use client";

import { Chip } from "@/components/ui/misc";
import { LIMITS } from "@/lib/shared/constants";
import { INTEREST_CATEGORIES, INTERESTS } from "@/lib/shared/interests";

/** Выбор интересов по категориям с ограничением на количество. */
export function InterestPicker({
  value,
  onChange,
  max = LIMITS.maxInterests,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
}) {
  const selected = new Set(value);

  function toggle(slug: string) {
    if (selected.has(slug)) onChange(value.filter((s) => s !== slug));
    else if (value.length < max) onChange([...value, slug]);
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted" aria-live="polite">
        Выбрано {value.length} из {max}
      </p>
      {INTEREST_CATEGORIES.map((category) => (
        <section key={category}>
          <h3 className="mb-2.5 text-xs font-bold tracking-wider text-faint uppercase">{category}</h3>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.filter((i) => i.category === category).map((interest) => {
              const active = selected.has(interest.slug);
              return (
                <Chip
                  key={interest.slug}
                  active={active}
                  disabled={!active && value.length >= max}
                  onClick={() => toggle(interest.slug)}
                  className="disabled:opacity-40"
                >
                  <span aria-hidden>{interest.emoji}</span>
                  {interest.label}
                </Chip>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
