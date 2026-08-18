/**
 * Složení zprávy pro kampaň — náhled, ne odesílání.
 *
 * Kampaň si vybere šablonu a určí, čím se vyplní jednotlivá pole
 * (`nastaveni_pole`). Tenhle modul z toho složí hotový text pro konkrétní
 * firmu a řekne, komu se poslat nedá a proč.
 *
 * **Nic neodesílá ani nepřipravuje k odeslání.** Odesílání je vypnuté
 * (TP-8) a fáze 3; tady vzniká jen náhled pro člověka.
 *
 * Zadání: docs/superpowers/specs/2026-08-18-nastaveni-zpravy-design.md
 */

import type { Db } from "./db.js";
import { slozText, vzdalenostSlovy, type NastaveniPole } from "./text-zpravy.js";

/**
 * Cena, která půjde do zprávy.
 *
 * Rozhodl majitel 18. 8. 2026: **cena pro firmu je cena oběda plus naše
 * provize.** Mají-li všechny dotčené jídelny stejnou, píše se bez „od";
 * liší-li se, vezme se nejnižší a předřadí „od". Všichni adresáti jedné
 * kampaně tak dostanou totéž číslo — líp se to kontroluje a nižší cenou
 * se nikdo nepoškodí.
 *
 * **Dotčená jídelna** je ta, která má v zóně aspoň jednu firmu z oblastí
 * kampaně. Ne každá jídelna v území: firmy, které z kampaně vypadly,
 * cenu neovlivňují. Jídelna bez vyplněné ceny se do výpočtu nepočítá —
 * místo toho vyřadí své firmy, protože povinné pole nemá čím vyplnit.
 *
 * Vrací `null`, když se cena nemá odkud vzít. Nula by tvrdila, že je jídlo
 * zdarma.
 */
export async function cenaKampane(db: Db, kampanId: string): Promise<string | null> {
  const r = await db.query<{ celkem: string }>(
    `select distinct
            (co.hodnota::numeric + coalesce(pr.hodnota::numeric, 0))::int as celkem
       from kampan_oblasti ko
       join oblast_firmy of on of.oblast_id = ko.oblast_id
       join dosah d on d.ico = of.ico and d.v_zone
       join jidelny j on j.id = d.jidelna_id
       join parametry_nabidky pco
         on pco.kod = 'cena_obeda' and pco.produkt_kod = 'cantinero'
       join hodnoty_parametru co
         on co.nabidka_id = j.nabidka_id and co.parametr_id = pco.id
       left join parametry_nabidky ppr
         on ppr.kod = 'provize' and ppr.produkt_kod = 'cantinero'
       left join hodnoty_parametru pr
         on pr.nabidka_id = j.nabidka_id and pr.parametr_id = ppr.id
      where ko.kampan_id = $1`,
    [kampanId],
  );
  if (r.length === 0) return null;

  const ceny = r.map((x) => Number(x.celkem));
  const nejnizsi = Math.min(...ceny);
  const stejne = ceny.every((c) => c === nejnizsi);
  return `${stejne ? "" : "od "}${nejnizsi} Kč`;
}

export interface StavFirmy {
  ico: string;
  nazev: string;
  /** Co firmě brání v oslovení. Prázdné = je připravená. */
  chybi: string[];
}

/**
 * Kdo se v kampani osloví a kdo ne.
 *
 * Rozhodl majitel 18. 8. 2026: chybějící **jméno** firmu nevyřazuje
 * (osloví se „Dobrý den,"), chybějící **jiný povinný údaj** ano — a musí
 * být vidět, co jí chybí.
 *
 * Povinnost se čte z `pole_sablony.povinne`, ne ze seznamu v kódu. Kdyby
 * byla na dvou místech, rozejdou se (past „tri-kopie-seznamu-atributu").
 *
 * E-mail není pole šablony, a přesto vyřazuje: bez adresy není kam napsat.
 * Je to podmínka odeslání, ne údaj ve zprávě.
 */
export async function firmyKOsloveni(
  db: Db,
  kampanId: string,
): Promise<{ pripravene: StavFirmy[]; vyrazene: StavFirmy[] }> {
  // Pravidlo „co firmě chybí" počítá databáze (migrace 0050), ne tenhle
  // modul — musí platit stejně pro příkazovou řádku i pro obrazovku
  // kampaně, a ta na jádro nedosáhne.
  const firmy = await db.query<{ ico: string; nazev: string; chybi: string[] }>(
    "select ico, nazev, chybi from nahled_kampane($1)",
    [kampanId],
  );

  const pripravene: StavFirmy[] = [];
  const vyrazene: StavFirmy[] = [];
  for (const f of firmy) {
    const stav: StavFirmy = { ico: f.ico, nazev: f.nazev, chybi: f.chybi ?? [] };
    if (stav.chybi.length === 0) pripravene.push(stav);
    else vyrazene.push(stav);
  }
  return { pripravene, vyrazene };
}

