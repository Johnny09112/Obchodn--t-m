/**
 * Spuštění Čmuchala neinteraktivně.
 *
 * **Jediné místo v projektu, které spouští cizí proces.** Je oddělené proto,
 * aby šlo v testech nahradit — testovat se má výběr firem a stavy fronty,
 * ne to, že jde spustit Claude Code.
 *
 * Ověřeno 2026-08-06 na Claude Code 2.1.220: `-p` je neinteraktivní režim,
 * `--agent` vybere agenta z `.claude/agents/`, `--output-format json` vrátí
 * strojově čitelný výsledek.
 */
import { spawn } from "node:child_process";

export interface VysledekSpusteni {
  ok: boolean;
  chyba: string | null;
}

/**
 * Nástroje, které agent při rešerši dostane. Nic víc spustit nesmí.
 *
 * Z příkazové řádky jen dva příkazy: vzít si práci a zapsat nálezy. Oba
 * procházejí kontrolou, která vyžaduje zdroj a doslovnou citaci — proto na
 * nich nezáleží, co si model myslí.
 */
const POVOLENE_NASTROJE = [
  "WebSearch",
  "WebFetch",
  "Read",
  "Write",
  "Bash(npm run cli -- k-obohaceni*)",
  "Bash(npm run cli -- zapis-nalezy*)",
];

/** Strop: dvojnásobek naměřených 64 s na firmu, nejméně deset minut. */
export function stropMs(firem: number): number {
  return Math.max(600_000, firem * 128_000);
}

export async function spustCmuchala(v: {
  prompt: string;
  koren: string;
  stropMs: number;
}): Promise<VysledekSpusteni> {
  return new Promise((hotovo) => {
    const proces = spawn(
      "claude",
      [
        "-p",
        v.prompt,
        "--agent",
        "cmuchal",
        "--output-format",
        "json",
        "--allowedTools",
        ...POVOLENE_NASTROJE,
      ],
      { cwd: v.koren, shell: true },
    );

    let chyboryStdout = "";
    proces.stderr.on("data", (d) => {
      chyboryStdout += String(d);
    });

    const casovac = setTimeout(() => {
      proces.kill();
      hotovo({
        ok: false,
        chyba:
          `Čmuchal nedoběhl do ${Math.round(v.stropMs / 60_000)} minut a byl ukončen. ` +
          `Dávka mohla zůstat rozdělaná — firmy bez razítka půjdou znovu.`,
      });
    }, v.stropMs);

    proces.on("error", (e) => {
      clearTimeout(casovac);
      hotovo({
        ok: false,
        chyba:
          `Claude Code se nepodařilo spustit (${e.message}). ` +
          `Je nainstalovaný a přihlášený na tomhle počítači?`,
      });
    });

    proces.on("close", (kod) => {
      clearTimeout(casovac);
      if (kod === 0) hotovo({ ok: true, chyba: null });
      else
        hotovo({
          ok: false,
          chyba: `Čmuchal skončil s chybou ${kod}: ${chyboryStdout.slice(0, 500) || "bez výstupu"}`,
        });
    });
  });
}
