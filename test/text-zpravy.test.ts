import { describe, expect, it } from "vitest";
import { slozText, type PodkladyFirmy, type PodminkaPasaze } from "../src/text-zpravy.js";

/**
 * Podmíněné věty ve zprávě.
 *
 * Naléhavý důvod, proč to vzniká: dnešní šablona tvrdí každé firmě
 * „s možností obědvat na místě **nebo** si jídlo odvážet v jídlonosičích".
 * Jídelna, která umí jen jedno z toho, by tím rozeslala nepravdu o službě.
 *
 * Podmínka se váže na **pořadí odstavce a věty**, ne na pozici znaku —
 * ta se při psaní posune a podmínka by ukazovala na jinou větu.
 */

const KOSTRA = `[osloveni]

[vzdalenost] [od_vasi_firmy] spolupracujeme se školní jídelnou.

Menu vychází na [cena]. Jídlo si můžete odvézt v jídlonosiči. Objednáte přes aplikaci.`;

const PODKLADY: PodkladyFirmy = {
  prijmeni: null,
  oznaceni: null,
  vzdalenostM: 500,
  cena: "115 Kč",
  parametry: { moznosti_vydeje: '["na místě","do vlastního jídlonosiče"]' },
};

describe("podmíněné věty", () => {
  it("bez podmínek zůstane text celý", () => {
    const t = slozText(KOSTRA, [], PODKLADY, []);
    expect(t).toContain("Jídlo si můžete odvézt v jídlonosiči.");
  });

  it("věta zůstane, když jídelna tu možnost umí", () => {
    const podminky: PodminkaPasaze[] = [
      {
        odstavec: 2,
        veta: 1,
        parametrKod: "moznosti_vydeje",
        ocekavanaHodnota: "do vlastního jídlonosiče",
      },
    ];
    expect(slozText(KOSTRA, [], PODKLADY, podminky)).toContain("v jídlonosiči");
  });

  it("věta zmizí, když ji jídelna neumí — a zbytek odstavce zůstane", () => {
    const podminky: PodminkaPasaze[] = [
      {
        odstavec: 2,
        veta: 1,
        parametrKod: "moznosti_vydeje",
        ocekavanaHodnota: "do vlastního jídlonosiče",
      },
    ];
    const jenNaMiste: PodkladyFirmy = {
      ...PODKLADY,
      parametry: { moznosti_vydeje: '["na místě"]' },
    };

    const t = slozText(KOSTRA, [], jenNaMiste, podminky);
    expect(t).not.toContain("jídlonosiči");
    expect(t).toContain("Menu vychází na 115 Kč.");
    expect(t).toContain("Objednáte přes aplikaci.");
  });

  it("podmínka bez očekávané hodnoty znamená „je vyplněné“", () => {
    const podminky: PodminkaPasaze[] = [
      { odstavec: 2, veta: 0, parametrKod: "cena_obeda", ocekavanaHodnota: null },
    ];
    const bezCeny: PodkladyFirmy = { ...PODKLADY, parametry: {} };
    expect(slozText(KOSTRA, [], bezCeny, podminky)).not.toContain("Menu vychází");

    const sCenou: PodkladyFirmy = { ...PODKLADY, parametry: { cena_obeda: "95" } };
    expect(slozText(KOSTRA, [], sCenou, podminky)).toContain("Menu vychází");
  });

  it("ano/ne se porovnává na rovnost", () => {
    const podminky: PodminkaPasaze[] = [
      { odstavec: 2, veta: 2, parametrKod: "vari_o_prazdninach", ocekavanaHodnota: "ano" },
    ];
    const ne: PodkladyFirmy = { ...PODKLADY, parametry: { vari_o_prazdninach: "ne" } };
    expect(slozText(KOSTRA, [], ne, podminky)).not.toContain("Objednáte přes aplikaci");
  });

  it("podmínka na neexistující větu text nerozbije", () => {
    const podminky: PodminkaPasaze[] = [
      { odstavec: 9, veta: 9, parametrKod: "moznosti_vydeje", ocekavanaHodnota: "cokoli" },
    ];
    expect(slozText(KOSTRA, [], PODKLADY, podminky)).toContain("Objednáte přes aplikaci.");
  });
});
