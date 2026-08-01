import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozOblast } from "../src/oblast.js";
import { dokoncPruzkum, objednejPruzkum, zahajPruzkum } from "../src/pruzkum.js";
import type { Oblast } from "../src/oblast-tvar.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

const STRED = { lat: 49.6, lng: 13.2 };

async function kruh(nazev: string, polomerM: number): Promise<string> {
  return zalozOblast(db, { nazev, oblast: { typ: "kruh", stred: STRED, polomerM } });
}

interface RadekPruzkumu {
  tvar: Oblast | null;
  oblast_nazev: string | null;
}

async function pruzkum(id: string): Promise<RadekPruzkumu> {
  const r = await db.query<RadekPruzkumu>(
    "select tvar, oblast_nazev from pruzkumy where id = $1",
    [id],
  );
  return r[0]!;
}

async function zmenenTvar(oblastId: string): Promise<boolean> {
  const r = await db.query<{ tvar_zmenen: boolean }>(
    "select tvar_zmenen from oblasti_prehled where id = $1",
    [oblastId],
  );
  return r[0]!.tvar_zmenen;
}

describe("tvar oblasti se zaznamená k průzkumu", () => {
  it("objednávka tvar ještě nemá — zapíše se, až se opravdu začne", async () => {
    // Zaznamenává se to, co Čmuchal skutečně prošel, ne co si někdo objednal.
    // Mezi objednáním a během se oblast může ještě překreslit.
    const oblastId = await kruh("Plzeňsko", 5000);
    const id = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });

    expect(await pruzkum(id)).toEqual({ tvar: null, oblast_nazev: null });
  });

  it("zahájení uloží tvar i název, jaké tehdy platily", async () => {
    const oblastId = await kruh("Plzeňsko", 5000);
    const id = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });

    await zahajPruzkum(db, id);

    const p = await pruzkum(id);
    expect(p.oblast_nazev).toBe("Plzeňsko");
    expect(p.tvar).toEqual({ typ: "kruh", stred: STRED, polomerM: 5000 });
  });

  it("nakreslený tvar se uloží i s body", async () => {
    const body = [
      { lat: 49.5, lng: 13.1 },
      { lat: 49.7, lng: 13.1 },
      { lat: 49.7, lng: 13.3 },
    ];
    const oblastId = await zalozOblast(db, { nazev: "Tvar", oblast: { typ: "polygon", body } });
    const id = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });

    await zahajPruzkum(db, id);

    expect((await pruzkum(id)).tvar).toEqual({ typ: "polygon", body });
  });

  it("opakované zahájení už zapsaný tvar nepřepíše", async () => {
    // `vyridPruzkum` volá `zahajPruzkum` při každém navazujícím běhu. Kdyby
    // se tvar přepisoval, doklad by se posouval s každým pokusem.
    const oblastId = await kruh("Plzeňsko", 5000);
    const id = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    await zahajPruzkum(db, id);

    await db.query("update oblasti set polomer_m = 30000 where id = $1", [oblastId]);
    await zahajPruzkum(db, id);

    expect((await pruzkum(id)).tvar).toMatchObject({ polomerM: 5000 });
  });
});

describe("poznat, že se oblast od průzkumu změnila", () => {
  it("neprozkoumaná oblast se nezměnila — není proti čemu", async () => {
    const oblastId = await kruh("Nová", 5000);
    expect(await zmenenTvar(oblastId)).toBe(false);
  });

  it("nedotčená oblast po průzkumu hlásí beze změny", async () => {
    const oblastId = await kruh("Plzeňsko", 5000);
    const id = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    await zahajPruzkum(db, id);
    await dokoncPruzkum(db, id, { firemPrevzato: 1, firemNovych: 2 });

    expect(await zmenenTvar(oblastId)).toBe(false);
  });

  it("rozšířená oblast se pozná — starý průzkum už neplatí pro celý tvar", async () => {
    // Přesně majitelův případ: „Plzeň se čas od času rozšiřuje."
    const oblastId = await kruh("Plzeňsko", 5000);
    const id = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    await zahajPruzkum(db, id);
    await dokoncPruzkum(db, id, { firemPrevzato: 1, firemNovych: 2 });

    await db.query("update oblasti set polomer_m = 12000 where id = $1", [oblastId]);

    expect(await zmenenTvar(oblastId)).toBe(true);
  });

  it("přejmenování oblasti není změna tvaru", async () => {
    const oblastId = await kruh("Plzeňsko", 5000);
    const id = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    await zahajPruzkum(db, id);

    await db.query("update oblasti set nazev = 'Plzeň a okolí' where id = $1", [oblastId]);

    expect(await zmenenTvar(oblastId)).toBe(false);
  });

  it("čekající objednávka nepřebije doklad staršího dokončeného průzkumu", async () => {
    // Objednávka bez tvaru by jinak signál „oblast se změnila" schovala,
    // a to zrovna ve chvíli, kdy je nejužitečnější.
    const oblastId = await kruh("Plzeňsko", 5000);
    const stary = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    await zahajPruzkum(db, stary);
    await dokoncPruzkum(db, stary, { firemPrevzato: 1, firemNovych: 2 });

    await db.query("update oblasti set polomer_m = 12000 where id = $1", [oblastId]);
    await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });

    expect(await zmenenTvar(oblastId)).toBe(true);
  });
});
