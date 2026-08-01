import { useCallback, useEffect, useState } from "react";
import { MapaOblasti } from "./MapaOblasti";
import { SeznamOblasti } from "./SeznamOblasti";
import { nactiJidelny, nactiPrehledOblasti, type Jidelna, type PrehledOblasti } from "./data";
import type { Role } from "./supabase";

/**
 * Obrazovka Oblasti — seznam s detailem nahoře, mapa pod ním.
 *
 * Seznam je hlavní cesta: podle něj se pozná, co je prozkoumané, co něco
 * drží a co jde uklidit. Mapa zůstává na kreslení a na to, aby bylo vidět,
 * kde oblasti leží a kde se překrývají.
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

  const obnov = useCallback(async () => {
    try {
      const [o, j] = await Promise.all([nactiPrehledOblasti(), nactiJidelny()]);
      setPrehled(o);
      setJidelny(j);
      setChyba(null);
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setNacita(false);
    }
  }, []);

  useEffect(() => {
    void obnov();
  }, [obnov]);

  return (
    <>
      <div className="sloupec">
        <h2>Oblasti</h2>
        <p className="podnadpis">
          Území, ve kterém se hledají firmy. Kruh se rychle nastaví posuvníkem;
          když usekne sousední město v půlce, obkreslete tvar ručně.
        </p>
      </div>

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
            onZmena={() => {
              // Po smazání nesmí zůstat vybraná — mapa by ji marně hledala.
              setVybranaId(null);
              void obnov();
            }}
          />
        )}
      </div>

      <MapaOblasti
        role={role}
        vybranaId={vybranaId}
        onVyber={setVybranaId}
        onZmena={() => void obnov()}
      />
    </>
  );
}
