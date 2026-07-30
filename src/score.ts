import type { Segment } from "./res.js";

export interface SkoreVstup {
  /**
   * `null` = firma zatím nepatří k žádné jídelně (typicky sběr nad nakreslenou
   * oblastí). Není to „nula metrů" — viz `spocitejSkore`.
   */
  vzdalenostM: number | null;
  /** Segment ze statistického registru (SPEC 10.2). NULL = neuvedeno. */
  segment: Segment | null;
  maVlastniJidelnu: boolean | null;
  czNace: string[];
  urovenAdresy: 1 | 2 | 3 | null;
  /** Počet aktuálně nabízených míst (MPSV) — důkaz živého provozu. */
  nabizenychMist?: number;
}

/**
 * CZ-NACE oddíly s převahou kancelářské práce.
 * Informace a komunikace (58–63), finance a pojišťovnictví (64–66),
 * odborné a technické činnosti (69–75), administrativa (77–82).
 */
const KANCELARSKE_ODDILY = new Set<string>();
for (const [od, doO] of [
  [58, 66],
  [69, 75],
  [77, 82],
] as const) {
  for (let i = od; i <= doO; i++) KANCELARSKE_ODDILY.add(String(i).padStart(2, "0"));
}

/**
 * Normalizace CZ-NACE na dvoumístný oddíl. Rejstřík vrací kódy v různých
 * úrovních: sekce písmenem („G"), oddíl („55") i celý kód („43120").
 * Sekce se zahazuje — nese příliš hrubou informaci.
 */
export function oddilNace(kod: string): string | null {
  const c = kod.trim();
  if (!/^\d+$/.test(c)) return null; // sekce jako „G" nebo prázdno
  if (c.length < 2) return null;
  return c.slice(0, 2);
}

/**
 * Obory, které nemá smysl oslovovat nabídkou obědů — vyřazují se úplně,
 * ne jen bodově.
 *
 * 56 — Stravování a pohostinství: restaurace a kavárny si vaří samy,
 *      pro nás jsou to spíš konkurenti než zákazníci.
 * 78 — Činnosti související se zaměstnáním: agentury práce nabírají lidi
 *      pro někoho jiného; obědy řeší firma, kde ti lidé fyzicky pracují.
 */
const VYLOUCENE_ODDILY = new Set(["56", "78"]);

export function jeVyloucenyObor(czNace: string[]): boolean {
  return czNace.some((k) => {
    const o = oddilNace(k);
    return o !== null && VYLOUCENE_ODDILY.has(o);
  });
}

export function jeKancelarskyObor(czNace: string[]): boolean {
  return czNace.some((k) => {
    const o = oddilNace(k);
    return o !== null && KANCELARSKE_ODDILY.has(o);
  });
}

/** Body za velikost — střední podnik je nejlepší zákazník (SPEC 10.2). */
const BODY_SEGMENT: Record<Segment, number> = {
  mikro: 12,
  stredni: 25,
  korporat: 18,
};

/**
 * Skóre vhodnosti firmy 0–100 (SPEC 10.1).
 * Vzdálenost 30 · velikost 25 · absence vlastní jídelny 15 ·
 * kancelářský obor 12 · poptávková adresa 8 · živý nábor 10.
 *
 * **Neznámá vzdálenost se nepočítá jako nula metrů.** Firma sebraná nad
 * nakreslenou oblastí k žádné jídelně nepatří (o přiřazení rozhoduje
 * samostatná funkce), takže vzdálenost prostě není. Kdyby se dosadila nula,
 * dostala by plných 30 bodů za blízkost, kterou nikdo nezměřil — přesně ten
 * druh dohadu, který zakazuje TP-2.
 *
 * Místo toho vypadne z čitatele i ze jmenovatele a výsledek se přepočte na
 * touž stupnici: skóre je **podíl získaných bodů z těch dosažitelných**.
 * Firma se známou vzdáleností má dosažitelných 100, takže jí přepočet nic
 * nemění. Bez přepočtu by firma z oblasti mohla dosáhnout nejvýš na 70 a
 * v setříděném seznamu by prohrála i s průměrnou firmou u jídelny, ať je
 * jakkoli dobrá.
 */
export function spocitejSkore(v: SkoreVstup): number {
  const vzdalenost =
    v.vzdalenostM === null
      ? null
      : Math.round(30 * (1 - Math.min(v.vzdalenostM, 3000) / 3000));

  // Neuvedená velikost nedostane žádné body — nevíme, tedy neodhadujeme (TP-2).
  const velikost = v.segment ? BODY_SEGMENT[v.segment] : 0;

  const jidelna =
    v.maVlastniJidelnu === false ? 15 : v.maVlastniJidelnu === null ? 7 : 0;

  const obor = jeKancelarskyObor(v.czNace) ? 12 : 0;

  const adresa =
    v.urovenAdresy === 1 ? 8 : v.urovenAdresy === 2 ? 4 : v.urovenAdresy === 3 ? 2 : 0;

  // Kdo právě nabírá, ten prokazatelně provozuje a má lidi.
  const mist = v.nabizenychMist ?? 0;
  const nabor = mist >= 5 ? 10 : mist >= 2 ? 7 : mist >= 1 ? 4 : 0;

  const ziskano = (vzdalenost ?? 0) + velikost + jidelna + obor + adresa + nabor;
  const dosazitelne = vzdalenost === null ? 70 : 100;

  return Math.round((100 * ziskano) / dosazitelne);
}
