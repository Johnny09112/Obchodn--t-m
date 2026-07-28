import { parseArgs } from "node:util";
import { appendFile, readFile } from "node:fs/promises";
import { nactiEnv } from "./env.js";

// Hned na začátku, ať nastavení ze souboru vidí i klienti vytvářené níž.
nactiEnv();

import Anthropic from "@anthropic-ai/sdk";
import { pripojPglite, pripojPostgres, spustMigrace, type Db } from "./db.js";
import { vytvorAresKlienta } from "./ares.js";
import { vytvorGeokoder } from "./geocode.js";
import { vytvorEnricher, type Enricher } from "./enrich.js";
import { spustCmuchala } from "./cmuchal.js";
import { metrikyFaze1, prehledStavu } from "./metriky.js";
import { vygenerujMapu } from "./mapa.js";
import { vytvorResKlienta, type Segment } from "./res.js";
import { vytvorMpsvKlienta } from "./mpsv.js";
import { vytvorOsmKlienta } from "./osm.js";
import { vytvorRegistrKlienta } from "./registr.js";
import { firmyKObohaceni, zapisDavku } from "./nalezy.js";
import { vygenerujKartoteku } from "./kartoteka.js";
import { novePoznatky } from "./playbook.js";
import { doplnKontakty } from "./kontakty.js";
import { prepocitejDosah } from "./dosah.js";
import { rozborZony } from "./zona.js";
import {
  nactiBlacklist, pridejPravidlo, smazPravidlo, type TypPravidla,
} from "./blacklist.js";
import { priradKategorie } from "./kategorie.js";
import {
  firmyVOblasti, prepocitejOblastFirmy, prirad, seznamOblasti, zalozOblast,
  type Oblast,
} from "./oblast.js";
import { vzdalenostM } from "./geo.js";

/**
 * Výchozí je LOKÁLNÍ databáze v `data/` (žádný cloud, žádné náklady).
 * Cloudový Postgres se použije jen tehdy, je-li vyplněná DATABASE_URL.
 */
async function pripojDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) return pripojPostgres(url);
  const dir = process.env.CANTINERO_DATA_DIR ?? "data/pgdata";
  return pripojPglite(dir);
}

function kdeBeziDb(): string {
  return process.env.DATABASE_URL
    ? "vzdálený Postgres (DATABASE_URL)"
    : `lokální databáze (${process.env.CANTINERO_DATA_DIR ?? "data/pgdata"})`;
}

async function cmdMigrate(): Promise<void> {
  const db = await pripojDb();
  try {
    const aplikovane = await spustMigrace(db);
    console.log(`Databáze: ${kdeBeziDb()}`);
    console.log(
      aplikovane.length === 0
        ? "Žádné nové migrace — schéma je aktuální."
        : `Aplikováno migrací: ${aplikovane.join(", ")}`,
    );
  } finally {
    await db.close();
  }
}

