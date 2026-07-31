import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozOblast } from "../src/oblast.js";
import { objednejPruzkum } from "../src/pruzkum.js";
import { dalsiKVyrizeni, odemkni, tep, zamkni } from "../src/fronta.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

const OBLAST = { typ: "kruh" as const, stred: { lat: 49.6, lng: 13.2 }, polomerM: 3000 };

async function objednavka(): Promise<string> {
  const oblastId = await zalozOblast(db, { nazev: `Ú${Math.round(performance.now())}`, oblast: OBLAST });
  return objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
}

describe("zámek na běh agenta", () => {
  it("volný zámek se dá vzít", async () => {
    expect(await zamkni(db, "cmuchal", "notebook-1")).toBe(true);
  });

  it("druhý stroj neprojde, dokud první běží", async () => {
    // Dva běhy nad toutéž frontou by si úseky rvaly mezi sebou.
    await zamkni(db, "cmuchal", "notebook-1");
    expect(await zamkni(db, "cmuchal", "server-2")).toBe(false);
  });

  it("týž stroj si zámek vezme znovu, aniž by se zablokoval sám", async () => {
    await zamkni(db, "cmuchal", "notebook-1");
    expect(await zamkni(db, "cmuchal", "notebook-1")).toBe(true);
  });

  it("zámek po spadlém běhu se dá převzít, ale až po prodlevě", async () => {
    await zamkni(db, "cmuchal", "spadly-beh");
    // Spadlý proces zámek neuvolní — tep se prostě přestane ozývat.
    await db.query(
      "update zamky set srdce_at = now() - interval '30 minutes' where jmeno = 'cmuchal'",
    );
    expect(await zamkni(db, "cmuchal", "novy-beh", 15)).toBe(true);
  });

  it("tep udrží zámek u dlouhého běhu", async () => {
    await zamkni(db, "cmuchal", "notebook-1");
    await db.query(
      "update zamky set srdce_at = now() - interval '30 minutes' where jmeno = 'cmuchal'",
    );
    await tep(db, "cmuchal", "notebook-1");

    // Po obnovení tepu už zámek zastaralý není, cizí ho nesmí sebrat.
    expect(await zamkni(db, "cmuchal", "server-2", 15)).toBe(false);
  });

  it("odemknout smí jen ten, kdo zamkl", async () => {
    await zamkni(db, "cmuchal", "notebook-1");
    await odemkni(db, "cmuchal", "server-2");
    expect(await zamkni(db, "cmuchal", "server-2")).toBe(false);

    await odemkni(db, "cmuchal", "notebook-1");
    expect(await zamkni(db, "cmuchal", "server-2")).toBe(true);
  });
});

describe("co si má agent z fronty vzít", () => {
  it("čekající objednávku", async () => {
    const id = await objednavka();
    const dalsi = await dalsiKVyrizeni(db);
    expect(dalsi?.id).toBe(id);
  });

  it("i rozdělanou po pádu procesu, ne jen čekající", async () => {
    // Objednávka ve stavu 'bezi' po pádu nikoho nečeká — kdyby si ji fronta
    // nevzala, zůstala by viset navždy a kampaň by čekala na schválení.
    const id = await objednavka();
    await db.query("update pruzkumy set stav = 'bezi' where id = $1", [id]);
    expect((await dalsiKVyrizeni(db))?.id).toBe(id);
  });

  it("hotovou ani neúspěšnou ne", async () => {
    const id = await objednavka();
    await db.query("update pruzkumy set stav = 'hotovo' where id = $1", [id]);
    expect(await dalsiKVyrizeni(db)).toBeNull();

    // Databáze trvá na popisu chyby (`selhani_ma_chybu`) — bez něj by se
    // nedalo poznat, co opravit.
    await db.query(
      "update pruzkumy set stav = 'selhalo', chyba = 'registr neodpověděl' where id = $1",
      [id],
    );
    expect(await dalsiKVyrizeni(db)).toBeNull();
  });

  it("čekající na rozhodnutí člověka ne — agent za něj rozhodovat nesmí", async () => {
    const id = await objednavka();
    await db.query("update pruzkumy set stav = 'ceka_na_rozhodnuti' where id = $1", [id]);
    expect(await dalsiKVyrizeni(db)).toBeNull();
  });

  it("nejstarší objednávku první", async () => {
    const prvni = await objednavka();
    await db.query(
      "update pruzkumy set pozadano_at = now() - interval '1 hour' where id = $1",
      [prvni],
    );
    await objednavka();
    expect((await dalsiKVyrizeni(db))?.id).toBe(prvni);
  });
});
