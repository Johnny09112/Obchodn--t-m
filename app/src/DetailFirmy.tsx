import { useEffect, useState } from "react";
import { nactiDetailFirmy, POPIS_VELIKOSTI, type DetailFirmy as Detail, type Firma } from "./data";

/** Názvy atributů česky — v evidenci jsou strojové. */
const POPIS_ATRIBUTU: Record<string, string> = {
  velikost_kategorie: "Velikost",
  zamestnanci_odhad: "Počet zaměstnanců",
  ma_vlastni_jidelnu: "Vlastní jídelna",
  zpusob_stravovani: "Způsob stravování",
  ucel_adresy: "Účel zveřejněné adresy",
  obor: "Obor",
  adresa: "Adresa",
};

/** Úroveň adresy podle SPEC — nižší číslo je lepší cíl. */
const POPIS_UROVNE: Record<number, string> = {
  1: "adresa pro nabídky",
  2: "obecná firemní adresa",
  3: "jmenná adresa osoby",
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

/**
 * Detail firmy — všechno, co o ní víme, i s doložením.
 *
 * Vyžádal si to majitel 2. 8.: „potřebuji k dohledanému kontaktu web, kde byl
 * kontakt nalezen — pro jistotu."
 *
 * **Odkaz a citace jsou u každého údaje, ne schované za rozklikáváním.**
 * Tvrdé pravidlo TP-2 je vyžaduje při zápisu; k něčemu jsou ale až tehdy,
 * když je člověk vidí, aniž by je musel hledat.
 */
export function DetailFirmy({ firma, onZavri }: { firma: Firma; onZavri: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  useEffect(() => {
    let platne = true;
    setDetail(null);
    setChyba(null);
    nactiDetailFirmy(firma.ico)
      .then((d) => platne && setDetail(d))
      .catch((e: Error) => platne && setChyba(e.message));
    return () => {
      platne = false;
    };
  }, [firma.ico]);

  return (
    <div className="zaclona" role="dialog" aria-modal="true" aria-label={`Detail firmy ${firma.nazev}`}>
      <div className="dialog detail-firmy">
        <div className="hlava-panelu">
          <h3>{firma.nazev}</h3>
          <button className="zavrit" onClick={onZavri} aria-label="Zavřít detail">
            ✕
          </button>
        </div>

        <div className="udaje-firmy">
          <p className="udaj">
            <span className="popisek">IČO</span>
            <span className="hodnota">{firma.ico}</span>
          </p>
          <p className="udaj">
            <span className="popisek">Obec</span>
            <span className="hodnota">{firma.obec ?? "—"}</span>
          </p>
          <p className="udaj">
            <span className="popisek">Velikost</span>
            <span className="hodnota">
              {firma.velikost_kategorie
                ? (POPIS_VELIKOSTI[firma.velikost_kategorie] ?? firma.velikost_kategorie)
                : "neznámá"}
            </span>
          </p>
          <p className="udaj">
            <span className="popisek">Skóre</span>
            <span className="hodnota">{firma.skore ?? "—"}</span>
          </p>
        </div>

        <p className="poznamka">
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
            <h4>Kontakty</h4>
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
                        <span className="stitek">
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

            <h4>Co jsme dohledali</h4>
            {detail.evidence.length === 0 ? (
              <p className="poznamka">Zatím nic dalšího.</p>
            ) : (
              <ul className="seznam-dokladu">
                {detail.evidence.map((e) => (
                  <li key={e.id}>
                    <div className="doklad-hlava">
                      <strong>{POPIS_ATRIBUTU[e.atribut] ?? e.atribut}</strong>
                      <span className="tise"> · {e.hodnota}</span>
                    </div>
                    <blockquote className="citace">„{e.citace}“</blockquote>
                    <div className="doklad-zdroj">
                      <a href={e.zdroj_url} target="_blank" rel="noopener noreferrer">
                        {popisOdkazu(e.zdroj_url)}
                      </a>
                      <span className="tise"> · {den(e.ziskano_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
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
