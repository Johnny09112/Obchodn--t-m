/**
 * Odesílání zpráv — fáze 3.
 *
 * **Souhlas majitele s otevřením fáze 3 padl 20. 8. 2026**, a byl to souhlas
 * se stavbou, ne s odesíláním: `system_state.sending_enabled` přepíná jedině
 * člověk (TP-8) a tenhle modul ho nikdy nemění.
 *
 * Zatím umí jen **zkušební odeslání na vlastní adresu** — majitelův požadavek
 * („nejprve fake tvorby na jeden/dva moje účty, ať vím, jak to vypadá").
 * Ostré odesílání přijde jako druhý krok.
 *
 * Odesílání samo je za rozhraním `Odesilatel`, stejně jako práce agenta za
 * `Enricher`. Testy tudy strkají falešného odesílatele, takže se dá ověřit
 * celá cesta bez jediného skutečně odeslaného mailu.
 */
import type { Db } from "./db.js";
import { firmyKOsloveni, slozZpravu } from "./zprava.js";

export interface OdeslanaZprava {
  komu: string;
  predmet: string;
  telo: string;
}

export interface Odesilatel {
  posli(zprava: OdeslanaZprava): Promise<{ providerId: string }>;
}

export interface OdeslaniDeps {
  db: Db;
  odesilatel: Odesilatel;
}

export interface VysledekOdeslani {
  odeslano: number;
  /** Firmy, kterým něco chybí — do kampaně se nedostanou. */
  preskocene: Array<{ ico: string; nazev: string; chybi: string[] }>;
  /** Firmy, u kterých odesílání selhalo. Zpráva se nezapsala jako odeslaná. */
  selhalo: Array<{ ico: string; duvod: string }>;
  /** Kolik připravených firem zbylo nad denní limit. */
  zbyva: number;
}

/**
 * Předmět zkušební zprávy.
 *
 * Do předmětu — ne do těla. Tělo musí zůstat přesně to, co by dostala firma;
 * kdyby se do něj přimíchalo označení zkoušky, majitel by si prohlížel něco
 * jiného, než co se doopravdy posílá. V doručené poště přitom musí být na
 * první pohled poznat, že jde o zkoušku a pro koho byla.
 */
export function predmetZkousky(predmet: string, nazevFirmy: string): string {
  return `[ZKOUŠKA · ${nazevFirmy}] ${predmet}`;
}

/**
 * Rozešle zprávy kampaně na zkušební adresu.
 *
 * Nezapisuje firmám oslovení (TP-5) a nemění jejich stav — zkouška nesmí
 * spálit firmě její jediné oslovení. Pojistky proti tomu, aby zkouška odešla
 * skutečné firmě, drží databáze (migrace 0058); tenhle kód je jen nesmí
 * obcházet.
 */
export async function odesliZkusebne(
  deps: OdeslaniDeps,
  vstup: { kampanId: string; limit?: number },
): Promise<VysledekOdeslani> {
  const { db, odesilatel } = deps;

  const [stav] = await db.query<{ zkusebni_prijemce: string | null; denni_limit: number }>(
    "select zkusebni_prijemce, denni_limit from system_state where id",
  );
  const prijemce = stav?.zkusebni_prijemce?.trim();
  if (!prijemce) {
    throw new Error(
      "Není kam poslat zkoušku — v nastavení chybí zkušební adresa. Doplňte ji a zkuste to znovu.",
    );
  }

  const strop = Math.min(vstup.limit ?? stav!.denni_limit, stav!.denni_limit);
  const { pripravene, vyrazene } = await firmyKOsloveni(db, vstup.kampanId);

  const vysledek: VysledekOdeslani = {
    odeslano: 0,
    preskocene: vyrazene.map((f) => ({ ico: f.ico, nazev: f.nazev, chybi: f.chybi })),
    selhalo: [],
    zbyva: Math.max(0, pripravene.length - strop),
  };

  for (const firma of pripravene.slice(0, strop)) {
    const nahled = await slozZpravu(db, vstup.kampanId, firma.ico);
    // Pojistka pro případ, že by se seznam připravených a náhled rozešly.
    if (nahled.chybi.length > 0) {
      vysledek.preskocene.push({ ico: firma.ico, nazev: firma.nazev, chybi: nahled.chybi });
      continue;
    }

    let providerId: string;
    try {
      const odpoved = await odesilatel.posli({
        komu: prijemce,
        predmet: predmetZkousky(nahled.predmet, firma.nazev),
        telo: nahled.telo,
      });
      providerId = odpoved.providerId;
    } catch (e) {
      // Zápis „odesláno" se dělá až po úspěchu. Kdyby se zapisovalo dopředu,
      // po výpadku pošty by v databázi stály zprávy, které nikdy neodešly.
      vysledek.selhalo.push({ ico: firma.ico, duvod: (e as Error).message });
      continue;
    }

    await db.query(
      `insert into messages
         (contact_id, ico, template_id, kanal, finalni_text, prijemce, zkusebni,
          odeslano_at, provider_id, stav)
       select k.id, $1, kam.template_id, 'email', $2, $3, true, now(), $4, 'odeslano'
         from contacts k
         join kampane kam on kam.id = $5
        where k.ico = $1 and k.email is not null and k.email <> ''
        order by (k.prijmeni is null)
        limit 1`,
      [firma.ico, nahled.telo, prijemce, providerId, vstup.kampanId],
    );
    vysledek.odeslano += 1;
  }

  return vysledek;
}