async function cmdSeedJidelna(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      nazev: { type: "string" },
      adresa: { type: "string" },
      lat: { type: "string" },
      lng: { type: "string" },
      "kod-obce": { type: "string" },
      obec: { type: "string" },
      kapacita: { type: "string" },
      // IČO provozovatele — brání tomu, aby se partner objevil mezi kandidáty.
      ico: { type: "string" },
      zona: { type: "string", default: "3000" },
    },
  });
  // Kapacita je nepovinná — na sběr dat nemá vliv a vymýšlet ji je horší než
  // ji neznat. Bude potřeba až před oslovováním (fáze 3).
  const povinne = ["nazev", "adresa", "lat", "lng", "kod-obce", "obec"] as const;
  for (const p of povinne) {
    if (!values[p]) {
      console.error(`Chybí --${p}`);
      process.exit(1);
    }
  }
  const db = await pripojDb();
  try {
    const rows = await db.query<{ id: string }>(
      `insert into jidelny (nazev, adresa, obec, lat, lng, kod_obce, kapacita_volna, zona_metru, ico)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        values.nazev,
        values.adresa,
        values.obec,
        Number(values.lat),
        Number(values.lng),
        Number(values["kod-obce"]),
        values.kapacita ? Number(values.kapacita) : null,
        Number(values.zona),
        values.ico ?? null,
      ],
    );
    console.log(`Jídelna založena: ${rows[0]!.id}`);
  } finally {
    await db.close();
  }
}

async function cmdRun(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      jidelna: { type: "string" },
      limit: { type: "string" },
      "bez-sweep": { type: "boolean", default: false },
      "min-zamestnancu": { type: "string" },
    },
  });
  if (!values.jidelna) {
    console.error("Chybí --jidelna <id>");
    process.exit(1);
  }

  const kontakt = process.env.NOMINATIM_CONTACT;
  if (!kontakt) {
    console.error("Chybí NOMINATIM_CONTACT (kontaktní e-mail pro geocoding, viz .env.example).");
    process.exit(1);
  }

  let enricher: Enricher | undefined;
  if (process.env.ANTHROPIC_API_KEY) {
    enricher = vytvorEnricher({ klient: new Anthropic() });
  } else {
    console.warn(
      "ANTHROPIC_API_KEY není nastaven — přeskočím obohacování z webu (stravování, kontakty). Poběží jen ARES + geo + skóre.",
    );
  }

  const db = await pripojDb();
  try {
    const souhrn = await spustCmuchala(
      {
        db,
        ares: vytvorAresKlienta(),
        res: vytvorResKlienta(),
        geokoder: vytvorGeokoder({ kontakt }),
        mpsv: vytvorMpsvKlienta(),
        osm: vytvorOsmKlienta({ kontakt }),
        registr: vytvorRegistrKlienta(),
        enricher,
      },
      values.jidelna,
      {
        limit: values.limit ? Number(values.limit) : undefined,
        aresSweep: values["bez-sweep"] !== true,
        minZamestnancu: values["min-zamestnancu"] ? Number(values["min-zamestnancu"]) : undefined,
      },
    );

    // Výpis musí kandidáty beze zbytku vysvětlit — jinak se nedá poznat,
    // jestli někam nemizí tiše. Zbytek se dopočítá a vypíše zvlášť.
    const rozpad: Array<[string, number]> = [
      ["kvalifikováno", souhrn.kvalifikovano],
      ["čeká na jídelnu", souhrn.cekajicich],
      ["už v kartotéce", souhrn.preskoceno],
      ["nespárováno s rejstříkem", souhrn.nesparovano],
      ["bez zaměstnanců", souhrn.bezZamestnancu],
      ["nevhodný obor", souhrn.vyloucenyObor],
      ["bytový dům", souhrn.bytovychDomu],
      ["naše vlastní jídelna", souhrn.partnerskychJidelen],
      ["zahozeno jinak", souhrn.zahozeno],
    ];
    const sedi = rozpad.reduce((s, [, n]) => s + n, 0);

    console.log(`Běh ${souhrn.behId} dokončen:`);
    console.log(`  kandidátů: ${souhrn.kandidatu}`);
    console.log(
      `  zdroje — registr ČSÚ: ${souhrn.dleZdroje.registr}, MPSV: ${souhrn.dleZdroje.mpsv}` +
        `, mapy: ${souhrn.dleZdroje.osm}, sweep ARES: ${souhrn.dleZdroje.ares}`,
    );
    for (const [popis, n] of rozpad) {
      if (n > 0) console.log(`    ${popis}: ${n}`);
    }
    if (sedi !== souhrn.kandidatu) {
      console.log(`    (nezařazeno: ${souhrn.kandidatu - sedi})`);
    }
    // Agentury se odfiltrují ještě před sestavením seznamu kandidátů, takže
    // do rozpadu výše nepatří — počítaly by se dvakrát.
    if (souhrn.agentur > 0) {
      console.log(`  agentur práce odfiltrováno u zdroje: ${souhrn.agentur}`);
    }
    console.log(`  pod limitem velikosti (uloženo, ale mimo frontu): ${souhrn.podLimitem}`);
    console.log(`  chyb: ${souhrn.chyby.length}, náklady: ${souhrn.nakladyUsd.toFixed(2)}`);
    for (const c of souhrn.chyby.slice(0, 5)) console.log(`    ! ${c.kdo}: ${c.chyba}`);

    // Do playbooku jen to, co je opravdu nové a obecné. Výpis jednotlivých
    // kandidátů se opakuje každý běh a patří do deníku vyřazení, ne sem.
    const stavajici = await readFile("playbook-cmuchal.md", "utf8").catch(() => "");
    const nove = novePoznatky(stavajici, souhrn.poznamkyProPlaybook);
    if (nove.length > 0) {
      const datum = new Date().toISOString().slice(0, 10);
      await appendFile(
        "playbook-cmuchal.md",
        `\n## Běh ${datum} (${souhrn.behId})\n${nove.map((p) => `- ${p}`).join("\n")}\n`,
        "utf8",
      );
      console.log(`  do playbooku přibylo ${nove.length} poznatků`);
    }
  } finally {
    await db.close();
  }
}

