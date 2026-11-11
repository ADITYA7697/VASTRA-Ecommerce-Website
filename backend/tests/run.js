// Cross-platform runner (Node 18-22): `node --test <dir>` behaves differently across versions, so list files explicitly.
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
const suite = process.argv[2] || "unit";
const dir = path.join(__dirname, suite);
const files = fs.readdirSync(dir).filter(f => f.endsWith(".test.js")).map(f => path.join(dir, f));
const r = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit", env: { ...process.env, NODE_ENV: "test" } });
process.exit(r.status ?? 1);
