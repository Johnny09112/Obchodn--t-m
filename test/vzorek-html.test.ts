import { describe, expect, it } from "vitest";
import { vygenerujKontrolu, type ZaznamKontroly } from "../src/vzorek-html.js";

const ZAZNAM: ZaznamKontroly = {
  ico: "18200061",
  nazev: 'Firma "<b>zlá</b>" s.r.o.',
  obec: "Hustopeče",
  velikost: "korporat",
  skore: 71,
  udaje: [
    {
      atribut: "obor",
      hodnota: "žárové zinkování",
      citace: 'na stránce stojí <script>alert("x")</script>',
      zdrojUrl: "https://signumcz.com/o-nas",
      den: "2. 8. 2026",
    },
  ],
  kontakty: [
    {
      kdo: "Jan Novák",
      spojeni: "novak@example.com",
      uroven: 3,
      citace: "Kontakt: Jan Novák",
      zdrojUrl: "https://example.com/kontakty",
      den: "2. 8. 2026",
    },
  ],
};

describe("stránka ke kontrole vzorku", () => {
  it("vypíše firmu, údaj i doslovnou citaci", () => {
    const html = vygenerujKontrolu([ZAZNAM], "17. 8. 2026");
    expect(html).toContain("Hustopeče");
    expect(html).toContain("žárové zinkování");
    expect(html).toContain("signumcz.com/o-nas");
  });

  /**
   * Data pocházejí z cizích webů. Kdyby se vkládala neescapovaná, stačil by
   * název firmy s `<script>` a stránka ke kontrole by spouštěla cizí kód —
   * kartotéka tuhle past už jednou měla (test/kartoteka.test.ts).
   */
  it("escapuje název, hodnotu i citaci", () => {
    const html = vygenerujKontrolu([ZAZNAM], "17. 8. 2026");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<b>zlá</b>");
    expect(html).toContain("&lt;b&gt;zlá&lt;/b&gt;");
  });

  it("odkaz na zdroj vede na tutéž adresu, jaká je v datech", () => {
    const html = vygenerujKontrolu([ZAZNAM], "17. 8. 2026");
    expect(html).toContain('href="https://signumcz.com/o-nas"');
  });

  it("řekne, kolik záznamů se kontroluje — z toho se počítá podíl chyb", () => {
    const html = vygenerujKontrolu([ZAZNAM], "17. 8. 2026");
    // jeden údaj + jeden kontakt
    expect(html).toContain("2");
    expect(html).toContain("17. 8. 2026");
  });

  it("prázdný vzorek nespadne a řekne, že není co kontrolovat", () => {
    const html = vygenerujKontrolu([], "17. 8. 2026");
    expect(html).toContain("není co kontrolovat");
  });
});
