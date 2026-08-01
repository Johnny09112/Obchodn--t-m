import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { nactiKampan, seznamKampani, zalozKampan } from "../src/kampan.js";
import { firmyVOblasti, zalozOblast } from "../src/oblast.js";
import { pridejPravidlo } from "../src/blacklist.js";
import { nastavGeo, zalozFirmu, zapisAtribut } from "../src/repo.js";
import {
  firmyKampane, naplnZOblasti, nastavUzemi, oblastiKampane, vyradFirmu,
} from "../src/kampan.js";
import { prekryvKampani, souhrnKampane } from "../src/kampan.js";
import { zapisKontakt } from "../src/repo.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

const STRED = { lat: 49.6, lng: 13.2 };
const severne = (m: number) => ({ lat: STRED.lat + m / 111_320, lng: STRED.lng });

const zaznam = (ico: string, nazev: string): AresZaznam => ({
  ico, nazev, adresa: "x", obec: "Zbůch", czNace: ["25610"],
  velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
});

/** Založí dvě firmy uvnitř a jednu daleko, a k tomu kruhovou oblast 3 km. */
async function pripravUzemi(): Promise<string> {
  for (const [ico, nazev, m] of [
    ["25232657", "Blízká s.r.o.", 500],
    ["48362956", "Prostřední s.r.o.", 2000],
    ["17439523", "Daleká s.r.o.", 9000],
  ] as const) {
    await zalozFirmu(db, zaznam(ico, nazev));
    const p = severne(m);
    // `jidelnaId` je v GeoVstup povinné, ale tyhle firmy k žádné jídelně
    // nepatří. Stejný obrat používá test/oblast-db.test.ts.
    await nastavGeo(db, ico, {
      lat: p.lat, lng: p.lng, jidelnaId: null,
      vzdalenostM: m, vZone: true,
    });
  }
  return zalozOblast(db, {
    nazev: "Zkušební", oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
  });
}

describe("firmy v kampani", () => {
  it("naplní se z oblasti jen firmy uvnitř", async () => {
    const oblastId = await pripravUzemi();
    const id = await zalozKampan(db, { nazev: "K1", spravce: "a@b.cz" });
    await nastavUzemi(db, id, { oblastiIds: [oblastId] });

    const vysledek = await naplnZOblasti(db, id);
    expect(vysledek.pridano).toBe(2);
    expect(vysledek.jizBylo).toBe(0);

    const firmy = await firmyKampane(db, id);
    expect(firmy.map((f) => f.ico).sort()).toEqual(["25232657", "48362956"]);
  });

  it("vyřazená firma zůstane vyřazená i po doplnění nových", async () => {
    // Regrese: naplnit znovu nesmí vzkřísit ručně vyřazenou firmu.
    const oblastId = await pripravUzemi();
    const id = await zalozKampan(db, { nazev: "K2", spravce: "a@b.cz" });
    await nastavUzemi(db, id, { oblastiIds: [oblastId] });
    await naplnZOblasti(db, id);

    await vyradFirmu(db, id, "25232657", "má vlastní jídelnu");

    const znovu = await naplnZOblasti(db, id);
    expect(znovu.pridano).toBe(0);
    expect(znovu.jizBylo).toBe(2);

    const firmy = await firmyKampane(db, id);
    const vyrazena = firmy.find((f) => f.ico === "25232657");
    expect(vyrazena?.stav).toBe("vyrazena");
    expect(vyrazena?.duvodVyrazeni).toBe("má vlastní jídelnu");
  });

  it("vyřazení bez důvodu neprojde", async () => {
    const oblastId = await pripravUzemi();
    const id = await zalozKampan(db, { nazev: "K3", spravce: "a@b.cz" });
    await nastavUzemi(db, id, { oblastiIds: [oblastId] });
    await naplnZOblasti(db, id);
    await expect(vyradFirmu(db, id, "25232657", "  ")).rejects.toThrow();
  });
});

