import { getLyrics } from "@/chopro/music";
import prisma from "./client";
import {
  ClientArrangement,
  ClientService,
  ClientServiceUnit,
  ClientSong,
  ClientTagGroup,
  LeaderStat,
  RecentServiceEntry,
  SongStat,
  StatsData,
} from "./models";

export function retrieveSongSlugs() {
  return prisma.song
    .findMany({
      where: {
        isDeleted: false,
      },
      select: {
        slug: true,
      },
    })
    .then((songs) => songs.map((song) => song.slug));
}

export async function slugForSong(title: string) {
  const slugs = await retrieveSongSlugs();
  if (containsOnlyDigits(title)) title = `${title}-song`;
  return slugFor(title, slugs);
}

export async function retrieveServiceSlugs() {
  return prisma.service
    .findMany({
      where: {
        isDeleted: false,
      },
      select: {
        slug: true,
      },
    })
    .then((services) => services.map((service) => service.slug));
}

export async function slugForService() {
  const slugs = await retrieveServiceSlugs();
  while (true) {
    const slug = Math.random().toString(36).split(".")[1].substring(0, 6);
    if (!slugs.includes(slug)) {
      return slug;
    }
  }
}

export async function slugFor(original: string, slugs: string[]) {
  let slug = original
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]/g, "-");
  let idx = 1;
  let newSlug = slug;
  while (slugs.includes(newSlug)) {
    newSlug = `${slug}-${idx}`;
    idx++;
  }
  slugs.push(newSlug);
  return newSlug;
}

async function buildTagFilter(tagIds: number[]) {
  if (tagIds.length === 0) return {};
  const tags = await prisma.tag.findMany({
    where: { id: { in: tagIds } },
    select: { id: true, tagGroupId: true },
  });
  const byGroup = new Map<number, number[]>();
  for (const tag of tags) {
    const group = byGroup.get(tag.tagGroupId) ?? [];
    group.push(tag.id);
    byGroup.set(tag.tagGroupId, group);
  }
  return {
    AND: Array.from(byGroup.values()).map((ids) => ({
      tags: { some: { id: { in: ids } } },
    })),
  };
}

