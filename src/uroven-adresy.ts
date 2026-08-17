/**
 * Úroveň adresy podle TP-6 — pojistka proti nejčastější záměně.
 *
 * TP-6 je **právní žebříček, ne pořadí podle rozhodovací pravomoci**:
 *
 * | Úroveň | Co to je |
 * |---|---|
 * | 1 | adresa nebo formulář zveřejněný pro příjem nabídek (`poptavky@`, `nabidky@`, `obchod@`) |
 * | 2 | obecná firemní adresa (`info@`) |
 * | 3 | jmenná adresa konkrétní osoby — **povinné poučení podle čl. 14 GDPR** |
 *
 * Agent tenhle rozdíl plete: obchodnímu zástupci dá úroveň 1, protože „je to
 * přece kontakt pro nabídky". Jenže `richardbayer@bbs.eu` je jmenná adresa
 * bez ohledu na to, jakou má ten člověk funkci — a zpráva na ni musí nést
 * poučení. V ostré databázi bylo takhle špatně zařazených 5 z 11
 * poptávkových adres (17. 8. 2026).
 *
 * Instrukce v promptu tohle neuhlídá (a už jednou neuhlídala), proto je
 * pravidlo tady v kódu, kudy vede jediná cesta zápisu.
 */

/** Nejkratší jméno, které se smí hledat v adrese. Kratší trefí půlku světa. */
const NEJKRATSI_JMENO = 4;

function bezDiakritiky(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Je adresa jmenná? Hledá se **jen před zavináčem** — příjmení v doméně
 * o adrese nevypovídá nic (firma Vochoc má doménu vochoc.cz, ale `info@`
 * na ní je pořád obecná adresa).
 */
export function jeJmennaAdresa(
  email: string | null | undefined,
  jmeno: string | null | undefined,
  prijmeni: string | null | undefined,
): boolean {
  if (!email) return false;
  const mistni = bezDiakritiky(email.split("@")[0] ?? "");
  if (!mistni) return false;

  return [prijmeni, jmeno]
    .filter((x): x is string => typeof x === "string" && x.trim().length >= NEJKRATSI_JMENO)
    .some((cast) => mistni.includes(bezDiakritiky(cast.trim())));
}

/**
 * Srovná úroveň podle TP-6: jmenná adresa je vždycky 3, ať přišla jakkoli.
 * Nevyplněnou úroveň nedomýšlí — prázdno je jiná informace než odhad.
 */
export function srovnejUroven(
  uroven: 1 | 2 | 3 | number | null | undefined,
  email: string | null | undefined,
  jmeno: string | null | undefined,
  prijmeni: string | null | undefined,
): 1 | 2 | 3 | null {
  if (uroven === null || uroven === undefined) return null;
  if (jeJmennaAdresa(email, jmeno, prijmeni)) return 3;
  return uroven as 1 | 2 | 3;
}