export interface Nastaveni {
  kod: string;
  rezim: "z_dat" | "pevne" | "vynechat";
  hodnota: string | null;
}

/** Uloží, čím se pole u kampaně vyplní. Používá se z příkazové řádky i z testů. */
export async function nastavPole(
  db: Db,
  kampanId: string,
  kodPole: string,
  rezim: Nastaveni["rezim"],
  hodnota: string | null,
): Promise<void> {
  const [pole] = await db.query<{ id: string }>(
    `select p.id from pole_sablony p
       join kampane k on k.template_id = p.template_id
      where k.id = $1 and p.kod = $2`,
    [kampanId, kodPole],
  );
  if (!pole) throw new Error(`Šablona kampaně nezná pole „${kodPole}".`);

  await db.query(
    `insert into nastaveni_pole (kampan_id, pole_id, rezim, hodnota)
     values ($1, $2, $3, $4)
     on conflict (kampan_id, pole_id) do update
       set rezim = excluded.rezim, hodnota = excluded.hodnota`,
    [kampanId, pole.id, rezim, hodnota],
  );
}

export interface Nahled {
  predmet: string;
  telo: string;
  /** Proč se zpráva neodešle. Prázdné = je připravená. */
  chybi: string[];
}

/**
 * Složí náhled zprávy pro konkrétní firmu.
 *
 * **Nic neodesílá.** Vrací text tak, jak by vypadal, a seznam důvodů, proč
 * by se neodeslal. Kontrolu stylu (SPEC kap. 6) na složený text pouští
 * volající — hlídá ji test, aby se personalizací nedalo pravidla obejít.
 */
export async function slozZpravu(db: Db, kampanId: string, ico: string): Promise<Nahled> {
  // Kampaň založená dřív, než se šablony zavedly, `template_id` nemá.
  // Ustoupí se na schválenou šablonu — stejně jako `firmyKOsloveni`, ať
  // náhled a výčet firem nemluví každý o jiném textu.
  const [sablona] = await db.query<{ predmet: string | null; telo: string }>(
    `select t.predmet, t.telo from templates t
       join kampane k on k.template_id = t.id
      where k.id = $1
      union all
     select t.predmet, t.telo from templates t
      where t.stav = 'schvaleno'
        and not exists (select 1 from kampane k
                         where k.id = $1 and k.template_id is not null)
      order by 1 limit 1`,
    [kampanId],
  );
  if (!sablona) throw new Error("Není z čeho skládat — kampaň nemá šablonu a žádná není schválená.");

  const { pripravene, vyrazene } = await firmyKOsloveni(db, kampanId);
  const stav = [...pripravene, ...vyrazene].find((f) => f.ico === ico);

  const nastaveni = await db.query<Nastaveni>(
    `select p.kod, n.rezim, n.hodnota
       from nastaveni_pole n
       join pole_sablony p on p.id = n.pole_id
      where n.kampan_id = $1`,
    [kampanId],
  );
  const [udaje] = await db.query<{
    prijmeni: string | null;
    oznaceni: string | null;
    vzdalenostM: number | null;
  }>(
    `select (select k.prijmeni from contacts k
              where k.ico = $1 and k.email is not null and k.email <> ''
              order by (k.prijmeni is null) limit 1) as prijmeni,
            (select e.hodnota from evidence e
              where e.ico = $1 and e.atribut = 'oznaceni' limit 1) as oznaceni,
            (select min(d.vzdalenost_m) from dosah d
              where d.ico = $1 and d.v_zone) as "vzdalenostM"`,
    [ico],
  );

  // Skládá `text-zpravy.ts` — týž kód, jaký použije obrazovka kampaně.
  // Dvě implementace by znamenaly dva různé maily pod jedním jménem.
  const telo = slozText(sablona.telo, nastaveni as NastaveniPole[], {
    prijmeni: udaje?.prijmeni ?? null,
    oznaceni: udaje?.oznaceni ?? null,
    vzdalenostM: udaje?.vzdalenostM != null ? Number(udaje.vzdalenostM) : null,
    cena: await cenaKampane(db, kampanId),
  });

  return { predmet: sablona.predmet ?? "", telo, chybi: stav?.chybi ?? [] };
}
