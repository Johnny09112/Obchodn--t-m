import { useEffect, useMemo, useState } from "react";
import { Mapa, type Rezim } from "./Mapa";
import { SeznamFirem } from "./SeznamFirem";
import { supabase, type Role } from "./supabase";
import { bodVOblasti, type Oblast } from "../../src/oblast-tvar";
import type { Bod } from "../../src/geo";
import {
  nactiFirmy,
  nactiJidelny,
  nactiKategorie,
  nactiOblasti,
  type Firma,
  type Jidelna,
  type Kategorie,
  type RadekOblasti,
} from "./data";

/** Když ještě nejsou data, dívej se na Plzeňsko — tam jsou všechny jídelny. */
const VYCHOZI = { stred: { lat: 49.7475, lng: 13.3776 }, zoom: 10 };

function naOblast(r: RadekOblasti): Oblast {
  return r.typ === "kruh"
    ? {
        typ: "kruh",
        stred: { lat: Number(r.stred_lat), lng: Number(r.stred_lng) },
        polomerM: Number(r.polomer_m),
      }
    : { typ: "polygon", body: r.body ?? [] };
}

const SMI_ZAPISOVAT: Role[] = ["super-admin", "admin", "uzivatel"];

export function Oblasti({ role }: { role: Role }) {
  const [firmy, setFirmy] = useState<Firma[]>([]);
  const [jidelny, setJidelny] = useState<Jidelna[]>([]);
  const [kategorie, setKategorie] = useState<Kategorie[]>([]);
  const [oblasti, setOblasti] = useState<RadekOblasti[]>([]);
  const [nacita, setNacita] = useState(true);
  const [chyba, setChyba] = useState<string | null>(null);

  const [navrh, setNavrh] = useState<Oblast | null>(null);
  const [upravovanaId, setUpravovanaId] = useState<string | null>(null);
  const [rezim, setRezim] = useState<Rezim>("prohlizeni");
  const [nazev, setNazev] = useState("");
  const [jidelnaId, setJidelnaId] = useState("");
  const [uklada, setUklada] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([nactiFirmy(), nactiJidelny(), nactiKategorie(), nactiOblasti()])
      .then(([f, j, k, o]) => {
        setFirmy(f);
        setJidelny(j);
        setKategorie(k);
        setOblasti(o);
      })
      .catch((e: Error) => setChyba(e.message))
      .finally(() => setNacita(false));
  }, []);

  const uvnitr = useMemo(() => {
    const s = new Set<string>();
    if (!navrh) return s;
    for (const f of firmy) {
      if (f.lat === null || f.lng === null) continue;
      if (bodVOblasti(navrh, { lat: f.lat, lng: f.lng })) s.add(f.ico);
    }
    return s;
  }, [navrh, firmy]);

  const vybraneFirmy = useMemo(
    () => (navrh ? firmy.filter((f) => uvnitr.has(f.ico)) : firmy),
    [navrh, firmy, uvnitr],
  );

  const bezSouradnic = useMemo(
    () => firmy.filter((f) => f.lat === null || f.lng === null).length,
    [firmy],
  );

  // ── kreslení

  function klikDoMapy(bod: Bod) {
    setHlaska(null);
    if (rezim === "kruh") {
      setNavrh({ typ: "kruh", stred: bod, polomerM: navrh?.polomerM ?? 8000 });
      return;
    }
    if (rezim === "polygon") {
      setNavrh((p) => ({ typ: "polygon", body: [...(p?.body ?? []), bod] }));
    }
  }

  function posunVrcholu(index: number, bod: Bod) {
    setNavrh((p) => {
      if (!p) return p;
      if (p.typ === "kruh") return { ...p, stred: bod };
      const body = [...(p.body ?? [])];
      body[index] = bod;
      return { ...p, body };
    });
  }

  function zacniKruh() {
    setRezim("kruh");
    setUpravovanaId(null);
    setNazev("");
    setJidelnaId("");
    setNavrh(null);
    setHlaska("Klikněte do mapy na střed. Poloměr pak nastavte posuvníkem.");
  }

  function zacniPolygon() {
    setRezim("polygon");
    setUpravovanaId(null);
    setNazev("");
    setJidelnaId("");
    setNavrh({ typ: "polygon", body: [] });
    setHlaska("Klikáním do mapy obkreslete území. Hotový tvar pak upravíte tažením bodů.");
  }

  function zahod() {
    setRezim("prohlizeni");
    setNavrh(null);
    setUpravovanaId(null);
    setNazev("");
    setJidelnaId("");
    setHlaska(null);
  }

  function otevri(r: RadekOblasti) {
    setNavrh(naOblast(r));
    setUpravovanaId(r.id);
    setNazev(r.nazev);
    setJidelnaId(r.jidelna_id ?? "");
    setRezim("prohlizeni");
    setHlaska(null);
  }

  function odeberPosledniBod() {
    setNavrh((p) =>
      p && p.typ === "polygon" ? { ...p, body: (p.body ?? []).slice(0, -1) } : p,
    );
  }

  // ── uložení

  const hotovyTvar =
    navrh !== null &&
    (navrh.typ === "kruh" ? !!navrh.stred : (navrh.body?.length ?? 0) >= 3);

  async function uloz() {
    if (!navrh || !hotovyTvar) return;
    if (!nazev.trim()) {
      setHlaska("Oblast potřebuje název — podle něj ji poznáte v seznamu.");
      return;
    }
    setUklada(true);
    setHlaska(null);

    const radek = {
      nazev: nazev.trim(),
      typ: navrh.typ,
      stred_lat: navrh.stred?.lat ?? null,
      stred_lng: navrh.stred?.lng ?? null,
      polomer_m: navrh.polomerM ?? null,
      body: navrh.body ?? null,
      jidelna_id: jidelnaId || null,
    };

    const bylaNova = !upravovanaId;
    const { data, error } = upravovanaId
      ? await supabase.from("oblasti").update(radek).eq("id", upravovanaId).select("id").single()
      : await supabase.from("oblasti").insert(radek).select("id").single();

    setUklada(false);
    if (error) {
      setHlaska(`Oblast se nepodařilo uložit: ${error.message}`);
      return;
    }

    // Bez zapamatování nového id by druhé kliknutí na Založit oblast
    // vyrobilo druhou stejnou oblast místo úpravy té první.
    if (data?.id) setUpravovanaId(data.id as string);

    const cerstve = await nactiOblasti().catch(() => null);
    if (cerstve) setOblasti(cerstve);
    setRezim("prohlizeni");
    setHlaska(
      bylaNova
        ? `Oblast „${radek.nazev}" je založená. Firmy uvnitř vidíte v seznamu níž.`
        : `Oblast „${radek.nazev}" je uložená.`,
    );
  }

  if (chyba) {
    return (
      <p className="hlaska" role="alert">
        Data se nepodařilo načíst: {chyba}
      </p>
    );
  }
  if (nacita) return <p className="nacitani">Načítám mapu a firmy…</p>;

  const smiZapisovat = SMI_ZAPISOVAT.includes(role);
  const pocetBodu = navrh?.typ === "polygon" ? (navrh.body?.length ?? 0) : 0;

  return (
    <>
      <div className="sloupec">
        <h2>Oblasti</h2>
        <p className="podnadpis">
          Území, ve kterém se hledají firmy. Kruh se rychle nastaví posuvníkem;
          když usekne sousední město v půlce, obkreslete tvar ručně.
        </p>
      </div>

      <div className="pas-oblasti sloupec">
        <div className="ulozene">
          <span className="nadpisek">Uložené oblasti</span>
          {oblasti.length === 0 ? (
            <span className="poznamka">Zatím žádná — založte první vpravo.</span>
          ) : (
            <ul className="seznam-oblasti">
              {oblasti.map((o) => (
                <li key={o.id}>
                  <button
                    className={`polozka ${upravovanaId === o.id ? "vybrana" : ""}`}
                    onClick={() => otevri(o)}
                  >
                    <span className="nazev">{o.nazev}</span>
                    <span className="popis">
                      {o.typ === "kruh"
                        ? `kruh ${((o.polomer_m ?? 0) / 1000).toFixed(1).replace(".", ",")} km`
                        : `tvar o ${o.body?.length ?? 0} bodech`}
                      {o.jidelna_id ? "" : " · bez jídelny"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {smiZapisovat && (
          <div className="tlacitka">
            <button className="tlacitko tise" onClick={zacniKruh}>
              Nový kruh
            </button>
            <button className="tlacitko tise" onClick={zacniPolygon}>
              Obkreslit tvar
            </button>
          </div>
        )}
      </div>

      {/* Pokyn „klikněte do mapy na střed" přijde dřív, než návrh vznikne —
          panel nad mapou tedy ještě nestojí a hláška by neměla kde být. */}
      {!navrh && hlaska && (
        <div className="sloupec">
          <p className="poznamka zvyraznena">{hlaska}</p>
        </div>
      )}

      <div className="deska">
        {navrh && (
          <div className="panel plovouci">
            <div className="hlava-panelu">
              <h3>{upravovanaId ? "Úprava oblasti" : "Nová oblast"}</h3>
              <button className="zavrit" onClick={zahod} aria-label="Zavřít panel">
                ✕
              </button>
            </div>

            <>
              <p className="udaj vyrazny">
                <span className="popisek">Firem uvnitř</span>
                <span className="hodnota">{uvnitr.size}</span>
              </p>

              {smiZapisovat && rezim === "prohlizeni" && (
                <p className="poznamka">
                  Body tvaru posunete tažením rovnou v mapě.{" "}
                  <button
                    className="odkaz"
                    onClick={() => {
                      setRezim(navrh.typ);
                      setHlaska(
                        navrh.typ === "kruh"
                          ? "Klikáním do mapy přesunete střed."
                          : "Klikáním do mapy přidáte další body.",
                      );
                    }}
                  >
                    {navrh.typ === "kruh" ? "Přesunout střed" : "Přidávat body"}
                  </button>
                </p>
              )}

              {navrh.typ === "kruh" && navrh.stred && (
                <label className="pole">
                  <span>
                    Poloměr —{" "}
                    {((navrh.polomerM ?? 0) / 1000).toFixed(1).replace(".", ",")} km
                  </span>
                  <input
                    type="range"
                    min={1000}
                    max={30000}
                    step={500}
                    value={navrh.polomerM ?? 8000}
                    onChange={(e) =>
                      setNavrh({ ...navrh, polomerM: Number(e.target.value) })
                    }
                  />
                </label>
              )}

              {navrh.typ === "polygon" && (
                <p className="poznamka">
                  {pocetBodu < 3
                    ? `Zatím ${pocetBodu} ${pocetBodu === 1 ? "bod" : "body"} — plochu ohraničí až tři.`
                    : `${pocetBodu} bodů. Tažením je posunete, klikáním do mapy přidáte další.`}
                  {pocetBodu > 0 && (
                    <>
                      {" "}
                      <button className="odkaz" onClick={odeberPosledniBod}>
                        Zpět o bod
                      </button>
                    </>
                  )}
                </p>
              )}

              {smiZapisovat && (
                <>
                  <label className="pole">
                    <span>Název oblasti</span>
                    <input
                      value={nazev}
                      onChange={(e) => setNazev(e.target.value)}
                      placeholder="Průzkum Rokycansko"
                    />
                  </label>

                  <label className="pole">
                    <span>Jídelna</span>
                    <select value={jidelnaId} onChange={(e) => setJidelnaId(e.target.value)}>
                      <option value="">zatím žádná</option>
                      {jidelny.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.nazev}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="poznamka">
                    Jídelnu můžete doplnit až po jednání — oblast na ni nečeká.
                  </p>

                  <div className="tlacitka">
                    <button
                      className="tlacitko"
                      onClick={uloz}
                      disabled={uklada || !hotovyTvar}
                    >
                      {uklada ? "Ukládám…" : upravovanaId ? "Uložit změny" : "Založit oblast"}
                    </button>
                  </div>
                </>
              )}
            </>

            {hlaska && <p className="poznamka zvyraznena">{hlaska}</p>}
          </div>
        )}

        <Mapa
          firmy={firmy}
          jidelny={jidelny}
          navrh={navrh}
          uvnitr={uvnitr}
          rezim={rezim}
          onKlikDoMapy={klikDoMapy}
          onPosunVrcholu={posunVrcholu}
          vychozi={VYCHOZI}
        />
      </div>

      <div className="sloupec">
        <SeznamFirem
          firmy={vybraneFirmy}
          kategorie={kategorie}
          nadpis={navrh ? "Firmy v oblasti" : "Všechny firmy"}
          bezSouradnic={navrh ? bezSouradnic : 0}
        />
      </div>
    </>
  );
}
