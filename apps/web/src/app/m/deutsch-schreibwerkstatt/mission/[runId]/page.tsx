import { missionPage } from "@denkraum/mod-deutsch-schreibwerkstatt/server";
import { ErrorBox, PENDING_TEXT, PendingRunner, STEP_TITLES, stageLabel } from "@denkraum/mod-deutsch-schreibwerkstatt/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchreibwerkstattLearner, schreibwerkstattDeps, SW_BASE } from "@/lib/schreibwerkstatt.ts";
import { pendingStepAction, stepAction } from "../../actions.ts";
import { AiFeedback, Briefing, Completed, Held, NotYet, PlanApproved, PlanFeedback, Planning, Revision, SelfCheck, Writing, type Step } from "./screens.tsx";

/** Steps that wait for the system and are run from this page (transcription comes with the photo upload). */
const RUNNABLE = new Set(["review_plan", "review_text", "check_revision"]);

export default async function MissionRun({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ fehler?: string }>;
}) {
  const learner = await requireSchreibwerkstattLearner();
  const { runId } = await params;
  const { fehler } = await searchParams;
  const { db } = await schreibwerkstattDeps();
  const page = await missionPage(db, learner, runId);
  if (!page) notFound();

  const { run, mission } = page;
  const step: Step = (kind) => stepAction.bind(null, runId, kind);
  const pending = page.pending && RUNNABLE.has(page.pending) ? page.pending : null;

  let screen;
  if (pending) {
    screen = <PendingRunner action={pendingStepAction.bind(null, runId)} message={PENDING_TEXT[pending]} auto={!fehler} />;
  } else {
    switch (run.state) {
      case "briefing":
        screen = <Briefing page={page} step={step} />;
        break;
      case "planning":
      case "plan_revise":
        screen = <Planning page={page} step={step} />;
        break;
      case "plan_feedback":
        screen = <PlanFeedback page={page} step={step} />;
        break;
      case "plan_approved":
        screen = <PlanApproved page={page} step={step} />;
        break;
      case "writing":
        screen = <Writing page={page} step={step} />;
        break;
      case "self_check":
        screen = <SelfCheck page={page} step={step} />;
        break;
      case "ai_feedback":
        screen = <AiFeedback page={page} step={step} />;
        break;
      case "revision":
        screen = <Revision page={page} step={step} />;
        break;
      case "completed":
        screen = <Completed page={page} />;
        break;
      case "held_for_adult":
        screen = <Held />;
        break;
      default:
        screen = <NotYet />;
    }
  }

  return (
    <div className="space-y-5">
      <Link href={SW_BASE} className="text-sm underline underline-offset-4">
        Zur Übersicht
      </Link>
      <header className="space-y-1">
        <p className="text-sm text-muted">
          {stageLabel(run.stufe)} · {mission.title}
        </p>
        <h1 className="text-2xl font-semibold">{STEP_TITLES[run.state] ?? mission.title}</h1>
      </header>
      <ErrorBox code={fehler} />
      {screen}
    </div>
  );
}
