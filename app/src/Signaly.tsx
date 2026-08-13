import { useEffect, useMemo, useState } from "react";
import {
  nactiKampaneProVyber,
  nactiSignaly,
  pridejFirmuDoKampane,
  type KampanProVyber,
  type Signal,
} from "./data";

/**
 * Co je nového — obchodní podněty seřazené podle síly a stáří.
 *
 * **Proč tahle obrazovka existuje:** kartotéka odpovídá na otázku „koho
 * máme", ale ne na tu, která rozhoduje o dnešku — „komu volat teď a proč".
 * Seznam firem vypadá každý den stejně; podnět je událost, která vyprchá.
 *
 * Vylučovací podněty („vaří si sama, neoslovovat") se **nezahazují**.
 * Ušetřený hovor se počítá stejně jako nalezená příležitost, jen se čte
 * obráceně — proto mají vlastní přepínač a odlišený vzhled.
 *
 * Nic se odsud neodesílá (TP-8). Podnět je důvod k oslovení, ne oslovení.
 */

type Vyber = "prilezitosti" | "vylucovaci" | "vse";

function stari(iso: string): string {
  const dnu = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dnu <= 0) return "dnes";
  if (dnu === 1) return "včera";
  if (dnu < 7) return `před ${dnu} dny`;
  if (dnu < 31) return `před ${Math.floor(dnu / 7)} týdny`;
  return `před ${Math.floor(dnu / 30)} měsíci`;
}