async function cmdStav(): Promise<void> {
  const db = await pripojDb();
  try {
    const p = await prehledStavu(db);
    console.log("Firmy dle stavu:");
    for (const [stav, pocet] of Object.entries(p.firmyDleStavu)) {
      console.log(`  ${stav}: ${pocet}`);
    }
    const kvalifikovanych = p.firmyDleStavu["kvalifikovany"] ?? 0;
    console.log(`Aktivních jídelen: ${p.aktivnichJidelen}`);
    if (p.kapacitaAktivnichJidelen === null) {
      console.log("Volná kapacita: neznámá u všech jídelen — pro sběr dat nevadí.");
    } else {
      console.log(
        `Volná kapacita: ${p.kapacitaAktivnichJidelen} obědů/den` +
          (p.jidelenBezKapacity > 0
            ? ` (u ${p.jidelenBezKapacity} jídelen neznámá, takže je to spodní odhad)`
            : ""),
      );
      if (p.kapacitaAktivnichJidelen === 0) {
        console.log("⚠ Kapacita je 0 — prioritou je získávání jídelen, ne firem (SPEC kap. 2).");
      } else {
        console.log(`Poměr kvalifikovaných firem ke kapacitě: ${kvalifikovanych} firem / ${p.kapacitaAktivnichJidelen} obědů`);
      }
    }
    if (p.kapacitaAktivnichJidelen !== null && p.jidelenBezKapacity > 0) {
      console.log("Kapacita bude potřeba až před oslovováním (fáze 3).");
    }
  } finally {
    await db.close();
  }
}

async function cmdKartoteka(argv: string[]): Promise<void> {
  const { values } = parseArgs({ args: argv, options: { vystup: { type: "string", default: "docs/vizualizace/kartoteka.html" } } });
  const db = await pripojDb();
  try {
    const v = await vygenerujKartoteku(db, values.vystup!);
    console.log(`Kartotéka vygenerována: ${v.cesta}`);
    console.log(`  firem: ${v.firem}, doložených údajů: ${v.evidenci}`);
  } finally {
    await db.close();
  }
}

/**
 * Doplní kontakty u firem, které v kartotéce už jsou. Běžný sběr je
 * přeskakuje, takže by se k nim nový zdroj kontaktů nikdy nedostal.
 */
