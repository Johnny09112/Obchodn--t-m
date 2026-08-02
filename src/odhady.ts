/**
 * Odhady času, které se ukazují člověku před spuštěním práce.
 *
 * Čistý modul — sdílí ho aplikace i příkazová řádka.
 *
 * **Čísla jsou naměřená, ne odhadnutá.** Dřívější odhad „300 ms na firmu"
 * vycházel z prodlevy v kódu a byl vedle o řád; skutečnost změřená na dávce
 * 200 firem je 2,9 s. Kdo tohle číslo mění, ať ho změří znovu.
 */
import { cesky } from "./cestina.js";

/** Změřeno 2. 8. 2026: 200 firem za 576 s (MPSV zdarma, zbytek dotaz do ARESu). */
export const SEKUND_NA_FIRMU = 2.88;

/** Lidský odhad, jak dlouho potrvá doplnit kontakty u daného počtu firem. */
export function odhadKontaktu(firem: number): string {
  if (firem <= 0) return "žádný čas";

  const minut = Math.round((firem * SEKUND_NA_FIRMU) / 60);
  if (minut < 1) return "necelou minutu";
  // Od hodiny výš se mluví v hodinách — „zhruba 60 minut" nikdo neřekne.
  if (minut < 60) return `zhruba ${minut} ${cesky(minut, "minutu", "minuty", "minut")}`;

  const hodin = Math.round(minut / 60);
  if (hodin === 1) return "zhruba hodinu";
  return `zhruba ${hodin} ${cesky(hodin, "hodinu", "hodiny", "hodin")}`;
}
