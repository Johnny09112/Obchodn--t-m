import { describe, expect, it } from "vitest";
import type { Db } from "../src/db.js";
import { zacniBeh, ukonciBeh } from "../src/repo.js";

/**
 * Proč tenhle test existuje (17. 8. 2026):
 *
 * `zacniBeh` a `ukonciBeh` posílaly do jsonb sloupců `JSON.stringify(...)`.
 * PGlite takový řetězec při vkládání do jsonb rozparsuje, takže v testech
 * vzniknul objekt a všechno vypadalo v pořádku. Ostrý Postgres (ovladač
 * postgres.js) ale hodnotu serializuje sám — z řetězce se stal **jsonb
 * řetězec**, ne objekt. Obrazovka Provoz proto u všech 72 běhů ukazovala
 * prázdný Výsledek a chyby vypisovala jako nečitelný text s uvozovkami.
 *
 * Chování ovladače test napodobit nemůže. Hlídá tedy to, co je společné
 * oběma: **do dotazu se předává hodnota, ne její JSON text.** Serializaci
 * dělá ovladač, který jediný ví, jaký typ má cílový sloupec.
 */
function odposlech() {
  const dotazy: { sql: string; params: unknown[] }[] = [];
  const db = {
    async query<T>(sql: string, params: unknown[] = []) {
      dotazy.push({ sql, params });
      return [{ id: "11111111-1111-1111-1111-111111111111" }] as T[];
    },
    tx: async () => {
      throw new Error("v tomhle testu se nepoužívá");
    },
    exec: async () => undefined,
    close: async () => undefined,
  } as unknown as Db;
  return { db, dotazy };
}

describe("zápis běhu agenta do jsonb", () => {
  it("zacniBeh předá vstup jako hodnotu, ne jako JSON text", async () => {
    const { db, dotazy } = odposlech();
    await zacniBeh(db, "cmuchal-reserse", { ico: ["18200061"], limit: 8 });

    const vstup = dotazy[0]!.params[1];
    expect(typeof vstup).not.toBe("string");
    expect(vstup).toEqual({ ico: ["18200061"], limit: 8 });
  });

  it("ukonciBeh předá výstup i chyby jako hodnoty, ne jako JSON text", async () => {
    const { db, dotazy } = odposlech();
    await ukonciBeh(db, "beh-1", { firem: 8, pribylo: 6 }, [{ ico: "18200061", chyba: "nic" }], 0);

    const [vystup, chyby] = dotazy[0]!.params;
    expect(typeof vystup).not.toBe("string");
    expect(vystup).toEqual({ firem: 8, pribylo: 6 });
    expect(typeof chyby).not.toBe("string");
    expect(chyby).toEqual([{ ico: "18200061", chyba: "nic" }]);
  });

  it("prázdné chyby zůstávají null — prázdné pole by se tvářilo jako záznam", async () => {
    const { db, dotazy } = odposlech();
    await ukonciBeh(db, "beh-1", { firem: 0 }, []);

    expect(dotazy[0]!.params[1]).toBeNull();
  });
});
