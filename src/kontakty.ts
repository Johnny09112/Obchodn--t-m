/**
 * Doplnění kontaktů u firem, které v kartotéce už jsou.
 *
 * Proč to nejde běžným sběrem: `spustCmuchala` firmu, kterou už zná,
 * přeskočí — a to je správně, jinak by se při každém běhu znovu ověřovala
 * a geokódovala. Jenže když přibude nový zdroj kontaktů, k dřív posbíraným
 * firmám se nikdy nedostane. Tenhle běh tu díru zavírá.
 *
 * Pořadí zdrojů: nejdřív otevřená data MPSV (dají jméno, pozici, e-mail
 * i telefon naráz a nestojí dotaz), teprve pak statutární orgán z rejstříku
 * (jen jméno a funkce, ale skoro vždy).
 *
 * **Dva rozsahy.** Beze zadání (nebo s `jidelnaId`) se ptá na firmy v dosahové
 * zóně jídelny — tak to vzniklo a tak to zůstává. S `oblastId` bere firmy
 * v území, **bez ohledu na zónu a jídelnu**: sběr nad oblastí je zakládá ve
 * stavu „čeká na jídelnu", protože oblast smí vzniknout dřív než jídelna.
 * Bez téhle větve se k nim doplnění nikdy nedostalo a 13 600 firem nemělo
 * jediné spojení.
 *
 * Nic neodesílá a nic si nedomýšlí — firma bez doložitelného kontaktu
 * prostě zůstane bez kontaktu.
 */
import type { AresKlient } from "./ares.js";
import type { Db } from "./db.js";
import type { MpsvKlient } from "./mpsv.js";
import { ukonciBeh, zacniBeh, zapisAtribut, zapisKontakt } from "./repo.js";

export interface DoplnKontaktyDeps {
  db: Db;
  ares: AresKlient;
  /** Bez něj se doplňuje jen z rejstříku. */
  mpsv?: MpsvKlient;
}

export interface DoplnKontaktySouhrn {
  behId: string;
  zpracovano: number;
  zMpsv: number;
  zRejstriku: number;
  bezVysledku: number;
  chyby: Array<{ kdo: string; chyba: string }>;
}

const ZDROJ_MPSV = "https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json";

export async function doplnKontakty(
  deps: DoplnKontaktyDeps,
  opts: { limit?: number; jidelnaId?: string; oblastId?: string },
): Promise<DoplnKontaktySouhrn> {
  const { db } = deps;

  const podminky: string[] = [];
  const params: unknown[] = [];

  if (opts.oblastId) {
    // Sběr nad oblastí zakládá firmy **bez jídelny a bez zóny**, ve stavu
    // „čeká na jídelnu" — oblast smí vzniknout dřív než jídelna, to je celý
    // smysl obráceného postupu. Ptát se u nich na zónu by znamenalo nikdy je
    // nenajít; přesně proto mělo 13 600 firem nula spojení.
    params.push(opts.oblastId);
    podminky.push(
      `exists (select 1 from oblast_firmy of where of.ico = c.ico and of.oblast_id = $${params.length})`,
      // Zamítnutou firmu nemá smysl dohledávat — byl by to dotaz navíc
      // za výsledek, který stejně nepoužijeme.
      "c.stav <> 'zamitnuty'",
    );
  } else {
    // Beze změny: běh bez omezení se schválně nepouští do celé kartotéky,
    // to je hodina dotazů do ARESu.
    podminky.push("c.v_zone is true", "c.stav = 'kvalifikovany'");
    if (opts.jidelnaId) {
      params.push(opts.jidelnaId);
      podminky.push(`c.nejblizsi_jidelna_id = $${params.length}`);
    }
  }

  // Firmy bez JMENNÉHO kontaktu. Obecná adresa `info@` nestačí — cílem je
  // konkrétní osoba, na kterou se dá obrátit.
  const firmy = await db.query<{ ico: string; nazev: string }>(
    `select c.ico, c.nazev from companies c
     where ${podminky.join(" and ")}
       and not exists (
         select 1 from contacts k where k.ico = c.ico and k.prijmeni is not null
       )
     order by c.skore desc nulls last
     ${opts.limit ? `limit ${Number(opts.limit)}` : ""}`,
    params,
  );

  const behId = await zacniBeh(db, "doplneni-kontaktu", {
    firem: firmy.length,
    jidelnaId: opts.jidelnaId ?? null,
    oblastId: opts.oblastId ?? null,
  });

  const souhrn: DoplnKontaktySouhrn = {
    behId, zpracovano: 0, zMpsv: 0, zRejstriku: 0, bezVysledku: 0, chyby: [],
  };

  try {
    for (const f of firmy) {
      souhrn.zpracovano++;
      try {
        const zMpsv = deps.mpsv ? await deps.mpsv.kontaktZamestnavatele(f.ico) : null;

        if (zMpsv) {
          const kdo = [zMpsv.jmeno, zMpsv.prijmeni].filter(Boolean).join(" ") || "kontaktní osoba";
          await zapisKontakt(db, f.ico, {
            jmeno: zMpsv.jmeno ?? undefined,
            prijmeni: zMpsv.prijmeni ?? undefined,
            pozice: zMpsv.pozice ?? undefined,
            email: zMpsv.email ?? undefined,
            telefon: zMpsv.telefon ?? undefined,
            urovenAdresy: 3,
            zdrojUrl: ZDROJ_MPSV,
            citace:
              `otevřená data MPSV, inzerát na volné místo: kontaktní osoba ${kdo}` +
              `${zMpsv.pozice ? ` (${zMpsv.pozice})` : ""}`,
          });
          // Účel adresy se přiznává: je pro uchazeče o práci, ne pro dodavatele.
          await zapisAtribut(db, f.ico, "ucel_adresy", "zveřejněno pro uchazeče o zaměstnání", {
            zdrojUrl: ZDROJ_MPSV,
            citace:
              "otevřená data MPSV: údaj je v inzerátu na volné místo v poli " +
              "„komu se hlásit“ — je určený uchazečům o práci, ne dodavatelům",
          });
          souhrn.zMpsv++;
          continue;
        }

        const organy = (await deps.ares.najdiStatutarniOrgany(f.ico)).slice(0, 2);
        if (organy.length === 0) {
          souhrn.bezVysledku++;
          continue;
        }
        for (const clen of organy) {
          await zapisKontakt(db, f.ico, {
            jmeno: clen.jmeno,
            prijmeni: clen.prijmeni,
            pozice: clen.funkce ?? undefined,
            urovenAdresy: 3,
            zdrojUrl: `https://ares.gov.cz/ekonomicke-subjekty/${f.ico}`,
            citace:
              `veřejný rejstřík: ${clen.funkce ?? "člen statutárního orgánu"} ` +
              `${clen.jmeno} ${clen.prijmeni}`,
          });
        }
        souhrn.zRejstriku++;
      } catch (e) {
        souhrn.chyby.push({
          kdo: `${f.nazev} (${f.ico})`,
          chyba: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } finally {
    const { chyby, ...vystup } = souhrn;
    await ukonciBeh(db, behId, vystup, chyby, 0);
  }

  return souhrn;
}
