import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozKampan } from "../src/kampan.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

/**
 * Text pravidla (`using` i `with check`) pro danou tabulku a příkaz.
 *
 * Pravidla se testují čtením jejich obsahu, ne chováním: PGlite nemá
 * Supabase Auth, takže `auth.jwt()` je náhrada vracející NULL a přihlásit
 * se v testu nelze. Stejný postup používá `test/pravidla.test.ts`.
 * Skutečné chování musí po nasazení ověřit člověk.
 */
async function pravidlo(tabulka: string, cmd: string): Promise<string> {
  const p = await db.query<{ qual: string | null; with_check: string | null }>(
    `select qual, with_check from pg_policies
     where tablename = $1 and cmd = $2`,
    [tabulka, cmd],
  );
  return p.map((x) => `${x.qual ?? ""} ${x.with_check ?? ""}`).join(" ");
}

describe("kdo smí do kampaně sáhnout", () => {
  it("kampaň má sloupec pro zástup", async () => {
    const s = await db.query(
      `select 1 from information_schema.columns
       where table_name = 'kampane' and column_name = 'zastupce'`,
    );
    expect(s).toHaveLength(1);
  });

  it("zástup se ukládá a čte", async () => {
    const id = await zalozKampan(db, { nazev: "K1", spravce: "a@b.cz" });
    await db.query("update kampane set zastupce = $1 where id = $2", ["z@b.cz", id]);
    const r = await db.query<{ zastupce: string | null }>(
      "select zastupce from kampane where id = $1",
      [id],
    );
    expect(r[0]?.zastupce).toBe("z@b.cz");
  });

  it("úpravu kampaně pravidlo váže na správce, zástup i admina", async () => {
    const text = await pravidlo("kampane", "UPDATE");
    expect(text).toContain("spravce");
    expect(text).toContain("zastupce");
    expect(text).toContain("'admin'");
  });

  it("zakladatel se musí zapsat jako správce", async () => {
    // Jinak by šlo založit kampaň na cizí jméno a tvářit se,
    // že za ni odpovídá někdo jiný.
    const text = await pravidlo("kampane", "INSERT");
    expect(text).toContain("spravce");
    expect(text).toContain("email_uzivatele");
  });

  it("seznam firem kampaně je zamčený stejně jako kampaň", async () => {
    // Zamknout kampaň a nechat její seznam firem otevřený by byl
    // zámek na dveřích vedle otevřeného okna.
    const text = await pravidlo("kampan_firmy", "ALL");
    expect(text).toContain("smi_do_kampane");
  });

  it("objednávky průzkumu jsou zamčené stejně", async () => {
    const text = await pravidlo("pruzkumy", "ALL");
    expect(text).toContain("smi_do_kampane");
  });

  it("schvalovat smí dál jen admin a výš", async () => {
    const text = await pravidlo("kampane", "UPDATE");
    expect(text).toContain("schvalena");
    expect(text).toContain("super-admin");
  });

  it("běžný uživatel sám o sobě k úpravě nestačí", async () => {
    // Regrese proti návratu starého pravidla, které pouštělo
    // kohokoli s rolí `uzivatel` do kterékoli kampaně.
    const p = await db.query<{ policyname: string }>(
      `select policyname from pg_policies
       where tablename = 'kampane' and policyname = 'kampane_zapis'`,
    );
    expect(p).toHaveLength(0);
  });

  it("objednávka bez kampaně zůstává na roli — zakládá ji příkazová řádka", async () => {
    // `pruzkumy.kampan_id` je nepovinné. Kdyby i taková objednávka
    // vyžadovala správce kampaně, nešla by průzkum objednat bez kampaně.
    const text = await pravidlo("pruzkumy", "ALL");
    expect(text).toContain("kampan_id");
    expect(text).toContain("uzivatel");
  });
});
