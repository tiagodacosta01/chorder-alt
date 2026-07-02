export const dynamic = "force-dynamic";

import Main from "@/components/common/Main";
import AdminTagsClient from "./AdminTagsClient";
import prisma from "@/prisma/client";

export default async function AdminTagsPage() {
  const groups = await prisma.tagGroup.findMany({
    orderBy: { order: "asc" },
    include: {
      tags: {
        orderBy: { name: "asc" },
        include: { _count: { select: { songs: true } } },
      },
    },
  });

  return (
    <Main>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-display font-semibold mb-6">Administração de Tags</h1>
        <AdminTagsClient initialGroups={groups} />
      </div>
    </Main>
  );
}
