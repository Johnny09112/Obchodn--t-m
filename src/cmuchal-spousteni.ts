/**
 * Spuštění Čmuchala neinteraktivně.
 *
 * **Jediné místo v projektu, které spouští cizí proces.** Je oddělené proto,
 * aby šlo v testech nahradit — testovat se má výběr firem a stavy fronty,
 * ne to, že jde spustit Claude Code.
 *
 * **Bez shellu.** Se `shell: true` Node argumenty needituje, jen je slepí
 * mezerami a předá `cmd.exe` — ten je pak sám přeskládá a nové řádky v
 * zadání useknou všechno za prvním z nich (nález 1 závěrečné revize,
 * ověřeno pokusem: `--agent cmuchal` i celé `--allowedTools` beze stopy
 * zmizely). Proto se spouští přímo skutečný `claude.exe`
 * (viz `zjistiSpustitelnyClaude`) a zadání jde na stdin, ne argumentem —
 * ať v argumentech vůbec nejsou nové řádky, na kterých by se dalo něco
 * rozbít.
 *
 * Ověřeno 2026-08-06 na Claude Code 2.1.220: `-p` bez zadaného promptu čte
 * prompt ze stdin, `--agent` vybere agenta z `.claude/agents/`.
 * `--output-format json` se schválně nepoužívá — nic ten výsledek nečte
 * a slibovat „strojově čitelný výsledek" v komentáři bylo zavádějící
 * (nález 3 závěrečné revize).
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";

export interface VysledekSpusteni {
  ok: boolean;
  chyba: string | null;
}

/**
 * Nástroje, které agent při rešerši dostane.
 *
 * **Nespoléhej na to jako na bezpečnostní hranici.** Ověřeno živým pokusem
 * 6. 8. 2026: cesty v povolovacím seznamu čtení souborů **neomezují** —
 * s povoleným `Read(playbook-cmuchal.md)` agent přesto přečetl `src/reserse.ts`
 * a vrátil jeho přesnou délku. Zákaz podle cesty zabírá jen někdy
 * (`Read(src/**)` ano, `.env` ne). Tenhle seznam je tedy vodítko pro model,
 * ne zámek.
 *
 * Skutečné hranice, na kterých stojí bezpečnost běhu bez dozoru:
 * 1. **Tajemství nejsou v pracovní složce** — `.env` leží mimo repozitář
 *    (`src/env.ts`, `vychoziCestaEnv`). Na co agent nedosáhne, to neunikne.
 * 2. **Každý zápis prochází `zapis-nalezy`**, které vyžaduje zdroj a doslovnou
 *    citaci (TP-2) a odmítá atributy mimo whitelist (TP-3).
 * 3. **Agent nemá čím odeslat** (TP-8) a každý běh je v `agent_runs` (TP-13).
 *
 * Playbook si agent smí upravovat sám, to je záměr (`.claude/agents/cmuchal.md`).
 */
export const POVOLENE_NASTROJE = [
  "WebSearch",
  "WebFetch",
  "Read(playbook-cmuchal.md)",
  "Read(nalezy*.json)",
  "Write(playbook-cmuchal.md)",
  "Write(nalezy*.json)",
  "Bash(npm run cli -- k-obohaceni*)",
  "Bash(npm run cli -- zapis-nalezy*)",
] as const;

/**
 * Druhá pojistka vedle `POVOLENE_NASTROJE` výše — pro případ, že by
 * definice agenta (`.claude/agents/cmuchal.md`) někdy povolila víc, než má
 * (nález 5 závěrečné revize: „zvaž i výslovný zákaz nástrojů na úpravu
 * souborů").
 */
export const ZAKAZANE_NASTROJE = ["Edit", "NotebookEdit"] as const;

/** Argumenty pro `claude` — čistá funkce, ať jde v testu ověřit beze spuštění. */
export function sestavArgumenty(): string[] {
  return [
    "-p",
    "--agent",
    "cmuchal",
    "--allowedTools",
    ...POVOLENE_NASTROJE,
    "--disallowedTools",
    ...ZAKAZANE_NASTROJE,
  ];
}

/** Strop: dvojnásobek naměřených 64 s na firmu, nejméně deset minut. */
export function stropMs(firem: number): number {
  return Math.max(600_000, firem * 128_000);
}

/**
 * Cesta ke spustitelnému Claude Code, kterou lze spustit BEZ shellu.
 *
 * Na Windows je `claude` na PATH jen tenký `.cmd` obal npm. Node ho bez
 * shellu odmítne spustit (`EINVAL`, blok CVE-2024-27980 — ověřeno pokusem)
 * a se shellem zase láme argumenty (viz komentář nahoře). Obal ale jen
 * deleguje na skutečný `claude.exe` vedle sebe
 * (`node_modules/@anthropic-ai/claude-code/bin/claude.exe`, ověřeno čtením
 * `.cmd` souboru) — ten spustíme přímo, bez shellu, a argumenty dorazí
 * beze změny (ověřeno pokusem, včetně nových řádků a vzorů se závorkami).
 *
 * Mimo Windows je `claude` na PATH rovnou spustitelný skript se shebangem —
 * žádné přesměrování není potřeba.
 */
