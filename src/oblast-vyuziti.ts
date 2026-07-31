/**
 * Co drží oblast naživu a jak to říct člověku.
 *
 * Čistý modul bez databáze — používá ho aplikace i příkazová řádka.
 * Ptát se databáze „proč to nešlo" až po neúspěšném smazání je pozdě:
 * chyba z Postgresu o porušení cizího klíče nikomu nic neřekne. Tohle
 * se zeptá dřív a odpoví jménem kampaně.
 */

export interface VyuzitiOblasti {
  /** Názvy kampaní, které oblast používají (i archivovaných). */
  kampane: string[];
  /** Kolik průzkumů se nad oblastí objednalo. */
  pruzkumu: number;
  /**
   * Firem v oblasti. Oblast to nedrží — je to odvozenina z tvaru a spočítá
   * se kdykoli znovu. Je to tu proto, aby šlo říct, o co se přijde.
   */
  firem: number;
}

/** „Jaro", „Podzim" a „Zima" — spojka před posledním, ne čárka. */
function vyjmenuj(nazvy: string[]): string {
  const v = nazvy.map((n) => `„${n}“`);
  if (v.length === 1) return v[0]!;
  return `${v.slice(0, -1).join(", ")} a ${v[v.length - 1]}`;
}

/** 1 průzkum · 2–4 průzkumy · 5+ průzkumů */
function oPruzkumech(n: number): string {
  if (n === 1) return "Objednal se nad ní průzkum.";
  if (n < 5) return `Objednaly se nad ní ${n} průzkumy.`;
  return `Objednalo se nad ní ${n} průzkumů.`;
}

/**
 * Věta o tom, co oblast drží naživu, nebo `null`, když ji nedrží nic
 * a jde smazat.
 */
export function drziOblast(v: VyuzitiOblasti): string | null {
  const vety: string[] = [];

  if (v.kampane.length === 1) {
    vety.push(`Používá ji kampaň ${vyjmenuj(v.kampane)}.`);
  } else if (v.kampane.length > 1) {
    vety.push(`Používají ji kampaně ${vyjmenuj(v.kampane)}.`);
  }

  if (v.pruzkumu > 0) vety.push(oPruzkumech(v.pruzkumu));

  return vety.length > 0 ? vety.join(" ") : null;
}
