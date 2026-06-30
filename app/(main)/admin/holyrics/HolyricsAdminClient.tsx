"use client";

import { Button } from "@/components/ui/button";
import {
  holyricsPopupCreateSong,
  holyricsSearchSong,
  fetchHolyricsConfig,
} from "@/lib/holyrics";
import { ClientArrangement } from "@/prisma/models";
import { CheckCircle2, Circle, Loader2, RefreshCw, Settings, Unlink, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

type ArrangementOption = {
  id: number;
  key: string;
  name: string | null;
  isDefault: boolean;
  units: { content: string; type: string; order: number }[];
};

type SongRow = {
  slug: string;
  title: string;
  artist: string | null;
  holyricsId: string | null;
  arrangements: ArrangementOption[];
  usedInServices: boolean;
};

function arrangementLabel(a: ArrangementOption) {
  return a.name ? `${a.name} (${a.key})` : a.key;
}

// searching    → buscando no Holyrics
// not_found    → não existe no Holyrics, precisa criar
// popup_open   → popup aberto no Holyrics, aguardando o usuário salvar
// linking      → buscando ID após o usuário salvar no Holyrics
// linked       → vinculado com sucesso
// error        → algo deu errado
type SongStatus = "idle" | "searching" | "not_found" | "popup_open" | "linking" | "linked" | "error";

type Props = {
  songs: SongRow[];
  initialToken: string;
  initialHost: string;
};

export default function HolyricsAdminClient({ songs: initialSongs, initialToken, initialHost }: Props) {
  const [songs, setSongs] = useState(initialSongs);
  const [token, setToken] = useState(initialToken);
  const [host, setHost] = useState(initialHost);
  const [showSettings, setShowSettings] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, SongStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [manualIds, setManualIds] = useState<Record<string, string>>({});
  const [selectedArrangementIds, setSelectedArrangementIds] = useState<Record<string, number>>({});

  const [onlyInServices, setOnlyInServices] = useState(false);
  const [wizardActive, setWizardActive] = useState(false);
  const [wizardIndex, setWizardIndex] = useState(0);
  // Fila estável: calculada uma vez ao iniciar o wizard.
  // Não pode derivar de `songs` dinamicamente — quando uma música é vinculada
  // durante o wizard, ela sai de visibleSongs e o índice aponta para a errada.
  const [wizardQueue, setWizardQueue] = useState<SongRow[]>([]);

  const visibleSongs = onlyInServices ? songs.filter((s) => s.usedInServices) : songs;
  const pendingSongs = visibleSongs.filter((s) => !s.holyricsId);
  const currentWizardSong = wizardQueue[wizardIndex];

  // Ao avançar o wizard, busca automaticamente no Holyrics
  useEffect(() => {
    if (!wizardActive || !currentWizardSong) return;
    const slug = currentWizardSong.slug;
    const st = statuses[slug];
    if (st && st !== "idle" && st !== "error") return; // já processando
    searchAndMaybeLink(currentWizardSong);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardActive, wizardIndex, wizardQueue]);

  function setStatus(slug: string, status: SongStatus) {
    setStatuses((prev) => ({ ...prev, [slug]: status }));
  }

  function setError(slug: string, msg: string) {
    setErrors((prev) => ({ ...prev, [slug]: msg }));
  }

  async function handleSaveConfig() {
    setSavingConfig(true);
    await fetch("/api/holyrics-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, host }),
    });
    setSavingConfig(false);
    setShowSettings(false);
  }

  async function persistHolyricsId(slug: string, holyricsId: string) {
    await fetch(`/api/songs/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holyricsId }),
    });
    setSongs((prev) => prev.map((s) => (s.slug === slug ? { ...s, holyricsId } : s)));
  }

  async function unlinkSong(slug: string) {
    await fetch(`/api/songs/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holyricsId: null }),
    });
    setSongs((prev) => prev.map((s) => (s.slug === slug ? { ...s, holyricsId: null } : s)));
    setStatus(slug, "idle");
  }

  // Busca no Holyrics primeiro. Se encontrar, vincula direto.
  // Se não encontrar, muda para not_found (mostra botão de criar).
  async function searchAndMaybeLink(song: SongRow): Promise<boolean> {
    setStatus(song.slug, "searching");
    setError(song.slug, "");
    try {
      const id = await holyricsSearchSong(token, host, song.title);
      if (id) {
        await persistHolyricsId(song.slug, id);
        setStatus(song.slug, "linked");
        return true;
      }
      setStatus(song.slug, "not_found");
      return false;
    } catch (e) {
      setError(song.slug, (e as Error).message);
      setStatus(song.slug, "error");
      return false;
    }
  }

  function getSelectedArrangement(song: SongRow): ArrangementOption | undefined {
    const selectedId = selectedArrangementIds[song.slug];
    if (selectedId != null) {
      const found = song.arrangements.find((a) => a.id === selectedId);
      if (found) return found;
    }
    return song.arrangements.find((a) => a.isDefault) ?? song.arrangements[0];
  }

  // Abre o popup de criação no Holyrics, usando o arranjo selecionado para a letra
  async function openPopup(song: SongRow) {
    setStatus(song.slug, "popup_open");
    setError(song.slug, "");
    try {
      const units = getSelectedArrangement(song)?.units ?? [];
      const arrangement = { units } as unknown as ClientArrangement;
      await holyricsPopupCreateSong(song.title, song.artist, arrangement, host);
    } catch {
      setError(song.slug, "Não foi possível conectar ao Holyrics. Verifique se o programa está aberto e o API Server ativado.");
      setStatus(song.slug, "error");
    }
  }

  // Após o usuário salvar no Holyrics, busca o ID gerado e vincula
  async function linkAfterSave(song: SongRow) {
    setStatus(song.slug, "linking");
    setError(song.slug, "");
    try {
      const id = await holyricsSearchSong(token, host, song.title);
      if (!id) throw new Error(`"${song.title}" não foi encontrada pelo título. Se o título no Holyrics é diferente, cole o ID da música abaixo.`);
      await persistHolyricsId(song.slug, id);
      setStatus(song.slug, "linked");
    } catch (e) {
      setError(song.slug, (e as Error).message);
      setStatus(song.slug, "error");
    }
  }

  async function linkManually(song: SongRow) {
    const id = manualIds[song.slug]?.trim();
    if (!id) return;
    setStatus(song.slug, "linking");
    setError(song.slug, "");
    try {
      await persistHolyricsId(song.slug, id);
      setStatus(song.slug, "linked");
      setManualIds((prev) => ({ ...prev, [song.slug]: "" }));
    } catch (e) {
      setError(song.slug, (e as Error).message);
      setStatus(song.slug, "error");
    }
  }

  // Wizard: vincula (ou cria) e avança
  async function wizardLinkAfterSave() {
    if (!currentWizardSong) return;
    await linkAfterSave(currentWizardSong);
    advanceWizard();
  }

  function advanceWizard() {
    if (wizardIndex < wizardQueue.length - 1) {
      setWizardIndex((i) => i + 1);
    } else {
      setWizardActive(false);
    }
  }

  // Wizard: para músicas auto-vinculadas, avança sem interação do usuário
  useEffect(() => {
    if (!wizardActive || !currentWizardSong) return;
    if (statuses[currentWizardSong.slug] === "linked") {
      const t = setTimeout(advanceWizard, 600);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, wizardActive, wizardIndex]);

  const linked = visibleSongs.filter((s) => s.holyricsId).length;

  return (
    <div className="space-y-6">
      {/* Token e Host */}
      <div className="border rounded-lg p-4 bg-zinc-50">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-sm">Configuração Holyrics</span>
            <div className="ml-3 text-sm text-muted-foreground font-mono space-y-0.5">
              <div>Host: {host || "não configurado"}</div>
              <div>Token: {token ? `${token.slice(0, 6)}…` : "não configurado"}</div>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowSettings((v) => !v)}>
            <Settings size={16} className="mr-1" /> Configurar
          </Button>
        </div>

        {showSettings && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Host do Holyrics (ex: localhost:8091 ou 192.168.1.100:8091)
              </label>
              <input
                className="border rounded px-2 py-1 text-sm w-full font-mono"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="localhost:8091"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Token (Holyrics → API Server → Gerenciar permissões)
              </label>
              <input
                className="border rounded px-2 py-1 text-sm w-full font-mono"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="abcdef"
              />
            </div>
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={handleSaveConfig} disabled={savingConfig}>
                {savingConfig && <Loader2 size={14} className="mr-1 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Filtro + Progresso */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{linked}</span> de {visibleSongs.length} vinculadas
          </div>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-emerald-600"
              checked={onlyInServices}
              onChange={(e) => { setOnlyInServices(e.target.checked); setWizardActive(false); }}
            />
            Apenas músicas em cultos
          </label>
        </div>
        {pendingSongs.length > 0 && (
          <Button
            type="button"
            size="sm"
            onClick={() => { setWizardQueue(pendingSongs); setWizardIndex(0); setWizardActive(true); }}
            disabled={wizardActive}
          >
            Vincular pendentes ({pendingSongs.length})
          </Button>
        )}
      </div>

      {/* Wizard */}
      {wizardActive && currentWizardSong && (
        <WizardCard
          song={currentWizardSong}
          status={statuses[currentWizardSong.slug] ?? "searching"}
          error={errors[currentWizardSong.slug] ?? ""}
          index={wizardIndex}
          total={wizardQueue.length}
          manualId={manualIds[currentWizardSong.slug] ?? ""}
          selectedArrangementId={getSelectedArrangement(currentWizardSong)?.id}
          onOpenPopup={() => openPopup(currentWizardSong)}
          onLinkAfterSave={wizardLinkAfterSave}
          onRetry={() => searchAndMaybeLink(currentWizardSong)}
          onPause={() => setWizardActive(false)}
          onManualIdChange={(v) => setManualIds((prev) => ({ ...prev, [currentWizardSong.slug]: v }))}
          onLinkManually={() => { linkManually(currentWizardSong).then(advanceWizard); }}
          onArrangementChange={(id) => setSelectedArrangementIds((prev) => ({ ...prev, [currentWizardSong.slug]: id }))}
        />
      )}
      {wizardActive && !currentWizardSong && (
        <div className="border-2 border-emerald-500 rounded-lg p-5 bg-emerald-50 text-center">
          <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
          <p className="font-medium text-emerald-800">Todas as músicas vinculadas!</p>
        </div>
      )}

      {/* Lista */}
      <div className="border rounded-lg divide-y">
        {visibleSongs.map((song) => {
          const status = statuses[song.slug] ?? (song.holyricsId ? "linked" : "idle");
          const isLinked = !!song.holyricsId;
          const isCurrentWizardSong = wizardActive && currentWizardSong?.slug === song.slug;
          const needsGuidance =
            !wizardActive &&
            (status === "not_found" || status === "popup_open" || (status === "error" && !isLinked));
          return (
            <div
              key={song.slug}
              className={`px-4 py-3 ${isCurrentWizardSong ? "bg-emerald-50" : ""}`}
            >
              <div className="flex items-center gap-3">
                <StatusIcon status={isLinked ? "linked" : status} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{song.title}</div>
                  {song.artist && (
                    <div className="text-xs text-muted-foreground truncate">{song.artist}</div>
                  )}
                  {isLinked && (
                    <div className="text-xs text-emerald-600">Vinculada ao Holyrics</div>
                  )}
                  {errors[song.slug] && !wizardActive && (
                    <div className="text-xs text-red-600 mt-0.5">{errors[song.slug]}</div>
                  )}
                </div>
                {/* Durante o wizard, ação só no card acima — sem botões na lista */}
                {!wizardActive && (
                  <div className="flex gap-2 shrink-0">
                    {!isLinked && status === "idle" && (
                      <Button type="button" size="sm" variant="outline" onClick={() => searchAndMaybeLink(song)}>
                        Vincular
                      </Button>
                    )}
                    {!isLinked && (status === "searching" || status === "linking") && (
                      <Loader2 size={16} className="animate-spin text-muted-foreground" />
                    )}
                    {!isLinked && status === "not_found" && (
                      <Button type="button" size="sm" onClick={() => openPopup(song)}>
                        Criar no Holyrics
                      </Button>
                    )}
                    {!isLinked && status === "popup_open" && (
                      <Button type="button" size="sm" variant="outline" onClick={() => linkAfterSave(song)}>
                        Já salvei →
                      </Button>
                    )}
                    {!isLinked && status === "error" && (
                      <Button type="button" size="sm" variant="outline" onClick={() => searchAndMaybeLink(song)}>
                        Tentar novamente
                      </Button>
                    )}
                    {isLinked && status === "linked" && (
                      <>
                        <Button type="button" size="sm" variant="ghost" onClick={() => openPopup(song)}>
                          <RefreshCw size={14} className="mr-1" /> Ressincronizar
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => unlinkSong(song.slug)}>
                          <Unlink size={14} />
                        </Button>
                      </>
                    )}
                    {isLinked && status === "popup_open" && (
                      <Button type="button" size="sm" variant="outline" onClick={() => setStatus(song.slug, "linked")}>
                        Concluído
                      </Button>
                    )}
                    {isLinked && status === "error" && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setStatus(song.slug, "linked")}>
                        Fechar
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {needsGuidance && (
                <div className="ml-7 mt-2 text-xs text-muted-foreground space-y-2">
                  {status === "not_found" && (
                    <div className="space-y-1.5">
                      <p>Música não encontrada no Holyrics. Clique em <strong>Criar no Holyrics</strong> — isso abre um formulário de criação direto no aplicativo Holyrics (não no browser). Salve por lá e volte aqui.</p>
                      {song.arrangements.length > 1 && (
                        <label className="flex items-center gap-2">
                          <span>Arranjo a exportar:</span>
                          <select
                            className="border rounded px-1.5 py-0.5 text-xs bg-white"
                            value={getSelectedArrangement(song)?.id}
                            onChange={(e) =>
                              setSelectedArrangementIds((prev) => ({ ...prev, [song.slug]: Number(e.target.value) }))
                            }
                          >
                            {song.arrangements.map((a) => (
                              <option key={a.id} value={a.id}>{arrangementLabel(a)}</option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  )}
                  {!isLinked && status === "popup_open" && (
                    <p>O formulário de criação abriu no <strong>aplicativo Holyrics</strong>. Salve a música lá e clique em <strong>Já salvei →</strong> para registrar o vínculo aqui.</p>
                  )}
                  {isLinked && status === "popup_open" && (
                    <p>O formulário abriu novamente no <strong>aplicativo Holyrics</strong> com a letra atual. Se ele perguntar sobre duplicar, escolha <strong>atualizar a música existente</strong>. Depois clique em <strong>Concluído</strong>.</p>
                  )}
                  {!isLinked && status === "error" && (
                    <div className="space-y-1.5">
                      <p>Se a música existe no Holyrics mas o título é diferente, cole o ID dela abaixo (clique direito na música no Holyrics → Propriedades → ID).</p>
                      <div className="flex gap-2">
                        <input
                          className="border rounded px-2 py-1 text-xs font-mono flex-1 min-w-0"
                          placeholder="ID do Holyrics"
                          value={manualIds[song.slug] ?? ""}
                          onChange={(e) => setManualIds((prev) => ({ ...prev, [song.slug]: e.target.value }))}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => linkManually(song)}
                          disabled={!manualIds[song.slug]?.trim()}
                        >
                          Vincular
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: SongStatus | "linked" }) {
  if (status === "linked") return <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />;
  if (status === "searching" || status === "linking") return <Loader2 size={18} className="animate-spin text-muted-foreground shrink-0" />;
  if (status === "error") return <XCircle size={18} className="text-red-500 shrink-0" />;
  if (status === "popup_open") return <Loader2 size={18} className="animate-spin text-emerald-500 shrink-0" />;
  return <Circle size={18} className="text-muted-foreground shrink-0" />;
}

type WizardCardProps = {
  song: SongRow;
  status: SongStatus;
  error: string;
  index: number;
  total: number;
  manualId: string;
  selectedArrangementId: number | undefined;
  onOpenPopup: () => void;
  onLinkAfterSave: () => void;
  onRetry: () => void;
  onPause: () => void;
  onManualIdChange: (v: string) => void;
  onLinkManually: () => void;
  onArrangementChange: (id: number) => void;
};

function WizardCard({ song, status, error, index, total, manualId, selectedArrangementId, onOpenPopup, onLinkAfterSave, onRetry, onPause, onManualIdChange, onLinkManually, onArrangementChange }: WizardCardProps) {
  return (
    <div className="border-2 border-emerald-500 rounded-lg p-5 bg-emerald-50">
      <div className="text-xs text-muted-foreground mb-1">{index + 1} de {total}</div>
      <div className="font-semibold text-lg">{song.title}</div>
      {song.artist && <div className="text-sm text-muted-foreground">{song.artist}</div>}

      <div className="mt-4 space-y-3">
        {(status === "searching" || status === "linking") && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin shrink-0" />
            {status === "searching" ? "Verificando se já existe no Holyrics…" : "Salvando vínculo…"}
          </p>
        )}

        {status === "linked" && (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 size={14} className="shrink-0" /> Encontrada e vinculada. Avançando…
          </p>
        )}

        {status === "not_found" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Música não existe no Holyrics ainda. Clique abaixo para abrir o formulário de criação
              direto no aplicativo Holyrics.
            </p>
            {song.arrangements.length > 1 && (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Arranjo a exportar:</span>
                <select
                  className="border rounded px-1.5 py-1 text-sm bg-white"
                  value={selectedArrangementId}
                  onChange={(e) => onArrangementChange(Number(e.target.value))}
                >
                  {song.arrangements.map((a) => (
                    <option key={a.id} value={a.id}>{arrangementLabel(a)}</option>
                  ))}
                </select>
              </label>
            )}
            <Button type="button" onClick={onOpenPopup}>
              Criar no Holyrics
            </Button>
          </div>
        )}

        {status === "popup_open" && (
          <div className="space-y-2">
            <p className="text-sm text-emerald-700 font-medium">
              O Holyrics abriu o formulário de criação.
            </p>
            <p className="text-sm text-muted-foreground">
              Verifique a letra, ajuste se necessário e salve a música no Holyrics. Depois volte aqui e clique em:
            </p>
            <Button type="button" onClick={onLinkAfterSave}>
              Já salvei no Holyrics →
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-2">
            <p className="text-sm text-red-600">{error}</p>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={onRetry}>
                Tentar novamente
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Se a música existe no Holyrics com outro título, cole o ID dela abaixo (clique direito na música → Propriedades → ID).
            </p>
            <div className="flex gap-2">
              <input
                className="border rounded px-2 py-1 text-xs font-mono flex-1 min-w-0 bg-white"
                placeholder="ID do Holyrics"
                value={manualId}
                onChange={(e) => onManualIdChange(e.target.value)}
              />
              <Button type="button" size="sm" onClick={onLinkManually} disabled={!manualId.trim()}>
                Vincular
              </Button>
            </div>
          </div>
        )}

        <div>
          <Button type="button" variant="ghost" size="sm" onClick={onPause}>
            Pausar wizard
          </Button>
        </div>
      </div>
    </div>
  );
}
