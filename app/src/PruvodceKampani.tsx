import { useEffect, useState } from "react";
import { Krokovnik } from "./Krokovnik";
import { nactiLidi, type Clovek } from "./data";
import { supabase, type Role } from "./supabase";

/**
 * Průvodce kampaní, kroky 1 a 2.
 *
 * Rozdělaná kampaň se ukládá po každém kroku (`stav = rozpracovana`,
 * `krok` = kde se skončilo), takže tu není žádné tlačítko „uložit" —
 * okno jde kdykoli zavřít a vrátit se ze seznamu.
 *
 * `role` se v kroku 1 nepoužije; předává se dál mapě v kroku 2.
 */
export function PruvodceKampani({
  role,
  email,
  onHotovo,
}: {
  role: Role;
  email: string;
  onHotovo: () => void;
}) {
  const [krok, setKrok] = useState<1 | 2>(1);
  const [nazev, setNazev] = useState("");
  const [kontext, setKontext] = useState("");
  const [zastupce, setZastupce] = useState("");
  const [lide, setLide] = useState<Clovek[]>([]);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  useEffect(() => {
    // Seznam lidí je pro výběr zástupu. Když se nenačte, průvodce funguje
    // dál — jen bez zástupu, což je nepovinné pole.
    nactiLidi()
      .then(setLide)
      .catch(() => setLide([]));
  }, []);

  async function zaloz() {
    if (!nazev.trim()) {
      setChyba("Kampaň potřebuje název — podle něj ji poznáte v seznamu.");
      return;
    }
    setUklada(true);
    setChyba(null);

    const { error } = await supabase.from("kampane").insert({
      nazev: nazev.trim(),
      kontext: kontext.trim() || null,
      spravce: email,
      zastupce: zastupce || null,
    });

    setUklada(false);
    if (error) {
      // 23505 = porušení jedinečnosti. Databáze hlídá název bez ohledu na
      // velikost písmen, formulář by to sám nepoznal.
      setChyba(
        error.code === "23505"
          ? "Kampaň s tímhle názvem už existuje. Zvolte jiný — na velikosti písmen nezáleží."
          : `Kampaň se nepodařilo založit: ${error.message}`,
      );
      return;
    }
    setKrok(2);
  }

  if (krok === 2) {
    return (
      <div className="sloupec">
        <h2>Nová kampaň</h2>
        <Krokovnik krok={2} />
        <p className="hlaska je-klid">Území se vybírá v mapě — přijde vzápětí.</p>
        <div className="tlacitka">
          <button className="tlacitko tise" onClick={onHotovo}>
            Zpět na kampaně
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sloupec">
      <h2>Nová kampaň</h2>
      <Krokovnik krok={1} />

      <label className="pole">
        <span>Název kampaně</span>
        <input
          value={nazev}
          onChange={(e) => setNazev(e.target.value)}
          placeholder="Jaro Zbůch"
        />
      </label>
      <p className="poznamka">
        Podle názvu kampaň poznáte v seznamu. Musí být jedinečný.
      </p>

      <label className="pole">
        <span>K čemu kampaň je (nepovinné)</span>
        <textarea rows={3} value={kontext} onChange={(e) => setKontext(e.target.value)} />
      </label>
      <p className="poznamka">Poznámka pro vás a kolegy. Nikam se neposílá.</p>

      <p className="udaj">
        <span className="popisek">Správce kampaně</span>
        <span className="hodnota">{email}</span>
      </p>
      <p className="poznamka">Doplní se sám podle přihlášení — kampaň je vaše.</p>

      <label className="pole">
        <span>Zástup (nepovinné)</span>
        <select value={zastupce} onChange={(e) => setZastupce(e.target.value)}>
          <option value="">nikdo</option>
          {lide
            .filter((c) => c.email !== email)
            .map((c) => (
              <option key={c.id} value={c.email}>
                {c.email}
              </option>
            ))}
        </select>
      </label>
      <p className="poznamka">
        Kdo smí kampaň upravovat, když nebudete k dispozici. Schvalovat kampaň
        může dál jen admin. Změnit jde kdykoli později.
      </p>

      {chyba && (
        <p className="hlaska" role="alert">
          {chyba}
        </p>
      )}

      <div className="tlacitka">
        <button className="tlacitko tise" onClick={onHotovo}>
          Zrušit
        </button>
        <button className="tlacitko tise" onClick={zaloz} disabled={uklada}>
          {uklada ? "Zakládám…" : "Pokračovat na území"}
        </button>
      </div>
    </div>
  );
}
