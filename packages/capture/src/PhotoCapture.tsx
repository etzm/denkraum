"use client";

import { useEffect, useRef, useState } from "react";
import { reencode } from "./image.ts";

interface Page {
  id: number;
  original: Blob;
  turns: number;
  blob: Blob;
  preview: string;
}

export interface PhotoCaptureProps {
  /** Module id, upload kind and module reference (for example the worksheet id). */
  moduleId: string;
  kind: string;
  refId?: string;
  maxPages?: number;
  /** Longer side in pixels (1600 for worksheets, 2000 for running text, DECISIONS.md D-024). */
  maxSide?: number;
  /** Where to go after a successful upload; "{uploadId}" is replaced. */
  nextHref: string;
  endpoint?: string;
}

/**
 * Take or choose photos of a paper page, check them, upload them. Every page is re-encoded in the
 * browser before it leaves the device; the server checks again (packages/sdk/src/uploads.ts).
 */
export function PhotoCapture({ moduleId, kind, refId, maxPages = 6, maxSide = 1600, nextHref, endpoint = "/api/uploads" }: PhotoCaptureProps) {
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const nextId = useRef(1);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => () => pages.forEach((p) => URL.revokeObjectURL(p.preview)), [pages]);

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const room = maxPages - pages.length;
      const chosen = Array.from(files).slice(0, Math.max(0, room));
      if (files.length > room) setError(`Höchstens ${maxPages} Fotos. Die übrigen wurden nicht übernommen.`);
      const added: Page[] = [];
      for (const file of chosen) {
        const blob = await reencode(file, maxSide);
        added.push({ id: nextId.current++, original: file, turns: 0, blob, preview: URL.createObjectURL(blob) });
      }
      setPages((current) => [...current, ...added]);
    } catch {
      setError("Ein Foto konnte nicht gelesen werden. Versuch es bitte noch einmal.");
    } finally {
      setBusy(false);
    }
  }

  async function rotate(id: number) {
    const page = pages.find((p) => p.id === id);
    if (!page) return;
    const turns = (page.turns + 1) % 4;
    const blob = await reencode(page.original, maxSide, turns);
    setPages((current) => current.map((p) => (p.id === id ? { ...p, turns, blob, preview: URL.createObjectURL(blob) } : p)));
  }

  function move(id: number, delta: number) {
    setPages((current) => {
      const i = current.findIndex((p) => p.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= current.length) return current;
      const copy = [...current];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });
  }

  function upload() {
    if (pages.length === 0) return;
    setError(null);
    setProgress(0);
    const form = new FormData();
    form.set("module", moduleId);
    form.set("kind", kind);
    if (refId) form.set("ref", refId);
    pages.forEach((p, i) => form.append("pages", p.blob, `seite-${i + 1}.jpg`));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status === 201) {
        const { uploadId } = JSON.parse(xhr.responseText) as { uploadId: string };
        window.location.assign(nextHref.replace("{uploadId}", uploadId));
      } else {
        let message = "Das Hochladen hat nicht geklappt. Versuch es bitte noch einmal.";
        try {
          message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
        } catch {
          /* keep default */
        }
        setError(message);
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Keine Verbindung. Prüf das WLAN und versuch es noch einmal.");
    };
    xhr.send(form);
  }

  const button = "inline-flex min-h-12 items-center justify-center rounded-lg px-5 font-semibold";
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-l-4 border-accent bg-accent-soft p-4 text-sm">
        Fotografier nur dein Blatt: von oben, bei gutem Licht, die ganze Seite im Bild. Keine Gesichter, keine Namen.
      </div>
      {!online && <p className="text-bad" role="alert">Du bist offline. Hochladen geht erst wieder mit Internet.</p>}
      <div className="flex flex-wrap gap-3">
        <label className={`${button} bg-accent text-paper cursor-pointer`}>
          Foto aufnehmen
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void addFiles(e.target.files)} disabled={busy} />
        </label>
        <label className={`${button} border-2 border-accent text-accent cursor-pointer`}>
          Bild auswählen
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => void addFiles(e.target.files)} disabled={busy} data-testid="photo-input" />
        </label>
      </div>
      {pages.length > 0 && (
        <ol className="grid gap-3 sm:grid-cols-2">
          {pages.map((p, i) => (
            <li key={p.id} className="rounded-xl border border-line bg-card p-3 space-y-2 min-w-0">
              <p className="text-sm font-semibold">Seite {i + 1}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={`Vorschau Seite ${i + 1}`} className="w-full rounded-lg border border-line" />
              <div className="flex flex-wrap gap-2 text-sm">
                <button type="button" className="min-h-11 rounded-lg border border-line px-3" onClick={() => void rotate(p.id)}>
                  Drehen
                </button>
                <button type="button" className="min-h-11 rounded-lg border border-line px-3" onClick={() => move(p.id, -1)} disabled={i === 0}>
                  Nach vorn
                </button>
                <button type="button" className="min-h-11 rounded-lg border border-line px-3" onClick={() => move(p.id, 1)} disabled={i === pages.length - 1}>
                  Nach hinten
                </button>
                <button type="button" className="min-h-11 rounded-lg border border-line px-3 text-bad" onClick={() => setPages((c) => c.filter((x) => x.id !== p.id))}>
                  Entfernen
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {error && <p className="text-bad" role="alert">{error}</p>}
      <button type="button" className={`${button} w-full bg-accent text-paper disabled:opacity-50`} disabled={pages.length === 0 || busy || progress !== null || !online} onClick={upload}>
        {progress !== null ? `Wird hochgeladen … ${progress} %` : pages.length > 1 ? `${pages.length} Fotos hochladen` : "Foto hochladen"}
      </button>
    </div>
  );
}
