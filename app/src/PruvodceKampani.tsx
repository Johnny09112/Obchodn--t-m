import { useEffect, useState } from "react";
import { Krokovnik } from "./Krokovnik";
import { MapaOblasti } from "./MapaOblasti";
import {
  nactiFirmy,
  nactiLidi,
  nactiOblasti,
  nactiPravidlaSita,
  type Clovek,
  type RadekKampane,
} from "./data";
import { naOblast } from "./vrstvy";
import { supabase, type Role } from "./supabase";
import { duvodNeoslovovat } from "../../src/kvalifikace";
import { bodVOblasti } from "../../src/oblast-tvar";

/** Kdo smí kampaň upravovat. Totéž hlídá databáze — tohle je jen pohodlí. */
function smiUpravovat(kampan: RadekKampane | null, role: Role, email: string): boolean {
  if (role === "admin" || role === "super-admin") return true;
  if (!kampan) return true; // novou zakládá kdokoli z týmu
  return kampan.spravce === email || kampan.zastupce === email;
}

/**
 * Průvodce kampaní, kroky 1 a 2.
 *
 * Rozdělaná kampaň se ukládá po každém kroku (`stav = rozpracovana`,
 * `krok` = kde se skončilo), takže tu není tlačítko „uložit" — okno jde
 * zavřít a vrátit se k ní ze seznamu.
 */
