import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { firmyKObohaceni, zapisDavku } from "../src/nalezy.js";
import { nastavGeo, nastavStav, zalozFirmu, zapisKontakt } from "../src/repo.js";
import type { AresZaznam } from "../src/ares.js";
import { zalozKampan } from "../src/kampan.js";
import { firmyProReserse } from "../src/reserse.js";

let db: Db;
let jidelnaId: string;

const firma = (ico: string, nazev: string): AresZaznam => ({
  ico, nazev, adresa: "Náves 1", obec: "Bezdružice",
  czNace: ["62010"], velikostKategorie: "mikro", kodObce: 560740,
});

/**
 * Firma založená a rovnou zařazená do nové kampaně (stav 'vybrana') —
 * `firmyKObohaceni` s `kampanId` podmínku na stav/zónu firmy nemá (kopíruje
 * `firmyProReserse`), takže tomuhle pomocníkovi stačí jen založení a zápis
 * do `kampan_firmy`.
 */
async function pripravKampanSFirmou(
  db: Db,
  ico: string,
): Promise<{ kampanId: string }> {
  await zalozFirmu(db, firma(ico, `Testovací firma ${ico} s.r.o.`));
  const kampanId = await zalozKampan(db, { nazev: `Kampaň ${ico}`, spravce: "a@b.cz" });
  await db.query("insert into kampan_firmy (kampan_id, ico) values ($1,$2)", [kampanId, ico]);
  return { kampanId };
}

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  const j = await db.query<{ id: string }>(
    `insert into jidelny (nazev, adresa, obec, lat, lng, kod_obce, kapacita_volna)
     values ('ZŠ','x','Bezdružice',49.9,12.97,560740,10) returning id`,
  );
  jidelnaId = j[0]!.id;

  for (const [ico, nazev] of [
    ["25242407", "AGROFARMY BEZDRUŽICE s.r.o."],
    ["17255686", "Café Kryštof Harant s.r.o."],
  ] as const) {
    await zalozFirmu(db, firma(ico, nazev));
    await nastavGeo(db, ico, {
      lat: 49.9, lng: 12.97, jidelnaId, vzdalenostM: 100, vZone: true,
    });
    await nastavStav(db, ico, "kvalifikovany");
  }
});

