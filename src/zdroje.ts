/**
 * Odkud údaj pochází — a jak moc se na něj dá spolehnout.
 *
 * Majitel rozhodl 10. 8. 2026: údaj z katalogu se **smí** zapsat, ale musí
 * být poznat, že je z katalogu. Tenhle modul je jediné místo, které o tom
 * rozhoduje — kdo potřebuje vědět „odkud to je", ptá se sem, ne vlastním
 * seznamem domén. (Tři kopie jednoho seznamu už tenhle projekt jednou
 * stály celý cyklus.)
 *
 * Třída se **neukládá** — plyne z `evidence.zdroj_url`, takže nemůže
 * zastarat ani se rozejít s daty. Ukládá se jen `confidence`, aby se dalo
 * řadit a filtrovat bez počítání nad textem URL.
 */

/** Třída zdroje, seřazená od nejsilnější. */
export type TridaZdroje = "urad" | "web-firmy" | "katalog";

/**
 * Úřední a otevřená data. Nejsilnější zdroj: údaj tam vyplnil sám
 * zaměstnavatel nebo úřad a nese odpovědnost za jeho správnost.
 */
const URADY = [
  "data.mpsv.cz",
  "ares.gov.cz",
  "justice.cz",
  "smlouvy.gov.cz",
  "rzp.gov.cz",
  "isir.justice.cz",
  "cuzk.cz",
  "risy.cz",
];

/**
 * Katalogy a agregátory. Údaj je opsaný odjinud, často zastaralý a nikdo
 * za něj neručí. Zapsat se smí, ale má být poznat.
 *
 * Nepatří sem weby dodavatelů (reference na vlastním webu jsou jejich
 * vlastní tvrzení, ne opis) ani pracovní portály s inzerátem zaměstnavatele.
 */
const KATALOGY = [
  "firmy.cz",
  "ifirmy.cz",
  "kurzy.cz",
  "epoptavka.cz",
  "edb.cz",
  "zivefirmy.cz",
  "merk.cz",
  "kompass.com",
  "informaceofirmach.cz",
  "detail.edb.cz",
  "najisto.centrum.cz",
  "rejstrik-firem.cz",
  "obchodnirejstrik.cz",
  "vsechnyfirmy.cz",
  "info-cechy.cz",
  "ochutnejkraj.cz",
];

/** Hostitel z URL, malými písmeny a bez `www.`. Vrací null u nesmyslu. */
export function hostitel(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Do které třídy zdroj patří.
 *
 * Porovnává se na hranici domény, ne `includes` — jinak by `firmy.cz`
 * chytlo i `mojefirmy.cz.example.com` a naopak by `rejstrik-firem.kurzy.cz`
 * neprošlo jako katalog, přestože `kurzy.cz` je jeho doména druhého řádu.
 */
export function tridaZdroje(url: string): TridaZdroje {
  const host = hostitel(url);
  if (!host) return "katalog"; // neznámý tvar radši podceň, než přeceň
  if (URADY.some((d) => jeDomenou(host, d))) return "urad";
  if (KATALOGY.some((d) => jeDomenou(host, d))) return "katalog";
  return "web-firmy";
}

/** Je `host` tou doménou, nebo její poddoménou? */
function jeDomenou(host: string, domena: string): boolean {
  return host === domena || host.endsWith(`.${domena}`);
}

/**
 * Výchozí spolehlivost podle třídy zdroje, na stupnici 0–1, kterou má
 * sloupec `evidence.confidence` (podmínka v 0001_init.sql).
 *
 * Čísla jsou **záměrně hrubá** — mají odlišit tři třídy, ne předstírat
 * přesnost. Až přibude počítání nezávislých potvrzení, bude tohle jen
 * výchozí hodnota, kterou potvrzení zvednou.
 */
export function spolehlivostZdroje(url: string): number {
  switch (tridaZdroje(url)) {
    case "urad":
      return 0.9;
    case "web-firmy":
      return 0.8;
    case "katalog":
      return 0.5;
  }
}

/** Lidsky, do výpisu a na obrazovku. */
export function popisZdroje(url: string): string {
  switch (tridaZdroje(url)) {
    case "urad":
      return "úřední zdroj";
    case "web-firmy":
      return "web firmy";
    case "katalog":
      return "katalog — údaj je opsaný, nikdo za něj neručí";
  }
}
