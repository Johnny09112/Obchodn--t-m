/**
 * Kvalifikace kandidáta — chceme tuhle firmu vůbec oslovit?
 *
 * Sdílené oběma cestami sběru — kolem jídelny (`cmuchal.ts`) i nad
 * nakreslenou oblastí (`cmuchal-oblast.ts`). Kdyby to měla každá po svém,
 * přidání pravidla do blacklistu by změnilo jednu cestu a druhou ne. A to
 * mlčky.
 *
 * Nepatří sem nic o vzdálenosti ani o jídelně — to je otázka „kde", ne „kdo".
 *
 * Proč tři fáze, ne jedna funkce se vším najednou: cesta kolem jídelny
 * (`zpracujKandidata`) ověřuje IČO a partnerskou jídelnu JEŠTĚ PŘED drahým
 * dotazem do ARES (ať se na zjevně nechtěné kandidáty vůbec netahá
 * rejstřík) a velikost ze statistického registru dotahuje AŽ PO právní
 * formě, blacklistu a oboru (ať se na blacklistovanou firmu neplýtvá dalším
 * síťovým dotazem navíc). Kdyby `kvalifikujFirmu` chtěla všechna data
 * najednou, tohle pořadí — a s ním chování staré cesty — by se muselo
 * změnit. Fáze proto jdou volat samostatně (`zpracujKandidata`) i naráz přes
 * `kvalifikujFirmu` (`zpracujFirmuVOblasti`, které ARES ověřuje jen jednou
 * a chce vědět rovnou všechno).
 */
import type { AresZaznam } from "./ares.js";
import { naBlacklistu, type Pravidlo } from "./blacklist.js";
import { jeBytovyDum, popisFormy } from "./formy.js";
import { jeValidniIco } from "./ico.js";
import { oborProchazi, type Profil } from "./profil.js";
import type { DuvodVyrazeni } from "./repo.js";
import { splnujeMinimum, type ResUdaje } from "./res.js";

export type ZdrojKvalifikace = "mpsv" | "osm" | "ares" | "registr";

export type VysledekKvalifikace =
  | { ok: true; podLimitem?: boolean }
  | { ok: false; duvod: DuvodVyrazeni; detail?: string };

/** Fáze 1 — jde posoudit ještě bez dotazu do ARES. */
export function kvalifikujIdentitu(v: {
  ico: string;
  /** Naše vlastní partnerské jídelny — vaří nám, nejsou zákazník. */
  partnerskaIca: ReadonlySet<string>;
}): VysledekKvalifikace {
  if (!jeValidniIco(v.ico)) {
    return { ok: false, duvod: "neplatne_ico", detail: `IČO ${v.ico} neprošlo kontrolním součtem` };
  }
  if (v.partnerskaIca.has(v.ico)) {
    return {
      ok: false,
      duvod: "partnerska_jidelna",
      detail: "je to naše partnerská jídelna, ne zákazník",
    };
  }
  return { ok: true };
}

/** Fáze 2 — právní forma, ruční blacklist majitele, obor podle profilu. */
export function kvalifikujObor(v: {
  ico: string;
  ares: Pick<AresZaznam, "nazev" | "pravniForma" | "czNace">;
  blacklist: readonly Pravidlo[];
  profil: Profil;
}): VysledekKvalifikace {
  // Bytový dům (společenství vlastníků, bytové družstvo) zaměstnance formálně
  // má — správce, úklid —, ale nikdo tam neobědvá.
  if (jeBytovyDum(v.ares.pravniForma)) {
    return { ok: false, duvod: "bytovy_dum", detail: popisFormy(v.ares.pravniForma) ?? "bytový dům" };
  }

  // Ruční pravidla majitele.
  const pravidlo = naBlacklistu(v.blacklist, {
    ico: v.ico,
    nazev: v.ares.nazev,
    czNace: v.ares.czNace,
    pravniForma: v.ares.pravniForma,
  });
  if (pravidlo) {
    return { ok: false, duvod: "blacklist", detail: pravidlo.duvod };
  }

  // Obor podle profilu projektu.
  if (!oborProchazi(v.profil, v.ares.czNace)) {
    return { ok: false, duvod: "vylouceny_obor", detail: `CZ-NACE ${v.ares.czNace.join(", ")}` };
  }

  return { ok: true };
}

