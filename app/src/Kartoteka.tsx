import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

interface Firma {
  ico: string;
  nazev: string;
  obec: string | null;
  velikost_kategorie: string | null;
  zamestnanci_odhad: number | null;
  skore: number | null;
  stav: string;
  contacts: { count: number }[];
}

const STAVY: Record<string, { popis: string; trida: string }> = {
  novy: { popis: "nová", trida: "je-novy" },
  kvalifikovany: { popis: "kvalifikovaná", trida: "je-kvalifikovany" },
  cekajici_na_jidelnu: { popis: "čeká na jídelnu", trida: "je-ceka" },
  zamitnuty: { popis: "zamítnutá", trida: "je-zamitnuty" },
  osloveny: { popis: "oslovená", trida: "je-jinak" },
  jednani: { popis: "jednání", trida: "je-jinak" },
  zakaznik: { popis: "zákazník", trida: "je-kvalifikovany" },
};

const VELIKOSTI: Record<string, string> = {
  mikro: "mikro",
  mala: "malá",
  stredni: "střední",
  velka: "velká",
};

function Stav({ stav }: { stav: string }) {
  const s = STAVY[stav] ?? { popis: stav, trida: "je-jinak" };
  return (
    <span className={`stav ${s.trida}`}>
      <span className="znak" aria-hidden="true" />
      {s.popis}
    </span>
  );
}

export function Kartoteka() {
  const [firmy, setFirmy] = useState<Firma[] | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hledani, setHledani] = useState("");

  useEffect(() => {
    supabase
      .from("companies")
      .select("ico,nazev,obec,velikost_kategorie,zamestnanci_odhad,skore,stav,contacts(count)")
      .order("skore", { ascending: false, nullsFirst: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (error) setChyba(error.message);
        else setFirmy((data ?? []) as Firma[]);
      });
  }, []);

  const videt = useMemo(() => {
    if (!firmy) return [];
    const q = hledani.trim().toLocaleLowerCase("cs");
    if (!q) return firmy;
    return firmy.filter(
      (f) =>
        f.nazev.toLocaleLowerCase("cs").includes(q) ||
        (f.obec ?? "").toLocaleLowerCase("cs").includes(q) ||
        f.ico.includes(q),
    );
  }, [firmy, hledani]);

  const souhrn = useMemo(() => {
    const f = videt;
    return {
      firem: f.length,
      sKontaktem: f.filter((x) => (x.contacts[0]?.count ?? 0) > 0).length,
      kvalifikovanych: f.filter((x) => x.stav === "kvalifikovany").length,
      obci: new Set(f.map((x) => x.obec).filter(Boolean)).size,
    };
  }, [videt]);

  if (chyba) {
    return (
      <p className="hlaska" role="alert">
        Kartotéku se nepodařilo načíst: {chyba}
      </p>
    );
  }

  if (!firmy) return <p className="nacitani">Načítám kartotéku…</p>;

  return (
    <>
      <h2>Kartotéka</h2>
      <p className="podnadpis">
        Firmy ověřené proti rejstříku. Zapisuje je agent, tady se jen prohlížejí.
      </p>

      <div className="souhrn">
        <p className="udaj">
          <span className="popisek">Firem</span>
          <span className="hodnota">{souhrn.firem}</span>
        </p>
        <p className="udaj">
          <span className="popisek">Se spojením</span>
          <span className="hodnota">{souhrn.sKontaktem}</span>
        </p>
        <p className="udaj">
          <span className="popisek">Kvalifikovaných</span>
          <span className="hodnota">{souhrn.kvalifikovanych}</span>
        </p>
        <p className="udaj">
          <span className="popisek">Obcí</span>
          <span className="hodnota">{souhrn.obci}</span>
        </p>
      </div>

      <label className="pole" style={{ maxWidth: "22rem" }}>
        <span>Hledat v názvu, obci nebo IČO</span>
        <input value={hledani} onChange={(e) => setHledani(e.target.value)} type="search" />
      </label>

      {videt.length === 0 ? (
        <p className="prazdno">
          {firmy.length === 0
            ? "Kartotéka je zatím prázdná. Naplní ji Čmuchal, až proběhne sběr."
            : "Tomuhle hledání neodpovídá žádná firma. Zkuste kratší výraz."}
        </p>
      ) : (
        <div className="obal-tabulky">
          <table className="tabulka">
            <thead>
              <tr>
                <th>Firma</th>
                <th>IČO</th>
                <th>Obec</th>
                <th>Velikost</th>
                <th className="cislo">Zam.</th>
                <th className="cislo">Spojení</th>
                <th className="cislo">Skóre</th>
                <th>Stav</th>
              </tr>
            </thead>
            <tbody>
              {videt.map((f) => (
                <tr key={f.ico}>
                  <td>{f.nazev}</td>
                  <td className="ico">{f.ico}</td>
                  <td>{f.obec ?? "—"}</td>
                  <td>{f.velikost_kategorie ? (VELIKOSTI[f.velikost_kategorie] ?? f.velikost_kategorie) : "—"}</td>
                  <td className="cislo">{f.zamestnanci_odhad ?? "—"}</td>
                  <td className="cislo">{f.contacts[0]?.count ?? 0}</td>
                  <td className="cislo">{f.skore ?? "—"}</td>
                  <td>
                    <Stav stav={f.stav} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
