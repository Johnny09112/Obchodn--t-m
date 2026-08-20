import { createClient } from "@supabase/supabase-js";
import { prectiPripojeni } from "./nastaveni";

/**
 * Připojení ke sdílené databázi — **kterou určuje nastavení nasazení**, ne kód.
 *
 * Klíč je **publishable** — je určený k tomu, aby byl vidět v prohlížeči.
 * Sám o sobě neotevírá nic: co uvidí přihlášený uživatel, rozhoduje Row
 * Level Security v databázi (migrace 0015–0016). Klíč `service_role`
 * pravidla obchází, a proto se do aplikace nikdy nesmí dostat.
 */
const PRIPOJENI = prectiPripojeni(import.meta.env as unknown as Record<string, unknown>);

/**
 * Které proměnné chybí. Prázdné pole = smí se připojovat.
 *
 * Aplikace to musí zkontrolovat **dřív, než se na cokoli zeptá databáze**
 * (viz `App.tsx`) — jinak by uživatel viděl jen nekonečné načítání a nevěděl
 * proč. Záložní adresa tu schválně není: podrobnosti v `nastaveni.ts`.
 */
export const CHYBI_NASTAVENI: readonly string[] = PRIPOJENI.chybi;

export const supabase = createClient(PRIPOJENI.url, PRIPOJENI.klic);

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
