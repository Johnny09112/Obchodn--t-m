import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { ulozSablonu } from "../src/obsah.js";
import { SABLONA_HLAVNI } from "../src/obsah-schvaleny.js";
import {
  cenaKampane,
  firmyKOsloveni,
  nastavPole,
  slozZpravu,
  vzdalenostSlovy,
} from "../src/zprava.js";
import { zkontrolujZpravu } from "../src/styl-zpravy.js";

/**
 * Skládání zprávy pro kampaň (druhá dodávka nastavení zprávy).
 *
 * Zadání: docs/superpowers/specs/2026-08-18-nastaveni-zpravy-design.md
 */

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("pole šablony", () => {
  it("uložená šablona dostane pole podle zástupných údajů v textu", async () => {
    await ulozSablonu(db, SABLONA_HLAVNI);

    const r = await db.query<{ kod: string; povinne: boolean }>(
      `select p.kod, p.povinne from pole_sablony p
         join templates t on t.id = p.template_id
        order by p.poradi`,
    );
    expect(r.map((x) => x.kod)).toEqual([
      "osloveni",
      "vzdalenost",
      "od_vasi_firmy",
      "cena",
    ]);
    // Jméno je jediné pole s náhradou, ostatní firmu vyřadí.
    expect(r.map((x) => x.povinne)).toEqual([false, true, true, true]);
  });

  it("pole má lidský název, ne kód", async () => {
    await ulozSablonu(db, SABLONA_HLAVNI);
    const [r] = await db.query<{ nazev: string }>(
      "select nazev from pole_sablony where kod = 'od_vasi_firmy'",
    );
    expect(r?.nazev).toBe("Obor firmy");
  });

  it("průvodce kampaní má nově pět kroků", async () => {
    const [o] = await db.query<{ id: string }>(
      `insert into oblasti (nazev, typ, stred_lat, stred_lng, polomer_m)
       values ('Zkušební', 'kruh', 49.6, 13.2, 3000) returning id`,
    );
    // Kampaň stojí na množině oblastí (kampan_oblasti, migrace 0030) —
    // sloupec kampane.oblast_id byl zrušen.
    const [k] = await db.query<{ id: string }>(
      `insert into kampane (nazev, spravce, krok) values ('Zkušební', 'majitel', 5) returning id`,
    );
    await db.query("insert into kampan_oblasti (kampan_id, oblast_id) values ($1, $2)", [
      k!.id,
      o!.id,
    ]);
    const [ulozena] = await db.query<{ krok: number }>("select krok from kampane");
    expect(ulozena?.krok).toBe(5);
  });
});

/**
 * Postaví kampaň s jednou oblastí a tolika jídelnami, kolik je dvojic
 * [cena oběda, provize]. Ke každé jídelně patří jedna firma v zóně —
 * bez firmy by se jídelna nepočítala jako dotčená.
 */
async function kampanSJidelnami(
  db: Db,
  ceny: Array<[string | null, string | null]>,
): Promise<string> {
  const [o] = await db.query<{ id: string }>(
    `insert into oblasti (nazev, typ, stred_lat, stred_lng, polomer_m)
     values ('Zkušební', 'kruh', 49.6, 13.2, 3000) returning id`,
  );
  // Kampaň má vybranou šablonu — bez ní není z čeho brát povinná pole.
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

  for (const [i, [cena, provize]] of ceny.entries()) {
    const [j] = await db.query<{ id: string; nabidka_id: string }>(
      `insert into jidelny (nazev, adresa, lat, lng, zona_metru)
       values ($1, 'Zkušební 1', 49.6, 13.2, 3000) returning id, nabidka_id`,
      [`Jídelna ${i + 1}`],
    );
    for (const [kod, hodnota] of [
      ["cena_obeda", cena],
      ["provize", provize],
    ] as const) {
      if (hodnota === null) continue;
      const [p] = await db.query<{ id: string }>(
        "select id from parametry_nabidky where kod = $1",
        [kod],
      );
      await db.query(
        "insert into hodnoty_parametru (nabidka_id, parametr_id, hodnota) values ($1, $2, $3)",
        [j!.nabidka_id, p!.id, hodnota],
      );
    }

    const ico = String(10000000 + i);
    await db.query(
      `insert into companies (ico, nazev, stav) values ($1, $2, 'kvalifikovany')`,
      [ico, `Firma ${i + 1}`],
    );
    await db.query("insert into oblast_firmy (oblast_id, ico) values ($1, $2)", [o!.id, ico]);
    await db.query(
      `insert into dosah (ico, jidelna_id, vzdalenost_m, v_zone) values ($1, $2, 500, true)`,
      [ico, j!.id],
    );
  }

  return k!.id;
}