async function cmdDoplnitKontakty(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { limit: { type: "string" }, jidelna: { type: "string" } },
  });
  const db = await pripojDb();
  try {
    const souhrn = await doplnKontakty(
      { db, ares: vytvorAresKlienta(), mpsv: vytvorMpsvKlienta() },
      {
        limit: values.limit ? Number(values.limit) : undefined,
        jidelnaId: values.jidelna,
      },
    );
    console.log(`Doplnění kontaktů — běh ${souhrn.behId}`);
    console.log(`  firem bez jmenného kontaktu: ${souhrn.zpracovano}`);
    console.log(`  kontakt z otevřených dat MPSV: ${souhrn.zMpsv}`);
    console.log(`  jednatel z veřejného rejstříku: ${souhrn.zRejstriku}`);
    console.log(`  bez výsledku: ${souhrn.bezVysledku}`);
    if (souhrn.chyby.length > 0) {
      console.log(`  chyb: ${souhrn.chyby.length}`);
      for (const c of souhrn.chyby.slice(0, 5)) console.log(`    ${c.kdo}: ${c.chyba}`);
    }
  } finally {
    await db.close();
  }
}

/**
 * Podklad pro rozhodnutí o velikosti zóny. Rozhoduje majitel — tohle mu jen
 * ukáže, kolik firem při jakém poloměru přibude, ať to není od oka.
 */
