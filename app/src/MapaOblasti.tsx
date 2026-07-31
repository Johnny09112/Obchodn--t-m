import { useEffect, useMemo, useState } from "react";
import { Mapa, type Rezim } from "./Mapa";
import { PanelVrstev } from "./PanelVrstev";
import { SeznamFirem } from "./SeznamFirem";
import { supabase, type Role } from "./supabase";
import { najdiPrekryv, naOblast, spoctiVrstvy } from "./vrstvy";
import { najdiMisto, type Misto } from "./hledaniMista";
import { bodVOblasti, type Oblast } from "../../src/oblast-tvar";
import { vzdalenostM, type Bod } from "../../src/geo";
import { drziOblast } from "../../src/oblast-vyuziti";
import {
  nactiFirmy,
  nactiJidelny,
  nactiKategorie,
  nactiOblasti,
  smazOblast,
  zjistiVyuzitiOblasti,
  type Firma,
  type Jidelna,
  type Kategorie,
  type RadekOblasti,
  type VyuzitiOblasti,
} from "./data";

/** Když ještě nejsou data, dívej se na Plzeňsko — tam jsou všechny jídelny. */
const VYCHOZI = { stred: { lat: 49.7475, lng: 13.3776 }, zoom: 10 };

const SMI_ZAPISOVAT: Role[] = ["super-admin", "admin", "uzivatel"];

// Mazání dat rozhoduje majitel — stejné pravidlo jako u kampaní. Vynucuje
// ho databáze (`oblasti_mazani`), tady se podle něj jen skrývá tlačítko.
const SMI_MAZAT: Role[] = ["super-admin", "admin"];

export interface MapaOblastiProps {
  /** Kdo se dívá — kreslit smí jen tým, host jen prohlíží. */
  role: Role;
  /** Zavolá se, kdykoli se změní vybraná oblast. `null` = žádná. */
  onVyber?: (oblastId: string | null) => void;
  /**
   * Která oblast má být vybraná po otevření. Uplatní se jen jednou, při
   * načtení — kdyby se hlídala trvale, prala by se s výběrem v mapě.
   */
  vybranaId?: string | null;
  /**
   * Nabídnout mazání oblastí. Jen na obrazovce Oblasti — v průvodci kampaní
   * se území vybírá, ne uklízí, a tlačítko Smazat by tam byla past.
   */
  dovolUklid?: boolean;
}

/**
 * Mapa s oblastmi: zobrazení, kreslení kruhu i tvaru, uložení a seznam firem.
 *
 * Sdílená obrazovkou Oblasti a průvodcem kampaní. Dvě samostatné mapy by se
 * časem rozešly — oprava v jedné by tu druhou minula.
 */
