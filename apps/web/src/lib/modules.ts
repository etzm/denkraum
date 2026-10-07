import type { ModuleManifest } from "@denkraum/core";
import { definition as schreibwerkstatt } from "@denkraum/mod-deutsch-schreibwerkstatt/app";
import { definition as trigonometrie } from "@denkraum/mod-mathematik-trigonometrie/app";
import type { ModuleDefinition } from "@denkraum/sdk";

/** Module registry. A new module is one import here plus its own package under modules/. */
export const DEFINITIONS: readonly ModuleDefinition[] = [schreibwerkstatt, trigonometrie];
export const MODULES: readonly ModuleManifest[] = DEFINITIONS.map((d) => d.manifest);

export function modulesFor(group: { schulart: string; klasse: number }): ModuleManifest[] {
  return MODULES.filter((m) => m.schulart === group.schulart && m.klasse === group.klasse);
}

export function findModule(id: string): ModuleManifest | undefined {
  return MODULES.find((m) => m.id === id);
}

export function findDefinition(id: string): ModuleDefinition | undefined {
  return DEFINITIONS.find((d) => d.manifest.id === id);
}
