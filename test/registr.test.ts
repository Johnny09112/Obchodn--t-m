import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { vytvorRegistrKlienta } from "../src/registr.js";

// Vzorek s pravou hlavičkou souboru ČSÚ. Testy běží offline nad tímhle
// souborem — nikdy se nesahá na síť.
const HLAVICKA =
  "ICO,OKRESLAU,DDATVZN,DDATZAN,ZPZAN,DDATPAKT,FORMA,ROSFORMA,KATPO,NACE," +
  "NACE2025,ICZUJ,FIRMA,CISS2010,KODADM,TEXTADR,PSC,OBEC_TEXT,COBCE_TEXT," +
  "ULICE_TEXT,TYPCDOM,CDOM,COR,DATPLAT,PRIZNAK";

const r = (p: Partial<Record<string, string>>): string =>
  [
    p.ICO ?? "25232657", p.OKRESLAU ?? "CZ0327", "1997-01-01", p.DDATZAN ?? "",
    "", "2026-01-15", p.FORMA ?? "112", p.FORMA ?? "112", p.KATPO ?? "230",
    p.NACE ?? "25610", p.NACE ?? "25610", p.ICZUJ ?? "560740",
    `"${p.FIRMA ?? "KOVOVÝROBA HONZÍK, s.r.o."}"`, "13110", "1", '""',
    p.PSC ?? "34953", p.OBEC_TEXT ?? "Bezdružice", p.OBEC_TEXT ?? "Bezdružice",
    p.ULICE_TEXT ?? "Úterská", "1", p.CDOM ?? "196", "", "2026-07-15", "",
  ].join(",");

let cesta: string;

async function souborSRadky(radky: string[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "cantinero-registr-"));
  const c = join(dir, "res_data.csv");
  await writeFile(c, [HLAVICKA, ...radky].join("\n"), "utf8");
  return c;
}

beforeEach(async () => {
  cesta = await souborSRadky([
    r({ ICO: "25232657", FIRMA: "KOVOVÝROBA HONZÍK, s.r.o.", KATPO: "230" }),
    r({ ICO: "48362956", FIRMA: "ROLDECO, spol. s r.o.", KATPO: "120" }), // 1–5
    r({ ICO: "45407070", FIRMA: "KATEŘINA POHLOTOVÁ", FORMA: "101", KATPO: "120" }),
    r({ ICO: "26352524", FIRMA: "Společenství vlastníků 180", FORMA: "145", KATPO: "120" }),
    r({ ICO: "05499861", FIRMA: "Zaniklá s.r.o.", DDATZAN: "2020-05-01", KATPO: "230" }),
    // Stejný název obce, ale jiná územní jednotka i okres — cizí Hrádek.
    r({ ICO: "49788132", FIRMA: "MONTEFERRO HRÁDEK a. s.", ICZUJ: "559822",
        OBEC_TEXT: "Hrádek", OKRESLAU: "CZ0326", KATPO: "320" }),
    r({ ICO: "12345676", FIRMA: "Cizí firma z jiného Hrádku", ICZUJ: "570052",
        OBEC_TEXT: "Hrádek", OKRESLAU: "CZ0642", KATPO: "320" }),
  ]);
});

