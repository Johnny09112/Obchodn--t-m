import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";

/**
 * Pojistky zkušebního odeslání.
 *
 * Majitel 20. 8. 2026: „nejprve uděláme nějaké fake tvorby, ale vše na jeden
 * dva moje účty, ať vím, jak to vypadá. Až pak bych to posílal dále."
 *
 * Zkušební zpráva je skutečná zpráva pro skutečnou firmu, jen **doručená na
 * vlastní adresu**. Z toho plynou dvě nebezpečí a obojí musí hlídat databáze,
 * ne obrazovka:
 *
 * 1. **Zkouška se nesmí dostat ke skutečné firmě.** Dokud je vypínač vypnutý
 *    (TP-8), smí být příjemcem jedině zapsaná zkušební adresa.
 * 2. **Zkouška nesmí spálit jediné oslovení firmy** (TP-5). Firma má nárok
 *    na jedno oslovení; kdyby ho vyčerpala zkouška poslaná majiteli, firma
 *    by se už nikdy neoslovila a nikdo by nevěděl proč.
 */

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

/** Firma s kontaktem — na tolik dat stojí každá zpráva. */
async function firmaSKontaktem(db: Db, ico: string): Promise<string> {
  await db.query("insert into companies (ico, nazev, stav) values ($1, $2, 'kvalifikovany')", [
    ico,
    `Firma ${ico}`,
  ]);
  const [k] = await db.query<{ id: string }>(
    `insert into contacts (ico, prijmeni, email, zdroj_url)
     values ($1, 'Nováková', $2, 'https://priklad.cz') returning id`,
    [ico, `kontakt${ico}@priklad.cz`],
  );
  return k!.id;
}

async function vlozZpravu(
  db: Db,
  v: { contactId: string; ico: string; prijemce: string; zkusebni: boolean },
): Promise<void> {
  await db.query(
    `insert into messages (contact_id, ico, kanal, finalni_text, prijemce, zkusebni)
     values ($1, $2, 'email', 'Dobrý den, ...', $3, $4)`,
    [v.contactId, v.ico, v.prijemce, v.zkusebni],
  );
}

describe("zkušební odeslání", () => {
  it("dokud je odesílání vypnuté, ostrá zpráva do databáze nesmí", async () => {
    const kontakt = await firmaSKontaktem(db, "10000000");

    await expect(
      vlozZpravu(db, {
        contactId: kontakt,
        ico: "10000000",
        prijemce: "kontakt10000000@priklad.cz",
        zkusebni: false,
      }),
    ).rejects.toThrow(/vypnut/i);
  });

  it("zkušební zpráva smí jedině na zapsanou zkušební adresu", async () => {
    const kontakt = await firmaSKontaktem(db, "10000000");
    await db.query("update system_state set zkusebni_prijemce = 'majitel@priklad.cz'");

    // Na vlastní adresu projde.
    await vlozZpravu(db, {
      contactId: kontakt,
      ico: "10000000",
      prijemce: "majitel@priklad.cz",
      zkusebni: true,
    });

    // Na adresu firmy ne — a to je celá pointa.
    await expect(
      vlozZpravu(db, {
        contactId: kontakt,
        ico: "10000000",
        prijemce: "kontakt10000000@priklad.cz",
        zkusebni: true,
      }),
    ).rejects.toThrow(/zkušební/i);
  });

  it("bez zapsané zkušební adresy neprojde ani zkouška", async () => {
    const kontakt = await firmaSKontaktem(db, "10000000");

    await expect(
      vlozZpravu(db, {
        contactId: kontakt,
        ico: "10000000",
        prijemce: "majitel@priklad.cz",
        zkusebni: true,
      }),
    ).rejects.toThrow(/zkušební/i);
  });

  it("zkoušek smí být na jednu firmu víc — nespálí jí oslovení (TP-5)", async () => {
    const kontakt = await firmaSKontaktem(db, "10000000");
    await db.query("update system_state set zkusebni_prijemce = 'majitel@priklad.cz'");

    for (let i = 0; i < 3; i++) {
      await vlozZpravu(db, {
        contactId: kontakt,
        ico: "10000000",
        prijemce: "majitel@priklad.cz",
        zkusebni: true,
      });
    }

    const [f] = await db.query<{ stav: string; osloveno_at: string | null }>(
      "select stav, osloveno_at from companies where ico = '10000000'",
    );
    expect(f?.stav).toBe("kvalifikovany");
    expect(f?.osloveno_at).toBeNull();
  });

  it("ostře se každá firma osloví právě jednou (TP-5)", async () => {
    const kontakt = await firmaSKontaktem(db, "10000000");
    await db.query("update system_state set sending_enabled = true");

    await vlozZpravu(db, {
      contactId: kontakt,
      ico: "10000000",
      prijemce: "kontakt10000000@priklad.cz",
      zkusebni: false,
    });

    await expect(
      vlozZpravu(db, {
        contactId: kontakt,
        ico: "10000000",
        prijemce: "kontakt10000000@priklad.cz",
        zkusebni: false,
      }),
    ).rejects.toThrow();
  });

  it("zkouška nebrání pozdějšímu ostrému oslovení téže firmy", async () => {
    const kontakt = await firmaSKontaktem(db, "10000000");
    await db.query("update system_state set zkusebni_prijemce = 'majitel@priklad.cz'");
    await vlozZpravu(db, {
      contactId: kontakt,
      ico: "10000000",
      prijemce: "majitel@priklad.cz",
      zkusebni: true,
    });

    await db.query("update system_state set sending_enabled = true");
    await vlozZpravu(db, {
      contactId: kontakt,
      ico: "10000000",
      prijemce: "kontakt10000000@priklad.cz",
      zkusebni: false,
    });

    const [r] = await db.query<{ pocet: string }>(
      "select count(*) as pocet from messages where ico = '10000000'",
    );
    expect(Number(r?.pocet)).toBe(2);
  });
});
