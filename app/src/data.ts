import { supabase } from "./supabase";
import type { Pravidlo } from "../../src/sito";
import { duvodNeoslovovat } from "../../src/sito";
import type { VyuzitiOblasti } from "../../src/oblast-vyuziti";

export type { VyuzitiOblasti };

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
/** Po kolika řádcích se čte. Server stejně víc než tisíc najednou nedá. */
const STRANKA = 1000;

export async function nactiFirmy(): Promise<Firma[]> {
  // POZOR: `.limit()` tu nestačí. Server má vlastní strop na počet řádků
  // (výchozí tisíc) a ten klientský limit přebije — MLČKY, bez chyby.
  // Kartotéka pak tiše ukazovala 1 000 firem z 13 767 a počty v mapě
  // i v kampani byly nižší, než měly být. Proto se čte po stránkách.
  const vse: Firma[] = [];
  for (let od = 0; ; od += STRANKA) {
    const { data, error } = await supabase
      .from("companies")
      .select(SLOUPCE_FIRMY)
      .order("ico")
      .range(od, od + STRANKA - 1);
    if (error) throw new Error(error.message);

    const davka = (data ?? []) as unknown as Firma[];
    vse.push(...davka);
    if (davka.length < STRANKA) break;
  }

  // Třídění až tady: přes stránky by ho server stejně neudržel.
  return vse.sort((a, b) => (b.skore ?? -1) - (a.skore ?? -1));
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

/**
 * Zjistí, co oblast drží naživu — kvůli hlášce dřív, než se maže.
 *
 * Kampaně se berou včetně archivovaných: archiv je jen úklid z přehledu,
 * kampaň pořád existuje a na oblast se odkazuje.
 */
export async function zjistiVyuzitiOblasti(id: string): Promise<VyuzitiOblasti> {
  const [k, p, f] = await Promise.all([
    supabase.from("kampane").select("nazev").eq("oblast_id", id),
    supabase.from("pruzkumy").select("id", { count: "exact", head: true }).eq("oblast_id", id),
    supabase
      .from("oblast_firmy")
      .select("ico", { count: "exact", head: true })
      .eq("oblast_id", id),
  ]);
  const chyba = k.error ?? p.error ?? f.error;
  if (chyba) throw new Error(chyba.message);
  return {
    kampane: (k.data ?? []).map((x) => x.nazev as string),
    pruzkumu: p.count ?? 0,
    firem: f.count ?? 0,
  };
}

/**
 * Smaže oblast i s jejím seznamem firem.
 *
 * Databáze to pustí jen adminovi (pravidlo `oblasti_mazani`) a jen u oblasti,
 * kterou nedrží kampaň ani průzkum (cizí klíče, migrace 0028). Obojí se tedy
 * nedá obejít z prohlížeče; tady se to jen převádí na větu pro člověka.
 */
export async function smazOblast(id: string): Promise<void> {
  const { data, error } = await supabase.from("oblasti").delete().eq("id", id).select("id");
  if (error) {
    // Hláška Postgresu o porušení cizího klíče nikomu nic neřekne.
    throw new Error(
      "Oblast se smazat nedá — drží ji kampaň nebo objednaný průzkum. " +
        "Zmizel by s ní i doklad o tom, jaké území se kdy analyzovalo.",
    );
  }
  if (!data || data.length === 0) {
    throw new Error("Smazání neprošlo. Mazat oblasti smí jen správce.");
  }
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

// ────────────────────────────────────────────────── průzkum pro kampaň

/** Objednávka průzkumu pro kampaň i s postupem po obcích. */
export interface StavPruzkumu {
  id: string;
  stav: string;
  urgentni: boolean;
  useky: { stav: string; obec: string }[];
  /** Jak dlouho objednávka běží nebo čeká, v minutách. */
  bezPredMinutami: number;
  /** Obec, která se právě zpracovává. */
  bezicíObec: string | null;
  /** Oblast jiného průzkumu, který drží frontu — běží jen jeden naráz. */
  blokujeJiny: string | null;
}

type RadekPruzkumu = {
  id: string;
  stav: string;
  urgentni: boolean;
  pozadano_at: string;
  pruzkum_useky: { stav: string; obec: string }[];
};

export async function nactiPruzkumKampane(kampanId: string): Promise<StavPruzkumu | null> {
  const { data, error } = await supabase
    .from("pruzkumy")
    .select("id,stav,urgentni,pozadano_at,pruzkum_useky(stav,obec)")
    .eq("kampan_id", kampanId)
    .order("pozadano_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);

  const r = (data?.[0] as RadekPruzkumu | undefined) ?? null;
  if (!r) return null;

  const useky = r.pruzkum_useky ?? [];
  const minuty = Math.max(
    0,
    Math.round((Date.now() - new Date(r.pozadano_at).getTime()) / 60000),
  );

  // Když objednávka ještě nezačala, zjisti, jestli frontu nedrží jiná.
  // Bez toho člověk kouká na „čeká" a netuší, na co se vlastně čeká.
  let blokujeJiny: string | null = null;
  if (useky.length === 0 && (r.stav === "ceka" || r.stav === "bezi")) {
    const jine = await supabase
      .from("pruzkumy")
      .select("oblasti(nazev)")
      .eq("stav", "bezi")
      .neq("id", r.id)
      .limit(1);
    const prvni = jine.data?.[0] as { oblasti: { nazev: string } | null } | undefined;
    blokujeJiny = prvni?.oblasti?.nazev ?? null;
  }

  return {
    id: r.id,
    stav: r.stav,
    urgentni: r.urgentni,
    useky,
    bezPredMinutami: minuty,
    bezicíObec: useky.find((u) => u.stav === "bezi")?.obec ?? null,
    blokujeJiny,
  };
}

/**
 * Za kolik minut se hlídka podívá do fronty.
 *
 * Řádné běhy v 8:00, 13:00 a 19:00; urgentní objednávky každých 10 minut
 * (viz `skripty/cmuchal-hlidka.ps1`). Je to odhad podle rozvrhu, ne dotaz
 * na hlídku — ta o sobě nedává vědět a při vypnutém počítači neběží vůbec.
 */
export function dalsiBehZa(urgentni: boolean, ted: Date = new Date()): number {
  if (urgentni) return 10 - (ted.getMinutes() % 10);
  const okna = [8, 13, 19];
  const minutyDne = ted.getHours() * 60 + ted.getMinutes();
  for (const h of okna) {
    if (h * 60 > minutyDne) return h * 60 - minutyDne;
  }
  return 24 * 60 - minutyDne + okna[0]! * 60;
}

/**
 * Objedná průzkum. **Agenta to nespustí** — aplikace na počítač, kde Čmuchal
 * běží, nedosáhne. Objednávka jen čeká ve frontě, kterou si hlídka vyzvedne.
 */
export async function objednejPruzkumZAplikace(
  kampanId: string,
  oblastId: string,
  pozadal: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("pruzkumy")
    .insert({ kampan_id: kampanId, oblast_id: oblastId, pozadal })
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Průzkum se nepodařilo objednat — kampaň patří někomu jinému.");
  }

  // Kampaň čeká na průzkum; schválit ji do té doby nejde (hlídá databáze).
  await supabase.from("kampane").update({ stav: "ceka_na_pruzkum", krok: 3 }).eq("id", kampanId);
}

/** Označí objednávku jako spěchající. Agenta to NESPUSTÍ — jen ho navede. */
export async function oznacUrgentni(pruzkumId: string): Promise<void> {
  const { data, error } = await supabase
    .from("pruzkumy")
    .update({ urgentni: true })
    .eq("id", pruzkumId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Označit nešlo — objednávka patří ke kampani někoho jiného.");
  }
}

// ─────────────────────────────────────────────── firmy v kampani

/** Firma v seznamu kampaně i s tím, jaké má spojení. */
export interface FirmaKampane {
  ico: string;
  nazev: string;
  obec: string | null;
  skore: number | null;
  stav: "vybrana" | "vyrazena";
  duvod_vyrazeni: string | null;
  /** Úrovně adres všech kontaktů firmy. Nejlepší je nejnižší číslo (TP-6). */
  urovne: number[];
}

export async function nactiFirmyKampane(kampanId: string): Promise<FirmaKampane[]> {
  const { data, error } = await supabase
    .from("kampan_firmy")
    .select("ico,stav,duvod_vyrazeni,companies(nazev,obec,skore),contacts:companies(contacts(uroven_adresy))")
    .eq("kampan_id", kampanId);
  if (error) throw new Error(error.message);

  type Radek = {
    ico: string;
    stav: "vybrana" | "vyrazena";
    duvod_vyrazeni: string | null;
    companies: { nazev: string; obec: string | null; skore: number | null } | null;
    contacts: { contacts: { uroven_adresy: number | null }[] } | null;
  };

  return ((data ?? []) as unknown as Radek[])
    .map((r) => ({
      ico: r.ico,
      nazev: r.companies?.nazev ?? r.ico,
      obec: r.companies?.obec ?? null,
      skore: r.companies?.skore ?? null,
      stav: r.stav,
      duvod_vyrazeni: r.duvod_vyrazeni,
      urovne: (r.contacts?.contacts ?? [])
        .map((k) => k.uroven_adresy)
        .filter((u): u is number => u !== null),
    }))
    // Nejlepší napřed — u firem z oblasti skóre funguje od 31. 7.
    .sort((a, b) => (b.skore ?? -1) - (a.skore ?? -1));
}

/**
 * Nejlepší doložená úroveň adresy, nebo `null` když firma spojení nemá.
 *
 * Nejlepší je nejnižší číslo: 1 je jmenovaná osoba, 3 obecná adresa.
 * Firma se počítá jen jednou — jinak by přispěla do dvou sloupců a součet
 * by nesouhlasil s počtem firem. Totéž dělá `rozpadKontaktuKampane`
 * v `src/kampan.ts` pro příkazovou řádku.
 */
export function nejlepsiUroven(f: FirmaKampane): number | null {
  return f.urovne.length === 0 ? null : Math.min(...f.urovne);
}

const POPIS_DUVODU: Record<string, string> = {
  partnerska_jidelna: "naše partnerská jídelna",
  bytovy_dum: "bytový dům",
  blacklist: "blacklist",
  vlastni_jidelna: "má vlastní jídelnu",
};

export interface NaplneniKampane {
  pridano: number;
  vynechano: { ico: string; nazev: string; duvod: string; detail: string }[];
}

/**
 * Naplní kampaň firmami z jejího území.
 *
 * Aplikace nemůže zavolat `naplnZOblasti` z jádra (běží v Node), takže dělá
 * totéž sama — ale sítem `duvodNeoslovovat`, které je SDÍLENÉ. Pravidlo tedy
 * zůstává jedno, jen ho volají dvě místa.
 *
 * Ručně vyřazené firmy se nevzkřísí — vkládá se `on conflict do nothing`.
 */
export async function naplnKampanZOblasti(
  kampanId: string,
  oblastId: string,
): Promise<NaplneniKampane> {
  const [firmy, sito, vOblasti] = await Promise.all([
    nactiFirmy(),
    nactiPravidlaSita(),
    supabase.from("oblast_firmy").select("ico").eq("oblast_id", oblastId),
  ]);
  if (vOblasti.error) throw new Error(vOblasti.error.message);

  const uvnitr = new Set((vOblasti.data ?? []).map((x) => (x as { ico: string }).ico));
  const podleIco = new Map(firmy.map((f) => [f.ico, f]));

  const vynechano: NaplneniKampane["vynechano"] = [];
  const kVlozeni: { kampan_id: string; ico: string }[] = [];

  for (const ico of uvnitr) {
    const f = podleIco.get(ico);
    if (!f) continue;
    const duvod = duvodNeoslovovat({
      ico: f.ico,
      nazev: f.nazev,
      czNace: f.cz_nace,
      pravniForma: f.pravni_forma,
      maVlastniJidelnu: f.ma_vlastni_jidelnu,
      partnerskaIca: sito.partnerskaIca,
      blacklist: sito.blacklist,
    });
    if (duvod) {
      vynechano.push({
        ico: f.ico,
        nazev: f.nazev,
        duvod: POPIS_DUVODU[duvod.duvod] ?? duvod.duvod,
        detail: duvod.detail,
      });
    } else {
      kVlozeni.push({ kampan_id: kampanId, ico: f.ico });
    }
  }

  let pridano = 0;
  for (let i = 0; i < kVlozeni.length; i += 500) {
    const { data, error } = await supabase
      .from("kampan_firmy")
      .upsert(kVlozeni.slice(i, i + 500), {
        onConflict: "kampan_id,ico",
        ignoreDuplicates: true,
      })
      .select("ico");
    if (error) throw new Error(error.message);
    pridano += data?.length ?? 0;
  }

  return { pridano, vynechano };
}

export async function vyradZKampane(
  kampanId: string,
  ico: string,
  duvod: string,
): Promise<void> {
  if (!duvod.trim()) {
    throw new Error("Vyřazení potřebuje důvod — bez něj se pravidla nebrousí.");
  }
  const { data, error } = await supabase
    .from("kampan_firmy")
    .update({ stav: "vyrazena", duvod_vyrazeni: duvod.trim() })
    .eq("kampan_id", kampanId)
    .eq("ico", ico)
    .select("ico");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Vyřazení neprošlo — kampaň patří někomu jinému.");
  }
}

/**
 * Schválí kampaň.
 *
 * Podmínky (aspoň jedna firma s doloženým spojením, dokončený průzkum, role
 * admin a výš) hlídá DATABÁZE. Tohle je jen cesta, jak se jí zeptat —
 * a přeložit její „ne" do lidské věty.
 */
export async function schvalKampan(kampanId: string): Promise<void> {
  const { data, error } = await supabase
    .from("kampane")
    .update({ stav: "schvalena", krok: 4 })
    .eq("id", kampanId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "Schválení neprošlo. Schvalovat smí jen admin, a kampaň musí mít aspoň " +
        "jednu firmu s doloženým spojením a dokončený průzkum.",
    );
  }
}