async function cmdZona(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      jidelna: { type: "string" },
      polomery: { type: "string", default: "1000,2000,3000,5000,10000" },
      "min-zamestnancu": { type: "string", default: "10" },
    },
  });
  if (!values.jidelna) {
    console.error("Chybí --jidelna <id>");
    process.exit(1);
  }

  const db = await pripojDb();
  try {
    const j = await db.query<{
      nazev: string; obec: string; lat: number; lng: number; zona_metru: number; ico: string | null;
    }>(
      `select nazev, obec, lat::float8 as lat, lng::float8 as lng, zona_metru, ico
       from jidelny where id = $1`,
      [values.jidelna],
    );
    const jidelna = j[0];
    if (!jidelna) {
      console.error(`Jídelna ${values.jidelna} neexistuje`);
      process.exit(1);
    }

    const registr = vytvorRegistrKlienta();
    const jednotky = jidelna.ico ? await registr.jednotkyObce(jidelna.ico) : [];
    const minZam = Number(values["min-zamestnancu"]);
    const zaznamy = await registr.zamestnavateleVJednotkach(jednotky, { minZamestnancu: minZam });

    // Registr nenese souřadnice — bez zaměření se vzdálenost spočítat nedá.
    // Používáme polohy firem, které už v kartotéce máme.
    const znamePolohy = await db.query<{ ico: string; lat: number; lng: number }>(
      `select ico, lat::float8 as lat, lng::float8 as lng
       from companies where lat is not null`,
    );
    const podleIco = new Map(znamePolohy.map((f) => [f.ico, f]));
    const sPolohou = zaznamy
      .map((z) => {
        const p = podleIco.get(z.ico);
        return p ? { ico: z.ico, kategorieKod: z.kategorieKod, lat: p.lat, lng: p.lng } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    console.log(`${jidelna.nazev} (${jidelna.obec}), dnešní zóna ${jidelna.zona_metru} m`);
    console.log(
      `firem nad ${minZam} zam. v území: ${zaznamy.length}` +
        `, z toho se známou polohou: ${sPolohou.length}`,
    );
    if (sPolohou.length < zaznamy.length) {
      console.log(
        `  (${zaznamy.length - sPolohou.length} firem ještě nemá zaměřenou adresu — ` +
          `objeví se až po sběru)`,
      );
    }
    console.log("");
    const radky = rozborZony({ lat: jidelna.lat, lng: jidelna.lng }, sPolohou, {
      polomery: values.polomery.split(",").map((p) => Number(p.trim())),
      minZamestnancu: minZam,
    });
    for (const r of radky) {
      console.log(
        `  ${String(r.polomerM / 1000).padStart(5)} km   ${String(r.firem).padStart(4)} firem` +
          `   ${r.pribude > 0 ? `(+${r.pribude})` : ""}`,
      );
    }

    // Bez tohohle upozornění výpis klame: nulový přírůstek u velkých
    // poloměrů neznamená „dál nic není“, ale „dál jsme se nedívali“.
    const posledni = radky[radky.length - 1];
    if (posledni && posledni.pribude === 0 && radky.length > 1) {
      console.log(
        `\n  POZOR: počítají se jen firmy se sídlem v území jídelny (${jidelna.obec}).` +
          `\n  Nulový přírůstek u větších poloměrů tedy neznamená, že tam firmy nejsou —` +
          `\n  znamená, že do sousedních obcí tenhle rozbor nevidí. Na rozšíření zóny` +
          `\n  za hranice obce je potřeba nejdřív posbírat i sousední území.`,
      );
    }

    // Překryv se sousedy — druhá polovina rozhodnutí o zóně.
    const sousede = await db.query<{ nazev: string; obec: string; lat: number; lng: number; zona_metru: number }>(
      `select nazev, obec, lat::float8 as lat, lng::float8 as lng, zona_metru
       from jidelny where id <> $1 and aktivni is true`,
      [values.jidelna],
    );
    const blizke = sousede
      .map((s) => ({
        ...s,
        m: vzdalenostM({ lat: jidelna.lat, lng: jidelna.lng }, { lat: s.lat, lng: s.lng }),
      }))
      .filter((s) => s.m < 25_000)
      .sort((a, b) => a.m - b.m);
    if (blizke.length > 0) {
      console.log("\n  sousední jídelny:");
      for (const s of blizke) {
        const prekryvOd = Math.max(0, s.m - s.zona_metru);
        console.log(
          `    ${s.obec.padEnd(12)} ${String(Math.round(s.m / 1000)).padStart(3)} km` +
            `   zóny se překryjí, jakmile naše přesáhne ${(prekryvOd / 1000).toFixed(1)} km`,
        );
      }
    }
  } finally {
    await db.close();
  }
}

/**
 * Oblasti hledání. Oblast smí vzniknout dřív než jídelna — to je celý smysl
 * obráceného postupu: nejdřív území a seznam firem jako podklad na jednání,
 * jídelna se přiřadí až po dohodě.
 */
async function cmdOblast(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      nazev: { type: "string" },
      lat: { type: "string" },
      lng: { type: "string" },
      polomer: { type: "string" },
      body: { type: "string" }, // GeoJSON-like: "49.6,13.2 49.7,13.2 49.7,13.3"
      jidelna: { type: "string" },
      poznamka: { type: "string" },
      oblast: { type: "string" },
    },
  });
  const akce = positionals[0] ?? "seznam";
  const db = await pripojDb();
  try {
    if (akce === "nova") {
      if (!values.nazev) {
        console.error("Chybí --nazev");
        process.exit(1);
      }
      let oblast: Oblast;
      if (values.body) {
        oblast = {
          typ: "polygon",
          body: values.body.trim().split(/\s+/).map((dvojice) => {
            const [lat, lng] = dvojice.split(",").map(Number);
            return { lat: lat!, lng: lng! };
          }),
        };
      } else if (values.lat && values.lng && values.polomer) {
        oblast = {
          typ: "kruh",
          stred: { lat: Number(values.lat), lng: Number(values.lng) },
          polomerM: Number(values.polomer),
        };
      } else {
        console.error("Zadej buď --lat --lng --polomer (kruh), nebo --body (nakreslený tvar)");
        process.exit(1);
      }

      const id = await zalozOblast(db, {
        nazev: values.nazev,
        oblast,
        jidelnaId: values.jidelna,
        poznamka: values.poznamka,
      });
      const pocet = await prepocitejOblastFirmy(db, id);
      console.log(`Oblast založena: ${id}`);
      console.log(`  firem uvnitř: ${pocet}`);
      if (!values.jidelna) {
        console.log("  jídelna zatím není — přiřadí se příkazem: oblast prirad --oblast <id> --jidelna <id>");
      }
      return;
    }

    if (akce === "prirad") {
      if (!values.oblast || !values.jidelna) {
        console.error("Chybí --oblast <id> nebo --jidelna <id>");
        process.exit(1);
      }
      await prirad(db, values.oblast, values.jidelna);
      console.log("Jídelna přiřazena k oblasti.");
      return;
    }

    if (akce === "firmy") {
      if (!values.oblast) {
        console.error("Chybí --oblast <id>");
        process.exit(1);
      }
      const firmy = await firmyVOblasti(db, values.oblast);
      console.log(`Firem v oblasti: ${firmy.length}\n`);
      for (const f of firmy) {
        console.log(
          `  ${String(f.skore ?? "—").padStart(3)} b  ` +
            `${(f.velikostKategorie ?? "?").padEnd(9)} ` +
            `${f.vzdalenostM != null ? `${String(f.vzdalenostM).padStart(6)} m` : "        "}  ` +
            `${f.nazev}`,
        );
      }
      return;
    }

    // výchozí: seznam
    const oblasti = await seznamOblasti(db);
    if (oblasti.length === 0) {
      console.log("Zatím žádné oblasti. Založ: oblast nova --nazev … --lat … --lng … --polomer …");
      return;
    }
    for (const o of oblasti) {
      const pocet = await db.query<{ n: string }>(
        "select count(*)::text as n from oblast_firmy where oblast_id = $1",
        [o.id],
      );
      const tvar =
        o.oblast.typ === "kruh"
          ? `kruh ${(o.oblast.polomerM ?? 0) / 1000} km`
          : `nakreslený tvar (${o.oblast.body?.length ?? 0} bodů)`;
      console.log(
        `${o.id}  ${o.nazev.padEnd(24)} ${tvar.padEnd(28)} ` +
          `${String(pocet[0]!.n).padStart(4)} firem  ` +
          `${o.jidelnaId ? "jídelna přiřazena" : "BEZ JÍDELNY"}`,
      );
    }
  } finally {
    await db.close();
  }
}

