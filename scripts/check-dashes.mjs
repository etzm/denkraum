// Fails if a tracked file contains an en dash or em dash (house style: never use them).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && f !== "pnpm-lock.yaml" && !/\.(png|jpe?g|ico|woff2?)$/i.test(f));

const hits = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, i) => {
    if (/[\u2013\u2014]/.test(line)) hits.push(`${file}:${i + 1}`);
  });
}
if (hits.length) {
  console.error(`Long dashes found:\n${hits.join("\n")}`);
  process.exit(1);
}
console.log(`No long dashes in ${files.length} files.`);
