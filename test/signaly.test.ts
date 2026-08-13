import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozFirmu, zapisAtribut } from "../src/repo.js";
import {
  detekujSmennyProvoz,
  detekujVlastniJidelnu,
  nactiDruhySignalu,
  oznacVyrizeno,
  platneSignaly,
  zapisSignal,
} from "../src/signaly.js";

let db: Db;

async function firma(ico: string): Promise<void> {
  await zalozFirmu(db, {
    ico, nazev: `Firma ${ico}`, pravniForma: "112", czNace: [],
  } as never);
}

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("rejstřík druhů signálů", () => {
  it("obsahuje čtyři zavedené a rozlišuje vylučovací", async () => {
    const d = await nactiDruhySignalu(db);
    expect(d.map((x) => x.kod).sort()).toEqual([
      "nabira_lidi", "nova_v_uzemi", "smenny_provoz_vice", "vlastni_jidelna",
    ]);
    // Obě hodnoty zvlášť — kdyby byl příznak vždy stejný, nic to nedokáže.
    expect(d.find((x) => x.kod === "vlastni_jidelna")?.vylucovaci).toBe(true);
    expect(d.find((x) => x.kod === "nabira_lidi")?.vylucovaci).toBe(false);
  });

  it("platnost se liší podle druhu — něco vyprchá, něco ne", async () => {
    const d = await nactiDruhySignalu(db);
    expect(d.find((x) => x.kod === "nabira_lidi")?.platnostDnu).toBe(90);
    expect(d.find((x) => x.kod === "vlastni_jidelna")?.platnostDnu).toBeNull();
  });
});

describe("zápis signálu", () => {
  beforeEach(async () => await firma("25232657"));

  it("zapíše se a je vidět mezi platnými", async () => {
    expect(
      await zapisSignal(db, {
        ico: "25232657", druh: "nabira_lidi", klic: "2026-08",
        popis: "Vypsala 4 místa.",
        zdrojUrl: "https://data.mpsv.cz/x", citace: "4 nabízená místa",
      }),
    ).toBe(true);
    const s = await platneSignaly(db);
    expect(s).toHaveLength(1);
    expect(s[0]!.nazev).toBe("Firma 25232657");
  });

  // Bez tohohle by každý běh detektoru zakládal duplicity a obrazovka
  // by za měsíc ukazovala tentýž podnět stokrát.
  it("druhý běh nad týmiž daty nezaloží druhý řádek", async () => {
    const s = {
      ico: "25232657", druh: "nabira_lidi", klic: "2026-08",
      popis: "Vypsala 4 místa.", zdrojUrl: "https://data.mpsv.cz/x", citace: "4 místa",
    };
    expect(await zapisSignal(db, s)).toBe(true);
    expect(await zapisSignal(db, s)).toBe(false);
    expect(await platneSignaly(db)).toHaveLength(1);
  });

  it("jiný klíč je jiný výskyt", async () => {
    const zaklad = {
      ico: "25232657", druh: "nabira_lidi",
      popis: "Vypsala místa.", zdrojUrl: "https://data.mpsv.cz/x", citace: "místa",
    };
    await zapisSignal(db, { ...zaklad, klic: "2026-08" });
    await zapisSignal(db, { ...zaklad, klic: "2026-09" });
    expect(await platneSignaly(db)).toHaveLength(2);
  });

  it("bez zdroje nebo citace to neprojde (TP-2)", async () => {
    await expect(
      zapisSignal(db, {
        ico: "25232657", druh: "nabira_lidi", klic: "x",
        popis: "p", zdrojUrl: "", citace: "c",
      }),
    ).rejects.toThrow(/TP-2/);
    await expect(
      zapisSignal(db, {
        ico: "25232657", druh: "nabira_lidi", klic: "x",
        popis: "p", zdrojUrl: "https://a.cz", citace: "   ",
      }),
    ).rejects.toThrow(/TP-2/);
  });

  it("vymyšlený druh signálu neprojde", async () => {
    await expect(
      zapisSignal(db, {
        ico: "25232657", druh: "kdovico", klic: "x",
        popis: "p", zdrojUrl: "https://a.cz", citace: "c",
      }),
    ).rejects.toThrow(/Neznámý nebo vypnutý druh/);
  });

  it("vypnutý druh se chová jako neznámý", async () => {
    await db.query("update druhy_signalu set aktivni = false where kod = 'nabira_lidi'");
    await expect(
      zapisSignal(db, {
        ico: "25232657", druh: "nabira_lidi", klic: "x",
        popis: "p", zdrojUrl: "https://a.cz", citace: "c",
      }),
    ).rejects.toThrow(/Neznámý nebo vypnutý druh/);
  });

  it("vypršelý signál se mezi platné nepočítá", async () => {
    await zapisSignal(db, {
      ico: "25232657", druh: "nabira_lidi", klic: "stary",
      popis: "p", zdrojUrl: "https://a.cz", citace: "c",
    });
    expect(await platneSignaly(db)).toHaveLength(1);
    await db.query("update signaly set plati_do = now() - interval '1 day'");
    expect(await platneSignaly(db)).toHaveLength(0);
  });

  it("odškrtnutý podnět se přestane nabízet, ale nezmizí", async () => {
    await zapisSignal(db, {
      ico: "25232657", druh: "nabira_lidi", klic: "a",
      popis: "p", zdrojUrl: "https://a.cz", citace: "c",
    });
    const [s] = await db.query<{ id: string }>("select id from signaly");

    expect(await oznacVyrizeno(db, s!.id, "obchodnik@firma.cz")).toBe(true);
    expect(await platneSignaly(db)).toHaveLength(0);
    // Nezmizel — jen se nenabízí. Smazaný by se při dalším běhu detektoru
    // založil znovu, takže by odškrtnutí nic neznamenalo.
    expect(await platneSignaly(db, { iVyrizene: true })).toHaveLength(1);
  });

  it("zapamatuje si, kdo odškrtl", async () => {
    await zapisSignal(db, {
      ico: "25232657", druh: "nabira_lidi", klic: "a",
      popis: "p", zdrojUrl: "https://a.cz", citace: "c",
    });
    const [s] = await db.query<{ id: string }>("select id from signaly");
    await oznacVyrizeno(db, s!.id, "obchodnik@firma.cz");
    const r = await db.query<{ vyrizeno_kym: string; vyrizeno_at: Date }>(
      "select vyrizeno_kym, vyrizeno_at from signaly",
    );
    expect(r[0]!.vyrizeno_kym).toBe("obchodnik@firma.cz");
    expect(r[0]!.vyrizeno_at).not.toBeNull();
  });

  it("odškrtnutí jde vrátit zpět", async () => {
    await zapisSignal(db, {
      ico: "25232657", druh: "nabira_lidi", klic: "a",
      popis: "p", zdrojUrl: "https://a.cz", citace: "c",
    });
    const [s] = await db.query<{ id: string }>("select id from signaly");
    await oznacVyrizeno(db, s!.id, "obchodnik@firma.cz");
    expect(await oznacVyrizeno(db, s!.id, null)).toBe(true);
    expect(await platneSignaly(db)).toHaveLength(1);
  });

  // Aby opakované kliknutí neposouvalo čas u něčeho, co je vyřízené týden.
  it("druhé odškrtnutí téhož podnětu už nic nemění", async () => {
    await zapisSignal(db, {
      ico: "25232657", druh: "nabira_lidi", klic: "a",
      popis: "p", zdrojUrl: "https://a.cz", citace: "c",
    });
    const [s] = await db.query<{ id: string }>("select id from signaly");
    expect(await oznacVyrizeno(db, s!.id, "a@b.cz")).toBe(true);
    expect(await oznacVyrizeno(db, s!.id, "a@b.cz")).toBe(false);
  });

  it("vylučovací signály jdou vyfiltrovat, ale nezahazují se", async () => {
    await zapisSignal(db, {
      ico: "25232657", druh: "nabira_lidi", klic: "a",
      popis: "p", zdrojUrl: "https://a.cz", citace: "c",
    });
    await zapisSignal(db, {
      ico: "25232657", druh: "vlastni_jidelna", klic: "b",
      popis: "p", zdrojUrl: "https://a.cz", citace: "c",
    });
    expect(await platneSignaly(db)).toHaveLength(2);
    expect(await platneSignaly(db, { vylucovaci: true })).toHaveLength(1);
    expect(await platneSignaly(db, { vylucovaci: false })).toHaveLength(1);
  });
});

