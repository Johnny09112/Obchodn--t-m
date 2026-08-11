/**
 * Co se dá vyčíst z pracovních inzerátů úřadu práce.
 *
 * **Proč zrovna odsud:** SPEC kap. 5.3 pracovní inzeráty pro sběr výslovně
 * povoluje — jako jedinou výjimku ze zákazů kap. 5.2 — a jmenuje je
 * „nejlepším zdrojem informací o směnném provozu a benefitech". Údaj tam
 * vyplnil sám zaměstnavatel a úřad ho zveřejnil, takže se nic nehádá
 * a nic neodhaduje (TP-2).
 *
 * **Do zprávy se nic z toho nedostane** — kap. 5.3 to zakazuje výslovně,
 * ani obsahem, ani narážkou. Whitelist to hlídá příznakem `do_zpravy`.
 *
 * Tenhle modul je čistý: nic nezapisuje, jen překládá data na položky
 * k zápisu. Testuje se proto bez databáze.
 */

/** Číselník `Smennost/*` z otevřených dat, přeložený do češtiny. */
export const SMENNOST_TEXT: Record<string, string> = {
  "Smennost/jednoSm": "jednosměnný provoz",
  "Smennost/dvouSm": "dvousměnný provoz",
  "Smennost/triSm": "třísměnný provoz",
  "Smennost/ctyrSm": "čtyřsměnný provoz",
  "Smennost/nepretrzity": "nepřetržitý provoz",
  "Smennost/turnus": "turnusový provoz",
  "Smennost/deleneSm": "dělené směny",
  "Smennost/nocni": "noční provoz",
  "Smennost/pruznaPd": "pružná pracovní doba",
};

/**
 * `Smennost/neurceno` schválně **není** v překladu: zapsat „neurčeno" jako
 * nález by byla nula tvářící se jako údaj. Kdo ho uvádí, je pro nás stejný
 * jako ten, kdo neuvádí nic.
 */
const NEURCENO = "Smennost/neurceno";

export interface PrevazujiciSmennost {
  kod: string;
  text: string;
  /** Kolik inzerátů firmy tenhle režim uvádí. */
  inzeratu: number;
  /** Kolik inzerátů uvádí nějaký určený režim celkem. */
  zCelkem: number;
}

/**
 * Který režim u firmy převažuje.
 *
 * Firma může mít inzerát na jednosměnnou administrativu i na třísměnnou
 * výrobu. Bereme nejčastější — a v citaci se přizná, z kolika inzerátů to
 * je, ať je při schvalování vidět, jak silný ten údaj je.
 *
 * Při shodě počtů vyhraje abecedně první kód, aby byl výsledek
 * deterministický. Náhodné pořadí by znamenalo, že tentýž vstup dá jednou
 * „dvousměnný" a podruhé „třísměnný" — a to je přesně ten druh nestability,
 * kterou v evidenci nechceme.
 */
export function prevazujiciSmennost(
  pocty: Record<string, number>,
): PrevazujiciSmennost | null {
  const urcene = Object.entries(pocty).filter(
    ([kod, n]) => kod !== NEURCENO && n > 0 && SMENNOST_TEXT[kod],
  );
  if (urcene.length === 0) return null;

  const zCelkem = urcene.reduce((s, [, n]) => s + n, 0);
  urcene.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [kod, inzeratu] = urcene[0]!;
  return { kod, text: SMENNOST_TEXT[kod]!, inzeratu, zCelkem };
}

/** Položka k zápisu do evidence — přesně to, co chce `zapisAtribut`. */
export interface UdajZInzeratu {
  atribut: string;
  hodnota: string;
  citace: string;
}

export interface ZdrojInzeratu {
  smennost: Record<string, number>;
  stravovani: string | null;
}

/**
 * Co z inzerátů firmy vyplývá. Prázdné pole znamená „inzeráty o tom nic
 * neříkají" — a to je správný výsledek, ne selhání.
 */
export function udajeZInzeratu(z: ZdrojInzeratu): UdajZInzeratu[] {
  const udaje: UdajZInzeratu[] = [];

  const smennost = prevazujiciSmennost(z.smennost ?? {});
  if (smennost) {
    udaje.push({
      atribut: "smenny_provoz",
      hodnota: smennost.text,
      citace:
        `otevřená data MPSV: ${smennost.inzeratu} z ${smennost.zCelkem} inzerátů ` +
        `firmy uvádí v poli „směnnost“ hodnotu ${smennost.kod}`,
    });
  }

  const strava = z.stravovani?.trim();
  if (strava) {
    udaje.push({
      atribut: "zpusob_stravovani",
      hodnota: strava,
      // Tohle je doslovný text, který zaměstnavatel do inzerátu napsal sám —
      // nejsilnější druh citace, jaký u tohohle atributu můžeme mít.
      citace: `otevřená data MPSV, benefit v inzerátu na volné místo: „${strava}“`,
    });
  }

  return udaje;
}
