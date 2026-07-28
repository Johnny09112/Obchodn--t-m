import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { postavIndex, vytahniProKoho, vytvorMpsvKlienta } from "../src/mpsv.js";

const vzorek = {
  polozky: [
    {
      pocetMist: 8,
      zamestnavatel: { ico: "25242407", nazev: "AGROFARMY BEZDRUŽICE s.r.o." },
      mistoVykonuPrace: {
        pracoviste: [{ adresa: { obec: { id: "Obec/560740" } } }],
      },
    },
    {
      pocetMist: 1,
      zamestnavatel: { ico: "17255686", nazev: "Café Kryštof Harant s.r.o." },
      mistoVykonuPrace: {
        pracoviste: [{ adresa: { obec: { id: "Obec/560740" } } }],
      },
    },
    {
      pocetMist: 2,
      zamestnavatel: { ico: "25242407", nazev: "AGROFARMY BEZDRUŽICE s.r.o." },
      mistoVykonuPrace: {
        pracoviste: [{ adresa: { obec: { id: "Obec/560740" } } }],
      },
    },
    {
      pocetMist: 27,
      zamestnavatel: { ico: "25235753", nazev: "ŠKODA JS a.s." },
      mistoVykonuPrace: {
        pracoviste: [{ adresa: { obec: { id: "Obec/554791" } } }],
      },
    },
    // Bez IČO — musí se přeskočit
    {
      pocetMist: 3,
      zamestnavatel: { nazev: "Neznámý" },
      mistoVykonuPrace: { pracoviste: [{ adresa: { obec: { id: "Obec/560740" } } }] },
    },
  ],
};

describe("kontaktní osoba z inzerátu", () => {
  // Zaměstnavatel ji zveřejnil sám v otevřených datech úřadu práce. Je to
  // nejlevnější zdroj jména, pozice, telefonu i e-mailu naráz — data už
  // stahujeme kvůli pracovištím a kontakt v nich byl celou dobu.
  const sKontaktem = {
    polozky: [
      {
        pocetMist: 5,
        zamestnavatel: { ico: "25242407", nazev: "AGROFARMY BEZDRUŽICE s.r.o." },
        mistoVykonuPrace: { pracoviste: [{ adresa: { obec: { id: "Obec/560740" } } }] },
        prvniKontaktSeZamestnavatelem: {
          komuSeHlasit: {
            jmeno: "Radek", prijmeni: "Ondrušek",
            titulPredJmenem: "Ing.", titulZaJmenem: null,
            poziceVeSpolecnosti: "personalista",
            email: "radek.ondrusek@agrofarmy.cz", telefon: "608 200 094",
          },
        },
      },
    ],
  };

  it("vytáhne jméno, pozici, e-mail i telefon", () => {
    const z = postavIndex(sKontaktem)["560740"]!["25242407"]!;
    expect(z.kontakt).toMatchObject({
      jmeno: "Ing. Radek",
      prijmeni: "Ondrušek",
      pozice: "personalista",
      email: "radek.ondrusek@agrofarmy.cz",
      telefon: "608 200 094",
    });
  });

  it("bez kontaktu v inzerátu si nic nedomýšlí", () => {
    expect(postavIndex(vzorek)["560740"]!["25242407"]!.kontakt).toBeUndefined();
  });

  it("kontakt s prázdnými poli nebere — je k ničemu", () => {
    const prazdny = {
      polozky: [{
        pocetMist: 1,
        zamestnavatel: { ico: "25242407", nazev: "A" },
        mistoVykonuPrace: { pracoviste: [{ adresa: { obec: { id: "Obec/560740" } } }] },
        prvniKontaktSeZamestnavatelem: {
          komuSeHlasit: { jmeno: null, prijmeni: null, email: null, telefon: null },
        },
      }],
    };
    expect(postavIndex(prazdny)["560740"]!["25242407"]!.kontakt).toBeUndefined();
  });

  it("stačí samotný telefon bez jména", () => {
    const jenTelefon = {
      polozky: [{
        pocetMist: 1,
        zamestnavatel: { ico: "25242407", nazev: "A" },
        mistoVykonuPrace: { pracoviste: [{ adresa: { obec: { id: "Obec/560740" } } }] },
        prvniKontaktSeZamestnavatelem: {
          komuSeHlasit: { jmeno: null, prijmeni: null, email: null, telefon: "377 123 456" },
        },
      }],
    };
    expect(postavIndex(jenTelefon)["560740"]!["25242407"]!.kontakt).toMatchObject({
      telefon: "377 123 456",
    });
  });
});

describe("postavIndex", () => {
  it("sloučí inzeráty jednoho zaměstnavatele a sečte místa", () => {
    const idx = postavIndex(vzorek);
    const bezdruzice = idx["560740"]!;
    expect(Object.keys(bezdruzice)).toHaveLength(2);
    expect(bezdruzice["25242407"]).toMatchObject({
      nazev: "AGROFARMY BEZDRUŽICE s.r.o.",
      mist: 10, // 8 + 2
      inzeratu: 2,
      jeAgentura: false,
      proKoho: null,
    });
  });

  it("přeskočí záznamy bez IČO", () => {
    const idx = postavIndex(vzorek);
    const vsechna = Object.values(idx["560740"]!);
    expect(vsechna.some((z) => z.nazev === "Neznámý")).toBe(false);
  });

  it("rozdělí zaměstnavatele podle obcí", () => {
    const idx = postavIndex(vzorek);
    expect(Object.keys(idx["554791"]!)).toEqual(["25235753"]);
  });
});

