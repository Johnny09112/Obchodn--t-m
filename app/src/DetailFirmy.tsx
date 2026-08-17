import { useEffect, useState } from "react";
import {
  nactiDetailFirmy,
  nactiJidelny,
  POPIS_STAVU,
  POPIS_VELIKOSTI,
  type DetailFirmy as Detail,
  type EvidenceDetail,
  type Firma,
  type Jidelna,
} from "./data";
import {
  nejblizsiJidelny,
  popisVzdalenosti,
  type JidelnaVOkoli,
} from "../../src/nejblizsi-jidelny";

/** Názvy atributů česky — v evidenci jsou strojové. */
const POPIS_ATRIBUTU: Record<string, string> = {
  velikost_kategorie: "Velikost",
  zamestnanci_odhad: "Počet zaměstnanců",
  ma_vlastni_jidelnu: "Vlastní jídelna",
  zpusob_stravovani: "Způsob stravování",
  ucel_adresy: "Účel zveřejněné adresy",
  smenny_provoz: "Směnný provoz",
  obor: "Obor",
  web: "Web firmy",
  adresa: "Poloha na mapě",
};

/**
 * Co rozhoduje o tom, jestli firmu oslovit — a v jakém pořadí to majitel
 * chce vidět. Zbytek evidence se ukáže níž, mezi doklady.
 */
const ROZHODUJE = ["zpusob_stravovani", "smenny_provoz", "ma_vlastni_jidelnu"] as const;

/**
 * Záznamy, které nejsou údajem o firmě, ale stopou po naší vlastní práci.
 * `adresa` je toho případ: všech 167 zápisů jsou souřadnice z geokódování
 * („49.6855763,13.2254688“), ne adresa firmy. Mezi údaji majitele jen mátly.
 */
const TECHNICKE = new Set(["adresa"]);

/** Úroveň adresy podle SPEC — nižší číslo je lepší cíl. */
const POPIS_UROVNE: Record<number, string> = {
  1: "adresa pro nabídky",
  2: "obecná firemní adresa",
  3: "jmenná adresa osoby",
};

const TRIDA_UROVNE: Record<number, string> = {
  1: "je-hotovo",
  2: "je-jinak",
  3: "je-ceka",
};

function den(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("cs-CZ");
}

/** Zkrátí odkaz na doménu a cestu — celá URL by rozbila řádek. */
function popisOdkazu(url: string): string {
  try {
    const u = new URL(url);
    const cesta = u.pathname === "/" ? "" : u.pathname;
    return `${u.hostname.replace(/^www\./, "")}${cesta}`;
  } catch {
    return url;
  }
}

/** Odkud údaj je — pro seskupení dokladů. Rozlišuje se doménou zdroje. */
function kdeZjisteno(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.endsWith("mpsv.cz")) return "Otevřená data MPSV";
    if (host.endsWith("ares.gov.cz")) return "Veřejný rejstřík (ARES)";
    if (host.endsWith("csu.gov.cz")) return "Statistický registr ČSÚ";
    return host;
  } catch {
    return "neuvedený zdroj";
  }
}

/** Hodnota údaje česky — v evidenci jsou některé strojové (`stredni`). */
function popisHodnoty(atribut: string, hodnota: string): string {
  if (atribut === "velikost_kategorie") return POPIS_VELIKOSTI[hodnota] ?? hodnota;
  return hodnota;
}

function Doklad({ e }: { e: EvidenceDetail }) {
  return (
    <>
      {e.citace && <blockquote className="citace">„{e.citace}“</blockquote>}
      <div className="doklad-zdroj">
        <a href={e.zdroj_url} target="_blank" rel="noopener noreferrer">
          {popisOdkazu(e.zdroj_url)}
        </a>
        <span className="tise"> · {den(e.ziskano_at)}</span>
      </div>
    </>
  );
}

/**
 * Detail firmy — všechno, co o ní víme, i s doložením.
 *
 * Vyžádal si to majitel 2. 8.: „potřebuji k dohledanému kontaktu web, kde byl
 * kontakt nalezen — pro jistotu."
 *
 * **Odkaz a citace jsou u každého údaje, ne schované za rozklikáváním.**
 * Tvrdé pravidlo TP-2 je vyžaduje při zápisu; k něčemu jsou ale až tehdy,
 * když je člověk vidí, aniž by je musel hledat.
 *
 * Pořadí sekcí odsouhlasil majitel 17. 8.: čím se firma zabývá → co rozhoduje
 * o oslovení → jídelny v okolí → kudy se ozvat → odkud to víme → co nevíme.
 * Dřív byla všechna evidence v jedné řadě, kde obor podnikání vážil stejně
 * jako záznam o geokódování.
 */