describe("kvalifikace při plnění kampaně z oblasti", () => {
  /** Firma uvnitř oblasti, s možností přepsat pole z rejstříku. */
  async function firmaUvnitr(ico: string, zmeny: Partial<AresZaznam> = {}): Promise<void> {
    await zalozFirmu(db, { ...zaznam(ico, `Firma ${ico}`), ...zmeny });
    const p = severne(1000);
    await nastavGeo(db, ico, {
      lat: p.lat, lng: p.lng, jidelnaId: null, vzdalenostM: 1000, vZone: true,
    });
  }

  async function kampanNadUzemim(oblastId: string, nazev: string): Promise<string> {
    const id = await zalozKampan(db, { nazev, spravce: "a@b.cz" });
    await nastavUzemi(db, id, { oblastiIds: [oblastId] });
    return id;
  }

  it("blacklistovaná firma se do kampaně nedoplní", async () => {
    const oblastId = await pripravUzemi();
    await pridejPravidlo(db, {
      typ: "ico", hodnota: "25232657", duvod: "majitel si nepřeje oslovit",
    });

    const id = await kampanNadUzemim(oblastId, "K-blacklist");
    await naplnZOblasti(db, id);

    const ica = (await firmyKampane(db, id)).map((f) => f.ico);
    expect(ica).not.toContain("25232657");
    expect(ica).toContain("48362956");
  });

  it("partnerská jídelna se do kampaně nedoplní", async () => {
    const oblastId = await pripravUzemi();
    await db.query(
      `insert into jidelny (nazev, adresa, obec, lat, lng, kod_obce, ico)
       values ('ZŠ Zbůch','x','Zbůch',$1,$2,559661,$3)`,
      [STRED.lat, STRED.lng, "25232657"],
    );

    const id = await kampanNadUzemim(oblastId, "K-partner");
    await naplnZOblasti(db, id);

    expect((await firmyKampane(db, id)).map((f) => f.ico)).not.toContain("25232657");
  });

  it("bytový dům se do kampaně nedoplní", async () => {
    const oblastId = await pripravUzemi();
    // 145 = společenství vlastníků jednotek; formálně zaměstnavatel, nikdo tam neobědvá.
    await firmaUvnitr("27604977", { pravniForma: "145" });

    const id = await kampanNadUzemim(oblastId, "K-bytovy");
    await naplnZOblasti(db, id);

    expect((await firmyKampane(db, id)).map((f) => f.ico)).not.toContain("27604977");
  });

  it("firma s doloženou vlastní jídelnou se do kampaně nedoplní", async () => {
    const oblastId = await pripravUzemi();
    await zapisAtribut(db, "25232657", "ma_vlastni_jidelnu", "true", {
      zdrojUrl: "https://example.cz/o-nas", citace: "Zaměstnancům vaříme ve vlastní jídelně.",
    });

    const id = await kampanNadUzemim(oblastId, "K-jidelna");
    await naplnZOblasti(db, id);

    expect((await firmyKampane(db, id)).map((f) => f.ico)).not.toContain("25232657");
  });

  it("firma bez doložené jídelny (nevíme) se doplní normálně", async () => {
    // Regrese: NULL znamená „nevíme", ne „má ji". Vyřadit ji by byl dohad (TP-2).
    const oblastId = await pripravUzemi();
    const id = await kampanNadUzemim(oblastId, "K-nevime");
    await naplnZOblasti(db, id);

    expect((await firmyKampane(db, id)).map((f) => f.ico)).toContain("25232657");
  });

  it("vyřazená firma zůstane v oblasti — filtr se týká kampaně, ne geometrie", async () => {
    // `oblast_firmy` odpovídá na otázku „co leží uvnitř tvaru". Blacklist je
    // otázka „koho oslovit". Kdyby filtr sáhl sem, počet firem na mapě by se
    // měnil podle blacklistu a nikdo by nepochopil proč.
    const oblastId = await pripravUzemi();
    await pridejPravidlo(db, { typ: "ico", hodnota: "25232657", duvod: "test" });

    const id = await kampanNadUzemim(oblastId, "K-geometrie");
    await naplnZOblasti(db, id);

    const vOblasti = await firmyVOblasti(db, oblastId);
    expect(vOblasti.map((f) => f.ico)).toContain("25232657");
  });
});

