import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Mapa, type Rezim } from "./Mapa";
import { PanelVrstev } from "./PanelVrstev";
import { PrekryvOblasti } from "./PrekryvOblasti";
import { SeznamFirem } from "./SeznamFirem";
import { supabase, type Role } from "./supabase";
import { najdiPrekryv, naOblast, spoctiVrstvy } from "./vrstvy";
import { najdiMisto, type Misto } from "./hledaniMista";
import { bodVOblasti, type Oblast } from "../../src/oblast-tvar";
import { vzdalenostM, type Bod } from "../../src/geo";
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

const SMI_ZAPISOVAT: Role[] = ["super-admin", "admin", "uzivatel"];

export interface MapaOblastiProps {
  /** Kdo se dívá — kreslit smí jen tým, host jen prohlíží. */
  role: Role;
  /** Zavolá se, kdykoli se změní vybraná oblast. `null` = žádná. */
  onVyber?: (oblastId: string | null) => void;
  /**
   * Která oblast má být otevřená. Mapa ji poslechne, kdykoli se změní —
   * tak ji otevírá seznam nad mapou. Loop nehrozí: když se hodnota shoduje
   * s tím, co je otevřené (i po vlastním kliknutí do mapy), nic se neděje.
   */
  vybranaId?: string | null;
  /**
   * Oblast se uložila. Seznam z toho žije — bez toho by po nakreslení nové
   * oblasti ukazoval starý stav, dokud se stránka nenačte.
   */
  onZmena?: () => void;
  /**
   * Obsah mezi mapou a seznamem firem.
   *
   * Majitel 2. 8.: „to bych určitě otočil, abych první viděl mapu a až
   * následně byly oblasti a pak firmy." Seznam firem přitom patří k mapě
   * (ukazuje, co je ve vybraném tvaru), takže se sem seznam oblastí vkládá
   * mezi ně, místo aby se mapa rozřezala na dvě komponenty.
   */
  children?: ReactNode;
  /**
   * Ovládání vrstev zvenčí. Když se předá, mapa **nekreslí vlastní panel**
   * s oblastmi — vypisuje je seznam pod mapou a dva seznamy téhož by jen
   * mátly (majitel 3. 8.: „oblast má opět nastavené oblasti napravo v mapě").
   *
   * Bez toho si mapa vrstvy řídí sama a panel ukazuje — tak ji používá
   * průvodce kampaní, kde seznam pod mapou slouží k výběru území.
   */
  vrstvyZvenci?: {
    zobrazene: ReadonlySet<string>;
    onPrepni: (id: string) => void;
  };
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
  onZmena,
  children,
  vrstvyZvenci,
}: MapaOblastiProps) {
  const [firmy, setFirmy] = useState<Firma[]>([]);
  const [jidelny, setJidelny] = useState<Jidelna[]>([]);
  const [kategorie, setKategorie] = useState<Kategorie[]>([]);
  const [oblasti, setOblasti] = useState<RadekOblasti[]>([]);
  const [nacita, setNacita] = useState(true);
  /** Firmy dobíhají po mapě — samy o sobě ji neblokují. */
  const [nacitaFirmy, setNacitaFirmy] = useState(true);
  const [chyba, setChyba] = useState<string | null>(null);

  const [navrh, setNavrh] = useState<Oblast | null>(null);
  const [upravovanaId, setUpravovanaId] = useState<string | null>(null);
  const [rezim, setRezim] = useState<Rezim>("prohlizeni");
  const [nazev, setNazev] = useState("");
  const [jidelnaId, setJidelnaId] = useState("");
  const [uklada, setUklada] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [vlastniZobrazene, setVlastniZobrazene] = useState<ReadonlySet<string>>(new Set());
  const zobrazene = vrstvyZvenci?.zobrazene ?? vlastniZobrazene;
  const setZobrazene = setVlastniZobrazene;

  const [dotazMista, setDotazMista] = useState("");
  const [nalezena, setNalezena] = useState<Misto[]>([]);
  const [presunNa, setPresunNa] = useState<{ stred: Bod; zoom: number } | null>(null);

  /**
   * Načítá se ve dvou vlnách, ne najednou.
   *
   * Kartotéka má přes 13 tisíc firem a server jich vydá nejvýš tisíc naráz,
   * takže je to čtrnáct dotazů za sebou — půl minuty. Dokud se čekalo na
   * všechny, obrazovka místo mapy ukazovala „Načítám" a vypadalo to, že mapa
   * zmizela (majitel to tak taky nahlásil).
   *
   * Tvary oblastí přitom firmy k vykreslení nepotřebují. Mapa se proto ukáže
   * hned, jakmile jsou oblasti a jídelny, a značky firem do ní doskáčou.
   */
  useEffect(() => {
    Promise.all([nactiJidelny(), nactiKategorie(), nactiOblasti()])
      .then(([j, k, o]) => {
        setJidelny(j);
        setKategorie(k);
        setOblasti(o);
        setZobrazene(new Set(o.map((x) => x.id)));
      })
      .catch((e: Error) => setChyba(e.message))
      .finally(() => setNacita(false));
  }, []);

  useEffect(() => {
    // Firmy zvlášť: když se nenačtou, mapa i kreslení fungují dál — jen bez
    // značek a bez počtu firem uvnitř. To je lepší než prázdná obrazovka.
    nactiFirmy()
      .then(setFirmy)
      .catch(() => setFirmy([]))
      .finally(() => setNacitaFirmy(false));
  }, []);

  // Otevři, co si vybral někdo zvenčí — seznam nad mapou nebo návrat do
  // rozdělané kampaně. Když se výběr shoduje s tím, co je otevřené, neděje
  // se nic; proto to nezacyklí ani vlastní kliknutí do mapy, které volá
  // `onVyber` a vrátí se sem stejnou hodnotou.
  useEffect(() => {
    if (!vybranaId || vybranaId === upravovanaId) return;
    const o = oblasti.find((x) => x.id === vybranaId);
    if (!o) return;
    const tvar = naOblast(o);
    setNavrh(tvar);
    setUpravovanaId(o.id);
    setNazev(o.nazev);
    setJidelnaId(o.jidelna_id ?? "");
    setRezim("prohlizeni");
    setHlaska(null);
    setZamerNa({ klic: `${o.id}:${Date.now()}`, oblast: tvar });
    setZobrazene((p) => new Set(p).add(o.id));
  }, [vybranaId, upravovanaId, oblasti]);

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

  function prepniVrstvu(id: string) {
    if (vrstvyZvenci) {
      vrstvyZvenci.onPrepni(id);
      return;
    }
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

  /** Partnerské jídelny, které leží v nakresleném tvaru. */
  const jidelnyUvnitr = useMemo(
    () =>
      navrh
        ? jidelny.filter(
            (j) =>
              j.lat !== null && j.lng !== null && bodVOblasti(navrh, { lat: j.lat, lng: j.lng }),
          )
        : [],
    [navrh, jidelny],
  );

  /**
   * Na kterou oblast přiblížit. Klíč se mění při každém otevření, aby mapa
   * přeskočila i tehdy, když člověk klikne na tutéž oblast znovu — ale
   * neuskakovala při každém posunu bodu během úpravy.
   */
  const [zamerNa, setZamerNa] = useState<{ klic: string; oblast: Oblast } | null>(null);

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
    const tvar = naOblast(r);
    setNavrh(tvar);
    setUpravovanaId(r.id);
    setNazev(r.nazev);
    setJidelnaId(r.jidelna_id ?? "");
    setRezim("prohlizeni");
    setHlaska(null);
    // Mapa má na oblast přeskočit — jinak se u vzdálené oblasti hledá tvar
    // mimo obrazovku (majitel 3. 8.).
    setZamerNa({ klic: `${r.id}:${Date.now()}`, oblast: tvar });
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
    onZmena?.();

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

  if (chyba) {
    return (
      <p className="hlaska" role="alert">
        Data se nepodařilo načíst: {chyba}
      </p>
    );
  }
  if (nacita) return <p className="nacitani">Načítám mapu…</p>;

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

      {nacitaFirmy && (
        <div className="sloupec">
          <p className="poznamka">
            Mapa je hotová, značky firem ještě dobíhají — kartotéka má přes
            třináct tisíc firem a server je vydává po tisícovkách.
          </p>
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

                  {/*
                    Jídelna se k oblasti nepřiřazuje ručně (majitel 3. 8.).
                    Oblast je plocha na mapě — co v ní leží, se dá spočítat,
                    a ručně vybraná jídelna se s překreslením tvaru rozešla
                    s realitou. Přiřazení jídelny nebo bodu ke konkrétní
                    firmě přijde až s obchodními use-case.
                  */}
                  <p className="udaj">
                    <span className="popisek">Jídelny uvnitř</span>
                    <span className="hodnota">{jidelnyUvnitr.length}</span>
                  </p>
                  {jidelnyUvnitr.length > 0 ? (
                    <ul className="seznam-jidelen">
                      {jidelnyUvnitr.map((j) => (
                        <li key={j.id}>{j.nazev}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="poznamka">
                      V tomhle tvaru zatím žádná partnerská jídelna neleží.
                      Oblast na ni nečeká — smysl má i bez ní.
                    </p>
                  )}

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

        {/* Panel s oblastmi jen tehdy, když si vrstvy řídí mapa sama. Jinak
            je vypisuje seznam pod mapou a dva seznamy téhož jen matou. */}
        {!vrstvyZvenci && (
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
        )}

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
          zamerNa={zamerNa}
        />
      </div>

      {/* Když panel u mapy není, překryv se ukazuje pod ní — je to varování
          k TP-5 a nesmí zmizet jen proto, že zmizel panel. */}
      {vrstvyZvenci && (
        <div className="sloupec">
          <PrekryvOblasti prekryv={prekryv} vrstvy={vrstvy} />
        </div>
      )}

      {children}

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
