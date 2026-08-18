import { useCallback, useEffect, useMemo, useState } from "react";
import { slozText, type NastaveniPole, type PodkladyFirmy } from "../../src/text-zpravy";
import {
  nactiNastaveniPoli,
  nactiPoleSablony,
  nactiSablony,
  ulozNastaveniPole,
  ulozSablonuKampane,
  type PoleSablony,
  type Sablona,
} from "./data";
import { supabase, type Role } from "./supabase";

/**
 * Pátý krok průvodce kampaní: Zpráva.
 *
 * Vybere se šablona, určí se čím se vyplní jednotlivá pole, a hned pod tím
 * je vidět hotový mail na **skutečné firmě** ze seznamu — ne na vymyšlené.
 *
 * Skládání textu dělá `src/text-zpravy.ts`, tedy **týž kód jako jádro**.
 * Opsat si ho sem by znamenalo dva různé maily pod jedním jménem (past
 * „pravidlo-v-jadru-nehlida-obrazovku").
 *
 * Nic se neodesílá — odesílání je vypnuté (TP-8) a přijde na řadu ve fázi 3.
 */

interface FirmaKZobrazeni {
  ico: string;
  nazev: string;
  chybi: string[];
  podklady: PodkladyFirmy;
}

interface Props {
  kampanId: string;
  role: Role;
  onZpet: () => void;
  onHotovo: () => void;
}

const POPIS_REZIMU: Record<string, string> = {
  z_dat: "vzít z dat",
  pevne: "napsat natvrdo",
  vynechat: "vynechat větu",
};

