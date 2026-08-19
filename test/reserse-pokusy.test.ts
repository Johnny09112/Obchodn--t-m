import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozKampan } from "../src/kampan.js";
import { firmyKObohaceni } from "../src/nalezy.js";
import { zalozFirmu } from "../src/repo.js";
import {
  MAX_POKUSU_RESERSE,
  firmyProReserse,
  firmyProReserseObjednavky,
  vycerpanePokusy,
  zaznamenejPokusReserse,
} from "../src/reserse.js";

let db: Db;
let kampanId: string;

async function firmaVKampani(ico: string, skore: number): Promise<void> {
  await zalozFirmu(db, {
    ico, nazev: `Firma ${ico}`, pravniForma: "112", czNace: [],
  } as never);
  await db.query("update companies set stav = 'kvalifikovany', skore = $2 where ico = $1", [
    ico, skore,
  ]);
  await db.query(
    "insert into kampan_firmy (kampan_id, ico, stav) values ($1, $2, 'vybrana')",
    [kampanId, ico],
  );
}

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  kampanId = await zalozKampan(db, { nazev: "K", spravce: "a@b.cz" });
});

describe("pokusy o rešerši", () => {
  it("nová firma má nula pokusů a do fronty patří", async () => {
    await firmaVKampani("25232657", 50);
    const f = await firmyProReserse(db, kampanId, 10);
    expect(f.map((x) => x.ico)).toEqual(["25232657"]);
  });

  it("zaznamenaný pokus firmu z fronty hned nevyřadí", async () => {
    await firmaVKampani("25232657", 50);
    await zaznamenejPokusReserse(db, ["25232657"]);
    expect((await firmyProReserse(db, kampanId, 10))).toHaveLength(1);
  });

  // Jádro opravy: firma, u které agent nikdy nic nenajde, se musí
  // po vyčerpání pokusů přestat nabízet — jinak fronta nedojde.
  it("po vyčerpání pokusů z fronty vypadne", async () => {
    await firmaVKampani("25232657", 50);
    for (let i = 0; i < MAX_POKUSU_RESERSE; i++) {
      await zaznamenejPokusReserse(db, ["25232657"]);
    }
    expect(await firmyProReserse(db, kampanId, 10)).toHaveLength(0);
  });

  it("hranice platí z obou stran", async () => {
    await firmaVKampani("25232657", 50);
    // O jeden pokus míň než limit — pořád ve frontě.
    for (let i = 0; i < MAX_POKUSU_RESERSE - 1; i++) {
      await zaznamenejPokusReserse(db, ["25232657"]);
    }
    expect(await firmyProReserse(db, kampanId, 10)).toHaveLength(1);
    await zaznamenejPokusReserse(db, ["25232657"]);
    expect(await firmyProReserse(db, kampanId, 10)).toHaveLength(0);
  });

  it("počítá se každé firmě zvlášť", async () => {
    await firmaVKampani("25232657", 50);
    await firmaVKampani("25242407", 40);
    for (let i = 0; i < MAX_POKUSU_RESERSE; i++) {
      await zaznamenejPokusReserse(db, ["25232657"]);
    }
    const f = await firmyProReserse(db, kampanId, 10);
    expect(f.map((x) => x.ico)).toEqual(["25242407"]);
  });

  it("zapíše i čas posledního pokusu", async () => {
    await firmaVKampani("25232657", 50);
    await zaznamenejPokusReserse(db, ["25232657"]);
    const r = await db.query<{ reserse_pokusu: number; reserse_naposledy_at: Date | null }>(
      "select reserse_pokusu, reserse_naposledy_at from companies where ico = '25232657'",
    );
    expect(r[0]!.reserse_pokusu).toBe(1);
    expect(r[0]!.reserse_naposledy_at).not.toBeNull();
  });

  it("prázdný seznam nic nerozbije", async () => {
    await expect(zaznamenejPokusReserse(db, [])).resolves.toBeUndefined();
  });

  // Aby šlo poznat, že fronta doopravdy došla — a nespletlo se to
  // s „ještě jsme nezačali".
  it("vyčerpané firmy jde spočítat", async () => {
    await firmaVKampani("25232657", 50);
    await firmaVKampani("25242407", 40);
    expect(await vycerpanePokusy(db, kampanId)).toBe(0);
    for (let i = 0; i < MAX_POKUSU_RESERSE; i++) {
      await zaznamenejPokusReserse(db, ["25232657"]);
    }
    expect(await vycerpanePokusy(db, kampanId)).toBe(1);
  });

  it("firma čekající na jídelnu do fronty PATŘÍ — data se předpřipravují i bez jídelny", async () => {
    // Rozhodl majitel 18. 8. 2026 a zrušil tím přísnější pravidlo z 13. 8.:
    // „předpřipravit data si v oblasti přeci mohu." Tvrdá zábrana zůstává
    // až u odeslání — bez jídelny není vzdálenost ani cena, takže firmu
    // vyřadí `nahled_kampane`, ne fronta rešerše.
    await firmaVKampani("25232657", 50);
    await firmaVKampani("25242407", 40);
    await db.query(
      "update companies set stav = 'cekajici_na_jidelnu' where ico = '25242407'",
    );
    const f = await firmyProReserse(db, kampanId, 10);
    expect(f.map((x) => x.ico).sort()).toEqual(["25232657", "25242407"]);
  });

  it("zamítnutá firma do fronty nepatří", async () => {
    await firmaVKampani("25232657", 50);
    await db.query("update companies set stav = 'zamitnuty' where ico = '25232657'");
    expect(await firmyProReserse(db, kampanId, 10)).toHaveLength(0);
  });

  // Filtr je psaný jako výčet ZAKÁZANÝCH stavů. Kdyby byl obráceně, nový
  // pracovní stav by z fronty tiše vypadl a nikdo by si toho nevšiml.
  it("firma dál ve trychtýři z fronty tiše nezmizí", async () => {
    await firmaVKampani("25232657", 50);
    await db.query("update companies set stav = 'jednani' where ico = '25232657'");
    expect(await firmyProReserse(db, kampanId, 10)).toHaveLength(1);
  });

  // Chyba 13. 8. 2026: výběr firem byl na dvou místech a rozešel se —
  // agent dostal jiné firmy, než kterým se počítaly pokusy. Tenhle test
  // hlídá, že soubor s prací obsahuje PŘESNĚ to, co vybrala fronta.
  it("soubor s prací dostane přesně firmy z fronty, ne vlastní výběr", async () => {
    await firmaVKampani("25232657", 50);
    await firmaVKampani("25242407", 40);
    // Zamítnutá firma je to, co fronta filtruje i po 18. 8. — na ní se
    // pozná, že práce kopíruje frontu a nevybírá si sama.
    await db.query("update companies set stav = 'zamitnuty' where ico = '25242407'");

    const fronta = await firmyProReserse(db, kampanId, 10);
    expect(fronta.map((x) => x.ico)).toEqual(["25232657"]);

    const prace = await firmyKObohaceni(db, {
      ica: fronta.map((f) => f.ico),
      profilKod: "cantinero",
      limit: fronta.length,
    });
    // Zamítnutá firma se do práce nesmí dostat, i když je v kampani.
    expect(prace.map((p) => p.ico)).toEqual(["25232657"]);
  });

  it("prázdná fronta znamená prázdnou práci, ne práci nade všemi", async () => {
    await firmaVKampani("25232657", 50);
    const prace = await firmyKObohaceni(db, { ica: [], profilKod: "cantinero" });
    expect(prace).toEqual([]);
  });

  it("firma, u které se něco našlo, se mezi vyčerpané nepočítá", async () => {
    await firmaVKampani("25232657", 50);
    for (let i = 0; i < MAX_POKUSU_RESERSE; i++) {
      await zaznamenejPokusReserse(db, ["25232657"]);
    }
    await db.query("update companies set obohaceno_at = now() where ico = '25232657'");
    expect(await vycerpanePokusy(db, kampanId)).toBe(0);
  });
});

