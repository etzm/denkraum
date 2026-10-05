import type { ModuleManifest } from "@denkraum/core";
import { manifest as schreibwerkstatt } from "@denkraum/mod-deutsch-schreibwerkstatt";
import { manifest as trigonometrie } from "@denkraum/mod-mathematik-trigonometrie";

/** Module registry. A new module is one import here plus its own package under modules/. */
export const MODULES: readonly ModuleManifest[] = [schreibwerkstatt, trigonometrie];

export function modulesFor(group: { schulart: string; klasse: number }): ModuleManifest[] {
  return MODULES.filter((m) => m.schulart === group.schulart && m.klasse === group.klasse);
}

export function findModule(id: string): ModuleManifest | undefined {
  return MODULES.find((m) => m.id === id);
}
