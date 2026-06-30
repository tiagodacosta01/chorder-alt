"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchHolyricsConfig, holyricsSetPlaylist, holyricsPopupCreateSong } from "@/lib/holyrics";
import { ClientService } from "@/prisma/models";
import { CheckCircle2, Circle, Loader2, Radio, RefreshCw, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type Props = { service: ClientService };

export default function HolyricsSetlistButton({ service }: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");
  const [resyncingIndex, setResyncingIndex] = useState<number | null>(null);
  const [resyncError, setResyncError] = useState<Record<number, string>>({});

  const units = (service.units ?? [])
    .filter((u) => u.arrangement?.song)
    .sort((a, b) => a.order - b.order);

  const allLinked = units.every((u) => u.arrangement?.song?.holyricsId);

  async function sendToHolyrics() {
    setSending(true);
    setSent(false);
    setSendError("");
    try {
      const config = await fetchHolyricsConfig();
      const ids = units.map((u) => u.arrangement!.song!.holyricsId as string);
      await holyricsSetPlaylist(config.token, config.host, ids);
      setSent(true);
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function resyncSong(index: number) {
    const unit = units[index];
    if (!unit.arrangement?.song) return;
    setResyncingIndex(index);
    setResyncError((prev) => ({ ...prev, [index]: "" }));
    try {
      await holyricsPopupCreateSong(
        unit.arrangement.song.title,
        unit.arrangement.song.artist,
        unit.arrangement,
        (await fetchHolyricsConfig()).host
      );
    } catch (e) {
      setResyncError((prev) => ({ ...prev, [index]: (e as Error).message }));
    }
  }

  function completeResync(index: number) {
    setResyncingIndex(null);
    setResyncError((prev) => ({ ...prev, [index]: "" }));
  }

  const triggerIcon = sending
    ? <Loader2 size={18} className="animate-spin" />
    : sent
      ? <CheckCircle2 size={18} className="text-emerald-500" />
      : <Radio size={18} className={!allLinked ? "text-amber-500" : ""} />;

  return (
    <Popover onOpenChange={() => { setSent(false); setSendError(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" disabled={sending}>
          {triggerIcon}
          <span className="sr-only">Holyrics</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-3" align="end">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Setlist no Holyrics
        </p>

        {units.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma música no culto.</p>
        ) : (
          <ul className="space-y-1.5 mb-3">
            {units.map((u, i) => {
              const title = u.arrangement?.song?.title ?? "?";
              const linked = !!u.arrangement?.song?.holyricsId;
              const isResyncing = resyncingIndex === i;
              return (
                <li key={i} className="flex items-center gap-2 text-sm">
                  {isResyncing ? (
                    <Loader2 size={14} className="shrink-0 animate-spin text-emerald-500" />
                  ) : linked ? (
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                  ) : (
                    <Circle size={14} className="shrink-0 text-amber-500" />
                  )}
                  <span className={linked ? "" : "text-amber-700"}>{title}</span>
                  {linked && !isResyncing && (
                    <button
                      type="button"
                      className="ml-auto p-0.5 hover:bg-emerald-100 rounded transition-colors"
                      onClick={() => resyncSong(i)}
                      title="Ressincronizar arranjo no Holyrics"
                    >
                      <RefreshCw size={13} className="text-emerald-600" />
                    </button>
                  )}
                  {isResyncing && (
                    <button
                      type="button"
                      className="ml-auto text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors"
                      onClick={() => completeResync(i)}
                    >
                      Concluído
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {resyncingIndex !== null && (
          <div className="text-xs text-emerald-700 bg-emerald-50 rounded p-2 mb-3">
            O formulário abriu no <strong>Holyrics</strong>. Atualize o arranjo e salve por lá. Depois clique em <strong>Concluído</strong> aqui.
          </div>
        )}

        {!allLinked && (
          <div className="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-3 flex items-start gap-1.5">
            <XCircle size={13} className="shrink-0 mt-0.5" />
            <span>
              Algumas músicas não estão vinculadas ao Holyrics.{" "}
              <Link href="/admin/holyrics" className="underline font-medium">
                Exportar catálogo
              </Link>
            </span>
          </div>
        )}

        {sendError && (
          <p className="text-xs text-red-600 mb-3">{sendError}</p>
        )}

        {Object.entries(resyncError).map(([idx, err]) => err && (
          <p key={idx} className="text-xs text-red-600 mb-2">{err}</p>
        ))}

        {sent && (
          <p className="text-xs text-emerald-600 mb-3">Setlist enviado com sucesso!</p>
        )}

        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={sending || units.length === 0 || !allLinked}
          onClick={sendToHolyrics}
        >
          {sending
            ? <><Loader2 size={14} className="mr-1 animate-spin" /> Enviando…</>
            : "Enviar setlist"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
