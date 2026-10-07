import type { ModuleManifest } from "@denkraum/core";
import type { Db } from "@denkraum/db";
import type { MockFixture } from "@denkraum/llm";
import type { ReactNode } from "react";
import type { ModuleAi } from "./ai.ts";
import type { ModuleUploads } from "./uploads.ts";

/** What a module knows about the learner. Deliberately no pseudonym and no codes. */
export interface LearnerInfo {
  id: string;
  niveau: "G" | "M" | "E" | null;
  niveauEEnabled: boolean;
}

export interface GroupInfo {
  id: string;
  schulart: string;
  klasse: number;
  endsAt: Date;
}

/** A form action the module can put on a <form action={...}>; runs on the server with this context. */
export type BoundAction = (formData: FormData) => Promise<void>;

export interface ModuleContext {
  manifest: ModuleManifest;
  learner: LearnerInfo;
  group: GroupInfo;
  /** URL of the module start page, for example /klasse10/m/mathematik-trigonometrie */
  basePath: string;
  db: Db;
  ai: ModuleAi;
  uploads: ModuleUploads;
  /** Server action bound to one of the module's actions. */
  action(name: string): BoundAction;
  now: Date;
}

export type ActionResult = { redirect?: string } | void;
export type ModuleAction = (ctx: ModuleContext, form: FormData) => Promise<ActionResult>;

export interface ModuleDefinition {
  manifest: ModuleManifest;
  /** Server-rendered page for /<klasse>/m/<module>/<...path>. Return null for "not found". */
  render(ctx: ModuleContext, path: string[], search: Record<string, string | undefined>): Promise<ReactNode | null>;
  actions?: Record<string, ModuleAction>;
  /** Versioned prompt files, embedded at build time (scripts/gen-prompts.mjs). */
  prompts?: Record<string, string>;
  /** Deterministic AI answers for tests and local development without a model. */
  mockFixtures?: Record<string, MockFixture>;
  /** Upload kinds this module accepts, with limits. Uploads of other kinds are refused. */
  uploadKinds?: Record<string, { maxPages: number }>;
}

export function defineModuleDefinition(definition: ModuleDefinition): ModuleDefinition {
  return definition;
}
