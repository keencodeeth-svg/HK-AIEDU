import process from "node:process";
import { pathToFileURL } from "node:url";
import snapshotModule from "./project-snapshot.cjs";

export const {
  PROJECT_SNAPSHOT_DOC_TARGETS,
  collectProjectSnapshot,
  formatProjectSnapshot,
  validateProjectSnapshotDocs
} = snapshotModule;

function printUsage() {
  console.log("Usage: node scripts/project-snapshot.mjs [--check]");
}

function main(argv = process.argv.slice(2)) {
  const args = new Set(argv);
  if (args.has("--help") || args.has("-h")) {
    printUsage();
    return;
  }

  const snapshot = collectProjectSnapshot(process.cwd());
  if (args.has("--check")) {
    const result = validateProjectSnapshotDocs(process.cwd(), snapshot);
    if (!result.ok) {
      console.error("Project snapshot documentation drift detected:");
      for (const failure of result.failures) {
        console.error(`- ${failure.reason}`);
      }
      console.error("");
      console.error(formatProjectSnapshot(snapshot));
      process.exitCode = 1;
      return;
    }
  }

  console.log(formatProjectSnapshot(snapshot));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
