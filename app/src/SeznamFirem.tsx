import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DetailFirmy } from "./DetailFirmy";
import {
  maSpojeni,
  POPIS_STAVU,
  POPIS_VELIKOSTI,
  stavReserse,
  VELIKOSTI,
  type Firma,
  type Kategorie,
  type StavReserse,
} from "./data";

interface Props {
  firmy: Firma[];
  kategorie: Kategorie[];
  nadpis: string;
  /** Kolik firem se do mapy vůbec nedostane, protože nemá souřadnice. */
  bezSouradnic?: number;
  /**
   * Poslední sloupec navíc — používá ho seznam firem v kampani, aby šlo
   * firmu rovnou vyřadit. Bez toho by kampaň potřebovala vlastní tabulku
   * a přišla by o filtry a hledání, které tenhle seznam už umí.
   */
  akce?: (f: Firma) => ReactNode;
  /** Nadpis sloupce s akcí. */
  popisAkce?: string;
}

function Stav({ stav }: { stav: string }) {
  const s = POPIS_STAVU[stav] ?? { popis: stav, trida: "je-jinak" };
  return (
    <span className={`stav ${s.trida}`}>
      <span className="znak" aria-hidden="true" />
      {s.popis}
    </span>
  );
}

/** Datum pro `title` — jen na najetí myší, vlastní sloupec by tabulku roztáhl. */
function den(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("cs-CZ");
}

const POPIS_RESERSE: Record<StavReserse, { popis: string; trida: string }> = {
  neprosla: { popis: "neprošla", trida: "" },
  prosla_se_spojenim: { popis: "prošla · spojení", trida: "je-hotovo" },
  prosla_bez_spojeni: { popis: "prošla · bez stopy", trida: "je-zamitnuty" },
};

function Reserse({ f }: { f: Firma }) {
  const s = stavReserse({ obohaceno_at: f.obohaceno_at, maSpojeni: maSpojeni(f) });
  const p = POPIS_RESERSE[s];
  return (
    <span
      className={`stav ${p.trida}`.trim()}
      title={f.obohaceno_at ? `Naposledy prošla rešerší ${den(f.obohaceno_at)}` : undefined}
    >
      <span className="znak" aria-hidden="true" />
      {p.popis}
    </span>
  );
}

