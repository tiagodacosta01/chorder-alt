export const dynamic = "force-dynamic";

import Heading from "@/components/common/Heading";
import Main from "@/components/common/Main";
import prisma from "@/prisma/client";
import CatalogoClient from "./CatalogoClient";

export default async function AdminCatalogoPage() {
  const [songs, tagGroups] = await Promise.all([
    prisma.song.findMany({
      where: { isDeleted: false },
      orderBy: { title: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
        artist: true,
        lyrics: true,
        legacyId: true,
        _count: {
          select: {
            arrangements: { where: { isServiceArrangement: true } },
          },
        },
        tags: {
          select: {
            id: true,
            name: true,
            group: { select: { id: true, name: true, color: true } },
          },
        },
      },
    }),
    prisma.tagGroup.findMany({
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        tags: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      },
    }),
  ]);

  const mappedSongs = songs.map((s) => ({
    ...s,
    serviceCount: s._count.arrangements,
  }));

  return (
    <>
      <div className="px-5 sm:px-8 lg:px-14 pt-6 sm:pt-8 pb-4 sm:pb-6 lg:pb-8">
        <Heading level={1}>Catálogo</Heading>
      </div>
      <Main>
        <CatalogoClient songs={mappedSongs} tagGroups={tagGroups} />
      </Main>
    </>
  );
}
