import { parseArgs } from "node:util";
import { appendFile, readFile, writeFile } from "node:fs/promises";
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
import { vytvorRegistrKlienta, zdrojVelikosti } from "./registr.js";
import { firmyKObohaceni, zapisDavku } from "./nalezy.js";
import { vygenerujKartoteku } from "./kartoteka.js";
import { novePoznatky } from "./playbook.js";
import { doplnKontakty } from "./kontakty.js";
import { doplnVelikosti } from "./velikosti.js";
import { oznameniOBehu, type VysledekObjednavky } from "./oznameni.js";
import { prepocitejDosah } from "./dosah.js";
import { rozborZony } from "./zona.js";
import {
  nactiBlacklist, pridejPravidlo, smazPravidlo, type TypPravidla,
} from "./blacklist.js";
import { priradKategorie } from "./kategorie.js";
import { nactiProfil, seznamProfilu, zvolProfil } from "./profil.js";
import { prenesData } from "./prenos.js";
import {
  firmyVOblasti, nactiOblast, prepocitejOblastFirmy, prirad, seznamOblasti, zalozOblast,
  type Oblast,
} from "./oblast.js";
import { vzdalenostM } from "./geo.js";
import {
  firmyKampane, nactiKampan, naplnZOblasti, nastavUzemi, oblastiKampane,
  prekryvKampani, PRECHODY, seznamKampani, souhrnKampane, vyradFirmu,
  zalozKampan, zmenStav,
  type StavKampane,
} from "./kampan.js";
import {
  dalsiPruzkum, dokoncPruzkum, objednejPruzkum, selhalPruzkum, zahajPruzkum,
} from "./pruzkum.js";
import { rozhlednuti, vyridPruzkum } from "./cmuchal-oblast.js";
import { dalsiKVyrizeni, odemkni, tep, zamkni } from "./fronta.js";
import {
  dalsiReserseKVyrizeni, firmyProReserse, pocetSeSpojenim, pocetZpracovanych, selhalaReserse,
  uzavriReserse, zahajReserse,
} from "./reserse.js";
// Aliasováno — `spustCmuchala` už je jméno funkce z cmuchal.ts (obohacení
// nad jídelnou), tohle je jiná věc: spuštění Čmuchala jako procesu.
import { spustCmuchala as spustCmuchalaProces, stropMs } from "./cmuchal-spousteni.js";
import { zacniBeh, ukonciBeh } from "./repo.js";
import { hostname } from "node:os";

/** Jméno zámku na běh Čmuchala nad frontou objednávek. */
const ZAMEK_CMUCHAL = "cmuchal-fronta";
import type { CmuchalDeps } from "./cmuchal.js";
import type { DuvodNeoslovovat } from "./kvalifikace.js";

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

