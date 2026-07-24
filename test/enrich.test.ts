import { describe, expect, it, vi } from "vitest";
import { vytvorEnricher } from "../src/enrich.js";
import type Anthropic from "@anthropic-ai/sdk";

function mockKlient(vystup: unknown, usage = { input_tokens: 10_000, output_tokens: 2_000 }) {
  const create = vi.fn(async () => ({
    content: [{ type: "text", text: JSON.stringify(vystup) }],
    stop_reason: "end_turn",
    usage,
  }));
  return { klient: { messages: { create } } as unknown as Anthropic, create };
}

const firma = { ico: "25596641", nazev: "Seznam.cz, a.s.", obec: "Praha" };

describe("obohat", () => {
  it("vrátí validní nálezy a kontakty", async () => {
    const { klient } = mockKlient({
      nalezy: [
        {
          atribut: "zpusob_stravovani",
          hodnota: "stravenky",
          zdrojUrl: "https://www.seznam.cz/kariera",
          citace: "Přispíváme na stravování.",
        },
      ],
      kontakty: [
        {
          email: "obchod@seznam.cz",
          urovenAdresy: 1,
          zdrojUrl: "https://www.seznam.cz/kontakty",
          citace: "Obchodní nabídky: obchod@seznam.cz",
        },
      ],
    });
    const enricher = vytvorEnricher({ klient });
    const v = await enricher.obohat(firma);
    expect(v.nalezy).toHaveLength(1);
    expect(v.kontakty).toHaveLength(1);
    expect(v.nakladyUsd).toBeCloseTo((10_000 / 1e6) * 5 + (2_000 / 1e6) * 25);
  });

  it("zahodí nálezy bez zdroje nebo mimo whitelist (TP-2/TP-3 obrana)", async () => {
    const { klient } = mockKlient({
      nalezy: [
        { atribut: "zpusob_stravovani", hodnota: "x", zdrojUrl: "", citace: "y" },
        { atribut: "plat_reditele", hodnota: "x", zdrojUrl: "https://a.cz", citace: "y" },
        {
          atribut: "ma_vlastni_jidelnu",
          hodnota: "false",
          zdrojUrl: "https://a.cz/o-nas",
          citace: "Obědy chodíme do okolních restaurací.",
        },
      ],
      kontakty: [
        { email: "bez-zdroje@a.cz", urovenAdresy: 2, zdrojUrl: "", citace: "" },
      ],
    });
    const enricher = vytvorEnricher({ klient });
    const v = await enricher.obohat(firma);
    expect(v.nalezy).toHaveLength(1);
    expect(v.nalezy[0]!.atribut).toBe("ma_vlastni_jidelnu");
    expect(v.kontakty).toHaveLength(0);
  });

  it("nevalidní JSON od modelu → prázdný výsledek, ne pád", async () => {
    const create = vi.fn(async () => ({
      content: [{ type: "text", text: "tohle není json" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 },
    }));
    const enricher = vytvorEnricher({
      klient: { messages: { create } } as unknown as Anthropic,
    });
    const v = await enricher.obohat(firma);
    expect(v.nalezy).toHaveLength(0);
    expect(v.kontakty).toHaveLength(0);
  });
});