export function zjistiSpustitelnyClaude(): string {
  const jmenoObalu = process.platform === "win32" ? "claude.cmd" : "claude";
  const adresare = (process.env.PATH ?? process.env.Path ?? "").split(delimiter);
  const obal = adresare.map((a) => join(a, jmenoObalu)).find((c) => existsSync(c));
  if (!obal) {
    throw new Error(`Claude Code (${jmenoObalu}) není na PATH.`);
  }
  if (process.platform !== "win32") return obal;

  const exe = join(
    dirname(obal),
    "node_modules",
    "@anthropic-ai",
    "claude-code",
    "bin",
    "claude.exe",
  );
  if (!existsSync(exe)) {
    throw new Error(
      `Vedle ${obal} chybí claude.exe (${exe}) — instalace Claude Code je jiná, než se čekalo.`,
    );
  }
  return exe;
}

export interface VysledekProcesu {
  kod: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Spustí proces bez shellu, pošle mu `prompt` na stdin a odebere stdout
 * i stderr.
 *
 * Odebírat se musí obojí — jinak se u delší dávky (`--output-format json`
 * dřív, teď i tak) naplní roura operačního systému a proces se zablokuje
 * při zápisu, tedy pověsí (nález 3 závěrečné revize).
 *
 * Nízkoúrovňová stavební jednotka `spustCmuchala` — vyexportovaná zvlášť,
 * ať jde v testu ověřit přenos argumentů a zadání se skutečným procesem
 * (pomocným echo skriptem), ne jen s atrapou, která by transport OS
 * neprocvičila.
 */
export function spustSurovyProces(
  soubor: string,
  argumenty: string[],
  v: { cwd: string; prompt: string },
): { proces: ChildProcess; beh: Promise<VysledekProcesu> } {
  const proces = spawn(soubor, argumenty, { cwd: v.cwd, shell: false });
  proces.stdin.write(v.prompt);
  proces.stdin.end();

  let stdout = "";
  let stderr = "";
  proces.stdout.on("data", (d) => {
    stdout += String(d);
  });
  proces.stderr.on("data", (d) => {
    stderr += String(d);
  });

  const beh = new Promise<VysledekProcesu>((hotovo, selhalo) => {
    proces.on("error", selhalo);
    proces.on("close", (kod) => hotovo({ kod, stdout, stderr }));
  });

  return { proces, beh };
}

/**
 * Ukončí proces i jeho případné potomky.
 *
 * Bez shellu už `proces.kill()` míří rovnou na `claude`, ne na `cmd.exe`
 * jako dřív (nález 4 závěrečné revize — s `shell: true` `kill()` ukončil
 * jen cmd.exe a osiřelý `claude` běžel dál, objednávka mezitím spadla do
 * `selhalo` a zámek se uvolnil). I tak si ale Claude Code může spouštět
 * vlastní podprocesy (nástroje) — na Windows je ukončí `taskkill /t`, který
 * zabije celý strom, ne jen kořen.
 */
function ukonciStrom(proces: ChildProcess): void {
  if (process.platform === "win32" && proces.pid !== undefined) {
    spawnSync("taskkill", ["/pid", String(proces.pid), "/t", "/f"]);
  } else {
    proces.kill();
  }
}

export async function spustCmuchala(v: {
  prompt: string;
  koren: string;
  stropMs: number;
}): Promise<VysledekSpusteni> {
  let spustitelny: string;
  try {
    spustitelny = zjistiSpustitelnyClaude();
  } catch (e) {
    return {
      ok: false,
      chyba: `Claude Code se nepodařilo najít (${e instanceof Error ? e.message : String(e)}). ` +
        `Je nainstalovaný a přihlášený na tomhle počítači?`,
    };
  }

  let spusteno: ReturnType<typeof spustSurovyProces>;
  try {
    spusteno = spustSurovyProces(spustitelny, sestavArgumenty(), {
      cwd: v.koren,
      prompt: v.prompt,
    });
  } catch (e) {
    return {
      ok: false,
      chyba: `Claude Code se nepodařilo spustit (${e instanceof Error ? e.message : String(e)}). ` +
        `Je nainstalovaný a přihlášený na tomhle počítači?`,
    };
  }

  const { proces, beh } = spusteno;

  return new Promise((hotovo) => {
    const casovac = setTimeout(() => {
      ukonciStrom(proces);
      hotovo({
        ok: false,
        chyba:
          `Čmuchal nedoběhl do ${Math.round(v.stropMs / 60_000)} minut a byl ukončen. ` +
          `Dávka mohla zůstat rozdělaná — firmy bez razítka půjdou znovu.`,
      });
    }, v.stropMs);

    beh
      .then((vysledek) => {
        clearTimeout(casovac);
        if (vysledek.kod === 0) {
          hotovo({ ok: true, chyba: null });
        } else {
          hotovo({
            ok: false,
            chyba:
              `Čmuchal skončil s chybou ${vysledek.kod}: ` +
              `${vysledek.stderr.slice(0, 500) || vysledek.stdout.slice(0, 500) || "bez výstupu"}`,
          });
        }
      })
      .catch((e: Error) => {
        clearTimeout(casovac);
        hotovo({
          ok: false,
          chyba: `Claude Code se nepodařilo spustit (${e.message}). Je nainstalovaný a přihlášený na tomhle počítači?`,
        });
      });
  });
}
