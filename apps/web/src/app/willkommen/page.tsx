import Link from "next/link";
import { redirect } from "next/navigation";
import { currentLearner } from "@/lib/session.ts";

export default async function Willkommen() {
  const session = await currentLearner();
  if (!session) redirect("/");
  const { learner } = session;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Willkommen!</h1>
      <p>
        Hier heißt du <strong>{learner.pseudonym}</strong>. Diesen Namen hat das System für dich ausgedacht, damit niemand deinen
        echten Namen kennt.
      </p>
      <div className="rounded-lg border border-line p-4 space-y-2">
        <p className="font-medium">Dein persönlicher Code</p>
        <p className="text-2xl tracking-widest font-mono">{learner.personalCode}</p>
        <p className="text-sm text-muted">
          Schreib dir den Code auf. Damit kommst du auch auf einem anderen Gerät wieder hierher. Schreib deinen Namen nicht dazu.
        </p>
      </div>
      <Link href="/m" className="inline-flex min-h-12 items-center rounded-lg bg-accent px-6 font-semibold text-paper hover:bg-accent-strong">
        Weiter
      </Link>
    </div>
  );
}