describe("firmyKObohaceni", () => {
  it("vrátí kvalifikované firmy v zóně, které ještě neprošly rešerší", async () => {
    const f = await firmyKObohaceni(db, {});
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({ nazev: expect.any(String), obec: "Bezdružice" });
    expect(f[0]!.chybi.map((c) => c.kod)).toContain("zpusob_stravovani");
  });

  it("po zápisu dávky už firmu podruhé nenabídne", async () => {
    await zapisDavku(db, {
      nalezy: [{
        ico: "25242407", atribut: "zpusob_stravovani", hodnota: "stravenky",
        zdrojUrl: "https://agrofarmy.cz/kariera", citace: "Zaměstnancům přispíváme stravenkami.",
      }],
      kontakty: [],
    });
    const f = await firmyKObohaceni(db, {});
    expect(f.map((x) => x.ico)).toEqual(["17255686"]);
  });

  it("umí frontu zúžit na velké firmy — u drobných se rešerše nevyplatí", async () => {
    await db.query("update companies set velikost_kategorie = 'stredni' where ico = '25242407'");
    await db.query("update companies set velikost_kategorie = 'mikro' where ico = '17255686'");

    const f = await firmyKObohaceni(db, { segmenty: ["stredni", "korporat"] });
    expect(f.map((x) => x.ico)).toEqual(["25242407"]);
  });

  it("bez zúžení vrátí i firmy s neznámou velikostí", async () => {
    await db.query("update companies set velikost_kategorie = null");
    expect(await firmyKObohaceni(db, {})).toHaveLength(2);
    expect(await firmyKObohaceni(db, { segmenty: ["stredni"] })).toHaveLength(0);
  });

  it("umí vybrat firmy, kde známe jméno, ale ne spojení", async () => {
    // Firma je hotová, až když ke jménu máme e-mail nebo telefon
    // (rozhodnutí majitele 2026-07-28). Tohle je přesně ta fronta, kterou
    // má rešerše dodělat — a je nejcennější, protože agent už ví, KOHO hledat.
    await zapisKontakt(db, "25242407", {
      jmeno: "Tomáš", prijmeni: "Honzík", pozice: "jednatel", urovenAdresy: 3,
      zdrojUrl: "https://ares.gov.cz/ekonomicke-subjekty/25242407",
      citace: "veřejný rejstřík: jednatel Tomáš Honzík",
    });
    await zapisKontakt(db, "17255686", {
      jmeno: "Jana", prijmeni: "Nováková", email: "j.novakova@firma.cz",
      urovenAdresy: 3, zdrojUrl: "https://firma.cz/kontakty",
      citace: "Jana Nováková, j.novakova@firma.cz",
    });

    const f = await firmyKObohaceni(db, { jenBezSpojeni: true });
    expect(f.map((x) => x.ico)).toEqual(["25242407"]); // ta s e-mailem už je hotová
    expect(f[0]!.chybi.map((c) => c.kod)).toContain("spojeni");
    expect(f[0]!.znameOsoby).toEqual(["Tomáš Honzík (jednatel)"]);
  });

  it("firmu bez jediného jména do téhle fronty nedává — tam se nemá čeho chytit", async () => {
    const f = await firmyKObohaceni(db, { jenBezSpojeni: true });
    expect(f).toHaveLength(0);
  });

  it("respektuje limit a firmy mimo zónu nenabízí", async () => {
    expect(await firmyKObohaceni(db, { limit: 1 })).toHaveLength(1);
    await db.query("update companies set v_zone = false where ico = '17255686'");
    const f = await firmyKObohaceni(db, {});
    expect(f.map((x) => x.ico)).toEqual(["25242407"]);
  });
});

