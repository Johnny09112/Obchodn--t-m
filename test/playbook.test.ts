import { describe, expect, it } from "vitest";
import { novePoznatky } from "../src/playbook.js";

describe("co se má do playbooku vůbec připsat", () => {
  it("nepřipíše to, co už tam je", () => {
    const playbook = "## Poznatky\n- u firem s víc provozovnami hledej podstránku provozovny\n";
    const nove = novePoznatky(playbook, [
      "u firem s víc provozovnami hledej podstránku provozovny",
      "malé pracovní agregátory rychle expirují, ověřovat přímým načtením",
    ]);
    expect(nove).toEqual(["malé pracovní agregátory rychle expirují, ověřovat přímým načtením"]);
  });

  it("zahodí výpis jednotlivých kandidátů — patří do deníku vyřazení, ne sem", () => {
    // Tohle playbook zaplavilo: osm kopií téhož seznamu 40 řádků.
    // Kdo přesně neprošel, je v tabulce `vyrazeni` i s důvodem.
    const nove = novePoznatky("", [
      "nespárováno s rejstříkem: Léčebný Hotel Prusík",
      "polohu se nepodařilo určit: ROLDECO, spol. s r.o.",
      "vlastní jídelna mezi kandidáty: ZŠ Tlučná",
      "Plzeň je v registru rozdělená na 10 územních jednotek",
    ]);
    expect(nove).toEqual(["Plzeň je v registru rozdělená na 10 územních jednotek"]);
  });

  it("duplicity v rámci jednoho běhu sloučí", () => {
    expect(novePoznatky("", ["stejný poznatek", "stejný poznatek"])).toEqual(["stejný poznatek"]);
  });

  it("prázdný vstup nic nevyrobí", () => {
    expect(novePoznatky("cokoli", [])).toEqual([]);
  });
});
