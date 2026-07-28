import { createClient } from "@supabase/supabase-js";

/**
 * Připojení ke sdílené databázi (projekt `Customer_finder`, eu-central-1).
 *
 * Klíč je **publishable** — je určený k tomu, aby byl vidět v prohlížeči.
 * Sám o sobě neotevírá nic: co uvidí přihlášený uživatel, rozhoduje Row
 * Level Security v databázi (migrace 0015–0016). Klíč `service_role`
 * pravidla obchází, a proto se do aplikace nikdy nesmí dostat.
 */
const URL = import.meta.env.VITE_SUPABASE_URL ?? "https://sedjnwllzyeuiruxgoil.supabase.co";
const KLIC =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_e5Nd48dJni1kxogupcOvVQ_RC-KA7RR";

export const supabase = createClient(URL, KLIC);

export type Role = "super-admin" | "admin" | "uzivatel" | "host";

/**
 * Role se čte z `app_metadata`. To druhé místo (`user_metadata`) si smí
 * uživatel sám přepsat, takže by se kdokoli povýšil na admina — proto se
 * odtud nečte ani tady, ani v pravidlech databáze.
 *
 * Tohle je jen popisek pro uživatele. Skutečnou hranici drží databáze.
 */
export function roleZeSession(appMetadata: unknown): Role {
  const role = (appMetadata as { role?: unknown } | null)?.role;
  return role === "super-admin" || role === "admin" || role === "uzivatel" ? role : "host";
}

export const POPIS_ROLE: Record<Role, string> = {
  "super-admin": "Správce",
  admin: "Admin",
  uzivatel: "Uživatel",
  host: "Bez role",
};
