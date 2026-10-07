import type { BoundAction } from "@denkraum/sdk";
import type { MissionState } from "../domain/state.ts";
import type { Mission } from "../schemas/content.ts";
import { card, Hidden, primaryButton } from "./parts.tsx";

export type MissionEntry = {
  mission: Mission;
  /** Approved, or unapproved content is switched on (D-022). */
  shown: boolean;
  latest: { id: string; state: MissionState } | null;
};

const PENDING_APPROVAL = "Diese Mission wartet auf Freigabe";

export function StartPage({ title, entries, basePath, start }: { title: string; entries: MissionEntry[]; basePath: string; start: BoundAction }) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted">
          Hier lernst du, einen argumentierenden Text zu planen, zu schreiben und zu überarbeiten. Erst planen, dann schreiben: Was meine
          ich? Warum? Woran sieht man das?
        </p>
      </header>
      <ul className="space-y-4">
        {entries.map(({ mission, shown, latest }) => (
          <li key={mission.id} className={card}>
            <p className="text-sm text-muted">
              Stufe {mission.stufe} · Mission {mission.id}
            </p>
            <h2 className="text-xl font-semibold">{mission.title}</h2>
            {mission.adressat && <p className="text-sm">An: {mission.adressat}</p>}
            {!shown ? (
              <p role="status" className="rounded-xl border border-dashed border-line p-3 text-muted">
                {PENDING_APPROVAL}. Ein Erwachsener schaut sie sich vorher an.
              </p>
            ) : latest && latest.state !== "completed" ? (
              <a href={`${basePath}/lauf/${latest.id}`} className={`${primaryButton} inline-flex items-center justify-center`}>
                Mission fortsetzen
              </a>
            ) : (
              <form action={start} className="space-y-2">
                <Hidden name="mission" value={mission.id} />
                {latest && <p className="text-sm text-ok">Du hast diese Mission schon geschafft. Du kannst sie noch einmal machen.</p>}
                <button type="submit" className={primaryButton}>
                  {latest ? "Noch einmal starten" : "Mission starten"}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
