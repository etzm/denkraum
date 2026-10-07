"use client";

import { useState } from "react";

const WORD = /[\p{L}\p{N}]/u;

/** Same counting rule as domain/text.ts `countWords`; the server counts again and decides. */
function count(text: string): number {
  return text.split(/\s+/).filter((t) => WORD.test(t)).length;
}

/** Textarea with a live word count, for the 80 word minimum (spec 7.1). */
export function WordCountField(props: { name: string; id: string; label: string; defaultValue: string; minWords: number; rows: number; hint: string }) {
  const [words, setWords] = useState(() => count(props.defaultValue));
  const enough = words >= props.minWords;
  return (
    <div className="space-y-2">
      <label htmlFor={props.id} className="block font-semibold">
        {props.label}
      </label>
      <p id={`${props.id}-hinweis`} className="text-sm text-muted">
        {props.hint}
      </p>
      <textarea
        id={props.id}
        name={props.name}
        rows={props.rows}
        required
        defaultValue={props.defaultValue}
        aria-describedby={`${props.id}-hinweis ${props.id}-zaehler`}
        onChange={(e) => setWords(count(e.target.value))}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 leading-relaxed"
      />
      <p id={`${props.id}-zaehler`} aria-live="polite" className={`text-sm ${enough ? "text-ok" : "text-muted"}`}>
        {words} {words === 1 ? "Wort" : "Wörter"}
        {enough ? "" : `, mindestens ${props.minWords}`}
      </p>
    </div>
  );
}