/** Doplní ke všem firmám kategorii podle oboru. */
async function cmdKategorie(): Promise<void> {
  const db = await pripojDb();
  try {
    const v = await priradKategorie(db);
    console.log(`Zařazeno firem: ${v.zarazeno}\n`);
    console.table(
      await db.query(
        `select k.nazev, count(c.ico)::int as firem
         from kategorie k left join companies c on c.kategorie = k.kod
         group by k.nazev, k.poradi order by k.poradi`,
      ),
    );
    if (v.vOstatnich.length > 0) {
      // Bez tohohle výpisu by firmy do „ostatních" tiše mizely a nešlo by
      // poznat, že členění někde nesedí.
      console.log("\nObory, které skončily v „ostatních“ — podklad k dobroušení:");
      for (const o of v.vOstatnich.slice(0, 12)) {
        console.log(`  oddíl CZ-NACE ${o.oddil}: ${o.pocet} firem`);
      }
    }
  } finally {
    await db.close();
  }
}

/** Ruční pravidla majitele — obdoba automatického vyřazování. */
async function cmdBlacklist(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      typ: { type: "string" },
      hodnota: { type: "string" },
      duvod: { type: "string" },
      id: { type: "string" },
    },
  });
  const akce = positionals[0] ?? "seznam";
  const db = await pripojDb();
  try {
    if (akce === "pridej") {
      if (!values.typ || !values.hodnota || !values.duvod) {
        console.error(
          "Chybí --typ (ico|nazev|nace|pravni_forma), --hodnota nebo --duvod.\n" +
            "Důvod je povinný schválně: bez něj se za měsíc nedá poznat, proč tam pravidlo je.",
        );
        process.exit(1);
      }
      await pridejPravidlo(db, {
        typ: values.typ as TypPravidla,
        hodnota: values.hodnota,
        duvod: values.duvod,
      });
      console.log("Pravidlo přidáno. Uplatní se při příštím sběru.");
      return;
    }

    if (akce === "smaz") {
      if (!values.id) {
        console.error("Chybí --id");
        process.exit(1);
      }
      await smazPravidlo(db, values.id);
      console.log("Pravidlo smazáno.");
      return;
    }

    const pravidla = await nactiBlacklist(db);
    if (pravidla.length === 0) {
      console.log(
        "Blacklist je prázdný.\n" +
          "Přidej: blacklist pridej --typ ico --hodnota 25232657 --duvod \"už jsme jednali\"",
      );
      return;
    }
    for (const p of pravidla) {
      console.log(`${p.id}  ${p.typ.padEnd(13)} ${p.hodnota.padEnd(20)} ${p.duvod}`);
    }
  } finally {
    await db.close();
  }
}