describe("cena kampaně", () => {
  it("stejné ceny se píšou bez „od“", async () => {
    const k = await kampanSJidelnami(db, [
      ["95", "15"],
      ["95", "15"],
    ]);
    expect(await cenaKampane(db, k)).toBe("110 Kč");
  });

  it("různé ceny se píšou jako „od“ té nejnižší", async () => {
    const k = await kampanSJidelnami(db, [
      ["95", "15"],
      ["105", "15"],
    ]);
    expect(await cenaKampane(db, k)).toBe("od 110 Kč");
  });

  it("cena je součet ceny oběda a provize", async () => {
    const k = await kampanSJidelnami(db, [["100", "15"]]);
    expect(await cenaKampane(db, k)).toBe("115 Kč");
  });

  it("jídelna bez vyplněné ceny se do výpočtu nepočítá", async () => {
    const k = await kampanSJidelnami(db, [
      ["95", "15"],
      [null, null],
    ]);
    expect(await cenaKampane(db, k)).toBe("110 Kč");
  });

  it("bez vyplněné provize se počítá jen cena oběda", async () => {
    const k = await kampanSJidelnami(db, [["95", null]]);
    expect(await cenaKampane(db, k)).toBe("95 Kč");
  });

  it("bez jediné ceny vrátí null, ne nulu", async () => {
    const k = await kampanSJidelnami(db, [[null, null]]);
    expect(await cenaKampane(db, k)).toBeNull();
  });
});

/** Doplní firmě e-mail, obor a jméno — každé zvlášť, ať jde vynechat. */
async function vybavFirmu(
  db: Db,
  ico: string,
  co: { email?: boolean; obor?: boolean; prijmeni?: string | null },
): Promise<void> {
  if (co.email || co.prijmeni !== undefined) {
    await db.query(
      `insert into contacts (ico, prijmeni, email, zdroj_url)
       values ($1, $2, $3, 'https://priklad.cz')`,
      [ico, co.prijmeni ?? null, co.email ? "kontakt@priklad.cz" : null],
    );
  }
  if (co.obor) {
    await db.query(
      `insert into evidence (ico, atribut, hodnota, zdroj_url, citace)
       values ($1, 'obor', 'truhlárna', 'https://priklad.cz', 'vyrábíme nábytek')`,
      [ico],
    );
  }
}

