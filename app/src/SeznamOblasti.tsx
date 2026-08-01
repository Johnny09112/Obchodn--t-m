import { useMemo, useState } from "react";
import { cesky } from "../../src/cestina";
import { popisPruzkumu, popisTvaru } from "../../src/oblast-popis";
import { drziOblast } from "../../src/oblast-vyuziti";
import { porovnatelne } from "../../src/sito";
import {
  smazOblast,
  vyuzitiZPrehledu,
  type Jidelna,
  type PrehledOblasti,
} from "./data";
import type { Role } from "./supabase";

const SMI_MAZAT: Role[] = ["super-admin", "admin"];

/** Podle čeho se dá seznam seřadit. Pořadí voleb = pořadí v nabídce. */
const RAZENI = {
  posledni: "naposled se něco dělo",
  nazev: "název",
  firem: "počet firem",
} as const;

type Razeni = keyof typeof RAZENI;

interface Props {
  oblasti: PrehledOblasti[];
  jidelny: Jidelna[];
  role: Role;
  /** Která oblast je právě otevřená v mapě — zvýrazní se řádek. */
  otevrenaId: string | null;
  /** Otevřít oblast v mapě k prohlédnutí a úpravě. */
  onOtevri: (id: string) => void;
  /** Po smazání — ať se přehled i mapa načtou znovu. */
  onZmena?: () => void;
  /**
   * Zaškrtávací režim pro průvodce kampaní: které oblasti jsou vybrané.
   * `undefined` = běžný seznam bez výběru.
   */
  vybrane?: ReadonlySet<string>;
  onVyber?: (ids: string[]) => void;
  /** V průvodci se neuklízí — mazání se nabízí jen na obrazovce Oblasti. */
  dovolUklid?: boolean;
}

/**
 * Seznam oblastí s detailem.
 *
 * Vzniklo na vyžádání majitele: oblast se dala najít jen klikáním do mapy
 * a nebylo z ní vidět nic než tvar. Přitom rozhodnutí („můžu tuhle smazat?",
 * „prozkoumali jsme ji vůbec?") se dělá z těchhle údajů, ne z tvaru.
 *
 * Mapa zůstává pod seznamem — na kreslení a na to, aby bylo vidět, kde
 * oblasti leží a kde se překrývají.
 */