export function DetailFirmy({ firma, onZavri }: { firma: Firma; onZavri: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [jidelny, setJidelny] = useState<Jidelna[] | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  useEffect(() => {
    let platne = true;
    setDetail(null);
    setChyba(null);
    Promise.all([nactiDetailFirmy(firma.ico), nactiJidelny()])
      .then(([d, j]) => {
        if (!platne) return;
        setDetail(d);
        setJidelny(j);
      })
      .catch((e: Error) => platne && setChyba(e.message));
    return () => {
      platne = false;
    };
  }, [firma.ico]);

  const obor = detail?.evidence.find((e) => e.atribut === "obor") ?? null;
  const web = detail?.evidence.find((e) => e.atribut === "web") ?? null;

  // Doklady, které nepatří nahoru: technické stopy a to, co už je vidět výš.
  const zbytek = (detail?.evidence ?? []).filter(
    (e) => e.atribut !== "obor" && e.atribut !== "web",
  );

  const okoli: JidelnaVOkoli[] = jidelny ? nejblizsiJidelny(firma, jidelny) : [];
  const znamePolohu = firma.lat !== null && firma.lng !== null;

  const chybi = [
    ...ROZHODUJE.filter((kod) => !detail?.evidence.some((e) => e.atribut === kod)),
    ...(obor ? [] : ["obor"]),
    ...(web ? [] : ["web"]),
  ];

  const stav = POPIS_STAVU[firma.stav] ?? { popis: firma.stav, trida: "je-jinak" };

  return (
    <div className="zaclona" role="dialog" aria-modal="true" aria-label={`Detail firmy ${firma.nazev}`}>
      <div className="dialog detail-firmy">
        <div className="hlava-panelu">
          <div>
            <h3>{firma.nazev}</h3>
            <div className="radek-udaju">
              <span>IČO {firma.ico}</span>
              <span>· {firma.obec ?? "obec neznámá"}</span>
              <span>
                ·{" "}
                {firma.velikost_kategorie
                  ? (POPIS_VELIKOSTI[firma.velikost_kategorie] ?? firma.velikost_kategorie)
                  : "velikost neznámá"}
              </span>
              <span>· skóre {firma.skore ?? "—"}</span>
            </div>
          </div>
          <span className={`stav ${stav.trida}`}>
            <span className="znak" aria-hidden="true" />
            {stav.popis}
          </span>
          <button className="zavrit" onClick={onZavri} aria-label="Zavřít detail">
            ✕
          </button>
        </div>

        <p className="poznamka odkazy-firmy">
          {web && (
            <>
              <a href={web.hodnota} target="_blank" rel="noopener noreferrer">
                {popisOdkazu(web.hodnota)}
              </a>
              {" · "}
            </>
          )}
          <a
            href={`https://ares.gov.cz/ekonomicke-subjekty/${firma.ico}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Otevřít v ARESu
          </a>
        </p>

        {chyba && (
          <p className="hlaska" role="alert">
            Detail se nepodařilo načíst: {chyba}
          </p>
        )}
        {!detail && !chyba && <p className="nacitani">Načítám, co o firmě víme…</p>}

        {detail && (
          <>
            <h4>Čím se zabývá</h4>
            {obor ? (
              <>
                <p className="obor">{obor.hodnota}</p>
                <Doklad e={obor} />
              </>
            ) : (
              <p className="poznamka">
                {firma.obohaceno_at
                  ? "Zatím nevíme — agent obor nedohledal."
                  : "Zatím nevíme — rešerše u téhle firmy ještě neproběhla."}
              </p>
            )}

            <h4>Co rozhoduje o oslovení</h4>
            <div className="rozhoduje">
              {ROZHODUJE.map((kod) => {
                const e = detail.evidence.find((x) => x.atribut === kod);
                return (
                  <div key={kod} className={`polozka${e ? "" : " nevime"}`}>
                    <span className="co">{POPIS_ATRIBUTU[kod] ?? kod}</span>
                    <span className="jak">{e ? e.hodnota : "nevíme"}</span>
                    <span className="odkud">
                      {e ? `${kdeZjisteno(e.zdroj_url)} · ${den(e.ziskano_at)}` : "nedoloženo"}
                    </span>
                  </div>
                );
              })}
            </div>

            <h4>Jídelny v okolí</h4>
            {!znamePolohu ? (
              <p className="poznamka">
                Vzdálenost spočítat nejde — u firmy neznáme polohu. Není to
                totéž co „žádná jídelna v okolí".
              </p>
            ) : okoli.length === 0 ? (
              <p className="poznamka">V okolí 50 km není žádná jídelna.</p>
            ) : (
              <ul className="jidelny-okoli">
                {okoli.map((j) => (
                  <li key={j.id}>
                    <span className="kde">
                      {j.nazev}
                      {j.obec && j.obec !== j.nazev && <span className="tise"> · {j.obec}</span>}
                    </span>
                    <span className="jak-daleko">{popisVzdalenosti(j.metru)}</span>
                    <span className={`stitek ${j.stav === "v_provozu" ? "" : "je-ceka"}`}>
                      {j.stav === "v_provozu" ? "v provozu" : "příprava"}
                    </span>
                    {j.vZone && <span className="stitek je-hotovo">v zóně</span>}
                  </li>
                ))}
              </ul>
            )}

            <h4>Kudy se ozvat</h4>
            {detail.kontakty.length === 0 ? (
              <p className="poznamka">
                Zatím žádný kontakt. Není to chyba — co není doložené, se
                nezapisuje.
              </p>
            ) : (
              <ul className="seznam-dokladu">
                {detail.kontakty.map((k) => (
                  <li key={k.id}>
                    <div className="doklad-hlava">
                      <strong>
                        {[k.jmeno, k.prijmeni].filter(Boolean).join(" ") || "bez jména"}
                      </strong>
                      {k.pozice && <span className="tise"> · {k.pozice}</span>}
                      {k.uroven_adresy != null && (
                        <span className={`stitek ${TRIDA_UROVNE[k.uroven_adresy] ?? ""}`}>
                          {POPIS_UROVNE[k.uroven_adresy] ?? `úroveň ${k.uroven_adresy}`}
                        </span>
                      )}
                    </div>

                    <div className="doklad-spojeni">
                      {k.email ? <a href={`mailto:${k.email}`}>{k.email}</a> : null}
                      {k.telefon ? <span className="telefon">{k.telefon}</span> : null}
                      {!k.email && !k.telefon && (
                        <span className="tise">jen jméno, adresa ani telefon nejsou</span>
                      )}
                    </div>

                    {k.citace && <blockquote className="citace">„{k.citace}“</blockquote>}

                    <div className="doklad-zdroj">
                      {k.zdroj_url ? (
                        <a href={k.zdroj_url} target="_blank" rel="noopener noreferrer">
                          {popisOdkazu(k.zdroj_url)}
                        </a>
                      ) : (
                        <span className="tise">zdroj neuveden</span>
                      )}
                      <span className="tise"> · {den(k.ziskano_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h4>Odkud to víme</h4>
            {zbytek.length === 0 ? (
              <p className="poznamka">Zatím nic dalšího.</p>
            ) : (
              <ul className="seznam-dokladu">
                {zbytek.map((e) => (
                  <li key={e.id} className={TECHNICKE.has(e.atribut) ? "technicky" : undefined}>
                    <div className="doklad-hlava">
                      <strong>{POPIS_ATRIBUTU[e.atribut] ?? e.atribut}</strong>
                      <span className="tise"> · {popisHodnoty(e.atribut, e.hodnota)}</span>
                      {TECHNICKE.has(e.atribut) && (
                        <span className="stitek">naše práce, ne údaj o firmě</span>
                      )}
                    </div>
                    <Doklad e={e} />
                  </li>
                ))}
              </ul>
            )}

            <h4>Co ještě nevíme</h4>
            {chybi.length === 0 ? (
              <p className="poznamka">Nic z toho, co agent hledá, nechybí.</p>
            ) : (
              <div className="chybi">
                {chybiSeznam(chybi).map((popis) => (
                  <span key={popis} className="stitek">
                    {popis}
                  </span>
                ))}
              </div>
            )}
            <p className="poznamka">
              {firma.obohaceno_at
                ? `Rešerše naposledy ${den(firma.obohaceno_at)}.`
                : "Rešerše u téhle firmy ještě neproběhla."}
            </p>
          </>
        )}

        <div className="tlacitka vlevo">
          <button className="tlacitko tise" onClick={onZavri}>
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}

/** Strojové kódy na česká jména; pořadí zachovává. */
function chybiSeznam(kody: readonly string[]): string[] {
  return kody.map((k) => POPIS_ATRIBUTU[k] ?? k);
}
