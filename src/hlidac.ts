/**
 * Hlídač zdrojů — pozná rozbitou čtečku dřív, než se z ticha stane zvyk.
 *
 * **Proč vůbec existuje:** rozbitá čtečka nehlásí chybu. Vrátí nulu. A nula
 * vypadá úplně stejně jako „tento týden se nic nedělo" — systém běží dál,
 * obrazovka je prázdná a nikdo měsíc nepozná, že přišel o zdroj.
 *
 * Tuhle past už tenhle projekt jednou zaplatil: agent dostal zadání, které
 * mu bránilo cokoli zapsat, dávka doběhla s nulou a vypadalo to jako hotová
 * práce ([[tri-kopie-seznamu-atributu]]).
 *
 * **Jak to funguje:** u každého zdroje se drží klouzavý průměr toho, kolik
 * obvykle vydá. Když vydá výrazně míň, ohlásí se to jako podezření na
 * rozbitý zdroj — ne jako výsledek.
 */
import type { Db } from "./db.js";

/**
 * Kolik běhů musí proběhnout, než se „obvyklý objem" bere vážně.
 *
 * Pod touhle hranicí se nehlásí nic: první běh nemá s čím porovnávat
 * a druhý by udělal z jediného výkyvu pravidlo.
 */
const MIN_BEHU = 3;

/**
 * Pod kolik procent obvyklého objemu je to podezřelé.
 *
 * Půlka je schválně hodně nízko. Zdroje kolísají — u inzerátů je jiný
 * leden a jiný červenec — a hlídač, který ječí na běžné výkyvy, se během
 * měsíce začne ignorovat. To je horší než žádný hlídač.
 */
const PRAH = 0.5;

/** Váha nového měření v klouzavém průměru. */
const VAHA_NOVEHO = 0.3;

export interface VysledekHlidky {
  /** Vypadá to na rozbitý zdroj? */
  podezrele: boolean;
  /** Kolik zdroj obvykle vydával. `null` u prvního běhu. */
  obvykly: number | null;
  objem: number;
  behu: number;
  /** Věta pro člověka. `null`, když je všechno v pořádku. */
  duvod: string | null;
}

/**
 * Zaznamená, kolik zdroj vydal, a řekne, jestli to nevypadá na poruchu.
 *
 * Volá se **při každém** čtení zdroje, i když všechno klape — jinak by se
 * neměl z čeho počítat obvyklý objem.
 */
export async function zaznamenejObjem(
  db: Db,
  zdroj: string,
  objem: number,
): Promise<VysledekHlidky> {
  if (!Number.isFinite(objem) || objem < 0) {
    throw new Error(`Hlídač zdrojů: objem musí být nezáporné číslo, přišlo ${objem}.`);
  }

  const predchozi = await db.query<{ obvykly_objem: string; behu: number }>(
    "select obvykly_objem, behu from zdroje_objem where zdroj = $1",
    [zdroj],
  );
  const stav = predchozi[0];
  const obvykly = stav ? Number(stav.obvykly_objem) : null;
  const behu = (stav?.behu ?? 0) + 1;

  const podezrele =
    obvykly !== null && behu > MIN_BEHU && obvykly > 0 && objem < obvykly * PRAH;

  const duvod = podezrele
    ? objem === 0
      ? `Zdroj „${zdroj}" nevrátil nic, obvykle vrací ${Math.round(obvykly!)}. ` +
        `Vypadá to na rozbitou čtečku, ne na prázdný trh.`
      : `Zdroj „${zdroj}" vrátil ${objem}, obvykle vrací ${Math.round(obvykly!)}. ` +
        `To je méně než polovina — stojí za kontrolu.`
    : null;

  // Průměr se posouvá i u podezřelého běhu. Kdyby se zamrzl, trvalý pokles
  // (třeba když úřad zúží dataset) by ječel navždycky a hlídač by se stal
  // šumem, který se ignoruje.
  const novyPrumer =
    obvykly === null ? objem : obvykly * (1 - VAHA_NOVEHO) + objem * VAHA_NOVEHO;

  await db.query(
    `insert into zdroje_objem (zdroj, obvykly_objem, posledni_objem, behu, posledni_beh_at, posledni_podezreni_at)
     values ($1, $2, $3, $4, now(), case when $5 then now() else null end)
     on conflict (zdroj) do update set
       obvykly_objem = $2, posledni_objem = $3, behu = $4, posledni_beh_at = now(),
       posledni_podezreni_at = case when $5 then now() else zdroje_objem.posledni_podezreni_at end`,
    [zdroj, novyPrumer, objem, behu, podezrele],
  );

  return { podezrele, obvykly, objem, behu, duvod };
}

export interface StavZdroje {
  zdroj: string;
  obvykly: number;
  posledni: number;
  behu: number;
  posledniBehAt: Date;
  posledniPodezreniAt: Date | null;
}

/** Přehled pro obrazovku i pro výpis na konzoli. */
export async function stavZdroju(db: Db): Promise<StavZdroje[]> {
  const r = await db.query<{
    zdroj: string;
    obvykly_objem: string;
    posledni_objem: number;
    behu: number;
    posledni_beh_at: Date;
    posledni_podezreni_at: Date | null;
  }>(
    `select zdroj, obvykly_objem, posledni_objem, behu, posledni_beh_at, posledni_podezreni_at
     from zdroje_objem order by zdroj`,
  );
  return r.map((x) => ({
    zdroj: x.zdroj,
    obvykly: Number(x.obvykly_objem),
    posledni: x.posledni_objem,
    behu: x.behu,
    posledniBehAt: x.posledni_beh_at,
    posledniPodezreniAt: x.posledni_podezreni_at,
  }));
}
