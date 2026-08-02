import { useCallback, useEffect, useState } from "react";
import { MapaOblasti } from "./MapaOblasti";
import { SeznamOblasti } from "./SeznamOblasti";
import { nactiJidelny, nactiPrehledOblasti, type Jidelna, type PrehledOblasti } from "./data";
import { barvaOblasti } from "./vrstvy";
import type { Role } from "./supabase";

/**
 * Obrazovka Oblasti — mapa, pod ní seznam oblastí, úplně dole firmy.
 *
 * Pořadí si vyžádal majitel 2. 8., když seznam vystrčil mapu pod ohyb:
 * „to bych určitě otočil, abych první viděl mapu a až následně byly oblasti
 * a pak firmy." Mapa je to, podle čeho se člověk zorientuje; seznam odpovídá
 * na otázky, které přijdou až potom.
 *
 * Vybraná oblast je společná: kliknutí v seznamu ji otevře v mapě a naopak.
 * Mapa sama žije v `MapaOblasti`, protože ji používá i průvodce kampaní —
 * dvě samostatné mapy by se časem rozešly.
 */
export function Oblasti({ role }: { role: Role }) {
  const [prehled, setPrehled] = useState<PrehledOblasti[]>([]);
  const [jidelny, setJidelny] = useState<Jidelna[]>([]);
  const [nacita, setNacita] = useState(true);
  const [chyba, setChyba] = useState<string | null>(null);
  const [vybranaId, setVybranaId] = useState<string | null>(null);
  /**
   * Které oblasti jsou vidět v mapě. Drží to tahle obrazovka, ne mapa —
   * ovládá je seznam pod mapou a mapa už vlastní panel s oblastmi nekreslí
   * (majitel 3. 8.: „oblast má opět nastavené oblasti napravo v mapě").
   */
  const [zobrazene, setZobrazene] = useState<ReadonlySet<string>>(new Set());
  /** Dokud si člověk nic nepřepnul, jsou vidět všechny. */
  const [prepnutoRucne, setPrepnutoRucne] = useState(false);

  const obnov = useCallback(async () => {
    try {
      const [o, j] = await Promise.all([nactiPrehledOblasti(), nactiJidelny()]);
      setPrehled(o);
      setJidelny(j);
      setChyba(null);
      // Nově nakreslená oblast má být rovnou vidět; ruční výběr se nepřepisuje.
      if (!prepnutoRucne) setZobrazene(new Set(o.map((x) => x.id)));
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setNacita(false);
    }
  }, [prepnutoRucne]);

  useEffect(() => {
    void obnov();
  }, [obnov]);

  function prepniVrstvu(id: string) {
    setPrepnutoRucne(true);
    setZobrazene((p) => {
      const s = new Set(p);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  return (
    <>
      <div className="sloupec">
        <h2>Oblasti</h2>
        <p className="podnadpis">
          Území, ve kterém se hledají firmy. Kruh se rychle nastaví posuvníkem;
          když usekne sousední město v půlce, obkreslete tvar ručně.
        </p>
      </div>

      {/* Pořadí je záměr: nejdřív mapa, pak oblasti, pak firmy. Seznam
          oblastí se proto vkládá dovnitř mapy — seznam firem patří k ní
          a musí zůstat až úplně dole. */}
      <MapaOblasti
        role={role}
        vybranaId={vybranaId}
        onVyber={setVybranaId}
        onZmena={() => void obnov()}
        vrstvyZvenci={{ zobrazene, onPrepni: prepniVrstvu }}
      >
        <div className="sloupec">
          {chyba ? (
            <p className="hlaska" role="alert">
              Přehled oblastí se nepodařilo načíst: {chyba}
            </p>
          ) : nacita ? (
            <p className="nacitani">Načítám přehled oblastí…</p>
          ) : (
            <SeznamOblasti
              oblasti={prehled}
              jidelny={jidelny}
              role={role}
              otevrenaId={vybranaId}
              onOtevri={setVybranaId}
              vMape={{
                zobrazene,
                barva: (id) => barvaOblasti(prehled.findIndex((x) => x.id === id)),
                onPrepni: prepniVrstvu,
                onVsechny: (zapnout) => {
                  setPrepnutoRucne(true);
                  setZobrazene(zapnout ? new Set(prehled.map((x) => x.id)) : new Set());
                },
              }}
              onZmena={() => {
                // Po smazání nesmí zůstat vybraná — mapa by ji marně hledala.
                setVybranaId(null);
                void obnov();
              }}
            />
          )}
        </div>
      </MapaOblasti>
    </>
  );
}
