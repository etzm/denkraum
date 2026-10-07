"use client";

import { useState } from "react";

type Angle = "alpha" | "beta";

// Right triangle ABC with the right angle at C: c = AB, a = BC (opposite A), b = AC (opposite B).
const A = { x: 40, y: 196 };
const B = { x: 250, y: 52 };
const C = { x: 250, y: 196 };

const HYP = "var(--color-hyp)";
const GK = "var(--color-gk)";
const AK = "var(--color-ak)";

const ROLE_COLOR = { Hypotenuse: HYP, Gegenkathete: GK, Ankathete: AK } as const;
type Role = keyof typeof ROLE_COLOR;

function roles(angle: Angle): Record<"a" | "b" | "c", Role> {
  return angle === "alpha"
    ? { a: "Gegenkathete", b: "Ankathete", c: "Hypotenuse" }
    : { a: "Ankathete", b: "Gegenkathete", c: "Hypotenuse" };
}

const NAME: Record<Angle, string> = { alpha: "α", beta: "β" };

/**
 * Lesson 4, interactive part: tap α or β, and the sides are coloured and named again relative to
 * that angle (hypotenuse red, opposite side blue, adjacent side green). Labels carry the names too,
 * so colour is never the only cue.
 */
export function TriangleExplorer() {
  const [angle, setAngle] = useState<Angle>("alpha");
  const r = roles(angle);
  const summary = `Blick von ${NAME[angle]}: a ist die ${r.a}, b ist die ${r.b}, c ist die Hypotenuse.`;

  const angleMark = (which: Angle) => {
    const at = which === "alpha" ? A : B;
    const active = angle === which;
    // Tapping the angle in the drawing is a shortcut; the buttons above are the accessible way.
    return (
      <g onClick={() => setAngle(which)} className="cursor-pointer" data-testid={`winkel-${which}`}>
        <circle cx={at.x} cy={at.y} r={22} fill={active ? "var(--color-accent-soft)" : "transparent"} stroke={active ? "var(--color-accent)" : "var(--color-line)"} strokeWidth={2} />
        <text
          x={which === "alpha" ? at.x + 30 : at.x - 16}
          y={which === "alpha" ? at.y - 8 : at.y + 42}
          fontSize={18}
          fontWeight={700}
          fill="var(--color-ink)"
        >
          {NAME[which]}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Winkel wählen">
        {(["alpha", "beta"] as const).map((which) => (
          <button
            key={which}
            type="button"
            aria-pressed={angle === which}
            onClick={() => setAngle(which)}
            className={`min-h-11 rounded-lg border-2 px-4 font-semibold ${angle === which ? "border-accent bg-accent text-paper" : "border-line bg-card"}`}
          >
            Winkel {NAME[which]}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 340 240" className="w-full max-w-md" role="img" aria-label={`Rechtwinkliges Dreieck ABC mit rechtem Winkel bei C. ${summary}`}>
        <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={ROLE_COLOR[r.c]} strokeWidth={5} strokeLinecap="round" />
        <line x1={B.x} y1={B.y} x2={C.x} y2={C.y} stroke={ROLE_COLOR[r.a]} strokeWidth={5} strokeLinecap="round" />
        <line x1={A.x} y1={A.y} x2={C.x} y2={C.y} stroke={ROLE_COLOR[r.b]} strokeWidth={5} strokeLinecap="round" />
        <rect x={C.x - 16} y={C.y - 16} width={16} height={16} fill="none" stroke="var(--color-ink)" strokeWidth={1.5} />
        <circle cx={C.x - 6} cy={C.y - 6} r={1.8} fill="var(--color-ink)" />
        {angleMark("alpha")}
        {angleMark("beta")}
        <text x={A.x - 36} y={A.y + 6} fontSize={14} fill="var(--color-muted)">A</text>
        <text x={B.x + 26} y={B.y + 4} fontSize={14} fill="var(--color-muted)">B</text>
        <text x={C.x + 8} y={C.y + 18} fontSize={14} fill="var(--color-muted)">C</text>
        <text x={120} y={104} fontSize={14} fontWeight={700} fill={ROLE_COLOR[r.c]} textAnchor="end">
          c: Hypotenuse
        </text>
        <text x={C.x + 10} y={122} fontSize={14} fontWeight={700} fill={ROLE_COLOR[r.a]}>
          a
        </text>
        <text x={C.x + 10} y={140} fontSize={12} fill={ROLE_COLOR[r.a]}>
          {r.a}
        </text>
        <text x={(A.x + C.x) / 2} y={C.y + 30} fontSize={14} fontWeight={700} fill={ROLE_COLOR[r.b]} textAnchor="middle">
          b: {r.b}
        </text>
      </svg>
      <p aria-live="polite" className="font-medium">
        {summary}
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <li className="font-semibold" style={{ color: HYP }}>Hypotenuse: gegenüber dem rechten Winkel</li>
        <li className="font-semibold" style={{ color: GK }}>Gegenkathete: gegenüber dem Winkel</li>
        <li className="font-semibold" style={{ color: AK }}>Ankathete: liegt am Winkel an</li>
      </ul>
    </div>
  );
}