// ────────────────────────────────────────────────────────── provoz

/** Jeden průzkum tak, jak ho potřebuje vidět provozní přehled. */
export interface PruzkumVProvozu {
  id: string;
  stav: string;
  urgentni: boolean;
  pozadal: string;
  pozadano_at: string;
  chyba: string | null;
  oblast: string;
  kampan: string | null;
  useky: { stav: string; obec: string; chyba: string | null }[];
  bezPredMinutami: number;
  bezicíObec: string | null;
}

/** Jeden běh agenta ze záznamu `agent_runs` (TP-13). */
export interface BehAgenta {
  id: string;
  agent: string;
  zacatek: string;
  konec: string | null;
  vystup: unknown;
  chyby: unknown;
}

export async function nactiPruzkumyProvoz(): Promise<PruzkumVProvozu[]> {
  const { data, error } = await supabase
    .from("pruzkumy")
    .select(
      "id,stav,urgentni,pozadal,pozadano_at,chyba,oblasti(nazev),kampane(nazev)," +
        "pruzkum_useky(stav,obec,chyba)",
    )
    .order("pozadano_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  type Radek = {
    id: string;
    stav: string;
    urgentni: boolean;
    pozadal: string;
    pozadano_at: string;
    chyba: string | null;
    oblasti: { nazev: string } | null;
    kampane: { nazev: string } | null;
    pruzkum_useky: { stav: string; obec: string; chyba: string | null }[];
  };

  return ((data ?? []) as unknown as Radek[]).map((r) => {
    const useky = r.pruzkum_useky ?? [];
    return {
      id: r.id,
      stav: r.stav,
      urgentni: r.urgentni,
      pozadal: r.pozadal,
      pozadano_at: r.pozadano_at,
      chyba: r.chyba,
      oblast: r.oblasti?.nazev ?? "—",
      kampan: r.kampane?.nazev ?? null,
      useky,
      bezPredMinutami: Math.max(
        0,
        Math.round((Date.now() - new Date(r.pozadano_at).getTime()) / 60000),
      ),
      bezicíObec: useky.find((u) => u.stav === "bezi")?.obec ?? null,
    };
  });
}

export async function nactiBehyAgentu(): Promise<BehAgenta[]> {
  const { data, error } = await supabase
    .from("agent_runs")
    .select("id,agent,zacatek,konec,vystup,chyby")
    .order("zacatek", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BehAgenta[];
}

/**
 * Vrátí neúspěšný průzkum zpátky do fronty.
 *
 * Nezakládá nový — objednávka i její hotové úseky zůstávají, takže se
 * nezačíná od nuly. Hotové obce se znovu nezpracovávají.
 */
export async function zkusPruzkumZnovu(pruzkumId: string): Promise<void> {
  const { data, error } = await supabase
    .from("pruzkumy")
    .update({ stav: "ceka", chyba: null, urgentni: true })
    .eq("id", pruzkumId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Nepovedlo se vrátit do fronty — chybí oprávnění ke kampani.");
  }
}