/** Důvody vynechání z kampaně česky — majitel čte výstup, ne číselník. */
const POPIS_NEOSLOVOVAT: Record<DuvodNeoslovovat, string> = {
  partnerska_jidelna: "partnerská jídelna",
  bytovy_dum: "bytový dům",
  blacklist: "blacklist",
  vlastni_jidelna: "vlastní jídelna",
};

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
    options: {
      limit: { type: "string" },
      jidelna: { type: "string" },
      oblast: { type: "string" },
      "jen-cilove": { type: "boolean" },
    },
  });
  if (values.jidelna && values.oblast) {
    console.error("Zvol buď --jidelna, nebo --oblast, ne obojí.");
    process.exit(1);
  }
  const db = await pripojDb();
  try {
    const souhrn = await doplnKontakty(
      { db, ares: vytvorAresKlienta(), mpsv: vytvorMpsvKlienta() },
      {
        limit: values.limit ? Number(values.limit) : undefined,
        jidelnaId: values.jidelna,
        oblastId: values.oblast,
        jenCilove: values["jen-cilove"],
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

    if (akce === "prepocitej") {
      // Seznam firem v oblasti je odvozenina z tvaru a zapisuje se při
      // uložení oblasti. Kartotéka mezitím roste, takže starší oblast tvrdí
      // méně, než kolik do ní dneska spadá — v přehledu se to pozná hned.
      const kOprave = values.oblast
        ? [await nactiOblast(db, values.oblast)].filter((o) => o !== null)
        : await seznamOblasti(db);

      if (kOprave.length === 0) {
        console.log("Žádná taková oblast.");
        return;
      }
      for (const o of kOprave) {
        const pocet = await prepocitejOblastFirmy(db, o.id);
        console.log(`${o.nazev.padEnd(24)} ${String(pocet).padStart(6)} firem`);
      }
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

/**
 * Kampaň — pojmenovaný seznam firem s vlastním kontextem (SPEC kap. 10.2).
 * Není to rozesílka: nic tady neodesílá ani neskládá zprávu (TP-8).
 */
async function cmdKampan(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      spravce: { type: "string" },
      kontext: { type: "string" },
      jidelna: { type: "string" },
      duvod: { type: "string" },
    },
  });
  const akce = positionals[0] ?? "seznam";
  const db = await pripojDb();
  try {
    if (akce === "nova") {
      const nazev = positionals[1];
      if (!nazev) {
        console.error("Chybí <název>");
        process.exit(1);
      }
      if (!values.spravce) {
        console.error("Chybí --spravce <e-mail>");
        process.exit(1);
      }
      const id = await zalozKampan(db, {
        nazev, spravce: values.spravce, kontext: values.kontext,
      });
      console.log(`Kampaň založena: ${id}`);
      console.log("  stav: rozpracovana");
      console.log(`  Přiřaď území: kampan uzemi ${id} <id oblasti>`);
      return;
    }

    if (akce === "uzemi") {
      const kampanId = positionals[1];
      // Oblastí smí být víc — kampaň se od migrace 0030 opírá o množinu.
      const oblastiIds = positionals.slice(2);
      if (!kampanId || oblastiIds.length === 0) {
        console.error("Použití: kampan uzemi <id kampaně> <id oblasti> [<id oblasti>…] [--jidelna <id>]");
        process.exit(1);
      }
      await nastavUzemi(db, kampanId, { oblastiIds, jidelnaId: values.jidelna });
      const oblasti = await oblastiKampane(db, kampanId);
      console.log(`Území nastaveno: ${oblasti.map((o) => o.nazev).join(", ")}`);
      console.log(`  Doplň firmy: kampan napln ${kampanId}`);
      return;
    }

    if (akce === "napln") {
      const kampanId = positionals[1];
      if (!kampanId) {
        console.error("Chybí <id kampaně>");
        process.exit(1);
      }
      const k = await nactiKampan(db, kampanId);
      if (!k) {
        console.error(`Kampaň ${kampanId} neexistuje`);
        process.exit(1);
      }
      if ((await oblastiKampane(db, kampanId)).length === 0) {
        console.error(`Kampaň nemá přiřazené území. Nejdřív: kampan uzemi ${kampanId} <id oblasti>`);
        process.exit(1);
      }
      const v = await naplnZOblasti(db, kampanId);
      console.log(`Doplněno firem: ${v.pridano}`);
      if (v.jizBylo > 0) console.log(`  (v kampani už bylo: ${v.jizBylo})`);
      if (v.vynechano.length > 0) {
        // Vypsat, ne jen spočítat: kdo nevidí důvod, pravidlům přestane věřit.
        console.log(`\nV oblasti leží, ale do kampaně nepatří (${v.vynechano.length}):`);
        for (const f of v.vynechano) {
          console.log(`  ${f.ico}  ${f.nazev} — ${POPIS_NEOSLOVOVAT[f.duvod]}: ${f.detail}`);
        }
      }
      return;
    }

    if (akce === "firmy") {
      const kampanId = positionals[1];
      if (!kampanId) {
        console.error("Chybí <id kampaně>");
        process.exit(1);
      }
      const firmy = await firmyKampane(db, kampanId);
      console.log(`Firem v kampani: ${firmy.length}\n`);
      for (const f of firmy) {
        const skore = f.skore != null ? `${String(f.skore).padStart(3)} b` : "  ? b";
        const stav = f.stav === "vyrazena" ? "VYŘAZENA" : "vybrána ";
        console.log(
          `  ${skore}  ${stav}  ${String(f.kontaktu).padStart(2)} kontaktů  ` +
            `${f.nazev}${f.obec ? ` (${f.obec})` : ""}` +
            `${f.duvodVyrazeni ? ` — ${f.duvodVyrazeni}` : ""}`,
        );
      }
      return;
    }

    if (akce === "vyrad") {
      const kampanId = positionals[1];
      const ico = positionals[2];
      if (!kampanId || !ico) {
        console.error("Použití: kampan vyrad <id kampaně> <ičo> --duvod <text>");
        process.exit(1);
      }
      if (!values.duvod) {
        console.error("Chybí --duvod");
        process.exit(1);
      }
      await vyradFirmu(db, kampanId, ico, values.duvod);
      console.log(`Firma ${ico} vyřazena z kampaně.`);
      return;
    }

    if (akce === "souhrn") {
      const kampanId = positionals[1];
      if (!kampanId) {
        console.error("Chybí <id kampaně>");
        process.exit(1);
      }
      const k = await nactiKampan(db, kampanId);
      if (!k) {
        console.error(`Kampaň ${kampanId} neexistuje`);
        process.exit(1);
      }
      const s = await souhrnKampane(db, kampanId);
      console.log(`${k.nazev} — souhrn (stav: ${k.stav})`);
      console.log(`  firem vybraných: ${s.firem}, vyřazených: ${s.vyrazenych}`);
      console.log(`  se spojením na kontakt: ${s.seSpojenim}`);
      if (s.podleUrovne.length > 0) {
        console.log("  podle úrovně adresy kontaktu:");
        for (const u of s.podleUrovne) {
          console.log(`    úroveň ${u.uroven ?? "neurčena"}: ${u.pocet}`);
        }
      }
      // Neznámá kapacita se nesmí ukázat jako 0 — to by vypadalo jako změřený údaj.
      console.log(
        `  volná kapacita jídelny: ${
          s.kapacitaVolna === null ? "neznámá" : `${s.kapacitaVolna} obědů/den`
        }`,
      );

      const prekryv = await prekryvKampani(db, kampanId);
      if (prekryv.length === 0) {
        console.log("  překryv s jinými kampaněmi: žádný");
      } else {
        // TP-5: firma smí dostat jen jedno oslovení. Souběh v kampaních je
        // chyba, kterou musí vidět člověk, ne jen tichá pojistka u odesílání.
        console.log("  POZOR — tyto firmy jsou i v jiných kampaních:");
        for (const p of prekryv) console.log(`    ${p.nazev}: ${p.pocet} firem`);
      }
      return;
    }

    if (akce === "stav") {
      const kampanId = positionals[1];
      const novy = positionals[2];
      if (!kampanId || !novy) {
        console.error("Použití: kampan stav <id kampaně> <nový stav> [--duvod <text>]");
        process.exit(1);
      }
      // Jen stavy, do kterých se dá skutečně přejít (mají příchozí přechod).
      // `bezi` a `uzavrena` v číselníku jsou, ale patří až do fáze 3 —
      // nabízet je tady by matlo, protože přejít do nich stejně nejde.
      const povolene = [...new Set(Object.values(PRECHODY).flat())] as StavKampane[];
      if (!povolene.includes(novy as StavKampane)) {
        console.error(`Neznámý stav „${novy}". Povolené: ${povolene.join(", ")}`);
        process.exit(1);
      }
      await zmenStav(db, kampanId, novy as StavKampane, values.duvod);
      console.log(`Stav kampaně: ${novy}`);
      return;
    }

    // výchozí: seznam
    const kampane = await seznamKampani(db);
    if (kampane.length === 0) {
      console.log('Zatím žádné kampaně. Založ: kampan nova "<název>" --spravce <e-mail>');
      return;
    }
    for (const k of kampane) {
      const pocet = await db.query<{ n: string }>(
        "select count(*)::text as n from kampan_firmy where kampan_id = $1 and stav = 'vybrana'",
        [k.id],
      );
      const uzemi = await oblastiKampane(db, k.id);
      console.log(
        `${k.id}  ${k.nazev.padEnd(24)} ${k.stav.padEnd(17)} krok ${k.krok}  ` +
          `${String(pocet[0]!.n).padStart(4)} firem  ` +
          `${uzemi.length > 0 ? uzemi.map((o) => o.nazev).join(", ") : "BEZ ÚZEMÍ"}`,
      );
    }
  } finally {
    await db.close();
  }
}

/**
 * Sestaví závislosti pro rozhlédnutí/vyřízení průzkumu oblasti — stejní
 * klienti jako u `cmdRun`, jen bez enricheru (rozhlednuti/vyridPruzkum ho
 * nepoužívají — nic z webu neobohacují).
 */
async function vytvorPruzkumDeps(db: Db): Promise<CmuchalDeps> {
  const kontakt = process.env.NOMINATIM_CONTACT;
  if (!kontakt) {
    console.error("Chybí NOMINATIM_CONTACT (kontaktní e-mail pro geocoding, viz .env.example).");
    process.exit(1);
  }
  return {
    db,
    ares: vytvorAresKlienta(),
    res: vytvorResKlienta(),
    geokoder: vytvorGeokoder({ kontakt }),
    registr: vytvorRegistrKlienta(),
  };
}

/** Odhad doby zaměření adres — jedna adresa cca 1,1 s (limit Nominatim). */
function odhadCasuZamereni(kandidatu: number): string {
  const minuty = (kandidatu * 1.1) / 60;
  if (minuty < 1) return "necelou minutu";
  const zaokrouhleno = minuty < 10 ? minuty.toFixed(1) : Math.round(minuty).toString();
  return `přibližně ${zaokrouhleno} min`;
}

/**
 * Doplní velikost firem ze souboru statistického registru.
 *
 * Bez internetu — všechno potřebné je na disku. Doptávat se ARESu nemá smysl,
 * je to tentýž registr (ověřeno, doplnil 0 z 25).
 */
async function cmdDoplnitVelikosti(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { oblast: { type: "string" } },
  });
  const db = await pripojDb();
  try {
    const s = await doplnVelikosti(db, zdrojVelikosti(), { oblastId: values.oblast });
    console.log("Doplnění velikosti ze statistického registru");
    console.log(`  velikost zapsána:      ${s.doplneno}`);
    console.log(`  registr velikost neuvádí: ${s.neuvedeno}`);
    console.log(`  bez zaměstnanců:       ${s.bezZamestnancu}`);
    console.log(`  velikost už měly:      ${s.jizMela}`);
    if (!values.oblast) console.log(`  mimo kartotéku:        ${s.mimoKartoteku}`);
  } finally {
    await db.close();
  }
}