describe("zapisDavku", () => {
  it("zapíše platný nález i kontakt a doplní evidenci", async () => {
    const v = await zapisDavku(db, {
      nalezy: [{
        ico: "25242407", atribut: "ma_vlastni_jidelnu", hodnota: "false",
        zdrojUrl: "https://agrofarmy.cz/o-nas",
        citace: "Vlastní jídelnu nemáme, obědy dovážíme.",
      }],
      kontakty: [{
        ico: "25242407", email: "poptavky@agrofarmy.cz", urovenAdresy: 1,
        zdrojUrl: "https://agrofarmy.cz/kontakt",
        citace: "Nabídky posílejte na poptavky@agrofarmy.cz",
      }],
    });
    expect(v.zapsanoNalezu).toBe(1);
    expect(v.zapsanoKontaktu).toBe(1);
    expect(v.odmitnuto).toHaveLength(0);

    const f = await db.query<{ ma_vlastni_jidelnu: boolean }>(
      "select ma_vlastni_jidelnu from companies where ico = '25242407'",
    );
    expect(f[0]!.ma_vlastni_jidelnu).toBe(false);
    const ev = await db.query("select 1 from evidence where ico = '25242407'");
    expect(ev.length).toBeGreaterThanOrEqual(2);
  });

  it("odmítne nález bez zdroje, s prázdnou citací i mimo whitelist (TP-2, TP-3)", async () => {
    const v = await zapisDavku(db, {
      nalezy: [
        { ico: "25242407", atribut: "zpusob_stravovani", hodnota: "x", zdrojUrl: "", citace: "y" },
        { ico: "25242407", atribut: "zpusob_stravovani", hodnota: "x", zdrojUrl: "https://a.cz", citace: "" },
        { ico: "25242407", atribut: "obrat_firmy" as never, hodnota: "x", zdrojUrl: "https://a.cz", citace: "y" },
        { ico: "25242407", atribut: "zpusob_stravovani", hodnota: "x", zdrojUrl: "neni-url", citace: "y" },
      ],
      kontakty: [],
    });
    expect(v.zapsanoNalezu).toBe(0);
    expect(v.odmitnuto).toHaveLength(4);
    expect(v.odmitnuto.map((o) => o.duvod).join(" ")).toMatch(/zdroj|citac|whitelist|url/i);
  });

  // Nález 1 revize: "obrat_firmy" v testu výš vůbec není v rejstříku —
  // ten případ by odmítl i zapisAtribut, takže samotný nesejde poznat, jestli
  // kontrola opravdu hlídá `hleda_agent`, nebo jen holou existenci v tabulce
  // `atributy`. Tenhle test bere atribut, který V REJSTŘÍKU JE (`obor`, viz
  // 0035_atributy.sql), ale má `hleda_agent = false` — kdyby se kontrola
  // v zapisDavku zeslabila na pouhé "je v rejstříku" (`r.length > 0` místo
  // `r[0]?.hleda_agent === true`), tenhle nález by tiše prošel a přepsal by
  // hodnotu doloženou z ARESu údajem, který agent na webu nikdy neměl hledat.
  it("odmítne atribut, který je v rejstříku, ale agent ho nehledá (hleda_agent = false)", async () => {
    const v = await zapisDavku(db, {
      nalezy: [{
        ico: "25242407", atribut: "obor", hodnota: "výroba nábytku",
        zdrojUrl: "https://a.cz/o-nas", citace: "Vyrábíme nábytek na míru.",
      }],
      kontakty: [],
    });
    expect(v.zapsanoNalezu).toBe(0);
    expect(v.odmitnuto).toHaveLength(1);
    expect(v.odmitnuto[0]!.duvod).toMatch(/hleda_agent/i);
  });

  it("jedna vadná položka nezruší zápis ostatních", async () => {
    const v = await zapisDavku(db, {
      nalezy: [
        { ico: "25242407", atribut: "zpusob_stravovani", hodnota: "stravenky",
          zdrojUrl: "https://a.cz/kariera", citace: "Přispíváme stravenkami." },
        { ico: "25242407", atribut: "zpusob_stravovani", hodnota: "x", zdrojUrl: "", citace: "y" },
      ],
      kontakty: [],
    });
    expect(v.zapsanoNalezu).toBe(1);
    expect(v.odmitnuto).toHaveLength(1);
  });

  it("odmítne nález k firmě, která v kartotéce není", async () => {
    const v = await zapisDavku(db, {
      nalezy: [{
        ico: "27604977", atribut: "zpusob_stravovani", hodnota: "x",
        zdrojUrl: "https://a.cz", citace: "y",
      }],
      kontakty: [],
    });
    expect(v.zapsanoNalezu).toBe(0);
    expect(v.odmitnuto[0]!.duvod).toMatch(/kartotéce|neexistuje/i);
  });

  it("zkrátí citaci na 200 znaků, aby prošla přes tvrdé pravidlo", async () => {
    const v = await zapisDavku(db, {
      nalezy: [{
        ico: "25242407", atribut: "zpusob_stravovani", hodnota: "stravenky",
        zdrojUrl: "https://a.cz/k", citace: "A".repeat(400),
      }],
      kontakty: [],
    });
    expect(v.zapsanoNalezu).toBe(1);
    const ev = await db.query<{ citace: string }>(
      "select citace from evidence where ico = '25242407' and atribut = 'zpusob_stravovani'",
    );
    expect(ev[0]!.citace.length).toBe(200);
  });

  it("firmy bez nálezu označí jako prověřené a zapíše běh (TP-13)", async () => {
    const v = await zapisDavku(db, {
      nalezy: [], kontakty: [], bezNalezu: ["17255686"],
      poznamkyProPlaybook: ["web firmy neexistuje"],
    });
    expect(v.oznacenoBezNalezu).toBe(1);
    const f = await firmyKObohaceni(db, {});
    expect(f.map((x) => x.ico)).toEqual(["25242407"]);

    const behy = await db.query<{ agent: string; konec: string | null }>(
      "select agent, konec from agent_runs",
    );
    expect(behy[0]!.agent).toBe("cmuchal-obohaceni");
    expect(behy[0]!.konec).not.toBeNull();
  });
});

