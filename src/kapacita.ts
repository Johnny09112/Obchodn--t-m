/**
 * Součet volné kapacity jídelen.
 *
 * Bez závislostí schválně — počítá se stejně v příkazové řádce
 * (kartotéka, mapa) i v aplikaci (obrazovka Jídelny). Kdyby to byly dvě
 * kopie, rozešly by se a majitel by viděl dvě různá čísla o tomtéž.
 * Aplikace tenhle soubor importuje přímo, proto tu nesmí přibýt import
 * `db.ts` ani nic z něj (Vercel instaluje jen závislosti `app/`).
 */

export type StavJidelny = "v_provozu" | "priprava";

export interface JidelnaKapacita {
  /** `null` = neuvedeno. NENÍ to nula — nula tvrdí, že jídelna nemá volno. */
  kapacita_volna: number | null;
  stav: StavJidelny;
  aktivni: boolean;
}

export interface SoucetKapacit {
  /** Obědy, které můžeme prodat dnes. */
  vProvozu: number;
  /** Obědy, které budeme mít, až se jídelna rozjede — potenciál, ne příslib. */
  priprava: number;
  /** Kolika jídelnám v provozu i v přípravě kapacita chybí. */
  bezUdaje: number;
}

export function soucetKapacit(jidelny: JidelnaKapacita[]): SoucetKapacit {
  // Jídelna mimo provoz nepatří do žádného ze součtů — nenabízí nic dnes
  // ani výhledově.
  return jidelny
    .filter((j) => j.aktivni)
    .reduce<SoucetKapacit>(
      (s, j) => {
        if (j.kapacita_volna === null) return { ...s, bezUdaje: s.bezUdaje + 1 };
        return j.stav === "priprava"
          ? { ...s, priprava: s.priprava + j.kapacita_volna }
          : { ...s, vProvozu: s.vProvozu + j.kapacita_volna };
      },
      { vProvozu: 0, priprava: 0, bezUdaje: 0 },
    );
}
