import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".nuxt");
const hits = [];

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!/\.(mjs|js|json|d\.ts|ts)$/.test(entry.name)) {
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf8");
    if (content.includes("/reports") || content.includes("reports.vue") || content.includes("/onboarding/organization")) {
      hits.push(fullPath);
    }
  }
};

walk(root);
process.stdout.write(`${JSON.stringify(hits, null, 2)}\n`);
