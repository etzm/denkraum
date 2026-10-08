"use server";

import { redirect } from "next/navigation";
import { slugForKlasse } from "@/lib/classes.ts";
import { findDefinition } from "@/lib/modules.ts";
import { buildTeacherContext } from "@/lib/runtime.ts";
import { currentViewer } from "@/lib/session.ts";

/** The one server action behind every teacher form of a module: checks the teacher session, then runs the action. */
export async function runTeacherAction(moduleId: string, name: string, formData: FormData): Promise<void> {
  const session = await currentViewer();
  if (!session) redirect("/");
  const definition = findDefinition(moduleId);
  const action = definition?.teacher?.actions?.[name];
  const { manifest } = definition ?? {};
  if (!definition || !action || !manifest || manifest.klasse !== session.group.klasse || manifest.schulart !== session.group.schulart) {
    redirect(`/${slugForKlasse(session.group.klasse)}/lehrkraft`);
  }
  const ctx = await buildTeacherContext(definition, session);
  const result = await action(ctx, formData);
  if (result?.redirect) redirect(result.redirect);
}
