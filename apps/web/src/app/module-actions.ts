"use server";

import { redirect } from "next/navigation";
import { slugForKlasse } from "@/lib/classes.ts";
import { findDefinition } from "@/lib/modules.ts";
import { buildModuleContext } from "@/lib/runtime.ts";
import { currentLearner } from "@/lib/session.ts";

/** The one server action behind every module form: checks the session, then runs the module's action. */
export async function runModuleAction(moduleId: string, name: string, formData: FormData): Promise<void> {
  const session = await currentLearner();
  if (!session) redirect("/");
  const definition = findDefinition(moduleId);
  const action = definition?.actions?.[name];
  const { manifest } = definition ?? {};
  if (!definition || !action || !manifest || manifest.klasse !== session.group.klasse || manifest.schulart !== session.group.schulart) {
    redirect(`/${slugForKlasse(session.group.klasse)}`);
  }
  const ctx = await buildModuleContext(definition, session);
  const result = await action(ctx, formData);
  if (result?.redirect) redirect(result.redirect);
}
