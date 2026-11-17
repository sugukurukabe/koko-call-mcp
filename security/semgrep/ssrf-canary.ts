// Static scanner fixtures only; this file is never executed or bundled.
import axios from "axios";

declare const server: { registerTool: (...args: unknown[]) => void };
declare const businessMap: Map<string, string>;
declare function decodeWatchToken(value: string): unknown;

server.registerTool("unsafe-fetch", {}, async (args) => {
  // MUST-DETECT: fetch
  return fetch(args.url);
});

server.registerTool("unsafe-axios-call", {}, async (args) => {
  // MUST-DETECT: axios-call
  return axios(args.url);
});

server.registerTool("unsafe-axios-get", {}, async (args) => {
  // MUST-DETECT: axios-get
  return axios.get(args.url);
});

server.registerTool("non-http-map", {}, async (args) => {
  // MUST-NOT-DETECT: business-map
  return businessMap.get(args.name);
});

server.registerTool("non-http-decoder", {}, async (args) => {
  // MUST-NOT-DETECT: token-decoder
  return decodeWatchToken(args.state_token);
});
