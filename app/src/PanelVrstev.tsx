import { useMemo, useState } from "react";
import type { RadekOblasti } from "./data";
import { barvaOblasti, type Prekryv, type Vrstva } from "./vrstvy";

interface Props {
  oblasti: RadekOblasti[];
  zobrazene: ReadonlySet<string>;
  vrstvy: Vrstva[];
  prekryv: Prekryv;
  otevrenaId: string | null;
  onPrepni: (id: string) => void;
  onVsechny: (zapnout: boolean) => void;
  onOtevri: (o: RadekOblasti) => void;
}

/**
 * Které oblasti jsou vidět v mapě.
 *
 * Oblastí budou postupem času stovky a budou se překrývat, takže seznam
 * musí unést hledání a rolování — a hlavně musí ukázat překryv. Firma ve
 * dvou oblastech naráz znamená dvě kampaně na jednu adresu, což tvrdé
 * pravidlo TP-5 nedovoluje.
 */
export function PanelVrstev({
  oblasti,
  zobrazene,
  vrstvy,
  prekryv,
  otevrenaId,
  onPrepni,
  onVsechny,
  onOtevri,
}: Props) {
  const [hledani, setHledani] = useState("");
  const [sbaleno, setSbaleno] = useState(false);

  const pocty = useMemo(
    () => new Map(vrstvy.map((v) => [v.id, v.firmy.size])),
    [vrstvy],
  );

  const videt = useMemo(() => {
    const q = hledani.trim().toLocaleLowerCase("cs");
    return oblasti
      .map((o, i) => ({ o, barva: barvaOblasti(i) }))
      .filter(({ o }) => !q || o.nazev.toLocaleLowerCase("cs").includes(q));
  }, [oblasti, hledani]);

  return (
    <div className={`panel vrstvy ${sbaleno ? "sbaleno" : ""}`}>
      <div className="hlava-panelu">
        <h3>Oblasti v mapě</h3>
        <button
          className="zavrit"
          onClick={() => setSbaleno((s) => !s)}
          aria-expanded={!sbaleno}
        >
          {sbaleno ? "Rozbalit" : "Sbalit"}
        </button>
      </div>

      {!sbaleno && (
        <>
          {oblasti.length === 0 ? (
            <p className="poznamka">Zatím žádná uložená oblast.</p>
          ) : (
            <>
              {oblasti.length > 6 && (
                <label className="pole">
                  <span className="skryty">Hledat oblast</span>
                  <input
                    type="search"
                    value={hledani}
                    onChange={(e) => setHledani(e.target.value)}
                    placeholder="hledat oblast"
                  />
                </label>
              )}

              <div className="prepinace">
                <button className="odkaz" onClick={() => onVsechny(true)}>
                  Zobrazit vše
                </button>
                <button className="odkaz" onClick={() => onVsechny(false)}>
                  Skrýt vše
                </button>
              </div>

              <ul className="seznam-vrstev">
                {videt.map(({ o, barva }) => (
                  <li key={o.id}>
                    <label className="vrstva">
                      <input
                        type="checkbox"
                        checked={zobrazene.has(o.id)}
                        onChange={() => onPrepni(o.id)}
                      />
                      <span className="swatch" style={{ background: barva }} aria-hidden="true" />
                      <span className="text">
                        <button
                          className={`jmeno ${otevrenaId === o.id ? "vybrana" : ""}`}
                          onClick={() => onOtevri(o)}
                        >
                          {o.nazev}
                        </button>
                        <span className="popis">
                          {zobrazene.has(o.id) ? `${(pocty.get(o.id) ?? 0).toLocaleString("cs")} firem · ` : ""}
                          {o.typ === "kruh"
                            ? `kruh ${((o.polomer_m ?? 0) / 1000).toFixed(1).replace(".", ",")} km`
                            : `tvar o ${o.body?.length ?? 0} bodech`}
                          {o.jidelna_id ? "" : " · bez jídelny"}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              {videt.length === 0 && (
                <p className="poznamka">Tomuhle hledání neodpovídá žádná oblast.</p>
              )}

              {prekryv.firmy.size > 0 ? (
                <div className="prekryv">
                  <p className="udaj">
                    <span className="popisek">V překryvu</span>
                    <span className="hodnota">{prekryv.firmy.size.toLocaleString("cs")} firem</span>
                  </p>
                  <p className="poznamka">
                    Tyhle firmy leží ve víc zobrazených oblastech. Na jednu firmu
                    smí odejít jen jedno oslovení, takže se do dvou kampaní
                    dostat nesmí — v mapě jsou vyznačené kroužkem.
                  </p>
                  <ul className="dvojice">
                    {prekryv.dvojice.slice(0, 4).map((d) => (
                      <li key={`${d.a}|${d.b}`}>
                        {d.a} × {d.b} — {d.pocet.toLocaleString("cs")}
                      </li>
                    ))}
                  </ul>
                  {prekryv.dvojice.length > 4 && (
                    <p className="poznamka">
                      …a další {prekryv.dvojice.length - 4} dvojice.
                    </p>
                  )}
                </div>
              ) : (
                vrstvy.length > 1 && (
                  <p className="poznamka bez-prekryvu">
                    Zobrazené oblasti se nepřekrývají.
                  </p>
                )
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
