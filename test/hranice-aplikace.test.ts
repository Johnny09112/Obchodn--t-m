import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Hranice mezi jádrem a webovou aplikací.
 *
 * Aplikace si z `src/` bere jen pár sdílených výpočtů. Nesmí si přes ně
 * přitáhnout `db.ts` — ten sahá na ovladače PGlite a Postgresu, které
 * **Vercel neinstaluje** (`installCommand: npm install --prefix app`), takže
 * sestavení spadne na `Cannot find module '@electric-sql/pglite'`.
 *
 * Doma se to nepozná: kořenové závislosti tady jsou a rozlišování jde nahoru.
 * Právě proto to jednou proklouzlo a nasazení padalo celou etapu B, aniž by
 * si toho kdokoli všiml.
 */

// `fileURLToPath`, ne `.pathname` — cesta projektu má v názvu diakritiku
// a ta je v adrese zakódovaná (`Obchodn%C3%AD-t%C3%BDm`).
const KOREN = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Moduly, které se do prohlížeče dostat NESMÍ, protože sahají na databázi. */
const ZAKAZANE = ["db", "repo"];

async function souboryAplikace(): Promise<string[]> {
  const adresar = join(KOREN, "app", "src");
  const jmena = await readdir(adresar);
  return jmena
    .filter((j) => j.endsWith(".ts") || j.endsWith(".tsx"))
    .map((j) => join(adresar, j));
}

/** Které moduly z `src/` daný soubor importuje. */
async function importyZJadra(cesta: string): Promise<string[]> {
  const obsah = await readFile(cesta, "utf8");
  const nalezy = [...obsah.matchAll(/from\s+"(?:\.\.\/)+src\/([\w-]+)(?:\.js)?"/g)];
  return nalezy.map((m) => m[1]!);
}

/** Které moduly z `src/` importuje modul jádra (i typově). */
async function importyModulu(modul: string): Promise<string[]> {
  const obsah = await readFile(join(KOREN, "src", `${modul}.ts`), "utf8");
  const nalezy = [...obsah.matchAll(/from\s+"\.\/([\w-]+)\.js"/g)];
  return nalezy.map((m) => m[1]!);
}

/** Projde import za importem a vrátí všechno, na co se dá z modulu dojít. */
async function dosahne(start: string): Promise<Set<string>> {
  const videno = new Set<string>();
  const fronta = [start];
  while (fronta.length > 0) {
    const m = fronta.pop()!;
    if (videno.has(m)) continue;
    videno.add(m);
    for (const dalsi of await importyModulu(m)) fronta.push(dalsi);
  }
  return videno;
}

describe("hranice mezi jádrem a aplikací", () => {
  it("aplikace si nepřitáhne databázi ani přes další moduly", async () => {
    const soubory = await souboryAplikace();
    const problemy: string[] = [];

    for (const soubor of soubory) {
      for (const modul of await importyZJadra(soubor)) {
        const dosazitelne = await dosahne(modul);
        for (const zakazany of ZAKAZANE) {
          if (dosazitelne.has(zakazany)) {
            problemy.push(
              `${soubor.split(/[\\/]/).pop()} → src/${modul} → … → src/${zakazany}`,
            );
          }
        }
      }
    }

    // Kdyby to padlo: nepřidávej závislost do app/package.json. Vyřízni
    // čistou část do modulu bez databáze (vzor: src/sito.ts).
    expect(problemy).toEqual([]);
  });

  it("síto je čisté — nesahá na nic z databáze", async () => {
    // `sito.ts` je jediné pravidlo jádra, které běží i v prohlížeči.
    // Kdyby přestalo být čisté, spadne sestavení aplikace, ne testy jádra.
    const dosazitelne = await dosahne("sito");
    expect([...dosazitelne].sort()).toEqual(["formy", "nace", "sito"]);
  });
});
