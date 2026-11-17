import assert from "node:assert/strict";
import test from "node:test";
import { CdpClient } from "../../scripts/apps-harness/verify-ui-browser-acceptance.mjs";

class FakeSocket extends EventTarget {
  sent = [];
  closed = false;

  send(text) {
    this.sent.push(JSON.parse(text));
  }

  close() {
    this.closed = true;
    this.dispatchEvent(new Event("close"));
  }

  reply(result) {
    const event = new Event("message");
    event.data = JSON.stringify({ id: this.sent.at(-1).id, result });
    this.dispatchEvent(event);
  }
}

test("a CDP command with no browser response rejects within its deadline", async () => {
  const socket = new FakeSocket();
  const client = new CdpClient(socket, { requestTimeoutMs: 20 });
  await assert.rejects(client.send("Runtime.evaluate"), /Runtime.evaluate timed out/);
  assert.equal(client.pending.size, 0);
  client.close();
});

test("browser disconnect rejects pending commands immediately", async () => {
  const socket = new FakeSocket();
  const client = new CdpClient(socket);
  const rejected = assert.rejects(client.send("Page.enable"), /WebSocket closed/);
  socket.close();
  await rejected;
  assert.equal(client.pending.size, 0);
  await assert.rejects(client.send("Page.enable"), /WebSocket closed/);
});

test("successful responses clear the pending request", async () => {
  const socket = new FakeSocket();
  const client = new CdpClient(socket, { requestTimeoutMs: 20 });
  const response = client.send("Target.createTarget");
  socket.reply({ targetId: "local-test-target" });
  assert.deepEqual(await response, { targetId: "local-test-target" });
  assert.equal(client.pending.size, 0);
  client.close();
});

test("a WebSocket that never opens is closed at the connection deadline", async () => {
  let socket;
  class NeverOpens extends FakeSocket {
    constructor() {
      super();
      socket = this;
    }
  }
  await assert.rejects(
    CdpClient.connect("ws://127.0.0.1:1", { WebSocketImpl: NeverOpens, timeoutMs: 20 }),
    /connection timed out/,
  );
  assert.equal(socket.closed, true);
});

test("closing the client rejects an outstanding command", async () => {
  const client = new CdpClient(new FakeSocket());
  const rejected = assert.rejects(client.send("Runtime.enable"), /client closed/);
  client.close();
  await rejected;
  assert.equal(client.pending.size, 0);
});
