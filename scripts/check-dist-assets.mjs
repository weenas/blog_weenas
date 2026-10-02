// Fails the build when a page references a /_astro/ file that wasn't
// written, e.g. an image whose download broke (Astro only warns about it).
// A failed build keeps the previous deployment live on Cloudflare Pages.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith(".html")) yield path;
  }
}

const missing = new Map();
let checked = 0;
for (const file of htmlFiles(DIST)) {
  const html = readFileSync(file, "utf8");
  const refs = new Set(html.match(/\/_astro\/[^\s"'(),<>]+/g) ?? []);
  for (const ref of refs) {
    checked++;
    if (!existsSync(join(DIST, decodeURI(ref)))) {
      missing.set(ref, [...(missing.get(ref) ?? []), file]);
    }
  }
}

if (missing.size > 0) {
  console.error(`✗ ${missing.size} referenced asset(s) missing from ${DIST}/:`);
  for (const [ref, files] of missing) {
    console.error(`  ${ref}  (in ${files.length} page(s), e.g. ${files[0]})`);
  }
  process.exit(1);
}
console.log(`✓ All ${checked} /_astro/ references resolve`);
