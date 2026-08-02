/**
 * Doplnění velikosti firem ze statistického registru.
 *
 * **Proč to vzniklo:** sloupec `KATPO` je v souboru ČSÚ vyplněný u 93 %
 * subjektů a Čmuchal ho při sběru čte — ale zahodí. Do kartotéky se ukládala
 * velikost z ARESu, kde u běžného dotazu není. Výsledek: 12 630 z 12 762
 * plzeňských firem bez velikosti, přestože hodnota na disku existuje.
 *
 * **Doptat se ARESu nepomůže** — je to tentýž registr jinou cestou. Ověřeno
 * na 25 firmách, doplnil nulu (viz `ares-nedoplni-velikost` v paměti).
 *
 * Nic se nevymýšlí: „neuvedeno" i „bez zaměstnanců" nechávají hodnotu
 * prázdnou, protože ani jedno není velikostní segment (TP-2).
 */
import type { Db } from "./db.js";
import { KATEGORIE_PRACOVNIKU, segmentPodleKategorie } from "./res.js";
import { zapisAtribut } from "./repo.js";

/** Odkud se berou kategorie. Oddělené kvůli testům — registr má 541 MB. */
export interface ZdrojVelikosti {
  kategorie(): AsyncIterable<{ ico: string; kategorieKod: string }>;
  /** Odkaz do evidence (TP-2). */
  zdrojUrl: string;
}

export interface SouhrnVelikosti {
  /** Firem, kterým se velikost zapsala. */
  doplneno: number;
  /** Registr u nich velikost neuvádí. */
  neuvedeno: number;
  /** Registr říká „bez zaměstnanců" — není to segment. */
  bezZamestnancu: number;
  /** Velikost už měly, nepřepisuje se. */
  jizMela: number;
  /** Byly v registru, ale ne v kartotéce. */
  mimoKartoteku: number;
}

export async function doplnVelikosti(
  db: Db,
  zdroj: ZdrojVelikosti,
  opts: { oblastId?: string } = {},
): Promise<SouhrnVelikosti> {
  // Kartotéka se načte dopředu do paměti. Registr má miliony řádků a ptát se
  // databáze na každý z nich by znamenalo miliony dotazů; naopak IČO všech
  // firem se do paměti vejde snadno.
  const firmy = await db.query<{ ico: string; velikost: string | null }>(
    opts.oblastId
      ? `select c.ico, c.velikost_kategorie as velikost
         from oblast_firmy f join companies c on c.ico = f.ico
         where f.oblast_id = $1`
      : `select ico, velikost_kategorie as velikost from companies`,
    opts.oblastId ? [opts.oblastId] : [],
  );
  const zname = new Map(firmy.map((f) => [f.ico, f.velikost]));

  const s: SouhrnVelikosti = {
    doplneno: 0, neuvedeno: 0, bezZamestnancu: 0, jizMela: 0, mimoKartoteku: 0,
  };

  for await (const { ico, kategorieKod } of zdroj.kategorie()) {
    if (!zname.has(ico)) {
      s.mimoKartoteku++;
      continue;
    }
    if (zname.get(ico) !== null) {
      s.jizMela++;
      continue;
    }

    const segment = segmentPodleKategorie(kategorieKod);
    if (!segment) {
      // Rozlišuje se schválně: „bez zaměstnanců" je doložený fakt, kdežto
      // „neuvedeno" znamená, že registr mlčí. Pro rozhodování je to rozdíl.
      if (kategorieKod === "110") s.bezZamestnancu++;
      else s.neuvedeno++;
      continue;
    }

    const popis = KATEGORIE_PRACOVNIKU[kategorieKod]?.popis ?? kategorieKod;
    await zapisAtribut(db, ico, "velikost_kategorie", segment, {
      zdrojUrl: zdroj.zdrojUrl,
      citace: `statistický registr ČSÚ, kategorie počtu pracovníků: ${popis} zaměstnanců`,
    });
    // Ať druhý výskyt téhož IČO v registru neudělá druhý zápis.
    zname.set(ico, segment);
    s.doplneno++;
  }

  return s;
}