export function SeznamOblasti({
  oblasti,
  jidelny,
  role,
  otevrenaId,
  onOtevri,
  onZmena,
  vybrane,
  onVyber,
  dovolUklid = true,
}: Props) {
  const [hledani, setHledani] = useState("");
  const [razeni, setRazeni] = useState<Razeni>("posledni");
  const [keSmazani, setKeSmazani] = useState<PrehledOblasti | null>(null);
  const [maze, setMaze] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  const nazvyJidelen = useMemo(
    () => new Map(jidelny.map((j) => [j.id, j.nazev])),
    [jidelny],
  );

  // Jeden čas pro celý výpis. Kdyby si ho každý řádek bral sám, mohly by
  // dva sousední řádky tvrdit „dnes" a „včera" o stejném okamžiku.
  const ted = useMemo(() => new Date(), [oblasti]);

  const videt = useMemo(() => {
    // Bez diakritiky schválně — kdo píše „zapadni cechy", myslí „Západní čechy".
    const q = porovnatelne(hledani);
    const vybrane = q
      ? oblasti.filter(
          (o) =>
            porovnatelne(o.nazev).includes(q) ||
            o.kampane.some((k) => porovnatelne(k.nazev).includes(q)),
        )
      : oblasti;

    return [...vybrane].sort((a, b) => {
      if (razeni === "nazev") return a.nazev.localeCompare(b.nazev, "cs");
      if (razeni === "firem") return b.firem - a.firem;
      // Oblast bez průzkumu se řadí podle svého založení — jinak by nová
      // oblast spadla na konec a člověk by ji hledal.
      const kdy = (o: PrehledOblasti) => o.posledni_at ?? o.created_at;
      return kdy(b).localeCompare(kdy(a));
    });
  }, [oblasti, hledani, razeni]);

  const smiMazat = dovolUklid && SMI_MAZAT.includes(role);
  const prozkoumanych = oblasti.filter((o) => o.pruzkumu > 0).length;
  const vybirase = vybrane !== undefined && onVyber !== undefined;

  function prepniVyber(id: string) {
    if (!vybrane || !onVyber) return;
    const s = new Set(vybrane);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    onVyber([...s]);
  }

  async function potvrdSmazani() {
    if (!keSmazani) return;
    setMaze(true);
    setChyba(null);
    try {
      await smazOblast(keSmazani.id);
      setKeSmazani(null);
      onZmena?.();
    } catch (e) {
      setChyba((e as Error).message);
      setKeSmazani(null);
    } finally {
      setMaze(false);
    }
  }

  if (oblasti.length === 0) {
    return (
      <section className="seznam-oblasti">
        <h3>Oblasti</h3>
        <p className="prazdno">
          Zatím žádná oblast. Nakreslete první v mapě níž — kruh kolem jídelny
          stačí na začátek.
        </p>
      </section>
    );
  }

  return (
    <section className="seznam-oblasti">
      <div className="hlava-seznamu">
        <h3>Oblasti</h3>
        <p className="poznamka">
          {vybirase
            ? `Vybráno ${vybrane!.size} ${cesky(vybrane!.size, "oblast", "oblasti", "oblastí")} z ${oblasti.length}`
            : `${oblasti.length} ${cesky(oblasti.length, "oblast", "oblasti", "oblastí")} · ` +
              `${prozkoumanych} ${cesky(prozkoumanych, "prozkoumaná", "prozkoumané", "prozkoumaných")}`}
        </p>
      </div>

      {chyba && (
        <p className="hlaska" role="alert">
          {chyba}
        </p>
      )}

      <div className="filtry">
        <label className="pole">
          <span>Hledat</span>
          <input
            type="search"
            value={hledani}
            onChange={(e) => setHledani(e.target.value)}
            placeholder="název oblasti nebo kampaně"
          />
        </label>
        <label className="pole">
          <span>Řadit podle</span>
          <select value={razeni} onChange={(e) => setRazeni(e.target.value as Razeni)}>
            {Object.entries(RAZENI).map(([k, popis]) => (
              <option key={k} value={k}>
                {popis}
              </option>
            ))}
          </select>
        </label>
      </div>

      {videt.length === 0 ? (
        <p className="prazdno">Tomuhle hledání neodpovídá žádná oblast.</p>
      ) : (
        <div className="obal-tabulky">
          <table className="tabulka">
            <thead>
              <tr>
                {vybirase && <th className="vyber">Do kampaně</th>}
                <th>Oblast</th>
                <th className="cislo">Firem</th>
                <th>Průzkum</th>
                <th>Kampaně</th>
                <th>Jídelna</th>
                <th>{smiMazat ? "Úklid" : ""}</th>
              </tr>
            </thead>
            <tbody>
              {videt.map((o) => {
                const drzi = drziOblast(vyuzitiZPrehledu(o));
                return (
                  <tr key={o.id} className={otevrenaId === o.id ? "vybrany" : ""}>
                    {vybirase && (
                      <td className="vyber">
                        <label className="zaskrtnuti">
                          <input
                            type="checkbox"
                            checked={vybrane!.has(o.id)}
                            onChange={() => prepniVyber(o.id)}
                          />
                          <span className="skryty">Zahrnout oblast {o.nazev} do kampaně</span>
                        </label>
                      </td>
                    )}
                    <td>
                      <button className="odkaz jmeno" onClick={() => onOtevri(o.id)}>
                        {o.nazev}
                      </button>
                      <span className="pod-nazvem">
                        {popisTvaru({ typ: o.typ, polomerM: o.polomer_m, bodu: o.bodu })}
                      </span>
                    </td>

                    <td className="cislo">{o.firem.toLocaleString("cs")}</td>

                    <td>
                      {popisPruzkumu(
                        {
                          pruzkumu: o.pruzkumu,
                          posledniStav: o.posledni_stav,
                          posledniAt: o.posledni_at,
                        },
                        ted,
                      )}
                      {o.posledni_stav === "selhalo" && o.posledni_chyba && (
                        <span className="pod-nazvem chybou">{o.posledni_chyba}</span>
                      )}
                    </td>

                    <td>
                      {o.kampane.length === 0 ? (
                        <span className="tise">žádná</span>
                      ) : (
                        <span className="kampane-oblasti">
                          {o.kampane.map((k) => (
                            <span
                              key={k.id}
                              className={`stitek ${k.archivovana ? "archivni" : ""}`}
                            >
                              {k.nazev}
                              {k.archivovana ? " (archiv)" : ""}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>

                    <td>
                      {o.jidelna_id ? (
                        (nazvyJidelen.get(o.jidelna_id) ?? "neznámá")
                      ) : (
                        <span className="tise">zatím žádná</span>
                      )}
                    </td>

                    <td>
                      {!smiMazat ? null : drzi ? (
                        <span className="tise" title={drzi}>
                          nejde smazat
                        </span>
                      ) : (
                        <button
                          className="odkaz nebezpecny"
                          onClick={() => {
                            setChyba(null);
                            setKeSmazani(o);
                          }}
                        >
                          Smazat
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

      {smiMazat && (
        <p className="poznamka">
          Smazat jde jen oblast, kterou nedrží kampaň ani průzkum. Firmy uvnitř
          ji nedrží — ten seznam se počítá z tvaru a spočítá se kdykoli znovu.
        </p>
      )}

      {keSmazani && (
        <div className="zaclona" role="dialog" aria-modal="true" aria-label="Smazat oblast">
          <div className="dialog">
            <h3>Smazat oblast „{keSmazani.nazev}“?</h3>
            <p>
              {keSmazani.firem > 0
                ? `Zmizí nakreslený tvar a s ním i seznam ${keSmazani.firem.toLocaleString("cs")} firem uvnitř. Vrátit to nepůjde.`
                : "Zmizí nakreslený tvar. Vrátit to nepůjde."}
            </p>
            {keSmazani.firem > 0 && (
              <p className="poznamka">
                Firmy samotné zůstanou — mizí jen údaj o tom, že spadly do téhle
                plochy. Kdykoli nakreslíte oblast znovu, spočítá se znovu i on.
              </p>
            )}
            <div className="tlacitka vlevo">
              <button
                className="tlacitko tise"
                onClick={() => setKeSmazani(null)}
                disabled={maze}
              >
                Nechat být
              </button>
              <button className="tlacitko nebezpecne" onClick={potvrdSmazani} disabled={maze}>
                {maze ? "Mažu…" : "Smazat nadobro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
