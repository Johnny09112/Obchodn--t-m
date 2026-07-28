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