export function PruvodceKampani({
  role,
  email,
  kampan,
  onHotovo,
}: {
  role: Role;
  email: string;
  /** Rozdělaná kampaň k pokračování, nebo `null` pro novou. */
  kampan: RadekKampane | null;
  onHotovo: () => void;
}) {
  const [id, setId] = useState<string | null>(kampan?.id ?? null);
  const [krok, setKrok] = useState<1 | 2>(kampan && kampan.krok >= 2 ? 2 : 1);
  const [nazev, setNazev] = useState(kampan?.nazev ?? "");
  const [kontext, setKontext] = useState("");
  const [zastupce, setZastupce] = useState(kampan?.zastupce ?? "");
  const [oblastId, setOblastId] = useState<string | null>(kampan?.oblast_id ?? null);
  const [lide, setLide] = useState<Clovek[]>([]);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [pocty, setPocty] = useState<{ uvnitr: number; projde: number } | null>(null);

  const smi = smiUpravovat(kampan, role, email);

  useEffect(() => {
    // Seznam lidí je pro výběr zástupu. Když se nenačte, průvodce funguje
    // dál — jen bez zástupu, což je nepovinné pole.
    nactiLidi()
      .then(setLide)
      .catch(() => setLide([]));
  }, []);

  // Kolik firem v území leží a kolik jich projde sítem. Dvě čísla, ne jedno:
  // mezi územím a kampaní je síto, takže se liší — a kdyby to obrazovka
  // zamlčela, vypadal by rozdíl v posledním kroku jako chyba.
  useEffect(() => {
    if (!oblastId) {
      setPocty(null);
      return;
    }
    let platne = true;

    Promise.all([nactiFirmy(), nactiOblasti(), nactiPravidlaSita()])
      .then(([firmy, oblasti, sito]) => {
        if (!platne) return;
        const radek = oblasti.find((o) => o.id === oblastId);
        if (!radek) {
          setPocty(null);
          return;
        }
        const tvar = naOblast(radek);

        const uvnitr = firmy.filter(
          (f) =>
            f.lat !== null && f.lng !== null && bodVOblasti(tvar, { lat: f.lat, lng: f.lng }),
        );
        const projde = uvnitr.filter(
          (f) =>
            duvodNeoslovovat({
              ico: f.ico,
              nazev: f.nazev,
              czNace: f.cz_nace,
              pravniForma: f.pravni_forma,
              maVlastniJidelnu: f.ma_vlastni_jidelnu,
              partnerskaIca: sito.partnerskaIca,
              blacklist: sito.blacklist,
            }) === null,
        );

        setPocty({ uvnitr: uvnitr.length, projde: projde.length });
      })
      .catch(() => setPocty(null));

    return () => {
      platne = false;
    };
  }, [oblastId]);

  /** Krok 1 — založí novou kampaň, nebo uloží změny do rozdělané. */
  async function ulozZalozeni() {
    if (!nazev.trim()) {
      setChyba("Kampaň potřebuje název — podle něj ji poznáte v seznamu.");
      return;
    }
    setUklada(true);
    setChyba(null);

    const hodnoty = {
      nazev: nazev.trim(),
      kontext: kontext.trim() || null,
      zastupce: zastupce || null,
    };

    // `select("id")` je tu podstatné: bez zapamatovaného id by druhý krok
    // neměl co doplnit a vybrané území by se zahodilo.
    const { data, error } = id
      ? await supabase.from("kampane").update(hodnoty).eq("id", id).select("id").single()
      : await supabase
          .from("kampane")
          .insert({ ...hodnoty, spravce: email })
          .select("id")
          .single();

    setUklada(false);
    if (error) {
      // 23505 = porušení jedinečnosti. Databáze hlídá název bez ohledu na
      // velikost písmen, formulář by to sám nepoznal.
      setChyba(
        error.code === "23505"
          ? "Kampaň s tímhle názvem už existuje. Zvolte jiný — na velikosti písmen nezáleží."
          : `Kampaň se nepodařilo uložit: ${error.message}`,
      );
      return;
    }

    setId((data?.id as string | undefined) ?? id);
    setKrok(2);
  }

  /** Krok 2 — uloží vybrané území a zavře průvodce. */
  async function ulozUzemi() {
    if (!id || !oblastId) return;
    setUklada(true);
    setChyba(null);

    const { error } = await supabase
      .from("kampane")
      .update({ oblast_id: oblastId, krok: 2 })
      .eq("id", id);

    setUklada(false);
    if (error) {
      setChyba(`Území se nepodařilo uložit: ${error.message}`);
      return;
    }
    onHotovo();
  }

  if (!smi) {
    return (
      <div className="sloupec">
        <h2>{kampan?.nazev}</h2>
        <p className="hlaska" role="alert">
          Tuhle kampaň upravovat nemůžete — patří pod {kampan?.spravce}. Požádejte
          o zástup, nebo ať ji upraví správce či admin.
        </p>
        <div className="tlacitka vlevo">
          <button className="tlacitko tise" onClick={onHotovo}>
            Zpět na kampaně
          </button>
        </div>
      </div>
    );
  }

  // ── krok 2: území

  if (krok === 2) {
    const vyrazeno = pocty ? pocty.uvnitr - pocty.projde : 0;
    return (
      <>
        <div className="sloupec">
          <h2>{nazev || "Nová kampaň"}</h2>
          <Krokovnik krok={2} />
          <p className="podnadpis">
            Vyberte v mapě území, ze kterého se kampaň naplní — nebo nakreslete
            nové.
          </p>
        </div>

        {/* Souhrn a tlačítka patří NAD mapu: mapa pod sebou vypisuje všechny
            firmy v oblasti, takže by se rozhodnutí ocitlo až za tabulkou
            o desítkách řádků a nikdo by ho nenašel. */}
        <div className="sloupec">
          {pocty && (
            <>
              <p className="udaj">
                <span className="popisek">V území leží</span>
                <span className="hodnota">{pocty.uvnitr}</span>
              </p>
              <p className="udaj">
                <span className="popisek">Do kampaně projde</span>
                <span className="hodnota">{pocty.projde}</span>
              </p>
              {vyrazeno > 0 && (
                <p className="hlaska je-klid">
                  {vyrazeno === 1 ? "Jednu firmu" : `${vyrazeno} firem`} síto
                  nepustí — je na blacklistu, je to bytový dům, naše partnerská
                  jídelna, nebo má vlastní jídelnu. Důvod u každé uvidíte
                  v posledním kroku.
                </p>
              )}
            </>
          )}

          {chyba && (
            <p className="hlaska" role="alert">
              {chyba}
            </p>
          )}

          <p className="poznamka">
            {oblastId
              ? "Území se uloží ke kampani. Průzkum a seznam firem (kroky 3 a 4) se teprve staví — kampaň zůstane rozpracovaná a vrátíte se k ní ze seznamu."
              : "Nejdřív vyberte v mapě oblast, nebo nakreslete novou."}
          </p>

          <div className="tlacitka vlevo">
            <button className="tlacitko tise" onClick={() => setKrok(1)}>
              Zpět na založení
            </button>
            <button
              className="tlacitko"
              disabled={!oblastId || uklada}
              onClick={ulozUzemi}
            >
              {uklada ? "Ukládám…" : "Uložit území a zavřít"}
            </button>
          </div>
        </div>

        <MapaOblasti role={role} vybranaId={oblastId} onVyber={setOblastId} />
      </>
    );
  }

  // ── krok 1: založení

  return (
    <div className="sloupec">
      <h2>{kampan ? nazev : "Nová kampaň"}</h2>
      <Krokovnik krok={1} />

      <label className="pole">
        <span>Název kampaně</span>
        <input
          value={nazev}
          onChange={(e) => setNazev(e.target.value)}
          placeholder="Jaro Zbůch"
        />
      </label>
      <p className="poznamka">Podle názvu kampaň poznáte v seznamu. Musí být jedinečný.</p>

      <label className="pole">
        <span>K čemu kampaň je (nepovinné)</span>
        <textarea rows={3} value={kontext} onChange={(e) => setKontext(e.target.value)} />
      </label>
      <p className="poznamka">Poznámka pro vás a kolegy. Nikam se neposílá.</p>

      <p className="udaj">
        <span className="popisek">Správce kampaně</span>
        <span className="hodnota">{kampan?.spravce ?? email}</span>
      </p>
      <p className="poznamka">
        {kampan ? "Kampaň založil tenhle člověk." : "Doplní se sám podle přihlášení — kampaň je vaše."}
      </p>

      <label className="pole">
        <span>Zástup (nepovinné)</span>
        <select value={zastupce} onChange={(e) => setZastupce(e.target.value)}>
          <option value="">nikdo</option>
          {lide
            .filter((c) => c.email !== (kampan?.spravce ?? email))
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

      <div className="tlacitka vlevo">
        <button className="tlacitko tise" onClick={onHotovo}>
          Zpět na kampaně
        </button>
        <button className="tlacitko" onClick={ulozZalozeni} disabled={uklada}>
          {uklada ? "Ukládám…" : "Pokračovat na území"}
        </button>
      </div>
    </div>
  );
}
