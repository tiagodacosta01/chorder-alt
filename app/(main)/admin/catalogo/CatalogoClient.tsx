"use client";

import { getLyrics } from "@/chopro/music";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Filter, Trash2, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

type Tag = { id: number; name: string; group: { id: number; name: string; color: string } };
type TagGroup = { id: number; name: string; color: string; tags: { id: number; name: string }[] };
type CatalogSong = {
  id: number;
  slug: string;
  title: string;
  artist: string | null;
  lyrics: string;
  legacyId: number | null;
  serviceCount: number;
  tags: Tag[];
};
type Props = { songs: CatalogSong[]; tagGroups: TagGroup[] };
type SortKey = "title" | "artist" | "legacyId" | "serviceCount";
type TagFilterValue = "include" | "exclude";
type GroupFilter = { tags: Record<number, TagFilterValue>; noTag: boolean };
type FilterState = Record<number, GroupFilter>;

function colCount(tagGroups: TagGroup[]) {
  return 2 + tagGroups.length;
}

function focusCell(row: number, col: number) {
  const input = document.querySelector<HTMLElement>(
    `td[data-row="${row}"][data-col="${col}"] input`
  );
  input?.focus();
}

export default function CatalogoClient({ songs: initialSongs, tagGroups }: Props) {
  const [songs, setSongs] = useState<CatalogSong[]>(initialSongs);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [bulkTagGroupId, setBulkTagGroupId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState<FilterState>({});
  const [openFilterGroupId, setOpenFilterGroupId] = useState<number | null>(null);
  const [filterPopoverPos, setFilterPopoverPos] = useState({ top: 0, left: 0 });
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openFilterGroupId === null) return;
    function handleOutside(e: MouseEvent) {
      if (filterPopoverRef.current?.contains(e.target as Node)) return;
      const triggers = document.querySelectorAll("[data-filter-trigger]");
      for (const t of triggers) {
        if (t.contains(e.target as Node)) return;
      }
      setOpenFilterGroupId(null);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [openFilterGroupId]);

  const filtered = search
    ? songs.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          s.artist?.toLowerCase().includes(search.toLowerCase())
      )
    : songs;

  const displayed = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      if (sortKey === "legacyId") {
        const av = a.legacyId ?? Infinity;
        const bv = b.legacyId ?? Infinity;
        return sortDir === "asc" ? (av < bv ? -1 : av > bv ? 1 : 0) : (bv < av ? -1 : bv > av ? 1 : 0);
      }
      if (sortKey === "serviceCount") {
        const diff = a.serviceCount - b.serviceCount;
        return sortDir === "asc" ? diff : -diff;
      }
      return sortDir === "asc"
        ? (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "", "pt-BR")
        : (b[sortKey] ?? "").localeCompare(a[sortKey] ?? "", "pt-BR");
    });
  }, [filtered, sortKey, sortDir]);

  const finalDisplay = useMemo(() => {
    const activeGroups = Object.entries(filters).filter(
      ([, gf]) => gf.noTag || Object.keys(gf.tags).length > 0
    );
    if (activeGroups.length === 0) return displayed;
    return displayed.filter((song) => {
      for (const [groupIdStr, gf] of activeGroups) {
        const groupId = Number(groupIdStr);
        const songTagsInGroup = song.tags.filter((t) => t.group.id === groupId);
        const songTagIds = new Set(songTagsInGroup.map((t) => t.id));
        // Excludes take priority
        for (const [tagIdStr, mode] of Object.entries(gf.tags)) {
          if (mode === "exclude" && songTagIds.has(Number(tagIdStr))) return false;
        }
        // Includes / noTag: at least one must match
        const includeIds = Object.entries(gf.tags)
          .filter(([, m]) => m === "include")
          .map(([id]) => Number(id));
        if (includeIds.length > 0 || gf.noTag) {
          const passesNoTag = gf.noTag && songTagsInGroup.length === 0;
          const passesInclude = includeIds.some((id) => songTagIds.has(id));
          if (!passesNoTag && !passesInclude) return false;
        }
      }
      return true;
    });
  }, [displayed, filters]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function getGroupFilter(groupId: number): GroupFilter {
    return filters[groupId] ?? { tags: {}, noTag: false };
  }

  function hasActiveFilter(groupId: number) {
    const gf = filters[groupId];
    return !!gf && (gf.noTag || Object.keys(gf.tags).length > 0);
  }

  function cycleTagFilter(groupId: number, tagId: number) {
    setFilters((prev) => {
      const gf = prev[groupId] ?? { tags: {}, noTag: false };
      const cur = gf.tags[tagId];
      const next: TagFilterValue | undefined =
        cur === undefined ? "include" : cur === "include" ? "exclude" : undefined;
      const nextTags = { ...gf.tags };
      if (next === undefined) delete nextTags[tagId];
      else nextTags[tagId] = next;
      return { ...prev, [groupId]: { ...gf, tags: nextTags } };
    });
  }

  function toggleNoTag(groupId: number) {
    setFilters((prev) => {
      const gf = prev[groupId] ?? { tags: {}, noTag: false };
      return { ...prev, [groupId]: { ...gf, noTag: !gf.noTag } };
    });
  }

  function clearGroupFilter(groupId: number) {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  }

  function openFilter(e: React.MouseEvent<HTMLButtonElement>, groupId: number) {
    const rect = e.currentTarget.getBoundingClientRect();
    setFilterPopoverPos({ top: rect.bottom + 4, left: rect.left });
    setOpenFilterGroupId((prev) => (prev === groupId ? null : groupId));
  }

  const allSelected =
    finalDisplay.length > 0 && finalDisplay.every((s) => selected.has(s.slug));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        finalDisplay.forEach((s) => next.delete(s.slug));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        finalDisplay.forEach((s) => next.add(s.slug));
        return next;
      });
    }
  }

  function toggleOne(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

  function toggleExpand(slug: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

  async function patchSong(
    slug: string,
    data: { title?: string; artist?: string | null; tagIds?: number[] }
  ) {
    const res = await fetch(`/api/songs/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return;
    setSongs((prev) =>
      prev.map((s) => {
        if (s.slug !== slug) return s;
        const next = { ...s };
        if (data.title !== undefined) next.title = data.title;
        if (data.artist !== undefined) next.artist = data.artist;
        if (data.tagIds !== undefined) {
          const tagMap = new Map<number, Tag>();
          for (const g of tagGroups)
            for (const t of g.tags)
              tagMap.set(t.id, { id: t.id, name: t.name, group: { id: g.id, name: g.name, color: g.color } });
          next.tags = data.tagIds.flatMap((id) => (tagMap.get(id) ? [tagMap.get(id)!] : []));
        }
        return next;
      })
    );
  }

  function handleTagGroupUpdate(song: CatalogSong, groupId: number, newGroupTagIds: number[]) {
    const otherTagIds = song.tags.filter((t) => t.group.id !== groupId).map((t) => t.id);
    patchSong(song.slug, { tagIds: [...otherTagIds, ...newGroupTagIds] });
  }

  async function bulkDelete() {
    const slugs = [...selected].filter((s) => finalDisplay.some((f) => f.slug === s));
    const results = await Promise.all(
      slugs.map(async (slug) => {
        const res = await fetch(`/api/songs/${slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDeleted: true }),
        });
        return { slug, ok: res.ok };
      })
    );
    const deleted = results.filter((r) => r.ok).map((r) => r.slug);
    setSongs((prev) => prev.filter((s) => !deleted.includes(s.slug)));
    setSelected(new Set());
    setConfirmDelete(false);
  }

  async function bulkSetTag(groupId: number, tagId: number | null) {
    const slugs = [...selected].filter((s) => finalDisplay.some((f) => f.slug === s));
    const group = tagGroups.find((g) => g.id === groupId);
    if (!group) return;
    await Promise.all(
      slugs.map((slug) => {
        const song = songs.find((s) => s.slug === slug);
        if (!song) return;
        const otherTagIds = song.tags.filter((t) => t.group.id !== groupId).map((t) => t.id);
        const newIds = tagId ? [...otherTagIds, tagId] : otherTagIds;
        return patchSong(slug, { tagIds: newIds });
      })
    );
    setBulkTagGroupId(null);
  }

  function handleTableKeyDown(e: React.KeyboardEvent, totalRows: number) {
    const td = (e.target as HTMLElement).closest("td[data-row]") as HTMLElement | null;
    if (!td) return;
    const row = parseInt(td.dataset.row ?? "-1");
    const col = parseInt(td.dataset.col ?? "-1");
    if (row === -1 || col === -1) return;
    const cols = colCount(tagGroups);
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const nextCol = col + 1 < cols ? col + 1 : 0;
      const nextRow = col + 1 < cols ? row : row + 1;
      if (nextRow < totalRows) focusCell(nextRow, nextCol);
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      const prevCol = col - 1 >= 0 ? col - 1 : cols - 1;
      const prevRow = col - 1 >= 0 ? row : row - 1;
      if (prevRow >= 0) focusCell(prevRow, prevCol);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (row + 1 < totalRows) focusCell(row + 1, col);
    }
  }

  const selectedCount = [...selected].filter((s) => finalDisplay.some((f) => f.slug === s)).length;
  const totalCols = 5 + tagGroups.length;
  const hasActiveFilters = Object.values(filters).some(
    (gf) => gf.noTag || Object.keys(gf.tags).length > 0
  );

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="opacity-20 ml-0.5">↕</span>;
    return sortDir === "asc"
      ? <ChevronUp size={10} className="inline ml-0.5" />
      : <ChevronDown size={10} className="inline ml-0.5" />;
  }

  return (
    <div className="pb-16">
      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Filtrar por título ou compositor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm max-w-sm"
        />

        {someSelected && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">
              {selectedCount} selecionada{selectedCount !== 1 ? "s" : ""}
            </span>

            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setBulkTagGroupId(bulkTagGroupId ? null : tagGroups[0]?.id ?? null)}
              >
                Alterar tag
              </Button>
              {bulkTagGroupId !== null && (
                <div className="absolute top-full right-0 mt-1 z-50 bg-background border border-border rounded-md shadow-lg p-3 min-w-[220px]">
                  <div className="flex gap-1 mb-2 flex-wrap">
                    {tagGroups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setBulkTagGroupId(g.id)}
                        className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium border transition-colors",
                          bulkTagGroupId === g.id
                            ? "text-white"
                            : "text-muted-foreground border-transparent"
                        )}
                        style={
                          bulkTagGroupId === g.id
                            ? { backgroundColor: g.color, borderColor: g.color }
                            : {}
                        }
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const g = tagGroups.find((x) => x.id === bulkTagGroupId);
                    if (!g) return null;
                    return (
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => bulkSetTag(g.id, null)}
                          className="w-full text-left px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded"
                        >
                          Remover tag
                        </button>
                        {g.tags.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => bulkSetTag(g.id, t.id)}
                            className="w-full text-left px-2 py-1 text-xs hover:bg-muted rounded"
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-destructive">Confirmar exclusão?</span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={bulkDelete}
                >
                  Excluir
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={13} className="mr-1" />
                Excluir
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="mb-3 flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground">Filtros:</span>
          {tagGroups.map((g) => {
            if (!hasActiveFilter(g.id)) return null;
            const gf = getGroupFilter(g.id);
            const includeIds = Object.entries(gf.tags)
              .filter(([, m]) => m === "include")
              .map(([id]) => Number(id));
            const excludeIds = Object.entries(gf.tags)
              .filter(([, m]) => m === "exclude")
              .map(([id]) => Number(id));
            return (
              <div
                key={g.id}
                className="inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5"
                style={{ borderColor: `${g.color}66`, backgroundColor: `${g.color}12` }}
              >
                <span className="font-medium" style={{ color: g.color }}>
                  {g.name}:
                </span>
                {gf.noTag && (
                  <span className="text-muted-foreground">sem tag</span>
                )}
                {includeIds.map((id) => {
                  const tag = g.tags.find((t) => t.id === id);
                  return tag ? (
                    <span key={id} className="text-emerald-600">✓{tag.name}</span>
                  ) : null;
                })}
                {excludeIds.map((id) => {
                  const tag = g.tags.find((t) => t.id === id);
                  return tag ? (
                    <span key={id} className="text-red-500">✗{tag.name}</span>
                  ) : null;
                })}
                <button
                  type="button"
                  onClick={() => clearGroupFilter(g.id)}
                  className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
              <th className="px-3 py-2.5 w-px">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-2.5 text-left font-medium">
                <button
                  type="button"
                  onClick={() => handleSort("title")}
                  className="flex items-center gap-0.5 hover:text-foreground transition-colors"
                >
                  Título <SortIcon k="title" />
                </button>
              </th>
              <th className="px-3 py-2.5 text-right font-medium w-16 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("legacyId")}
                  className="flex items-center gap-0.5 ml-auto hover:text-foreground transition-colors"
                >
                  ID <SortIcon k="legacyId" />
                </button>
              </th>
              <th className="px-3 py-2.5 text-right font-medium w-20 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("serviceCount")}
                  className="flex items-center gap-0.5 ml-auto hover:text-foreground transition-colors"
                >
                  Liturgias <SortIcon k="serviceCount" />
                </button>
              </th>
              <th className="px-4 py-2.5 text-left font-medium">
                <button
                  type="button"
                  onClick={() => handleSort("artist")}
                  className="flex items-center gap-0.5 hover:text-foreground transition-colors"
                >
                  Compositor <SortIcon k="artist" />
                </button>
              </th>
              {tagGroups.map((g) => (
                <th key={g.id} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span style={{ color: g.color }}>{g.name}</span>
                    <button
                      type="button"
                      data-filter-trigger
                      onClick={(e) => openFilter(e, g.id)}
                      className={cn(
                        "p-0.5 rounded transition-colors",
                        hasActiveFilter(g.id)
                          ? "text-primary"
                          : "text-muted-foreground/30 hover:text-muted-foreground"
                      )}
                      title={`Filtrar por ${g.name}`}
                    >
                      <Filter size={10} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            className="divide-y divide-border"
            onKeyDown={(e) => handleTableKeyDown(e, finalDisplay.length)}
          >
            {finalDisplay.map((song, rowIdx) => (
              <Fragment key={song.slug}>
                <tr
                  className={cn(
                    "hover:bg-muted/20 transition-colors",
                    selected.has(song.slug) && "bg-secondary/5"
                  )}
                >
                  <td className="px-3 py-1.5 w-px">
                    <input
                      type="checkbox"
                      checked={selected.has(song.slug)}
                      onChange={() => toggleOne(song.slug)}
                      className="rounded"
                    />
                  </td>
                  <td data-row={rowIdx} data-col={0} className="px-4 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => toggleExpand(song.slug)}
                        className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                        aria-label={expanded.has(song.slug) ? "Fechar letra" : "Ver letra"}
                      >
                        {expanded.has(song.slug)
                          ? <ChevronUp size={13} />
                          : <ChevronDown size={13} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <TextCell
                          value={song.title}
                          onSave={(v) => patchSong(song.slug, { title: v })}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 w-16 text-right">
                    {song.legacyId !== null && (
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        #{song.legacyId}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 w-20 text-right">
                    {song.serviceCount > 0 && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {song.serviceCount}
                      </span>
                    )}
                  </td>
                  <td data-row={rowIdx} data-col={1} className="px-4 py-1.5">
                    <TextCell
                      value={song.artist ?? ""}
                      placeholder="—"
                      onSave={(v) => patchSong(song.slug, { artist: v || null })}
                    />
                  </td>
                  {tagGroups.map((group, gIdx) => (
                    <td key={group.id} data-row={rowIdx} data-col={2 + gIdx} className="px-4 py-1.5">
                      <TagGroupCell
                        selectedTags={song.tags.filter((t) => t.group.id === group.id)}
                        group={group}
                        onUpdate={(ids) => handleTagGroupUpdate(song, group.id, ids)}
                      />
                    </td>
                  ))}
                </tr>
                {expanded.has(song.slug) && (
                  <tr className="bg-muted/10">
                    <td />
                    <td colSpan={totalCols - 1} className="px-4 py-3 pl-10">
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                        {getLyrics(song.lyrics) || "Sem letra"}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {finalDisplay.length === 0 && (
              <tr>
                <td
                  colSpan={totalCols}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Nenhuma música encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Filter popover — fixed-positioned to escape overflow:hidden */}
      {openFilterGroupId !== null && (() => {
        const group = tagGroups.find((g) => g.id === openFilterGroupId);
        if (!group) return null;
        const gf = getGroupFilter(group.id);
        return (
          <div
            ref={filterPopoverRef}
            style={{ position: "fixed", top: filterPopoverPos.top, left: filterPopoverPos.left }}
            className="z-[9999] bg-background border border-border rounded-md shadow-lg py-1.5 min-w-[180px]"
          >
            <button
              type="button"
              onClick={() => toggleNoTag(group.id)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors",
                gf.noTag ? "text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <FilterDot active={gf.noTag} mode={null} />
              Sem {group.name}
            </button>
            {group.tags.length > 0 && <div className="border-t border-border my-1" />}
            {group.tags.map((tag) => {
              const mode = gf.tags[tag.id];
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => cycleTagFilter(group.id, tag.id)}
                  className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-muted transition-colors"
                >
                  <FilterDot active={mode !== undefined} mode={mode ?? null} />
                  <span
                    className={cn(
                      mode === "include"
                        ? "text-emerald-700"
                        : mode === "exclude"
                        ? "text-red-600"
                        : ""
                    )}
                  >
                    {tag.name}
                  </span>
                </button>
              );
            })}
            {hasActiveFilter(group.id) && (
              <>
                <div className="border-t border-border my-1" />
                <button
                  type="button"
                  onClick={() => clearGroupFilter(group.id)}
                  className="w-full text-center px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Limpar
                </button>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── FilterDot ────────────────────────────────────────────────────────────────

function FilterDot({
  active,
  mode,
}: {
  active: boolean;
  mode: "include" | "exclude" | null;
}) {
  if (!active) {
    return (
      <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
    );
  }
  if (mode === "include") {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0 flex items-center justify-center text-white font-bold leading-none">
        <span style={{ fontSize: 8 }}>✓</span>
      </span>
    );
  }
  if (mode === "exclude") {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-red-500 shrink-0 flex items-center justify-center text-white font-bold leading-none">
        <span style={{ fontSize: 8 }}>✕</span>
      </span>
    );
  }
  // noTag active
  return <span className="w-3.5 h-3.5 rounded-full bg-primary shrink-0" />;
}

// ─── TextCell ────────────────────────────────────────────────────────────────

function TextCell({
  value,
  placeholder = "",
  onSave,
}: {
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  function handleBlur() {
    if (draft.trim() !== value) onSave(draft.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") e.preventDefault();
  }

  return (
    <input
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-full bg-transparent outline-none text-sm py-0.5 border-b border-transparent focus:border-primary transition-colors placeholder:text-muted-foreground/50"
    />
  );
}

// ─── TagGroupCell ─────────────────────────────────────────────────────────────

function TagGroupCell({
  selectedTags,
  group,
  onUpdate,
}: {
  selectedTags: Tag[];
  group: TagGroup;
  onUpdate: (tagIds: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedIds = new Set(selectedTags.map((t) => t.id));
  const suggestions = group.tags.filter(
    (t) =>
      !selectedIds.has(t.id) &&
      (!query || t.name.toLowerCase().includes(query.toLowerCase()))
  );

  useEffect(() => setHighlighted(0), [suggestions.length, query]);

  function addTag(tagId: number) {
    onUpdate([...selectedIds, tagId]);
    setQuery("");
    setHighlighted(0);
    inputRef.current?.focus();
  }

  function removeTag(tagId: number) {
    onUpdate([...selectedIds].filter((id) => id !== tagId));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setHighlighted((i) => Math.min(i + 1, suggestions.length - 1));
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && suggestions[highlighted]) {
        e.preventDefault();
        e.stopPropagation();
        addTag(suggestions[highlighted].id);
      }
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      setQuery("");
    } else if (e.key === "Backspace" && !query && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1].id);
    }
  }

  return (
    <div className="relative flex flex-wrap gap-1 items-center min-h-[28px]">
      {selectedTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded-md text-[10px] font-medium"
          style={{
            backgroundColor: `${group.color}26`,
            color: group.color,
            border: `1px solid ${group.color}4d`,
          }}
        >
          {tag.name}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => removeTag(tag.id)}
            className="hover:opacity-70"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}

      <input
        ref={inputRef}
        value={query}
        placeholder={selectedTags.length === 0 ? "+" : ""}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        className="bg-transparent outline-none text-xs py-0.5 w-12 min-w-0 placeholder:text-muted-foreground/40 border-b border-transparent focus:border-primary transition-colors"
      />

      {open && suggestions.length > 0 && (
        <div
          ref={listRef}
          className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded-md shadow-md py-1 min-w-[140px] max-h-48 overflow-y-auto"
        >
          {suggestions.map((tag, i) => (
            <button
              key={tag.id}
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); addTag(tag.id); }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-xs transition-colors",
                i === highlighted ? "bg-muted" : "hover:bg-muted/60"
              )}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
