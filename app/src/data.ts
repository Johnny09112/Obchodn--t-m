import { supabase } from "./supabase";
import type { Pravidlo } from "../../src/sito";
import type { VyuzitiOblasti } from "../../src/oblast-vyuziti";
import {
  roztridKandidaty,
  spoctiKose,
  type PocetKosu,
} from "../../src/kampan-kandidati";

export type { VyuzitiOblasti, PocetKosu };

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
  /**
   * Kontakty firmy — jen `email`/`telefon`, aby šlo v `maSpojeni` poznat
   * spojení, na které se dá napsat, ne jen že u firmy nějaký kontakt je
   * (nález 8 závěrečné revize).
   */
  contacts: { email: string | null; telefon: string | null }[];
  /** Kdy firma naposledy prošla rešerší; `null` = neprošla nikdy. */
  obohaceno_at: string | null;
}

export interface Jidelna {
  id: string;
  nazev: string;
  obec: string | null;
  lat: number | null;
  lng: number | null;
  zona_metru: number;
  /** Kolik obědů denně má jídelna volných; `null` = neuvedeno (ne nula). */
  kapacita_volna: number | null;
  aktivni: boolean;
}

export interface Kategorie {
  kod: string;
  nazev: string;
}

/** Profil produktu — určuje, co se o firmách zjišťuje (viz `src/atributy.ts`). */
export interface Profil {
  kod: string;
  nazev: string;
  aktivni: boolean;
}