describe("kdo se osloví a kdo ne", () => {
  it("firma se vším potřebným je připravená", async () => {
    const k = await kampanSJidelnami(db, [["95", "15"]]);
    await vybavFirmu(db, "10000000", { email: true, obor: true, prijmeni: "Nováková" });

    const { pripravene, vyrazene } = await firmyKOsloveni(db, k);
    expect(pripravene.map((f) => f.ico)).toEqual(["10000000"]);
    expect(vyrazene).toEqual([]);
  });

  it("firma bez e-mailu se vyřadí a důvod je čitelný", async () => {
    const k = await kampanSJidelnami(db, [["95", "15"]]);
    await vybavFirmu(db, "10000000", { obor: true, prijmeni: "Nováková" });

    const { vyrazene } = await firmyKOsloveni(db, k);
    expect(vyrazene[0]?.chybi).toContain("není kam napsat — chybí e-mail");
  });

  it("firma bez oboru se vyřadí", async () => {
    const k = await kampanSJidelnami(db, [["95", "15"]]);
    await vybavFirmu(db, "10000000", { email: true, prijmeni: "Nováková" });

    const { pripravene, vyrazene } = await firmyKOsloveni(db, k);
    expect(pripravene).toEqual([]);
    expect(vyrazene[0]?.chybi.some((x) => x.includes("obor"))).toBe(true);
  });

  it("firma bez jména se NEvyřadí — osloví se „Dobrý den“", async () => {
    const k = await kampanSJidelnami(db, [["95", "15"]]);
    await vybavFirmu(db, "10000000", { email: true, obor: true, prijmeni: null });

    const { pripravene } = await firmyKOsloveni(db, k);
    expect(pripravene).toHaveLength(1);
  });

  it("firmě chybí víc věcí najednou a vypíšou se všechny", async () => {
    const k = await kampanSJidelnami(db, [["95", "15"]]);
    // firma bez kontaktu i bez oboru

    const { vyrazene } = await firmyKOsloveni(db, k);
    expect(vyrazene[0]?.chybi.length).toBeGreaterThan(1);
  });

  it("chybějící cena u jídelny vyřadí její firmy", async () => {
    const k = await kampanSJidelnami(db, [[null, null]]);
    await vybavFirmu(db, "10000000", { email: true, obor: true, prijmeni: "Nováková" });

    const { vyrazene } = await firmyKOsloveni(db, k);
    expect(vyrazene[0]?.chybi.some((x) => x.includes("cena"))).toBe(true);
  });
});

describe("složení zprávy", () => {
  it("doplní oslovení, obor, vzdálenost i cenu", async () => {
    const k = await kampanSJidelnami(db, [["95", "15"]]);
    await vybavFirmu(db, "10000000", { email: true, obor: true, prijmeni: "Procházka" });

    const z = await slozZpravu(db, k, "10000000");
    expect(z.telo).toContain("Vážený pane Procházko,");
    // Bez doloženého krátkého označení se firma pojmenuje obecně —
    // popis oboru („truhlárna, výroba nábytku na míru") se do vazby
    // „od Vaší…" vyskloňovat nedá.
    expect(z.telo).toContain("od Vás");
    expect(z.telo).toContain("110 Kč");
    // Žádný nevyplněný zástupný údaj.
    expect(z.telo).not.toMatch(/\[[a-z_]+\]/);
    expect(z.chybi).toEqual([]);
  });

  it("bez jména osloví „Dobrý den“ a zprávu složí", async () => {
    const k = await kampanSJidelnami(db, [["95", "15"]]);
    await vybavFirmu(db, "10000000", { email: true, obor: true, prijmeni: null });

    const z = await slozZpravu(db, k, "10000000");
    expect(z.telo.startsWith("Dobrý den,")).toBe(true);
    expect(z.chybi).toEqual([]);
  });

  it("pole v režimu „pevné“ použije text kampaně, ne data", async () => {
    const k = await kampanSJidelnami(db, [["95", "15"]]);
    await vybavFirmu(db, "10000000", { email: true, obor: true, prijmeni: null });
    await nastavPole(db, k, "cena", "pevne", "od 120 Kč");

    const z = await slozZpravu(db, k, "10000000");
    expect(z.telo).toContain("od 120 Kč");
    expect(z.telo).not.toContain("110 Kč");
  });

  it("pole v režimu „vynechat“ odstraní celou větu, ve které stojí", async () => {
    const k = await kampanSJidelnami(db, [["95", "15"]]);
    await vybavFirmu(db, "10000000", { email: true, obor: true, prijmeni: null });
    await nastavPole(db, k, "cena", "vynechat", null);

    const z = await slozZpravu(db, k, "10000000");
    expect(z.telo).not.toContain("Kompletní menu");
    expect(z.telo).toContain("Veškeré objednávky");
  });

  it("firma, které něco chybí, zprávu nedostane a řekne se proč", async () => {
    const k = await kampanSJidelnami(db, [["95", "15"]]);
    await vybavFirmu(db, "10000000", { email: true, prijmeni: null });

    const z = await slozZpravu(db, k, "10000000");
    expect(z.chybi.some((x) => x.includes("obor"))).toBe(true);
  });

  it("hotová zpráva projde kontrolou stylu", async () => {
    const k = await kampanSJidelnami(db, [["95", "15"]]);
    await vybavFirmu(db, "10000000", { email: true, obor: true, prijmeni: "Procházka" });

    const z = await slozZpravu(db, k, "10000000");
    expect(zkontrolujZpravu(z.telo, { predmet: z.predmet, jmenoAdresata: "Procházka" })).toEqual([]);
  });
});

