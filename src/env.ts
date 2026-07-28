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

/** Doplní do `process.env` to, co v něm ještě není. Chybějící soubor nevadí. */
export function nactiEnv(cesta = ".env"): void {
  let obsah: string;
  try {
    obsah = readFileSync(cesta, "utf8");
  } catch {
    return;
  }
  for (const [klic, hodnota] of Object.entries(rozeberEnv(obsah))) {
    if (hodnota !== "" && process.env[klic] === undefined) process.env[klic] = hodnota;
  }
}
