/**
 * Právní forma subjektu podle oficiálního číselníku ARES „PravniForma"
 * (POST /ciselniky-nazevniky/vyhledat, zdroj `res` — 141 položek).
 *
 * Proč to potřebujeme: sweep rejstříku vrací všechno, co v obci sídlí, a
 * mnoho z toho nejsou zaměstnavatelé. Bytový dům „zaměstnance" formálně má,
 * ale obědy tam nikdo neodebírá; živnostník je jeden člověk, ne firma.
 * Rozlišit se to podle názvu nedá spolehlivě — právní forma je tvrdý údaj.
 *
 * Zapisujeme celý kód, ne jen odvozený příznak: kdyby se pravidla měla brousit
 * jinak, nemusí se kvůli tomu znovu obcházet rejstřík.
 */

/** Podmnožina číselníku, kterou skutečně používáme — doplňuj podle potřeby. */
const NAZVY: Record<string, string> = {
  // Pozor: zdroje ARES si u „100" protiřečí — obchodní rejstřík mu říká
  // „Podnikající fyzická osoba tuzemská", živnostenský „Fyzická osoba
  // nepodnikající". Popisujeme obojí, ať se nikdo nespoléhá na jeden výklad.
  "100": "Fyzická osoba (zdroje rejstříku se v označení rozcházejí)",
  "101": "Fyzická osoba podnikající dle živnostenského zákona",
  "102": "Fyzická osoba podnikající dle živnostenského zákona zapsaná v obchodním rejstříku",
  "103": "Samostatně hospodařící rolník nezapsaný v obchodním rejstříku",
  "104": "Samostatně hospodařící rolník zapsaný v obchodním rejstříku",
  "105": "Fyzická osoba podnikající dle jiných zákonů než živnostenského a zákona o zemědělství",
  "106": "Fyzická osoba podnikající dle jiných zákonů než živnostenského a zákona o zemědělství zapsaná v obchodním rejstříku",
  "107": "Zemědělský podnikatel - fyzická osoba",
  "108": "Zemědělský podnikatel - fyzická osoba zapsaná v obchodním rejstříku",
  "111": "Veřejná obchodní společnost",
  "112": "Společnost s ručením omezeným",
  "113": "Společnost komanditní",
  "121": "Akciová společnost",
  "141": "Obecně prospěšná společnost",
  "145": "Společenství vlastníků jednotek",
  "161": "Ústav",
  "205": "Družstvo",
  "231": "Výrobní družstvo",
  "232": "Spotřební družstvo",
  "233": "Bytové družstvo",
  "234": "Jiné družstvo",
  "301": "Státní podnik",
  "325": "Organizační složka státu",
  "331": "Příspěvková organizace",
  "332": "Státní příspěvková organizace",
  "421": "Odštěpný závod zahraniční právnické osoby",
  "424": "Zahraniční fyzická osoba",
  "425": "Odštěpný závod zahraniční fyzické osoby",
  "601": "Vysoká škola (veřejná, státní)",
  "611": "Střední škola",
  "621": "Základní škola",
  "625": "Školské zařízení",
  "631": "Předškolní zařízení",
  "641": "Školská právnická osoba",
  "651": "Zdravotnické zařízení",
  "701": "Sdružení (svaz, spolek, společnost, klub aj.)",
  "706": "Spolek",
  "707": "Odborová organizace",
  "736": "Pobočný spolek",
  "751": "Zájmové sdružení právnických osob",
  "771": "Dobrovolný svazek obcí",
  "801": "Obec nebo městská část hlavního města Prahy",
  "804": "Kraj a hl.m.Praha",
  "811": "Městská část, městský obvod",
};

/**
 * Bytový dům v právním kabátě: společenství vlastníků nebo bytové družstvo.
 * Formálně zaměstnavatel (správce, úklid), fakticky nikdo, kdo obědvá v práci.
 *
 * Pozor: družstvo obecně (205) sem NEPATŘÍ — výrobní a spotřební družstva
 * jsou normální zaměstnavatelé.
 */
export function jeBytovyDum(kod: string | null | undefined): boolean {
  return kod === "145" || kod === "233";
}

/**
 * Fyzická osoba, ne firma. Kódy 101–108 jsou v číselníku všechno fyzické
 * osoby, liší se jen zákonem, podle kterého podnikají; 424/425 jsou jejich
 * zahraniční obdoby.
 *
 * Kód 100 je past: obchodní rejstřík mu říká „Podnikající fyzická osoba
 * tuzemská", živnostenský „Fyzická osoba nepodnikající". Ať platí kterákoli
 * definice, je pod ním konkrétní člověk vedený jménem — a ten firemní obědy
 * neodebírá. Proto sem patří taky.
 */
export function jeOsvc(kod: string | null | undefined): boolean {
  if (!kod) return false;
  if (kod === "424" || kod === "425") return true;
  return /^10[0-8]$/.test(kod);
}

/** Název formy pro člověka. Neznámý kód nepřekládáme — radši nic než dohad. */
export function popisFormy(kod: string | null | undefined): string | null {
  if (!kod) return null;
  return NAZVY[kod] ?? null;
}
