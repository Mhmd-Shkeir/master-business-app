import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const MAX_SERIALIZATION_ATTEMPTS = 5;

/**
 * PostgreSQL Serializable isolation prevents stale read/modify/write races
 * across project status, balances and payments. Prisma reports write conflicts
 * and deadlocks as P2034; restart the entire transaction so all business
 * validations run again against a fresh snapshot.
 */
export async function withSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_SERIALIZATION_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!retryable || attempt === MAX_SERIALIZATION_ATTEMPTS - 1) throw error;

      // Short bounded backoff reduces repeat conflicts under contention.
      await new Promise((resolve) => setTimeout(resolve, 20 * 2 ** attempt));
    }
  }
  throw new Error("Serializable transaction retry limit exceeded");
}