describe("objednávka s jmenovitým výběrem firem", () => {
  /**
   * Majitel 19. 8. 2026: „chci mít možnost tu rešerši udělat jen částečnou
   * — třeba kvůli času… odklikat počet, který mi časově dává smysl."
   * Objednávka proto nese jmenovitý výběr (tabulka reserse_firmy) a hlídka
   * zpracuje přesně jej — proti aktuální frontě, ne slepě.
   */
  it("dávka dostane přesně vybrané firmy, které jsou pořád ve frontě", async () => {
    await firmaVKampani("25232657", 50);
    await firmaVKampani("25242407", 40);
    await firmaVKampani("48362956", 30);
    // Jedna z vybraných mezitím dostala razítko — do dávky nesmí.
    await db.query("update companies set obohaceno_at = now() where ico = '48362956'");

    const [o] = await db.query<{ id: string }>(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal)
       values ($1, 2, 'test', 'a@b.cz') returning id`,
      [kampanId],
    );
    for (const ico of ["25242407", "48362956"]) {
      await db.query("insert into reserse_firmy (reserse_id, ico) values ($1, $2)", [o!.id, ico]);
    }

    const davka = await firmyProReserseObjednavky(db, o!.id, kampanId);
    // Nevybraná 25232657 se nepřidá, orazítkovaná 48362956 vypadne.
    expect(davka.map((f) => f.ico)).toEqual(["25242407"]);
  });

  it("objednávka bez výběru se chová jako dřív — vezme frontu podle skóre", async () => {
    await firmaVKampani("25232657", 50);
    await firmaVKampani("25242407", 40);

    const [o] = await db.query<{ id: string }>(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal)
       values ($1, 1, 'test', 'a@b.cz') returning id`,
      [kampanId],
    );

    const davka = await firmyProReserseObjednavky(db, o!.id, kampanId);
    expect(davka.map((f) => f.ico)).toEqual(["25232657"]);
  });
});
