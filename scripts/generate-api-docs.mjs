import { existsSync } from "node:fs";
import path from "node:path";

// Keep API documentation collation stable across Windows and Linux.
const OriginalCollator = Intl.Collator;
function StableCollator(locales, options) {
  return new OriginalCollator(!locales || locales === "und" ? "en-US" : locales, options);
}
StableCollator.supportedLocalesOf = OriginalCollator.supportedLocalesOf.bind(OriginalCollator);
Object.setPrototypeOf(StableCollator, OriginalCollator);
StableCollator.prototype = OriginalCollator.prototype;
Intl.Collator = StableCollator;
const originalCompare = String.prototype.localeCompare;
String.prototype.localeCompare = function compare(text, locales, options) {
  return originalCompare.call(
    this,
    text,
    !locales || locales === "und" ? "en-US" : locales,
    options,
  );
};

// Use the public TypeDoc API rather than an internal dist/lib entry path.
const { Application } = await import("typedoc");
const ts = await import("typescript");
const app = await Application.bootstrapWithPlugins();
// This project documents five literal source paths. Resolve them through the
// public TypeScript API so TypeDoc does not rely on minimatch's removed matchOne
// method. Do not restore the vulnerable legacy matcher or accept glob patterns.
const configuredEntries = app.options.getValue("entryPoints");
if (configuredEntries.some((entry) => /[*?{}[\]!]/.test(entry))) {
  throw new Error("API documentation entryPoints must be explicit source files");
}
const program = ts.createProgram(app.options.getFileNames(), app.options.getCompilerOptions());
app.getEntryPoints = () =>
  configuredEntries.map((entry) => {
    const absolute = path.resolve(entry);
    const sourceFile = program.getSourceFile(absolute);
    if (!existsSync(absolute) || !sourceFile) {
      throw new Error(`API documentation source is unavailable: ${entry}`);
    }
    return {
      displayName: path
        .relative(path.resolve("src"), absolute)
        .replaceAll("\\", "/")
        .replace(/\.ts$/, ""),
      sourceFile,
      program,
    };
  });
const project = await app.convert();
if (!project) {
  process.exitCode = 1;
} else {
  app.validate(project);
  await app.generateDocs(project, app.options.getValue("out"));
  if (app.logger.hasErrors()) process.exitCode = 1;
}
