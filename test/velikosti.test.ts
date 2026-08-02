import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { doplnVelikosti, type ZdrojVelikosti } from "../src/velikosti.js";
import { nastavGeo, zalozFirmu } from "../src/repo.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

const firma = (ico: string): AresZaznam => ({
  ico, nazev: `Firma ${ico}`, adresa: "Náves 1", obec: "Zbůch",
  czNace: ["25610"], velikostKategorie: null, kodObce: 559661, pravniForma: "112",
});

/** Registr nahrazený seznamem — test nesmí číst půlgigabajtový soubor. */
function zdroj(zaznamy: Record<string, string>): ZdrojVelikosti {
  return {
    async *kategorie() {
      for (const [ico, kod] of Object.entries(zaznamy)) yield { ico, kategorieKod: kod };
    },
    zdrojUrl: "https://csu.example/res_data.csv",
  };
}

async function velikost(ico: string): Promise<string | null> {
  const r = await db.query<{ v: string | null }>(
    "select velikost_kategorie as v from companies where ico = $1",
    [ico],
  );
  return r[0]?.v ?? null;
}

describe("doplnění velikosti ze statistického registru", () => {
  it("zapíše segment podle pásma zaměstnanců", async () => {
    await zalozFirmu(db, firma("25232657"));
    await zalozFirmu(db, firma("26185610"));
    await zalozFirmu(db, firma("48362956"));

    const s = await doplnVelikosti(db, zdroj({
      "25232657": "120", // 1–5 → mikro
      "26185610": "240", // 50–99 → střední
      "48362956": "330", // 250–499 → korporát
    }));

    expect(s.doplneno).toBe(3);
    expect(await velikost("25232657")).toBe("mikro");
    expect(await velikost("26185610")).toBe("stredni");
    expect(await velikost("48362956")).toBe("korporat");
  });

  it("ke každé velikosti vznikne evidence se zdrojem a citací (TP-2)", async () => {
    await zalozFirmu(db, firma("25232657"));
    await doplnVelikosti(db, zdroj({ "25232657": "240" }));

    const e = await db.query<{ hodnota: string; zdroj_url: string; citace: string }>(
      "select hodnota, zdroj_url, citace from evidence where ico = $1 and atribut = 'velikost_kategorie'",
      ["25232657"],
    );
    expect(e).toHaveLength(1);
    expect(e[0]!.hodnota).toBe("stredni");
    expect(e[0]!.zdroj_url).toContain("csu.example");
    expect(e[0]!.citace).toContain("50–99");
  });

  it("neuvedená velikost se nevymýšlí — zůstane prázdná (TP-2)", async () => {
    await zalozFirmu(db, firma("25232657"));
    await zalozFirmu(db, firma("26185610"));

    const s = await doplnVelikosti(db, zdroj({ "25232657": "000", "26185610": "" }));

    expect(s.doplneno).toBe(0);
    expect(s.neuvedeno).toBe(2);
    expect(await velikost("25232657")).toBeNull();
  });

  it("firma bez zaměstnanců není segment — taky zůstane prázdná", async () => {
    await zalozFirmu(db, firma("25232657"));
    const s = await doplnVelikosti(db, zdroj({ "25232657": "110" }));
    expect(s.bezZamestnancu).toBe(1);
    expect(await velikost("25232657")).toBeNull();
  });

  it("firmu, která velikost už má, nepřepisuje", async () => {
    await zalozFirmu(db, firma("25232657"));
    await doplnVelikosti(db, zdroj({ "25232657": "240" }));

    const s = await doplnVelikosti(db, zdroj({ "25232657": "120" }));

    expect(s.doplneno).toBe(0);
    expect(s.jizMela).toBe(1);
    expect(await velikost("25232657")).toBe("stredni");
  });

  it("firmy mimo kartotéku ignoruje — registr má tři miliony řádků", async () => {
    await zalozFirmu(db, firma("25232657"));
    const s = await doplnVelikosti(db, zdroj({ "25232657": "240", "99999999": "240" }));
    expect(s.doplneno).toBe(1);
    expect(s.mimoKartoteku).toBe(1);
  });

  it("jde omezit na jednu oblast", async () => {
    const oblastId = (
      await db.query<{ id: string }>(
        `insert into oblasti (nazev, typ, stred_lat, stred_lng, polomer_m)
         values ('Plzeň','kruh',49.7,13.4,5000) returning id`,
      )
    )[0]!.id;

    await zalozFirmu(db, firma("25232657"));
    await zalozFirmu(db, firma("26185610"));
    await nastavGeo(db, "25232657", {
      lat: 49.7, lng: 13.4, jidelnaId: null, vzdalenostM: null, vZone: null,
    });
    await db.query("insert into oblast_firmy (oblast_id, ico) values ($1,$2)", [
      oblastId, "25232657",
    ]);

    const s = await doplnVelikosti(db, zdroj({ "25232657": "240", "26185610": "240" }), {
      oblastId,
    });

    expect(s.doplneno).toBe(1);
    expect(await velikost("26185610")).toBeNull();
  });
});
