import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface StavPrihlaseni {
  session: Session | null;
  /** Než se zjistí, jestli uložené přihlášení platí, nesmí se ukázat ani jedno. */
  nacita: boolean;
}

export function usePrihlaseni(): StavPrihlaseni {
  const [session, setSession] = useState<Session | null>(null);
  const [nacita, setNacita] = useState(true);

  useEffect(() => {
    let zruseno = false;

    supabase.auth.getSession().then(({ data }) => {
      if (zruseno) return;
      setSession(data.session);
      setNacita(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_udalost, nova) => {
      setSession(nova);
      setNacita(false);
    });

    return () => {
      zruseno = true;
      data.subscription.unsubscribe();
    };
  }, []);

  return { session, nacita };
}

/**
 * Je tohle chyba přihlašovacího tokenu, kterou vyřeší nové přihlášení?
 *
 * Stalo se 19. 8. 2026: majiteli se při otevření ukázalo „Nepodařilo se
 * načíst podněty: JWT issued at future" a aplikace ho nechala tu hlášku
 * luštit. Uložený token měl vadný časový údaj (hodiny počítače proti
 * serveru přitom šly správně — vada byla jen v tokenu z dřívějška);
 * jediná náprava je token zahodit a přihlásit se znovu. To má udělat
 * aplikace sama, ne majitel podle kryptické věty.
 */
export function jeChybaTokenu(zprava: string): boolean {
  const z = zprava.toLowerCase();
  return (
    z.includes("jwt") ||
    z.includes("token") ||
    z.includes("not authenticated") ||
    z.includes("refresh_token")
  );
}

/**
 * Zahodí vadné přihlášení. `scope: "local"` schválně — maže se jen tenhle
 * prohlížeč; odhlašovat majitele všude kvůli vadnému tokenu tady netřeba.
 */
export async function odhlasVadnePrihlaseni(): Promise<void> {
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
}
