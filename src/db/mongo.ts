import { Resource } from "sst";
import { PrismaClient } from "../../generated/prisma";
import { ObjectId } from "mongodb";

const createPrismaClient = () => {
  if (Resource.App.stage === "development") {
    process.env.DATABASE_URL = Resource.DATABASE_URL_DEVELOPER.value;
  } else if (Resource.App.stage === "staging") {
    process.env.DATABASE_URL = Resource.DATABASE_URL_DEVELOPER.value;
  } else {
    process.env.DATABASE_URL = Resource.DATABASE_URL_PRODUCTION.value;
  }

  return new PrismaClient({
    log:
      Resource.App.stage === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prismaDB = globalForPrisma.prisma ?? createPrismaClient();

if (Resource.App.stage !== "production") globalForPrisma.prisma = prismaDB;

export const getID = () => {
  return ObjectId.createFromTime(new Date().getTime()).toString();
};
