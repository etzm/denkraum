export const metadata = { title: "Datenschutz | Denkraum" };

/**
 * Draft. Placeholders in square brackets are filled in with the school and its data
 * protection officer before any real use (docs/datenschutz/README.md section 9).
 */
export default function Datenschutz() {
  return (
    <article className="space-y-8 leading-relaxed">
      <h1 className="text-2xl font-semibold">Datenschutz</h1>
      <p className="rounded-lg border border-line p-3 text-sm text-muted">Entwurf. Platzhalter in eckigen Klammern werden vor dem Einsatz ergänzt.</p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Für dich</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Du brauchst keinen Namen und keine E-Mail. Das System gibt dir einen ausgedachten Namen und einen Code.</li>
          <li>Wenn du ein Foto hochlädst, fotografier nur dein Blatt. Keine Gesichter, keine Namen.</li>
          <li>Deine Fotos werden nach 14 Tagen gelöscht. Deine Texte und Rückmeldungen spätestens am Ende des Schuljahres.</li>
          <li>Eine KI liest deine Lösung und schreibt dir eine Rückmeldung. Die KI erfährt nicht, wer du bist. Sie gibt keine Noten.</li>
          <li>Es gibt keine Werbung und kein Tracking. Die App setzt nur ein Cookie, damit du angemeldet bleibst.</li>
          <li>Du kannst jederzeit sagen, dass alles über dich gelöscht werden soll. Sag es deiner Lehrkraft oder deinen Eltern.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Für Eltern und Lehrkräfte</h2>
        <dl className="space-y-3">
          <div>
            <dt className="font-medium">Verantwortliche Stelle</dt>
            <dd>[Name und Anschrift der verantwortlichen Stelle]</dd>
          </div>
          <div>
            <dt className="font-medium">Datenschutzbeauftragte Person</dt>
            <dd>[Kontakt]</dd>
          </div>
          <div>
            <dt className="font-medium">Verarbeitete Daten</dt>
            <dd>
              Pseudonym und Zugangscode; Fotos von Arbeitsblättern und Texten; daraus erstellte Abschriften, Rückmeldungen und
              Lernstand. Keine Klarnamen, keine E-Mail-Adressen von Schülerinnen und Schülern, keine Standortdaten. Bildmetadaten
              (zum Beispiel GPS) werden beim Hochladen entfernt.
            </dd>
          </div>
          <div>
            <dt className="font-medium">KI-Verarbeitung</dt>
            <dd>
              Abschrift und Formulierung der Rückmeldung erfolgen über ein Sprachmodell in einem Rechenzentrum in der EU [Anbieter
              und Region]. Die Anfragen enthalten keine Angaben zur Person. Die KI vergibt keine Noten und trifft keine Entscheidungen
              über den Lernweg; diese folgen festen, nachvollziehbaren Regeln.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Speicherdauer</dt>
            <dd>Fotos 14 Tage. Abschriften, Rückmeldungen und Lernstand bis zum Ende des Schuljahres oder des Pilots.</dd>
          </div>
          <div>
            <dt className="font-medium">Ihre Rechte</dt>
            <dd>Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Beschwerde bei der Aufsichtsbehörde [Behörde].</dd>
          </div>
          <div>
            <dt className="font-medium">Rechtsgrundlage</dt>
            <dd>[Rechtsgrundlage, abhängig vom Einsatzrahmen]</dd>
          </div>
        </dl>
      </section>
    </article>
  );
}
