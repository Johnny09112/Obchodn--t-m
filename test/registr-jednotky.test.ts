import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { vytvorRegistrKlienta } from "../src/registr.js";

// Vzorek s pravou hlavičkou souboru ČSÚ — stejný způsob podstrčení dat
// jako v test/registr.test.ts. Testy běží offline, nikdy nesahají na síť.
const HLAVICKA =
  "ICO,OKRESLAU,DDATVZN,DDATZAN,ZPZAN,DDATPAKT,FORMA,ROSFORMA,KATPO,NACE," +
  "NACE2025,ICZUJ,FIRMA,CISS2010,KODADM,TEXTADR,PSC,OBEC_TEXT,COBCE_TEXT," +
  "ULICE_TEXT,TYPCDOM,CDOM,COR,DATPLAT,PRIZNAK";

const r = (p: Partial<Record<string, string>>): string =>
  [
    p.ICO ?? "25232657", p.OKRESLAU ?? "CZ0327", "1997-01-01", p.DDATZAN ?? "",
    "", "2026-01-15", p.FORMA ?? "112", p.FORMA ?? "112", p.KATPO ?? "230",
    p.NACE ?? "25610", p.NACE ?? "25610", p.ICZUJ ?? "560740",
    `"${p.FIRMA ?? "Firma"}"`, "13110", "1", '""',
    p.PSC ?? "34953", p.OBEC_TEXT ?? "Bezdružice", p.OBEC_TEXT ?? "Bezdružice",
    "Hlavní", "1", "1", "", "2026-07-15", "",
  ].join(",");

// Tři různé obce se jménem „Hrádek" (v ČR je jich skutečně šest) — každá
// v jiné jednotce a s jiným PSČ, aby šlo ověřit, že se podle jména samotného
// nepřiplete cizí obec.
const RADKY = [
  r({ ICO: "10000001", ICZUJ: "560740", OBEC_TEXT: "Bezdružice", PSC: "34953" }),
  r({ ICO: "10000002", ICZUJ: "559822", OBEC_TEXT: "Hrádek", PSC: "46334" }),
  r({ ICO: "10000003", ICZUJ: "570052", OBEC_TEXT: "Hrádek", PSC: "46381" }),
  r({ ICO: "10000004", ICZUJ: "545911", OBEC_TEXT: "Hrádek", PSC: "40204" }),
  // Druhá firma ve stejné jednotce jako Bezdružice — pro test na deduplikaci.
  r({ ICO: "10000005", ICZUJ: "560740", OBEC_TEXT: "Bezdružice", PSC: "34953" }),
];

let cesta: string;

beforeEach(async () => {
  const dir = await mkdtemp(join(tmpdir(), "cantinero-jednotky-"));
  cesta = join(dir, "res_data.csv");
  await writeFile(cesta, [HLAVICKA, ...RADKY].join("\n"), "utf8");
});

describe("překlad míst na územní jednotky registru", () => {
  it("místo s obcí i PSČ najde svou jednotku", async () => {
    const registr = vytvorRegistrKlienta({ cestaSouboru: cesta });
    const j = await registr.jednotkyPodleMist([{ obec: "Bezdružice", psc: "349 53" }]);
    expect(j).toEqual([{ jednotka: 560740, obec: "Bezdružice" }]);
  });

  it("stejný název obce v jiném PSČ se nesplete — Hrádek je v ČR šestkrát", async () => {
    const registr = vytvorRegistrKlienta({ cestaSouboru: cesta });
    const j = await registr.jednotkyPodleMist([{ obec: "Hrádek", psc: "463 34" }]);
    expect(j).toEqual([{ jednotka: 559822, obec: "Hrádek" }]);
  });

  it("místo bez PSČ najde všechny jednotky toho jména", async () => {
    const registr = vytvorRegistrKlienta({ cestaSouboru: cesta });
    const j = await registr.jednotkyPodleMist([{ obec: "Hrádek", psc: null }]);
    expect(j.map((x) => x.jednotka).sort()).toEqual([545911, 559822, 570052]);
  });

  it("neznámá obec nevrátí nic a nespadne", async () => {
    const registr = vytvorRegistrKlienta({ cestaSouboru: cesta });
    await expect(
      registr.jednotkyPodleMist([{ obec: "Neexistujícívesnice", psc: null }]),
    ).resolves.toEqual([]);
  });

  it("dvě místa v jedné jednotce dají jeden výsledek, ne dva", async () => {
    const registr = vytvorRegistrKlienta({ cestaSouboru: cesta });
    const j = await registr.jednotkyPodleMist([
      { obec: "Bezdružice", psc: "34953" },
      { obec: "bezdružice", psc: "349 53" }, // stejné místo, jiný zápis
    ]);
    expect(j).toEqual([{ jednotka: 560740, obec: "Bezdružice" }]);
  });

  it("prázdný seznam míst vrátí prázdný výsledek bez čtení souboru", async () => {
    const fetchFn = vi.fn();
    const registr = vytvorRegistrKlienta({
      cestaSouboru: join(tmpdir(), "cantinero-jednotky-neexistuje", "res_data.csv"),
      fetchFn,
    });
    await expect(registr.jednotkyPodleMist([])).resolves.toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
