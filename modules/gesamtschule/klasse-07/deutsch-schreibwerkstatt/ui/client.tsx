"use client";

// The only client components of the mission screens: a submit button that shows progress
// and blocks double submits, and the runner that resumes a pending AI step after a reload.

import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText = "Einen Moment ...", variant = "primary" }: { children: ReactNode; pendingText?: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  const style =
    variant === "primary"
      ? "bg-accent text-paper hover:bg-accent-strong"
      : "border border-line hover:border-accent";
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`min-h-12 w-full rounded-lg px-6 font-semibold disabled:opacity-60 ${style}`}>
      {pending ? pendingText : children}
    </button>
  );
}

/**
 * Shown while the system still has to do something (for example the review after a reload).
 * It starts the step once on its own; after an error the child starts it with the button.
 */
export function PendingRunner({ action, message, auto }: { action: () => Promise<void>; message: string; auto: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const started = useRef(false);
  useEffect(() => {
    if (auto && !started.current) {
      started.current = true;
      form.current?.requestSubmit();
    }
  }, [auto]);
  return (
    <form ref={form} action={action} className="space-y-3">
      <p role="status" className="text-lg">
        {message}
      </p>
      <SubmitButton pendingText="Einen Moment ...">{auto ? "Weiter" : "Nochmal versuchen"}</SubmitButton>
    </form>
  );
}
