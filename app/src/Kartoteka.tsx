import { useEffect, useState } from "react";
import { SeznamFirem } from "./SeznamFirem";
import { nactiFirmy, nactiKategorie, type Firma, type Kategorie } from "./data";

export function Kartoteka() {
  const [firmy, setFirmy] = useState<Firma[] | null>(null);
  const [kategorie, setKategorie] = useState<Kategorie[]>([]);
  const [chyba, setChyba] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([nactiFirmy(), nactiKategorie()])
      .then(([f, k]) => {
        setFirmy(f);
        setKategorie(k);
      })
      .catch((e: Error) => setChyba(e.message));
  }, []);

  if (chyba) {
    return (
      <p className="hlaska sloupec" role="alert">
        Kartotéku se nepodařilo načíst: {chyba}
      </p>
    );
  }
  if (!firmy) return <p className="nacitani">Načítám kartotéku…</p>;

  return (
    <div className="sloupec">
      <p className="podnadpis odsazeny">
        Firmy ověřené proti rejstříku. Zapisuje je agent, tady se jen prohlížejí.
      </p>
      <SeznamFirem firmy={firmy} kategorie={kategorie} nadpis="Kartotéka" />
    </div>
  );
}
