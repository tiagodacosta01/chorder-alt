import Main from "@/components/common/Main";
import prisma from "@/prisma/client";
import HolyricsAdminClient from "./HolyricsAdminClient";

export default async function AdminHolyricsPage() {
  const [holyricsConfig, songs] = await Promise.all([
    prisma.holyricsConfig.findUnique({ where: { id: 1 } }),
    prisma.song.findMany({
      where: { isDeleted: false },
      orderBy: { title: "asc" },
      select: {
        slug: true,
        title: true,
        artist: true,
        holyricsId: true,
        arrangements: {
          where: { isServiceArrangement: false, isDeleted: false },
          orderBy: [{ isDefault: "desc" }, { id: "asc" }],
          select: {
            id: true,
            key: true,
            name: true,
            isDefault: true,
            units: {
              orderBy: { order: "asc" },
              select: { content: true, type: true, order: true },
            },
          },
        },
        _count: {
          select: {
            arrangements: { where: { isServiceArrangement: true, isDeleted: false } },
          },
        },
      },
    }),
  ]);

  const songsForClient = songs
    .map((s) => ({
      slug: s.slug,
      title: s.title,
      artist: s.artist,
      holyricsId: s.holyricsId,
      arrangements: s.arrangements.map((a) => ({
        id: a.id,
        key: a.key,
        name: a.name,
        isDefault: a.isDefault,
        units: a.units,
      })),
      usedInServices: s._count.arrangements > 0,
    }))
    // orderBy do Postgres usa colação por byte (acentos vão para o fim); reordena com locale pt-BR
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }));

  return (
    <Main>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-display font-semibold mb-2">Integração Holyrics</h1>
        <p className="text-muted-foreground mb-8 text-sm">
          Exporte o catálogo de músicas para o Holyrics e envie setlists dos cultos.
        </p>
        <HolyricsAdminClient
          songs={songsForClient}
          initialToken={holyricsConfig?.token ?? ""}
          initialHost={holyricsConfig?.host ?? "localhost:8091"}
        />
      </div>
    </Main>
  );
}