describe("fronta rešerše nad oblastí", () => {
  it("vidí firmy bez jídelny — sběr nad územím je zakládá mimo zónu", async () => {
    // Stejná díra jako u kontaktů: výchozí fronta se ptá na `v_zone is true`,
    // takže by z 620 cílových firem Plzně nabídla 16.
    const oblastId = (
      await db.query<{ id: string }>(
        `insert into oblasti (nazev, typ, stred_lat, stred_lng, polomer_m)
         values ('Plzeň','kruh',49.7,13.4,5000) returning id`,
      )
    )[0]!.id;

    await zalozFirmu(db, {
      ico: "25232657", nazev: "Bez jídelny s.r.o.", adresa: "x", obec: "Plzeň",
      czNace: ["25610"], velikostKategorie: null, kodObce: 554791, pravniForma: "112",
    });
    await nastavStav(db, "25232657", "cekajici_na_jidelnu");
    await db.query("insert into oblast_firmy (oblast_id, ico) values ($1,$2)", [
      oblastId, "25232657",
    ]);

    const vychozi = (await firmyKObohaceni(db, {})).map((f) => f.ico);
    const nadOblasti = (await firmyKObohaceni(db, { oblastId })).map((f) => f.ico);

    expect(vychozi).not.toContain("25232657");
    expect(nadOblasti).toEqual(["25232657"]);
  });
});

describe("chybi podle profilu", () => {
  it("nese kód i popis, aby agent věděl, co hledat", async () => {
    const { kampanId } = await pripravKampanSFirmou(db, "25232657");
    const f = await firmyKObohaceni(db, { kampanId, profilKod: "cantinero", limit: 5 });
    const stravovani = f[0]!.chybi.find((c) => c.kod === "zpusob_stravovani");
    expect(stravovani?.popis).toContain("stravenky");
  });

  it("atribut mimo profil se v chybi neobjeví", async () => {
    const { kampanId } = await pripravKampanSFirmou(db, "25232657");
    await db.query("delete from profil_atributy where atribut_kod = 'zpusob_stravovani'");
    const f = await firmyKObohaceni(db, { kampanId, profilKod: "cantinero", limit: 5 });
    expect(f[0]!.chybi.map((c) => c.kod)).not.toContain("zpusob_stravovani");
  });

  // Spojení není atribut a profil ho neřídí — bez něj nemá systém výstup.
  it("spojeni se hledá i u profilu bez atributů", async () => {
    const { kampanId } = await pripravKampanSFirmou(db, "25232657");
    await db.query("delete from profil_atributy where profil_kod = 'cantinero'");
    const f = await firmyKObohaceni(db, { kampanId, profilKod: "cantinero", limit: 5 });
    expect(f[0]!.chybi.map((c) => c.kod)).toContain("spojeni");
  });

  // Nález 2 revize: nic dosud neověřovalo, že atribut se skutečnou evidencí
  // z `chybi` zmizí — "po zápisu dávky už firmu podruhé nenabídne" vyřazuje
  // firmu razítkem `obohaceno_at`, ne evidencí. Kdyby se `maEvidenci`
  // (src/nalezy.ts) rozbilo — překlep v klíči `ico|atribut`, špatný název
  // sloupce — celá sada zůstane zelená a `chybi` bude tvrdit, že firma nemá
  // nic, i když je to dávno doloženo; agent by pak sháněl, co už víme.
  it("firma s evidencí pro zpusob_stravovani ho v chybi nemá", async () => {
    const { kampanId } = await pripravKampanSFirmou(db, "25232657");
    await db.query(
      `insert into evidence (ico, atribut, hodnota, zdroj_url, citace)
       values ('25232657', 'zpusob_stravovani', 'stravenky', 'https://a.cz/kariera', 'text')`,
    );
    const f = await firmyKObohaceni(db, { kampanId, profilKod: "cantinero", limit: 5 });
    expect(f[0]!.chybi.map((c) => c.kod)).not.toContain("zpusob_stravovani");
  });

  // Zrcadlo předchozího testu: zdrojem pravdy je EVIDENCE, ne sloupec
  // v `companies`. Vyplněný sloupec bez evidence firmu hotovou nedělá —
  // kdyby se výpočet vrátil k dřívějšímu čtení sloupce (`r.zpusob_stravovani
  // === null`), tenhle test by spadl, protože sloupec je vyplněný, ale
  // evidence chybí.
  it("sloupec vyplněný bez evidence nestačí — zdrojem pravdy je evidence, ne sloupec", async () => {
    const { kampanId } = await pripravKampanSFirmou(db, "25232657");
    await db.query("update companies set zpusob_stravovani = 'stravenky' where ico = '25232657'");
    const f = await firmyKObohaceni(db, { kampanId, profilKod: "cantinero", limit: 5 });
    expect(f[0]!.chybi.map((c) => c.kod)).toContain("zpusob_stravovani");
  });

  it("nově zavedený atribut se objeví v chybi", async () => {
    const { kampanId } = await pripravKampanSFirmou(db, "25232657");
    // POZOR — rozpor s briefem: brief tenhle insert píše bez `hleda_agent`,
    // ten ale defaultuje na false (migrace 0035). Bez explicitního `true`
    // by atribut do `chybi` nikdy nespadl a test by padal i proti správné
    // implementaci — přidáno k briefu, viz report úkolu 4.
    await db.query(
      `insert into atributy (kod, nazev, popis, do_zpravy, hleda_agent)
       values ('smenny_provoz', 'směnný provoz', 'jestli firma jede na směny a na kolik', false, true)`,
    );
    await db.query(
      "insert into profil_atributy (profil_kod, atribut_kod) values ('cantinero','smenny_provoz')",
    );
    const f = await firmyKObohaceni(db, { kampanId, profilKod: "cantinero", limit: 5 });
    expect(f[0]!.chybi.map((c) => c.kod)).toContain("smenny_provoz");
  });
});

