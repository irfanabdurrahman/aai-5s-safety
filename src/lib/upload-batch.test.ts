import { describe, expect, it, vi } from "vitest";
import { saveBatchAtomically } from "./upload-batch";

describe("saveBatchAtomically", () => {
  it("removes every successfully saved item when a later save fails", async () => {
    const removed: string[][] = [];
    const save = vi.fn(async (item: string) => {
      if (item === "bad") throw new Error("invalid upload");
      return `saved/${item}`;
    });

    await expect(
      saveBatchAtomically(["one", "two", "bad"], save, async (paths) => {
        removed.push(paths);
      }),
    ).rejects.toThrow("invalid upload");

    expect(removed).toEqual([["saved/one", "saved/two"]]);
  });

  it("returns all paths and performs no cleanup on success", async () => {
    const cleanup = vi.fn();
    await expect(
      saveBatchAtomically(["one", "two"], async (item) => `saved/${item}`, cleanup),
    ).resolves.toEqual(["saved/one", "saved/two"]);
    expect(cleanup).not.toHaveBeenCalled();
  });
});
