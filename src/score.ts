export type VelikostKategorie = "mikro" | "mala" | "stredni" | "velka";

export interface SkoreVstup {
  vzdalenostM: number;
  velikostKategorie: VelikostKategorie | string | null;
  maVlastniJidelnu: boolean | null;
  czNace: string[];
  urovenAdresy: 1 | 2 | 3 | null;
}

/** CZ-NACE oddíly s převahou kancelářské práce (informace, finance, odborné služby, administrativa). */
const KANCELARSKE_ODDILY = new Set<string>();
for (const [od, doO] of [
  [58, 66],
  [69, 75],
  [77, 82],
] as const) {
  for (let i = od; i <= doO; i++) KANCELARSKE_ODDILY.add(String(i));
}

const BODY_VELIKOST: Record<string, number> = {
  mikro: 10,
  mala: 18,
  stredni: 25,
  velka: 15,
};

/**
 * Skóre vhodnosti firmy 0–100 (SPEC 10.1): vzdálenost k jídelně (35),
 * velikost (25), absence vlastní jídelny (15), kancelářský obor (15),
 * dostupnost poptávkové adresy (10).
 */
export function spocitejSkore(v: SkoreVstup): number {
  const vzdalenost = Math.round(35 * (1 - Math.min(v.vzdalenostM, 3000) / 3000));

  const velikost =
    v.velikostKategorie === null ? 0 : (BODY_VELIKOST[v.velikostKategorie] ?? 0);

  const jidelna =
    v.maVlastniJidelnu === false ? 15 : v.maVlastniJidelnu === null ? 7 : 0;

  const obor = v.czNace.some((n) => KANCELARSKE_ODDILY.has(n.slice(0, 2)))
    ? 15
    : 0;

  const adresa =
    v.urovenAdresy === 1 ? 10 : v.urovenAdresy === 2 ? 5 : v.urovenAdresy === 3 ? 2 : 0;

  return vzdalenost + velikost + jidelna + obor + adresa;
}
