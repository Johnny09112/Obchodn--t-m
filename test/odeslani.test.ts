import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { ulozSablonu } from "../src/obsah.js";
import { SABLONA_HLAVNI } from "../src/obsah-schvaleny.js";
import { odesliZkusebne, type Odesilatel, type OdeslanaZprava } from "../src/odeslani.js";

/**
 * Zkušební odeslání kampaně na vlastní adresu.
 *
 * Odesílání samo je za rozhraním `Odesilatel` — stejný trik jako u agenta
 * (`Enricher`). Testy tudy strkají falešného odesílatele, takže **nic nikam
 * neodejde** a přitom se dá ověřit celá cesta včetně toho, co se zapsalo.
 */

let db: Db;
let poslane: OdeslanaZprava[];
let odesilatel: Odesilatel;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  poslane = [];
  odesilatel = {
    async posli(z) {
      poslane.push(z);
      return { providerId: `fake-${poslane.length}` };
    },
  };
});

/** Kampaň s jídelnou, šablonou a `pocet` připravenými firmami. */
async function kampanSFirmami(db: Db, pocet: number): Promise<string> {
  const [o] = await db.query<{ id: string }>(
    `insert into oblasti (nazev, typ, stred_lat, stred_lng, polomer_m)
     values ('Zkušební', 'kruh', 49.6, 13.2, 3000) returning id`,
  );
  await ulozSablonu(db, SABLONA_HLAVNI);
  const [t] = await db.query<{ id: string }>("select id from templates limit 1");
  const [k] = await db.query<{ id: string }>(
    `insert into kampane (nazev, spravce, template_id)
     values ('Zkušební', 'majitel', $1) returning id`,
    [t!.id],
  );
  await db.query("insert into kampan_oblasti (kampan_id, oblast_id) values ($1, $2)", [
    k!.id,
    o!.id,
  ]);

  const [j] = await db.query<{ id: string; nabidka_id: string }>(
    `insert into jidelny (nazev, adresa, lat, lng, zona_metru)
     values ('Jídelna', 'Zkušební 1', 49.6, 13.2, 3000) returning id, nabidka_id`,
  );
  for (const [kod, hodnota] of [["cena_obeda", "95"], ["provize", "15"]] as const) {
    const [p] = await db.query<{ id: string }>(
      "select id from parametry_nabidky where kod = $1",
      [kod],
    );
    await db.query(
      "insert into hodnoty_parametru (nabidka_id, parametr_id, hodnota) values ($1, $2, $3)",
      [j!.nabidka_id, p!.id, hodnota],
    );
  }

  for (let i = 0; i < pocet; i++) {
    const ico = String(10000000 + i);
    await db.query("insert into companies (ico, nazev, stav) values ($1, $2, 'kvalifikovany')", [
      ico,
      `Firma ${i + 1}`,
    ]);
    await db.query("insert into oblast_firmy (oblast_id, ico) values ($1, $2)", [o!.id, ico]);
    await db.query(
      "insert into dosah (ico, jidelna_id, vzdalenost_m, v_zone) values ($1, $2, 500, true)",
      [ico, j!.id],
    );
    await db.query(
      `insert into contacts (ico, prijmeni, email, zdroj_url)
       values ($1, 'Nováková', $2, 'https://priklad.cz')`,
      [ico, `firma${i}@priklad.cz`],
    );
    await db.query(
      `insert into evidence (ico, atribut, hodnota, zdroj_url, citace)
       values ($1, 'obor', 'truhlárna', 'https://priklad.cz', 'vyrábíme nábytek')`,
      [ico],
    );
  }
  return k!.id;
}

