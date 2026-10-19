import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("../src/lib/prisma", () => ({
  prisma: { $transaction: vi.fn() },
}));

import { prisma } from "../src/lib/prisma";
import { withSerializableTransaction } from "../src/lib/transaction";

const transaction = vi.mocked(prisma.$transaction);

function conflictError() {
  return new Prisma.PrismaClientKnownRequestError("Serialization conflict", {
    code: "P2034",
    clientVersion: "6.16.3",
  });
}

describe("Serializable transaction retry policy", () => {
  beforeEach(() => vi.resetAllMocks());

  it("enforces Serializable isolation and calls the operation", async () => {
    transaction.mockImplementation((async (operation: (tx: unknown) => Promise<string>) =>
      operation({ name: "mock-tx" })) as never);

    const result = await withSerializableTransaction(async (tx) => {
      expect(tx).toEqual({ name: "mock-tx" });
      return "committed";
    });
    expect(result).toBe("committed");
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000,
    });
  });

  it("restarts on a P2034 serialization conflict", async () => {
    transaction.mockRejectedValueOnce(conflictError()).mockResolvedValueOnce("retried" as never);
    expect(await withSerializableTransaction(async () => "retried")).toBe("retried");
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("never retries ordinary database errors", async () => {
    transaction.mockRejectedValue(new Error("DB unavailable"));
    await expect(withSerializableTransaction(async () => "never")).rejects.toThrow("DB unavailable");
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("stops retrying after five conflicts", async () => {
    transaction.mockRejectedValue(conflictError());
    await expect(withSerializableTransaction(async () => "never")).rejects.toMatchObject({ code: "P2034" });
    expect(transaction).toHaveBeenCalledTimes(5);
  });
});
