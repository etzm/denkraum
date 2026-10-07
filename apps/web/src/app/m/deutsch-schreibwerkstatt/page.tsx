import { missionOverview, type MissionCard } from "@denkraum/mod-deutsch-schreibwerkstatt/server";
import { BLOCKER_TEXT, Section, STAGE_TITLES, stageLabel, SubmitButton } from "@denkraum/mod-deutsch-schreibwerkstatt/ui";
import Link from "next/link";
import { requireSchreibwerkstattLearner, schreibwerkstattDeps, SW_BASE } from "@/lib/schreibwerkstatt.ts";
import { startMissionAction } from "./actions.ts";

const STATUS_TEXT: Record<MissionCard["status"], string> = {
  completed: "geschafft",
  in_progress: "angefangen",
  startable: "bereit",
  locked: "noch verschlossen",
};

export default async function Schreibwerkstatt({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const learner = await requireSchreibwerkstattLearner();
  const { db } = await schreibwerkstattDeps();
  const overview = await missionOverview(db, learner);
  const { fehler } = await searchParams;

  return (
    <div className="space-y-6">
      <Link href="/m" className="text-sm underline underline-offset-4">
        Zurück
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Schreibwerkstatt</h1>
        <p className="text-muted">Erst planen, dann schreiben, dann überarbeiten.</p>
        <p className="text-sm">
          {overview.progress.xp} XP · {overview.progress.keys} Schlüssel · {overview.progress.streakDays}{" "}
          {overview.progress.streakDays === 1 ? "Tag" : "Tage"} in Folge
        </p>
      </header>
      {fehler === "gesperrt" ? (
        <p role="alert" className="rounded-lg border border-line p-3">
          Diese Mission kannst du noch nicht starten.
        </p>
      ) : null}

      {overview.stages.map((stage) => (
        <Section key={String(stage.stufe)} title={`${stageLabel(stage.stufe)}: ${STAGE_TITLES[String(stage.stufe)]}`}>
          {stage.current ? <p className="text-sm font-semibold text-accent">Hier bist du gerade.</p> : null}
          <ul className="space-y-3">
            {stage.missions.map((card) => (
              <li key={card.mission.id} className="space-y-2 rounded-lg border border-line p-3" data-mission={card.mission.id}>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold">{card.mission.title}</span>
                  <span className="shrink-0 text-sm text-muted">{STATUS_TEXT[card.status]}</span>
                </div>
                {card.status === "locked" && card.blockers[0] ? <p className="text-sm text-muted">{BLOCKER_TEXT[card.blockers[0]]}</p> : null}
                {card.status === "in_progress" && card.runId ? (
                  <Link href={`${SW_BASE}/mission/${card.runId}`} className="flex min-h-12 items-center justify-center rounded-lg bg-accent px-6 font-semibold text-paper hover:bg-accent-strong">
                    Weitermachen
                  </Link>
                ) : null}
                {card.status === "startable" ? (
                  <form action={startMissionAction.bind(null, card.mission.id)}>
                    <SubmitButton>Mission starten</SubmitButton>
                  </form>
                ) : null}
                {card.status === "completed" ? (
                  <div className="grid grid-cols-2 gap-2">
                    {card.runId ? (
                      <Link href={`${SW_BASE}/mission/${card.runId}`} className="flex min-h-12 items-center justify-center rounded-lg border border-line px-3 hover:border-accent">
                        Ansehen
                      </Link>
                    ) : null}
                    <form action={startMissionAction.bind(null, card.mission.id)}>
                      <SubmitButton variant="secondary">Nochmal schreiben</SubmitButton>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </div>
  );
}
