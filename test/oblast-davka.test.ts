import { describe, expect, it } from "vitest";
import { mistaVDavce } from "../src/oblast.js";

/**
 * Vkládání po dávkách je jediné místo, kde se v projektu skládají čísla
 * parametrů ručně — a je to přesně to místo, kde se dá udělat chyba o jedna.
 * Proto se testuje zvlášť, a ne jen skrz celý přepočet.
 */
describe("místa v dávce", () => {
  it("první řádek začíná za společným parametrem oblasti", () => {
    expect(mistaVDavce(1)).toBe("($1,$2,$3)");
  });

  it("další řádky sdílí oblast a posouvají se o dva", () => {
    expect(mistaVDavce(3)).toBe("($1,$2,$3),($1,$4,$5),($1,$6,$7)");
  });

  it("prázdná dávka nevyrobí prázdné závorky", () => {
    expect(mistaVDavce(0)).toBe("");
  });
});
