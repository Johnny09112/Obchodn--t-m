/**
 * Načtení `.env`.
 *
 * Proč vlastní kód a ne knihovna: potřebujeme z toho jediné — aby se
 * kontaktní e-mail pro mapovou službu a případná `DATABASE_URL` nemusely
 * psát ke každému příkazu. Kvůli deseti řádkům nemá smysl brát závislost.
 *
 * Hodnoty z prostředí mají přednost před souborem: když někdo proměnnou
 * vysloveně nastaví u příkazu, musí vyhrát nad tím, co leží v souboru.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Rozebere obsah `.env` na dvojice. Nezná víceřádkové hodnoty — nepotřebujeme je. */
export function rozeberEnv(obsah: string): Record<string, string> {
  const hodnoty: Record<string, string> = {};
  for (const radek of obsah.split(/\r?\n/)) {
    const text = radek.trim();
    if (!text || text.startsWith("#")) continue;

    const delitko = text.indexOf("=");
    if (delitko < 1) continue;

    const klic = text.slice(0, delitko).trim();
    let hodnota = text.slice(delitko + 1).trim();
    // Uvozovky se používají kvůli mezerám; do hodnoty samotné nepatří.
    if (hodnota.length >= 2 && /^["']/.test(hodnota) && hodnota.at(-1) === hodnota[0]) {
      hodnota = hodnota.slice(1, -1);
    }
    hodnoty[klic] = hodnota;
  }
  return hodnoty;
}

/**
 * Kde soubor s nastavením leží. **Schválně mimo pracovní složku projektu.**
 *
 * Důvod je bezpečnostní, ne kosmetický. Čmuchal běží bez dozoru v této složce
 * a celý den čte cizí weby, tedy neověřený obsah. Ověřeno živým pokusem
 * 6. 8. 2026: omezení `--allowedTools` čtení souborů **neomezuje** (s povoleným
 * čtením jediného souboru agent přesto přečetl jiný a vrátil jeho přesnou
 * délku) a zákaz čtení `.env` nezabral ani prostým jménem, ani s hvězdičkovým
 * vzorem. Jediná spolehlivá obrana je tajemství tam prostě nemít.
 *
 * Přebít to jde proměnnou `CANTINERO_ENV` — hodí se pro druhý projekt nebo
 * při zkoušení.
 */
export function vychoziCestaEnv(): string {
  return process.env.CANTINERO_ENV ?? join(homedir(), ".cantinero", ".env");
}

/**
 * Doplní do `process.env` to, co v něm ještě není. Chybějící soubor nevadí.
 *
 * Když soubor mimo repozitář není, ale v pracovní složce leží staré `.env`,
 * načte se **a nahlas se na to upozorní**. Tiché převzetí by znamenalo, že
 * si nikdo přesunu nevšimne a tajemství tam zůstane ležet.
 */
export function nactiEnv(cesta = vychoziCestaEnv()): void {
  let obsah: string;
  try {
    obsah = readFileSync(cesta, "utf8");
  } catch {
    try {
      obsah = readFileSync(".env", "utf8");
      console.warn(
        `Pozor: nastavení se načetlo z .env v pracovní složce projektu.\n` +
          `  Přesuň ho do ${vychoziCestaEnv()} — na tenhle soubor dosáhne agent,\n` +
          `  který tu běží bez dozoru.`,
      );
    } catch {
      return;
    }
  }
  for (const [klic, hodnota] of Object.entries(rozeberEnv(obsah))) {
    if (hodnota !== "" && process.env[klic] === undefined) process.env[klic] = hodnota;
  }
}