describe("kampaň bez vybrané šablony", () => {
  it("použije se schválená šablona, ne prázdno", async () => {
    const k = await kampanSJidelnami(db, [["95", "15"]]);
    await vybavFirmu(db, "10000000", { email: true, obor: true, prijmeni: null });
    // Kampaň založená dřív, než se šablony zavedly, template_id nemá.
    await db.query("update kampane set template_id = null where id = $1", [k]);

    const z = await slozZpravu(db, k, "10000000");
    expect(z.telo).toContain("spolupracujeme se školní jídelnou");
  });
});

describe("vzdálenost slovy", () => {
  it("úplně blízko se čas neuvádí", () => {
    expect(vzdalenostSlovy(200)).toBe("pár minut pěšky");
  });

  it("do dvou kilometrů trasy je to pěšky, po pěti minutách", () => {
    // 1000 m vzdušnou čarou = 1300 m trasy = 17 minut → zaokrouhleno na 20.
    expect(vzdalenostSlovy(1000)).toBe("přibližně 20 minut pěšky");
  });

  it("dál se jede autem", () => {
    // 5 km vzdušnou čarou = 6,5 km trasy ≈ 16 minut → zaokrouhleno na 20.
    expect(vzdalenostSlovy(5000)).toBe("přibližně 20 minut autem");
  });

  it("v textu se nikdy neobjeví kilometry ani metry", () => {
    for (const m of [200, 900, 1600, 3000, 9000, 40000]) {
      expect(vzdalenostSlovy(m)).not.toMatch(/metr|kilometr|km/);
    }
  });

  it("čas je vždycky násobek pěti minut", () => {
    for (const m of [700, 1000, 1600, 3000, 9000]) {
      const t = vzdalenostSlovy(m).match(/(\d+) minut/);
      if (t?.[1]) expect(Number(t[1]) % 5).toBe(0);
    }
  });
});

describe("krátké označení firmy ve větě", () => {
  it("doložené označení se použije a vyskloňuje", async () => {
    const k = await kampanSJidelnami(db, [["95", "15"]]);
    await vybavFirmu(db, "10000000", { email: true, obor: true, prijmeni: null });
    await db.query(
      `insert into evidence (ico, atribut, hodnota, zdroj_url, citace)
       values ('10000000', 'oznaceni', 'truhlárna', 'https://priklad.cz',
               'Naše truhlárna vyrábí nábytek na míru')`,
    );

    const z = await slozZpravu(db, k, "10000000");
    expect(z.telo).toContain("od Vaší truhlárny");
  });

  it("bez označení ustoupí na „od Vás“, i když popis oboru známe", async () => {
    const k = await kampanSJidelnami(db, [["95", "15"]]);
    await vybavFirmu(db, "10000000", { email: true, obor: true, prijmeni: null });

    const z = await slozZpravu(db, k, "10000000");
    expect(z.telo).toContain("od Vás");
    expect(z.telo).not.toContain("truhlárna ");
  });

  it("víceslovné označení se nepoužije — nedá se vyskloňovat", async () => {
    const k = await kampanSJidelnami(db, [["95", "15"]]);
    await vybavFirmu(db, "10000000", { email: true, obor: true, prijmeni: null });
    await db.query(
      `insert into evidence (ico, atribut, hodnota, zdroj_url, citace)
       values ('10000000', 'oznaceni', 'truhlárna a nábytkářství', 'https://priklad.cz', 'citace')`,
    );

    const z = await slozZpravu(db, k, "10000000");
    expect(z.telo).toContain("od Vás");
  });
});
