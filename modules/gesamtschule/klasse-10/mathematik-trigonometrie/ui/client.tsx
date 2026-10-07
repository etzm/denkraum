"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Worked example: one step at a time (spec A 5.2). */
export function StepReveal({ steps }: { steps: readonly string[] }) {
  const [shown, setShown] = useState(1);
  const all = shown >= steps.length;
  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-2 pl-6" aria-live="polite">
        {steps.slice(0, shown).map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      {!all && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShown((n) => n + 1)} className="min-h-11 rounded-lg bg-accent px-4 font-semibold text-paper">
            Nächster Schritt
          </button>
          <button type="button" onClick={() => setShown(steps.length)} className="min-h-11 rounded-lg border border-line bg-card px-4">
            Alle Schritte zeigen
          </button>
        </div>
      )}
    </div>
  );
}

type FormAction = (formData: FormData) => void | Promise<void>;

/**
 * A form whose submit button shows a waiting text while the server works (spec A 13:
 * "Ich lese deine Lösung ..."). With `auto`, it submits itself once after loading.
 */
export function WaitingForm({
  action,
  children,
  label,
  waiting,
  auto = false,
  className = "space-y-4",
}: {
  action: FormAction;
  children?: ReactNode;
  label: string;
  waiting: string;
  auto?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!auto || started.current) return;
    started.current = true;
    setBusy(true);
    form.current?.requestSubmit();
  }, [auto]);

  return (
    <form ref={form} action={action} onSubmit={() => setBusy(true)} className={className}>
      {children}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-accent px-5 font-semibold text-paper hover:bg-accent-strong disabled:opacity-60"
      >
        {busy ? waiting : label}
      </button>
      {busy && (
        <p role="status" className="text-center text-muted">
          {waiting}
        </p>
      )}
    </form>
  );
}
