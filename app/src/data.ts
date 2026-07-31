import { supabase } from "./supabase";
import type { Pravidlo } from "../../src/blacklist";

export interface Firma {
  ico: string;
  nazev: string;
  obec: string | null;
  lat: number | null;
  lng: number | null;
  velikost_kategorie: string | null;
  zamestnanci_odhad: number | null;
  kategorie: string | null;
  skore: number | null;
  stav: string;
  cz_nace: string[];
  pravni_forma: string | null;
  ma_vlastni_jidelnu: boolean | null;
  contacts: { count: number }[];
}

export interface Jidelna {
  id: string;
  nazev: string;
  obec: string | null;
  lat: number | null;
  lng: number | null;
  zona_metru: number;
  aktivni: boolean;
}

export interface Kategorie {
  kod: string;
  nazev: string;
}

/** Řádek tabulky `oblasti` tak, jak chodí z databáze. */
export interface RadekOblasti {
  id: string;
  nazev: string;
  typ: "kruh" | "polygon";
  stred_lat: number | null;
  stred_lng: number | null;
  polomer_m: number | null;
  body: { lat: number; lng: number }[] | null;
  jidelna_id: string | null;
  poznamka: string | null;
}

// `cz_nace`, `pravni_forma` a `ma_vlastni_jidelnu` potřebuje síto
// „koho vůbec chceme oslovit" (src/kvalifikace.ts) v kroku 2 průvodce.
const SLOUPCE_FIRMY =
  "ico,nazev,obec,lat,lng,velikost_kategorie,zamestnanci_odhad,kategorie,skore,stav," +
  "cz_nace,pravni_forma,ma_vlastni_jidelnu,contacts(count)";

/**
 * Načte všechny firmy najednou.
 *
 * Vejde se to do paměti — celá ČR má 35 tisíc firem nad 25 zaměstnanců —
 * a při kreslení oblasti se pak počítá bez dalšího dotazu do databáze,
 * takže počet firem ve tvaru naskakuje okamžitě.
 */
export async function nactiFirmy(): Promise<Firma[]> {
  const { data, error } = await supabase
    .from("companies")
    .select(SLOUPCE_FIRMY)
    .order("skore", { ascending: false, nullsFirst: false })
    .limit(50_000);
  if (error) throw new Error(error.message);
  return (data ?? []) as Firma[];
}

export async function nactiJidelny(): Promise<Jidelna[]> {
  const { data, error } = await supabase
    .from("jidelny")
    .select("id,nazev,obec,lat,lng,zona_metru,aktivni")
    .order("nazev");
  if (error) throw new Error(error.message);
  return (data ?? []) as Jidelna[];
}

export async function nactiKategorie(): Promise<Kategorie[]> {
  const { data, error } = await supabase.from("kategorie").select("kod,nazev").order("nazev");
  if (error) throw new Error(error.message);
  return (data ?? []) as Kategorie[];
}

export async function nactiOblasti(): Promise<RadekOblasti[]> {
  const { data, error } = await supabase
    .from("oblasti")
    .select("id,nazev,typ,stred_lat,stred_lng,polomer_m,body,jidelna_id,poznamka")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RadekOblasti[];
}

export function maSpojeni(f: Firma): boolean {
  return (f.contacts[0]?.count ?? 0) > 0;
}

/**
 * Velikostní segmenty podle SPEC kap. 10.2 — tři stupně, ne čtyři.
 * Původní škála mikro/malá/střední/velká padla migrací 0003; kdo ji tu
 * oživí, nabídne ve filtru hodnoty, které v datech nejsou.
 */
export const VELIKOSTI = ["mikro", "stredni", "korporat"] as const;

export const POPIS_VELIKOSTI: Record<string, string> = {
  mikro: "mikropodnik",
  stredni: "střední",
  korporat: "korporát",
};

export const POPIS_STAVU: Record<string, { popis: string; trida: string }> = {
  novy: { popis: "nová", trida: "je-novy" },
  kvalifikovany: { popis: "kvalifikovaná", trida: "je-kvalifikovany" },
  cekajici_na_jidelnu: { popis: "čeká na jídelnu", trida: "je-ceka" },
  zamitnuty: { popis: "zamítnutá", trida: "je-zamitnuty" },
  osloveny: { popis: "oslovená", trida: "je-jinak" },
  jednani: { popis: "jednání", trida: "je-jinak" },
  zakaznik: { popis: "zákazník", trida: "je-kvalifikovany" },
};

