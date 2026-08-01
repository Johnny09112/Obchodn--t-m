/**
 * Jak popsat oblast člověku.
 *
 * Čistý modul bez databáze — stejný vzor jako `pruzkum-postup.ts`. Věty
 * vznikají tady, ne v komponentě, aby šly otestovat a aby zněly stejně
 * v seznamu, v mapě i kdekoli jinde.
 *
 * Co oblast brání smazat, řeší `oblast-vyuziti.ts`.
 */

export interface PopisTvaru {
  typ: string;
  polomerM: number | null;
  /** Počet bodů nakresleného tvaru; u kruhu null. */
  bodu: number | null;
}

export interface PopisPruzkumu {
  /** Kolik průzkumů se nad oblastí objednalo celkem. */
  pruzkumu: number;
  /** Stav toho nejnovějšího. */
  posledniStav: string | null;
  /** Kdy se u něj naposled něco stalo, v ISO. */
  posledniAt?: string | null;
}

/** „kruh 6,0 km" nebo „tvar o 8 bodech". */
export function popisTvaru(t: PopisTvaru): string {
  if (t.typ === "kruh") {
    if (t.polomerM === null) return "kruh";
    return `kruh ${(t.polomerM / 1000).toFixed(1).replace(".", ",")} km`;
  }
  if (t.bodu === null) return "nakreslený tvar";
  return `tvar o ${t.bodu} ${bodyTvar(t.bodu)}`;
}

/** 1 bodu · 2–4 bodech · 5+ bodech — pád je stejný, mění se jen jednotka. */
function bodyTvar(n: number): string {
  return n === 1 ? "bodu" : "bodech";
}

/**
 * Věta o průzkumu oblasti: kdy naposled, nebo že žádný nebyl.
 *
 * `ted` se předává schválně — jinak by se věta „prozkoumaná dnes" nedala
 * otestovat a záviselo by na tom, kdy test poběží.
 */
export function popisPruzkumu(p: PopisPruzkumu, ted: Date): string {
  if (p.pruzkumu === 0 || p.posledniStav === null) return "Zatím neprozkoumaná";

  const kdy = kdyBylo(p.posledniAt ?? null, ted);
  const opakovani = p.pruzkumu > 1 ? `, celkem ${p.pruzkumu}×` : "";

  switch (p.posledniStav) {
    case "hotovo":
      return `Prozkoumaná ${kdy}${opakovani}`;
    case "selhalo":
      return `Průzkum selhal ${kdy}${opakovani}`;
    // U čekajícího a běžícího je datum k ničemu — zajímá, že se něco děje.
    // Jak dlouho už a co zrovna, ukazuje proužek postupu.
    case "ceka":
      return "Průzkum čeká ve frontě";
    case "bezi":
      return "Průzkum právě běží";
    case "ceka_na_rozhodnuti":
      return "Průzkum čeká na rozhodnutí";
    default:
      return `Průzkum ve stavu „${p.posledniStav}“`;
  }
}

/** „dnes", „včera" nebo datum. Bez data „kdysi" — lhát se nebude. */
function kdyBylo(iso: string | null, ted: Date): string {
  if (!iso) return "kdysi";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "kdysi";

  const dnu = rozdilDnu(d, ted);
  if (dnu === 0) return "dnes";
  if (dnu === 1) return "včera";
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}

/** Kolik kalendářních dnů zpátky — ne kolik hodin uplynulo. */
function rozdilDnu(od: Date, do_: Date): number {
  const a = new Date(od.getFullYear(), od.getMonth(), od.getDate());
  const b = new Date(do_.getFullYear(), do_.getMonth(), do_.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
