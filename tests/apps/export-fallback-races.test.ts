import { afterEach, describe, expect, it, vi } from "vitest";
import { handleExportBids } from "../../src/apps/search-results.js";
import type { Bid } from "../../src/domain/bid.js";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const bid: Bid = {
  resultId: 1,
  key: "audit-fixture-1",
  projectName: "Local export fixture",
  bidRef: "local-fixture-token",
};

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
});

describe("Export fallback concurrency", () => {
  it.each([false, true])("ignores stale chat completion (isError=%s)", async (isError) => {
    const response = deferred<{ isError: boolean }>();
    const started = deferred<void>();
    const copy = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: copy },
    });
    const app = {
      getHostCapabilities: () => ({ message: { text: true } }),
      sendMessage: () => {
        started.resolve();
        return response.promise;
      },
    } as unknown as Parameters<typeof handleExportBids>[0];
    let stale = false;
    let message = "";
    const pending = handleExportBids(
      app,
      [bid],
      "選択CSV",
      (value) => {
        message = value;
      },
      "csv",
      undefined,
      () => stale,
    );
    await started.promise;
    stale = true;
    message = "New search is active";
    response.resolve({ isError });
    await pending;
    expect(message).toBe("New search is active");
    expect(copy).not.toHaveBeenCalled();
  });

  it.each([false, true])("ignores stale clipboard completion (reject=%s)", async (reject) => {
    const response = deferred<void>();
    const started = deferred<void>();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () => {
          started.resolve();
          return response.promise;
        },
      },
    });
    const app = {
      getHostCapabilities: () => ({}),
    } as unknown as Parameters<typeof handleExportBids>[0];
    let stale = false;
    let message = "";
    const pending = handleExportBids(
      app,
      [bid],
      "選択CSV",
      (value) => {
        message = value;
      },
      "csv",
      undefined,
      () => stale,
    );
    await started.promise;
    stale = true;
    message = "New search is active";
    if (reject) response.reject(new Error("Clipboard denied"));
    else response.resolve();
    await pending;
    expect(message).toBe("New search is active");
  });

  it("still copies the current request after a chat rejection", async () => {
    const copy = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: copy },
    });
    const app = {
      getHostCapabilities: () => ({ message: { text: true } }),
      sendMessage: async () => ({ isError: true }),
    } as unknown as Parameters<typeof handleExportBids>[0];
    let message = "";
    await handleExportBids(
      app,
      [bid],
      "選択CSV",
      (value) => {
        message = value;
      },
      "csv",
      undefined,
      () => false,
    );
    expect(copy).toHaveBeenCalledOnce();
    expect(message).toContain("プロンプトをコピーしました");
  });
});
