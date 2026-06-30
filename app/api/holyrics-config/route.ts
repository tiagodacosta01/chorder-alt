import prisma from "@/prisma/client";
import { NextRequest } from "next/server";

export async function GET() {
  const config = await prisma.holyricsConfig.findUnique({ where: { id: 1 } });
  return Response.json({
    token: config?.token ?? "",
    host: config?.host ?? "localhost:8091"
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();

  const updateData: { token?: string; host?: string } = {};
  if (typeof body.token === "string") updateData.token = body.token;
  if (typeof body.host === "string") updateData.host = body.host;

  const config = await prisma.holyricsConfig.upsert({
    where: { id: 1 },
    update: updateData,
    create: { id: 1, token: body.token ?? "", host: body.host ?? "localhost:8091" },
  });
  return Response.json({ token: config.token, host: config.host });
}
