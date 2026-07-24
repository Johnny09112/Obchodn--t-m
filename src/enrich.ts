import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/** Atributy, které smí enrichment dohledávat na webu (podmnožina whitelistu kap. 5). */
const ENRICH_ATRIBUTY = ["ma_vlastni_jidelnu", "zpusob_stravovani", "ucel_adresy"] as const;

const nalezSchema = z.object({
  atribut: z.enum(ENRICH_ATRIBUTY),
  hodnota: z.string().min(1),
  zdrojUrl: z.string().url(),
  citace: z.string().min(1).max(200),
});

const kontaktSchema = z.object({
  email: z.string().email().optional(),
  jmeno: z.string().optional(),
  prijmeni: z.string().optional(),
  pozice: z.string().optional(),
  urovenAdresy: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  zdrojUrl: z.string().url(),
  citace: z.string().min(1).max(200),
});

export type Nalez = z.infer<typeof nalezSchema>;
export type NalezenyKontakt = z.infer<typeof kontaktSchema>;

export interface EnrichVstupFirma {
  ico: string;
  nazev: string;
  obec: string | null;
}

export interface EnrichVysledek {
  nalezy: Nalez[];
  kontakty: NalezenyKontakt[];
  nakladyUsd: number;
  poznamkaProPlaybook?: string;
}

export interface Enricher {
  obohat(firma: EnrichVstupFirma): Promise<EnrichVysledek>;
}

const VYSTUPNI_SCHEMA = {
  type: "object",
  properties: {
    nalezy: {
      type: "array",
      items: {
        type: "object",
        properties: {
          atribut: { type: "string", enum: [...ENRICH_ATRIBUTY] },
          hodnota: { type: "string" },
          zdrojUrl: { type: "string" },
          citace: { type: "string" },
        },
        required: ["atribut", "hodnota", "zdrojUrl", "citace"],
        additionalProperties: false,
      },
    },
    kontakty: {
      type: "array",
      items: {
        type: "object",
        properties: {
          email: { type: "string" },
          jmeno: { type: "string" },
          prijmeni: { type: "string" },
          pozice: { type: "string" },
          urovenAdresy: { type: "integer", enum: [1, 2, 3] },
          zdrojUrl: { type: "string" },
          citace: { type: "string" },
        },
        required: ["urovenAdresy", "zdrojUrl", "citace"],
        additionalProperties: false,
      },
    },
    poznamkaProPlaybook: { type: "string" },
  },
  required: ["nalezy", "kontakty"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Jsi rešeršní agent Čmuchal systému Cantinero. Tvým úkolem je z veřejného webu
dohledat o zadané české firmě VÝHRADNĚ tyto údaje:
1. ma_vlastni_jidelnu — má firma vlastní závodní jídelnu/kantýnu? (hodnota "true"/"false")
2. zpusob_stravovani — jak firma řeší stravování zaměstnanců (stravenky, příspěvek, dovoz…)
3. ucel_adresy — u nalezených e-mailových adres explicitně uvedený účel
4. kontakty — max 2 kontaktní osoby nebo adresy; priorita rolí: HR/people ops,
   office management, provozní ředitel, u malých firem jednatel

Železná pravidla (porušení = nepoužitelný výstup):
- Každý údaj MUSÍ mít zdrojUrl (konkrétní stránka) a doslovnou citaci z ní (max 200 znaků).
  Co nemáš doloženo doslovnou citací, NEUVÁDĚJ. Prázdný výsledek je v pořádku.
- Nic nedopočítávej ani neodhaduj. Žádné údaje ze soukromých profilů na sociálních
  sítích, žádný LinkedIn. Žádné finanční údaje, recenze, inzeráty.
- urovenAdresy: 1 = adresa/formulář zveřejněný pro příjem nabídek (poptavky@, nabidky@,
  obchod@, kontaktní formulář pro dodavatele), 2 = obecná adresa (info@), 3 = jmenná
  adresa konkrétní osoby. Hledej explicitní účel zveřejněné adresy a cituj ho.
- Preferuj web firmy (kariérní stránky, kontakty, o nás). Pracovní inzeráty smíš použít
  jako zdroj údaje o stravování.
Volitelně vyplň poznamkaProPlaybook: krátce, který typ zdroje/dotazu vedl k nálezu.`;

export interface EnricherOpts {
  klient: Anthropic;
  model?: string;
}

/** Ceník claude-opus-4-8: $5/M vstupních, $25/M výstupních tokenů. */
function naklady(usage: { input_tokens: number; output_tokens: number }): number {
  return (usage.input_tokens / 1e6) * 5 + (usage.output_tokens / 1e6) * 25;
}

export function vytvorEnricher(opts: EnricherOpts): Enricher {
  const model = opts.model ?? "claude-opus-4-8";

  return {
    async obohat(firma) {
      const res = await opts.klient.messages.create({
        model,
        max_tokens: 16_000,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 8 } as never,
        ],
        output_config: {
          format: { type: "json_schema", schema: VYSTUPNI_SCHEMA },
        },
        messages: [
          {
            role: "user",
            content: `Firma: ${firma.nazev} (IČO ${firma.ico})${firma.obec ? `, sídlo: ${firma.obec}` : ""}. Dohledej povolené údaje.`,
          },
        ],
      } as never);

      const odpoved = res as unknown as {
        content: Array<{ type: string; text?: string }>;
        usage: { input_tokens: number; output_tokens: number };
      };

      const text = odpoved.content.find((b) => b.type === "text")?.text ?? "";
      let syrove: unknown;
      try {
        syrove = JSON.parse(text);
      } catch {
        syrove = { nalezy: [], kontakty: [] };
      }
      const obal = (syrove ?? {}) as {
        nalezy?: unknown[];
        kontakty?: unknown[];
        poznamkaProPlaybook?: string;
      };

      // Druhá obranná linie k TP-2/TP-3: nevalidní položky se po jedné zahodí.
      const nalezy = (obal.nalezy ?? [])
        .map((n) => nalezSchema.safeParse(n))
        .filter((r) => r.success)
        .map((r) => r.data);
      const kontakty = (obal.kontakty ?? [])
        .map((k) => kontaktSchema.safeParse(k))
        .filter((r) => r.success)
        .map((r) => r.data);

      return {
        nalezy,
        kontakty,
        nakladyUsd: naklady(odpoved.usage),
        poznamkaProPlaybook: obal.poznamkaProPlaybook,
      };
    },
  };
}
