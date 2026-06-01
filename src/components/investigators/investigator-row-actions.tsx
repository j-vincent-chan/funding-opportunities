"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteInvestigatorAction } from "@/app/actions/investigators-pipeline";

function IconPencil({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

const iconBtn =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--fo-border)] bg-[var(--fo-paper)] text-[var(--fo-ink-muted)] shadow-sm transition hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-title)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fo-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50";

export function InvestigatorRowActions({
  investigatorId,
  fullName,
}: {
  investigatorId: string;
  fullName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    const ok = window.confirm(
      `Delete ${fullName} from People? Related profile data, matches, and caches will be removed. This cannot be undone.`
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteInvestigatorAction(investigatorId);
      if ("error" in res && res.error) {
        window.alert(res.error);
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={`/investigators/${investigatorId}`}
        className={`${iconBtn} hover:text-[var(--fo-interaction)]`}
        title={`Edit ${fullName}`}
        aria-label={`Edit ${fullName}`}
      >
        <IconPencil className="h-4 w-4" />
      </Link>
      <button
        type="button"
        className={`${iconBtn} hover:border-red-200 hover:bg-red-50 hover:text-red-700`}
        title={`Delete ${fullName}`}
        aria-label={`Delete ${fullName}`}
        disabled={pending}
        onClick={onDelete}
      >
        <IconTrash className="h-4 w-4" />
      </button>
      {error ? (
        <span className="sr-only" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
