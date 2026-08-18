/**
 * Knihovna tvrzení a šablon (SPEC kap. 6, session S0.5).
 *
 * Tvrzení je věta o službě, kterou umíme doložit. Šablona je kostra zprávy
 * se zástupnými údaji, které se doplní z kartotéky — a jen z doložených
 * údajů (TP-2, TP-3).
 *
 * **Proč se kontroluje při zápisu, a ne až při odesílání:** šablona se
 * schvaluje jednou a použije tisíckrát. Chyba v ní je tisíckrát dražší
 * než chyba v jedné zprávě, a při odesílání už na ni nikdo nekouká.
 */

import type { Db } from "./db.js";
import { zkontrolujZpravu } from "./styl-zpravy.js";
import { POVOLENE_ATRIBUTY } from "./whitelist.js";

/**
 * Zástupný údaj v šabloně.
 *
 * `zdroj` říká, odkud se hodnota bere. Údaje o firmě smějí pocházet jen
 * z whitelistu (TP-3); `dosah` a `jidelna` jsou naše vlastní čísla, ne
 * údaje o firmě, takže se whitelistu netýkají.
 *
 * `nahrada` má jen ten údaj, jehož absence má v českém dopise zavedené
 * a neztrapňující řešení. Ostatní jsou povinné: bez nich by ze zprávy
 * zbyla obecná věta, tedy přesně ten hromadný mail, kterému se vyhýbáme.
 */
export interface Slot {
  /** Odkud se hodnota bere — pro kontrolu whitelistu i pro hlášku majiteli. */
  zdroj: { druh: "atribut"; atribut: string } | { druh: "kontakt" } | { druh: "dosah" } | { druh: "jidelna" };
  povinny: boolean;
  /** Text, který se doplní, když údaj chybí. Jen u nepovinných. */
  nahrada?: string;
  /** Jak vypadá vyplněný slot — používá se ke kontrole stylu kostry. */
  priklad: string;
  /** Věta pro majitele v tabulce firem, když údaj chybí. */
  popisChybi: string;
}

/**
 * Rozhodl majitel 18. 8. 2026: jedna hlavní šablona, chybějící jméno se
 * nahradí „Dobrý den“, chybějící ostatní údaj firmu z kampaně vyřadí.
 */
export const SLOTY = {
  osloveni: {
    zdroj: { druh: "kontakt" },
    povinny: false,
    nahrada: "Dobrý den,",
    priklad: "Vážená paní Nováková,",
    popisChybi: "neznáme jméno — osloví se „Dobrý den“",
  },
  vzdalenost: {
    zdroj: { druh: "dosah" },
    povinny: true,
    priklad: "pár minut pěšky",
    popisChybi: "není spočítaná vzdálenost k jídelně",
  },
  od_vasi_firmy: {
    zdroj: { druh: "atribut", atribut: "obor" },
    povinny: true,
    priklad: "od Vaší truhlárny",
    popisChybi: "chybí obor — nevíme, jak firmu pojmenovat",
  },
  cena: {
    zdroj: { druh: "jidelna" },
    povinny: true,
    priklad: "cca 120 Kč",
    popisChybi: "u jídelny není vyplněná cena oběda",
  },
} satisfies Record<string, Slot>;

export type KodSlotu = keyof typeof SLOTY;

/** Vyhledání podle textu z šablony — kód odtud nemusí být známý. */
export function najdiSlot(kod: string): Slot | undefined {
  return (SLOTY as Record<string, Slot | undefined>)[kod];
}

/** Zástupné údaje, bez kterých se firma neosloví. */
export const POVINNE_SLOTY = Object.entries(SLOTY)
  .filter(([, s]) => s.povinny)
  .map(([kod]) => kod);

const SLOT_V_TEXTU = /\[([a-z_]+)\]/g;

export interface SablonaVstup {
  segment: string;
  kanal: string;
  predmet: string;
  telo: string;
  schvalenoKym: string;
  strukturaId?: string;
}

/** Doplní do kostry ukázkové hodnoty, aby šla zkontrolovat jako hotová zpráva. */
export function vyplnPriklady(telo: string): string {
  return telo.replace(SLOT_V_TEXTU, (cely, kod: string) => najdiSlot(kod)?.priklad ?? cely);
}

function zkontrolujSloty(telo: string): void {
  for (const [, kod] of telo.matchAll(SLOT_V_TEXTU)) {
    const slot = kod === undefined ? undefined : najdiSlot(kod);
    if (!slot) {
      throw new Error(
        `Neznámý zástupný údaj [${kod}]. Povolené: ${Object.keys(SLOTY).join(", ")}.`,
      );
    }
    if (slot.zdroj.druh === "atribut" && !POVOLENE_ATRIBUTY.includes(slot.zdroj.atribut as never)) {
      throw new Error(`Údaj [${kod}] čerpá z atributu „${slot.zdroj.atribut}“, který nesmí do zprávy (TP-3).`);
    }
  }
}

/**
 * Uloží šablonu jako novou verzi ve stavu „schváleno“.
 *
 * Verze se počítá zvlášť pro každý segment a kanál — starší verze zůstávají,
 * protože zpráva se odkazuje na tu, ze které vznikla (TP-13).
 */
export async function ulozSablonu(db: Db, s: SablonaVstup): Promise<number> {
  zkontrolujSloty(s.telo);

  const prohresky = zkontrolujZpravu(vyplnPriklady(s.telo), { predmet: s.predmet });
  if (prohresky.length > 0) {
    throw new Error(`Šablona neprošla kontrolou stylu:\n${prohresky.map((p) => `— ${p.detail}`).join("\n")}`);
  }

  const [radek] = await db.query<{ dalsi: number }>(
    "select coalesce(max(verze), 0) + 1 as dalsi from templates where segment = $1 and kanal = $2",
    [s.segment, s.kanal],
  );
  const dalsi = Number(radek?.dalsi ?? 1);

  await db.query(
    `insert into templates (verze, segment, kanal, predmet, telo, struktura_id, stav, schvaleno_kym, schvaleno_at)
     values ($1, $2, $3, $4, $5, $6, 'schvaleno', $7, now())`,
    [dalsi, s.segment, s.kanal, s.predmet, s.telo, s.strukturaId ?? null, s.schvalenoKym],
  );

  return Number(dalsi);
}

export interface Tvrzeni {
  tvrzeni: string;
  doklad: string;
}

/** Uloží tvrzení jako schválená. Opakované uložení téže věty nic nezaloží. */
export async function ulozTvrzeni(db: Db, tvrzeni: Tvrzeni[]): Promise<number> {
  let novych = 0;
  for (const t of tvrzeni) {
    const [existuje] = await db.query<{ id: string }>("select id from claims where tvrzeni = $1", [
      t.tvrzeni,
    ]);
    if (existuje) continue;

    await db.query(
      "insert into claims (tvrzeni, doklad, stav, schvaleno_at) values ($1, $2, 'schvaleno', now())",
      [t.tvrzeni, t.doklad],
    );
    novych++;
  }
  return novych;
}

export async function nactiSchvalenaTvrzeni(db: Db): Promise<Tvrzeni[]> {
  return db.query<Tvrzeni>(
    "select tvrzeni, doklad from claims where stav = 'schvaleno' order by schvaleno_at, tvrzeni",
  );
}
