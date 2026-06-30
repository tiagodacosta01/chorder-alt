import { getLyrics } from "@/chopro/music";
import { ClientArrangement } from "@/prisma/models";

export type HolyricsConfig = { token: string; host: string };

export async function fetchHolyricsConfig(): Promise<HolyricsConfig> {
  const res = await fetch("/api/holyrics-config");
  if (!res.ok) return { token: "", host: "localhost:8091" };
  return res.json();
}

function apiUrl(action: string, token: string, host: string) {
  return `http://${host}/api/${action}?token=${token}`;
}

// O Holyrics retorna erros (ex: permissão negada) com HTTP 200 e
// { status: "error", error: ... } no corpo — checar só res.ok não basta.
async function holyricsApiCall(action: string, token: string, host: string, body: unknown = {}): Promise<any> {
  const res = await fetch(apiUrl(action, token, host), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${action} falhou (HTTP ${res.status}). Verifique se o Holyrics está aberto e acessível.`);
  }
  const json = await res.json();
  if (json?.status === "error") {
    const err = json.error;
    const message = typeof err === "string" ? err : err?.message ?? JSON.stringify(err);
    throw new Error(`${action} falhou: ${message}. Verifique se a permissão "${action}" está habilitada para o token.`);
  }
  return json;
}

export async function holyricsPopupCreateSong(
  title: string,
  artist: string | null | undefined,
  arrangement: ClientArrangement,
  host: string = "localhost:8091"
): Promise<void> {
  const units = [...(arrangement.units ?? [])].sort((a, b) => a.order - b.order);

  const paragraphs = units
    .map((unit) => ({
      text: getLyrics(unit.content)?.trim() ?? "",
      description: unit.type.toLowerCase(),
    }))
    .filter((p) => p.text.length > 0);

  const body: Record<string, unknown> = { title, paragraphs };
  if (artist) body.artist = artist;

  const res = await fetch(`http://${host}/api/popup-createsong`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`popup-createsong falhou: ${res.status}`);
}

export async function holyricsSearchSong(token: string, host: string, title: string): Promise<string | null> {
  const json = await holyricsApiCall("SearchSong", token, host, { text: title, search_title: true });
  const results: { id: string; title: string }[] = json?.data ?? [];
  const exact = results.find(
    (s) => s.title.toLowerCase().trim() === title.toLowerCase().trim()
  );
  return exact?.id ?? results[0]?.id ?? null;
}

export async function holyricsSetPlaylist(token: string, host: string, holyricsIds: string[]): Promise<void> {
  // Busca a playlist atual
  const currentData = await holyricsApiCall("GetLyricsPlaylist", token, host, {});
  const currentPlaylist = currentData?.data ?? [];

  // Remove TODOS os itens atuais (limpa a playlist)
  if (currentPlaylist.length > 0) {
    const indexesToRemove = Array.from({ length: currentPlaylist.length }, (_, i) => i);
    await holyricsApiCall("RemoveFromLyricsPlaylist", token, host, { indexes: indexesToRemove });
  }

  // Adiciona as novas músicas (SetLyricsPlaylistItem só altera item já existente,
  // não cria; para adicionar é necessário usar AddLyricsToPlaylist)
  if (holyricsIds.length > 0) {
    await holyricsApiCall("AddLyricsToPlaylist", token, host, { ids: holyricsIds });
  }
}