/** Přepočte, které jídelny mají kterou firmu v dosahu. */
async function cmdDosah(argv: string[]): Promise<void> {
  const { values } = parseArgs({ args: argv, options: { jidelna: { type: "string" } } });
  const db = await pripojDb();
  try {
    const v = await prepocitejDosah(db, { jidelnaId: values.jidelna });
    console.log(
      `Přepočteno: ${v.firem} firem × jídelny = ${v.dvojic} dvojic, ` +
        `v zóně ${v.vZone}`,
    );
    const sdilene = await db.query<{ pocet: string }>(
      `select count(*)::text as pocet from (
         select ico from dosah where v_zone is true group by ico having count(*) > 1
       ) x`,
    );
    console.log(`Firem v dosahu víc jídelen zároveň: ${sdilene[0]!.pocet}`);
  } finally {
    await db.close();
  }
}

async function cmdKObohaceni(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      limit: { type: "string" },
      jidelna: { type: "string" },
      // Např. --segmenty stredni,korporat — u drobných se rešerše nevyplatí.
      segmenty: { type: "string" },
      // Firmy, kde známe jméno, ale ne spojení na něj.
      "bez-spojeni": { type: "boolean", default: false },
    },
  });
  const db = await pripojDb();
  try {
    const firmy = await firmyKObohaceni(db, {
      limit: values.limit ? Number(values.limit) : undefined,
      jidelnaId: values.jidelna,
      segmenty: values.segmenty?.split(",").map((s) => s.trim()) as Segment[] | undefined,
      jenBezSpojeni: values["bez-spojeni"] === true,
    });
    // Strojově čitelný výstup — čte ho agent, ne člověk.
    console.log(JSON.stringify(firmy, null, 2));
  } finally {
    await db.close();
  }
}

async function cmdZapisNalezy(argv: string[]): Promise<void> {
  const { values } = parseArgs({ args: argv, options: { soubor: { type: "string" } } });
  if (!values.soubor) {
    console.error("Chybí --soubor <cesta.json> s nálezy od agenta");
    process.exit(1);
  }
  const davka = JSON.parse(await readFile(values.soubor, "utf8"));
  const db = await pripojDb();
  try {
    const v = await zapisDavku(db, davka);
    console.log(`Běh ${v.behId}:`);
    console.log(`  zapsáno nálezů: ${v.zapsanoNalezu}`);
    console.log(`  zapsáno kontaktů: ${v.zapsanoKontaktu}`);
    console.log(`  označeno bez nálezu: ${v.oznacenoBezNalezu}`);
    if (v.odmitnuto.length > 0) {
      console.log(`  ODMÍTNUTO: ${v.odmitnuto.length}`);
      for (const o of v.odmitnuto) console.log(`    - ${o.duvod}`);
    }
  } finally {
    await db.close();
  }
}

async function cmdMapa(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { vystup: { type: "string", default: "docs/vizualizace/mapa.html" } },
  });
  const db = await pripojDb();
  try {
    const v = await vygenerujMapu(db, values.vystup!);
    console.log(`Mapa vygenerována: ${v.cesta}`);
    console.log(`  jídelen: ${v.jidelen}, firem se souřadnicemi: ${v.firem}`);
    console.log("  Otevři dvojklikem v prohlížeči (mapový podklad se stahuje z internetu).");
  } finally {
    await db.close();
  }
}

