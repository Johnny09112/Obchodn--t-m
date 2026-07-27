import { parseArgs } from "node:util";
import { appendFile, readFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { pripojPglite, pripojPostgres, spustMigrace, type Db } from "./db.js";
import { vytvorAresKlienta } from "./ares.js";
import { vytvorGeokoder } from "./geocode.js";
import { vytvorEnricher, type Enricher } from "./enrich.js";
import { spustCmuchala } from "./cmuchal.js";
import { metrikyFaze1, prehledStavu } from "./metriky.js";
import { vygenerujMapu } from "./mapa.js";
import { vytvorResKlienta } from "./res.js";
import { vytvorMpsvKlienta } from "./mpsv.js";
import { vytvorOsmKlienta } from "./osm.js";
import { firmyKObohaceni, zapisDavku } from "./nalezy.js";
import { vygenerujKartoteku } from "./kartoteka.js";

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
        enricher,
      },
      values.jidelna,
      {
        limit: values.limit ? Number(values.limit) : undefined,
        aresSweep: values["bez-sweep"] !== true,
        minZamestnancu: values["min-zamestnancu"] ? Number(values["min-zamestnancu"]) : undefined,
      },
    );

    console.log(`Běh ${souhrn.behId} dokončen:`);
    console.log(`  kandidátů: ${souhrn.kandidatu}`);
    console.log(`  kvalifikováno: ${souhrn.kvalifikovano}`);
    console.log(`  čeká na jídelnu: ${souhrn.cekajicich}`);
    console.log(`  zahozeno: ${souhrn.zahozeno}, přeskočeno (už v DB): ${souhrn.preskoceno}`);
    console.log(`  vyřazeno — bez zaměstnanců: ${souhrn.bezZamestnancu}, pod limitem velikosti: ${souhrn.podLimitem}, agentur: ${souhrn.agentur}, nevhodný obor: ${souhrn.vyloucenyObor}`);
    console.log(`  chyb: ${souhrn.chyby.length}, náklady: ${souhrn.nakladyUsd.toFixed(2)}`);

    if (souhrn.poznamkyProPlaybook.length > 0) {
      const datum = new Date().toISOString().slice(0, 10);
      await appendFile(
        "playbook-cmuchal.md",
        `\n## Běh ${datum} (${souhrn.behId})\n${souhrn.poznamkyProPlaybook.map((p) => `- ${p}`).join("\n")}\n`,
        "utf8",
      );
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

async function cmdKObohaceni(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { limit: { type: "string" }, jidelna: { type: "string" } },
  });
  const db = await pripojDb();
  try {
    const firmy = await firmyKObohaceni(db, {
      limit: values.limit ? Number(values.limit) : undefined,
      jidelnaId: values.jidelna,
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
  k-obohaceni [--limit N]          vypíše firmy čekající na rešerši (pro agenta)
  zapis-nalezy --soubor x.json     zapíše nálezy od agenta (kontroluje zdroje)
  metriky                          metriky fáze 1 (cíl: 200 ověřených firem)`);
    process.exit(prikaz ? 1 : 0);
}
