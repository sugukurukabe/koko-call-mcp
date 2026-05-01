#!/usr/bin/env node
import { startHttpServer } from "./transports/http.js";
import { startStdioServer } from "./transports/stdio.js";

const mode = process.argv.includes("--http") ? "http" : "stdio";

if (mode === "http") {
  await startHttpServer();
} else {
  await startStdioServer();
}