/** Kam se ukládá výsledek posledního běhu pro bublinu u hodin. */
const SOUBOR_OZNAMENI = "data/posledni-beh.json";

/**
 * Uloží, jak běh dopadl — hlídka si to po jeho skončení přečte a ukáže
 * bublinu u hodin (`skripty/cmuchal-hlidka.ps1`).
 *
 * **Neodesílá to nic.** Je to soubor na disku a místní oznámení Windows,
 * ne e-mail; TP-8 platí dál.
 *
 * Zapsat se musí i prázdný výsledek — jinak by hlídka ukázala bublinu
 * ze včerejška jako čerstvou.
 */
async function zapisOznameni(vysledky: VysledekObjednavky[]): Promise<void> {
  try {
    await writeFile(
      SOUBOR_OZNAMENI,
      JSON.stringify({ cas: new Date().toISOString(), oznameni: oznameniOBehu(vysledky) }, null, 2),
      "utf8",
    );
  } catch (e) {
    // Nepovedené oznámení nesmí shodit běh, který jinak dopadl dobře.
    console.error(`  (oznámení se nepodařilo zapsat: ${e instanceof Error ? e.message : e})`);
  }
}

/**
 * Fronta objednávek na průzkum území. Objednávku vyzvedne agent, aplikace
 * ho spustit neumí (běží v Claude Code, ne na serveru — ADR 0001).
 */
