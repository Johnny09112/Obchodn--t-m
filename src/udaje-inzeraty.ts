/**
 * Doplnění směnnosti a stravovacího benefitu z otevřených dat úřadu práce.
 *
 * **Proč to nejde přes „doplnit kontakty":** ta cesta prochází jen firmy
 * BEZ jmenného kontaktu — jakmile firma kontakt má, přeskočí se, a s ní
 * i její směnnost. Po velké dávce rešerše má kontakt většina firem, takže
 * by se údaj nedoplnil skoro nikomu. (Zjištěno 13. 8. 2026 poté, co jsem
 * to majiteli chybně slíbil právě tou cestou.)
 *
 * Tenhle běh jde napříč firmami bez ohledu na kontakty. Nestahuje nic
 * nového — čte index, který už na disku je.
 *
 * SPEC kap. 5.3 pracovní inzeráty pro sběr povoluje; do zprávy se z nich
 * nedostane nic (`do_zpravy = false`).
 */
import type { Db } from "./db.js";
import { zaznamenejObjem } from "./hlidac.js";
import { udajeZInzeratu } from "./inzeraty.js";
import type { MpsvKlient } from "./mpsv.js";
import { ukonciBeh, zacniBeh, zapisAtribut } from "./repo.js";

const ZDROJ_MPSV = "https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json";

export interface DoplnUdajeSouhrn {
  behId: string;
  zpracovano: number;
  /** Firem, kterým se něco doplnilo. */
  sNalezem: number;
  /** Kolik údajů celkem přibylo (firma jich může dostat víc). */
  udaju: number;
  chyby: Array<{ kdo: string; chyba: string }>;
}

export async function doplnUdajeZInzeratu(
  deps: { db: Db; mpsv: MpsvKlient },
  opts: { limit?: number; jenKvalifikovane?: boolean } = {},
): Promise<DoplnUdajeSouhrn> {
  const { db, mpsv } = deps;

  // Firmy, které údaj z inzerátů ještě nemají. Kdo ho má, se přeskakuje —
  // opakovaný běh tak nestojí nic a dá se pouštět pravidelně.
  const firmy = await db.query<{ ico: string; nazev: string }>(
    `select c.ico, c.nazev from companies c
     where ${opts.jenKvalifikovane ? "c.stav = 'kvalifikovany'" : "c.stav <> 'zamitnuty'"}
       and not exists (
         select 1 from evidence e
         where e.ico = c.ico and e.atribut in ('smenny_provoz','zpusob_stravovani')
           and e.zdroj_url like '%data.mpsv.cz%'
       )
     order by c.skore desc nulls last
     ${opts.limit ? `limit ${Number(opts.limit)}` : ""}`,
  );

  const behId = await zacniBeh(db, "udaje-z-inzeratu", { firem: firmy.length });
  const souhrn: DoplnUdajeSouhrn = {
    behId, zpracovano: 0, sNalezem: 0, udaju: 0, chyby: [],
  };

  try {
    for (const f of firmy) {
      souhrn.zpracovano++;
      try {
        const z = await mpsv.udajeZamestnavatele(f.ico);
        if (!z) continue;
        const udaje = udajeZInzeratu(z);
        if (udaje.length === 0) continue;
        for (const u of udaje) {
          await zapisAtribut(db, f.ico, u.atribut, u.hodnota, {
            zdrojUrl: ZDROJ_MPSV,
            citace: u.citace,
          });
          souhrn.udaju++;
        }
        souhrn.sNalezem++;
      } catch (e) {
        souhrn.chyby.push({
          kdo: `${f.nazev} (${f.ico})`,
          chyba: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } finally {
    // Hlídač měří, kolika firmám se něco doplnilo. Nula po ustálených
    // bězích znamená rozbitý index, ne že firmy přestaly inzerovat.
    try {
      const h = await zaznamenejObjem(db, "udaje-z-inzeratu", souhrn.sNalezem);
      if (h.duvod) souhrn.chyby.push({ kdo: "hlídač zdrojů", chyba: h.duvod });
    } catch {
      // Hlídač nesmí shodit běh, který jinak proběhl v pořádku.
    }
    const { chyby, ...vystup } = souhrn;
    await ukonciBeh(db, behId, vystup, chyby, 0);
  }

  return souhrn;
}