describe("MpsvKlient", () => {
  it("stáhne, uloží index a při dalším volání už nestahuje", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cantinero-"));
    const cesta = join(dir, "index.json");
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(vzorek), { status: 200 }));

    const k = vytvorMpsvKlienta({ fetchFn, cestaIndexu: cesta });
    const prvni = await k.zamestnavateleVObci(560740);
    expect(prvni).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const druhy = await k.zamestnavateleVObci(560740);
    expect(druhy).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledTimes(1); // z cache, znovu se nestahuje

    const ulozeno = JSON.parse(await readFile(cesta, "utf8"));
    expect(ulozeno.obce["560740"]).toBeTruthy();
    expect(ulozeno.stazeno).toBeTruthy();
  });

  it("seřadí zaměstnavatele podle počtu nabízených míst", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cantinero-"));
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(vzorek), { status: 200 }));
    const k = vytvorMpsvKlienta({ fetchFn, cestaIndexu: join(dir, "i.json") });
    const z = await k.zamestnavateleVObci(560740);
    expect(z[0]!.ico).toBe("25242407");
    expect(z[0]!.mist).toBe(10);
    expect(z[0]!.zdrojUrl).toContain("mpsv.cz");
  });

  it("zastaralý index stáhne znovu", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cantinero-"));
    const cesta = join(dir, "index.json");
    await writeFile(
      cesta,
      JSON.stringify({ stazeno: "2020-01-01T00:00:00.000Z", obce: {} }),
      "utf8",
    );
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(vzorek), { status: 200 }));
    const k = vytvorMpsvKlienta({ fetchFn, cestaIndexu: cesta, maxStariHodin: 24 });
    await k.zamestnavateleVObci(560740);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("rozpoznání agentur práce", () => {
  const agentury = {
    polozky: [
      {
        pocetMist: 8,
        souhlasAgenturyAgentura: true,
        zamestnavatel: { ico: "21033137", nazev: "MSRCZ MARINA GLOBAL. s.r.o." },
        mistoVykonuPrace: {
          pracoviste: [{
            nazev: "MSRCZ MARINA GLOBAL. s.r.o. (SIGNUM s.r.o.)",
            adresa: { obec: { id: "Obec/560740" }, cisloDomovni: 291 },
          }],
        },
      },
      {
        pocetMist: 1,
        souhlasAgenturyAgentura: false,
        zamestnavatel: { ico: "04707087", nazev: "MARCIUS PLUS s.r.o." },
        mistoVykonuPrace: {
          pracoviste: [{
            nazev: "MARCIUS PLUS s.r.o., pracoviště Bezdružice, Signum s.r.o.",
            adresa: { obec: { id: "Obec/560740" }, cisloDomovni: 291 },
          }],
        },
      },
      {
        pocetMist: 2,
        souhlasAgenturyAgentura: false,
        zamestnavatel: { ico: "18200061", nazev: "SIGNUM spol. s r.o." },
        mistoVykonuPrace: {
          pracoviste: [{
            nazev: "SIGNUM spol. s r.o.(prac.Bezdružice)",
            adresa: { obec: { id: "Obec/560740" }, cisloDomovni: 291 },
          }],
        },
      },
    ],
  };

  it("pozná agenturu podle příznaku v datech", () => {
    const idx = postavIndex(agentury);
    expect(idx["560740"]!["21033137"]!.jeAgentura).toBe(true);
  });

  it("pozná agenturu i podle cizí firmy v názvu pracoviště", () => {
    const idx = postavIndex(agentury);
    // MARCIUS PLUS nemá příznak, ale v názvu pracoviště je Signum.
    expect(idx["560740"]!["04707087"]!.jeAgentura).toBe(true);
    expect(idx["560740"]!["04707087"]!.proKoho).toContain("Signum");
  });

  it("skutečného zaměstnavatele za agenturu nepovažuje", () => {
    const idx = postavIndex(agentury);
    const signum = idx["560740"]!["18200061"]!;
    expect(signum.jeAgentura).toBe(false);
    expect(signum.proKoho).toBeNull();
    expect(signum.cisloDomovni).toBe(291);
  });

  it("vytahne firmu ze závorky i ze závěru názvu", () => {
    expect(vytahniProKoho("Agentura s.r.o. (SIGNUM s.r.o.)", "Agentura s.r.o.")).toBe("SIGNUM s.r.o.");
    expect(vytahniProKoho("A s.r.o., pracoviště X, Signum s.r.o.", "A s.r.o.")).toBe("Signum s.r.o.");
    // Jen opis vlastního jména není cizí firma.
    expect(vytahniProKoho("SIGNUM spol. s r.o.(prac.Bezdružice)", "SIGNUM spol. s r.o.")).toBeNull();
    expect(vytahniProKoho(undefined, "X s.r.o.")).toBeNull();
  });
});

describe("verzování indexu", () => {
  it("index ve starém formátu se zahodí a stáhne znovu", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cantinero-"));
    const cesta = join(dir, "index.json");
    // Čerstvý, ale bez verze — přesně stav, který způsobil tichou chybu.
    await writeFile(
      cesta,
      JSON.stringify({ stazeno: new Date().toISOString(), obce: { "560740": {} } }),
      "utf8",
    );
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(vzorek), { status: 200 }));
    const k = vytvorMpsvKlienta({ fetchFn, cestaIndexu: cesta });
    const z = await k.zamestnavateleVObci(560740);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(z.length).toBeGreaterThan(0);
  });
});