describe("výběr zaměstnavatelů z registru", () => {
  it("vrátí jen zaměstnavatele z požadované územní jednotky", async () => {
    const registr = vytvorRegistrKlienta({ cestaSouboru: cesta });
    const f = await registr.zamestnavateleVJednotkach([560740]);

    expect(f.map((x) => x.ico).sort()).toEqual(["25232657", "48362956"]);
  });

  it("živnostníky ani bytové domy nenabízí", async () => {
    const registr = vytvorRegistrKlienta({ cestaSouboru: cesta });
    const f = await registr.zamestnavateleVJednotkach([560740]);

    expect(f.map((x) => x.ico)).not.toContain("45407070"); // živnostník
    expect(f.map((x) => x.ico)).not.toContain("26352524"); // SVJ
  });

  it("zaniklý subjekt vynechá", async () => {
    const registr = vytvorRegistrKlienta({ cestaSouboru: cesta });
    const f = await registr.zamestnavateleVJednotkach([560740]);
    expect(f.map((x) => x.ico)).not.toContain("05499861");
  });

  it("umí rovnou odfiltrovat malé firmy", async () => {
    const registr = vytvorRegistrKlienta({ cestaSouboru: cesta });
    const f = await registr.zamestnavateleVJednotkach([560740], { minZamestnancu: 25 });
    expect(f.map((x) => x.ico)).toEqual(["25232657"]); // ROLDECO má 1–5
  });

  it("nesplete si stejnojmenné obce — rozhoduje kód jednotky, ne název", async () => {
    // „Hrádek" je v ČR šestkrát. Kdyby se filtrovalo podle názvu obce,
    // natáhly by se firmy z cizích Hrádků a spadly by do zóny jídelny.
    const registr = vytvorRegistrKlienta({ cestaSouboru: cesta });
    const f = await registr.zamestnavateleVJednotkach([559822]);
    expect(f.map((x) => x.ico)).toEqual(["49788132"]);
  });

  it("velké město se zadá víc jednotkami najednou", async () => {
    const registr = vytvorRegistrKlienta({ cestaSouboru: cesta });
    const f = await registr.zamestnavateleVJednotkach([560740, 559822]);
    expect(f).toHaveLength(3);
  });

  it("vrací i podklady pro adresu a evidenci", async () => {
    const registr = vytvorRegistrKlienta({ cestaSouboru: cesta });
    const nalezene = await registr.zamestnavateleVJednotkach([560740], { minZamestnancu: 25 });
    const f = nalezene[0]!;

    expect(f).toMatchObject({
      ico: "25232657",
      nazev: "KOVOVÝROBA HONZÍK, s.r.o.",
      pravniForma: "112",
      kategorieKod: "230",
      obec: "Bezdružice",
      psc: "34953",
    });
    expect(f.adresa).toContain("Úterská");
    expect(f.zdrojUrl).toMatch(/^https:\/\//);
  });
});

describe("určení územních jednotek jídelny", () => {
  it("z IČO jídelny najde její jednotku i sousední obvody téhož města", async () => {
    // Statutární město je v registru rozdělené na obvody. Jídelna zná jen
    // svoje IČO, zbytek se musí odvodit — jinak by v Plzni viděla desetinu města.
    const mesto = await souborSRadky([
      r({ ICO: "60611201", FIRMA: "ZŠ v obvodu 1", FORMA: "621", ICZUJ: "546003",
          OBEC_TEXT: "Plzeň", OKRESLAU: "CZ0323" }),
      r({ ICO: "17439523", FIRMA: "Firma v obvodu 2", ICZUJ: "545970",
          OBEC_TEXT: "Plzeň", OKRESLAU: "CZ0323" }),
      r({ ICO: "12345676", FIRMA: "Firma v jiné Plzni-jméno", ICZUJ: "999999",
          OBEC_TEXT: "Plzeň", OKRESLAU: "CZ0999" }),
    ]);
    const registr = vytvorRegistrKlienta({ cestaSouboru: mesto });

    const j = await registr.jednotkyObce("60611201");
    expect(j.sort()).toEqual([545970, 546003]); // obvod z jiného okresu ne
  });

  it("u neznámého IČO nic nevymýšlí", async () => {
    const registr = vytvorRegistrKlienta({ cestaSouboru: cesta });
    expect(await registr.jednotkyObce("99999999")).toEqual([]);
  });
});

describe("stažení a stáří souboru", () => {
  it("chybí-li soubor, stáhne ho", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cantinero-stazeni-"));
    const cil = join(dir, "res_data.csv");
    const adresy: string[] = [];
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      adresy.push(String(url));
      return new Response(`${HLAVICKA}\n${r({})}`, { status: 200 });
    });

    const registr = vytvorRegistrKlienta({ cestaSouboru: cil, fetchFn });
    const f = await registr.zamestnavateleVJednotkach([560740]);

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(adresy[0]).toContain("res_data.csv");
    expect(f).toHaveLength(1);
  });

  it("existující čerstvý soubor znovu nestahuje", async () => {
    const fetchFn = vi.fn();
    const registr = vytvorRegistrKlienta({ cestaSouboru: cesta, fetchFn });
    await registr.zamestnavateleVJednotkach([560740]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
