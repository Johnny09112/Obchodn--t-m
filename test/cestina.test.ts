import { describe, expect, it } from "vitest";
import { cesky, zZe } from "../src/cestina.js";

describe("české tvary čísel", () => {
  it("jedna, dvě až čtyři, pět a víc", () => {
    const oblasti = (n: number) => `${n} ${cesky(n, "oblast", "oblasti", "oblastí")}`;
    expect(oblasti(1)).toBe("1 oblast");
    expect(oblasti(2)).toBe("2 oblasti");
    expect(oblasti(4)).toBe("4 oblasti");
    expect(oblasti(5)).toBe("5 oblastí");
    expect(oblasti(0)).toBe("0 oblastí");
  });

  it("nad dvacet rozhoduje poslední číslice", () => {
    // 21 oblastí, ne „21 oblast" — na rozdíl od angličtiny se v češtině
    // dvacet jedna chová jako pět, ne jako jedna.
    expect(cesky(21, "oblast", "oblasti", "oblastí")).toBe("oblastí");
    expect(cesky(22, "oblast", "oblasti", "oblastí")).toBe("oblastí");
  });
});

describe("předložka z/ze před číslovkou", () => {
  it("řídí se výslovností, ne číslicí", () => {
    // „ze tří", ale „z pěti" — z číslice to není poznat.
    expect(zZe(3)).toBe("ze");
    expect(zZe(2)).toBe("ze");
    expect(zZe(5)).toBe("z");
    expect(zZe(8)).toBe("z");
  });

  it("u čísel mimo seznam volí bezpečnější „z“", () => {
    expect(zZe(11)).toBe("z");
    expect(zZe(42)).toBe("z");
  });
});
