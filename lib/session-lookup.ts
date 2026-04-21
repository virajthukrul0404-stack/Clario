import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const sessionRouteWhere = (sessionParam: string): Prisma.SessionWhereInput => ({
  OR: [{ id: sessionParam }, { roomIdentifier: sessionParam }],
});

export async function findSessionByRouteParam(sessionParam: string) {
  return db.session.findFirst({
    where: sessionRouteWhere(sessionParam),
  });
}

export async function findSessionByRouteParamWithInclude<
  T extends Prisma.SessionInclude
>(sessionParam: string, include: T) {
  return db.session.findFirst({
    where: sessionRouteWhere(sessionParam),
    include,
  });
}
