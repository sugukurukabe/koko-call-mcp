import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function createSemgrepEnvironment() {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|USERPROFILE|APPDATA|LOCALAPPDATA|TMPDIR|TMP|TEMP|HOME)$/i.test(
        key,
      ),
    ),
  );
  let scratch;
  let parent;
  if (process.platform === "win32") {
    // Windows AF_UNIX socket addresses are short. The engine's socketpair
    // bootstrap fails when inherited TEMP points into a long workspace path.
    parent = fs.realpathSync(
      path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData/Local"), "Temp"),
    );
    scratch = fs.mkdtempSync(path.join(parent, "jpb-sg-"));
    env.TEMP = scratch;
    env.TMP = scratch;
    env.TMPDIR = scratch;
  }
  return {
    env,
    dispose() {
      if (!scratch || !fs.existsSync(scratch)) return;
      const resolved = fs.realpathSync(scratch);
      if (path.dirname(resolved) !== parent || !path.basename(resolved).startsWith("jpb-sg-")) {
        throw new Error("Refusing cleanup outside the generated engine directory");
      }
      fs.rmSync(resolved, { recursive: true, force: true });
    },
  };
}