export function SeznamFirem({
  firmy,
  kategorie,
  nadpis,
  bezSouradnic = 0,
  akce,
  popisAkce = "",
}: Props) {
  const [hledani, setHledani] = useState("");
  /** Firma otevřená v detailu — tam jsou u údajů vidět zdroje a citace. */
  const [detail, setDetail] = useState<Firma | null>(null);
  const [velikost, setVelikost] = useState("");
  const [obor, setObor] = useState("");
  const [spojeni, setSpojeni] = useState("");
  const [reserse, setReserse] = useState<StavReserse | "">("");
  /**
   * Kolik řádků na stránku. Výchozích sto: třináct tisíc řádků naráz
   * prohlížeč vykresluje vteřiny a stejně je nikdo nepřečte.
   */
  const [naStranku, setNaStranku] = useState(100);
  const [stranka, setStranka] = useState(0);

  const nazvyKategorii = useMemo(
    () => new Map(kategorie.map((k) => [k.kod, k.nazev])),
    [kategorie],
  );

  const videt = useMemo(() => {
    const q = hledani.trim().toLocaleLowerCase("cs");
    return firmy.filter((f) => {
      if (velikost && f.velikost_kategorie !== velikost) return false;
      if (obor && f.kategorie !== obor) return false;
      if (spojeni === "ma" && !maSpojeni(f)) return false;
      if (spojeni === "nema" && maSpojeni(f)) return false;
      if (reserse && stavReserse({ obohaceno_at: f.obohaceno_at, maSpojeni: maSpojeni(f) }) !== reserse) {
        return false;
      }
      if (!q) return true;
      return (
        f.nazev.toLocaleLowerCase("cs").includes(q) ||
        (f.obec ?? "").toLocaleLowerCase("cs").includes(q) ||
        f.ico.includes(q)
      );
    });
  }, [firmy, hledani, velikost, obor, spojeni, reserse]);

  const souhrn = useMemo(() => {
    const sOdhadem = videt.filter((f) => f.zamestnanci_odhad !== null);
    return {
      firem: videt.length,
      seSpojenim: videt.filter(maSpojeni).length,
      // Součet přes samá prázdná pole by dal nulu a ta by se tvářila jako
      // změřený údaj. Dokud počty nikdo nezná, patří sem „neznámé".
      zamestnancu: sOdhadem.length
        ? sOdhadem.reduce((s, f) => s + (f.zamestnanci_odhad ?? 0), 0).toLocaleString("cs")
        : "neznámé",
      obci: new Set(videt.map((f) => f.obec).filter(Boolean)).size,
    };
  }, [videt]);

  const filtrujeSe = !!(hledani || velikost || obor || spojeni || reserse);

  // Po změně filtru se vrať na začátek — jinak člověk kouká na prázdno,
  // protože stojí na patnácté stránce výběru, který má dvě.
  useEffect(() => {
    setStranka(0);
  }, [hledani, velikost, obor, spojeni, reserse, naStranku]);

  const stranek = naStranku > 0 ? Math.max(1, Math.ceil(videt.length / naStranku)) : 1;
  const kde = Math.min(stranka, stranek - 1);
  const naStrance = useMemo(
    () => (naStranku > 0 ? videt.slice(kde * naStranku, (kde + 1) * naStranku) : videt),
    [videt, kde, naStranku],
  );

  return (
    <section className="seznam-firem">
      <h2>{nadpis}</h2>

      <div className="souhrn">
        <p className="udaj">
          <span className="popisek">Firem</span>
          <span className="hodnota">{souhrn.firem}</span>
        </p>
        <p className="udaj">
          <span className="popisek">Se spojením</span>
          <span className="hodnota">{souhrn.seSpojenim}</span>
        </p>
        <p className="udaj">
          <span className="popisek">Zaměstnanců</span>
          <span className="hodnota">{souhrn.zamestnancu}</span>
        </p>
        <p className="udaj">
          <span className="popisek">Obcí</span>
          <span className="hodnota">{souhrn.obci}</span>
        </p>
      </div>

      <div className="filtry">
        <label className="pole">
          <span>Hledat</span>
          <input
            type="search"
            value={hledani}
            onChange={(e) => setHledani(e.target.value)}
            placeholder="název, obec nebo IČO"
          />
        </label>
        <label className="pole">
          <span>Velikost</span>
          <select value={velikost} onChange={(e) => setVelikost(e.target.value)}>
            <option value="">všechny</option>
            {VELIKOSTI.map((v) => (
              <option key={v} value={v}>
                {POPIS_VELIKOSTI[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="pole">
          <span>Zaměření</span>
          <select value={obor} onChange={(e) => setObor(e.target.value)}>
            <option value="">všechna</option>
            {kategorie.map((k) => (
              <option key={k.kod} value={k.kod}>
                {k.nazev}
              </option>
            ))}
          </select>
        </label>
        <label className="pole">
          <span>Spojení</span>
          <select value={spojeni} onChange={(e) => setSpojeni(e.target.value)}>
            <option value="">nerozhoduje</option>
            <option value="ma">máme kontakt</option>
            <option value="nema">chybí kontakt</option>
          </select>
        </label>
        <label className="pole">
          <span>Rešerše</span>
          <select
            value={reserse}
            onChange={(e) => setReserse(e.target.value as StavReserse | "")}
          >
            <option value="">nerozhoduje</option>
            <option value="neprosla">neprošla</option>
            <option value="prosla_se_spojenim">prošla se spojením</option>
            <option value="prosla_bez_spojeni">prošla bez spojení</option>
          </select>
        </label>
      </div>

      {bezSouradnic > 0 && (
        <p className="poznamka">
          {bezSouradnic}{" "}
          {bezSouradnic === 1 ? "firma nemá" : bezSouradnic < 5 ? "firmy nemají" : "firem nemá"}{" "}
          zaměřenou adresu, takže do žádné oblasti nespadne.
        </p>
      )}

      {videt.length === 0 ? (
        <p className="prazdno">
          {firmy.length === 0
            ? "V tomhle tvaru zatím žádná firma není. Zkuste ho roztáhnout."
            : filtrujeSe
              ? "Tomuhle výběru neodpovídá žádná firma. Zkuste ubrat filtr."
              : "Žádné firmy."}
        </p>
      ) : (
        <div className="obal-tabulky">
          <table className="tabulka">
            <thead>
              <tr>
                <th>Firma</th>
                <th>IČO</th>
                <th>Obec</th>
                <th>Zaměření</th>
                <th>Velikost</th>
                <th className="cislo">Zam.</th>
                <th className="cislo">Spojení</th>
                <th className="cislo">Skóre</th>
                <th>Stav</th>
                <th>Rešerše</th>
                {akce && <th>{popisAkce}</th>}
              </tr>
            </thead>
            <tbody>
              {naStrance.map((f) => (
                <tr key={f.ico}>
                  <td>
                    {/* Detail je jediné místo, kde jsou u údajů vidět zdroje
                        a citace — proto vede z názvu, ne z ikonky stranou. */}
                    <button className="odkaz jmeno" onClick={() => setDetail(f)}>
                      {f.nazev}
                    </button>
                  </td>
                  <td className="ico">{f.ico}</td>
                  <td>{f.obec ?? "—"}</td>
                  <td>{f.kategorie ? (nazvyKategorii.get(f.kategorie) ?? f.kategorie) : "—"}</td>
                  <td>
                    {f.velikost_kategorie
                      ? (POPIS_VELIKOSTI[f.velikost_kategorie] ?? f.velikost_kategorie)
                      : "—"}
                  </td>
                  <td className="cislo">{f.zamestnanci_odhad ?? "—"}</td>
                  <td className="cislo">{f.contacts[0]?.count ?? 0}</td>
                  <td className="cislo">{f.skore ?? "—"}</td>
                  <td>
                    <Stav stav={f.stav} />
                  </td>
                  <td>
                    <Reserse f={f} />
                  </td>
                  {akce && <td>{akce(f)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {videt.length > 0 && (
        <div className="strankovani">
          <label className="pole">
            <span>Na stránku</span>
            <select value={naStranku} onChange={(e) => setNaStranku(Number(e.target.value))}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={0}>všechny</option>
            </select>
          </label>

          <span className="rozsah">
            {naStranku > 0 ? (
              <>
                {(kde * naStranku + 1).toLocaleString("cs")}–
                {Math.min((kde + 1) * naStranku, videt.length).toLocaleString("cs")} z{" "}
                {videt.length.toLocaleString("cs")}
              </>
            ) : (
              <>všech {videt.length.toLocaleString("cs")}</>
            )}
          </span>

          {naStranku > 0 && stranek > 1 && (
            <div className="tlacitka vlevo">
              <button
                className="tlacitko tise"
                onClick={() => setStranka(kde - 1)}
                disabled={kde === 0}
              >
                ← Předchozí
              </button>
              <span className="rozsah">
                strana {kde + 1} z {stranek}
              </span>
              <button
                className="tlacitko tise"
                onClick={() => setStranka(kde + 1)}
                disabled={kde >= stranek - 1}
              >
                Další →
              </button>
            </div>
          )}
        </div>
      )}
      {detail && <DetailFirmy firma={detail} onZavri={() => setDetail(null)} />}
    </section>
  );
}
