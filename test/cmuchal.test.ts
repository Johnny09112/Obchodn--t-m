import { beforeAll, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { spustCmuchala } from "../src/cmuchal.js";
import type { AresKlient, AresZaznam } from "../src/ares.js";
import type { Geokoder } from "../src/geocode.js";
import type { Enricher } from "../src/enrich.js";

let db: Db;
let jidelnaId: string;

// Jídelna na Staroměstském náměstí, zóna 3 km.
const JIDELNA = { lat: 50.0875, lng: 14.4213 };

const kandidati: AresZaznam[] = [
  {
    ico: "25596641",
    nazev: "Blízká s.r.o.",
    adresa: "Celetná 1, Praha",
    obec: "Praha",
    czNace: ["62010"],
    velikostKategorie: "stredni",
    kodObce: 554782,
  },
  {
    ico: "00006947",
    nazev: "Vzdálená a.s.",
    adresa: "Průhonice 100",
    obec: "Průhonice",
    czNace: ["10110"],
    velikostKategorie: "mala",
    kodObce: 554782,
  },
  {
    ico: "12345678", // nevalidní checksum → musí být zahozena (TP-1)
    nazev: "Fiktivní s.r.o.",
    adresa: "Nikde 1",
    obec: "Praha",
    czNace: [],
    velikostKategorie: null,
    kodObce: 554782,
  },
];

const mockAres: AresKlient = {
  overFirmu: async (ico) => kandidati.find((k) => k.ico === ico) ?? null,
  najdiFirmyVObci: async () => kandidati,
};

const mockGeokoder: Geokoder = {
  geokoduj: async (adresa) => {
    if (adresa.startsWith("Celetná")) return { lat: 50.0877, lng: 14.4255 }; // ~300 m
    if (adresa.startsWith("Průhonice")) return { lat: 50.0537, lng: 14.4816 }; // ~5,7 km
    return null;
  },
};

const mockEnricher: Enricher = {
  obohat: async (firma) => ({
    nalezy:
      firma.ico === "25596641"
        ? [
            {
              atribut: "ma_vlastni_jidelnu",
              hodnota: "false",
              zdrojUrl: "https://blizka.cz/kariera",
              citace: "Vlastní jídelnu nemáme, obědy řešíme stravenkami.",
            },
          ]
        : [],
    kontakty:
      firma.ico === "25596641"
        ? [
            {
              email: "poptavky@blizka.cz",
              urovenAdresy: 1 as const,
              zdrojUrl: "https://blizka.cz/kontakt",
              citace: "Poptávky: poptavky@blizka.cz",
            },
          ]
        : [],
    nakladyUsd: 0.05,
    poznamkaProPlaybook: "kariérní stránka fungovala",
  }),
};

beforeAll(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  const rows = await db.query<{ id: string }>(
    `insert into jidelny (nazev, adresa, lat, lng, kod_obce, kapacita_volna, zona_metru)
     values ('ZŠ Staroměstská', 'Staroměstské nám., Praha', $1, $2, 554782, 150, 3000)
     returning id`,
    [JIDELNA.lat, JIDELNA.lng],
  );
  jidelnaId = rows[0]!.id;
});

describe("spustCmuchala", () => {
  it("projde kandidáty a správně je roztřídí", async () => {
    const souhrn = await spustCmuchala(
      { db, ares: mockAres, geokoder: mockGeokoder, enricher: mockEnricher },
      jidelnaId,
    );

    // Blízká: kvalifikovaná, v zóně, se skóre, evidencí a kontaktem úrovně 1.
    const blizka = await db.query<{
      stav: string;
      v_zone: boolean;
      skore: number;
      ma_vlastni_jidelnu: boolean;
    }>("select stav, v_zone, skore, ma_vlastni_jidelnu from companies where ico = '25596641'");
    expect(blizka[0]!.stav).toBe("kvalifikovany");
    expect(blizka[0]!.v_zone).toBe(true);
    expect(blizka[0]!.ma_vlastni_jidelnu).toBe(false);
    expect(blizka[0]!.skore).toBeGreaterThan(70);

    const evidence = await db.query(
      "select 1 from evidence where ico = '25596641' and atribut = 'ma_vlastni_jidelnu'",
    );
    expect(evidence.length).toBeGreaterThan(0);
    const kontakt = await db.query<{ uroven_adresy: number }>(
      "select uroven_adresy from contacts where ico = '25596641'",
    );
    expect(kontakt[0]!.uroven_adresy).toBe(1);

    // Vzdálená: mimo zónu, ale do 2× zóny → čeká na jídelnu.
    const vzdalena = await db.query<{ stav: string; v_zone: boolean }>(
      "select stav, v_zone from companies where ico = '00006947'",
    );
    expect(vzdalena[0]!.stav).toBe("cekajici_na_jidelnu");
    expect(vzdalena[0]!.v_zone).toBe(false);

    // Fiktivní: neprošla validací IČO → v DB nesmí být.
    const fiktivni = await db.query("select 1 from companies where ico = '12345678'");
    expect(fiktivni).toHaveLength(0);

    // TP-13: běh je zaznamenaný a ukončený.
    const behy = await db.query<{ konec: string | null }>(
      "select konec from agent_runs where agent = 'cmuchal'",
    );
    expect(behy).toHaveLength(1);
    expect(behy[0]!.konec).not.toBeNull();

    expect(souhrn.kvalifikovano).toBe(1);
    expect(souhrn.cekajicich).toBe(1);
    expect(souhrn.zahozeno).toBe(1);
    expect(souhrn.poznamkyProPlaybook).toContain("kariérní stránka fungovala");
  });

  it("odmítne neaktivní jídelnu nebo jídelnu bez kapacity", async () => {
    const rows = await db.query<{ id: string }>(
      `insert into jidelny (nazev, adresa, lat, lng, kod_obce, kapacita_volna, aktivni)
       values ('Plná', 'x', 50, 14, 1, 0, true) returning id`,
    );
    await expect(
      spustCmuchala({ db, ares: mockAres, geokoder: mockGeokoder }, rows[0]!.id),
    ).rejects.toThrow(/kapacit/i);
  });
});
