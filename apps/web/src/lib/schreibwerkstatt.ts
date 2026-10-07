import { manifest } from "@denkraum/mod-deutsch-schreibwerkstatt";
import type { Learner, ServiceDeps } from "@denkraum/mod-deutsch-schreibwerkstatt/server";
import { notFound, redirect } from "next/navigation";
import { getDb } from "./db.ts";
import { getLlm } from "./llm.ts";
import { currentLearner } from "./session.ts";

export const SW_BASE = `/m/${manifest.id}`;

/** The signed-in learner, only if their group belongs to this module (schulart and klasse). */
export async function requireSchreibwerkstattLearner(): Promise<Learner> {
  const session = await currentLearner();
  if (!session) redirect("/");
  if (session.group.schulart !== manifest.schulart || session.group.klasse !== manifest.klasse) notFound();
  return {
    id: session.learner.id,
    groupId: session.group.id,
    pseudonym: session.learner.pseudonym,
    personalCode: session.learner.personalCode,
    joinCode: session.group.joinCode,
    niveauEEnabled: session.learner.niveauEEnabled,
  };
}

export async function schreibwerkstattDeps(): Promise<ServiceDeps> {
  return { db: await getDb(), llm: getLlm() };
}
