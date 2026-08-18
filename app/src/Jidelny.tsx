import { useEffect, useState } from "react";
import { OknoParametru } from "./OknoParametru";
import {
  nactiFiremVDosahu,
  nactiHodnotyNabidky,
  nactiJidelny,
  nactiParametryProduktu,
  soucetKapacit,
  ulozKapacituJidelny,
  ulozStavJidelny,
  type Jidelna,
  type ParametrNabidky,
  type StavJidelny,
} from "./data";
import type { Role } from "./supabase";

/**
 * Jídelny, jejich stav a volná kapacita.
 *
 * Vzniklo na vyžádání majitele (17. 8. 2026): kapacita se dala zadat jedině
 * při zakládání jídelny příkazem `seed-jidelna`, takže u 34. ZŠ Plzeň zůstala
 * prázdná a nešla doplnit. Přitom je to číslo, které rozhoduje o celém
 * obchodu — kolik obědů vůbec máme co prodat.
 *
 * Hned nato přibyl **stav**: jídelna v přípravě ještě nemá co nabídnout, ale
 * kapacitu už znát můžeme. Proto se součet dělí na „co jde prodat dnes" a
 * „potenciál". Sečíst to dohromady by tvrdilo, že máme víc, než máme.
 *
 * Měnit obojí smí admin a výš (migrace 0016); ostatní to vidí, ale neupraví.
 */

interface Props {
  role: Role;
}

/** Zóna v metrech se lidsky čte v kilometrech. */
function zona(metru: number): string {
  return `${(metru / 1000).toFixed(1).replace(".", ",")} km`;
}

function obedu(n: number): string {
  return `${n.toLocaleString("cs")} obědů/den`;
}

/**
 * Krátký souhrn parametrů do seznamu — cena a kolik údajů je vyplněných.
 *
 * Do seznamu patří jen tolik, aby bylo vidět, kde čeká práce; zbytek je
 * v okně. `chybi` rozhoduje o barvě, ať se to pozná bez čtení.
 */