describe("schéma kampaní", () => {
  it("název kampaně je jedinečný bez ohledu na velikost písmen", async () => {
    await db.query("insert into kampane (nazev, spravce) values ($1,$2)", [
      "Západní Čechy", "laub@cantinero.cz",
    ]);
    await expect(
      db.query("insert into kampane (nazev, spravce) values ($1,$2)", [
        "západní čechy", "laub@cantinero.cz",
      ]),
    ).rejects.toThrow();
  });

  it("zrušení bez důvodu neprojde", async () => {
    await expect(
      db.query("insert into kampane (nazev, spravce, stav) values ($1,$2,'zrusena')", [
        "Bez důvodu", "laub@cantinero.cz",
      ]),
    ).rejects.toThrow();
  });

  it("INSERT se stavem schválena bez firem s kontaktem padne", async () => {
    await expect(
      db.query("insert into kampane (nazev, spravce, stav) values ($1,$2,'schvalena')", [
        "Schválená bez firem", "laub@cantinero.cz",
      ]),
    ).rejects.toThrow();
  });

  it("INSERT se stavem rozpracovana projde", async () => {
    const rows = await db.query("insert into kampane (nazev, spravce, stav) values ($1,$2,'rozpracovana') returning id", [
      "Rozpracovaná kampaň", "laub@cantinero.cz",
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty("id");
  });
});

describe("založení kampaně", () => {
  it("založí a přečte kampaň ve výchozím stavu", async () => {
    const id = await zalozKampan(db, {
      nazev: "Vary — kapacita od srpna",
      spravce: "laub@cantinero.cz",
      kontext: "Jídelna ve Varech nabízí 30 obědů od srpna.",
    });
    const k = await nactiKampan(db, id);
    expect(k?.nazev).toBe("Vary — kapacita od srpna");
    expect(k?.stav).toBe("rozpracovana");
    expect(k?.krok).toBe(1);
    expect(await oblastiKampane(db, id)).toEqual([]);
  });

  it("neznámé id vrátí null, ne výjimku", async () => {
    expect(await nactiKampan(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("seznam vrací nejnovější první", async () => {
    await zalozKampan(db, { nazev: "První", spravce: "a@b.cz" });
    await zalozKampan(db, { nazev: "Druhá", spravce: "a@b.cz" });
    const seznam = await seznamKampani(db);
    expect(seznam.map((k) => k.nazev)).toEqual(["Druhá", "První"]);
  });
});

describe("souhrn a překryv", () => {
  it("souhrn spočítá firmy, spojení a rozpad podle úrovně adresy", async () => {
    const oblastId = await pripravUzemi();
    const id = await zalozKampan(db, { nazev: "S1", spravce: "a@b.cz" });
    await nastavUzemi(db, id, { oblastiIds: [oblastId] });
    await naplnZOblasti(db, id);
    await zapisKontakt(db, "25232657", {
      email: "poptavka@firma.cz", urovenAdresy: 2,
      zdrojUrl: "https://firma.cz/kontakt", citace: "poptavka@firma.cz",
    });

    const s = await souhrnKampane(db, id);
    expect(s.firem).toBe(2);
    expect(s.vyrazenych).toBe(0);
    expect(s.seSpojenim).toBe(1);
    expect(s.podleUrovne).toContainEqual({ uroven: 2, pocet: 1 });
  });

  it("překryv vypíše, ve kterých kampaních firma ještě je", async () => {
    const oblastId = await pripravUzemi();
    const prvni = await zalozKampan(db, { nazev: "Široká", spravce: "a@b.cz" });
    await nastavUzemi(db, prvni, { oblastiIds: [oblastId] });
    await naplnZOblasti(db, prvni);

    const druha = await zalozKampan(db, { nazev: "Úzká", spravce: "a@b.cz" });
    await nastavUzemi(db, druha, { oblastiIds: [oblastId] });
    await naplnZOblasti(db, druha);

    const p = await prekryvKampani(db, druha);
    expect(p).toEqual([{ nazev: "Široká", pocet: 2 }]);
  });

  it("vyřazená firma se do překryvu nepočítá", async () => {
    const oblastId = await pripravUzemi();
    const prvni = await zalozKampan(db, { nazev: "Prvni", spravce: "a@b.cz" });
    await nastavUzemi(db, prvni, { oblastiIds: [oblastId] });
    await naplnZOblasti(db, prvni);
    await vyradFirmu(db, prvni, "25232657", "nezajímavá");
    await vyradFirmu(db, prvni, "48362956", "nezajímavá");

    const druha = await zalozKampan(db, { nazev: "Druha", spravce: "a@b.cz" });
    await nastavUzemi(db, druha, { oblastiIds: [oblastId] });
    await naplnZOblasti(db, druha);

    expect(await prekryvKampani(db, druha)).toEqual([]);
  });
});
