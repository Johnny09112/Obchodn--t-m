/**
 * Parametry nabídky — co o prodávané věci sledujeme.
 *
 * Definice visí na produktu (`produkt_kod`), hodnoty na konkrétní nabídce.
 * Hodnota je vždy text; převod na číslo nebo seznam dělá tenhle modul
 * podle druhu parametru.
 *
 * **Parametr popisuje naši nabídku, ne oslovovanou firmu.** Údaj o cizí
 * firmě sem nepatří — ten smí do zprávy jen se záznamem v `evidence`,
 * zdrojem a doslovnou citací (TP-2, TP-3). Kdyby šlo obojí zadávat na
 * jednom místě, dřív nebo později by do mailu odešlo tvrzení o firmě,
 * které nikdo nedoložil.
 *
 * Zadání: docs/superpowers/specs/2026-08-18-nastaveni-zpravy-design.md
 */

import type { Db } from "./db.js";

export type DruhParametru = "cislo" | "text" | "ano_ne" | "vyber";

export interface ParametrNabidky {
  id: string;
  produktKod: string;
  kod: string;
  nazev: string;
  druh: DruhParametru;
  jednotka: string | null;
  moznosti: string[];
  poradi: number;
}

interface RadekParametru {
  id: string;
  produkt_kod: string;
  kod: string;
  nazev: string;
  druh: DruhParametru;
  jednotka: string | null;
  moznosti: string[] | null;
  poradi: number;
}

function naParametr(x: RadekParametru): ParametrNabidky {
  return {
    id: x.id,
    produktKod: x.produkt_kod,
    kod: x.kod,
    nazev: x.nazev,
    druh: x.druh,
    jednotka: x.jednotka,
    moznosti: x.moznosti ?? [],
    poradi: x.poradi,
  };
}

export async function nactiParametry(db: Db, produktKod: string): Promise<ParametrNabidky[]> {
  const r = await db.query<RadekParametru>(
    `select id, produkt_kod, kod, nazev, druh, jednotka, moznosti, poradi
       from parametry_nabidky where produkt_kod = $1 order by poradi, nazev`,
    [produktKod],
  );
  return r.map(naParametr);
}

/**
 * Hodnoty pod **kódem** parametru — volající tady pracuje s kódem, ne s id.
 *
 * Pozor: aplikace má vlastní `nactiHodnotyNabidky`, která je vrací pod
 * **id**, protože je potřebuje k zápisu. Není to nedopatření, ale dvě
 * různé potřeby dvou vrstev.
 */
export async function nactiHodnoty(db: Db, nabidkaId: string): Promise<Record<string, string>> {
  const r = await db.query<{ kod: string; hodnota: string }>(
    `select p.kod, h.hodnota
       from hodnoty_parametru h
       join parametry_nabidky p on p.id = h.parametr_id
      where h.nabidka_id = $1`,
    [nabidkaId],
  );
  return Object.fromEntries(r.map((x) => [x.kod, x.hodnota]));
}

/**
 * Seznam voleb se ukládá jako JSON pole. Oddělovač čárkou by se rozbil
 * na volbě, která čárku obsahuje — a to se pozná až u zákazníka.
 */
export function zeSeznamu(volby: string[]): string {
  return JSON.stringify(volby);
}

