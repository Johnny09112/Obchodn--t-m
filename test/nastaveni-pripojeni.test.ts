import { describe, expect, it } from "vitest";
import { prectiPripojeni, NENASTAVENO } from "../app/src/nastaveni.js";

/**
 * Aplikace se nesmí tiše připojit k cizí databázi.
 *
 * Do 20. 8. 2026 měla v sobě `app/src/supabase.ts` napsanou záložní adresu
 * produkční databáze Cantinera. Dokud běžela jedna firma, byla to úspora
 * psaní. Jakmile vzniklo druhé nasazení pro druhého zákazníka, změnila se
 * v past: nasazení bez nastavených proměnných by se **tiše připojilo k datům
 * první firmy** a nikdo by si toho nevšiml — přihlášení by prošlo, data by
 * se ukázala, jen by patřila někomu jinému.
 *
 * Proto se chybějící nastavení musí projevit hlasitě a nikdy ne tak, že se
 * sáhne jinam.
 */
describe("nastavení připojení k databázi", () => {
  it("úplné nastavení projde a nic nechybí", () => {
    const p = prectiPripojeni({
      VITE_SUPABASE_URL: "https://priklad.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_priklad",
    });

    expect(p.chybi).toEqual([]);
    expect(p.url).toBe("https://priklad.supabase.co");
    expect(p.klic).toBe("sb_publishable_priklad");
  });

  it("chybějící adresa se pojmenuje a nenahradí se ničím funkčním", () => {
    const p = prectiPripojeni({ VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_priklad" });

    expect(p.chybi).toEqual(["VITE_SUPABASE_URL"]);
    expect(p.url).toBe(NENASTAVENO.url);
  });

  it("chybějící klíč se pojmenuje", () => {
    const p = prectiPripojeni({ VITE_SUPABASE_URL: "https://priklad.supabase.co" });

    expect(p.chybi).toEqual(["VITE_SUPABASE_PUBLISHABLE_KEY"]);
    expect(p.klic).toBe(NENASTAVENO.klic);
  });

  it("prázdná hodnota i samé mezery se počítají jako chybějící", () => {
    const p = prectiPripojeni({ VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "   " });

    expect(p.chybi).toEqual(["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  });

  it("hodnoty se ořežou od mezer — překlep v nastavení nemá shodit připojení", () => {
    const p = prectiPripojeni({
      VITE_SUPABASE_URL: "  https://priklad.supabase.co  ",
      VITE_SUPABASE_PUBLISHABLE_KEY: " sb_publishable_priklad ",
    });

    expect(p.chybi).toEqual([]);
    expect(p.url).toBe("https://priklad.supabase.co");
    expect(p.klic).toBe("sb_publishable_priklad");
  });

  /**
   * Tenhle test je jádro věci. Kdyby se záložní hodnota do kódu někdy vrátila,
   * spadne tady — bez ohledu na to, jak se bude jmenovat proměnná.
   */
  it("při chybějícím nastavení nikdy nesáhne do produkční databáze Cantinera", () => {
    const p = prectiPripojeni({});

    expect(p.chybi.length).toBe(2);
    expect(p.url).not.toContain("supabase.co");
    expect(p.url).toContain(".invalid");
  });
});
