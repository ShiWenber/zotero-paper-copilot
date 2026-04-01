/**
 * Post-install patch for zotero-plugin-scaffold test build.
 *
 * Adds platform: 'node' + .md loader to TestBundler's esbuild context
 * so node:fs/path/os and .md imports work in zotero-plugin test runs.
 */

/* global console, process */
const fs = require("fs");
const glob = require("glob");

const scaffoldDistFiles = glob.sync(
  "node_modules/zotero-plugin-scaffold/dist/shared/zotero-plugin-scaffold.*.mjs",
);

if (scaffoldDistFiles.length === 0) {
  console.log("zotero-plugin-scaffold dist not found, skipping patch");
  process.exit(0);
}

let patched = false;
for (const distFile of scaffoldDistFiles) {
  let content = fs.readFileSync(distFile, "utf8");

  if (content.includes('platform: "node"')) {
    continue;
  }

  const original = `this.esbuildContext = await context({
      entryPoints,
      outdir: \`\${TESTER_PLUGIN_DIR}/content/units\`,
      bundle: true,
      target: "firefox115",
      metafile: true
    });`;

  const patched_ = `this.esbuildContext = await context({
      entryPoints,
      outdir: \`\${TESTER_PLUGIN_DIR}/content/units\`,
      bundle: true,
      platform: "node",
      target: "firefox115",
      loader: { ".md": "text" },
      metafile: true
    });`;

  if (!content.includes(original)) {
    console.log(`Could not find target pattern in ${distFile}, skipping`);
    continue;
  }

  content = content.replace(original, patched_);
  fs.writeFileSync(distFile, content);
  console.log(`Patched ${distFile}: added platform:'node' + .md loader`);
  patched = true;
}

if (patched) {
  console.log("zotero-plugin-scaffold patch applied");
} else {
  console.log("zotero-plugin-scaffold already patched or no matching files");
}
