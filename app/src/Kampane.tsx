import { useEffect, useState } from "react";
import { PruvodceKampani } from "./PruvodceKampani";
import { nactiKampane, POPIS_STAVU_KAMPANE, type RadekKampane } from "./data";
import type { Role } from "./supabase";

/** Datum bez času — v seznamu jde o „kdy naposled", ne o minuty. */
function den(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("cs-CZ");
}

export function Kampane({ role, email }: { role: Role; email: string }) {
  const [kampane, setKampane] = useState<RadekKampane[]>([]);
  const [nacita, setNacita] = useState(true);
  const [chyba, setChyba] = useState<string | null>(null);
  const [pruvodce, setPruvodce] = useState(false);

  useEffect(() => {
    nactiKampane()
      .then(setKampane)
      .catch((e: Error) => setChyba(e.message))
      .finally(() => setNacita(false));
  }, []);

  if (pruvodce) {
    return (
      <PruvodceKampani
        role={role}
        email={email}
        onHotovo={() => {
          setPruvodce(false);
          nactiKampane()
            .then(setKampane)
            .catch(() => undefined);
        }}
      />
    );
  }

  if (chyba) {
    return (
      <p className="hlaska" role="alert">
        Kampaně se nepodařilo načíst: {chyba}
      </p>
    );
  }
  if (nacita) return <p className="nacitani">Načítám kampaně…</p>;

  return (
    <>
      <div className="sloupec">
        <h2>Kampaně</h2>
        <p className="podnadpis">
          Kampaň je pojmenovaný seznam firem, které chcete oslovit. Nic se z ní
          neodesílá.
        </p>
        <div className="tlacitka vlevo">
          <button className="tlacitko" onClick={() => setPruvodce(true)}>
            Nová kampaň
          </button>
        </div>
      </div>

      <div className="sloupec">
        {kampane.length === 0 ? (
          <div className="prazdno">
            Zatím tu žádná kampaň není. Založte první tlačítkem výš.
          </div>
        ) : (
          <div className="obal-tabulky">
            <table className="tabulka">
              <thead>
                <tr>
                  <th>Název</th>
                  <th>Stav</th>
                  <th>Správce</th>
                  <th>Zástup</th>
                  <th>Změněno</th>
                </tr>
              </thead>
              <tbody>
                {kampane.map((k) => {
                  const s = POPIS_STAVU_KAMPANE[k.stav] ?? { popis: k.stav, trida: "je-novy" };
                  return (
                    <tr key={k.id}>
                      <td>{k.nazev}</td>
                      <td>
                        <span className={`stav ${s.trida}`}>
                          <span className="znak" />
                          {s.popis}
                        </span>
                      </td>
                      <td>{k.spravce}</td>
                      <td>{k.zastupce ?? "—"}</td>
                      <td>{den(k.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