// ─────────────────────────────────────────────────────────────── kampaně

/** Řádek tabulky `kampane` tak, jak chodí z databáze. */
export interface RadekKampane {
  id: string;
  nazev: string;
  stav: string;
  spravce: string;
  zastupce: string | null;
  krok: number;
  oblast_id: string | null;
  archivovana_at: string | null;
  updated_at: string;
}

/** Člověk s přístupem do aplikace — pro výběr zástupu. */
export interface Clovek {
  id: string;
  email: string;
}

/**
 * Stavy kampaně pro člověka.
 *
 * Třídy jsou schválně ty, které už aplikace má: každý stav se liší tvarem
 * značky i barvou, ne jen barvou. Vymýšlet pro kampaně vlastní sadu by
 * znamenalo dva slovníky tvarů v jedné aplikaci.
 */
export const POPIS_STAVU_KAMPANE: Record<string, { popis: string; trida: string }> = {
  rozpracovana: { popis: "rozpracovaná", trida: "je-novy" },
  ceka_na_pruzkum: { popis: "čeká na průzkum", trida: "je-ceka" },
  k_posouzeni: { popis: "k posouzení", trida: "je-jinak" },
  schvalena: { popis: "schválená", trida: "je-kvalifikovany" },
  zrusena: { popis: "zrušená", trida: "je-zamitnuty" },
};

export async function nactiKampane(): Promise<RadekKampane[]> {
  const { data, error } = await supabase
    .from("kampane")
    .select("id,nazev,stav,spravce,zastupce,krok,oblast_id,archivovana_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RadekKampane[];
}

export async function nactiLidi(): Promise<Clovek[]> {
  const { data, error } = await supabase.from("uzivatele").select("id,email").order("email");
  if (error) throw new Error(error.message);
  return (data ?? []) as Clovek[];
}

/**
 * Podklady pro síto „koho vůbec chceme oslovit" (`duvodNeoslovovat`).
 *
 * Blacklist i partnerská IČO se načtou jednou pro celý přepočet — stejně
 * jako je načítá sběr Čmuchala.
 */
export async function nactiPravidlaSita(): Promise<{
  blacklist: Pravidlo[];
  partnerskaIca: Set<string>;
}> {
  const [b, j] = await Promise.all([
    supabase.from("blacklist").select("typ,hodnota,duvod"),
    supabase.from("jidelny").select("ico"),
  ]);
  if (b.error) throw new Error(b.error.message);
  if (j.error) throw new Error(j.error.message);

  return {
    blacklist: (b.data ?? []) as Pravidlo[],
    partnerskaIca: new Set(
      (j.data ?? [])
        .map((x) => (x as { ico: string | null }).ico)
        .filter((x): x is string => !!x),
    ),
  };
}

/**
 * Uklidí kampaň z přehledu, nebo ji vrátí zpátky. Nic se nemaže.
 *
 * Pravidlo přístupu zamítne zápis MLČKY — Supabase nevrátí chybu, jen změní
 * nula řádků. Bez téhle kontroly by tlačítko u cizí kampaně jen zablikalo
 * a nic neudělalo, což vypadá jako porucha.
 */
export async function archivujKampan(id: string, archivovat: boolean): Promise<void> {
  const { data, error } = await supabase
    .from("kampane")
    .update({ archivovana_at: archivovat ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "Kampaň se nepodařilo uklidit — patří někomu jinému. Upravovat ji smí správce, jeho zástup a admin.",
    );
  }
}

/**
 * Nevratné smazání. Databáze ho pustí jen adminovi a jen u kampaně, která
 * nikdy neběžela; po smazané kampani zůstane záznam v `smazane_kampane`.
 *
 * Když pravidlo přístupu zápis odmítne, Supabase nevrátí chybu — jen smaže
 * nula řádků. Proto se počítají, ne kontroluje `error`.
 */
export async function smazKampan(id: string): Promise<void> {
  const { data, error } = await supabase.from("kampane").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "Smazání neprošlo. Mazat smí jen admin, a jen kampaň, ze které ještě nic neodešlo.",
    );
  }
}
