import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 30_000,
    // Příprava (`beforeEach`) pouští celou sadu migrací, tedy stejně
    // těžkou práci jako samotný test — a s každou další migrací déle.
    // Výchozích 10 s začalo pod souběžnou zátěží vypršovat u 25 migrací,
    // ačkoli tentýž soubor samostatně projde za 17 s.
    hookTimeout: 30_000,
  },
});
