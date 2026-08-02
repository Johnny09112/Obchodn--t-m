import { cesky } from "../../src/cestina";

/** Složení firem podle velikosti — čísla, ne podíly. */
export interface Slozeni {
  firem: number;
  mikro: number;
  stredni: number;
  korporat: number;
  bez_velikosti: number;
}

/**
 * Proužek se složením firem v území.
 *
 * Vyžádal si ho majitel 2. 8.: z holého čísla „12 762 firem" se nedá poznat,
 * jestli je území použitelné, nebo je to hromada živnostníků. Cílový segment
 * (25–249 lidí) bývá kolem pěti procent, takže se musí být vidět i tehdy,
 * když je proužek tenký — proto má každý díl minimální šířku.
 *
 * **Díl „nevíme" není chyba ani nula.** Registr u poloviny firem velikost
 * neuvádí a právě tenhle díl říká, kolik práce v území ještě zbývá.
 */
export function ProuzekSlozeni({ s, kompaktni = false }: { s: Slozeni; kompaktni?: boolean }) {
  if (s.firem === 0) {
    return <p className="poznamka">Zatím tu není žádná firma.</p>;
  }

  const dily = [
    { klic: "korporat", popis: "250 a víc", pocet: s.korporat },
    { klic: "stredni", popis: "25–249", pocet: s.stredni },
    { klic: "mikro", popis: "1–24", pocet: s.mikro },
    { klic: "nevime", popis: "velikost neznámá", pocet: s.bez_velikosti },
  ].filter((d) => d.pocet > 0);

  const cilovych = s.stredni + s.korporat;

  return (
    <div className={`slozeni ${kompaktni ? "kompaktni" : ""}`}>
      <div
        className="slozeni-pruh"
        role="img"
        aria-label={
          `Z ${s.firem} firem je ${cilovych} v cílové velikosti, ` +
          `${s.mikro} malých a u ${s.bez_velikosti} velikost neznáme.`
        }
      >
        {dily.map((d) => (
          <i
            key={d.klic}
            className={`dil je-${d.klic}`}
            style={{ flexGrow: d.pocet }}
            title={`${d.popis}: ${d.pocet.toLocaleString("cs")}`}
          />
        ))}
      </div>

      {!kompaktni && (
        <ul className="slozeni-legenda">
          {dily.map((d) => (
            <li key={d.klic}>
              <i className={`dil je-${d.klic}`} aria-hidden="true" />
              <span className="popis">{d.popis}</span>
              <span className="pocet">{d.pocet.toLocaleString("cs")}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="poznamka">
        {cilovych > 0 ? (
          <>
            <strong>
              {cilovych.toLocaleString("cs")}{" "}
              {cesky(cilovych, "firma", "firmy", "firem")} v cílové velikosti
            </strong>{" "}
            z {s.firem.toLocaleString("cs")}.
          </>
        ) : (
          <>Žádná firma v cílové velikosti (25 a víc zaměstnanců).</>
        )}
        {s.bez_velikosti > 0 && (
          <>
            {" "}
            U {s.bez_velikosti.toLocaleString("cs")} firem registr velikost
            neuvádí — můžou tam být další.
          </>
        )}
      </p>
    </div>
  );
}