export function KrokZprava({ kampanId, role, onZpet, onHotovo }: Props) {
  const [sablony, setSablony] = useState<Sablona[]>([]);
  const [sablonaId, setSablonaId] = useState<string | null>(null);
  const [pole, setPole] = useState<PoleSablony[]>([]);
  const [nastaveni, setNastaveni] = useState<Record<string, NastaveniPole>>({});
  const [firmy, setFirmy] = useState<FirmaKZobrazeni[]>([]);
  const [cena, setCena] = useState<string | null>(null);
  const [vybranaFirma, setVybranaFirma] = useState<string | null>(null);
  const [nacita, setNacita] = useState(true);
  const [chyba, setChyba] = useState<string | null>(null);

  const smiUpravovat = role === "admin" || role === "super-admin";

  const nacti = useCallback(async () => {
    const s = await nactiSablony();
    setSablony(s);

    const { data: kampan } = await supabase
      .from("kampane")
      .select("template_id")
      .eq("id", kampanId)
      .single();

    const vybrana = (kampan?.template_id as string | null) ?? s[0]?.id ?? null;
    setSablonaId(vybrana);
    if (!vybrana) return;

    const p = await nactiPoleSablony(vybrana);
    setPole(p);

    const ulozene = await nactiNastaveniPoli(kampanId);
    const podleId = new Map(p.map((x) => [x.id, x.kod]));
    const mapa: Record<string, NastaveniPole> = {};
    for (const n of ulozene) {
      const kod = podleId.get(n.pole_id);
      if (kod) mapa[kod] = { kod, rezim: n.rezim, hodnota: n.hodnota };
    }
    setNastaveni(mapa);

    const { data: prehled, error } = await supabase.rpc("nahled_kampane", {
      p_kampan_id: kampanId,
    });
    if (error) throw new Error(error.message);

    const radky = (prehled ?? []) as Array<{
      ico: string;
      nazev: string;
      chybi: string[];
      prijmeni: string | null;
      oznaceni: string | null;
      vzdalenost_m: number | null;
      cena: string | null;
      parametry: Record<string, string> | null;
    }>;
    setCena(radky[0]?.cena ?? null);
    setFirmy(
      radky.map((r) => ({
        ico: r.ico,
        nazev: r.nazev,
        chybi: r.chybi ?? [],
        podklady: {
          prijmeni: r.prijmeni,
          oznaceni: r.oznaceni,
          vzdalenostM: r.vzdalenost_m,
          cena: r.cena,
          parametry: r.parametry ?? {},
        },
      })),
    );
  }, [kampanId]);

  useEffect(() => {
    nacti()
      .catch((e: Error) => setChyba(e.message))
      .finally(() => setNacita(false));
  }, [nacti]);

  const pripravene = useMemo(() => firmy.filter((f) => f.chybi.length === 0), [firmy]);
  const vyrazene = useMemo(() => firmy.filter((f) => f.chybi.length > 0), [firmy]);

  const nahled = useMemo(() => {
    const firma = firmy.find((f) => f.ico === vybranaFirma) ?? pripravene[0] ?? firmy[0];
    const sablona = sablony.find((s) => s.id === sablonaId);
    if (!firma || !sablona) return null;
    return {
      firma,
      predmet: sablona.predmet ?? "",
      telo: slozText(sablona.telo, Object.values(nastaveni), firma.podklady),
    };
  }, [firmy, pripravene, vybranaFirma, sablony, sablonaId, nastaveni]);

  async function zmenRezim(p: PoleSablony, rezim: NastaveniPole["rezim"]) {
    const puvodni = nastaveni[p.kod];
    const hodnota = rezim === "pevne" ? (puvodni?.hodnota ?? "") : null;
    setNastaveni((n) => ({ ...n, [p.kod]: { kod: p.kod, rezim, hodnota } }));
    try {
      await ulozNastaveniPole(kampanId, p.id, rezim, hodnota);
      setChyba(null);
    } catch (e) {
      setChyba((e as Error).message);
    }
  }

  async function zmenHodnotu(p: PoleSablony, hodnota: string) {
    setNastaveni((n) => ({ ...n, [p.kod]: { kod: p.kod, rezim: "pevne", hodnota } }));
    try {
      await ulozNastaveniPole(kampanId, p.id, "pevne", hodnota);
    } catch (e) {
      setChyba((e as Error).message);
    }
  }

  async function zmenSablonu(id: string) {
    setSablonaId(id);
    try {
      await ulozSablonuKampane(kampanId, id);
      setNacita(true);
      await nacti();
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setNacita(false);
    }
  }

  if (nacita) return <p className="nacitani">Načítám zprávu…</p>;

  return (
    <>
      <div className="sloupec">
        <h2>Zpráva</h2>
        <p className="podnadpis">
          Čím se vyplní jednotlivá pole a jak bude mail vypadat. Nic se odsud
          neodesílá — odesílání je vypnuté.
        </p>

        {chyba && (
          <p className="hlaska" role="alert">
            {chyba}
          </p>
        )}

        <div className="souhrn siroky">
          <p className="udaj">
            <span className="popisek">Připraveno k oslovení</span>
            <span className="hodnota">{pripravene.length}</span>
          </p>
          <p className="udaj">
            <span className="popisek">Nezahrne se</span>
            <span className="hodnota">{vyrazene.length}</span>
          </p>
          <p className="udaj">
            <span className="popisek">Cena ve zprávě</span>
            <span className="hodnota">{cena ?? "nemá se odkud vzít"}</span>
          </p>
        </div>
      </div>

      <div className="sloupec">
        <label className="pole">
          Šablona
          <select
            value={sablonaId ?? ""}
            disabled={!smiUpravovat}
            onChange={(e) => void zmenSablonu(e.target.value)}
          >
            {sablony.map((s) => (
              <option key={s.id} value={s.id}>
                {s.segment} · verze {s.verze}
              </option>
            ))}
          </select>
        </label>

        {pole.length === 0 ? (
          <p className="poznamka">Tahle šablona nemá žádné zástupné údaje.</p>
        ) : (
          pole.map((p) => {
            const n = nastaveni[p.kod] ?? { kod: p.kod, rezim: "z_dat" as const, hodnota: null };
            return (
              <div className="parametr-radek" key={p.id}>
                <label htmlFor={`pole-${p.id}`}>
                  {p.nazev}
                  {!p.povinne && <span className="poznamka"> (má náhradu)</span>}
                </label>
                <span className="volby">
                  {(["z_dat", "pevne", "vynechat"] as const).map((r) => (
                    <button
                      type="button"
                      key={r}
                      className={`volba ${n.rezim === r ? "zap" : ""}`}
                      aria-pressed={n.rezim === r}
                      disabled={!smiUpravovat}
                      onClick={() => void zmenRezim(p, r)}
                    >
                      {POPIS_REZIMU[r]}
                    </button>
                  ))}
                  {n.rezim === "pevne" && (
                    <input
                      id={`pole-${p.id}`}
                      value={n.hodnota ?? ""}
                      placeholder="text pro celou kampaň"
                      disabled={!smiUpravovat}
                      onChange={(e) => void zmenHodnotu(p, e.target.value)}
                    />
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="sloupec">
        <h3>Jak bude mail vypadat</h3>
        {nahled ? (
          <>
            <label className="pole">
              Na které firmě
              <select
                value={nahled.firma.ico}
                onChange={(e) => setVybranaFirma(e.target.value)}
              >
                {firmy.map((f) => (
                  <option key={f.ico} value={f.ico}>
                    {f.nazev}
                    {f.chybi.length > 0 ? " — nezahrne se" : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="nahled-zpravy">
              <p className="predmet-radek">
                <span className="popisek">Předmět</span> {nahled.predmet}
              </p>
              <pre className="telo-zpravy">{nahled.telo}</pre>
            </div>

            {nahled.firma.chybi.length > 0 && (
              <p className="hlaska" role="alert">
                Téhle firmě se nepošle nic: {nahled.firma.chybi.join(" · ")}
              </p>
            )}
          </>
        ) : (
          <div className="prazdno">V kampani není firma, na které by šlo mail ukázat.</div>
        )}
      </div>

      {vyrazene.length > 0 && (
        <div className="sloupec">
          <h3>Nezahrne se {vyrazene.length} firem — a proč</h3>
          <div className="obal-tabulky">
            <table className="tabulka">
              <thead>
                <tr>
                  <th>Firma</th>
                  <th>Co chybí</th>
                </tr>
              </thead>
              <tbody>
                {vyrazene.map((f) => (
                  <tr key={f.ico}>
                    <td>{f.nazev}</td>
                    <td className="duvody">
                      {f.chybi.map((d) => (
                        <span className="stav je-zamitnuty" key={d}>
                          <span className="znak" />
                          {d}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="poznamka">
            Chybějící údaj není porucha, ale práce pro průzkum. Jméno adresáta
            mezi nimi schválně není — bez něj se osloví „Dobrý den“ a mail se
            pošle.
          </p>
        </div>
      )}

      <div className="sloupec">
        <div className="tlacitka vlevo">
          <button className="tlacitko tise" onClick={onZpet}>
            Zpět na seznam firem
          </button>
          <button className="tlacitko tise" onClick={onHotovo}>
            Zavřít a vrátit se na kampaně
          </button>
        </div>
      </div>
    </>
  );
}
