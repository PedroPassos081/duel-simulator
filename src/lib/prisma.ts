import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient, type Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
if (databaseUrl && !databaseUrl.searchParams.has("connection_limit")) {
  databaseUrl.searchParams.set("connection_limit", "3");
}

const client =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasourceUrl: databaseUrl.toString() } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;

const transactions = new AsyncLocalStorage<Prisma.TransactionClient>();

// Reward workflows call several existing services. Within atomicWork all of
// their reads, writes and nested transactions share the same database commit.
export const prisma: PrismaClient = new Proxy(client, {
  get(target, property) {
    const tx = transactions.getStore();
    if (tx && property === "$transaction") {
      return (
        work: ((db: Prisma.TransactionClient) => unknown) | Promise<unknown>[],
      ) => (typeof work === "function" ? work(tx) : Promise.all(work));
    }
    const db = tx ?? target;
    const value = Reflect.get(db, property);
    return typeof value === "function" ? value.bind(db) : value;
  },
});

export async function atomicWork<T>(
  resources: string[],
  work: () => Promise<T>,
): Promise<T> {
  const run = async (tx: Prisma.TransactionClient) => {
    // Consistent locks protect read/validate/write operations, including rows
    // that do not exist yet, across different server processes.
    for (const resource of [...new Set(resources)].sort()) {
      await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtextextended(${resource}, 0))) AS locked`;
    }
    return work();
  };
  const existing = transactions.getStore();
  if (existing) return run(existing);
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.$transaction(
        (tx) => transactions.run(tx, () => run(tx)),
        { maxWait: 10_000, timeout: 120_000 },
      );
    } catch (error) {
      if (
        attempt >= 2 ||
        !(
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2034"
        )
      )
        throw error;
    }
  }
}