export function naSeznam(hodnota: string): string[] {
  if (hodnota.trim() === "") return [];
  try {
    const x: unknown = JSON.parse(hodnota);
    return Array.isArray(x) ? x.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Vrátí větu pro člověka, nebo `null`, když je hodnota v pořádku.
 *
 * **Tohle je pohodlí, ne záruka.** Zárukou je spoušť
 * `zkontroluj_hodnotu_parametru` v databázi (migrace 0046) — obrazovka
 * Jídelny zapisuje do Supabase přímo a na tenhle modul nedosáhne, takže
 * kontrola jen tady by ji nechala bez pojistky. Ověřeno bolestivě:
 * 18. 8. 2026 se přes obrazovku uložila cena −5 Kč.
 *
 * Smysl má dál: příkazová řádka díky ní selže dřív a s touž větou.
 */
export function zkontrolujHodnotu(p: ParametrNabidky, hodnota: string): string | null {
  switch (p.druh) {
    case "cislo": {
      const n = Number(hodnota.replace(",", ".").trim());
      if (hodnota.trim() === "" || Number.isNaN(n)) {
        return `„${p.nazev}" má být číslo, ne „${hodnota}".`;
      }
      if (n < 0) return `„${p.nazev}" nemůže být záporné.`;
      return null;
    }
    case "ano_ne":
      return hodnota === "ano" || hodnota === "ne"
        ? null
        : `„${p.nazev}" je ano, nebo ne — ne „${hodnota}".`;
    case "vyber": {
      const cizi = naSeznam(hodnota).filter((v) => !p.moznosti.includes(v));
      return cizi.length === 0
        ? null
        : `„${p.nazev}" nezná volbu ${cizi.map((v) => `„${v}"`).join(", ")}.`;
    }
    case "text":
      return hodnota.length <= 200 ? null : `„${p.nazev}" má být kratší než 200 znaků.`;
  }
}

/**
 * Uloží hodnotu parametru u nabídky. Opakované uložení hodnotu přepíše —
 * historie se tu nevede, je to současný stav dohody s partnerem.
 */
export async function ulozHodnotu(
  db: Db,
  nabidkaId: string,
  kod: string,
  hodnota: string,
): Promise<void> {
  const [radek] = await db.query<RadekParametru>(
    `select p.id, p.produkt_kod, p.kod, p.nazev, p.druh, p.jednotka, p.moznosti, p.poradi
       from parametry_nabidky p
       join nabidky n on n.produkt_kod = p.produkt_kod
      where n.id = $1 and p.kod = $2`,
    [nabidkaId, kod],
  );
  if (!radek) throw new Error(`Nabídka nezná parametr „${kod}".`);

  const p = naParametr(radek);
  const vytka = zkontrolujHodnotu(p, hodnota);
  if (vytka) throw new Error(vytka);

  await db.query(
    `insert into hodnoty_parametru (nabidka_id, parametr_id, hodnota)
     values ($1, $2, $3)
     on conflict (nabidka_id, parametr_id)
       do update set hodnota = excluded.hodnota, zmeneno_at = now()`,
    [nabidkaId, p.id, hodnota],
  );
}

export interface NovyParametr {
  produktKod: string;
  nazev: string;
  druh: DruhParametru;
  jednotka?: string;
  moznosti?: string[];
}

/**
 * Kód se odvodí z názvu, aby ho nikdo nemusel vymýšlet. Diakritika pryč —
 * kód se objeví v šabloně jako `[rozvoz_zdarma_od]` a tam se hodí něco,
 * co jde napsat na každé klávesnici.
 */
export function kodZNazvu(nazev: string): string {
  return nazev
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Zavede nový parametr produktu. Vrací jeho id.
 *
 * Pořadí se dopočítá na konec — nově zavedený parametr patří pod ty, které
 * už majitel zná, ne mezi ně.
 */
export async function zavedParametr(db: Db, v: NovyParametr): Promise<string> {
  const kod = kodZNazvu(v.nazev);
  if (kod === "") {
    throw new Error("Název parametru musí obsahovat aspoň jedno písmeno nebo číslici.");
  }

  const moznosti = v.moznosti ?? [];
  if (v.druh === "vyber" && moznosti.length === 0) {
    throw new Error("Výběr z možností potřebuje aspoň jednu možnost.");
  }

  const [uz] = await db.query<{ id: string }>(
    "select id from parametry_nabidky where produkt_kod = $1 and kod = $2",
    [v.produktKod, kod],
  );
  if (uz) throw new Error(`Parametr „${v.nazev}" už existuje.`);

  // Přísné indexování tvrdí, že `r[0]` může chybět — proto přes proměnnou.
  const [radekPoradi] = await db.query<{ dalsi: number }>(
    "select coalesce(max(poradi), 0) + 1 as dalsi from parametry_nabidky where produkt_kod = $1",
    [v.produktKod],
  );
  const dalsi = Number(radekPoradi?.dalsi ?? 1);

  const [novy] = await db.query<{ id: string }>(
    `insert into parametry_nabidky (produkt_kod, kod, nazev, druh, jednotka, moznosti, poradi)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [v.produktKod, kod, v.nazev.trim(), v.druh, v.jednotka ?? null, moznosti, dalsi],
  );
  if (!novy) throw new Error("Parametr se nepodařilo zavést.");
  return novy.id;
}
