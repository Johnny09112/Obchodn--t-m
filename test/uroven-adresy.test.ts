import { describe, expect, it } from "vitest";
import { jeJmennaAdresa, srovnejUroven } from "../src/uroven-adresy.js";

/**
 * TP-6 je **právní žebříček, ne pořadí podle rozhodovací pravomoci**.
 * Adresa zveřejněná pro příjem nabídek je pozvánka; u jmenné adresy
 * zpracováváme osobní údaj získaný odjinud, a proto k ní patří poučení
 * podle čl. 14 GDPR.
 *
 * Agent tenhle rozdíl plete: obchodnímu zástupci dá úroveň 1, protože „je
 * to kontakt pro nabídky". V ostré databázi tak bylo 5 z 11 poptávkových
 * adres ve skutečnosti jmenných (17. 8. 2026).
 */
describe("jmenná adresa podle TP-6", () => {
  it("pozná příjmení v adrese", () => {
    expect(jeJmennaAdresa("richardbayer@bbs.eu", "Richard", "Bayer")).toBe(true);
    expect(jeJmennaAdresa("martin.vochoc@vochoc.cz", "Martin", "Vochoc")).toBe(true);
  });

  it("nenechá se zmást diakritikou", () => {
    expect(jeJmennaAdresa("pavel.prochazka@signumcz.com", "Pavel", "Procházka")).toBe(true);
    expect(jeJmennaAdresa("zdenka.masinova@signumcz.com", "Zdeňka", "Mašínová")).toBe(true);
  });

  it("provozní adresa jmenná není, i když u ní jméno osoby známe", () => {
    expect(jeJmennaAdresa("bezdruzice@signumcz.com", "Petr", "Mora")).toBe(false);
    expect(jeJmennaAdresa("obchod@babc.cz", "Jana", "Nováková")).toBe(false);
  });

  it("hledá jen před zavináčem — příjmení v doméně nic neznamená", () => {
    // Firma Vochoc s.r.o. má doménu vochoc.cz; obecná adresa jmenná není.
    expect(jeJmennaAdresa("info@vochoc.cz", "Martin", "Vochoc")).toBe(false);
  });

  it("bez jména ani bez adresy se nic neurčuje", () => {
    expect(jeJmennaAdresa("nabidky@babc.cz", null, null)).toBe(false);
    expect(jeJmennaAdresa(null, "Richard", "Bayer")).toBe(false);
  });

  it("krátká jména se neberou — 'Ota' by trefilo půlku adres", () => {
    expect(jeJmennaAdresa("otazky@firma.cz", "Ota", null)).toBe(false);
  });
});

describe("srovnání úrovně adresy", () => {
  it("jmenná adresa spadne na úroveň 3, i když ji agent poslal jako 1", () => {
    expect(srovnejUroven(1, "richardbayer@bbs.eu", "Richard", "Bayer")).toBe(3);
    expect(srovnejUroven(2, "pavel.prochazka@signumcz.com", "Pavel", "Procházka")).toBe(3);
  });

  it("skutečnou poptávkovou adresu nechá být", () => {
    expect(srovnejUroven(1, "nabidky@babc.cz", null, null)).toBe(1);
    expect(srovnejUroven(1, "bezdruzice@signumcz.com", "Petr", "Mora")).toBe(1);
  });

  it("úroveň 3 zůstává úrovní 3", () => {
    expect(srovnejUroven(3, "jan.novak@firma.cz", "Jan", "Novák")).toBe(3);
  });

  it("nevyplněnou úroveň nedomýšlí", () => {
    expect(srovnejUroven(null, "richardbayer@bbs.eu", "Richard", "Bayer")).toBeNull();
  });
});
