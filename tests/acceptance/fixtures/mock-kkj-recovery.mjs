// tests/acceptance/fixtures/mock-kkj-recovery.mjs
// Mock KKJ Client with 503 fault injection and automatic recovery for T10-D
//
// SCOPE: In-memory simulation of temporary upstream 503 Service Unavailable
// followed by self-recovery to HTTP 200 OK for acceptance testing.
// SECURITY: Zero outbound network egress. Local in-memory responses only.

import { KkjClient } from "../../../dist/api/kkj-client.js";

const DEFAULT_SUCCESS_XML = `<?xml version="1.0" encoding="utf-8"?>
<SearchItems>
  <Item>
    <Key>RECOVERY-001</Key>
    <ProjectName>503復旧検証案件</ProjectName>
    <OrganizationName>デジタル庁</OrganizationName>
    <Category>01</Category>
    <NoticeDate>2026-10-14</NoticeDate>
  </Item>
</SearchItems>`;

/**
 * Creates a mock KkjClient that fails with HTTP 503 for the first `failCount` attempts,
 * and then automatically recovers and returns HTTP 200 OK.
 *
 * @param {object} options
 * @param {number} [options.failCount=2] - Number of consecutive 503 errors before recovery
 * @param {string} [options.successXml] - Custom XML body on recovery
 * @returns {{ client: KkjClient, metrics: { attempts: number, failed503Count: number, success200Count: number } }}
 */
export function createMockKkjRecoveryClient(options = {}) {
  const failCount = options.failCount ?? 2;
  const successXml = options.successXml ?? DEFAULT_SUCCESS_XML;

  const metrics = {
    attempts: 0,
    failed503Count: 0,
    success200Count: 0,
  };

  const client = new KkjClient({
    rateLimitPerSecond: 1000,
    timeoutMs: 5000,
    fetchImpl: async () => {
      metrics.attempts++;
      if (metrics.attempts <= failCount) {
        metrics.failed503Count++;
        return new Response("Service Unavailable", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      }

      metrics.success200Count++;
      return new Response(successXml, {
        status: 200,
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      });
    },
  });

  return { client, metrics };
}