/** Doména bez `www.` — celá adresa by řádek roztrhala. */
function domena(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

/** Co se u které firmy stalo po kliknutí — ať je vidět výsledek, ne ticho. */
type StavPridani = "pridavam" | "pridano" | "uz_tam_je" | { chyba: string };

/**
 * Tlačítko i jeho výsledek na jednom místě.
 *
 * Po přidání se **nemění zpátky na tlačítko** — obchodník musí vidět, že
 * se to povedlo, jinak klikne podruhé a neví, jestli firmu přidal jednou
 * nebo dvakrát.
 */
function TlacitkoPridat({
  stav,
  muze,
  onPridej,
}: {
  stav: StavPridani | undefined;
  muze: boolean;
  onPridej: () => void;
}) {
  if (stav === "pridano") return <span className="pridano-ok">přidáno do kampaně</span>;
  if (stav === "uz_tam_je") return <span className="poznamka">v kampani už je</span>;
  if (stav && typeof stav === "object") {
    return <span className="pridano-chyba">nepovedlo se: {stav.chyba}</span>;
  }
  return (
    <button
      className="tlacitko tise"
      disabled={!muze || stav === "pridavam"}
      title={muze ? undefined : "Nejdřív vyberte kampaň nahoře"}
      onClick={onPridej}
    >
      {stav === "pridavam" ? "přidávám…" : "Přidat do kampaně"}
    </button>
  );
}

export function Signaly() {
  const [signaly, setSignaly] = useState<Signal[]>([]);
  const [kampane, setKampane] = useState<KampanProVyber[]>([]);
  const [kampanId, setKampanId] = useState("");
  const [pridano, setPridano] = useState<Record<string, StavPridani>>({});
  const [nacita, setNacita] = useState(true);
  const [chyba, setChyba] = useState<string | null>(null);
  const [vyber, setVyber] = useState<Vyber>("prilezitosti");

  useEffect(() => {
    Promise.all([nactiSignaly(), nactiKampaneProVyber()])
      .then(([s, k]) => {
        setSignaly(s);
        setKampane(k);
        // Když je nezamčená kampaň jediná, předvyplní se — jinak by uživatel
        // musel vybírat z jediné možnosti.
        if (k.length === 1) setKampanId(k[0]!.id);
        setChyba(null);
      })
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)))
      .finally(() => setNacita(false));
  }, []);

  async function pridej(ico: string): Promise<void> {
    if (!kampanId) return;
    setPridano((p) => ({ ...p, [ico]: "pridavam" }));
    try {
      const v = await pridejFirmuDoKampane(kampanId, ico);
      setPridano((p) => ({ ...p, [ico]: v }));
    } catch (e: unknown) {
      setPridano((p) => ({
        ...p,
        [ico]: { chyba: e instanceof Error ? e.message : String(e) },
      }));
    }
  }

  const videt = useMemo(
    () =>
      signaly.filter((s) =>
        vyber === "vse" ? true : vyber === "vylucovaci" ? s.vylucovaci : !s.vylucovaci,
      ),
    [signaly, vyber],
  );

  const prilezitosti = signaly.filter((s) => !s.vylucovaci).length;
  const vylucovaci = signaly.length - prilezitosti;

  if (nacita) return <p className="nacitani">Moment…</p>;
  if (chyba) return <p className="hlaska">Nepodařilo se načíst podněty: {chyba}</p>;

  return (
    <section className="deska">
      <div className="hlava-seznamu">
        <div>
          <h2>Co je nového</h2>
          <p className="podnadpis">
            Firmy, u kterých se něco změnilo — a doklad, proč zrovna teď. Nic se
            odsud neodesílá.
          </p>
        </div>
      </div>

      {/* Vlastní přepínač, ne sdílená `.prepinace` — ta jinde nese odkazová
          tlačítka bez stavu a přestylovat ji by rozbilo dvě další obrazovky. */}
      <div className="filtr-podnetu">
        <button
          className={vyber === "prilezitosti" ? "aktivni" : ""}
          onClick={() => setVyber("prilezitosti")}
        >
          Příležitosti ({prilezitosti})
        </button>
        <button
          className={vyber === "vylucovaci" ? "aktivni" : ""}
          onClick={() => setVyber("vylucovaci")}
        >
          Neoslovovat ({vylucovaci})
        </button>
        <button className={vyber === "vse" ? "aktivni" : ""} onClick={() => setVyber("vse")}>
          Vše ({signaly.length})
        </button>

        <span className="odsazovac" />

        {/* Kampaň se vybírá jednou nahoře, ne u každého podnětu zvlášť —
            obchodník obvykle plní jednu kampaň, ne dvanáct. */}
        <label className="volba-kampane">
          <span className="poznamka">Přidávat do kampaně:</span>
          <select value={kampanId} onChange={(e) => setKampanId(e.target.value)}>
            <option value="">vyberte kampaň</option>
            {kampane.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nazev}
              </option>
            ))}
          </select>
        </label>
      </div>

      {kampane.length === 0 && (
        <p className="poznamka">
          Žádná kampaň, do které by šlo přidávat. Schválené a uzavřené kampaně se
          už neupravují — založte novou v Kampaních.
        </p>
      )}

      {videt.length === 0 ? (
        <p className="prazdno">
          {vyber === "vylucovaci"
            ? "Žádné firmy k vyloučení. To je v pořádku — znamená to, že se u nikoho nenašla vlastní jídelna."
            : "Zatím žádné podněty. Vznikají z toho, co agent najde při rešerši."}
        </p>
      ) : (
        <ul className="seznam-signalu">
          {videt.map((s) => (
            <li
              key={`${s.ico}-${s.druh}`}
              className={s.vylucovaci ? "signal je-vylucovaci" : "signal"}
            >
              <div className="signal-hlava">
                <span className="signal-firma">{s.nazev ?? s.ico}</span>
                {s.obec && <span className="poznamka">{s.obec}</span>}
                <span className="odsazovac" />
                <span className="stitek">{s.nazevDruhu}</span>
              </div>

              <p className="signal-duvod">{s.popis}</p>

              <blockquote className="citace">{s.citace}</blockquote>

              <div className="signal-patka">
                <a className="odkaz" href={s.zdrojUrl} target="_blank" rel="noreferrer">
                  {domena(s.zdrojUrl)}
                </a>
                <span className="poznamka">{stari(s.zjistenoAt)}</span>
                <span className="odsazovac" />
                {/* Podnět bez spojení je k ničemu — není komu napsat. Tohle
                    je jediné číslo, které rozhoduje, jestli s ním jde hnout. */}
                <span className={s.spojeni > 0 ? "spojeni ma" : "spojeni nema"}>
                  {s.spojeni > 0 ? `spojení: ${s.spojeni}` : "bez spojení"}
                </span>

                {/* U vylučovacího podnětu tlačítko schválně NENÍ. „Neoslovovat"
                    a „přidat do kampaně" jsou protiklady; nabídnout obojí vedle
                    sebe by zvalo k omylu, který se pak těžko hledá. */}
                {!s.vylucovaci && <TlacitkoPridat
                  stav={pridano[s.ico]}
                  muze={kampanId !== ""}
                  onPridej={() => void pridej(s.ico)}
                />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
