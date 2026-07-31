import { describe, expect, it } from "vitest";
import { postupPruzkumu } from "../src/pruzkum-postup.js";

const useky = (hotovo: number, ceka: number, bezi = 0, selhalo = 0) => [
  ...Array.from({ length: hotovo }, () => ({ stav: "hotovo" })),
  ...Array.from({ length: bezi }, () => ({ stav: "bezi" })),
  ...Array.from({ length: selhalo }, () => ({ stav: "selhalo" })),
  ...Array.from({ length: ceka }, () => ({ stav: "ceka" })),
];

describe("postup průzkumu pro člověka", () => {
  it("objednávka bez úseků čeká na vyzvednutí a řekne kdy", () => {
    const p = postupPruzkumu({
      stav: "ceka",
      useky: [],
      bezPredMinutami: 0,
      dalsiBehZa: 7,
    });
    expect(p.popis).toContain("Čeká na spuštění");
    expect(p.popis).toContain("7 minut");
    expect(p.odhadMinut).toBeNull();
  });

  it("když frontu blokuje jiný průzkum, řekne který", () => {
    // Bez tohohle člověk kouká na „čeká" a netuší, že čeká na někoho jiného.
    const p = postupPruzkumu({
      stav: "ceka",
      useky: [],
      bezPredMinutami: 0,
      dalsiBehZa: 3,
      blokujeJiny: "Plzeň a okolí",
    });
    expect(p.popis).toContain("Plzeň a okolí");
    expect(p.popis).not.toContain("3 minut");
  });

  it("bez jediné hotové obce odhad nevymýšlí", () => {
    // Velké město trvá i hodinu. Odhad ze vzorku nula je dohad, ne odhad.
    const p = postupPruzkumu({
      stav: "bezi",
      useky: useky(0, 70, 1),
      bezPredMinutami: 78,
      bezicíObec: "Plzeň",
    });
    expect(p.hotovo).toBe(0);
    expect(p.celkem).toBe(71);
    expect(p.odhadMinut).toBeNull();
    expect(p.popis).toContain("Plzeň");
    // 78 minut se člověku ukáže jako „hodinu a 18 minut" — čitelnější.
    expect(p.popis).toContain("hodinu a 18 minut");
  });

  it("z hotových obcí odhadne zbytek", () => {
    // 10 obcí za 20 minut = 2 min/obec; zbývá 40 obcí → 80 minut.
    const p = postupPruzkumu({
      stav: "bezi",
      useky: useky(10, 40, 1),
      bezPredMinutami: 20,
    });
    expect(p.odhadMinut).toBe(82);
    expect(p.popis).toContain("hotovo 10 z 51");
  });

  it("neúspěšné obce hlásí zvlášť, ne jako hotové", () => {
    const p = postupPruzkumu({
      stav: "bezi",
      useky: useky(5, 3, 1, 2),
      bezPredMinutami: 10,
    });
    expect(p.hotovo).toBe(5);
    expect(p.selhalo).toBe(2);
    expect(p.popis).toContain("2 obce se nepovedly");
  });

  it("hotový průzkum říká, že je hotový", () => {
    const p = postupPruzkumu({ stav: "hotovo", useky: useky(12, 0), bezPredMinutami: 40 });
    expect(p.popis).toContain("Hotovo");
    expect(p.odhadMinut).toBe(0);
  });

  it("průzkum čekající na rozhodnutí člověka to řekne nahlas", () => {
    const p = postupPruzkumu({ stav: "ceka_na_rozhodnuti", useky: [], bezPredMinutami: 5 });
    expect(p.popis).toContain("rozhodnout člověk");
    expect(p.odhadMinut).toBeNull();
  });

  it("neúspěšný průzkum to řekne taky", () => {
    const p = postupPruzkumu({ stav: "selhalo", useky: useky(0, 0, 0, 3), bezPredMinutami: 5 });
    expect(p.popis).toContain("nepovedl");
    expect(p.odhadMinut).toBeNull();
  });
});