export async function retrieveSongs({
  query = "",
  limitLines,
  forceIncludeFirstLine = true,
  excludedSongSlugs = [],
  tagIds = [],
  withUsageStats = false,
}: {
  query?: string;
  limitLines?: number;
  forceIncludeFirstLine?: boolean;
  excludedSongSlugs?: string[];
  tagIds?: number[];
  withUsageStats?: boolean;
}): Promise<ClientSong[]> {
  // OR dentro do mesmo grupo, AND entre grupos diferentes
  const tagFilter: { AND: { tags: { some: { id: { in: number[] } } } }[] } | object =
    tagIds.length > 0
      ? await buildTagFilter(tagIds)
      : {};

  let songs: ClientSong[] = await prisma.song.findMany({
    where: {
      isDeleted: false,
      slug: {
        notIn: excludedSongSlugs,
      },
      ...tagFilter,
      OR: [
        {
          title: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          artist: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          lyrics: {
            contains: query,
            mode: "insensitive",
          },
        },
      ],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      lyrics: true,
      artist: true,
      isDeleted: true,
      holyricsId: true,
      arrangements: {
        where: { isServiceArrangement: false, isDeleted: false },
        select: {
          id: true,
          name: true,
          key: true,
          isDefault: true,
          isDeleted: true,
          isServiceArrangement: true,
          originalArrangementId: true,
          youtubeUrl: true,
          audios: { select: { id: true, url: true, label: true, order: true }, orderBy: { order: "asc" } },
        },
        orderBy: [{ isDefault: "desc" }],
      },
      tags: {
        select: {
          id: true,
          name: true,
          group: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });
  if (limitLines) {
    songs = songs.map((song) =>
      limitLyrics(song, limitLines, forceIncludeFirstLine, query)
    );
  }

  if (withUsageStats) {
    const songIds = songs.map((s) => s.id).filter((id): id is number => id !== undefined);
    if (songIds.length > 0) {
      const serviceArrangements = await prisma.songArrangement.findMany({
        where: {
          songId: { in: songIds },
          isServiceArrangement: true,
          isDeleted: false,
          serviceUnit: { service: { isDeleted: false } },
        },
        select: {
          songId: true,
          serviceUnit: { select: { service: { select: { date: true } } } },
        },
      });
      const lastUsedMap = new Map<number, Date>();
      for (const sa of serviceArrangements) {
        const date = sa.serviceUnit?.service?.date;
        if (!date) continue;
        const existing = lastUsedMap.get(sa.songId);
        if (!existing || date > existing) lastUsedMap.set(sa.songId, date);
      }
      songs = songs.map((song) => ({
        ...song,
        lastUsedAt: (song.id !== undefined ? lastUsedMap.get(song.id) : undefined) ?? null,
      }));
    }
  }

  return songs;
}

export async function archiveSong(slug: string) {
  return prisma.song.update({
    where: { slug },
    data: { isDeleted: true },
  });
}

export async function updateSongInfo(
  slug: string,
  data: { title?: string; artist?: string | null; tagIds?: number[]; holyricsId?: string | null }
): Promise<void> {
  const { tagIds, ...rest } = data;
  await prisma.song.update({
    where: { slug },
    data: {
      ...rest,
      ...(tagIds !== undefined && {
        tags: { set: tagIds.map((id) => ({ id })) },
      }),
    },
  });
}

export async function retrieveSong(
  slugOrId: string | number,
  {
    includeArrangements = false,
    includeServiceArrangements = false,
    includeUnits = false,
  }: {
    includeArrangements?: boolean;
    includeServiceArrangements?: boolean;
    includeUnits?: boolean;
  } = {}
): Promise<ClientSong | null> {
  const where: { isDeleted: boolean; slug?: string; id?: number } = {
    isDeleted: false,
    ...selectSlugOrId(slugOrId),
  };
  return prisma.song.findFirst({
    where,
    include: {
      tags: {
        select: {
          id: true,
          name: true,
          group: { select: { id: true, name: true, color: true } },
        },
      },
      arrangements: includeArrangements
        ? {
            where: {
              isDeleted: false,
              isServiceArrangement: includeServiceArrangements
                ? undefined
                : false,
            },
            include: {
              units: includeUnits
                ? {
                    orderBy: { order: "asc" },
                  }
                : false,
              audios: { orderBy: { order: "asc" } },
            },
          }
        : false,
    },
  }) as unknown as Promise<ClientSong | null>;
}

export async function retrieveSongArrangements(
  songSlugOrId: string | number,
  {
    includeSong = false,
    includeServiceArrangements = false,
    includeUnits = false,
  }: {
    includeSong?: boolean;
    includeServiceArrangements?: boolean;
    includeUnits?: boolean;
  } = {}
): Promise<ClientArrangement[]> {
  return prisma.songArrangement.findMany({
    where: {
      song: selectSlugOrId(songSlugOrId),
      isDeleted: false,
      isServiceArrangement: includeServiceArrangements ? undefined : false,
    },
    include: {
      song: includeSong,
      units: includeUnits ? { orderBy: { order: "asc" } } : false,
      audios: { orderBy: { order: "asc" } },
    },
  });
}

export async function retrieveArrangement(
  arrangementId?: number | null,
  {
    songSlugOrId,
    includeUnits,
    includeSong,
  }: {
    songSlugOrId?: string | number;
    includeUnits?: boolean;
    includeSong?: boolean;
  } = {}
): Promise<ClientArrangement | null> {
  if (!arrangementId && !songSlugOrId) {
    throw new Error(
      "Song slug or id is required to retrieve default arrangement"
    );
  }
  if (!arrangementId) {
    return prisma.songArrangement.findFirst({
      where: {
        song: {
          ...selectSlugOrId(songSlugOrId!),
          isDeleted: false,
        },
        isDefault: true,
        isDeleted: false,
      },
      include: {
        units: includeUnits ? { orderBy: { order: "asc" } } : false,
        audios: { orderBy: { order: "asc" } },
        song: includeSong
          ? {
              include: {
                tags: {
                  select: {
                    id: true,
                    name: true,
                    group: { select: { id: true, name: true, color: true } },
                  },
                },
                arrangements: {
                  where: { isDeleted: false, isServiceArrangement: false },
                },
              },
            }
          : false,
      },
    });
  }

  const where: {
    id: number;
    isDeleted: boolean;
    song?: { id?: number; slug?: string; isDeleted: boolean };
  } = {
    id: arrangementId,
    isDeleted: false,
  };
  if (songSlugOrId) {
    where["song"] = {
      ...selectSlugOrId(songSlugOrId),
      isDeleted: false,
    };
  }

  return prisma.songArrangement.findFirst({
    where,
    include: {
      units: includeUnits ? { orderBy: { order: "asc" } } : false,
      audios: { orderBy: { order: "asc" } },
      song: includeSong
        ? {
            include: {
              tags: {
                select: {
                  id: true,
                  name: true,
                  group: { select: { id: true, name: true, color: true } },
                },
              },
              arrangements: {
                where: { isDeleted: false, isServiceArrangement: false },
              },
            },
          }
        : false,
    },
  });
}

export async function createArrangementWithSong(
  arrangement: ClientArrangement,
  {
    includeSong = false,
    includeUnits = false,
  }: {
    includeSong?: boolean;
    includeUnits?: boolean;
  } = {}
): Promise<ClientArrangement> {
  if (!arrangement.song) {
    throw new Error("Arrangement must have a song to create an arrangement");
  }
  const songSlug = await slugForSong(arrangement.song.title);
  if (!arrangement.units || arrangement.units.length === 0) {
    throw new Error("Arrangement must have at least one unit");
  }
  const lyrics = arrangement.units
    .map((unit) => getLyrics(unit.content))
    .join("\n");
  const title = arrangement.song.title;
  const artist =
    arrangement.song.artist && arrangement.song.artist.trim().length
      ? arrangement.song.artist
      : null;

  const createdArrangement = await prisma.songArrangement.create({
    data: {
      name: arrangement.name,
      key: arrangement.key,
      isDefault: arrangement.isDefault,
      youtubeUrl: arrangement.youtubeUrl ?? null,
      song: {
        connectOrCreate: {
          where: { slug: songSlug },
          create: {
            slug: songSlug,
            title,
            artist,
            lyrics,
          },
        },
      },
      units: {
        createMany: {
          data: arrangement.units,
        },
      },
      audios: arrangement.audios?.length
        ? { createMany: { data: arrangement.audios.map(({ id, ...a }) => a) } }
        : undefined,
    },
    include: {
      song: true,
      units: includeUnits ? { orderBy: { order: "asc" } } : false,
      audios: { orderBy: { order: "asc" } },
    },
  });
  if (createdArrangement.song.isDeleted) {
    // Restore the song if it was previously deleted
    await prisma.song.update({
      where: { id: createdArrangement.song.id },
      data: {
        isDeleted: false,
        slug: songSlug,
        title,
        artist,
        lyrics,
      },
    });
    await makeArrangementDefault(createdArrangement.id);
  }
  if (!includeSong) {
    const { song, ...rest } = createdArrangement;
    return rest;
  }
  return createdArrangement;
}

export async function updateArrangement(
  arrangement: ClientArrangement,
  {
    includeSong = false,
    includeUnits = false,
  }: {
    includeSong?: boolean;
    includeUnits?: boolean;
  } = {}
): Promise<ClientArrangement> {
  if (!arrangement.id) {
    throw new Error("Arrangement ID is required to update an arrangement");
  }
  const baseArrangement = await retrieveArrangement(arrangement.id, {
    includeSong,
    includeUnits,
  });
  if (!baseArrangement) {
    throw new Error("Arrangement not found");
  }
  const arrangementData: {
    id: number;
    name?: string | null;
    key?: string;
    youtubeUrl?: string | null;
    units?: any;
  } = {
    id: arrangement.id,
    name: arrangement.name,
    key: arrangement.key,
    youtubeUrl: arrangement.youtubeUrl || null,
  };

  const song = arrangement.song ?? baseArrangement.song!;
  const songData: {
    title: string;
    artist: string | null;
    lyrics?: string;
  } = {
    title: song.title,
    artist: song.artist,
  };
  if (arrangement.isDefault && arrangement.units) {
    songData.lyrics = arrangement.units
      .map((unit) => getLyrics(unit.content))
      .join("\n");
  }

  if (arrangement.units) {
    arrangementData["units"] = {
      deleteMany: {},
      createMany: {
        data: arrangement.units,
      },
    };
  }
  await prisma.song.update({
    where: { slug: song.slug },
    data: songData,
  });
  if (arrangement.audios !== undefined) {
    const keptIds = arrangement.audios.filter((a) => a.id).map((a) => a.id!);
    await prisma.arrangementAudio.deleteMany({
      where: {
        arrangementId: arrangement.id,
        ...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}),
      },
    });
    for (const audio of arrangement.audios) {
      if (audio.id) {
        await prisma.arrangementAudio.update({
          where: { id: audio.id },
          data: { label: audio.label, order: audio.order },
        });
      } else {
        await prisma.arrangementAudio.create({
          data: { arrangementId: arrangement.id!, url: audio.url, label: audio.label, order: audio.order },
        });
      }
    }
  }
  return prisma.songArrangement.update({
    where: { id: arrangement.id },
    data: arrangementData,
    include: {
      song: includeSong
        ? { include: { arrangements: { where: { isDeleted: false } } } }
        : false,
      units: includeUnits ? { orderBy: { order: "asc" } } : false,
      audios: { orderBy: { order: "asc" } },
    },
  });
}

export async function makeArrangementDefault(
  arrangementId: number
): Promise<void> {
  const arrangement = await prisma.songArrangement.findUnique({
    where: { id: arrangementId },
    include: {
      song: {
        include: {
          arrangements: {
            where: { isDefault: true },
          },
        },
      },
    },
  });
  if (!arrangement) throw new Error("Arrangement not found");
  if (!arrangement.song) throw new Error("Song not found");

  const updates = [
    prisma.songArrangement.update({
      where: { id: arrangementId },
      data: { isDefault: true },
    }),
  ];
  if (arrangement.song.arrangements.length !== 0) {
    const defaultArrangement = arrangement.song.arrangements.find(
      (arr) => arr.isDefault
    );
    if (defaultArrangement) {
      updates.push(
        prisma.songArrangement.update({
          where: { id: defaultArrangement.id },
          data: { isDefault: false },
        })
      );
    }
  }

  await prisma.$transaction(updates);
}

export async function moveArrangement(
  arrangementId: number,
  songSlugOrId: string | number
): Promise<void> {
  const [song, arrangement] = await Promise.all([
    retrieveSong(songSlugOrId, {
      includeArrangements: true,
    }),
    retrieveArrangement(arrangementId, {
      includeSong: true,
    }),
  ]);

  if (!song) throw new Error("Destination song not found");
  if (!arrangement) throw new Error("Arrangement not found");
  if (!arrangement.song) throw new Error("Original song not found");
  const originalSongId = arrangement.song.id!;
  const wasDefault = arrangement.isDefault;

  const isDefault = song.arrangements!.length === 0;
  await prisma.songArrangement.update({
    where: { id: arrangementId },
    data: { isDefault, songId: song.id },
  });

  if (wasDefault) {
    await updateDefaultArrangement(originalSongId);
  }
}

async function updateDefaultArrangement(songId: number): Promise<void> {
  const originalSong = await retrieveSong(songId, {
    includeArrangements: true,
    includeServiceArrangements: true,
  });
  if (!originalSong || !originalSong.arrangements) {
    return;
  }
  const notDeletedArrangements = originalSong.arrangements.filter(
    (arr) => !arr.isDeleted && !arr.isServiceArrangement
  );

  if (notDeletedArrangements.length > 0) {
    await prisma.songArrangement.update({
      where: { id: notDeletedArrangements[0].id },
      data: { isDefault: true },
    });
  } else {
    await prisma.song.update({
      where: { id: songId },
      data: { isDeleted: true },
    });
  }
}

export async function deleteDefaultArrangement(
  songSlugOrId: string | number
): Promise<boolean> {
  const song = await retrieveSong(songSlugOrId, {
    includeArrangements: true,
  });
  if (!song?.arrangements?.length) {
    console.error(
      `No arrangements found for song ${songSlugOrId}. Cannot delete default arrangement`
    );
    return false;
  }
  const defaultArrangement = song.arrangements.find(
    (arr) => arr.isDefault && !arr.isDeleted
  );
  if (defaultArrangement) {
    await prisma.songArrangement.update({
      where: {
        id: defaultArrangement.id,
        isDefault: true,
        isDeleted: false,
      },
      data: { isDeleted: true },
      include: {
        song: true,
      },
    });
  } else {
    console.error(
      `No default arrangement found for song ${songSlugOrId}. Cannot delete default arrangement`
    );
    return false;
  }
  await updateDefaultArrangement(song.id!);
  return true;
}

export async function deleteArrangement(
  arrangementId: number
): Promise<boolean> {
  const arrangement = await prisma.songArrangement.update({
    where: { id: arrangementId },
    data: { isDeleted: true },
    include: {
      song: true,
    },
  });

  if (!arrangement?.song) {
    console.error(
      `Arrangement with ID ${arrangementId} not found or already deleted`
    );
    return false;
  }
  await updateDefaultArrangement(arrangement.song.id);
  return true;
}

export async function duplicateArrangement(
  arrangementId: number
): Promise<ClientArrangement> {
  const arrangement = await retrieveArrangement(arrangementId, {
    includeUnits: true,
    includeSong: true,
  });
  if (!arrangement || !arrangement.song) {
    throw new Error("Arrangement or song not found");
  }

  const duplicatedArrangement = await prisma.songArrangement.create({
    data: {
      name: arrangement.name ? `${arrangement.name} (Copy)` : null,
      key: arrangement.key,
      isDefault: false,
      song: {
        connect: { id: arrangement.song.id },
      },
      units: {
        createMany: {
          data:
            arrangement.units?.map(({ arrangementId, id, ...unit }) => unit) ??
            [],
        },
      },
      audios: arrangement.audios?.length
        ? { createMany: { data: arrangement.audios.map(({ id, ...a }) => a) } }
        : undefined,
    },
    include: {
      song: true,
      units: {
        orderBy: { order: "asc" },
      },
      audios: { orderBy: { order: "asc" } },
    },
  });

  return duplicatedArrangement;
}

export async function retrieveService(
  slugOrId: string | number
): Promise<ClientService | null> {
  const service = await prisma.service.findFirst({
    where: {
      ...selectSlugOrId(slugOrId),
      isDeleted: false,
    },
    include: {
      units: {
        orderBy: { order: "asc" },
        include: {
          arrangement: {
            where: {
              isDeleted: false,
            },
            include: {
              song: true,
              units: { orderBy: { order: "asc" } },
              audios: { orderBy: { order: "asc" } },
              originalArrangement: {
                select: {
                  youtubeUrl: true,
                  audios: { orderBy: { order: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!service) return null;

  const adjacentSelect = { select: { slug: true, title: true, date: true } } as const;
  const [prevService, nextService] = await Promise.all([
    prisma.service.findFirst({
      where: { isDeleted: false, date: { lt: service.date } },
      orderBy: { date: "desc" },
      ...adjacentSelect,
    }),
    prisma.service.findFirst({
      where: { isDeleted: false, date: { gt: service.date } },
      orderBy: { date: "asc" },
      ...adjacentSelect,
    }),
  ]);

  return {
    ...service,
    prevService: prevService ?? null,
    nextService: nextService ?? null,
    units: service.units.map((unit) => ({
      ...unit,
      arrangement: unit.arrangement
        ? {
            ...unit.arrangement,
            youtubeUrl:
              unit.arrangement.youtubeUrl ??
              unit.arrangement.originalArrangement?.youtubeUrl ??
              null,
            audios:
              unit.arrangement.audios?.length
                ? unit.arrangement.audios
                : unit.arrangement.originalArrangement?.audios ?? [],
          }
        : null,
    })),
  };
}

export async function retrieveRecentServices(limit = 8): Promise<RecentServiceEntry[]> {
  const services = await prisma.service.findMany({
    where: { isDeleted: false },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      slug: true,
      title: true,
      date: true,
      worshipLeader: true,
      units: {
        orderBy: { order: "asc" },
        select: {
          arrangement: {
            select: {
              song: { select: { title: true } },
            },
          },
        },
      },
    },
  });

  return services.map((service) => ({
    slug: service.slug,
    title: service.title,
    date: service.date,
    worshipLeader: service.worshipLeader,
    songs: service.units
      .map((u) => u.arrangement?.song?.title)
      .filter((t): t is string => t != null),
  }));
}

export async function retrieveServices(): Promise<ClientService[]> {
  return prisma.service.findMany({
    where: {
      isDeleted: false,
    },
  });
}

export async function createOrUpdateService(
  service: ClientService
): Promise<ClientService> {
  const serviceSlug = service.slug?.length
    ? service.slug
    : await slugForService();
  const data = {
    title: service.title,
    slug: serviceSlug,
    worshipLeader: service.worshipLeader,
    date: service.date,
  };
  const newOrUpdatedService = await prisma.service.upsert({
    where: {
      slug: serviceSlug,
    },
    update: data,
    create: data,
  });

  const serviceUnits = await createOrUpdateServiceArrangements(service.units!);
  const unitsWithId = await createOrUpdateServiceUnits(
    serviceUnits,
    newOrUpdatedService.id
  );
  if (service.id) {
    await deleteServiceUnitsNotIn(
      service.id,
      unitsWithId.map((unit) => unit.id!)
    );
  }
  const retService = await prisma.service.findUnique({
    where: { id: newOrUpdatedService.id },
    include: {
      units: {
        orderBy: { order: "asc" },
        include: {
          arrangement: {
            include: {
              song: true,
              units: { orderBy: { order: "asc" } },
              audios: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!retService) {
    throw new Error("Service not found after creation or update");
  }
  return retService;
}

async function createOrUpdateServiceArrangements(units: ClientServiceUnit[]) {
  const unitPromises = units.map(async (unit) => {
    if (unit.type === "SONG") {
      const arrangement = await prisma.songArrangement.upsert({
        where: {
          id: unit.arrangementId ?? -1,
          isServiceArrangement: true,
        },
        update: {
          name: unit.arrangement!!.name,
          key: unit.arrangement!!.key,
          units: {
            deleteMany: {},
            createMany: {
              data: unit.arrangement!!.units ?? [],
            },
          },
        },
        create: {
          name: unit.arrangement!!.name,
          key: unit.arrangement!!.key,
          isServiceArrangement: true,
          song: {
            connect: {
              id: unit.arrangement!!.songId,
            },
          },
          originalArrangement: {
            connect: {
              id: unit.arrangement!!.id,
            },
          },
          units: {
            createMany: {
              data: unit.arrangement!!.units ?? [],
            },
          },
        },
        include: {
          units: { orderBy: { order: "asc" } },
          song: true,
        },
      });
      return {
        ...unit,
        arrangementId: arrangement.id,
      };
    }
    return unit;
  });
  return await Promise.all(unitPromises);
}

async function createOrUpdateServiceUnits(
  units: ClientServiceUnit[],
  serviceId: number
): Promise<ClientServiceUnit[]> {
  const unitPromises = units.map(async (unit) => {
    const data = {
      serviceId,
      type: unit.type,
      arrangementId: unit.arrangementId,
      semitoneTranspose: unit.semitoneTranspose,
      order: unit.order,
    };
    return prisma.serviceUnit.upsert({
      where: { id: unit.id ?? -1 },
      update: data,
      create: data,
    });
  });
  return await Promise.all(unitPromises);
}

async function deleteServiceUnitsNotIn(id: number, unitIds: number[]) {
  await prisma.songArrangement
    .deleteMany({
      where: {
        serviceUnit: {
          serviceId: id,
          id: {
            notIn: unitIds,
          },
        },
      },
    })
    .catch((error) => {
      console.error(
        `Error deleting arrangements associated with service units not in provided list for service ID ${id}:`,
        error
      );
    });
  return prisma.serviceUnit
    .deleteMany({
      where: {
        serviceId: id,
        id: {
          notIn: unitIds,
        },
      },
    })
    .catch((error) => {
      console.error(
        `Error deleting service units not in provided list for service ID ${id}:`,
        error
      );
    });
}

export async function deleteService(
  slugOrId: string | number
): Promise<boolean> {
  const service = await prisma.service.findFirst({
    where: {
      ...selectSlugOrId(slugOrId),
      isDeleted: false,
    },
  });
  if (!service) {
    console.error("Service not found");
    return false;
  }
  await prisma.service.update({
    where: { id: service.id },
    data: { isDeleted: true },
  });
  return true;
}

function limitLyrics(
  song: ClientSong,
  limitLines: number,
  forceIncludeFirstLine: boolean,
  query: string
): ClientSong {
  let lineLimit = limitLines;
  const lyricsLines = song.lyrics.split("\n");
  const includedLines = [];
  if (forceIncludeFirstLine) {
    includedLines.push(lyricsLines[0]);
    lineLimit--;
  }
  if (query) {
    lineLimit = extractMatchingLines(
      lyricsLines,
      query,
      lineLimit,
      includedLines
    );
  } else {
    includedLines.push(...lyricsLines.slice(1, lineLimit + 1));
  }
  return {
    ...song,
    lyrics: includedLines.join("\n"),
  };
}

function extractMatchingLines(
  lyricsLines: string[],
  query: string,
  lineLimit: number,
  includedLines: any[]
): number {
  let prevLineIncluded = true;
  for (const line of lyricsLines) {
    if (lineLimit <= 0) break;
    if (line.toLowerCase().includes(query.toLowerCase())) {
      if (!prevLineIncluded) {
        includedLines.push("...");
        lineLimit--;
      }
      includedLines.push(line);
      lineLimit--;
      prevLineIncluded = true;
    } else {
      prevLineIncluded = false;
    }
  }
  return lineLimit;
}

function containsOnlyDigits(title: string) {
  return /^\d+$/.test(title);
}

function selectSlugOrId(slugOrId: string | number): {
  slug?: string;
  id?: number;
} {
  if (typeof slugOrId === "number") {
    return { id: slugOrId };
  } else if (containsOnlyDigits(slugOrId)) {
    return { id: parseInt(slugOrId, 10) };
  } else {
    return { slug: slugOrId };
  }
}

export async function retrieveStats(): Promise<StatsData> {
  const [totalSongs, units] = await Promise.all([
    prisma.song.count({ where: { isDeleted: false } }),
    prisma.serviceUnit.findMany({
      where: { type: "SONG", service: { isDeleted: false } },
      select: {
        arrangement: {
          select: { song: { select: { slug: true, title: true } } },
        },
        service: { select: { slug: true, worshipLeader: true } },
      },
    }),
  ]);

  const songMap = new Map<string, SongStat>();
  const leaderMap = new Map<string, { services: Set<string>; songs: Map<string, SongStat> }>();

  for (const unit of units) {
    const song = unit.arrangement?.song;
    if (!song) continue;

    // Global ranking
    const global = songMap.get(song.slug);
    if (global) global.count++;
    else songMap.set(song.slug, { slug: song.slug, title: song.title, count: 1 });

    // By leader
    const leaderName = unit.service?.worshipLeader?.trim() || "Sem dirigente";
    const serviceSlug = unit.service?.slug;
    if (!leaderMap.has(leaderName)) leaderMap.set(leaderName, { services: new Set(), songs: new Map() });
    const leader = leaderMap.get(leaderName)!;
    if (serviceSlug) leader.services.add(serviceSlug);
    const leaderSong = leader.songs.get(song.slug);
    if (leaderSong) leaderSong.count++;
    else leader.songs.set(song.slug, { slug: song.slug, title: song.title, count: 1 });
  }

  const topSongs = [...songMap.values()].sort((a, b) => b.count - a.count).slice(0, 30);

  const byLeader: LeaderStat[] = [...leaderMap.entries()]
    .map(([name, { services, songs }]) => ({
      name,
      totalServices: services.size,
      topSongs: [...songs.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    }))
    .sort((a, b) => b.totalServices - a.totalServices);

  return { totalSongs, topSongs, byLeader };
}

export async function retrieveTagGroups(): Promise<ClientTagGroup[]> {
  const groups = await prisma.tagGroup.findMany({
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      tags: {
        select: { id: true, name: true, _count: { select: { songs: true } } },
        orderBy: { name: "asc" },
      },
    },
  });
  return groups.map((group) => ({
    ...group,
    tags: group.tags.map(({ _count, ...tag }) => ({
      ...tag,
      songCount: _count.songs,
    })),
  }));
}