async function cmdMetriky(): Promise<void> {
  const db = await pripojDb();
  try {
    const m = await metrikyFaze1(db);
    const pct = (x: number) => `${(x * 100).toFixed(0)} %`;
    console.log(`Kvalifikovaných firem: ${m.kvalifikovanychFirem} (cíl fáze 1: 200)`);
    console.log(`Podíl polí se zdrojem: ${pct(m.podilPoliSeZdrojem)}`);
    console.log(`Ověřený stav stravování: ${pct(m.podilStravovaniOvereno)}`);
    console.log(`Podíl kontaktů úrovně 1: ${pct(m.podilKontaktuUrovne1)}`);
    console.log(`Ověřených kontaktů na firmu: ${m.kontaktuNaKvalifikovanouFirmu.toFixed(1)}`);
  } finally {
    await db.close();
  }
}

const [prikaz, ...zbytek] = process.argv.slice(2);
switch (prikaz) {
  case "migrate":
    await cmdMigrate();
    break;
  case "seed-jidelna":
    await cmdSeedJidelna(zbytek);
    break;
  case "run":
    await cmdRun(zbytek);
    break;
  case "stav":
    await cmdStav();
    break;
  case "mapa":
    await cmdMapa(zbytek);
    break;
  case "kartoteka":
    await cmdKartoteka(zbytek);
    break;
  case "oblast":
    await cmdOblast(zbytek);
    break;
  case "kategorie":
    await cmdKategorie();
    break;
  case "blacklist":
    await cmdBlacklist(zbytek);
    break;
  case "zona":
    await cmdZona(zbytek);
    break;
  case "dosah":
    await cmdDosah(zbytek);
    break;
  case "doplnit-kontakty":
    await cmdDoplnitKontakty(zbytek);
    break;
  case "k-obohaceni":
    await cmdKObohaceni(zbytek);
    break;
  case "zapis-nalezy":
    await cmdZapisNalezy(zbytek);
    break;
  case "metriky":
    await cmdMetriky();
    break;
  default:
    console.log(`Cantinero — fáze 1 (Čmuchal). Příkazy:
  migrate                          založí/aktualizuje schéma (lokálně, nebo na DATABASE_URL)
  seed-jidelna --nazev … --adresa … --obec … --lat … --lng … --kod-obce … [--kapacita N] [--zona 3000]
  run --jidelna <id> [--limit N] [--min-zamestnancu 10]
                                   spustí Čmuchala pro jídelnu
  stav                             počty firem a kapacita jídelen
  mapa [--vystup cesta.html]       vygeneruje mapu území z aktuálních dat
  kartoteka [--vystup x.html]      vygeneruje prohlížitelnou kartotéku se zdroji
  kategorie                        doplní firmám kategorii podle oboru
  blacklist [seznam]               vypíše ruční pravidla
  blacklist pridej --typ ico|nazev|nace|pravni_forma --hodnota … --duvod …
  blacklist smaz --id <id>
  oblast [seznam]                  vypíše oblasti hledání
  oblast nova --nazev … (--lat … --lng … --polomer … | --body "49.6,13.2 49.7,13.3")
                                   založí oblast; jídelna je NEPOVINNÁ
  oblast prirad --oblast <id> --jidelna <id>
                                   přiřadí jídelnu k oblasti (až po jednání)
  oblast firmy --oblast <id>       vypíše firmy v oblasti
  zona --jidelna <id> [--polomery 1000,3000,5000]
                                   kolik firem přibude při jakém poloměru zóny
  dosah [--jidelna <id>]           přepočte, které jídelny mají kterou firmu v dosahu
  doplnit-kontakty [--limit N] [--jidelna id]
                                   doplní kontakty u firem, které už v kartotéce jsou
  k-obohaceni [--limit N] [--segmenty stredni,korporat] [--bez-spojeni]
                                   vypíše firmy čekající na rešerši (pro agenta);
                                   --bez-spojeni = známe jméno, chybí e-mail i telefon
  zapis-nalezy --soubor x.json     zapíše nálezy od agenta (kontroluje zdroje)
  metriky                          metriky fáze 1 (cíl: 200 ověřených firem)`);
    process.exit(prikaz ? 1 : 0);
}
