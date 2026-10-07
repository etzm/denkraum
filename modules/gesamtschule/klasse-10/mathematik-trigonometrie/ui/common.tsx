import type { ReactNode } from "react";
import type { StatusLabel } from "../domain/lesson.ts";

/** Shared building blocks. Touch targets are at least 44 px high (spec A 13). */

export const buttonPrimary =
  "inline-flex min-h-12 items-center justify-center rounded-lg bg-accent px-5 font-semibold text-paper hover:bg-accent-strong disabled:opacity-50";
export const buttonSecondary =
  "inline-flex min-h-12 items-center justify-center rounded-lg border-2 border-accent px-5 font-semibold text-accent hover:bg-accent-soft";
export const buttonQuiet = "inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-card px-4";

export function Card({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={`space-y-3 rounded-2xl border border-line bg-card p-4 sm:p-5 ${className}`}>
      {children}
    </section>
  );
}

export function Note({ children, tone = "info", role }: { children: ReactNode; tone?: "info" | "warn" | "ok" | "bad"; role?: "status" | "alert" }) {
  const tones = {
    info: "border-accent bg-accent-soft",
    warn: "border-hyp bg-note",
    ok: "border-ok bg-card",
    bad: "border-bad bg-card",
  } as const;
  return (
    <div role={role} className={`space-y-2 rounded-xl border-l-4 p-4 ${tones[tone]}`}>
      {children}
    </div>
  );
}

const BADGE: Record<StatusLabel, string> = {
  richtig: "bg-ok text-paper",
  fast: "bg-note text-ink border border-line",
  nochmal: "bg-bad text-paper",
};

export function StatusBadge({ status }: { status: StatusLabel }) {
  return <span className={`inline-flex min-h-8 items-center rounded-full px-3 text-sm font-semibold ${BADGE[status]}`}>{status}</span>;
}

/** Art. 50 AI Act: every AI-phrased text is marked as such (docs/datenschutz/README.md section 3). */
export function AiNotice() {
  return <p className="text-xs text-muted">Diese Rückmeldung hat eine KI formuliert. Ob deine Lösung stimmt, hat das Programm geprüft.</p>;
}

export function Steps({ steps, ordered = true }: { steps: readonly string[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={`space-y-2 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}>
      {steps.map((step, i) => (
        <li key={i}>{step}</li>
      ))}
    </Tag>
  );
}

export const NIVEAU_TEXT = {
  G: { title: "Niveau G", text: "Grundlegend: Sinus und Tangens, mit kleinen Schritten." },
  M: { title: "Niveau M", text: "Mittel: Sinus, Kosinus und Tangens." },
  E: { title: "Niveau E", text: "Erweitert: alle drei, dazu Begründungen und Kontrollen." },
} as const;
