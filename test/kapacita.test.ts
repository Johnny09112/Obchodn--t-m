import { describe, expect, it } from "vitest";
import { soucetKapacit, type JidelnaKapacita } from "../src/kapacita.js";

/**
 * Součet volné kapacity je číslo, podle kterého se rozhoduje, kolik firem má
 * vůbec smysl odemknout. Musí proto poznat tři různé věci, které vypadají
 * podobně: kapacitu, kterou máme dnes, kapacitu, kterou teprve budeme mít,
 * a kapacitu, kterou neznáme.
 */

const j = (o: Partial<JidelnaKapacita>): JidelnaKapacita => ({
  kapacita_volna: null,
  stav: "v_provozu",
  aktivni: true,
  ...o,
});

describe("soucetKapacit", () => {
  it("sečte jen jídelny v provozu; jídelny v přípravě drží zvlášť", () => {
    const v = soucetKapacit([
      j({ kapacita_volna: 20 }),
      j({ kapacita_volna: 50 }),
      j({ kapacita_volna: 200, stav: "priprava" }),
    ]);
    expect(v.vProvozu).toBe(70);
    expect(v.priprava).toBe(200);
  });

  it("nepočítá jídelny mimo provoz ani do jednoho z čísel", () => {
    const v = soucetKapacit([
      j({ kapacita_volna: 20 }),
      j({ kapacita_volna: 999, aktivni: false }),
      j({ kapacita_volna: 999, aktivni: false, stav: "priprava" }),
    ]);
    expect(v.vProvozu).toBe(20);
    expect(v.priprava).toBe(0);
  });

  /**
   * Neuvedená kapacita NENÍ nula. Kdyby se do součtu započítala jako nula,
   * tvrdilo by číslo, že jídelna nemá volno — a to je jiná informace.
   * Proto se počítá zvlášť, aby šlo říct „skutečné číslo bude vyšší".
   */
  it("neuvedenou kapacitu nepočítá jako nulu, ale spočítá, kolika jídelnám chybí", () => {
    const v = soucetKapacit([
      j({ kapacita_volna: 20 }),
      j({ kapacita_volna: null }),
      j({ kapacita_volna: null, stav: "priprava" }),
    ]);
    expect(v.vProvozu).toBe(20);
    expect(v.priprava).toBe(0);
    expect(v.bezUdaje).toBe(2);
  });

  it("prázdný seznam dá nuly, ne pád", () => {
    expect(soucetKapacit([])).toEqual({ vProvozu: 0, priprava: 0, bezUdaje: 0 });
  });
});
