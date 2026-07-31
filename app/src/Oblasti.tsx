import { MapaOblasti } from "./MapaOblasti";
import type { Role } from "./supabase";

/**
 * Obrazovka Oblasti — jen nadpis a sdílená mapa.
 *
 * Mapa sama žije v `MapaOblasti`, protože ji používá i průvodce kampaní.
 * Dvě samostatné mapy by se časem rozešly.
 */
export function Oblasti({ role }: { role: Role }) {
  return (
    <>
      <div className="sloupec">
        <h2>Oblasti</h2>
        <p className="podnadpis">
          Území, ve kterém se hledají firmy. Kruh se rychle nastaví posuvníkem;
          když usekne sousední město v půlce, obkreslete tvar ručně.
        </p>
      </div>
      <MapaOblasti role={role} />
    </>
  );
}
