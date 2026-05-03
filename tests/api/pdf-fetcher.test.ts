import { beforeEach, describe, expect, it } from "vitest";
import { clearDocumentCache, fetchDocument } from "../../src/api/pdf-fetcher.js";
import { UpstreamError, UserInputError } from "../../src/lib/errors.js";

const publicResolver = async () => ["203.0.113.10"];

describe("fetchDocument", () => {
  beforeEach(() => {
    clearDocumentCache();
  });

  it("fetches a PDF, hashes it, and caches by URI", async () => {
    let fetchCount = 0;
    const result = await fetchDocument("https://example.com/spec.pdf", {
      resolveHostname: publicResolver,
      fetchImpl: async () => {
        fetchCount += 1;
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "application/pdf" },
        });
      },
    });
    const cached = await fetchDocument("https://example.com/spec.pdf", {
      resolveHostname: publicResolver,
      fetchImpl: async () => {
        throw new Error("cache miss");
      },
    });

    expect(fetchCount).toBe(1);
    expect(result).toMatchObject({
      sourceUri: "https://example.com/spec.pdf",
      finalUri: "https://example.com/spec.pdf",
      mimeType: "application/pdf",
      sizeBytes: 3,
    });
    expect(result.sha256).toHaveLength(64);
    expect(cached.sha256).toBe(result.sha256);
  });

  it("follows redirects up to the configured limit", async () => {
    const seenUrls: string[] = [];
    const result = await fetchDocument("https://example.com/start", {
      resolveHostname: publicResolver,
      fetchImpl: async (input) => {
        const url = input.toString();
        seenUrls.push(url);
        if (url.endsWith("/start")) {
          return new Response(null, {
            status: 302,
            headers: { location: "/spec.pdf" },
          });
        }
        return new Response(new Uint8Array([4, 5]), {
          headers: { "content-type": "application/pdf" },
        });
      },
    });

    expect(seenUrls).toEqual(["https://example.com/start", "https://example.com/spec.pdf"]);
    expect(result.finalUri).toBe("https://example.com/spec.pdf");
  });

  it("rejects unsupported MIME types", async () => {
    await expect(
      fetchDocument("https://example.com/spec.zip", {
        resolveHostname: publicResolver,
        fetchImpl: async () =>
          new Response(new Uint8Array([1]), {
            headers: { "content-type": "application/zip" },
          }),
      }),
    ).rejects.toBeInstanceOf(UserInputError);
  });

  it("rejects content-length above the size limit", async () => {
    await expect(
      fetchDocument("https://example.com/large.pdf", {
        maxBytes: 2,
        resolveHostname: publicResolver,
        fetchImpl: async () =>
          new Response(new Uint8Array([1]), {
            headers: {
              "content-type": "application/pdf",
              "content-length": "3",
            },
          }),
      }),
    ).rejects.toBeInstanceOf(UserInputError);
  });

  it("rejects streamed bodies above the size limit", async () => {
    await expect(
      fetchDocument("https://example.com/stream.pdf", {
        maxBytes: 2,
        resolveHostname: publicResolver,
        fetchImpl: async () =>
          new Response(new Uint8Array([1, 2, 3]), {
            headers: { "content-type": "application/pdf" },
          }),
      }),
    ).rejects.toBeInstanceOf(UserInputError);
  });

  it("rejects private IP literal targets before fetching", async () => {
    let fetched = false;
    await expect(
      fetchDocument("http://127.0.0.1/spec.pdf", {
        resolveHostname: publicResolver,
        fetchImpl: async () => {
          fetched = true;
          return new Response(new Uint8Array([1]), {
            headers: { "content-type": "application/pdf" },
          });
        },
      }),
    ).rejects.toBeInstanceOf(UserInputError);
    expect(fetched).toBe(false);
  });

  it("rejects hostnames that resolve to private addresses", async () => {
    await expect(
      fetchDocument("https://metadata.google.internal/spec.pdf", {
        resolveHostname: async () => ["169.254.169.254"],
        fetchImpl: async () => new Response(new Uint8Array([1])),
      }),
    ).rejects.toBeInstanceOf(UserInputError);
  });

  it("honors host allowlists", async () => {
    await expect(
      fetchDocument("https://evil.example/spec.pdf", {
        allowedHosts: ["example.com"],
        resolveHostname: publicResolver,
        fetchImpl: async () => new Response(new Uint8Array([1])),
      }),
    ).rejects.toBeInstanceOf(UserInputError);
  });

  it("throws upstream errors for redirect loops", async () => {
    await expect(
      fetchDocument("https://example.com/a", {
        maxRedirects: 1,
        resolveHostname: publicResolver,
        fetchImpl: async () =>
          new Response(null, {
            status: 302,
            headers: { location: "/a" },
          }),
      }),
    ).rejects.toBeInstanceOf(UpstreamError);
  });

  it("times out slow upstreams", async () => {
    await expect(
      fetchDocument("https://example.com/slow.pdf", {
        timeoutMs: 1,
        resolveHostname: publicResolver,
        fetchImpl: async (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      }),
    ).rejects.toBeInstanceOf(UpstreamError);
  });
});