async function cmdPruzkum(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      kampan: { type: "string" },
      pozadal: { type: "string" },
      run: { type: "string" },
      prevzato: { type: "string" },
      novych: { type: "string" },
      chyba: { type: "string" },
      nejvyse: { type: "string" },
      "i-bez-obci": { type: "boolean", default: false },
      "nejvyse-objednavek": { type: "string" },
      "jen-urgentni": { type: "boolean", default: false },
    },
  });
  const akce = positionals[0] ?? "fronta";
  const db = await pripojDb();
  try {
    if (akce === "objednej") {
      const oblastId = positionals[1];
      if (!oblastId) {
        console.error("Chybí <id oblasti>");
        process.exit(1);
      }
      if (!values.pozadal) {
        console.error("Chybí --pozadal <e-mail>");
        process.exit(1);
      }
      const id = await objednejPruzkum(db, {
        oblastId, kampanId: values.kampan, pozadal: values.pozadal,
      });
      console.log(`Průzkum objednán: ${id}`);
      console.log("  Vyzvedne se příkazem: pruzkum dalsi");
      return;
    }

    if (akce === "obsluz") {
      // Naplánovaný běh: Čmuchal si objednávky vezme sám. Rozhodnutí
      // majitele 2026-07-31 — bez toho by krok 3 průvodce čekal na člověka
      // s příkazovou řádkou, kterého kolega nemá.
      const drzitel = `${hostname()}:${process.pid}`;
      const nejvyseObjednavek = Number(values["nejvyse-objednavek"] ?? 3);

      if (!(await zamkni(db, ZAMEK_CMUCHAL, drzitel))) {
        const kdo = await db.query<{ drzitel: string; srdce_at: string }>(
          "select drzitel, srdce_at::text from zamky where jmeno = $1",
          [ZAMEK_CMUCHAL],
        );
        console.log("Průzkum už běží jinde — tenhle běh nic nedělá.");
        if (kdo[0]) console.log(`  drží: ${kdo[0].drzitel}, naposled se ozval ${kdo[0].srdce_at}`);
        console.log("  Dva běhy naráz by si braly rozdělané úseky navzájem.");
        return;
      }

      // Výsledky se sbírají kvůli oznámení u hodin — hlídka běh nesleduje,
      // jen se po jeho skončení podívá do souboru (viz `src/oznameni.ts`).
      const vysledky: VysledekObjednavky[] = [];

      try {
        let vyrizeno = 0;
        for (let i = 0; i < nejvyseObjednavek; i++) {
          const p = await dalsiKVyrizeni(db, { jenUrgentni: values["jen-urgentni"] });
          if (!p) break;

          const oblast = await nactiOblast(db, p.oblastId);
          const jmenoOblasti = oblast?.nazev ?? p.oblastId;
          console.log(`Objednávka ${p.id} (oblast ${jmenoOblasti})…`);
          const deps = await vytvorPruzkumDeps(db);
          try {
            const v = await vyridPruzkum(deps, p.id, {
              nejvyseUseku: values.nejvyse ? Number(values.nejvyse) : undefined,
            });
            console.log(
              `  úseků ${v.usekuHotovo}/${v.usekuCelkem} · nových firem ${v.firemNovych}` +
                ` · převzatých ${v.firemPrevzato}${v.uzavreno ? " · uzavřeno" : ""}`,
            );
            // Když objednávka není uzavřená a nezbyl žádný úsek k zpracování
            // (typicky `ceka_na_rozhodnuti`), další kolo by se točilo nad
            // toutéž objednávkou donekonečna.
            if (!v.uzavreno && v.usekuCelkem === 0) {
              console.log("  čeká na rozhodnutí člověka — fronta jde dál");
              vysledky.push({
                oblast: jmenoOblasti,
                stav: "ceka_na_rozhodnuti",
                firemNovych: 0,
                firemPrevzato: 0,
                chyba: null,
              });
              break;
            }
            vysledky.push({
              oblast: jmenoOblasti,
              // Nedoběhnutá objednávka (došel strop úseků) není hotová —
              // bublina by tvrdila víc, než se stalo.
              stav: v.uzavreno ? "hotovo" : "bezi",
              firemNovych: v.firemNovych,
              firemPrevzato: v.firemPrevzato,
              chyba: null,
            });
          } catch (e) {
            // Jedna vadná objednávka nesmí zastavit celou frontu.
            const popis = e instanceof Error ? e.message : String(e);
            console.error(`  selhalo: ${popis}`);
            await selhalPruzkum(db, p.id, popis).catch(() => undefined);
            vysledky.push({
              oblast: jmenoOblasti,
              stav: "selhalo",
              firemNovych: 0,
              firemPrevzato: 0,
              chyba: popis,
            });
          }
          vyrizeno++;
          await tep(db, ZAMEK_CMUCHAL, drzitel);
        }
        console.log(
          vyrizeno === 0 ? "Fronta je prázdná — nebylo co dělat." : `Hotovo, objednávek: ${vyrizeno}`,
        );
      } finally {
        await odemkni(db, ZAMEK_CMUCHAL, drzitel);
        await zapisOznameni(vysledky);
      }
      return;
    }

    if (akce === "dalsi") {
      const p = await dalsiPruzkum(db);
      if (!p) {
        console.log("Fronta je prázdná — žádná objednávka nečeká.");
        return;
      }
      console.log(`Další v pořadí: ${p.id}`);
      console.log(`  oblast: ${p.oblastId}`);
      if (p.kampanId) console.log(`  kampaň: ${p.kampanId}`);
      console.log(`  požádal: ${p.pozadal}`);
      return;
    }

    if (akce === "zahaj") {
      const id = positionals[1];
      if (!id) {
        console.error("Použití: pruzkum zahaj <id> [--run <id běhu>]");
        process.exit(1);
      }
      await zahajPruzkum(db, id, values.run);
      console.log(`Průzkum ${id}: zahájen (stav bezi).`);
      return;
    }

    if (akce === "dokonc") {
      const id = positionals[1];
      if (!id) {
        console.error("Použití: pruzkum dokonc <id> --prevzato <číslo> --novych <číslo>");
        process.exit(1);
      }
      if (!values.prevzato || !values.novych) {
        console.error("Chybí --prevzato <číslo> nebo --novych <číslo>");
        process.exit(1);
      }
      try {
        await dokoncPruzkum(db, id, {
          firemPrevzato: Number(values.prevzato),
          firemNovych: Number(values.novych),
        });
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
      console.log(`Průzkum ${id}: dokončen (stav hotovo).`);
      return;
    }

    if (akce === "selhal") {
      const id = positionals[1];
      if (!id) {
        console.error("Použití: pruzkum selhal <id> --chyba <text>");
        process.exit(1);
      }
      if (!values.chyba) {
        console.error("Chybí --chyba <text>");
        process.exit(1);
      }
      try {
        await selhalPruzkum(db, id, values.chyba);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
      console.log(`Průzkum ${id}: označen jako neúspěšný (stav selhalo).`);
      return;
    }

    if (akce === "rozhlednuti") {
      const id = positionals[1];
      if (!id) {
        console.error("Použití: pruzkum rozhlednuti <id>");
        process.exit(1);
      }
      const deps = await vytvorPruzkumDeps(db);
      const r = await rozhlednuti(deps, id);
      if (r.cekaNaRozhodnuti) {
        console.log(`Průzkum ${id}: nakreslený tvar nezabírá žádnou obec.`);
        console.log("  Není z čeho zakládat úseky — musí rozhodnout člověk, sám se to nerozjede.");
        console.log(`  Pokračovat i tak jde jen výslovně: pruzkum vyrid ${id} --i-bez-obci`);
        console.log(
          "  (ten přepínač zatím jen dovolí spuštění — sběr firem podle souřadnic," +
            " ne podle obcí, je následná práce a zatím nic nenajde navíc)",
        );
        return;
      }
      console.log(`Průzkum ${id}: rozhlédnutí hotovo.`);
      console.log(`  obcí v území: ${r.obci}`);
      console.log(`  založených úseků: ${r.useku}`);
      console.log(`  odhad firem k prozkoumání: ${r.kandidatu} (zaměřovat se bude ${r.kandidatuKZamereni} — zbytek kartotéka už zná)`);
      console.log(`  odhad času na zaměření adres: ${odhadCasuZamereni(r.kandidatuKZamereni)}`);
      if (r.nedohledano > 0) {
        console.log(`  nedohledaných bodů mřížky: ${r.nedohledano} (u těch se obec zjistit nepovedla)`);
      }
      console.log(`  Zpracování spustíš: pruzkum vyrid ${id}`);
      return;
    }

    if (akce === "vyrid") {
      const id = positionals[1];
      if (!id) {
        console.error("Použití: pruzkum vyrid <id> [--nejvyse N] [--i-bez-obci]");
        process.exit(1);
      }
      const stavRadky = await db.query<{ stav: string }>(
        "select stav from pruzkumy where id = $1",
        [id],
      );
      const aktualniStav = stavRadky[0]?.stav;
      if (!aktualniStav) {
        console.error(`Objednávka ${id} neexistuje.`);
        process.exit(1);
      }
      if (aktualniStav === "hotovo" || aktualniStav === "selhalo") {
        console.log(`Průzkum ${id} je už uzavřený (stav ${aktualniStav}) — není co vyřizovat.`);
        return;
      }
      if (aktualniStav === "ceka_na_rozhodnuti" && values["i-bez-obci"] !== true) {
        console.log(`Průzkum ${id} čeká na rozhodnutí — nakreslený tvar nezabírá žádnou obec.`);
        console.log("  Sám se nerozjede, ať to nezůstane bez povšimnutí.");
        console.log(`  Pokračovat i tak jde jen výslovně: pruzkum vyrid ${id} --i-bez-obci`);
        console.log(
          "  (ten přepínač zatím jen dovolí spuštění — sběr firem podle souřadnic," +
            " ne podle obcí, je následná práce a zatím nic nenajde navíc)",
        );
        return;
      }
      if (aktualniStav === "ceka_na_rozhodnuti") {
        console.log(
          `Pokračuji přes --i-bez-obci, i když tvar nezabírá žádnou obec — ` +
            "přepínač ale zatím nic nesbírá navíc, jen dovolí běh dál.",
        );
      }
      const deps = await vytvorPruzkumDeps(db);
      const v = await vyridPruzkum(deps, id, {
        nejvyseUseku: values.nejvyse ? Number(values.nejvyse) : undefined,
      });

      // Byla-li tohle čerstvá objednávka (bez úseků), `vyridPruzkum` si
      // rozhlédnutí udělala sama — a když se přitom ukázalo, že tvar
      // nezabírá žádnou obec, přepnula stav na 'ceka_na_rozhodnuti' a vrátila
      // jen uzavreno: false. Bez tohohle přečtení by CLI hlásilo „pokračuje
      // dál“ a radilo spustit `vyrid` znovu bez přepínače — což by napodruhé
      // vedlo jen k odmítnutí, které tu poprvé nikdo nevysvětlil.
      if (!v.uzavreno) {
        const poStavRadky = await db.query<{ stav: string }>(
          "select stav from pruzkumy where id = $1",
          [id],
        );
        if (poStavRadky[0]?.stav === "ceka_na_rozhodnuti") {
          console.log(`Průzkum ${id} čeká na rozhodnutí — nakreslený tvar nezabírá žádnou obec.`);
          console.log("  Sám se nerozjede, ať to nezůstane bez povšimnutí.");
          console.log(`  Pokračovat i tak jde jen výslovně: pruzkum vyrid ${id} --i-bez-obci`);
          console.log(
            "  (ten přepínač zatím jen dovolí spuštění — sběr firem podle souřadnic," +
              " ne podle obcí, je následná práce a zatím nic nenajde navíc)",
          );
          return;
        }
      }

      console.log(`Průzkum ${id}: ${v.uzavreno ? "uzavřen (stav hotovo/selhalo)" : "pokračuje dál"}`);
      console.log(`  úseků hotovo: ${v.usekuHotovo} z ${v.usekuCelkem}`);
      console.log(`  nových firem: ${v.firemNovych}`);
      console.log(`  převzato z kartotéky (už tam byly): ${v.firemPrevzato}`);
      if (!v.uzavreno) {
        console.log(`  Pro pokračování spusť znovu: pruzkum vyrid ${id}`);
      }
      return;
    }

    if (akce === "useky") {
      const id = positionals[1];
      if (!id) {
        console.error("Použití: pruzkum useky <id>");
        process.exit(1);
      }
      const useky = await db.query<{
        poradi: number; obec: string; stav: string;
        firemNovych: number | null; firemMimoTvar: number | null; chyba: string | null;
      }>(
        `select poradi, obec, stav, firem_novych as "firemNovych",
                firem_mimo_tvar as "firemMimoTvar", chyba
         from pruzkum_useky where pruzkum_id = $1 order by poradi`,
        [id],
      );
      if (useky.length === 0) {
        console.log(`Průzkum ${id} zatím nemá založené úseky.`);
        console.log(`  Založí se rozhlédnutím: pruzkum rozhlednuti ${id}`);
        return;
      }
      const hotovo = useky.filter((u) => u.stav === "hotovo").length;
      console.log(`Úseků v průzkumu ${id}: ${useky.length} (hotovo ${hotovo})\n`);
      for (const u of useky) {
        const stavSloupec = u.stav.padEnd(8);
        let detail: string;
        if (u.stav === "hotovo") {
          detail = `${u.firemNovych ?? "neznámo"} nových, ${u.firemMimoTvar ?? "neznámo"} mimo tvar`;
        } else if (u.stav === "selhalo") {
          detail = `chyba: ${u.chyba ?? "neznámá"}`;
        } else {
          detail = "—";
        }
        console.log(`  ${String(u.poradi).padStart(3)}  ${u.obec.padEnd(24)} ${stavSloupec} ${detail}`);
      }
      return;
    }

    // výchozí: fronta — nedokončené objednávky (čekající i rozjeté), s postupem po úsecích.
    const nedokoncene = await db.query<{
      id: string; oblastId: string; kampanId: string | null;
      pozadal: string; pozadano: string; stav: string;
    }>(
      `select id, oblast_id as "oblastId", kampan_id as "kampanId", pozadal, stav,
              to_char(pozadano_at, 'YYYY-MM-DD HH24:MI') as pozadano
       from pruzkumy where stav in ('ceka', 'bezi', 'ceka_na_rozhodnuti') order by pozadano_at`,
    );
    if (nedokoncene.length === 0) {
      console.log("Fronta je prázdná.");
      return;
    }
    console.log(`Nedokončených objednávek: ${nedokoncene.length}\n`);
    for (const p of nedokoncene) {
      const useky = await db.query<{ hotovo: number; celkem: number }>(
        `select count(*) filter (where stav = 'hotovo')::int as hotovo, count(*)::int as celkem
         from pruzkum_useky where pruzkum_id = $1`,
        [p.id],
      );
      const u = useky[0]!;
      const postup = u.celkem === 0 ? "úseky ještě nezaloženy" : `úseky ${u.hotovo}/${u.celkem} hotovo`;
      console.log(
        `  ${p.id}  oblast ${p.oblastId}` +
          `${p.kampanId ? `  kampaň ${p.kampanId}` : ""}` +
          `  stav ${p.stav}  ${postup}` +
          `  požádal ${p.pozadal}  ${p.pozadano}`,
      );
    }
  } finally {
    await db.close();
  }
}

/**
 * Fronta objednávek AI rešerše. Průzkum mapuje území kódem, rešerši ale
 * dělá agent (Claude Code) — obsluha ho jen neinteraktivně spustí a počká.
 */
async function cmdReserse(argv: string[]): Promise<void> {
  const { positionals } = parseArgs({ args: argv, allowPositionals: true, options: {} });
  const akce = positionals[0] ?? "obsluz";
  if (akce !== "obsluz") {
    console.error(`Neznámá akce "reserse ${akce}". Zatím je jen: reserse obsluz`);
    process.exit(1);
  }

  const db = await pripojDb();
  try {
    const drzitel = `${hostname()}:${process.pid}`;
    // Stejný zámek jako průzkum — obojí dělá Čmuchal a chodí na cizí weby.
    // Důsledek: dlouhá rešerše pozdrží průzkum a naopak. Záměr, ne opomenutí.
    if (!(await zamkni(db, ZAMEK_CMUCHAL, drzitel))) {
      console.log("Čmuchal už běží jinde — tenhle běh nic nedělá.");
      return;
    }
    // Obnovuje zámek, dokud běží Čmuchal — nastavuje se, jakmile je co
    // hlídat, a ruší se dole ve `finally` spolu s odemknutím.
    let srdce: NodeJS.Timeout | undefined;
    try {
      const o = await dalsiReserseKVyrizeni(db);
      if (!o) {
        console.log("Fronta rešerší je prázdná.");
        return;
      }

      const firmy = await firmyProReserse(db, o.kampanId, o.firemZadano);
      if (firmy.length === 0) {
        // Prázdná dávka není selhání — všechny firmy už rešerší prošly.
        await uzavriReserse(db, o.id, { firemZpracovano: 0, firemSNalezem: 0 });
        console.log(`Objednávka ${o.id}: žádná firma nečeká, uzavírám.`);
        return;
      }

      const ica = firmy.map((f) => f.ico);
      const predtim = await pocetSeSpojenim(db, ica);

      const behId = await zacniBeh(db, "cmuchal-reserse", {
        objednavka: o.id,
        firem: firmy.length,
      });

      // `try` začíná hned tady, ne až u spuštění Čmuchala — `zahajReserse`
      // je hned za `zacniBeh` a musí spadat pod stejné jištění: kdyby
      // vyhodila výjimku (typicky výpadek spojení k DB) mimo `try`, `behId`
      // by v `agent_runs` zůstal navždy otevřený beze stopy o chybě.
      //
      // `behUzavren` hlídá, aby se `ukonciBeh` v `catch` nezavolal podruhé,
      // kdyby selhal už ten úspěšný pokus na konci `try` — to by byl zbytečný
      // druhý zápis nad stejným řádkem.
      let behUzavren = false;
      try {
        await zahajReserse(db, o.id, behId);

        // `ZAMEK_CMUCHAL` má TTL 15 minut (VYCHOZI_PRODLEVA_MIN ve
        // src/fronta.ts), ale čekání na Čmuchala (stropMs) běžně přesáhne
        // 15 minut už od ~8 firem — jediný dlouhý `await` bez srdce by zámek
        // nechal vystydnout. `dalsiReserseKVyrizeni` schválně bere i
        // objednávky ve stavu 'bezi' (zotavení po pádu procesu), takže by si
        // jiný běh vzal TUTÉŽ rozjetou objednávku a zpracoval stejné firmy
        // podruhé. Chybu z tepu polykáme — ztracený jeden tep nevadí,
        // ztracený zámek ano.
        srdce = setInterval(() => {
          tep(db, ZAMEK_CMUCHAL, drzitel).catch(() => undefined);
        }, 5 * 60_000);

        // Firmy dostane agent příkazem, ne vypsané v textu (nález 2
        // závěrečné revize): `k-obohaceni` bez `--kampan` má úplně jinou,
        // globální frontu (`stav = 'kvalifikovany' and v_zone`), do které
        // firmy sebrané nad oblastí vůbec nespadají. `--kampan` uvnitř
        // vybírá přesně tutéž množinu jako `firmyProReserse` o pár řádků
        // výš — a k tomu agentovi vrátí i `chybi`/`znameOsoby`, které by ve
        // výpisu IČO chyběly.
        const prompt =
          `${o.zadani}\n\n` +
          `Vezmi si firmy příkazem: npm run cli -- k-obohaceni --kampan ${o.kampanId} --limit ${firmy.length}\n` +
          `Nálezy zapiš příkazem: npm run cli -- zapis-nalezy --soubor <cesta k JSON souboru s nálezy>.`;

        console.log(`Objednávka ${o.id}: ${firmy.length} firem, pouštím Čmuchala…`);
        const v = await spustCmuchalaProces({
          prompt,
          koren: process.cwd(),
          stropMs: stropMs(firmy.length),
        });

        const potom = await pocetSeSpojenim(db, ica);
        const pribylo = potom - predtim;

        if (v.ok) {
          // Kolik firem agent doopravdy stihl, ne kolik se mu jen předalo
          // (nález 7 závěrečné revize) — `firmyProReserse` vybírá jen firmy
          // s `obohaceno_at is null`, takže razítko po běhu znamená, že se
          // agent té firmy doopravdy dotkl.
          const zpracovano = await pocetZpracovanych(db, ica);
          await uzavriReserse(db, o.id, {
            firemZpracovano: zpracovano,
            firemSNalezem: pribylo,
          });
          console.log(`  hotovo — zpracováno ${zpracovano} z ${firmy.length}, spojení přibylo u ${pribylo}`);
        } else {
          await selhalaReserse(db, o.id, v.chyba ?? "neznámá chyba");
          console.log(`  selhalo: ${v.chyba}`);
        }
        behUzavren = true;
        await ukonciBeh(db, behId, { firem: firmy.length, pribylo }, [], 0);
      } catch (chyba) {
        // `ukonciBeh` musí proběhnout i tady — jinak zůstane řádek v
        // agent_runs navždy otevřený (stejná past jako u rozhlednuti v
        // src/cmuchal-oblast.ts). Nejlepší snaha: když databáze nejde ani
        // teď, dál se nedá — ale nesmí to schovat původní chybu. Pokud už
        // `ukonciBeh` proběhl (a spadl právě on), znovu ho nevoláme.
        if (!behUzavren) {
          const popis = chyba instanceof Error ? chyba.message : String(chyba);
          await selhalaReserse(db, o.id, popis).catch(() => undefined);
          await ukonciBeh(db, behId, null, [popis], 0).catch(() => undefined);
        }
        throw chyba;
      }
    } finally {
      if (srdce) clearInterval(srdce);
      await odemkni(db, ZAMEK_CMUCHAL, drzitel);
    }
  } finally {
    await db.close();
  }
}

/**
 * Přenos lokálních dat do sdílené databáze. Jednorázový krok při přechodu
 * na provoz pro víc uživatelů.
 */
async function cmdPrenos(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { zdroj: { type: "string" }, potvrdit: { type: "boolean", default: false } },
  });

  const cilUrl = process.env.DATABASE_URL;
  if (!cilUrl) {
    console.error(
      "Chybí DATABASE_URL — bez ní není kam přenášet.\n" +
        "Vlož připojovací řetězec sdílené databáze do souboru .env (do gitu se nedostane).",
    );
    process.exit(1);
  }

  const zdrojDir = values.zdroj ?? process.env.CANTINERO_DATA_DIR ?? "data/pgdata";
  console.log(`Zdroj: lokální databáze ${zdrojDir}`);
  console.log("Cíl:   sdílená databáze z DATABASE_URL");

  if (!values.potvrdit) {
    console.log(
      "\nNic jsem nepřenesl. Přenos se spouští s --potvrdit.\n" +
        "Předtím si udělej zálohu: zkopíruj celý adresář " + zdrojDir + " jinam.",
    );
    return;
  }

  const zdroj = await pripojPglite(zdrojDir);
  const cil = await pripojPostgres(cilUrl);
  try {
    // Cíl musí mít stejné schéma — migrace se pustí i tam.
    const migrace = await spustMigrace(cil);
    console.log(`\nSchéma v cíli: ${migrace.length === 0 ? "už bylo aktuální" : `aplikováno ${migrace.length} migrací`}`);

    const vysledek = await prenesData(zdroj, cil);
    console.log("\nPřeneseno:");
    let celkem = 0;
    for (const r of vysledek) {
      if (r.radku > 0) console.log(`  ${r.tabulka.padEnd(16)} ${String(r.radku).padStart(6)}`);
      celkem += r.radku;
    }
    console.log(`  ${"celkem".padEnd(16)} ${String(celkem).padStart(6)} řádků`);
    console.log(
      "\nHotovo. Od teď stačí mít v .env vyplněnou DATABASE_URL a všechny\n" +
        "příkazy pracují nad sdílenou databází místo lokální.",
    );
  } finally {
    await zdroj.close();
    await cil.close();
  }
}