/** Fáze 3 — velikost podle statistického registru. */
export function kvalifikujVelikost(v: {
  resUdaje: ResUdaje | null;
  /**
   * Kontrola „neuvedena_velikost" platí jen pro sweep ARES — sweep je hodně
   * zašuměný, z něj bereme jen doložené zaměstnavatele. U ostatních zdrojů
   * (registr ČSÚ, MPSV, OSM) je neuvedená velikost běžná a sama o sobě nic
   * neznamená.
   */
  zdroj: ZdrojKvalifikace;
  minZamestnancu: number;
}): VysledekKvalifikace {
  if (v.resUdaje?.bezZamestnancu) {
    return { ok: false, duvod: "bez_zamestnancu", detail: "statistický registr: bez zaměstnanců" };
  }
  if (v.zdroj === "ares" && v.resUdaje?.segment === null) {
    return {
      ok: false,
      duvod: "neuvedena_velikost",
      detail: "velikost neuvedena a jediným zdrojem je sweep rejstříku",
    };
  }

  // Mikropodniky se UKLÁDAJÍ — cílí se na ně jinou formou reklamy než
  // e-mailem. Práh proto neřídí, co se uloží, ale co se zařadí do fronty
  // na oslovení (volající si `podLimitem` promítne do vlastní evidence).
  const podLimitem = splnujeMinimum(v.resUdaje?.kategorieKod ?? null, v.minZamestnancu) === false;
  return { ok: true, podLimitem };
}

/** Proč firmu neoslovovat, i když v území leží. */
export type DuvodNeoslovovat =
  | "partnerska_jidelna"
  | "bytovy_dum"
  | "blacklist"
  | "vlastni_jidelna";

export interface Neoslovovat {
  duvod: DuvodNeoslovovat;
  detail: string;
}

/**
 * Důvody „tuhle firmu neoslovovat", které platí **trvale** — nezávisle na
 * profilu projektu i na tom, odkud se firma vzala — a dají se posoudit rovnou
 * z kartotéky, bez jediného dotazu ven.
 *
 * K čemu to je: seznam firem v oblasti (`oblast_firmy`) se plní podle
 * geometrie, tedy bez ptaní. Cesta z něj do kampaně (`naplnZOblasti`) proto
 * potřebuje vlastní síto — jinak by kampaň nabídla firmu, kterou majitel
 * mezitím dal na blacklist, nebo školu, která se stala partnerem až potom.
 *
 * Proč to není `kvalifikujFirmu`: ta odpovídá na otázku „přijmout kandidáta
 * do kartotéky?" a její součástí je obor podle profilu a velikost. Tady jde
 * o jinou otázku — „vložit už přijatou firmu do seznamu k oslovení?" —
 * a obor ani velikost do ní schválně nepatří: firma posbíraná za jednoho
 * profilu by po přepnutí profilu z kampaně tiše zmizela. Co komu vyhovuje
 * velikostí a oborem, si člověk vybere při schvalování kampaně; tyhle čtyři
 * důvody vybírat nejde, ty platí vždycky.
 *
 * Vrací `null`, když firmě nic nebrání.
 */
export function duvodNeoslovovat(v: {
  ico: string;
  nazev: string;
  czNace: readonly string[];
  pravniForma: string | null;
  /** `null` znamená „nevíme", ne „nemá" — na dohad se firma nevyřazuje (TP-2). */
  maVlastniJidelnu: boolean | null;
  partnerskaIca: ReadonlySet<string>;
  blacklist: readonly Pravidlo[];
}): Neoslovovat | null {
  if (v.partnerskaIca.has(v.ico)) {
    return { duvod: "partnerska_jidelna", detail: "je to naše partnerská jídelna, ne zákazník" };
  }
  if (jeBytovyDum(v.pravniForma)) {
    return { duvod: "bytovy_dum", detail: popisFormy(v.pravniForma) ?? "bytový dům" };
  }
  const pravidlo = naBlacklistu(v.blacklist, {
    ico: v.ico,
    nazev: v.nazev,
    czNace: v.czNace,
    pravniForma: v.pravniForma,
  });
  if (pravidlo) {
    return { duvod: "blacklist", detail: pravidlo.duvod };
  }
  if (v.maVlastniJidelnu === true) {
    return { duvod: "vlastni_jidelna", detail: "má doloženou vlastní jídelnu" };
  }
  return null;
}

/**
 * Chceme tuhle firmu vůbec oslovit?
 *
 * Všechny tři fáze naráz — pro cestu, která ARES ověřuje jen jednou a chce
 * vědět hned všechno (`zpracujFirmuVOblasti`, volá se hned po ověření v
 * ARES a před zaměřováním adresy). Cesta kolem jídelny (`zpracujKandidata`)
 * volá fáze zvlášť — viz komentář v hlavičce souboru, proč.
 */
export function kvalifikujFirmu(v: {
  ico: string;
  partnerskaIca: ReadonlySet<string>;
  ares: Pick<AresZaznam, "nazev" | "pravniForma" | "czNace">;
  blacklist: readonly Pravidlo[];
  profil: Profil;
  resUdaje: ResUdaje | null;
  zdroj: ZdrojKvalifikace;
  minZamestnancu: number;
}): VysledekKvalifikace {
  const identita = kvalifikujIdentitu(v);
  if (!identita.ok) return identita;

  const obor = kvalifikujObor(v);
  if (!obor.ok) return obor;

  return kvalifikujVelikost(v);
}
