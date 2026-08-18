import { describe, expect, it } from "vitest";
import { zkontrolujZpravu, ZAKAZANE_FRAZE } from "../src/styl-zpravy.js";

/**
 * SPEC kap. 6 popisuje styl psaní a končí větou „automatická kontrola
 * odmítne zprávu, která…". Tohle je ta kontrola. Vzniká **před** knihovnou
 * tvrzení schválně: platí bez ohledu na to, co nakonec budeme o službě
 * tvrdit, a šablony se podle ní dají psát rovnou správně.
 */

const DOBRA_ZPRAVA = `Dobrý den,

vaříme obědy ve školní jídelně ve Zbůchu, pár minut od Vaší provozovny.
Denně máme volnou kapacitu, kterou nabízíme firmám v okolí — jídlo se vydá
ve výdejním okně nebo se doveze, podle toho, co komu vyhovuje.

Má u Vás smysl to zkusit, nebo obědy řešíte jinak?

Jan Laub
Cantinero s.r.o., IČO 12345678
Plzeň, tel. 777 123 456`;

describe("kontrola stylu zprávy", () => {
  it("dobrá zpráva projde bez výhrad", () => {
    const v = zkontrolujZpravu(DOBRA_ZPRAVA, { predmet: "obědy ze ZŠ Zbůch pro vaše zaměstnance" });
    expect(v).toEqual([]);
  });

  it("najde zakázanou frázi a řekne kterou", () => {
    const v = zkontrolujZpravu("Dobrý den, rád bych Vás oslovil s nabídkou obědů. Zkusíme to?", {
      predmet: "obědy",
    });
    expect(v.some((p) => p.kod === "zakazana-fraze" && p.detail.includes("Rád bych Vás oslovil"))).toBe(true);
  });

  it("nenechá se zmást velkými písmeny ani zdvojenými mezerami", () => {
    const v = zkontrolujZpravu("Dobrý den, nabízíme KOMPLEXNÍ  ŘEŠENÍ obědů. Zkusíme to?", {
      predmet: "obědy",
    });
    expect(v.some((p) => p.kod === "zakazana-fraze")).toBe(true);
  });

  it("hlídá délku prvního oslovení", () => {
    const dlouha = `${"slovo ".repeat(130)}Zkusíme to?`;
    const v = zkontrolujZpravu(dlouha, { predmet: "obědy" });
    expect(v.some((p) => p.kod === "prilis-dlouha")).toBe(true);
  });

  it("odmítne odrážky s benefity", () => {
    const sOdrazkami = `Dobrý den,

nabízíme obědy:
- teplé jídlo
- rozvoz zdarma

Zkusíme to?`;
    const v = zkontrolujZpravu(sOdrazkami, { predmet: "obědy" });
    expect(v.some((p) => p.kod === "odrazky")).toBe(true);
  });

  it("chce právě jednu otázku na konci", () => {
    const bezOtazky = "Dobrý den, vaříme obědy ve Zbůchu. Ozvěte se.";
    expect(zkontrolujZpravu(bezOtazky, { predmet: "obědy" }).some((p) => p.kod === "otazka")).toBe(true);

    const dveOtazky = "Dobrý den, řešíte obědy? Má smysl to zkusit?";
    expect(zkontrolujZpravu(dveOtazky, { predmet: "obědy" }).some((p) => p.kod === "otazka")).toBe(true);
  });

  it("jméno adresáta smí padnout nejvýš jednou", () => {
    const text = "Dobrý den, pane Nováku, vaříme obědy. Pane Nováku, má to smysl?";
    const v = zkontrolujZpravu(text, { predmet: "obědy", jmenoAdresata: "Nováku" });
    expect(v.some((p) => p.kod === "jmeno-adresata")).toBe(true);
  });

  it("odmítne HTML v těle — zpráva je prostý text", () => {
    const v = zkontrolujZpravu("<p>Dobrý den, obědy?</p>", { predmet: "obědy" });
    expect(v.some((p) => p.kod === "html")).toBe(true);
  });

  it("hlídá i předmět: bez superlativů a bez clickbaitu", () => {
    const v = zkontrolujZpravu(DOBRA_ZPRAVA, { predmet: "Revoluce ve firemním stravování?!" });
    expect(v.some((p) => p.kod === "predmet")).toBe(true);
  });

  it("seznam zakázaných frází odpovídá SPEC kap. 6", () => {
    expect(ZAKAZANE_FRAZE).toContain("win-win");
    expect(ZAKAZANE_FRAZE).toContain("řešení na míru");
    expect(ZAKAZANE_FRAZE).toContain("Doufám, že se máte dobře");
    expect(ZAKAZANE_FRAZE).toHaveLength(13);
  });
});

/**
 * Vykání s velkým písmenem (Vy, Vás, Vaše) je v obchodním dopise úzus —
 * malé „vaší" v oslovení konkrétní osoby vypadá jako hromadná pošta.
 * Vyžádal si to majitel 18. 8. 2026, když našel malé v v mých šablonách.
 */
describe("vykání velkým písmenem", () => {
  it("najde malé v tam, kde se vyká", () => {
    const v = zkontrolujZpravu("Dobrý den, pár minut od vaší firmy vaříme obědy. Zkusíte to?", {
      predmet: "obědy",
    });
    expect(v.some((p) => p.kod === "vykani" && p.detail.includes("vaší"))).toBe(true);
  });

  it("správně napsané vykání projde", () => {
    const v = zkontrolujZpravu("Dobrý den, pár minut od Vaší firmy je jídelna. Zkusíte to?", {
      predmet: "obědy",
    });
    expect(v.some((p) => p.kod === "vykani")).toBe(false);
  });

  it("nehlásí slova, která jen začínají na va", () => {
    const v = zkontrolujZpravu("Dobrý den, jídelna vaří denně a nabízí varianty. Zkusíte to?", {
      predmet: "obědy",
    });
    expect(v.some((p) => p.kod === "vykani")).toBe(false);
  });

  it("na začátku věty velké písmeno o vykání nic neříká", () => {
    const v = zkontrolujZpravu("Dobrý den. Vaše obědy neřešíme. Zkusíte to?", { predmet: "obědy" });
    expect(v.some((p) => p.kod === "vykani")).toBe(false);
  });
});
