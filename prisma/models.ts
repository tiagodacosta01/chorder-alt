import {
  ArrangementAudio,
  Service,
  ServiceUnit,
  Song,
  SongArrangement,
  SongUnit,
  SongUnitType,
  Tag,
  TagGroup,
} from "@prisma/client";

export type { ArrangementAudio, ServiceUnit, Song, SongArrangement, SongUnit, SongUnitType, Tag, TagGroup };

export type ClientArrangementAudio = Omit<Pick<ArrangementAudio, "id" | "url" | "label" | "order">, "id"> & { id?: number };

export type ClientTag = Pick<Tag, "id" | "name"> & {
  group: Pick<TagGroup, "id" | "name" | "color">;
};

export type ClientTagGroup = Pick<TagGroup, "id" | "name" | "color"> & {
  tags: (Pick<Tag, "id" | "name"> & { songCount?: number })[];
};

export const SERVICE_UNIT_TYPES = ["SONG"];
export const SONG_UNIT_TYPES = [
  "BLOCK",
  "INTRO",
  "VERSE",
  "PRECHORUS",
  "CHORUS",
  "BRIDGE",
  "INTERLUDE",
  "SOLO",
  "ENDING",
  "TEXT",
] as const;

export type ClientSong = Omit<Song, "id" | "legacyId" | "holyricsId"> & {
  id?: number;
  holyricsId?: string | null;
  arrangements?: ClientArrangement[];
  tags?: ClientTag[];
  lastUsedAt?: Date | null;
};
export type ClientArrangement = Omit<
  SongArrangement,
  "id" | "songId"
> & {
  id?: number;
  songId?: number;
  song?: ClientSong;
  units?: ClientSongUnit[];
  audios: ClientArrangementAudio[];
};
export type ClientSongUnit = Omit<SongUnit, "id" | "arrangementId"> & {
  id?: number;
  arrangementId?: number;
};
export type ClientServiceUnit = Omit<ServiceUnit, "id" | "serviceId"> & {
  id?: number;
  arrangement?: ClientArrangement | null;
  serviceId?: number;
};
export type ServiceRef = Pick<Service, "slug" | "title" | "date">;

export type ClientService = Omit<Service, "id" | "legacyId"> & {
  id?: number;
  units?: ClientServiceUnit[];
  prevService?: ServiceRef | null;
  nextService?: ServiceRef | null;
};

export type RecentServiceEntry = {
  slug: string;
  title: string | null;
  date: Date;
  worshipLeader: string | null;
  songs: string[];
};

export type SongStat = {
  slug: string;
  title: string;
  count: number;
};

export type LeaderStat = {
  name: string;
  totalServices: number;
  topSongs: SongStat[];
};

export type StatsData = {
  totalSongs: number;
  topSongs: SongStat[];
  byLeader: LeaderStat[];
};