describe("zkušební odeslání kampaně", () => {
  it("pošle na vlastní adresu, nikdy na adresu firmy", async () => {
    const k = await kampanSFirmami(db, 2);
    await db.query("update system_state set zkusebni_prijemce = 'majitel@priklad.cz'");

    const v = await odesliZkusebne({ db, odesilatel }, { kampanId: k });

    expect(v.odeslano).toBe(2);
    expect(poslane.map((z) => z.komu)).toEqual([
      "majitel@priklad.cz",
      "majitel@priklad.cz",
    ]);
    // Adresa firmy se ve zkoušce nesmí objevit vůbec.
    expect(poslane.some((z) => z.komu.includes("firma"))).toBe(false);
  });

  it("v předmětu je poznat, že jde o zkoušku a pro koho zpráva byla", async () => {
    const k = await kampanSFirmami(db, 1);
    await db.query("update system_state set zkusebni_prijemce = 'majitel@priklad.cz'");

    await odesliZkusebne({ db, odesilatel }, { kampanId: k });

    expect(poslane[0]?.predmet).toContain("ZKOUŠKA");
    expect(poslane[0]?.predmet).toContain("Firma 1");
  });

  it("tělo zprávy zůstává přesně to, co by dostala firma", async () => {
    const k = await kampanSFirmami(db, 1);
    await db.query("update system_state set zkusebni_prijemce = 'majitel@priklad.cz'");

    await odesliZkusebne({ db, odesilatel }, { kampanId: k });

    expect(poslane[0]?.telo).toContain("Vážená paní Nováková");
    expect(poslane[0]?.telo).not.toContain("ZKOUŠKA");
  });

  it("zapíše zprávu jako zkušební a firma zůstane neoslovená", async () => {
    const k = await kampanSFirmami(db, 1);
    await db.query("update system_state set zkusebni_prijemce = 'majitel@priklad.cz'");

    await odesliZkusebne({ db, odesilatel }, { kampanId: k });

    const [z] = await db.query<{ zkusebni: boolean; prijemce: string; ico: string; stav: string }>(
      "select zkusebni, prijemce, ico, stav from messages",
    );
    expect(z?.zkusebni).toBe(true);
    expect(z?.prijemce).toBe("majitel@priklad.cz");
    expect(z?.stav).toBe("odeslano");

    const [f] = await db.query<{ stav: string; osloveno_at: string | null }>(
      "select stav, osloveno_at from companies where ico = '10000000'",
    );
    expect(f?.stav).toBe("kvalifikovany");
    expect(f?.osloveno_at).toBeNull();
  });

  it("nepošle víc, než dovoluje denní limit", async () => {
    const k = await kampanSFirmami(db, 5);
    await db.query(
      "update system_state set zkusebni_prijemce = 'majitel@priklad.cz', denni_limit = 2",
    );

    const v = await odesliZkusebne({ db, odesilatel }, { kampanId: k });

    expect(v.odeslano).toBe(2);
    expect(v.zbyva).toBe(3);
  });

  it("bez zapsané zkušební adresy to řekne srozumitelně a nic neodešle", async () => {
    const k = await kampanSFirmami(db, 1);

    await expect(odesliZkusebne({ db, odesilatel }, { kampanId: k })).rejects.toThrow(
      /zkušební adresa/i,
    );
    expect(poslane).toEqual([]);
  });

  it("firma, které něco chybí, se přeskočí a je vidět proč", async () => {
    const k = await kampanSFirmami(db, 1);
    await db.query("update system_state set zkusebni_prijemce = 'majitel@priklad.cz'");
    // Firma bez oboru se do kampaně nedostane.
    await db.query("delete from evidence where ico = '10000000'");

    const v = await odesliZkusebne({ db, odesilatel }, { kampanId: k });

    expect(v.odeslano).toBe(0);
    expect(v.preskocene[0]?.ico).toBe("10000000");
    expect(v.preskocene[0]?.chybi.join(" ")).toContain("obor");
  });

  it("když odesílatel selže, zpráva se nezapíše jako odeslaná", async () => {
    const k = await kampanSFirmami(db, 1);
    await db.query("update system_state set zkusebni_prijemce = 'majitel@priklad.cz'");
    const rozbity: Odesilatel = {
      async posli() {
        throw new Error("poštovní server neodpověděl");
      },
    };

    const v = await odesliZkusebne({ db, odesilatel: rozbity }, { kampanId: k });

    expect(v.odeslano).toBe(0);
    expect(v.selhalo[0]?.duvod).toContain("neodpověděl");
    const zpravy = await db.query("select 1 from messages where stav = 'odeslano'");
    expect(zpravy.length).toBe(0);
  });
});
