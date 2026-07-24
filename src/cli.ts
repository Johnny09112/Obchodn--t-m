import { parseArgs } from "node:util";
import { appendFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { pripojPostgres, spustMigrace, type Db } from "./db.js";
import { vytvorAresKlienta } from "./ares.js";
import { vytvorGeokoder } from "./geocode.js";
import { vytvorEnricher, type Enricher } from "./enrich.js";
import { spustCmuchala } from "./cmuchal.js";
import { metrikyFaze1, prehledStavu } from "./metriky.js";

function pripojDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "Chybí DATABASE_URL. Nastav connection string na Postgres/Supabase (viz .env.example).",
    );
    process.exit(1);
  }
  return pripojPostgres(url);
}

async function cmdMigrate(): Promise<void> {
  const db = pripojDb();
  try {
    await spustMigrace(db);
    console.log("Migrace aplikovány.");
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
      kapacita: { type: "string" },
      zona: { type: "string", default: "3000" },
    },
  });
  const povinne = ["nazev", "adresa", "lat", "lng", "kod-obce", "kapacita"] as const;
  for (const p of povinne) {
    if (!values[p]) {
      console.error(`Chybí --${p}`);
      process.exit(1);
    }
  }
  const db = pripojDb();
  try {
    const rows = await db.query<{ id: string }>(
      `insert into jidelny (nazev, adresa, lat, lng, kod_obce, kapacita_volna, zona_metru)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [
        values.nazev,
        values.adresa,
        Number(values.lat),
        Number(values.lng),
        Number(values["kod-obce"]),
        Number(values.kapacita),
        Number(values.zona),
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

  const db = pripojDb();
  try {
    const souhrn = await spustCmuchala(
      {
        db,
        ares: vytvorAresKlienta(),
        geokoder: vytvorGeokoder({ kontakt }),
        enricher,
      },
      values.jidelna,
      { limit: values.limit ? Number(values.limit) : undefined },
    );

    console.log(`Běh ${souhrn.behId} dokončen:`);
    console.log(`  kandidátů: ${souhrn.kandidatu}`);
    console.log(`  kvalifikováno: ${souhrn.kvalifikovano}`);
    console.log(`  čeká na jídelnu: ${souhrn.cekajicich}`);
    console.log(`  zahozeno: ${souhrn.zahozeno}, přeskočeno (už v DB): ${souhrn.preskoceno}`);
    console.log(`  chyb: ${souhrn.chyby.length}, náklady: $${souhrn.nakladyUsd.toFixed(2)}`);

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
  const db = pripojDb();
  try {
    const p = await prehledStavu(db);
    console.log("Firmy dle stavu:");
    for (const [stav, pocet] of Object.entries(p.firmyDleStavu)) {
      console.log(`  ${stav}: ${pocet}`);
    }
    console.log(`Aktivních jídelen: ${p.aktivnichJidelen}, volná kapacita: ${p.kapacitaAktivnichJidelen} obědů/den`);
    const kvalifikovanych = p.firmyDleStavu["kvalifikovany"] ?? 0;
    if (p.kapacitaAktivnichJidelen === 0) {
      console.log("⚠ Kapacita jídelen je 0 — prioritou je získávání jídelen, ne firem (SPEC kap. 2).");
    } else {
      console.log(`Poměr kvalifikovaných firem ke kapacitě: ${kvalifikovanych} firem / ${p.kapacitaAktivnichJidelen} obědů`);
    }
  } finally {
    await db.close();
  }
}

async function cmdMetriky(): Promise<void> {
  const db = pripojDb();
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
  case "metriky":
    await cmdMetriky();
    break;
  default:
    console.log(`Cantinero — fáze 1 (Čmuchal). Příkazy:
  migrate                          aplikuje migrace na DATABASE_URL
  seed-jidelna --nazev … --adresa … --lat … --lng … --kod-obce … --kapacita … [--zona 3000]
  run --jidelna <id> [--limit N]   spustí Čmuchala pro jídelnu
  stav                             počty firem a kapacita jídelen
  metriky                          metriky fáze 1 (cíl: 200 ověřených firem)`);
    process.exit(prikaz ? 1 : 0);
}