describe("fronta rešerše nad kampaní (--kampan)", () => {
  // Dvě místa kódují totéž pravidlo (firmyKObohaceni --kampan a
  // firmyProReserse v src/reserse.ts) — bez tohohle testu by se dřív nebo
  // později rozešla a agent by dostal jinou dávku, než jakou vybrala
  // objednávka (nález 2 závěrečné revize).
  it("vrátí přesně tu množinu IČO, kterou vybírá firmyProReserse — vyřazenou firmu i firmu s razítkem vynechají obě", async () => {
    const kampanId = await zalozKampan(db, { nazev: "Rešerše K1", spravce: "a@b.cz" });

    // Firma navíc — v kampani, ale rešerší už prošla (razítko obohaceno_at).
    await zalozFirmu(db, firma("48362956", "Už prošla s.r.o."));
    await db.query("update companies set obohaceno_at = now() where ico = $1", ["48362956"]);

    for (const ico of ["25242407", "17255686", "48362956"]) {
      await db.query("insert into kampan_firmy (kampan_id, ico) values ($1,$2)", [kampanId, ico]);
    }
    // Vyřazená z kampaně — nesmí se objevit ani v jedné frontě, vyřazení
    // znamená „tuhle neoslovovat" (rozhodnutí majitele 2026-08-04).
    await db.query(
      "update kampan_firmy set stav = 'vyrazena', duvod_vyrazeni = 'test' where kampan_id = $1 and ico = $2",
      [kampanId, "17255686"],
    );

    const zReserse = (await firmyProReserse(db, kampanId, 100)).map((f) => f.ico).sort();
    const zObohaceni = (await firmyKObohaceni(db, { kampanId })).map((f) => f.ico).sort();

    expect(zObohaceni).toEqual(["25242407"]);
    expect(zReserse).toEqual(zObohaceni);
  });

  it("je nepovinný — bez --kampan se výchozí chování nemění ani o kus", async () => {
    const f = await firmyKObohaceni(db, {});
    expect(f.map((x) => x.ico).sort()).toEqual(["17255686", "25242407"]);
  });
});
