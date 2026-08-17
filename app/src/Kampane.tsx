import { useEffect, useState } from "react";
import { PruvodceKampani } from "./PruvodceKampani";
import {
  archivujKampan,
  dalsiBehZa,
  nactiKampane,
  nactiPruzkumyKampane,
  smazKampan,
  POPIS_STAVU_KAMPANE,
  type RadekKampane,
} from "./data";
import type { Role } from "./supabase";
import {
  postupPruzkumu, pruzkumDobehl, souhrnPruzkumu, type SouhrnPruzkumu,
} from "../../src/pruzkum-postup";

/** Datum bez času — v seznamu jde o „kdy naposled", ne o minuty. */
function den(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("cs-CZ");
}

export function Kampane({ role, email }: { role: Role; email: string }) {
  const [kampane, setKampane] = useState<RadekKampane[]>([]);
  const [nacita, setNacita] = useState(true);
  const [chyba, setChyba] = useState<string | null>(null);
  /** `false` = seznam · `null` = nová kampaň · řádek = pokračování v rozdělané. */
  const [pruvodce, setPruvodce] = useState<false | null | RadekKampane>(false);
  const [ukazArchiv, setUkazArchiv] = useState(false);
  /** Kampaň čekající na potvrzení smazání. */
  const [keSmazani, setKeSmazani] = useState<RadekKampane | null>(null);
  const [pracuje, setPracuje] = useState(false);
  const [postupy, setPostupy] = useState<Map<string, SouhrnPruzkumu>>(new Map());

  const jeAdmin = role === "admin" || role === "super-admin";

  /**
   * Postup průzkumu u kampaní, které na něj čekají.
   *
   * Načítá se zvlášť a jen pro ně — stav „čeká na průzkum" sám o sobě
   * neříká, jestli se něco děje, nebo objednávka stojí ve frontě za jinou.
   */
  async function nactiPostupy(radky: RadekKampane[]) {
    const cekajici = radky.filter((k) => k.stav === "ceka_na_pruzkum");
    const dvojice = await Promise.all(
      cekajici.map(async (k) => {
        try {
          // Kampaň může stát na víc oblastech; každá má vlastní objednávku,
          // takže se v seznamu ukazuje souhrn za všechny.
          const oblasti = await nactiPruzkumyKampane(k.id, k.oblasti);
          if (oblasti.length === 0) return null;
          const souhrn = souhrnPruzkumu(
            oblasti.map((o) => ({
              nazev: o.oblastNazev,
              stav: o.pruzkum?.stav ?? null,
              postup: o.pruzkum
                ? postupPruzkumu({
                    stav: o.pruzkum.stav,
                    useky: o.pruzkum.useky,
                    bezPredMinutami: o.pruzkum.bezPredMinutami,
                    bezicíObec: o.pruzkum.bezicíObec,
                    blokujeJiny: o.pruzkum.blokujeJiny,
                    dalsiBehZa: dalsiBehZa(o.pruzkum.urgentni),
                  })
                : null,
            })),
          );
          return [k.id, souhrn] as const;
        } catch {
          return null;
        }
      }),
    );
    setPostupy(new Map(dvojice.filter((d): d is readonly [string, SouhrnPruzkumu] => d !== null)));
  }

  function obnov() {
    return nactiKampane()
      .then((radky) => {
        setKampane(radky);
        void nactiPostupy(radky);
      })
      .catch((e: Error) => setChyba(e.message));
  }

  useEffect(() => {
    obnov().finally(() => setNacita(false));
  }, []);

  async function prepniArchiv(k: RadekKampane) {
    setChyba(null);
    setPracuje(true);
    try {
      await archivujKampan(k.id, k.archivovana_at === null);
      await obnov();
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setPracuje(false);
    }
  }

  async function potvrdSmazani() {
    if (!keSmazani) return;
    setChyba(null);
    setPracuje(true);
    try {
      await smazKampan(keSmazani.id);
      setKeSmazani(null);
      await obnov();
    } catch (e) {
      setChyba((e as Error).message);
      setKeSmazani(null);
    } finally {
      setPracuje(false);
    }
  }

  if (pruvodce !== false) {
    return (
      <PruvodceKampani
        role={role}
        email={email}
        kampan={pruvodce}
        onHotovo={() => {
          setPruvodce(false);
          obnov();
        }}
      />
    );
  }

  if (nacita) return <p className="nacitani">Načítám kampaně…</p>;

  const videt = kampane.filter((k) =>
    ukazArchiv ? k.archivovana_at !== null : k.archivovana_at === null,
  );
  const vArchivu = kampane.filter((k) => k.archivovana_at !== null).length;

  return (
    <>
      <div className="sloupec">
        <h2>Kampaně</h2>
        <p className="podnadpis">
          Kampaň je pojmenovaný seznam firem, které chcete oslovit. Nic se z ní
          neodesílá.
        </p>
        <div className="tlacitka vlevo">
          <button className="tlacitko" onClick={() => setPruvodce(null)}>
            Nová kampaň
          </button>
          <button className="tlacitko tise" onClick={() => setUkazArchiv((p) => !p)}>
            {ukazArchiv ? "Zpět na aktivní" : `Archiv (${vArchivu})`}
          </button>
        </div>
        {chyba && (
          <p className="hlaska" role="alert">
            {chyba}
          </p>
        )}
      </div>

      <div className="sloupec">
        {videt.length === 0 ? (
          <div className="prazdno">
            {ukazArchiv
              ? "V archivu zatím nic není."
              : "Zatím tu žádná kampaň není. Založte první tlačítkem výš."}
          </div>
        ) : (
          <div className="obal-tabulky">
            <table className="tabulka">
              <thead>
                <tr>
                  <th>Název</th>
                  <th>Stav</th>
                  <th>Území</th>
                  <th>Správce</th>
                  <th>Zástup</th>
                  <th>Změněno</th>
                  <th>Úklid</th>
                </tr>
              </thead>
              <tbody>
                {videt.map((k) => {
                  const zaklad = POPIS_STAVU_KAMPANE[k.stav] ?? { popis: k.stav, trida: "je-novy" };
                  // Stav se mění až rozhodnutím člověka, takže „čeká na
                  // průzkum" zůstává i po jeho dokončení. Popisek proto říká,
                  // na co se doopravdy čeká — jinak si řádek protiřečí se
                  // shrnutím „Hotovo — prozkoumáno 9 obcí" hned pod ním.
                  const postup = postupy.get(k.id);
                  const s =
                    k.stav === "ceka_na_pruzkum" && postup && pruzkumDobehl(postup)
                      ? { popis: "průzkum hotový, čeká na vás", trida: "je-jinak" }
                      : zaklad;
                  return (
                    <tr key={k.id}>
                      <td>
                        <button className="odkaz" onClick={() => setPruvodce(k)}>
                          {k.nazev}
                        </button>
                      </td>
                      <td>
                        <span className={`stav ${s.trida}`}>
                          <span className="znak" />
                          {s.popis}
                        </span>
                        {/* Stav sám o sobě neříká, na co se čeká. Tohle ano. */}
                        {postup && <span className="postup-popis na-radek">{postup.popis}</span>}
                      </td>
                      <td>{k.oblasti.length > 0 ? k.oblasti.map((o) => o.nazev).join(", ") : "—"}</td>
                      <td>{k.spravce}</td>
                      <td>{k.zastupce ?? "—"}</td>
                      <td>{den(k.updated_at)}</td>
                      <td>
                        <div className="tlacitka vlevo">
                          <button
                            className="tlacitko tise"
                            disabled={pracuje}
                            onClick={() => prepniArchiv(k)}
                          >
                            {k.archivovana_at ? "Vrátit z archivu" : "Archivovat"}
                          </button>
                          {/* Mazat smí jen admin. Ostatním se tlačítko
                              nezobrazí vůbec — databáze je stejně zamítne. */}
                          {jeAdmin && (
                            <button
                              className="tlacitko tise"
                              disabled={pracuje}
                              onClick={() => setKeSmazani(k)}
                            >
                              Smazat
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {keSmazani && (
        <div className="zaclona" role="dialog" aria-modal="true" aria-label="Smazat kampaň">
          <div className="dialog">
            <h3>Smazat kampaň „{keSmazani.nazev}“?</h3>
            <p>
              Zmizí nadobro i se seznamem firem. Vrátit to nepůjde — pokud ji
              chcete jen uklidit z přehledu, použijte <strong>Archivovat</strong>.
            </p>
            <p className="poznamka">
              Zůstane po ní jen záznam, že existovala: název, správce a kdo ji
              smazal.
            </p>
            <div className="tlacitka vlevo">
              <button
                className="tlacitko tise"
                onClick={() => setKeSmazani(null)}
                disabled={pracuje}
              >
                Nechat být
              </button>
              <button
                className="tlacitko nebezpecne"
                onClick={potvrdSmazani}
                disabled={pracuje}
              >
                {pracuje ? "Mažu…" : "Smazat nadobro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
