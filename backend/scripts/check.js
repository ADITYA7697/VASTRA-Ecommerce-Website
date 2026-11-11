const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const root = path.resolve(__dirname, "..");
const ignored = new Set(["node_modules", ".git"]);
let files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && full.endsWith(".js")) files.push(full);
  }
}
walk(root);
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(`FAIL ${path.relative(root, file)}\n${result.stderr}`);
  } else {
    process.stdout.write(`PASS syntax ${path.relative(root, file)}\n`);
  }
}
if (failed) process.exit(1);
console.log(`\nStatic syntax check passed for ${files.length} JavaScript files.`);
