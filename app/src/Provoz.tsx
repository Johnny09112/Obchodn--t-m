import { useEffect, useState } from "react";
import {
  dalsiBehZa,
  nactiBehyAgentu,
  nactiPruzkumyProvoz,
  zkusPruzkumZnovu,
  type BehAgenta,
  type PruzkumVProvozu,
} from "./data";
import { postupPruzkumu } from "../../src/pruzkum-postup";

/**
 * Provozní deník — co agent dělal, dělá a co se nepovedlo.
 *
 * Vzniklo na vyžádání majitele: „obecně mi začíná chybět nějaký log a kvůli
 * automatizaci bude absolutně nutný." Data pro něj existovala už dřív
 * (`agent_runs` podle TP-13, `pruzkumy`, `pruzkum_useky`) — chyběla jen
 * obrazovka.
 *
 * Vidí ho admin a výš. Běžnému uživateli by k ničemu nebyl a jsou tu
 * technické podrobnosti.
 */

const STAV_PRUZKUMU: Record<string, { popis: string; trida: string }> = {
  ceka: { popis: "čeká", trida: "je-ceka" },
  bezi: { popis: "běží", trida: "je-jinak" },
  hotovo: { popis: "hotovo", trida: "je-kvalifikovany" },
  selhalo: { popis: "selhalo", trida: "je-zamitnuty" },
  ceka_na_rozhodnuti: { popis: "čeká na rozhodnutí", trida: "je-novy" },
};

function cas(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
}

function trvani(od: string, do_: string | null): string {
  const konec = do_ ? new Date(do_).getTime() : Date.now();
  const minut = Math.round((konec - new Date(od).getTime()) / 60000);
  if (minut < 1) return "pod minutu";
  if (minut < 60) return `${minut} min`;
  return `${Math.floor(minut / 60)} h ${minut % 60} min`;
}

/**
 * Běhy zapsané do 17. 8. 2026 mají v jsonb uložený řetězec místo objektu —
 * ovladač je serializoval podruhé (opraveno v src/repo.ts). Data se kvůli
 * tomu nepřepisují; obrazovka si starý zápis rozbalí sama, jinak by u nich
 * Výsledek zůstal navždy prázdný a chyby nečitelné.
 */
