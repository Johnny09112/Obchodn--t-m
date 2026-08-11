import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozFirmu, zapisAtribut } from "../src/repo.js";
import { naTriStav } from "../src/tristav.js";

describe("ano / ne / nevíme", () => {
  it("přečte odpověď i se zdůvodněním za ní", () => {
    // Přesně ten tvar, který byl 10. 8. v ostrých datech a měl ve sloupci
    // uloženo `false` — tedy pravý opak toho, co evidence dokládala.
    expect(naTriStav("ano – v budově je vlastní kuchyně")).toBe(true);
    expect(naTriStav("ne, zaměstnanci dostávají stravenky")).toBe(false);
    expect(naTriStav("Ano (závodní kantýna)")).toBe(true);
  });

  it("zvládne starý tvar `true` i `false`", () => {
    expect(naTriStav("true")).toBe(true);
    expect(naTriStav("false")).toBe(false);
  });

  it("nevíme se nesmí převléct za ne", () => {
    // Tohle je jádro celé věci: dřívější `hodnota === \"true\"` udělalo
    // ze všech těchhle hodnot `false`.
    for (const h of ["pravděpodobně", "nezjištěno", "možná", "?", "kdovíco", "   "]) {
      expect(naTriStav(h)).toBeNull();
    }
    expect(naTriStav(null)).toBeNull();
    expect(naTriStav(undefined)).toBeNull();
  });

  // Past, kvůli které se čte první slovo, ne podřetězec kdekoli.
  it("„nemáme vlastní jídelnu“ je NE, přestože obsahuje slovo vlastní", () => {
    expect(naTriStav("nemáme vlastní jídelnu")).toBe(false);
    expect(naTriStav("nemá vlastní kantýnu, jen mikrovlnku")).toBe(false);
  });

  it("nezáleží na diakritice ani na velikosti písmen", () => {
    expect(naTriStav("ANO")).toBe(true);
    expect(naTriStav("nemame")).toBe(false);
    expect(naTriStav("Nemáme")).toBe(false);
  });
});

describe("zápis do kartotéky přes tři stavy", () => {
  let db: Db;

  beforeEach(async () => {
    db = await pripojPglite();
    await spustMigrace(db);
    await zalozFirmu(db, {
      ico: "25232657", nazev: "Školka", pravniForma: "112", czNace: [],
    } as never);
  });

  async function sloupec(): Promise<boolean | null> {
    const r = await db.query<{ ma_vlastni_jidelnu: boolean | null }>(
      "select ma_vlastni_jidelnu from companies where ico = '25232657'",
    );
    return r[0]!.ma_vlastni_jidelnu;
  }

  it("slovní ano se do sloupce uloží jako ano, ne jako ne", async () => {
    await zapisAtribut(db, "25232657", "ma_vlastni_jidelnu", "ano – v budově je vlastní kuchyně", {
      zdrojUrl: "https://ms-rohatce.cz/",
      citace: "Třída, herna i kuchyně jsou v prvním poschodí budovy.",
    });
    expect(await sloupec()).toBe(true);
  });

  it("nejednoznačná hodnota nechá sloupec prázdný, ale evidenci zapíše", async () => {
    await zapisAtribut(db, "25232657", "ma_vlastni_jidelnu", "pravděpodobně, není doloženo", {
      zdrojUrl: "https://a.cz/", citace: "V areálu bývala jídelna.",
    });
    // Sloupec „nevíme" — prázdno je poctivější než nesprávná jistota…
    expect(await sloupec()).toBeNull();
    // …ale doslovné znění se neztratí.
    const e = await db.query<{ hodnota: string }>(
      "select hodnota from evidence where ico='25232657' and atribut='ma_vlastni_jidelnu'",
    );
    expect(e[0]!.hodnota).toBe("pravděpodobně, není doloženo");
  });

  it("obě hodnoty projdou správně, ne jen jedna", async () => {
    await zapisAtribut(db, "25232657", "ma_vlastni_jidelnu", "true", {
      zdrojUrl: "https://a.cz/", citace: "Máme vlastní jídelnu.",
    });
    expect(await sloupec()).toBe(true);
    await zapisAtribut(db, "25232657", "ma_vlastni_jidelnu", "ne, jen stravenky", {
      zdrojUrl: "https://a.cz/", citace: "Zaměstnancům přispíváme stravenkami.",
    });
    expect(await sloupec()).toBe(false);
  });
});
