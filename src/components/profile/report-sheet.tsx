"use client";

import clsx from "clsx";
import { Ban } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client/api";
import { REPORT_REASONS, type ReportReason } from "@/lib/shared/constants";

/** Жалоба на пользователя (с автоматической блокировкой) или просто блокировка. */
export function ReportSheet({
  user,
  open,
  onClose,
  onDone,
}: {
  user: { id: string; name: string };
  open: boolean;
  onClose: () => void;
  /** Пользователь заблокирован — вызывающий экран убирает его из интерфейса */
  onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState<"report" | "block" | null>(null);

  async function send(kind: "report" | "block") {
    setPending(kind);
    try {
      if (kind === "report") {
        await api("/api/reports", {
          method: "POST",
          body: { userId: user.id, reason, details, block: true },
        });
        toast("Жалоба отправлена. Спасибо, что помогаете", "success");
      } else {
        await api("/api/blocks", { method: "POST", body: { userId: user.id } });
        toast(`${user.name} больше вас не увидит`, "success");
      }
      onClose();
      onDone();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
    setPending(null);
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Пожаловаться на ${user.name}`}>
      <p className="mb-4 text-sm text-muted">
        Жалоба анонимна. После отправки пользователь будет заблокирован и исчезнет из вашей ленты и чатов.
      </p>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Причина жалобы">
        {REPORT_REASONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={reason === item.id}
            onClick={() => setReason(item.id)}
            className={clsx(
              "rounded-2xl border px-4 py-3 text-left text-[15px] font-medium transition",
              reason === item.id ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <Textarea
        rows={3}
        value={details}
        maxLength={1000}
        placeholder="Подробности (необязательно)"
        className="mt-3"
        onChange={(e) => setDetails(e.target.value)}
      />
      <div className="mt-5 flex flex-col gap-2">
        <Button
          variant="danger"
          size="lg"
          block
          disabled={!reason || pending !== null}
          loading={pending === "report"}
          onClick={() => send("report")}
        >
          Отправить жалобу
        </Button>
        <Button
          variant="ghost"
          block
          icon={<Ban className="size-4" />}
          disabled={pending !== null}
          loading={pending === "block"}
          onClick={() => send("block")}
        >
          Только заблокировать
        </Button>
      </div>
    </Sheet>
  );
}