export async function nactiProfily(): Promise<Profil[]> {
  const { data, error } = await supabase
    .from("profily")
    .select("kod,nazev,aktivni")
    .order("nazev");
  if (error) throw new Error(error.message);
  return (data ?? []) as Profil[];
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
  "cz_nace,pravni_forma,ma_vlastni_jidelnu,contacts(email,telefon),obohaceno_at";

/**
 * Načte všechny firmy najednou.
 *
 * Vejde se to do paměti — celá ČR má 35 tisíc firem nad 25 zaměstnanců —
 * a při kreslení oblasti se pak počítá bez dalšího dotazu do databáze,
 * takže počet firem ve tvaru naskakuje okamžitě.
 */
/**
 * Kolik řádků si říct o jednu dávku.
 *
 * Server má vlastní strop (`pgrst.db_max_rows`) a ten klientské přání
 * přebije — **mlčky, bez chyby**. Proto se o víc říct smí, ale nikdy se
 * nesmí předpokládat, že tolik přijde: cyklus končí až prázdnou dávkou,
 * ne dávkou menší, než jsme chtěli. Kdyby se spoléhal na velikost, stačilo
 * by snížit strop na serveru a kartotéka by se tiše useknula — přesně ta
 * chyba, která tu už jednou byla.
 */
const STRANKA = 10000;

export async function nactiFirmy(): Promise<Firma[]> {
  // POZOR: `.limit()` tu nestačí. Server má vlastní strop na počet řádků
  // (výchozí tisíc) a ten klientský limit přebije — MLČKY, bez chyby.
  // Kartotéka pak tiše ukazovala 1 000 firem z 13 767 a počty v mapě
  // i v kampani byly nižší, než měly být. Proto se čte po stránkách.
  //
  // Stránkuje se **podle posledního IČO, ne přes `offset`**. S offsetem musí
  // databáze u každé další stránky znovu přeskákat všechny předchozí řádky,
  // takže poslední stránka je nejdražší a celek roste s druhou mocninou.
  // Takhle je každá stránka jedno seknutí do indexu.
  const vse: Firma[] = [];
  let posledni: string | null = null;
  for (;;) {
    let dotaz = supabase.from("companies").select(SLOUPCE_FIRMY).order("ico").limit(STRANKA);
    if (posledni !== null) dotaz = dotaz.gt("ico", posledni);

    const { data, error } = await dotaz;
    if (error) throw new Error(error.message);

    const davka = (data ?? []) as unknown as Firma[];
    if (davka.length === 0) break;
    vse.push(...davka);
    posledni = davka[davka.length - 1]!.ico;
  }

  // Třídění až tady: přes stránky by ho server stejně neudržel.
  return vse.sort((a, b) => (b.skore ?? -1) - (a.skore ?? -1));
}

export async function nactiJidelny(): Promise<Jidelna[]> {
  const { data, error } = await supabase
    .from("jidelny")
    .select("id,nazev,obec,lat,lng,zona_metru,kapacita_volna,aktivni")
    .order("nazev");
  if (error) throw new Error(error.message);
  return (data ?? []) as Jidelna[];
}

/**
 * Kolik firem má která jídelna v dosahu.
 *
 * Pravda o dosahu je v tabulce `dosah`, ne ve sloupci
 * `companies.nejblizsi_jidelna_id` — ten drží jen zařazení do kartotéky
 * a ukázal by nulu i tam, kde dosah je (migrace 0010).
 *
 * Počítá se serverem (`head: true`), takže se nepřenáší ani jeden řádek —
 * u 2 300 firem na jednu jídelnu by je stejně zastavil strop PostgRESTu.
 */
export async function nactiFiremVDosahu(
  jidelnaIds: string[],
): Promise<Record<string, number>> {
  const dvojice = await Promise.all(
    jidelnaIds.map(async (id) => {
      const { count, error } = await supabase
        .from("dosah")
        .select("ico", { count: "exact", head: true })
        .eq("jidelna_id", id)
        .eq("v_zone", true);
      if (error) throw new Error(error.message);
      return [id, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(dvojice);
}

/**
 * Zapíše volnou kapacitu jídelny. `null` = neuvedeno.
 *
 * Kapacitu smí měnit jen admin a výš (migrace 0016) a zamítnutý zápis
 * Supabase nehlásí jako chybu — jen změní nula řádků. Bez téhle kontroly
 * by tlačítko u běžného uživatele jen zablikalo.
 */
export async function ulozKapacituJidelny(
  id: string,
  kapacita: number | null,
): Promise<void> {
  const { data, error } = await supabase
    .from("jidelny")
    .update({ kapacita_volna: kapacita })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Kapacitu se nepodařilo uložit — měnit ji smí jen admin.");
  }
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

/** Kampaň, která oblast používá. */
export interface KampanOblasti {
  id: string;
  nazev: string;
  stav: string;
  archivovana: boolean;
}

/**
 * Oblast i s tím, co o ní víme — pro seznam s detailem.
 *
 * Počty i kampaně počítá databáze (pohled `oblasti_prehled`, migrace 0029).
 * Dopočítávat je v prohlížeči by znamenalo stáhnout desetitisíce řádků
 * `oblast_firmy` jen kvůli jednomu číslu.
 */
export interface PrehledOblasti {
  id: string;
  nazev: string;
  typ: string;
  polomer_m: number | null;
  bodu: number | null;
  jidelna_id: string | null;
  poznamka: string | null;
  created_at: string;
  firem: number;
  /** Složení podle velikosti — součet dílů dá `firem`. */
  mikro: number;
  stredni: number;
  korporat: number;
  /** Registr u nich velikost neuvádí. Není to nula, je to „nevíme". */
  bez_velikosti: number;
  /** Firem se jmenným kontaktem. */
  se_spojenim: number;
  pruzkumu: number;
  posledni_stav: string | null;
  posledni_at: string | null;
  posledni_chyba: string | null;
  /**
   * Oblast se od posledního průzkumu překreslila, takže starý průzkum už
   * nepopisuje celý dnešní tvar (migrace 0031).
   */
  tvar_zmenen: boolean;
  kampane: KampanOblasti[];
}

/** Kampaně jsou včetně archivovaných — archiv je úklid z přehledu, ne zrušení. */
export async function nactiPrehledOblasti(): Promise<PrehledOblasti[]> {
  const { data, error } = await supabase
    .from("oblasti_prehled")
    .select(
      "id,nazev,typ,polomer_m,bodu,jidelna_id,poznamka,created_at," +
        "firem,mikro,stredni,korporat,bez_velikosti,se_spojenim," +
        "pruzkumu,posledni_stav,posledni_at,posledni_chyba,tvar_zmenen,kampane",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PrehledOblasti[];
}

/**
 * IČO firem ve vyjmenovaných oblastech, sjednocená.
 *
 * Po stránkách ze stejného důvodu jako `nactiFirmy` — server vrací nejvýš
 * tisíc řádků naráz a Plzeň sama má přes dvanáct tisíc.
 */
async function nactiIcaVOblastech(oblastiIds: readonly string[]): Promise<Set<string>> {
  const vse = new Set<string>();
  let posledni: string | null = null;
  for (;;) {
    let dotaz = supabase
      .from("oblast_firmy")
      .select("ico")
      .in("oblast_id", oblastiIds as string[])
      .order("ico")
      .limit(STRANKA);
    if (posledni !== null) dotaz = dotaz.gt("ico", posledni);

    const { data, error } = await dotaz;
    if (error) throw new Error(error.message);
    const davka = (data ?? []) as { ico: string }[];
    if (davka.length === 0) break;
    for (const r of davka) vse.add(r.ico);
    posledni = davka[davka.length - 1]!.ico;
  }
  return vse;
}

/** Co z přehledu brání smazání. Firmy uvnitř oblast nedrží. */
export function vyuzitiZPrehledu(o: PrehledOblasti): VyuzitiOblasti {
  return {
    kampane: o.kampane.map((k) => k.nazev),
    pruzkumu: o.pruzkumu,
    firem: o.firem,
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

// ────────────────────────────────────────────────────── detail firmy

/** Kontakt i s tím, odkud je — bez zdroje by se mu nedalo věřit (TP-2). */
export interface KontaktDetail {
  id: string;
  jmeno: string | null;
  prijmeni: string | null;
  pozice: string | null;
  email: string | null;
  telefon: string | null;
  uroven_adresy: number | null;
  zdroj_url: string | null;
  ziskano_at: string;
  /** Doslovná citace ze stránky, kde kontakt stál. */
  citace: string | null;
}

/** Jeden dohledaný údaj o firmě i s doložením. */
export interface EvidenceDetail {
  id: string;
  atribut: string;
  hodnota: string;
  zdroj_url: string;
  citace: string;
  ziskano_at: string;
}

export interface DetailFirmy {
  kontakty: KontaktDetail[];
  evidence: EvidenceDetail[];
}

/**
 * Všechno, co o firmě víme, i s doložením.
 *
 * Vyžádal si to majitel 2. 8.: „potřebuji k dohledanému kontaktu web, kde byl
 * kontakt nalezen — pro jistotu." Bez odkazu se údaj nedá ověřit ani obhájit,
 * a přesně proto ho tvrdé pravidlo TP-2 vyžaduje u každého zápisu.
 */
export async function nactiDetailFirmy(ico: string): Promise<DetailFirmy> {
  const [k, e] = await Promise.all([
    supabase
      .from("contacts")
      .select("id,jmeno,prijmeni,pozice,email,telefon,uroven_adresy,zdroj_url,ziskano_at")
      .eq("ico", ico)
      .order("uroven_adresy"),
    supabase
      .from("evidence")
      .select("id,atribut,hodnota,zdroj_url,citace,ziskano_at,contact_id")
      .eq("ico", ico)
      .order("ziskano_at", { ascending: false }),
  ]);
  if (k.error) throw new Error(k.error.message);
  if (e.error) throw new Error(e.error.message);

  const evidence = (e.data ?? []) as unknown as (EvidenceDetail & { contact_id: string | null })[];
  // Citace ke kontaktu je v evidenci, ne v `contacts` — spáruje se přes id.
  const citaceKontaktu = new Map(
    evidence.filter((x) => x.contact_id).map((x) => [x.contact_id!, x.citace]),
  );

  return {
    kontakty: ((k.data ?? []) as unknown as KontaktDetail[]).map((x) => ({
      ...x,
      citace: citaceKontaktu.get(x.id) ?? null,
    })),
    // Kontakty mají vlastní sekci, ať se v atributech neopakují.
    evidence: evidence.filter((x) => x.atribut !== "kontakt"),
  };
}

/**
 * Má firma spojení, na které se dá napsat — e-mail nebo telefon u
 * *nějakého* kontaktu, ne jen jakýkoli kontakt.
 *
 * `src/kontakty.ts` zakládá kontakty na jednatele z rejstříku i bez e-mailu
 * a telefonu, a takových firem jsou tisíce — dřív se počítal jen počet
 * kontaktů (`contacts.count`), takže se tyhle firmy v tabulce ukazovaly
 * zeleně jako „prošla · spojení", přestože na ně napsat nešlo (nález 8
 * závěrečné revize). Srovnáno s `pocetSeSpojenim` v jádře (src/reserse.ts),
 * které tohle počítá správně.
 */
export function maSpojeni(f: Firma): boolean {
  return f.contacts.some((k) => k.email !== null || k.telefon !== null);
}

/** Stav rešerše u firmy — tři možnosti, které majitel chtěl rozlišit. */
export type StavReserse = "neprosla" | "prosla_se_spojenim" | "prosla_bez_spojeni";

export function stavReserse(f: { obohaceno_at: string | null; maSpojeni: boolean }): StavReserse {
  if (f.obohaceno_at === null) return "neprosla";
  return f.maSpojeni ? "prosla_se_spojenim" : "prosla_bez_spojeni";
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
  /** Území kampaně — od migrace 0030 jich může být víc. */
  oblasti: { id: string; nazev: string }[];
  archivovana_at: string | null;
  updated_at: string;
  /** Profil produktu kampaně (migrace 0036). `null` = použij globálně aktivní. */
  profil_kod: string | null;
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

/** Řádek kampaně, jak ho vrací server — území přijde jako vnořená vazba. */
interface SyrovaKampan extends Omit<RadekKampane, "oblasti"> {
  kampan_oblasti: { poradi: number; oblasti: { id: string; nazev: string } | null }[] | null;
}

export async function nactiKampane(): Promise<RadekKampane[]> {
  const { data, error } = await supabase
    .from("kampane")
    .select(
      "id,nazev,stav,spravce,zastupce,krok,archivovana_at,updated_at,profil_kod," +
        "kampan_oblasti(poradi,oblasti(id,nazev))",
    )
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as SyrovaKampan[]).map((k) => ({
    ...k,
    oblasti: (k.kampan_oblasti ?? [])
      .slice()
      .sort((a, b) => a.poradi - b.poradi)
      .map((v) => v.oblasti)
      .filter((o): o is { id: string; nazev: string } => o !== null),
  }));
}

/**
 * Nastaví kampani území — celou množinu naráz.
 *
 * Nahrazuje, nepřidává: kdo z výběru oblast odebere, musí ji opravdu odebrat
 * (stejně jako `nastavUzemi` v jádru).
 */
export async function nastavUzemiKampane(
  kampanId: string,
  oblastiIds: readonly string[],
): Promise<void> {
  const smazani = await supabase.from("kampan_oblasti").delete().eq("kampan_id", kampanId);
  if (smazani.error) throw new Error(smazani.error.message);

  if (oblastiIds.length === 0) return;

  const radky = [...new Set(oblastiIds)].map((oblast_id, poradi) => ({
    kampan_id: kampanId,
    oblast_id,
    poradi,
  }));
  const { data, error } = await supabase.from("kampan_oblasti").insert(radky).select("oblast_id");
  if (error) throw new Error(error.message);
  if (!data || data.length !== radky.length) {
    throw new Error("Území se nepodařilo uložit — kampaň patří někomu jinému.");
  }
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
  oblast_id: string;
  stav: string;
  urgentni: boolean;
  pozadano_at: string;
  chyba: string | null;
  pruzkum_useky: { stav: string; obec: string }[];
};

/** Jedna oblast kampaně i s tím, jak na tom je její průzkum. */
export interface PruzkumOblasti {
  oblastId: string;
  oblastNazev: string;
  /** Nejnovější objednávka pro tuhle oblast, nebo `null` když žádná není. */
  pruzkum: StavPruzkumu | null;
  chyba: string | null;
}

/**
 * Průzkumy území kampaně — jeden na oblast.
 *
 * Bere se **nejnovější objednávka na oblast, ať ji zadal kdokoli**. Oblast
 * prozkoumaná dřív jinou kampaní je pořád prozkoumaná; ptát se jen na
 * objednávky téhle kampaně by znamenalo objednat práci, která je hotová.
 */
export async function nactiPruzkumyKampane(
  kampanId: string,
  oblasti: readonly { id: string; nazev: string }[],
): Promise<PruzkumOblasti[]> {
  if (oblasti.length === 0) return [];

  const { data, error } = await supabase
    .from("pruzkumy")
    .select("id,oblast_id,stav,urgentni,pozadano_at,chyba,pruzkum_useky(stav,obec)")
    .in(
      "oblast_id",
      oblasti.map((o) => o.id),
    )
    .order("pozadano_at", { ascending: false });
  if (error) throw new Error(error.message);

  // Řádky chodí od nejnovějšího, takže první nalezený na oblast je ten pravý.
  const nejnovejsi = new Map<string, RadekPruzkumu>();
  for (const r of (data ?? []) as unknown as RadekPruzkumu[]) {
    if (!nejnovejsi.has(r.oblast_id)) nejnovejsi.set(r.oblast_id, r);
  }

  // Kdo drží frontu, se zjišťuje jednou pro celou kampaň — je to táž
  // odpověď pro všechny její oblasti a jeden dotaz stačí.
  const blokujeJiny = await ktoDrziFrontu([...nejnovejsi.values()].map((r) => r.id));

  return oblasti.map((o) => {
    const r = nejnovejsi.get(o.id);
    return {
      oblastId: o.id,
      oblastNazev: o.nazev,
      chyba: r?.chyba ?? null,
      pruzkum: r ? naStavPruzkumu(r, blokujeJiny) : null,
    };
  });
}

/**
 * Název oblasti průzkumu, který právě běží a není mezi našimi. Naráz běží
 * jen jeden — bez tohohle člověk kouká na „čeká" a netuší, na co se čeká.
 */
async function ktoDrziFrontu(vlastniIds: string[]): Promise<string | null> {
  const jine = await supabase.from("pruzkumy").select("id,oblasti(nazev)").eq("stav", "bezi");
  const radky = (jine.data ?? []) as unknown as {
    id: string;
    oblasti: { nazev: string } | null;
  }[];
  const cizi = radky.find((r) => !vlastniIds.includes(r.id));
  return cizi?.oblasti?.nazev ?? null;
}

function naStavPruzkumu(r: RadekPruzkumu, blokujeJiny: string | null): StavPruzkumu {
  const useky = r.pruzkum_useky ?? [];
  const minuty = Math.max(0, Math.round((Date.now() - new Date(r.pozadano_at).getTime()) / 60000));
  return {
    id: r.id,
    stav: r.stav,
    urgentni: r.urgentni,
    useky,
    bezPredMinutami: minuty,
    bezicíObec: useky.find((u) => u.stav === "bezi")?.obec ?? null,
    // Cizí běžící průzkum blokuje jen objednávku, která sama ještě nezačala.
    blokujeJiny: useky.length === 0 && (r.stav === "ceka" || r.stav === "bezi") ? blokujeJiny : null,
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
  stav: readonly PruzkumOblasti[],
  pozadal: string,
): Promise<{ objednano: string[]; preskoceno: string[] }> {
  // Oblast, která už hotový průzkum má nebo na jeden čeká, se neobjednává
  // znovu. Neúspěšná ano — selhání není výsledek.
  const kObjednani = stav.filter(
    (o) => o.pruzkum === null || o.pruzkum.stav === "selhalo",
  );
  const preskoceno = stav.filter((o) => !kObjednani.includes(o)).map((o) => o.oblastNazev);

  if (kObjednani.length === 0) return { objednano: [], preskoceno };

  const { data, error } = await supabase
    .from("pruzkumy")
    .insert(
      kObjednani.map((o) => ({ kampan_id: kampanId, oblast_id: o.oblastId, pozadal })),
    )
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length !== kObjednani.length) {
    throw new Error("Průzkum se nepodařilo objednat — kampaň patří někomu jinému.");
  }

  // Kampaň čeká na průzkum; schválit ji do té doby nejde (hlídá databáze).
  await supabase.from("kampane").update({ stav: "ceka_na_pruzkum", krok: 3 }).eq("id", kampanId);

  return { objednano: kObjednani.map((o) => o.oblastNazev), preskoceno };
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
  /**
   * Má firma kontakt, na který se dá doopravdy napsat?
   *
   * Není to totéž co „má kontakt". Doplnění z rejstříku zapisuje jednatele
   * **jménem, bez e-mailu i telefonu** — u Hrobců tak 48 z 61 firem mělo
   * kontakt, ale napsat nešlo ani jedné. Dokud se to počítalo jako spojení,
   * hlásila obrazovka 48 a `SeznamFirem` hned pod ní 0; a schvalování kampaně
   * se opíralo o to vyšší číslo.
   */
  maSpojeni: boolean;
}

/**
 * Firmy v kampani — po stránkách ze stejného důvodu jako `nactiFirmy` a
 * `nactiIcaVOblastech`.
 *
 * Bez stránkování by server u velké kampaně odpověď MLČKY usekl a `jizVKampani`
 * v `spocitejCekajici` by dostalo neúplnou množinu — firmy, které v kampani
 * už jsou, by se pak započítaly jako čekající. Panel by slíbil víc, než
 * tlačítko doopravdy přidá.
 */
export async function nactiFirmyKampane(kampanId: string): Promise<FirmaKampane[]> {
  type Radek = {
    ico: string;
    stav: "vybrana" | "vyrazena";
    duvod_vyrazeni: string | null;
    companies: { nazev: string; obec: string | null; skore: number | null } | null;
    contacts: {
      contacts: { uroven_adresy: number | null; email: string | null; telefon: string | null }[];
    } | null;
  };

  const vse: FirmaKampane[] = [];
  let posledni: string | null = null;
  for (;;) {
    let dotaz = supabase
      .from("kampan_firmy")
      .select(
        "ico,stav,duvod_vyrazeni,companies(nazev,obec,skore)," +
          "contacts:companies(contacts(uroven_adresy,email,telefon))",
      )
      .eq("kampan_id", kampanId)
      .order("ico")
      .limit(STRANKA);
    if (posledni !== null) dotaz = dotaz.gt("ico", posledni);

    const { data, error } = await dotaz;
    if (error) throw new Error(error.message);

    const davka = (data ?? []) as unknown as Radek[];
    if (davka.length === 0) break;
    vse.push(
      ...davka.map((r) => ({
        ico: r.ico,
        nazev: r.companies?.nazev ?? r.ico,
        obec: r.companies?.obec ?? null,
        skore: r.companies?.skore ?? null,
        stav: r.stav,
        duvod_vyrazeni: r.duvod_vyrazeni,
        urovne: (r.contacts?.contacts ?? [])
          .map((k) => k.uroven_adresy)
          .filter((u): u is number => u !== null),
        maSpojeni: (r.contacts?.contacts ?? []).some(
          (k) => k.email !== null || k.telefon !== null,
        ),
      })),
    );
    posledni = davka[davka.length - 1]!.ico;
  }

  // Třídění až tady, přes stránky by ho server stejně neudržel — nejlepší
  // napřed, u firem z oblasti skóre funguje od 31. 7.
  return vse.sort((a, b) => (b.skore ?? -1) - (a.skore ?? -1));
}

/**
 * Nejlepší doložená úroveň adresy, nebo `null` když firma spojení nemá.
 *
 * Nejlepší je nejnižší číslo. Podle TP-6: **1 je adresa pro nabídky,
 * 2 obecná firemní adresa, 3 jmenovaná osoba.** Pořadí není o tom, kdo
 * o nabídce rozhoduje — je to právní žebříček: adresa zveřejněná pro příjem
 * nabídek je pozvánka, kdežto u jmenované osoby zpracováváme osobní údaj
 * získaný odjinud a do zprávy patří poučení podle čl. 14 GDPR.
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
  oblastiIds: readonly string[],
  opts: { zahrnoutNezname?: boolean; zahrnoutMikro?: boolean } = {},
): Promise<NaplneniKampane> {
  if (oblastiIds.length === 0) {
    return { pridano: 0, vynechano: [] };
  }

  const [firmy, sito, vOblastech] = await Promise.all([
    nactiFirmy(),
    nactiPravidlaSita(),
    nactiIcaVOblastech(oblastiIds),
  ]);

  const kandidati = roztridKandidaty({
    firmy,
    vUzemi: vOblastech,
    // Prázdná schválně: duplicity odchytí `on conflict do nothing` a seznam
    // `vynechano` musí dál vypisovat VŠECHNY firmy zadržené sítem, ne jen ty,
    // které v kampani ještě nejsou. Kdo nevidí, proč firma chybí, přestane
    // pravidlům věřit.
    jizVKampani: new Set<string>(),
    sito,
  });

  const vynechano: NaplneniKampane["vynechano"] = kandidati
    .filter((k) => k.kosik === "sito")
    .map((k) => ({
      ico: k.ico,
      nazev: k.nazev,
      duvod: POPIS_DUVODU[k.duvod!.duvod] ?? k.duvod!.duvod,
      detail: k.duvod!.detail,
    }));

  // Cílová velikost se bere vždycky. Zbylé dva koše jsou dvě různá
  // rozhodnutí majitele, každé s vlastním tlačítkem — proto dva příznaky,
  // ne jeden „široký rozsah".
  const kVlozeni = kandidati
    .filter(
      (k) =>
        k.kosik === "cilova" ||
        (opts.zahrnoutNezname && k.kosik === "bez_velikosti") ||
        (opts.zahrnoutMikro && k.kosik === "mikro"),
    )
    .map((k) => ({ kampan_id: kampanId, ico: k.ico }));

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

/**
 * Kolik firem z území v kampani ještě NENÍ, po koších.
 *
 * Nic neukládá a nikam se nezapisuje — počítá se z dat pokaždé znovu, aby
 * číslo na obrazovce nemohlo zastarat. Co tahle funkce vrátí v `bezVelikosti`,
 * to tlačítko „přidat i firmy s neznámou velikostí" doopravdy přidá.
 *
 * `prednactene` je nepovinné: volající, který si `nactiFirmy()` a
 * `nactiFirmyKampane()` už stáhl (obrazovka kampaně je stahuje kvůli
 * seznamu firem), je předá a ušetří tak druhé stažení přes 13 000 firem.
 * Když se nepředají, načtou se tady jako dosud — jiná místa je volají bez nich.
 */
export async function spocitejCekajici(
  kampanId: string,
  oblastiIds: readonly string[],
  prednactene?: { firmy: Firma[]; vKampani: FirmaKampane[] },
): Promise<PocetKosu> {
  if (oblastiIds.length === 0) return { cilova: 0, bezVelikosti: 0, mikro: 0 };

  const [firmy, sito, vOblastech, vKampani] = await Promise.all([
    prednactene ? prednactene.firmy : nactiFirmy(),
    nactiPravidlaSita(),
    nactiIcaVOblastech(oblastiIds),
    prednactene ? prednactene.vKampani : nactiFirmyKampane(kampanId),
  ]);

  return spoctiKose(
    roztridKandidaty({
      firmy,
      vUzemi: vOblastech,
      // Vyřazené firmy jsou v `kampan_firmy` taky a doplnění je nevzkřísí —
      // proto sem patří všechny, ne jen ty se stavem `vybrana`.
      jizVKampani: new Set(vKampani.map((f) => f.ico)),
      sito,
    }),
  );
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

// ──────────────────────────────────────────────────── rešerše (fronta AI)

/** Objednávka AI průzkumu z tabulky `reserse` tak, jak ji potřebuje obrazovka. */
export interface ObjednavkaReserse {
  id: string;
  stav: "ceka" | "bezi" | "hotovo" | "selhalo";
  firemZadano: number;
  firemZpracovano: number | null;
  firemSNalezem: number | null;
  chyba: string | null;
}

/**
 * Výchozí zadání. Odkazuje na playbook schválně — ten se mění, tohle ne.
 *
 * **Váže se na pole `chybi`**, které obsluha ke každé firmě do souboru
 * s prací zapisuje. Dřív tu stálo „dohledej kontaktní osobu, nic navíc
 * nesbírej" — jenže soubor u každé firmy hlásil, že chybí tři věci
 * (`ma_vlastni_jidelnu`, `zpusob_stravovani`, `spojeni`). Zadání a data si
 * odporovaly a agent poslechl zadání: první ostrá dávka zapsala šest
 * kontaktů a **nula atributů**, ačkoli oba zbylé jsou na whitelistu a smějí
 * se sbírat.
 *
 * Takhle se to drží v souladu samo — co obsluha označí za chybějící, to se
 * hledá. Do `chybi` se dostane, co určí profil produktu (a co má
 * `hleda_agent`) — whitelist s tím nemá nic společného, ten řídí jen to,
 * co smí ven do zprávy (TP-3, `src/whitelist.ts`).
 *
 * Pozor na očekávání: způsob stravování se v měření z 2. 8. dohledal jen
 * u 1 z 20 firem. Weby o tom nepíšou. Levné to je, výtěžnost malá.
 */
const ZADANI_VYCHOZI =
  "U každé firmy dohledej to, co je u ní uvedené v poli „chybi“ — postupuj " +
  "podle svého playbooku. Kontakty (jméno, pozice, e-mail nebo telefon, max " +
  "2 na firmu) hledej vždycky, i mimo „chybi“. Nic dalšího mimo „chybi“ " +
  "nesbírej. Když se něco nepodaří doložit, prostě to vynech; prázdný " +
  "výsledek je správný výsledek.";

/**
 * Objedná dávku AI rešerše pro kampaň. **Agenta to nespustí** — jen zapíše
 * řádek do fronty, kterou si hlídka u hodin vyzvedne (viz `objednejPruzkumZAplikace`
 * výš, stejný vzor).
 */
export async function objednejReserse(
  kampanId: string,
  firemZadano: number,
  pozadal: string,
): Promise<void> {
  const { error } = await supabase.from("reserse").insert({
    kampan_id: kampanId,
    firem_zadano: firemZadano,
    zadani: ZADANI_VYCHOZI,
    pozadal,
  });
  if (error) throw new Error(error.message);
}

/** Poslední objednávka kampaně, nebo `null`. */
export async function posledniReserse(kampanId: string): Promise<ObjednavkaReserse | null> {
  const { data, error } = await supabase
    .from("reserse")
    .select("id,stav,firem_zadano,firem_zpracovano,firem_s_nalezem,chyba")
    .eq("kampan_id", kampanId)
    .order("pozadano_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const r = data?.[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    id: r.id as string,
    stav: r.stav as ObjednavkaReserse["stav"],
    firemZadano: r.firem_zadano as number,
    firemZpracovano: (r.firem_zpracovano as number | null) ?? null,
    firemSNalezem: (r.firem_s_nalezem as number | null) ?? null,
    chyba: (r.chyba as string | null) ?? null,
  };
}

// ── Obchodní signály ──────────────────────────────────────────────────

export interface Signal {
  id: string;
  ico: string;
  nazev: string | null;
  obec: string | null;
  druh: string;
  nazevDruhu: string;
  vylucovaci: boolean;
  sila: number;
  popis: string;
  citace: string;
  zdrojUrl: string;
  zjistenoAt: string;
  /** Kolik má firma doložených spojení — bez nich se stejně psát nedá. */
  spojeni: number;
  /** Kdy a kým byl podnět odškrtnut. `null` = ještě čeká. */
  vyrizenoAt: string | null;
  vyrizenoKym: string | null;
  /**
   * Území, do kterých firma spadá. Podnět sám území nemá — nese ho firma,
   * a ta může ležet ve víc oblastech naráz (překryvy jsou běžné).
   */
  oblasti: Array<{ id: string; nazev: string }>;
}

/**
 * Odškrtne podnět jako vyřízený, nebo odškrtnutí vrátí (`kdo = null`).
 *
 * Zapisují se jen tyhle dva sloupce — na víc uživatel nemá oprávnění
 * (migrace 0043 dává `authenticated` právo měnit pouze je). Citaci ani
 * zdroj tedy přes datové API přepsat nejde.
 */
export async function oznacSignalVyrizeny(
  id: string,
  kdo: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("signaly")
    .update({
      vyrizeno_at: kdo === null ? null : new Date().toISOString(),
      vyrizeno_kym: kdo,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Platné podněty — co je nového a proč zrovna tuhle firmu.
 *
 * Filtr na platnost je v dotazu, ne v prohlížeči: signál s prošlou
 * platností se nemá ani stáhnout. `plati_do is null` znamená „nevyprší"
 * (typicky vylučovací podněty — „vaří si sama" nepřestane platit).
 */
export async function nactiSignaly(iVyrizene = false): Promise<Signal[]> {
  let dotaz = supabase
    .from("signaly")
    .select(
      "id,ico,druh,sila,popis,citace,zdroj_url,zjisteno_at,vyrizeno_at,vyrizeno_kym," +
        "druhy_signalu(nazev,vylucovaci),companies(nazev,obec)",
    )
    .or(`plati_do.is.null,plati_do.gt.${new Date().toISOString()}`);
  // Odškrtnutý podnět je vyřízená práce, ne neplatná informace — proto se
  // nemaže, jen se přestane nabízet.
  if (!iVyrizene) dotaz = dotaz.is("vyrizeno_at", null);

  const { data, error } = await dotaz
    .order("sila", { ascending: false })
    .order("zjisteno_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const radky = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const ica = radky.map((r) => r.ico as string);

  // Spojení se dotahuje zvlášť — vnořený count přes PostgREST by znamenal
  // další vztah v dotazu a tenhle způsob je čitelnější i rychlejší.
  const spojeni = new Map<string, number>();
  const oblastiFirmy = new Map<string, Array<{ id: string; nazev: string }>>();
  if (ica.length > 0) {
    const { data: k } = await supabase
      .from("contacts")
      .select("ico,email,telefon")
      .in("ico", ica);
    for (const c of (k ?? []) as Array<Record<string, unknown>>) {
      if (c.email || c.telefon) {
        const ico = c.ico as string;
        spojeni.set(ico, (spojeni.get(ico) ?? 0) + 1);
      }
    }

    // Území se ptá jen na firmy, které mají podnět — `oblast_firmy` má přes
    // 12 tisíc řádků pro samotnou Plzeň a tahat je celé by nedávalo smysl.
    const { data: of } = await supabase
      .from("oblast_firmy")
      .select("ico,oblasti(id,nazev)")
      .in("ico", ica);
    for (const r of (of ?? []) as Array<Record<string, unknown>>) {
      const o = r.oblasti as { id?: string; nazev?: string } | null;
      if (!o?.id || !o.nazev) continue;
      const ico = r.ico as string;
      const dosud = oblastiFirmy.get(ico) ?? [];
      dosud.push({ id: o.id, nazev: o.nazev });
      oblastiFirmy.set(ico, dosud);
    }
  }

  return radky.map((r) => {
    const druh = r.druhy_signalu as { nazev?: string; vylucovaci?: boolean } | null;
    const firma = r.companies as { nazev?: string; obec?: string } | null;
    return {
      id: r.id as string,
      ico: r.ico as string,
      vyrizenoAt: (r.vyrizeno_at as string | null) ?? null,
      vyrizenoKym: (r.vyrizeno_kym as string | null) ?? null,
      nazev: firma?.nazev ?? null,
      obec: firma?.obec ?? null,
      druh: r.druh as string,
      nazevDruhu: druh?.nazev ?? (r.druh as string),
      vylucovaci: druh?.vylucovaci === true,
      sila: Number(r.sila),
      popis: r.popis as string,
      citace: r.citace as string,
      zdrojUrl: r.zdroj_url as string,
      zjistenoAt: r.zjisteno_at as string,
      spojeni: spojeni.get(r.ico as string) ?? 0,
      oblasti: oblastiFirmy.get(r.ico as string) ?? [],
    };
  });
}

/**
 * Stavy, ve kterých se kampaň už neupravuje.
 *
 * Psáno jako výčet **zamčených** stavů, ne otevřených
 * ([[zamykej-vyjmenovanim-zamcenych-stavu]]): kdyby přibyl nový pracovní
 * stav, seznam otevřených by ho omylem zamkl a nikdo by nepoznal proč.
 *
 * Bydlí tady, ne v průvodci, protože stejné pravidlo potřebuje i obrazovka
 * podnětů. Totéž pravidlo na dvou místech se dřív nebo později rozejde —
 * 13. 8. 2026 se to v tomhle projektu právě stalo u výběru firem.
 */
export const ZAMCENE_STAVY_KAMPANE = ["schvalena", "bezi", "uzavrena", "zrusena"];

export function jeKampanZamcena(stav: string): boolean {
  return ZAMCENE_STAVY_KAMPANE.includes(stav);
}

export interface KampanProVyber {
  id: string;
  nazev: string;
  stav: string;
}

/**
 * Kampaně, do kterých jde firmu přidat — tedy nezamčené.
 *
 * Kdo do které smí zapsat, hlídá RLS (`smi_do_kampane`); tenhle seznam
 * jen neukazuje ty, u kterých by zápis stejně neprošel kvůli stavu.
 */
export async function nactiKampaneProVyber(): Promise<KampanProVyber[]> {
  const { data, error } = await supabase
    .from("kampane")
    .select("id,nazev,stav")
    .order("nazev");
  if (error) throw new Error(error.message);
  return ((data ?? []) as KampanProVyber[]).filter((k) => !jeKampanZamcena(k.stav));
}

export type VysledekPridani = "pridano" | "uz_tam_je";

/**
 * Přidá firmu do kampaně.
 *
 * Firma, která už v kampani je, se **nepřepisuje** — jinak by se z vyřazené
 * firmy stala znovu vybraná a majitelovo rozhodnutí „tuhle ne" by se tiše
 * ztratilo (vyřazení je rozhodnutí, ne stav k přepsání).
 */
export async function pridejFirmuDoKampane(
  kampanId: string,
  ico: string,
): Promise<VysledekPridani> {
  const { data: uz } = await supabase
    .from("kampan_firmy")
    .select("ico")
    .eq("kampan_id", kampanId)
    .eq("ico", ico)
    .maybeSingle();
  if (uz) return "uz_tam_je";

  const { error } = await supabase
    .from("kampan_firmy")
    .insert({ kampan_id: kampanId, ico, stav: "vybrana" });
  if (error) throw new Error(error.message);
  return "pridano";
}

/**
 * Jedna firma podle IČO — pro otevření detailu odjinud než z kartotéky.
 *
 * Používá **tentýž** seznam sloupců jako `nactiFirmy`. Kdyby si tahle
 * funkce psala vlastní, rozešly by se — a detail otevřený z podnětů by
 * ukazoval něco jiného než detail otevřený z kartotéky.
 */
export async function nactiFirmu(ico: string): Promise<Firma | null> {
  const { data, error } = await supabase
    .from("companies")
    .select(SLOUPCE_FIRMY)
    .eq("ico", ico)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as unknown as Firma | null;
}
