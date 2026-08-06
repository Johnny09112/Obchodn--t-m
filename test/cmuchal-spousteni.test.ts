import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  POVOLENE_NASTROJE,
  sestavArgumenty,
  spustSurovyProces,
  zjistiSpustitelnyClaude,
} from "../src/cmuchal-spousteni.js";

const TENTO_ADRESAR = dirname(fileURLToPath(import.meta.url));
const POMOCNY_SKRIPT = join(TENTO_ADRESAR, "pomocne", "vypis-argv.mjs");

/**
 * Nález 1 závěrečné revize: se `shell: true` Node argumenty needituje, jen
 * je slepí mezerami a předá `cmd.exe` — ten je přeskládá a nové řádky v
 * zadání useknou zbytek. Tenhle test proto nepoužívá atrapu, ale skutečný
 * proces (Node spouští pomocný skript stejně, jako produkční kód spouští
 * `claude`), ať se ověří přenos přes operační systém, ne jen sestavení pole
 * v paměti.
 */
describe("přenos argumentů a zadání bez shellu (nález 1)", () => {
  it("dorazí všechny argumenty beze změny — i vzory se závorkami a mezerami — a zadání s novými řádky dorazí na stdin", async () => {
    const prompt = "Dohledej\n\nu každé firmy kontakt.";
    const { beh } = spustSurovyProces(process.execPath, [POMOCNY_SKRIPT, ...sestavArgumenty()], {
      cwd: process.cwd(),
      prompt,
    });
    const vysledek = await beh;

    expect(vysledek.kod).toBe(0);
    const vystup = JSON.parse(vysledek.stdout) as { argv: string[]; stdin: string };

    // Celé pole beze změny — ne jen namátkou pár prvků.
    expect(vystup.argv).toEqual(sestavArgumenty());
    expect(vystup.argv).toContain("--agent");
    expect(vystup.argv).toContain("cmuchal");
    // Vzor se závorkami i mezerami — přesně to, co se dřív rozpadlo na pět
    // samostatných argumentů.
    expect(vystup.argv).toContain("Bash(npm run cli -- k-obohaceni*)");
    expect(POVOLENE_NASTROJE).toContain(vystup.argv.find((a) => a.startsWith("Bash(npm run cli -- k-obohaceni")));

    // Zadání dorazilo celé a beze zkrácení na prvním novém řádku.
    expect(vystup.stdin).toBe(prompt);
  });

  it("nepověsí se ani na delší výstup na stdout (nález 3 — nutné odebírat obě roury)", async () => {
    // Skript, který zaplní stdout víc, než se vejde do bufferu roury OS
    // (typicky 64 KiB na Windows) — dřív by proces při zápisu čekal na
    // vyprázdnění, které bez odebírání stdout nikdy nepřišlo.
    const velkyVystupSkript = join(TENTO_ADRESAR, "pomocne", "velky-vystup.mjs");
    const { beh } = spustSurovyProces(process.execPath, [velkyVystupSkript], {
      cwd: process.cwd(),
      prompt: "",
    });
    const vysledek = await beh;
    expect(vysledek.kod).toBe(0);
    expect(vysledek.stdout.length).toBeGreaterThan(200_000);
  });
});

describe("zjistiSpustitelnyClaude", () => {
  it("na Windows najde .cmd obal na PATH a vrátí vedlejší claude.exe", () => {
    if (process.platform !== "win32") return; // pravidlo řeší jen npm .cmd obal na Windows

    const puvodniPath = process.env.PATH;
    const adr = mkdtempSync(join(tmpdir(), "claude-cmd-"));
    const binAdr = join(adr, "node_modules", "@anthropic-ai", "claude-code", "bin");
    try {
      writeFileSync(join(adr, "claude.cmd"), "@echo off\n");
      mkdirSync(binAdr, { recursive: true });
      writeFileSync(join(binAdr, "claude.exe"), "");

      process.env.PATH = `${adr}${process.platform === "win32" ? ";" : ":"}${puvodniPath ?? ""}`;
      expect(zjistiSpustitelnyClaude()).toBe(join(binAdr, "claude.exe"));
    } finally {
      process.env.PATH = puvodniPath;
      rmSync(adr, { recursive: true, force: true });
    }
  });

  it("chybí-li vedle .cmd obalu claude.exe, vyhodí čitelnou chybu", () => {
    if (process.platform !== "win32") return;

    const puvodniPath = process.env.PATH;
    const adr = mkdtempSync(join(tmpdir(), "claude-cmd-bez-exe-"));
    try {
      writeFileSync(join(adr, "claude.cmd"), "@echo off\n");
      process.env.PATH = `${adr};${puvodniPath ?? ""}`;
      expect(() => zjistiSpustitelnyClaude()).toThrow(/claude\.exe/);
    } finally {
      process.env.PATH = puvodniPath;
      rmSync(adr, { recursive: true, force: true });
    }
  });
});
