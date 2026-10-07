import type { Db } from "@denkraum/db";
import type { Deps as LlmDeps } from "@denkraum/llm";
import type { KnownIdentifiers } from "@denkraum/privacy";
import { manifest } from "../module.ts";

export const MODULE_ID = manifest.id;

/** What the services need. `now` is injectable for tests (streak, boss timer). */
export type ServiceDeps = { db: Db; llm: LlmDeps; now?: () => Date };

/** The signed-in learner as the services see it. Identity fields never reach a prompt. */
export type Learner = {
  id: string;
  groupId: string;
  pseudonym: string;
  personalCode: string;
  joinCode: string;
  niveauEEnabled: boolean;
};

/** Everything that identifies the learner; `generateStructured` refuses prompts containing any of it. */
export function identityOf(learner: Learner, runId?: string): KnownIdentifiers {
  return {
    pseudonym: learner.pseudonym,
    accessCodes: [learner.personalCode, learner.joinCode],
    ids: [learner.id, learner.groupId, ...(runId ? [runId] : [])],
  };
}

/** Query surface shared by a database and a transaction. */
export type Queryable = Pick<Db, "select" | "selectDistinct" | "insert" | "update" | "delete">;

export function nowOf(deps: Pick<ServiceDeps, "now">): Date {
  return deps.now ? deps.now() : new Date();
}