/** Povolené role. Držet shodné s pravidly v migraci 0016. */
const ROLE = ["super-admin", "admin", "uzivatel"] as const;

/**
 * Uživatelé aplikace a jejich role.
 *
 * Role se ukládá do `raw_app_meta_data`, ne do `raw_user_meta_data` —
 * to druhé si smí uživatel sám přepsat a povýšil by se na admina.
 * V novějším rozhraní Supabase se tohle pole nedá editovat, proto příkaz.
 */
async function cmdUzivatel(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { email: { type: "string" }, role: { type: "string" } },
  });

  if (!process.env.DATABASE_URL) {
    console.error("Uživatelé žijí jen ve sdílené databázi — chybí DATABASE_URL.");
    process.exit(1);
  }
  const db = await pripojDb();
  try {
    if (positionals[0] === "role") {
      const { email, role } = values;
      if (!email || !role) {
        console.error(`Použití: uzivatel role --email … --role ${ROLE.join("|")}`);
        process.exit(1);
      }
      if (!ROLE.includes(role as (typeof ROLE)[number])) {
        console.error(`Neznámá role „${role}". Povolené: ${ROLE.join(", ")}`);
        process.exit(1);
      }
      const zmeneno = await db.query<{ email: string }>(
        `update auth.users
         set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                                 || jsonb_build_object('role', $1::text)
         where email = $2
         returning email`,
        [role, email],
      );
      if (zmeneno.length === 0) {
        console.error(`Uživatel ${email} neexistuje — nejdřív ho založ v Supabase.`);
        process.exit(1);
      }
      console.log(`${email} → ${role}`);
      console.log("Projeví se po jeho příštím přihlášení (role je v přihlašovacím lístku).");
      return;
    }

    const u = await db.query<{ email: string; role: string | null; potvrzeno: string | null }>(
      `select email, raw_app_meta_data ->> 'role' as role,
              to_char(email_confirmed_at, 'YYYY-MM-DD') as potvrzeno
       from auth.users order by created_at`,
    );
    if (u.length === 0) {
      console.log("Zatím žádný uživatel. Zakládají se v Supabase → Authentication → Users.");
      return;
    }
    for (const x of u) {
      console.log(
        `${x.email.padEnd(26)} ${(x.role ?? "BEZ ROLE — nesmí nic").padEnd(22)} ` +
          `${x.potvrzeno ? "ověřen " + x.potvrzeno : "neověřen"}`,
      );
    }
  } finally {
    await db.close();
  }
}