function jakoHodnota(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

/**
 * Chyby běhu čitelně. Syrový JSON s uvozovkami majiteli nic neřekne —
 * z každé chyby se vytáhne věta, ne struktura.
 */
function popisChyb(syrove: unknown): string {
  const v = jakoHodnota(syrove);
  const seznam = Array.isArray(v) ? v : [v];
  const vety = seznam.map((polozka) => {
    if (typeof polozka === "string") return polozka;
    if (polozka !== null && typeof polozka === "object") {
      const o = polozka as Record<string, unknown>;
      const veta = o.chyba ?? o.duvod ?? o.popis;
      if (typeof veta === "string") {
        const kdo = typeof o.ico === "string" ? `${o.ico}: ` : "";
        return `${kdo}${veta}`;
      }
    }
    return JSON.stringify(polozka);
  });
  const text = vety.join(" · ");
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

/** Krátký souhrn z JSON výstupu běhu — celý JSON by nikdo nečetl. */
function souhrnVystupu(syrovy: unknown): string {
  const v = jakoHodnota(syrovy);
  if (v === null || typeof v !== "object") return "—";
  const dvojice = Object.entries(v as Record<string, unknown>)
    .filter(([, h]) => typeof h === "number" || typeof h === "boolean")
    .map(([k, h]) => `${k}: ${h}`);
  return dvojice.length > 0 ? dvojice.join(" · ") : "—";
}

export function Provoz() {
  const [pruzkumy, setPruzkumy] = useState<PruzkumVProvozu[]>([]);
  const [behy, setBehy] = useState<BehAgenta[]>([]);
  const [nacita, setNacita] = useState(true);
  const [chyba, setChyba] = useState<string | null>(null);
  const [pracuje, setPracuje] = useState(false);

  function obnov() {
    return Promise.all([nactiPruzkumyProvoz(), nactiBehyAgentu()])
      .then(([p, b]) => {
        setPruzkumy(p);
        setBehy(b);
        setChyba(null);
      })
      .catch((e: Error) => setChyba(e.message));
  }

  useEffect(() => {
    obnov().finally(() => setNacita(false));
  }, []);

  async function znovu(id: string) {
    setPracuje(true);
    try {
      await zkusPruzkumZnovu(id);
      await obnov();
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setPracuje(false);
    }
  }

  if (nacita) return <p className="nacitani">Načítám provozní deník…</p>;

  const nedokoncene = pruzkumy.filter((p) => p.stav === "ceka" || p.stav === "bezi").length;
  const chybne = pruzkumy.filter((p) => p.stav === "selhalo").length;
  const chybneUseky = pruzkumy.reduce(
    (s, p) => s + p.useky.filter((u) => u.stav === "selhalo").length,
    0,
  );

  return (
    <>
      <div className="sloupec">
        <h2>Provoz</h2>
        <p className="podnadpis">
          Co agent dělal, co dělá a co se nepovedlo. Zapisuje se každý běh —
          tenhle přehled ho jen ukazuje.
        </p>

        <p className="udaj">
          <span className="popisek">Průzkumů rozpracovaných</span>
          <span className="hodnota">{nedokoncene}</span>
        </p>
        <p className="udaj">
          <span className="popisek">Neúspěšných průzkumů</span>
          <span className="hodnota">{chybne}</span>
        </p>
        <p className="udaj">
          <span className="popisek">Obcí, které se nepovedly</span>
          <span className="hodnota">{chybneUseky}</span>
        </p>

        <div className="tlacitka vlevo">
          <button className="tlacitko tise" onClick={() => obnov()} disabled={pracuje}>
            Načíst znovu
          </button>
        </div>

        {chyba && (
          <p className="hlaska" role="alert">
            {chyba}
          </p>
        )}
      </div>

      <div className="sloupec">
        <h3>Průzkumy</h3>
        {pruzkumy.length === 0 ? (
          <div className="prazdno">Zatím žádný průzkum neproběhl.</div>
        ) : (
          <div className="obal-tabulky">
            <table className="tabulka">
              <thead>
                <tr>
                  <th>Oblast</th>
                  <th>Stav</th>
                  <th>Kampaň</th>
                  <th>Objednal</th>
                  <th>Kdy</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pruzkumy.map((p) => {
                  const s = STAV_PRUZKUMU[p.stav] ?? { popis: p.stav, trida: "je-novy" };
                  const postup = postupPruzkumu({
                    stav: p.stav,
                    useky: p.useky,
                    bezPredMinutami: p.bezPredMinutami,
                    bezicíObec: p.bezicíObec,
                    dalsiBehZa: dalsiBehZa(p.urgentni),
                  });
                  const spatneObce = p.useky.filter((u) => u.stav === "selhalo");
                  return (
                    <tr key={p.id}>
                      <td>
                        {p.oblast}
                        {p.urgentni && <span className="poznamka"> spěchá</span>}
                      </td>
                      <td>
                        <span className={`stav ${s.trida}`}>
                          <span className="znak" />
                          {s.popis}
                        </span>
                        <span className="postup-popis na-radek">{postup.popis}</span>
                        {p.chyba && (
                          <span className="postup-popis na-radek je-chybny">
                            Chyba: {p.chyba}
                          </span>
                        )}
                        {spatneObce.map((u) => (
                          <span key={u.obec} className="postup-popis na-radek je-chybny">
                            {u.obec}: {u.chyba ?? "bez popisu"}
                          </span>
                        ))}
                      </td>
                      <td>{p.kampan ?? "—"}</td>
                      <td>{p.pozadal}</td>
                      <td>{cas(p.pozadano_at)}</td>
                      <td>
                        {p.stav === "selhalo" && (
                          <button
                            className="tlacitko tise"
                            disabled={pracuje}
                            onClick={() => znovu(p.id)}
                          >
                            Zkusit znovu
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
      </div>

      <div className="sloupec">
        <h3>Běhy agentů</h3>
        <p className="poznamka">
          Každý běh se zapisuje (TP-13). Neukončený běh znamená, že proces
          ještě běží — nebo spadl a nestihl se uzavřít.
        </p>
        {behy.length === 0 ? (
          <div className="prazdno">Zatím žádný běh.</div>
        ) : (
          <div className="obal-tabulky">
            <table className="tabulka">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Začátek</th>
                  <th>Trvání</th>
                  <th>Výsledek</th>
                  <th>Chyby</th>
                </tr>
              </thead>
              <tbody>
                {behy.map((b) => (
                  <tr key={b.id}>
                    <td>{b.agent}</td>
                    <td>{cas(b.zacatek)}</td>
                    <td>
                      {trvani(b.zacatek, b.konec)}
                      {!b.konec && <span className="poznamka"> (neukončeno)</span>}
                    </td>
                    <td>{souhrnVystupu(b.vystup)}</td>
                    <td>
                      {b.chyby ? (
                        <span className="postup-popis je-chybny">{popisChyb(b.chyby)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
