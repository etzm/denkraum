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

/**
 * What a module sees in the teacher view (DECISIONS.md D-017, D-030): the group with its
 * learners' pseudonyms, the database, and its own teacher actions. No model access and no
 * photos (docs/datenschutz/README.md, sections 3 and 4).
 */
export interface TeacherContext {
  manifest: ModuleManifest;
  viewer: { id: string };
  group: GroupInfo & { label: string };
  /** All learners of the group, sorted by pseudonym. The mapping to real names stays outside the app. */
  learners: readonly { id: string; pseudonym: string }[];
  /** URL of the module's teacher page, for example /klasse10/lehrkraft/m/mathematik-trigonometrie */
  basePath: string;
  db: Db;
  /** Server action bound to one of the module's teacher actions. */
  action(name: string): BoundAction;
  now: Date;
}

export type TeacherAction = (ctx: TeacherContext, form: FormData) => Promise<ActionResult>;

export interface TeacherView {
  /** Server-rendered page for /<klasse>/lehrkraft/m/<module>/<...path>. Return null for "not found". */
  render(ctx: TeacherContext, path: string[], search: Record<string, string | undefined>): Promise<ReactNode | null>;
  actions?: Record<string, TeacherAction>;
}

export interface ModuleDefinition {
  manifest: ModuleManifest;
  /** Server-rendered page for /<klasse>/m/<module>/<...path>. Return null for "not found". */
  render(ctx: ModuleContext, path: string[], search: Record<string, string | undefined>): Promise<ReactNode | null>;
  actions?: Record<string, ModuleAction>;
  /** Versioned prompt files, embedded at build time (scripts/gen-prompts.mjs). */
  prompts?: Record<string, string>;
  /** Deterministic AI answers for tests and local development without a model. */
  mockFixtures?: Record<string, MockFixture>;
  /**
   * Everything the module stores about one learner, for access and portability requests
   * (Art. 15 and 20 GDPR). Keep it in a plain .ts file so admin scripts can import it.
   */
  exportLearner?: (db: Db, learnerId: string) => Promise<Record<string, unknown[]>>;
  /** Upload kinds this module accepts, with limits. Uploads of other kinds are refused. */
  uploadKinds?: Record<string, { maxPages: number }>;
  /** Pages and actions for the teacher of a group (optional). */
  teacher?: TeacherView;
}

export function defineModuleDefinition(definition: ModuleDefinition): ModuleDefinition {
  return definition;
}
