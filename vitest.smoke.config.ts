import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Load .env into process.env (no dotenv dependency needed)
function loadDotEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx);
      const value = trimmed.slice(idx + 1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {}
}

loadDotEnv();

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/smoke/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.test.json",
    },
  },
});
