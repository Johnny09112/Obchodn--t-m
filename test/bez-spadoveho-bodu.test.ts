import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { ulozSablonu } from "../src/obsah.js";
import { SABLONA_HLAVNI } from "../src/obsah-schvaleny.js";
import { firmyKOsloveni } from "../src/zprava.js";

/**
 * Nabídka bez spádového bodu.
 *
 * Cantinero má spádovou jídelnu: vzdálenost k ní i cena oběda jsou v mailu
 * a firma bez nich se neosloví. **Druhý zákazník (20. 8. 2026) žádnou jídelnu
 * nemá** — území se u něj ohraničuje stejně jako dnes, jen v něm není bod,
 * ke kterému by se počítala vzdálenost.
 *
 * Bez téhle úpravy by z jeho kampaně vypadly úplně všechny firmy na
 * „není spočítaná vzdálenost" a „u jídelny v dosahu není vyplněná cena" —
 * přesně jako dnes u Čachrova, 0 z 91.
 *
 * Příznak se schválně jmenuje `ma_spadovy_bod`, ne „je to jídelna": majitel
 * zmínil, že u dalšího zákazníka může být spádovým bodem třeba obchodní
 * konzultant. To se dnes nestaví, ale nesmí to být zavřené.
 */

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

/** Kampaň nad územím s jednou firmou — bez jídelny a bez dosahu. */
async function kampanBezJidelny(db: Db, maSpadovyBod: boolean): Promise<string> {
  await db.query(
    `insert into profily (kod, nazev, min_zamestnancu, ma_spadovy_bod)
     values ('zkouska', 'Zkušební produkt', null, $1)`,
    [maSpadovyBod],
  );

  const [o] = await db.query<{ id: string }>(
    `insert into oblasti (nazev, typ, stred_lat, stred_lng, polomer_m)
     values ('Zkušební', 'kruh', 49.6, 13.2, 3000) returning id`,
  );

  await ulozSablonu(db, SABLONA_HLAVNI);
  const [t] = await db.query<{ id: string }>("select id from templates limit 1");

  const [k] = await db.query<{ id: string }>(
    `insert into kampane (nazev, spravce, template_id, profil_kod)
     values ('Zkušební', 'majitel', $1, 'zkouska') returning id`,
    [t!.id],
  );
  await db.query("insert into kampan_oblasti (kampan_id, oblast_id) values ($1, $2)", [
    k!.id,
    o!.id,
  ]);

  await db.query(
    `insert into companies (ico, nazev, stav) values ('10000000', 'Firma', 'kvalifikovany')`,
  );
  await db.query("insert into oblast_firmy (oblast_id, ico) values ($1, '10000000')", [o!.id]);
  await db.query(
    `insert into contacts (ico, prijmeni, email, zdroj_url)
     values ('10000000', 'Nováková', 'kontakt@priklad.cz', 'https://priklad.cz')`,
  );
  await db.query(
    `insert into evidence (ico, atribut, hodnota, zdroj_url, citace)
     values ('10000000', 'obor', 'truhlárna', 'https://priklad.cz', 'vyrábíme nábytek')`,
  );

  return k!.id;
}

describe("kampaň nad nabídkou bez spádového bodu", () => {
  it("firma se neosloví jen proto, že v území není jídelna", async () => {
    const k = await kampanBezJidelny(db, false);

    const { pripravene, vyrazene } = await firmyKOsloveni(db, k);

    expect(vyrazene).toEqual([]);
    expect(pripravene.map((f) => f.ico)).toEqual(["10000000"]);
  });

  it("u nabídky se spádovým bodem chybějící vzdálenost a cena firmu dál vyřadí", async () => {
    const k = await kampanBezJidelny(db, true);

    const { pripravene, vyrazene } = await firmyKOsloveni(db, k);

    expect(pripravene).toEqual([]);
    expect(vyrazene[0]?.chybi).toContain("není spočítaná vzdálenost k jídelně");
    expect(vyrazene[0]?.chybi).toContain("u jídelny v dosahu není vyplněná cena");
  });

  it("výchozí hodnota je „spádový bod má“ — Cantinero se nesmí změnit mlčky", async () => {
    await db.query(
      "insert into profily (kod, nazev) values ('bez-uvedeni', 'Profil bez uvedení')",
    );
    const [p] = await db.query<{ ma_spadovy_bod: boolean }>(
      "select ma_spadovy_bod from profily where kod = 'bez-uvedeni'",
    );

    expect(p?.ma_spadovy_bod).toBe(true);
  });

  it("i dosavadní profily mají po migraci spádový bod", async () => {
    const r = await db.query<{ kod: string; ma_spadovy_bod: boolean }>(
      "select kod, ma_spadovy_bod from profily where kod = 'cantinero'",
    );

    expect(r[0]?.ma_spadovy_bod).toBe(true);
  });
});
