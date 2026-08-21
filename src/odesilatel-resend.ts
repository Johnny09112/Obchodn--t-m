/**
 * Napojení na Resend — jediné místo, které doopravdy odesílá.
 *
 * Zbytek systému zná jen rozhraní `Odesilatel` (src/odeslani.ts), takže se
 * testy dají prohnat celou cestou bez jediného skutečně odeslaného mailu.
 *
 * **Odesílá se z adresy přihlášeného uživatele** — rozhodnutí majitele
 * ze 17. 8. 2026, potvrzené 20. 8.: `jméno@cantinero.cz`, žádná podsložka.
 * V Resendu se ověřuje doména, ne jednotlivé adresy, takže nový člověk
 * nepotřebuje žádné další nastavování.
 *
 * **Nikdy se to nesmí volat z prohlížeče.** Resend API schválně nepodporuje
 * CORS, aby si nikdo neodnesl klíč ze stránky. Odesílá se z příkazové řádky,
 * ne z aplikace.
 */
import { Resend } from "resend";
import type { Odesilatel, OdeslanaZprava } from "./odeslani.js";

/** Jen ta část Resendu, kterou potřebujeme — díky tomu jde podstrčit v testu. */
export interface ResendKlient {
  emails: {
    send(
      payload: {
        from: string;
        to: string[];
        subject: string;
        text: string;
        replyTo?: string;
      },
      opts?: { idempotencyKey?: string },
    ): Promise<{ data?: { id: string } | null; error?: { message: string } | null }>;
  };
}

export function resendKlient(apiKey: string): ResendKlient {
  return new Resend(apiKey) as unknown as ResendKlient;
}

export function resendOdesilatel(v: {
  klient: ResendKlient;
  /** Odesílatel, klidně ve tvaru „Jan Laub <laub@cantinero.cz>". */
  od: string;
  /** Kam mají chodit odpovědi, když to není adresa odesílatele. */
  odpovedNa?: string;
}): Odesilatel {
  return {
    async posli(zprava: OdeslanaZprava) {
      const { data, error } = await v.klient.emails.send(
        {
          from: v.od,
          to: [zprava.komu],
          subject: zprava.predmet,
          // Prostý text, ne HTML: SPEC kap. 6 chce zprávu, která vypadá jako
          // od člověka, ne jako z rozesílače.
          text: zprava.telo,
          ...(v.odpovedNa && v.odpovedNa !== v.od ? { replyTo: v.odpovedNa } : {}),
        },
        // Kdyby se odeslání opakovalo po výpadku sítě, Resend podle klíče
        // pozná, že tuhle zprávu už zpracoval. U pravidla „jedna firma =
        // jedno oslovení" (TP-5) je to druhá vrstva pojistky vedle databáze.
        { idempotencyKey: zprava.klic },
      );

      // Pozor: SDK Resendu **výjimky nevyhazuje** — chybu vrací v odpovědi.
      // `try/catch` by ji minul a zpráva by se tvářila jako odeslaná.
      if (error) throw new Error(`Resend odmítl zprávu: ${error.message}`);
      if (!data?.id) throw new Error("Resend nevrátil identifikátor zprávy — nevíme, jestli odešla.");

      return { providerId: data.id };
    },
  };
}
