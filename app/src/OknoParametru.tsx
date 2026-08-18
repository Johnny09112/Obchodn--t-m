import { useEffect, useState } from "react";
import {
  nactiHodnotyNabidky,
  nactiParametryProduktu,
  ulozHodnotuParametru,
  zavedParametrProduktu,
  type Jidelna,
  type ParametrNabidky,
} from "./data";

/**
 * Okno, ve kterém se vyplňují parametry nabídky.
 *
 * Proč okno, a ne políčka v řádku seznamu: parametrů může přibývat, protože
 * si je majitel zavádí sám, a u pátého by se řádek rozpadl. Vyžádal si to
 * majitel 18. 8. 2026 — a týmž dechem to, že nabídkou nemusí být jídelna,
 * ale docházkový systém nebo on-line služba.
 *
 * Zadání: docs/superpowers/specs/2026-08-18-nastaveni-zpravy-design.md
 */

/** Seznam voleb se ukládá jako JSON pole — čárka by se rozbila na volbě s čárkou. */
function naSeznam(hodnota: string): string[] {
  if (!hodnota.trim()) return [];
  try {
    const x: unknown = JSON.parse(hodnota);
    return Array.isArray(x) ? x.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Tentýž tvar jako `kodZNazvu` v `src/parametry.ts`. Opsané schválně —
 * aplikace nesmí sahat do kořenových zdrojů (Vercel instaluje jen `app/`).
 */
function kodZNazvu(nazev: string): string {
  return nazev
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

interface Props {
  jidelna: Jidelna;
  onZavri: () => void;
  onUlozeno: () => void;
}

const PRAZDNY_NOVY = { nazev: "", druh: "cislo", jednotka: "", moznosti: "" };

export function OknoParametru({ jidelna, onZavri, onUlozeno }: Props) {
  const [parametry, setParametry] = useState<ParametrNabidky[]>([]);
  const [hodnoty, setHodnoty] = useState<Record<string, string>>({});
  const [nacita, setNacita] = useState(true);
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [pridava, setPridava] = useState(false);
  const [novy, setNovy] = useState(PRAZDNY_NOVY);

  useEffect(() => {
    let platne = true;
    Promise.all([
      nactiParametryProduktu("cantinero"),
      nactiHodnotyNabidky(jidelna.nabidka_id),
    ])
      .then(([p, h]) => {
        if (!platne) return;
        setParametry(p);
        setHodnoty(h);
        setNacita(false);
      })
      .catch((e: Error) => {
        if (!platne) return;
        setChyba(e.message);
        setNacita(false);
      });
    return () => {
      platne = false;
    };
  }, [jidelna.nabidka_id]);

  // Okno leží přes stránku a myš nesmí být jediná cesta ven.
  useEffect(() => {
    function naKlavesu(e: KeyboardEvent) {
      if (e.key === "Escape") onZavri();
    }
    window.addEventListener("keydown", naKlavesu);
    return () => window.removeEventListener("keydown", naKlavesu);
  }, [onZavri]);

  function nastav(parametrId: string, hodnota: string) {
    setHodnoty((h) => ({ ...h, [parametrId]: hodnota }));
  }

  function prepniVolbu(p: ParametrNabidky, volba: string) {
    const vybrane = naSeznam(hodnoty[p.id] ?? "");
    const nove = vybrane.includes(volba)
      ? vybrane.filter((v) => v !== volba)
      : [...vybrane, volba];
    nastav(p.id, JSON.stringify(nove));
  }

  async function uloz() {
    setPracuje(true);
    setChyba(null);
    try {
      for (const p of parametry) {
        const h = hodnoty[p.id];
        if (h === undefined || h === "") continue;
        await ulozHodnotuParametru(jidelna.nabidka_id, p.id, h);
      }
      onUlozeno();
      onZavri();
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setPracuje(false);
    }
  }

  async function pridej() {
    setPracuje(true);
    setChyba(null);
    try {
      const moznosti = novy.moznosti
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      if (novy.druh === "vyber" && moznosti.length === 0) {
        throw new Error("Výběr z možností potřebuje aspoň jednu možnost — každou na svůj řádek.");
      }
      await zavedParametrProduktu({
        produktKod: "cantinero",
        kod: kodZNazvu(novy.nazev),
        nazev: novy.nazev.trim(),
        druh: novy.druh,
        jednotka: novy.jednotka.trim() || null,
        moznosti,
      });
      setParametry(await nactiParametryProduktu("cantinero"));
      setPridava(false);
      setNovy(PRAZDNY_NOVY);
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div
      className="zaclona"
      role="dialog"
      aria-modal="true"
      aria-label={`Parametry nabídky — ${jidelna.nazev}`}
    >
      <div className="dialog parametry">
        <h3>{jidelna.nazev}</h3>

        {nacita ? (
          <p className="nacitani">Načítám parametry…</p>
        ) : (
          <>
            {parametry.length === 0 && (
              <p className="poznamka">U tohohle produktu zatím není zaveden žádný parametr.</p>
            )}

            {parametry.map((p) => (
              <div className="parametr-radek" key={p.id}>
                <label htmlFor={`p-${p.id}`}>
                  {p.nazev}
                  {p.jednotka && <span className="poznamka"> ({p.jednotka})</span>}
                </label>

                {p.druh === "vyber" ? (
                  <div className="volby">
                    {p.moznosti.map((m) => {
                      const vybrano = naSeznam(hodnoty[p.id] ?? "").includes(m);
                      return (
                        <button
                          type="button"
                          key={m}
                          className={`volba ${vybrano ? "zap" : ""}`}
                          aria-pressed={vybrano}
                          disabled={pracuje}
                          onClick={() => prepniVolbu(p, m)}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                ) : p.druh === "ano_ne" ? (
                  <select
                    id={`p-${p.id}`}
                    value={hodnoty[p.id] ?? ""}
                    disabled={pracuje}
                    onChange={(e) => nastav(p.id, e.target.value)}
                  >
                    <option value="">neuvedeno</option>
                    <option value="ano">ano</option>
                    <option value="ne">ne</option>
                  </select>
                ) : (
                  <input
                    id={`p-${p.id}`}
                    type={p.druh === "cislo" ? "number" : "text"}
                    min={p.druh === "cislo" ? 0 : undefined}
                    value={hodnoty[p.id] ?? ""}
                    placeholder="neuvedeno"
                    disabled={pracuje}
                    onChange={(e) => nastav(p.id, e.target.value)}
                  />
                )}
              </div>
            ))}

            {pridava ? (
              <div className="novy-parametr">
                <div className="parametr-radek">
                  <label htmlFor="np-nazev">Název</label>
                  <input
                    id="np-nazev"
                    value={novy.nazev}
                    placeholder="Rozvoz zdarma od"
                    disabled={pracuje}
                    onChange={(e) => setNovy({ ...novy, nazev: e.target.value })}
                  />
                </div>
                <div className="parametr-radek">
                  <label htmlFor="np-druh">Druh údaje</label>
                  <select
                    id="np-druh"
                    value={novy.druh}
                    disabled={pracuje}
                    onChange={(e) => setNovy({ ...novy, druh: e.target.value })}
                  >
                    <option value="cislo">číslo</option>
                    <option value="text">text</option>
                    <option value="ano_ne">ano / ne</option>
                    <option value="vyber">výběr z možností</option>
                  </select>
                </div>
                {novy.druh === "cislo" && (
                  <div className="parametr-radek">
                    <label htmlFor="np-jednotka">Jednotka</label>
                    <input
                      id="np-jednotka"
                      value={novy.jednotka}
                      placeholder="Kč"
                      disabled={pracuje}
                      onChange={(e) => setNovy({ ...novy, jednotka: e.target.value })}
                    />
                  </div>
                )}
                {novy.druh === "vyber" && (
                  <div className="parametr-radek">
                    <label htmlFor="np-moznosti">Možnosti</label>
                    <textarea
                      id="np-moznosti"
                      rows={4}
                      value={novy.moznosti}
                      placeholder="každou na svůj řádek"
                      disabled={pracuje}
                      onChange={(e) => setNovy({ ...novy, moznosti: e.target.value })}
                    />
                  </div>
                )}
                <div className="tlacitka">
                  <button
                    className="tlacitko"
                    disabled={pracuje || !novy.nazev.trim()}
                    onClick={() => void pridej()}
                  >
                    Přidat
                  </button>
                  <button
                    className="tlacitko tise"
                    disabled={pracuje}
                    onClick={() => {
                      setPridava(false);
                      setChyba(null);
                    }}
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            ) : (
              <button className="jako-odkaz" disabled={pracuje} onClick={() => setPridava(true)}>
                + Přidat parametr
              </button>
            )}
          </>
        )}

        {chyba && (
          <p className="hlaska" role="alert">
            {chyba}
          </p>
        )}

        <p className="poznamka">
          Prázdné pole znamená „nevím“ — to není totéž co nula. Nevyplněný
          údaj, který zpráva potřebuje, znamená, že se firmám od téhle jídelny
          nepošle nic.
        </p>

        <div className="tlacitka">
          <button className="tlacitko" disabled={pracuje || nacita} onClick={() => void uloz()}>
            Uložit
          </button>
          <button className="tlacitko tise" disabled={pracuje} onClick={onZavri}>
            Zrušit
          </button>
        </div>
      </div>
    </div>
  );
}
