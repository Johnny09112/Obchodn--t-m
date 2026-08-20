/**
 * Ke které databázi se aplikace připojuje.
 *
 * **Záložní hodnota tu schválně není.** Do 20. 8. 2026 měl `supabase.ts`
 * napsanou adresu produkční databáze Cantinera jako `??` větev. U jedné firmy
 * to byla úspora psaní; u druhého zákazníka je to past — nasazení bez
 * nastavených proměnných by se tiše připojilo k datům první firmy. Přihlášení
 * by prošlo, data by se ukázala, jen by patřila někomu jinému.
 *
 * Chybějící nastavení proto vede na **neplatnou adresu** (doména `.invalid`
 * podle RFC 2606 nikdy nikam nevede) a aplikace to místo připojování rovnou
 * řekne uživateli.
 */

export interface Pripojeni {
  url: string;
  klic: string;
  /** Názvy proměnných, které chybí. Prázdné pole = nastavení je úplné. */
  chybi: string[];
}

/** Hodnoty pro případ, že nastavení chybí. Klient se z nich sestaví, ale nikam se nedovolá. */
export const NENASTAVENO = {
  url: "https://nenastaveno.invalid",
  klic: "nenastaveno",
} as const;

const KLIC_URL = "VITE_SUPABASE_URL";
const KLIC_KLIC = "VITE_SUPABASE_PUBLISHABLE_KEY";

/** Prázdná hodnota i samé mezery znamenají „nenastaveno" — v proměnných prostředí je to častější než chybějící klíč. */
function hodnota(env: Record<string, unknown>, klic: string): string | null {
  const syrova = env[klic];
  if (typeof syrova !== "string") return null;
  const orezana = syrova.trim();
  return orezana === "" ? null : orezana;
}

export function prectiPripojeni(env: Record<string, unknown>): Pripojeni {
  const url = hodnota(env, KLIC_URL);
  const klic = hodnota(env, KLIC_KLIC);
  const chybi: string[] = [];

  if (url === null) chybi.push(KLIC_URL);
  if (klic === null) chybi.push(KLIC_KLIC);

  return {
    url: url ?? NENASTAVENO.url,
    klic: klic ?? NENASTAVENO.klic,
    chybi,
  };
}