describe("detektory nad daty, která už máme", () => {
  beforeEach(async () => {
    await firma("25232657");
    await firma("25242407");
  });

  it("vícesměnný provoz se stane signálem, jednosměnný ne", async () => {
    await zapisAtribut(db, "25232657", "smenny_provoz", "třísměnný provoz", {
      zdrojUrl: "https://data.mpsv.cz/x", citace: "2 z 3 inzerátů uvádí Smennost/triSm",
    });
    await zapisAtribut(db, "25242407", "smenny_provoz", "jednosměnný provoz", {
      zdrojUrl: "https://data.mpsv.cz/x", citace: "1 z 1 inzerátů uvádí Smennost/jednoSm",
    });

    const v = await detekujSmennyProvoz(db);
    expect(v.nalezeno).toBe(1);
    expect(v.noveZapsano).toBe(1);
    const s = await platneSignaly(db);
    expect(s).toHaveLength(1);
    expect(s[0]!.ico).toBe("25232657");
    // Citace musí projít až do signálu — obchodník si má kliknout a ověřit.
    expect(s[0]!.citace).toContain("Smennost/triSm");
  });

  it("opakované spuštění detektoru nic nepřidá", async () => {
    await zapisAtribut(db, "25232657", "smenny_provoz", "nepřetržitý provoz", {
      zdrojUrl: "https://data.mpsv.cz/x", citace: "Smennost/nepretrzity",
    });
    expect((await detekujSmennyProvoz(db)).noveZapsano).toBe(1);
    expect((await detekujSmennyProvoz(db)).noveZapsano).toBe(0);
    expect(await platneSignaly(db)).toHaveLength(1);
  });

  it("vlastní jídelna se pozná i ve starém tvaru `true`", async () => {
    // Hodnoty jsou historicky nejednotné; přísná shoda by tiše přehlédla půlku.
    await zapisAtribut(db, "25232657", "ma_vlastni_jidelnu", "true", {
      zdrojUrl: "https://firma.cz/jidelna", citace: "Zaměstnanci se stravují v naší jídelně.",
    });
    await zapisAtribut(db, "25242407", "ma_vlastni_jidelnu", "ano – v budově je kuchyně", {
      zdrojUrl: "https://druha.cz/o-nas", citace: "V budově je vlastní kuchyně.",
    });
    const v = await detekujVlastniJidelnu(db);
    expect(v.nalezeno).toBe(2);
    const s = await platneSignaly(db, { vylucovaci: true });
    expect(s).toHaveLength(2);
    expect(s[0]!.popis).toMatch(/neoslovovat/i);
  });
});