function souhrnParametru(
  parametry: ParametrNabidky[],
  hodnoty: Record<string, string> | undefined,
): { text: string; chybi: boolean } {
  if (parametry.length === 0) return { text: "—", chybi: false };
  const h = hodnoty ?? {};
  const vyplnenych = parametry.filter((p) => (h[p.id] ?? "") !== "").length;
  const cena = parametry.find((p) => p.kod === "cena_obeda");
  const cenaHodnota = cena ? h[cena.id] : undefined;
  return {
    text: `${cenaHodnota ? `${cenaHodnota} Kč · ` : ""}${vyplnenych} z ${parametry.length} vyplněno`,
    chybi: !cenaHodnota,
  };
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
  /** Jídelna, jejíž parametry se právě upravují v okně. */
  const [parametryJidelny, setParametryJidelny] = useState<Jidelna | null>(null);
  const [parametry, setParametry] = useState<ParametrNabidky[]>([]);
  /** Hodnoty podle id jídelny; uvnitř podle id parametru. */
  const [hodnoty, setHodnoty] = useState<Record<string, Record<string, string>>>({});

  const smiUpravovat = role === "admin" || role === "super-admin";

  function obnov() {
    return nactiJidelny()
      .then(async (j) => {
        setJidelny(j);
        setChyba(null);
        // Počty se dotahují až po seznamu — bez seznamu není co počítat.
        setVDosahu(await nactiFiremVDosahu(j.map((x) => x.id)));

        setParametry(await nactiParametryProduktu("cantinero"));
        const dvojice = await Promise.all(
          j.map(async (x) => [x.id, await nactiHodnotyNabidky(x.nabidka_id)] as const),
        );
        setHodnoty(Object.fromEntries(dvojice));
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

  async function prepniStav(j: Jidelna) {
    const novy: StavJidelny = j.stav === "priprava" ? "v_provozu" : "priprava";
    setPracuje(true);
    setChyba(null);
    try {
      await ulozStavJidelny(j.id, novy);
      setUlozeno(j.id);
      await obnov();
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setPracuje(false);
    }
  }

  if (nacita) return <p className="nacitani">Načítám jídelny…</p>;

  const soucet = soucetKapacit(jidelny);
  const vProvozu = jidelny.filter((j) => j.aktivni && j.stav === "v_provozu");
  const vPriprave = jidelny.filter((j) => j.aktivni && j.stav === "priprava");
  const bezKapacity = jidelny.filter((j) => j.aktivni && j.kapacita_volna === null);

  return (
    <>
      <div className="sloupec">
        <h2>Jídelny</h2>
        <p className="podnadpis">
          Kolik obědů denně máme volných a kolik firem je od které jídelny
          v dosahu. Kapacita je jediný údaj, který se nedá zjistit z dat —
          ví ho jen partner.
        </p>

        <div className="souhrn siroky">
          <p className="udaj">
            <span className="popisek">Volná kapacita v provozu</span>
            <span className="hodnota">{obedu(soucet.vProvozu)}</span>
          </p>
          <p className="udaj">
            <span className="popisek">Potenciální kapacita v přípravě</span>
            <span className="hodnota">{obedu(soucet.priprava)}</span>
          </p>
          <p className="udaj">
            <span className="popisek">Jídelen v provozu · v přípravě</span>
            <span className="hodnota">
              {vProvozu.length} · {vPriprave.length}
            </span>
          </p>
          <p className="udaj">
            <span className="popisek">Bez uvedené kapacity</span>
            <span className="hodnota">{soucet.bezUdaje}</span>
          </p>
        </div>

        <p className="poznamka">
          Prodat jde jen kapacita <b>v provozu</b>. Jídelny v přípravě se
          počítají zvlášť — je to potenciál, ne příslib, a sečtené dohromady by
          tvrdily, že máme víc, než máme.
          {bezKapacity.length > 0 && (
            <>
              {" "}
              Součty jsou navíc jen z jídelen, kde kapacitu známe —{" "}
              {bezKapacity.length === 1
                ? "jedna ji nemá uvedenou"
                : `${bezKapacity.length} jich ji nemá uvedených`}
              , takže skutečná čísla budou vyšší.
            </>
          )}
        </p>

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
                  <th>Stav</th>
                  <th className="cislo">Zóna</th>
                  <th className="cislo">Firem v dosahu</th>
                  <th>Volná kapacita</th>
                  <th>Parametry nabídky</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {jidelny.map((j) => {
                  const upravuje = upravovana?.id === j.id;
                  return (
                    <tr key={j.id}>
                      <td>{j.nazev}</td>
                      <td>{j.obec ?? "—"}</td>
                      <td>
                        {!j.aktivni ? (
                          <span className="stav je-zamitnuty">
                            <span className="znak" />
                            mimo provoz
                          </span>
                        ) : j.stav === "priprava" ? (
                          <span className="stav je-ceka">
                            <span className="znak" />
                            příprava
                          </span>
                        ) : (
                          <span className="stav je-kvalifikovany">
                            <span className="znak" />
                            v provozu
                          </span>
                        )}
                        {smiUpravovat && j.aktivni && (
                          <button
                            className="jako-odkaz na-radek"
                            disabled={pracuje}
                            onClick={() => void prepniStav(j)}
                          >
                            {j.stav === "priprava" ? "uvést do provozu" : "vrátit do přípravy"}
                          </button>
                        )}
                      </td>
                      <td className="cislo">{zona(j.zona_metru)}</td>
                      <td className="cislo">{(vDosahu[j.id] ?? 0).toLocaleString("cs")}</td>
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
                            onChange={(e) => setUpravovana({ id: j.id, hodnota: e.target.value })}
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
                          <span className={`stav ${j.stav === "priprava" ? "je-novy" : "je-kvalifikovany"}`}>
                            <span className="znak" />
                            {obedu(j.kapacita_volna)}
                          </span>
                        )}
                        {ulozeno === j.id && !upravuje && (
                          <span className="poznamka na-radek">uloženo</span>
                        )}
                      </td>
                      <td>
                        {(() => {
                          const s = souhrnParametru(parametry, hodnoty[j.id]);
                          return (
                            <span className={`stav ${s.chybi ? "je-ceka" : "je-kvalifikovany"}`}>
                              <span className="znak" />
                              {s.text}
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        {!smiUpravovat ? null : upravuje ? (
                          <span className="tlacitka vlevo">
                            <button
                              className="tlacitko"
                              disabled={pracuje}
                              onClick={() => void uloz()}
                            >
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
                        {smiUpravovat && !upravuje && (
                          <button
                            className="tlacitko tise"
                            disabled={pracuje}
                            onClick={() => {
                              setChyba(null);
                              setUlozeno(null);
                              setParametryJidelny(j);
                            }}
                          >
                            Upravit
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
            : "Kapacitu a stav mění admin. Tobě se tu ukazuje, jak jsou zapsané."}{" "}
          Ani kapacita, ani přepnutí do přípravy nepřeřadí jedinou firmu —
          jídelna v přípravě dál sbírá firmy v okolí, právě tím se připravuje.
        </p>
      </div>

      {parametryJidelny && (
        <OknoParametru
          jidelna={parametryJidelny}
          onZavri={() => setParametryJidelny(null)}
          onUlozeno={() => void obnov()}
        />
      )}
    </>
  );
}
