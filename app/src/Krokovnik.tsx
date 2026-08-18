const KROKY = ["Založení", "Území", "Průzkum", "Seznam firem", "Zpráva"] as const;

/**
 * Ukazatel kroku průvodce.
 *
 * Je to seznam, ne obrázek — čtečka obrazovky pak přečte „krok 2 ze 4,
 * Území". Stav kroku nese tvar i barva: hotový má vyplněné kolečko
 * s fajfkou, právě probíhající silnější obrys.
 */
export function Krokovnik({ krok }: { krok: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <ol className="krokovnik">
      {KROKY.map((nazev, i) => {
        const cislo = i + 1;
        const trida = cislo < krok ? "hotovy" : cislo === krok ? "tady" : "";
        return (
          <li
            key={nazev}
            className={`krok ${trida}`}
            aria-current={cislo === krok ? "step" : undefined}
          >
            <span className="cislo" aria-hidden="true">
              {cislo < krok ? "✓" : cislo}
            </span>
            <span className="skryty">Krok {cislo} z {KROKY.length}: </span>
            {nazev}
          </li>
        );
      })}
    </ol>
  );
}
