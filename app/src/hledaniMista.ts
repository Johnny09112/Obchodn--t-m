/**
 * Hledání místa podle jména (Nominatim, OpenStreetMap).
 *
 * Dvě omezení, která se musí dodržet:
 *
 * 1. **Nejvýš jeden dotaz za sekundu.** Odkládání psaní řeší volající
 *    (`MapaOblasti`), tahle funkce se ptá pokaždé, když ji zavoláš.
 * 2. **Hlavičku `User-Agent` prohlížeč měnit nedovolí.** Nominatim v takovém
 *    případě identifikuje volajícího podle adresy stránky, což jeho
 *    podmínkám odpovídá. Kontaktní e-mail, jak ho posílá jádro, se tady
 *    nastavit nedá.
 *
 * `fetchFn` se dá podstrčit kvůli testům — ty pak neodesílají nic do sítě.
 */
export interface Misto {
  nazev: string;
  lat: number;
  lng: number;
}

const ADRESA = "https://nominatim.openstreetmap.org/search";

export async function najdiMisto(
  dotaz: string,
  fetchFn: typeof fetch = fetch,
): Promise<Misto[]> {
  const q = dotaz.trim();
  if (!q) return [];

  try {
    const url = `${ADRESA}?format=json&limit=5&countrycodes=cz&q=${encodeURIComponent(q)}`;
    const odpoved = await fetchFn(url);
    if (!odpoved.ok) return [];

    const data = (await odpoved.json()) as
      | { display_name?: string; lat?: string; lon?: string }[]
      | null;
    if (!Array.isArray(data)) return [];

    return data
      .map((r) => ({
        nazev: r.display_name ?? "",
        lat: Number(r.lat),
        lng: Number(r.lon),
      }))
      // Souřadnice z cizí služby se neberou na slovo — nesmysl by poslal
      // mapu do prázdna a vypadalo by to jako chyba aplikace.
      .filter((m) => m.nazev !== "" && Number.isFinite(m.lat) && Number.isFinite(m.lng));
  } catch {
    // Cizí služba občas neodpoví. Rozbít kvůli tomu celou obrazovku by
    // bylo horší než nenajít obec.
    return [];
  }
}
