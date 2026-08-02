import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

/** Existuje index, který začíná daným sloupcem? */
async function maIndexNa(tabulka: string, sloupec: string): Promise<boolean> {
  const r = await db.query<{ indexdef: string }>(
    "select indexdef from pg_indexes where schemaname = 'public' and tablename = $1",
    [tabulka],
  );
  return r.some((x) => new RegExp(`\\(${sloupec}\\b`).test(x.indexdef));
}

/**
 * Indexy, bez kterých se aplikace zadrhne. Nejsou to optimalizace pro jistotu:
 * u každého je dole napsané, co konkrétně bez něj trvalo vteřiny.
 */
describe("indexy pod horkými dotazy", () => {
  it("contacts podle IČO", async () => {
    // Bez něj se u každé z 13 767 firem prošla celá tabulka kontaktů —
    // seznam firem se načítal přes dvacet vteřin.
    expect(await maIndexNa("contacts", "ico")).toBe(true);
  });

  it("evidence podle IČO a podle kontaktu", async () => {
    // Detail firmy čte oboje; bez indexů to je dvojí sekvenční průchod.
    expect(await maIndexNa("evidence", "ico")).toBe(true);
    expect(await maIndexNa("evidence", "contact_id")).toBe(true);
  });

  it("companies podle velikosti a stavu", async () => {
    // Filtr na cílovou velikost používá kampaň, doplňování kontaktů
    // i složení oblasti.
    expect(await maIndexNa("companies", "velikost_kategorie")).toBe(true);
    expect(await maIndexNa("companies", "stav")).toBe(true);
  });

  it("oblast_firmy i zdola nahoru", async () => {
    // Primární klíč je (oblast_id, ico) a na dotaz „ve kterých oblastech
    // je tahle firma" nestačí.
    expect(await maIndexNa("oblast_firmy", "ico")).toBe(true);
  });
});