/** Profily projektu — koho vlastně hledáme. */
async function cmdProfil(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv, allowPositionals: true, options: { kod: { type: "string" } },
  });
  const db = await pripojDb();
  try {
    if (positionals[0] === "zvol") {
      const kod = values.kod ?? positionals[1];
      if (!kod) {
        console.error("Chybí kód profilu. Seznam: npm run cli -- profil");
        process.exit(1);
      }
      await zvolProfil(db, kod);
      console.log(`Aktivní profil: ${kod}. Uplatní se při příštím sběru.`);
      return;
    }

    for (const p of await seznamProfilu(db)) {
      console.log(`${p.aktivni ? "→" : " "} ${p.kod.padEnd(20)} ${p.nazev}`);
      if (p.popis) console.log(`    ${p.popis}`);
    }

    const a = await nactiProfil(db);
    console.log(`\nAktivní profil: ${a.nazev}`);
    console.log(`  právních forem: ${a.formy.size}`);
    console.log(`  práh velikosti: ${a.minZamestnancu ?? "neposuzuje se"}`);
    if (a.jenObory.size > 0) {
      console.log(`  JEN obory CZ-NACE: ${[...a.jenObory].sort().join(", ")}`);
    }
    if (a.vylouceneObory.size > 0) {
      console.log(`  vyloučené obory: ${[...a.vylouceneObory].sort().join(", ")}`);
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
      // Území místo zóny jídelny — firmy ze sběru nad oblastí jsou mimo zónu.
      oblast: { type: "string" },
      // Objednávka AI rešerše — jen firmy vybrané do dané kampaně, stejné
      // pravidlo jako firmyProReserse (src/reserse.ts). Nepovinné, majitel
      // dál může použít příkaz ručně beze změny.
      kampan: { type: "string" },
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
      oblastId: values.oblast,
      kampanId: values.kampan,
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
  case "prenos":
    await cmdPrenos(zbytek);
    break;
  case "uzivatel":
    await cmdUzivatel(zbytek);
    break;
  case "profil":
    await cmdProfil(zbytek);
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
  case "doplnit-velikosti":
    await cmdDoplnitVelikosti(zbytek);
    break;
  case "kampan":
    await cmdKampan(zbytek);
    break;
  case "pruzkum":
    await cmdPruzkum(zbytek);
    break;
  case "reserse":
    await cmdReserse(zbytek);
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
  prenos [--potvrdit]              přenese lokální data do sdílené databáze (DATABASE_URL)
  uzivatel [seznam]                vypíše uživatele aplikace a jejich role
  uzivatel role --email … --role super-admin|admin|uzivatel
  profil [seznam]                  vypíše profily projektu (koho hledáme)
  profil zvol <kod>                přepne aktivní profil
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
  oblast prepocitej [--oblast <id>]
                                   znovu spočítá, které firmy do oblasti spadají
                                   (seznam se zapisuje při uložení, kartotéka mezitím roste)
  zona --jidelna <id> [--polomery 1000,3000,5000]
                                   kolik firem přibude při jakém poloměru zóny
  dosah [--jidelna <id>]           přepočte, které jídelny mají kterou firmu v dosahu
  doplnit-velikosti [--oblast id]
                                   doplní velikost firem ze souboru registru ČSÚ
                                   (bez internetu; ARES nic navíc nedoplní)
  doplnit-kontakty [--limit N] [--jidelna id | --oblast id] [--jen-cilove]
                                   doplní kontakty u firem, které už v kartotéce jsou
                                   (--oblast dosáhne i na firmy bez jídelny —
                                   ty ze sběru nad územím; ARES snese dávky, ne 13 tisíc naráz)
  kampan [seznam]                  vypíše kampaně (pojmenované seznamy firem)
  kampan nova <název> --spravce <e-mail> [--kontext text]
                                   založí kampaň (stav rozpracovana)
  kampan uzemi <id kampaně> <id oblasti> [<id oblasti>…] [--jidelna <id>]
                                   přiřadí kampani území (i víc oblastí naráz;
                                   nastavuje celou množinu, nepřidává)
  kampan napln <id kampaně>        doplní do kampaně firmy z jejího území
  kampan firmy <id kampaně>        vypíše firmy v kampani
  kampan vyrad <id kampaně> <ičo> --duvod text
                                   ručně vyřadí firmu z kampaně
  kampan souhrn <id kampaně>       podklad k posouzení (firmy, kontakty, kapacita, překryv)
  kampan stav <id kampaně> <nový stav> [--duvod text]
                                   změní stav kampaně (důvod povinný u zrušení)
  pruzkum objednej <id oblasti> [--kampan <id>] --pozadal <e-mail>
                                   objedná průzkum území pro agenta
  pruzkum obsluz [--nejvyse-objednavek 3] [--nejvyse N]
                                   NAPLÁNOVANÝ BĚH — vezme si objednávky
                                   z fronty sám a vyřídí je. Jeden běh naráz
                                   (hlídá zámek), spadlý běh se po 15 min
                                   dá převzít.
  pruzkum fronta                   vypíše čekající objednávky průzkumu
  pruzkum dalsi                    vypíše nejstarší čekající objednávku
  pruzkum zahaj <id> [--run <id běhu>]
                                   označí objednávku jako běžící (stav bezi)
  pruzkum dokonc <id> --prevzato N --novych N
                                   dokončí běžící průzkum (stav hotovo)
  pruzkum selhal <id> --chyba text
                                   označí běžící průzkum za neúspěšný (stav selhalo)
  pruzkum rozhlednuti <id>         rozhlédne se po území, založí úseky a odhadne čas
  pruzkum vyrid <id> [--nejvyse N] zpracuje úseky (naváže tam, kde se skončilo);
                                   --i-bez-obci jen dovolí běh, když tvar nezabírá
                                   žádnou obec — sběr podle souřadnic zatím neumí nic navíc
  pruzkum useky <id>               vypíše úseky průzkumu a jejich stav
  reserse obsluz                   vyřídí jednu objednávku AI průzkumu
                                   (spustí Čmuchala neinteraktivně)
  k-obohaceni [--limit N] [--kampan <id>] [--segmenty stredni,korporat] [--bez-spojeni]
                                   vypíše firmy čekající na rešerši (pro agenta);
                                   --kampan = jen firmy vybrané do dané kampaně (stejné jako
                                   objednávka AI rešerše); --bez-spojeni = známe jméno, chybí
                                   e-mail i telefon
  zapis-nalezy --soubor x.json     zapíše nálezy od agenta (kontroluje zdroje)
  metriky                          metriky fáze 1 (cíl: 200 ověřených firem)`);
    process.exit(prikaz ? 1 : 0);
}
