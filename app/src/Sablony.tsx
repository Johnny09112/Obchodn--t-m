import { useCallback, useEffect, useMemo, useState } from "react";
import { zkontrolujZpravu } from "../../src/styl-zpravy";
import { slozText, type PodminkaPasaze } from "../../src/text-zpravy";
import {
  nactiParametryProduktu,
  nactiPodminky,
  nactiVsechnySablony,
  pustDoProvozu,
  smazPodminku,
  ulozKoncept,
  ulozPodminku,
  type ParametrNabidky,
  type PodminkaRadek,
  type Sablona,
} from "./data";
import type { Role } from "./supabase";

/**
 * Šablony — psaní textu oslovení bez sahání do kódu.
 *
 * Do textu se vkládají pole (`[cena]`), označené větě se přiřadí podmínka
 * vybraná z parametrů nabídky. **Podmínka se nepíše, vybírá se** — žádný
 * jazyk se šablonami se nezavádí.
 *
 * Uložení je koncept; platnou verzí se text stane teprve tlačítkem
 * „pustit do provozu". Rozepsaná věta tak nikomu neodejde.
 *
 * Kontrola stylu (`src/styl-zpravy.ts`) i skládání textu
 * (`src/text-zpravy.ts`) jsou čisté moduly — obrazovka pouští **týž kód**,
 * jaký použije jádro. Opsat si je sem by znamenalo dva různé maily pod
 * jedním jménem (past „pravidlo-v-jadru-nehlida-obrazovku").
 */

const UKAZKA = {
  prijmeni: "Nováková",
  oznaceni: "truhlárna",
  vzdalenostM: 900,
  cena: "115 Kč",
};

/** Věta končí tečkou — stejně jako při vyhodnocování podmínek. */
function naVety(odstavec: string): string[] {
  return odstavec.split(/(?<=\.)\s+/).filter((v) => v.trim() !== "");
}

/** Odstavce bez prázdných řádků, ať pořadí sedí s tím, co počítá jádro. */
function naOdstavce(telo: string): string[] {
  return telo.split("\n").filter((o) => o.trim() !== "");
}

