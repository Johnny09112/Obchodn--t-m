import { useEffect, useState } from "react";
import { nactiFiremVDosahu, nactiJidelny, ulozKapacituJidelny, type Jidelna } from "./data";
import type { Role } from "./supabase";

/**
 * Jídelny a jejich volná kapacita.
 *
 * Vzniklo na vyžádání majitele (17. 8. 2026): kapacita se dala zadat jedině
 * při zakládání jídelny příkazem `seed-jidelna`, takže u 34. ZŠ Plzeň zůstala
 * prázdná a nešla doplnit. Přitom je to číslo, které rozhoduje o celém
 * obchodu — kolik obědů vůbec máme co prodat.
 *
 * Kapacita se během roku mění, proto se zadává tady a ne v příkazové řádce.
 * Měnit ji smí admin a výš (migrace 0016); ostatní ji vidí, ale neupraví.
 *
 * Kapacita **nemá vliv na sběr dat** ani na to, které firmy se najdou
 * (migrace 0006) — tvrdou podmínkou se stane až u fronty na oslovení
 * ve fázi 3.
 */

interface Props {
  role: Role;
}

/** Zóna v metrech se lidsky čte v kilometrech. */
function zona(metru: number): string {
  return `${(metru / 1000).toFixed(1).replace(".", ",")} km`;
}

