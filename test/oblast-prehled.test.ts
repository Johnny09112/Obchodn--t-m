import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozOblast, prepocitejOblastFirmy } from "../src/oblast.js";
import { zalozKampan, nastavUzemi } from "../src/kampan.js";
import { objednejPruzkum, zahajPruzkum, dokoncPruzkum } from "../src/pruzkum.js";
import { nastavGeo, zalozFirmu } from "../src/repo.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

const STRED = { lat: 49.6, lng: 13.2 };

/** Jeden řádek pohledu `oblasti_prehled`. */
interface Radek {
  id: string;
  nazev: string;
  typ: string;
  polomer_m: number | null;
  bodu: number | null;
  firem: number;
  pruzkumu: number;
  posledni_stav: string | null;
  posledni_at: string | null;
  kampane: { nazev: string; stav: string; archivovana: boolean }[];
}

async function prehled(id: string): Promise<Radek> {
  const r = await db.query<Radek>("select * from oblasti_prehled where id = $1", [id]);
  return r[0]!;
}

async function firmaVeStredu(ico: string): Promise<void> {
  const zaznam: AresZaznam = {
    ico, nazev: `Firma ${ico}`, adresa: "x", obec: "Zbůch",
    czNace: ["25610"], velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
  };
  await zalozFirmu(db, zaznam);
  await nastavGeo(db, ico, {
    lat: STRED.lat, lng: STRED.lng, jidelnaId: null, vzdalenostM: 0, vZone: true,
  });
}

describe("přehled oblastí", () => {
  it("čerstvá oblast nemá nic — a řekne to nulou, ne prázdnem", async () => {
    // Prázdný stav je legitimní stav. Kdyby počty chyběly, musel by je
    // dopočítávat prohlížeč a rozešly by se s tím, co platí v databázi.
    const id = await zalozOblast(db, {
      nazev: "Nová",
      oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
    });

    const r = await prehled(id);
    expect(r.nazev).toBe("Nová");
    expect(r.firem).toBe(0);
    expect(r.pruzkumu).toBe(0);
    expect(r.posledni_stav).toBeNull();
    expect(r.kampane).toEqual([]);
  });

  it("u kruhu vrátí poloměr, u nakresleného tvaru počet bodů", async () => {
    const kruh = await zalozOblast(db, {
      nazev: "Kruh",
      oblast: { typ: "kruh", stred: STRED, polomerM: 6000 },
    });
    const tvar = await zalozOblast(db, {
      nazev: "Tvar",
      oblast: {
        typ: "polygon",
        body: [
          { lat: 49.5, lng: 13.1 },
          { lat: 49.7, lng: 13.1 },
          { lat: 49.7, lng: 13.3 },
        ],
      },
    });

    expect(await prehled(kruh)).toMatchObject({ typ: "kruh", polomer_m: 6000, bodu: null });
    expect(await prehled(tvar)).toMatchObject({ typ: "polygon", polomer_m: null, bodu: 3 });
  });

  it("spočítá firmy uvnitř", async () => {
    const id = await zalozOblast(db, {
      nazev: "S firmami",
      oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
    });
    await firmaVeStredu("25232657");
    await firmaVeStredu("26185610");
    await prepocitejOblastFirmy(db, id);

    expect((await prehled(id)).firem).toBe(2);
  });

  it("u průzkumu ukáže stav i kdy se naposled něco stalo", async () => {
    const id = await zalozOblast(db, {
      nazev: "Prozkoumaná",
      oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
    });
    const pruzkumId = await objednejPruzkum(db, { oblastId: id, pozadal: "a@b.cz" });

    const ceka = await prehled(id);
    expect(ceka.pruzkumu).toBe(1);
    expect(ceka.posledni_stav).toBe("ceka");
    expect(ceka.posledni_at).not.toBeNull();

    await zahajPruzkum(db, pruzkumId);
    await dokoncPruzkum(db, pruzkumId, { firemPrevzato: 3, firemNovych: 5 });

    expect((await prehled(id)).posledni_stav).toBe("hotovo");
  });

  it("z víc průzkumů popisuje ten nejnovější", async () => {
    const id = await zalozOblast(db, {
      nazev: "Dvakrát",
      oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
    });
    const stary = await objednejPruzkum(db, { oblastId: id, pozadal: "a@b.cz" });
    await zahajPruzkum(db, stary);
    await dokoncPruzkum(db, stary, { firemPrevzato: 0, firemNovych: 1 });
    await objednejPruzkum(db, { oblastId: id, pozadal: "a@b.cz" });

    const r = await prehled(id);
    expect(r.pruzkumu).toBe(2);
    expect(r.posledni_stav).toBe("ceka");
  });

  it("vyjmenuje kampaně, které oblast používají, od nejnovější", async () => {
    const id = await zalozOblast(db, {
      nazev: "V kampaních",
      oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
    });
    const stara = await zalozKampan(db, { nazev: "Jaro", spravce: "a@b.cz" });
    await nastavUzemi(db, stara, { oblastiIds: [id] });
    const nova = await zalozKampan(db, { nazev: "Podzim", spravce: "a@b.cz" });
    await nastavUzemi(db, nova, { oblastiIds: [id] });

    const r = await prehled(id);
    expect(r.kampane.map((k) => k.nazev)).toEqual(["Podzim", "Jaro"]);
    expect(r.kampane[0]).toMatchObject({ stav: "rozpracovana", archivovana: false });
  });

  it("archivovaná kampaň se pozná — oblast drží dál, ale v přehledu nepřekáží", async () => {
    const id = await zalozOblast(db, {
      nazev: "S archivem",
      oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
    });
    const kampanId = await zalozKampan(db, { nazev: "Loňská", spravce: "a@b.cz" });
    await nastavUzemi(db, kampanId, { oblastiIds: [id] });
    await db.query("update kampane set archivovana_at = now() where id = $1", [kampanId]);

    expect((await prehled(id)).kampane[0]).toMatchObject({
      nazev: "Loňská",
      archivovana: true,
    });
  });

  it("vypíše všechny oblasti, i ty prázdné", async () => {
    await zalozOblast(db, { nazev: "A", oblast: { typ: "kruh", stred: STRED, polomerM: 1000 } });
    await zalozOblast(db, { nazev: "B", oblast: { typ: "kruh", stred: STRED, polomerM: 1000 } });

    const vse = await db.query<Radek>("select * from oblasti_prehled");
    expect(vse).toHaveLength(2);
  });
});
