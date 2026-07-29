import { useMemo, useState } from "react";
import {
  maSpojeni,
  POPIS_STAVU,
  POPIS_VELIKOSTI,
  VELIKOSTI,
  type Firma,
  type Kategorie,
} from "./data";

interface Props {
  firmy: Firma[];
  kategorie: Kategorie[];
  nadpis: string;
  /** Kolik firem se do mapy vůbec nedostane, protože nemá souřadnice. */
  bezSouradnic?: number;
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

export function SeznamFirem({ firmy, kategorie, nadpis, bezSouradnic = 0 }: Props) {
  const [hledani, setHledani] = useState("");
  const [velikost, setVelikost] = useState("");
  const [obor, setObor] = useState("");
  const [spojeni, setSpojeni] = useState("");

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
      if (!q) return true;
      return (
        f.nazev.toLocaleLowerCase("cs").includes(q) ||
        (f.obec ?? "").toLocaleLowerCase("cs").includes(q) ||
        f.ico.includes(q)
      );
    });
  }, [firmy, hledani, velikost, obor, spojeni]);

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

  const filtrujeSe = !!(hledani || velikost || obor || spojeni);

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
              </tr>
            </thead>
            <tbody>
              {videt.map((f) => (
                <tr key={f.ico}>
                  <td>{f.nazev}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