export function Jidelny({ role }: Props) {
  const [jidelny, setJidelny] = useState<Jidelna[]>([]);
  const [vDosahu, setVDosahu] = useState<Record<string, number>>({});
  const [nacita, setNacita] = useState(true);
  const [chyba, setChyba] = useState<string | null>(null);
  const [ulozeno, setUlozeno] = useState<string | null>(null);
  const [pracuje, setPracuje] = useState(false);
  /** Řádek, který se právě upravuje. Text, ne číslo — prázdné pole = neuvedeno. */
  const [upravovana, setUpravovana] = useState<{ id: string; hodnota: string } | null>(null);

  const smiUpravovat = role === "admin" || role === "super-admin";

  function obnov() {
    return nactiJidelny()
      .then(async (j) => {
        setJidelny(j);
        setChyba(null);
        // Počty se dotahují až po seznamu — bez seznamu není co počítat.
        setVDosahu(await nactiFiremVDosahu(j.map((x) => x.id)));
      })
      .catch((e: Error) => setChyba(e.message));
  }

  useEffect(() => {
    obnov().finally(() => setNacita(false));
  }, []);

  async function uloz() {
    if (!upravovana) return;
    const text = upravovana.hodnota.trim();
    // Prázdné pole znamená „nevím", ne nulu. Nula by tvrdila, že jídelna
    // nemá volno — to je jiná informace a vymýšlet ji nesmíme.
    const cislo = text === "" ? null : Number(text);
    if (cislo !== null && (!Number.isInteger(cislo) || cislo < 0)) {
      setChyba("Kapacita musí být celé číslo od nuly výš, nebo prázdná (neuvedeno).");
      return;
    }
    setPracuje(true);
    try {
      await ulozKapacituJidelny(upravovana.id, cislo);
      setUpravovana(null);
      setUlozeno(upravovana.id);
      await obnov();
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setPracuje(false);
    }
  }

  if (nacita) return <p className="nacitani">Načítám jídelny…</p>;

  const znameKapacitu = jidelny.filter((j) => j.aktivni && j.kapacita_volna !== null);
  const bezKapacity = jidelny.filter((j) => j.aktivni && j.kapacita_volna === null);
  const celkem = znameKapacitu.reduce((s, j) => s + (j.kapacita_volna ?? 0), 0);

  return (
    <>
      <div className="sloupec">
        <h2>Jídelny</h2>
        <p className="podnadpis">
          Kolik obědů denně máme volných a kolik firem je od které jídelny
          v dosahu. Kapacita je jediný údaj, který se nedá zjistit z dat —
          ví ho jen partner.
        </p>

        <div className="souhrn">
          <p className="udaj">
            <span className="popisek">Volná kapacita celkem</span>
            <span className="hodnota">{celkem.toLocaleString("cs")} obědů/den</span>
          </p>
          <p className="udaj">
            <span className="popisek">Jídelen v provozu</span>
            <span className="hodnota">{jidelny.filter((j) => j.aktivni).length}</span>
          </p>
          <p className="udaj">
            <span className="popisek">Bez uvedené kapacity</span>
            <span className="hodnota">{bezKapacity.length}</span>
          </p>
        </div>

        {bezKapacity.length > 0 && (
          <p className="poznamka">
            Součet je jen z jídelen, kde kapacitu známe — {bezKapacity.length}{" "}
            {bezKapacity.length === 1 ? "jídelna ji nemá uvedenou" : "jídelen ji nemá uvedených"}
            , takže skutečné číslo bude vyšší.
          </p>
        )}

        {chyba && (
          <p className="hlaska" role="alert">
            {chyba}
          </p>
        )}
      </div>

      <div className="sloupec">
        {jidelny.length === 0 ? (
          <div className="prazdno">Zatím není založená žádná jídelna.</div>
        ) : (
          <div className="obal-tabulky">
            <table className="tabulka">
              <thead>
                <tr>
                  <th>Jídelna</th>
                  <th>Obec</th>
                  <th>Zóna</th>
                  <th className="cislo">Firem v dosahu</th>
                  <th>Volná kapacita</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {jidelny.map((j) => {
                  const upravuje = upravovana?.id === j.id;
                  return (
                    <tr key={j.id}>
                      <td>
                        {j.nazev}
                        {!j.aktivni && (
                          <span className="stav je-zamitnuty na-radek">
                            <span className="znak" />
                            mimo provoz
                          </span>
                        )}
                      </td>
                      <td>{j.obec ?? "—"}</td>
                      <td className="cislo">{zona(j.zona_metru)}</td>
                      <td className="cislo">
                        {(vDosahu[j.id] ?? 0).toLocaleString("cs")}
                      </td>
                      <td>
                        {upravuje ? (
                          <input
                            type="number"
                            min={0}
                            step={1}
                            autoFocus
                            className="kapacita-vstup"
                            value={upravovana.hodnota}
                            placeholder="neuvedeno"
                            disabled={pracuje}
                            onChange={(e) =>
                              setUpravovana({ id: j.id, hodnota: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void uloz();
                              if (e.key === "Escape") setUpravovana(null);
                            }}
                          />
                        ) : j.kapacita_volna === null ? (
                          <span className="stav je-ceka">
                            <span className="znak" />
                            neuvedeno
                          </span>
                        ) : (
                          <span className="stav je-kvalifikovany">
                            <span className="znak" />
                            {j.kapacita_volna.toLocaleString("cs")} obědů/den
                          </span>
                        )}
                        {ulozeno === j.id && !upravuje && (
                          <span className="poznamka na-radek">uloženo</span>
                        )}
                      </td>
                      <td>
                        {!smiUpravovat ? null : upravuje ? (
                          <span className="tlacitka vlevo">
                            <button className="tlacitko" disabled={pracuje} onClick={() => void uloz()}>
                              Uložit
                            </button>
                            <button
                              className="tlacitko tise"
                              disabled={pracuje}
                              onClick={() => setUpravovana(null)}
                            >
                              Zrušit
                            </button>
                          </span>
                        ) : (
                          <button
                            className="tlacitko tise"
                            disabled={pracuje}
                            onClick={() => {
                              setChyba(null);
                              setUlozeno(null);
                              setUpravovana({
                                id: j.id,
                                hodnota: j.kapacita_volna === null ? "" : String(j.kapacita_volna),
                              });
                            }}
                          >
                            Změnit kapacitu
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="poznamka">
          {smiUpravovat
            ? "Prázdné pole znamená „nevím“ — to není totéž co nula. Nula tvrdí, že jídelna nemá volno."
            : "Kapacitu mění admin. Tobě se tu ukazuje, jak je zapsaná."}{" "}
          Změna kapacity nepřeřadí ani jednu firmu — sama o sobě jen říká,
          kolik obědů je k dispozici.
        </p>
      </div>
    </>
  );
}
