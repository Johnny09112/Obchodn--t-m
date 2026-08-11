/**
 * Ano / ne / nevíme — pro údaje, u kterých je **nenalezení něco jiného než
 * ne**.
 *
 * Vzniklo z nálezu 10. 8. 2026: v ostré kartotéce byla mateřská škola,
 * která má v evidenci doloženo „ano – v budově je vlastní kuchyně", ale
 * ve sloupci `companies.ma_vlastni_jidelnu` měla `false`. Fakt otočený
 * naruby — a přesně podle toho sloupce se rozhoduje, komu obědy
 * nenabízet.
 *
 * Příčinou téhle třídy chyb je převod typu `hodnota === "true"`: cokoli,
 * co není přesně „true", se tiše stane `false`. Tedy i „ano", i
 * „pravděpodobně", i překlep. **Nevíme se převleče za ne.**
 *
 * Proto se tady nic netipuje: co nejde jednoznačně přečíst, zůstává
 * `null`. Prázdno je poctivější než nesprávná jistota (SPEC kap. 5.1:
 * „bez zdroje zůstává NULL, žádné odhady").
 */

const ANO = [
  "true", "ano", "yes", "t", "y", "1",
  "má", "ma", "mame", "máme", "vlastní", "vlastni",
];

const NE = [
  "false", "ne", "no", "f", "n", "0",
  "nemá", "nema", "nemáme", "nemame", "žádná", "zadna",
];

/** Srovnávací tvar: malými písmeny, bez diakritiky, bez okrajových mezer. */
function srovnej(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Přečte hodnotu jako ano / ne / nevíme.
 *
 * Rozhoduje **první slovo**, ne celý řetězec — agent píše „ano – v budově
 * je vlastní kuchyně" nebo „ne, stravenky", tedy odpověď následovaná
 * zdůvodněním. Hledat podřetězec kdekoli by naopak bylo nebezpečné:
 * „nemáme vlastní jídelnu" obsahuje slovo „vlastní" a vyšlo by z toho ano.
 *
 * Vrací `null`, když si není jistá. To je **správný výsledek**, ne selhání.
 */
export function naTriStav(hodnota: string | null | undefined): boolean | null {
  if (hodnota == null) return null;
  const cely = srovnej(hodnota);
  if (cely === "") return null;

  // Oddělí odpověď od zdůvodnění: „ano – …", „ne, …", „ano (kantýna)".
  const prvni = cely.split(/[\s,;:.()–—-]+/)[0] ?? "";

  if (NE.includes(prvni)) return false;
  if (ANO.includes(prvni)) return true;
  return null;
}

/**
 * Sloupce, jejichž hodnota se čte přes `naTriStav` místo přímého převodu
 * typu. Kdo sem přidá sloupec, musí ho mít v databázi jako `boolean`
 * s dovoleným `null`.
 */
export const TRISTAVOVE_SLOUPCE = new Set(["ma_vlastni_jidelnu"]);