export function Sablony({ role }: { role: Role }) {
  const [sablony, setSablony] = useState<Array<Sablona & { stav: string; kanal: string }>>([]);
  const [vybrana, setVybrana] = useState<string | null>(null);
  const [predmet, setPredmet] = useState("");
  const [telo, setTelo] = useState("");
  const [podminky, setPodminky] = useState<PodminkaRadek[]>([]);
  const [parametry, setParametry] = useState<ParametrNabidky[]>([]);
  const [nacita, setNacita] = useState(true);
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hlaska, setHlaska] = useState<string | null>(null);

  const smiUpravovat = role === "admin" || role === "super-admin";

  const nacti = useCallback(async () => {
    const s = await nactiVsechnySablony();
    setSablony(s);
    setParametry(await nactiParametryProduktu("cantinero"));

    const platna = s.find((x) => x.stav === "schvaleno") ?? s[0];
    if (!platna) return;
    setVybrana(platna.id);
    setPredmet(platna.predmet ?? "");
    setTelo(platna.telo);
    setPodminky(await nactiPodminky(platna.id));
  }, []);

  useEffect(() => {
    nacti()
      .catch((e: Error) => setChyba(e.message))
      .finally(() => setNacita(false));
  }, [nacti]);

  async function otevri(id: string) {
    const s = sablony.find((x) => x.id === id);
    if (!s) return;
    setVybrana(id);
    setPredmet(s.predmet ?? "");
    setTelo(s.telo);
    setHlaska(null);
    try {
      setPodminky(await nactiPodminky(id));
    } catch (e) {
      setChyba((e as Error).message);
    }
  }

  const vytky = useMemo(() => {
    // Kontroluje se **vyplněný** text, ne kostra: zástupné údaje nejsou
    // slova a počet slov ani počet otázek by vycházel jinak, než jak
    // zpráva doopravdy odejde.
    const ukazkovy = slozText(telo, [], { ...UKAZKA, parametry: {} }, []);
    return zkontrolujZpravu(ukazkovy, { predmet, jmenoAdresata: UKAZKA.prijmeni });
  }, [telo, predmet]);

  const nahled = useMemo(
    () =>
      slozText(
        telo,
        [],
        { ...UKAZKA, parametry: { moznosti_vydeje: '["na místě","do vlastního jídlonosiče"]' } },
        podminky.map(
          (p): PodminkaPasaze => ({
            odstavec: p.odstavec,
            veta: p.veta,
            parametrKod: p.parametr_kod,
            ocekavanaHodnota: p.ocekavana_hodnota,
          }),
        ),
      ),
    [telo, podminky],
  );

  const aktualni = sablony.find((x) => x.id === vybrana);
  const zmeneno = aktualni ? predmet !== (aktualni.predmet ?? "") || telo !== aktualni.telo : false;

  function vlozPole(kod: string) {
    setTelo((t) => `${t}${t.endsWith(" ") || t === "" ? "" : " "}[${kod}]`);
  }

  async function ulozJakoKoncept() {
    if (!aktualni) return;
    setPracuje(true);
    setChyba(null);
    try {
      const id = await ulozKoncept({
        segment: aktualni.segment,
        kanal: aktualni.kanal,
        predmet,
        telo,
        strukturaId: null,
      });
      // Podmínky patří k textu, takže se přenesou na novou verzi.
      for (const p of podminky) {
        await ulozPodminku(id, p.odstavec, p.veta, p.parametr_kod, p.ocekavana_hodnota);
      }
      await nacti();
      await otevri(id);
      setHlaska("Uloženo jako koncept. Do provozu ho pustíte tlačítkem vedle.");
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setPracuje(false);
    }
  }

  async function pustit() {
    if (!vybrana) return;
    setPracuje(true);
    setChyba(null);
    try {
      await pustDoProvozu(vybrana);
      await nacti();
      setHlaska("Šablona je v provozu. Starší verze se vyřadily.");
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setPracuje(false);
    }
  }

  async function nastavPodminku(odstavec: number, veta: number, volba: string) {
    if (!vybrana) return;
    setPracuje(true);
    try {
      if (volba === "") {
        const stara = podminky.find((p) => p.odstavec === odstavec && p.veta === veta);
        if (stara) await smazPodminku(stara.id);
      } else {
        const [kod, hodnota] = volba.split("|");
        await ulozPodminku(vybrana, odstavec, veta, kod ?? "", hodnota || null);
      }
      setPodminky(await nactiPodminky(vybrana));
      setChyba(null);
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setPracuje(false);
    }
  }

  if (nacita) return <p className="nacitani">Načítám šablony…</p>;

  return (
    <>
      <div className="sloupec">
        <h2>Šablony</h2>
        <p className="podnadpis">
          Text oslovení. Pole v hranatých závorkách se doplní u kampaně,
          věta s podmínkou se ukáže jen tam, kde podmínka platí. Nic se
          odsud neodesílá.
        </p>

        {chyba && (
          <p className="hlaska" role="alert">
            {chyba}
          </p>
        )}
        {hlaska && <p className="hlaska je-hotovo">{hlaska}</p>}

        <div className="obal-tabulky">
          <table className="tabulka">
            <thead>
              <tr>
                <th>Šablona</th>
                <th>Verze</th>
                <th>Stav</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sablony.map((s) => (
                <tr key={s.id}>
                  <td>{s.segment}</td>
                  <td className="cislo">{s.verze}</td>
                  <td>
                    <span
                      className={`stav ${
                        s.stav === "schvaleno"
                          ? "je-kvalifikovany"
                          : s.stav === "navrzeno"
                            ? "je-ceka"
                            : "je-zamitnuty"
                      }`}
                    >
                      <span className="znak" />
                      {s.stav === "schvaleno"
                        ? "v provozu"
                        : s.stav === "navrzeno"
                          ? "koncept"
                          : "vyřazená"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="tlacitko tise"
                      disabled={pracuje}
                      onClick={() => void otevri(s.id)}
                    >
                      {s.id === vybrana ? "otevřená" : "Otevřít"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {aktualni && (
        <>
          <div className="sloupec">
            <h3>Text</h3>

            <label className="pole">
              Předmět
              <input
                value={predmet}
                disabled={!smiUpravovat || pracuje}
                onChange={(e) => setPredmet(e.target.value)}
              />
            </label>

            <label className="pole">
              Tělo zprávy
              <textarea
                rows={12}
                value={telo}
                disabled={!smiUpravovat || pracuje}
                onChange={(e) => setTelo(e.target.value)}
              />
            </label>

            {smiUpravovat && (
              <div className="volby">
                <span className="poznamka">Vložit pole:</span>
                {["osloveni", "vzdalenost", "od_vasi_firmy", "cena"].map((kod) => (
                  <button
                    key={kod}
                    type="button"
                    className="volba"
                    disabled={pracuje}
                    onClick={() => vlozPole(kod)}
                  >
                    [{kod}]
                  </button>
                ))}
              </div>
            )}

            <div className={`hlaska ${vytky.length === 0 ? "je-hotovo" : ""}`}>
              {vytky.length === 0 ? (
                "Kontrola stylu: bez výhrad."
              ) : (
                <>
                  Kontrola stylu má {vytky.length === 1 ? "výhradu" : "výhrady"}:
                  <ul className="vytky">
                    {vytky.map((v) => (
                      <li key={v.kod + v.detail}>{v.detail}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {smiUpravovat && (
              <div className="tlacitka vlevo">
                <button
                  className="tlacitko"
                  disabled={pracuje || !zmeneno || vytky.length > 0}
                  onClick={() => void ulozJakoKoncept()}
                >
                  Uložit jako koncept
                </button>
                <button
                  className="tlacitko"
                  disabled={pracuje || aktualni.stav === "schvaleno" || vytky.length > 0}
                  onClick={() => void pustit()}
                >
                  Pustit do provozu
                </button>
              </div>
            )}
            <p className="poznamka">
              Uložení nikomu nic nepošle — vznikne nová verze jako koncept.
              Platnou se stane až tlačítkem „pustit do provozu“ a starší
              verze se tím vyřadí. Text, který neprojde kontrolou stylu,
              se uložit nedá.
            </p>
          </div>

          <div className="sloupec">
            <h3>Podmíněné věty</h3>
            <p className="podnadpis">
              U věty, která neplatí pro každou jídelnu, vyberte podmínku.
              Bez podmínky se věta pošle vždycky.
            </p>

            {naOdstavce(telo).map((odstavec, i) => (
              <div className="odstavec-vet" key={i}>
                {naVety(odstavec).map((veta, j) => {
                  const p = podminky.find((x) => x.odstavec === i && x.veta === j);
                  const volba = p ? `${p.parametr_kod}|${p.ocekavana_hodnota ?? ""}` : "";
                  return (
                    <div className="veta-radek" key={j}>
                      <span className="text-vety">{veta}</span>
                      <select
                        value={volba}
                        disabled={!smiUpravovat || pracuje}
                        onChange={(e) => void nastavPodminku(i, j, e.target.value)}
                      >
                        <option value="">bez podmínky — pošle se vždy</option>
                        {parametry.flatMap((par) =>
                          par.druh === "vyber"
                            ? par.moznosti.map((m) => (
                                <option key={`${par.kod}|${m}`} value={`${par.kod}|${m}`}>
                                  jen když {par.nazev.toLowerCase()} zahrnují „{m}“
                                </option>
                              ))
                            : par.druh === "ano_ne"
                              ? [
                                  <option key={`${par.kod}|ano`} value={`${par.kod}|ano`}>
                                    jen když {par.nazev.toLowerCase()} = ano
                                  </option>,
                                ]
                              : [
                                  <option key={`${par.kod}|`} value={`${par.kod}|`}>
                                    jen když je vyplněno: {par.nazev.toLowerCase()}
                                  </option>,
                                ],
                        )}
                      </select>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="sloupec">
            <h3>Jak to bude vypadat</h3>
            <p className="podnadpis">
              Ukázková firma: paní Nováková, truhlárna, 900 metrů od jídelny,
              která umí výdej na místě i do jídlonosičů.
            </p>
            <div className="nahled-zpravy">
              <p className="predmet-radek">
                <span className="popisek">Předmět</span> {predmet}
              </p>
              <pre className="telo-zpravy">{nahled}</pre>
            </div>
          </div>
        </>
      )}
    </>
  );
}
