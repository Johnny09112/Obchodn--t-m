import { supabase } from "./supabase";

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

const SLOUPCE_FIRMY =
  "ico,nazev,obec,lat,lng,velikost_kategorie,zamestnanci_odhad,kategorie,skore,stav,contacts(count)";

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
    .select("id,nazev,stav,spravce,zastupce,krok,oblast_id,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RadekKampane[];
}

export async function nactiLidi(): Promise<Clovek[]> {
  const { data, error } = await supabase.from("uzivatele").select("id,email").order("email");
  if (error) throw new Error(error.message);
  return (data ?? []) as Clovek[];
}