export function MapaOblasti({
  role,
  onVyber,
  vybranaId,
  dovolUklid = false,
}: MapaOblastiProps) {
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
  const [zobrazene, setZobrazene] = useState<ReadonlySet<string>>(new Set());

  const [vyuziti, setVyuziti] = useState<VyuzitiOblasti | null>(null);
  const [keSmazani, setKeSmazani] = useState(false);
  const [maze, setMaze] = useState(false);

  const [dotazMista, setDotazMista] = useState("");
  const [nalezena, setNalezena] = useState<Misto[]>([]);
  const [presunNa, setPresunNa] = useState<{ stred: Bod; zoom: number } | null>(null);

  useEffect(() => {
    Promise.all([nactiFirmy(), nactiJidelny(), nactiKategorie(), nactiOblasti()])
      .then(([f, j, k, o]) => {
        setFirmy(f);
        setJidelny(j);
        setKategorie(k);
        setOblasti(o);
        setZobrazene(new Set(o.map((x) => x.id)));

        // Návrat do rozdělané kampaně: obnov vybranou oblast. Jen tady, při
        // načtení — kdyby se `vybranaId` hlídalo trvale, pralo by se s tím,
        // co si člověk vybere v mapě.
        const puvodni = vybranaId ? o.find((x) => x.id === vybranaId) : undefined;
        if (puvodni) {
          setNavrh(naOblast(puvodni));
          setUpravovanaId(puvodni.id);
          setNazev(puvodni.nazev);
          setJidelnaId(puvodni.jidelna_id ?? "");
        }
      })
      .catch((e: Error) => setChyba(e.message))
      .finally(() => setNacita(false));
    // Schválně jen při načtení — viz komentář výš.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vrstvy = useMemo(
    () => spoctiVrstvy(oblasti, zobrazene, firmy),
    [oblasti, zobrazene, firmy],
  );
  const prekryv = useMemo(() => najdiPrekryv(vrstvy), [vrstvy]);

  // Nominatim snese nejvýš jeden dotaz za sekundu, takže se psaní odkládá —
  // dotaz odejde až po odmlce, ne po každém písmenu.
  useEffect(() => {
    if (!dotazMista.trim()) {
      setNalezena([]);
      return;
    }
    const casovac = setTimeout(() => {
      najdiMisto(dotazMista)
        .then(setNalezena)
        .catch(() => setNalezena([]));
    }, 600);
    return () => clearTimeout(casovac);
  }, [dotazMista]);

  // Co otevřenou oblast drží naživu. Zjišťuje se dopředu, aby šlo říct
  // „používá ji kampaň Plzeň", a ne až po neúspěšném smazání.
  useEffect(() => {
    if (!dovolUklid || !upravovanaId) {
      setVyuziti(null);
      return;
    }
    let platne = true;
    setVyuziti(null);
    zjistiVyuzitiOblasti(upravovanaId)
      .then((v) => {
        if (platne) setVyuziti(v);
      })
      .catch(() => {
        if (platne) setVyuziti(null);
      });
    return () => {
      platne = false;
    };
  }, [upravovanaId, dovolUklid]);

  function prepniVrstvu(id: string) {
    setZobrazene((p) => {
      const s = new Set(p);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

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
    onVyber?.(null);
  }

  function otevri(r: RadekOblasti) {
    setNavrh(naOblast(r));
    setUpravovanaId(r.id);
    setNazev(r.nazev);
    setJidelnaId(r.jidelna_id ?? "");
    setRezim("prohlizeni");
    setHlaska(null);
    onVyber?.(r.id);
  }

  function odeberPosledniBod() {
    setNavrh((p) =>
      p && p.typ === "polygon" ? { ...p, body: (p.body ?? []).slice(0, -1) } : p,
    );
  }

  // ── uložení

  /**
   * Zapíše, které firmy do oblasti spadly.
   *
   * Není to nový údaj o firmě, jen odvozenina z tvaru — dá se kdykoli
   * spočítat znovu (migrace 0017). Zapisuje se proto, aby o oblasti
   * založené v aplikaci věděla i příkazová řádka.
   *
   * Nejdřív se maže: po zúžení oblasti musí firmy zmizet, ne zůstat.
   * Vrací text chyby, nebo null při úspěchu.
   */
  async function zapisPrislusnost(oblastId: string, o: Oblast): Promise<string | null> {
    const radky = firmy
      .filter((f) => f.lat !== null && f.lng !== null)
      .filter((f) => bodVOblasti(o, { lat: f.lat!, lng: f.lng! }))
      .map((f) => ({
        oblast_id: oblastId,
        ico: f.ico,
        // Vzdálenost dává smysl jen u kruhu; u nakresleného tvaru není od čeho.
        vzdalenost_m: o.stred ? vzdalenostM(o.stred, { lat: f.lat!, lng: f.lng! }) : null,
      }));

    const smazani = await supabase.from("oblast_firmy").delete().eq("oblast_id", oblastId);
    if (smazani.error) return smazani.error.message;

    // Po dávkách — velká oblast může mít desetitisíce firem a jeden
    // požadavek s takovým tělem by neprošel.
    for (let i = 0; i < radky.length; i += 500) {
      const { error } = await supabase.from("oblast_firmy").insert(radky.slice(i, i + 500));
      if (error) return error.message;
    }
    return null;
  }

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

    if (error) {
      setUklada(false);
      setHlaska(`Oblast se nepodařilo uložit: ${error.message}`);
      return;
    }

    // Bez zapamatování nového id by druhé kliknutí na Založit oblast
    // vyrobilo druhou stejnou oblast místo úpravy té první.
    const id = (data?.id as string | undefined) ?? upravovanaId;
    if (id) {
      setUpravovanaId(id);
      // Čerstvě založená oblast má být v mapě rovnou vidět.
      setZobrazene((p) => new Set(p).add(id));
      // A pro průvodce je rovnou tou vybranou — jinak by po nakreslení
      // nové oblasti tvrdil, že žádná vybraná není.
      onVyber?.(id);
    }

    // Zapisuje se až po uložení tvaru — jinak by seznam firem odkazoval
    // na oblast, která ještě neexistuje.
    const chybaZapisu = id ? await zapisPrislusnost(id, navrh) : null;

    const cerstve = await nactiOblasti().catch(() => null);
    if (cerstve) setOblasti(cerstve);
    setUklada(false);
    setRezim("prohlizeni");

    if (chybaZapisu) {
      setHlaska(
        `Tvar oblasti „${radek.nazev}" je uložený, ale seznam firem v ní se zapsat nepodařilo: ` +
          `${chybaZapisu} V aplikaci se počítá dál správně, jen o něm zatím neví příkazová řádka. ` +
          "Zkuste uložit znovu.",
      );
      return;
    }

    setHlaska(
      bylaNova
        ? `Oblast „${radek.nazev}" je založená. Firmy uvnitř vidíte v seznamu níž.`
        : `Oblast „${radek.nazev}" je uložená.`,
    );
  }

  async function potvrdSmazani() {
    if (!upravovanaId) return;
    setMaze(true);
    try {
      await smazOblast(upravovanaId);
      setKeSmazani(false);
      setOblasti((p) => p.filter((o) => o.id !== upravovanaId));
      const smazana = nazev;
      zahod();
      setHlaska(`Oblast „${smazana}“ je smazaná.`);
    } catch (e) {
      setKeSmazani(false);
      setHlaska((e as Error).message);
    } finally {
      setMaze(false);
    }
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
      <div className="pas-oblasti sloupec">
        <label className="pole">
          <span>Hledat obec nebo adresu</span>
          <input
            value={dotazMista}
            onChange={(e) => setDotazMista(e.target.value)}
            placeholder="Zbůch"
          />
        </label>
        {nalezena.length > 0 && (
          <div className="tlacitka vlevo">
            {nalezena.map((m) => (
              <button
                key={`${m.lat},${m.lng}`}
                className="tlacitko tise"
                onClick={() => {
                  setPresunNa({ stred: { lat: m.lat, lng: m.lng }, zoom: 13 });
                  setNalezena([]);
                  setDotazMista("");
                }}
              >
                {m.nazev}
              </button>
            ))}
          </div>
        )}

        {smiZapisovat && (
          <div className="tlacitka vlevo">
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

            {dovolUklid && upravovanaId && SMI_MAZAT.includes(role) && (
              <div className="uklid-oblasti">
                {vyuziti === null ? (
                  <p className="poznamka">Zjišťuji, jestli oblast někde nefiguruje…</p>
                ) : drziOblast(vyuziti) ? (
                  <p className="poznamka">
                    <strong>Smazat nejde.</strong> {drziOblast(vyuziti)}
                  </p>
                ) : (
                  <>
                    <p className="poznamka">
                      Oblast nikdo nepoužívá — nedrží ji kampaň ani průzkum.
                    </p>
                    <div className="tlacitka vlevo">
                      <button
                        className="tlacitko tise nebezpecne"
                        onClick={() => setKeSmazani(true)}
                      >
                        Smazat oblast
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {hlaska && <p className="poznamka zvyraznena">{hlaska}</p>}
          </div>
        )}

        <PanelVrstev
          oblasti={oblasti}
          zobrazene={zobrazene}
          vrstvy={vrstvy}
          prekryv={prekryv}
          otevrenaId={upravovanaId}
          onPrepni={prepniVrstvu}
          onVsechny={(zapnout) =>
            setZobrazene(zapnout ? new Set(oblasti.map((o) => o.id)) : new Set())
          }
          onOtevri={otevri}
        />

        <Mapa
          firmy={firmy}
          jidelny={jidelny}
          vrstvy={vrstvy}
          navrh={navrh}
          uvnitr={uvnitr}
          vPrekryvu={prekryv.firmy}
          rezim={rezim}
          onKlikDoMapy={klikDoMapy}
          onPosunVrcholu={posunVrcholu}
          onKlikNaVrstvu={(id) => {
            const o = oblasti.find((x) => x.id === id);
            if (o) otevri(o);
          }}
          vychozi={VYCHOZI}
          presunNa={presunNa}
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

      {keSmazani && (
        <div className="zaclona" role="dialog" aria-modal="true" aria-label="Smazat oblast">
          <div className="dialog">
            <h3>Smazat oblast „{nazev}“?</h3>
            <p>
              {vyuziti && vyuziti.firem > 0
                ? `Zmizí nakreslený tvar a s ním i seznam ${vyuziti.firem.toLocaleString("cs")} firem uvnitř. Vrátit to nepůjde.`
                : "Zmizí nakreslený tvar. Vrátit to nepůjde."}
            </p>
            {vyuziti && vyuziti.firem > 0 && (
              <p className="poznamka">
                Firmy samotné zůstanou — mizí jen údaj o tom, že spadly do téhle
                plochy. Kdykoli nakreslíte oblast znovu, spočítá se znovu i on.
              </p>
            )}
            <div className="tlacitka vlevo">
              <button
                className="tlacitko tise"
                onClick={() => setKeSmazani(false)}
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
    </>
  );
}
