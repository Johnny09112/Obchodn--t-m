import { useCallback, useEffect, useMemo, useState } from "react";
import { Krokovnik } from "./Krokovnik";
import { MapaOblasti } from "./MapaOblasti";
import {
  nactiFirmy,
  nactiJidelny,
  nactiLidi,
  nactiOblasti,
  nactiPrehledOblasti,
  nactiPravidlaSita,
  nactiPruzkumyKampane,
  nastavUzemiKampane,
  objednejPruzkumZAplikace,
  oznacUrgentni,
  dalsiBehZa,
  nactiFirmyKampane,
  nactiKategorie,
  naplnKampanZOblasti,
  nejlepsiUroven,
  schvalKampan,
  spocitejCekajici,
  vyradZKampane,
  type Clovek,
  type Firma,
  type FirmaKampane,
  type Jidelna,
  type Kategorie,
  type NaplneniKampane,
  type PocetKosu,
  type PrehledOblasti,
  type PruzkumOblasti,
  type RadekKampane,
} from "./data";
import { SeznamFirem } from "./SeznamFirem";
import { SeznamOblasti } from "./SeznamOblasti";
import { ProuzekSlozeni } from "./ProuzekSlozeni";
import { naOblast } from "./vrstvy";
import { supabase, type Role } from "./supabase";
import { cesky } from "../../src/cestina";
import { odhadKontaktu } from "../../src/odhady";
import { duvodNeoslovovat } from "../../src/sito";
import { bodVOblasti } from "../../src/oblast-tvar";
import { postupPruzkumu, souhrnPruzkumu } from "../../src/pruzkum-postup";

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
  const [krok, setKrok] = useState<1 | 2 | 3 | 4>(
    kampan ? (Math.min(Math.max(kampan.krok, 1), 4) as 1 | 2 | 3 | 4) : 1,
  );
  const [nazev, setNazev] = useState(kampan?.nazev ?? "");
  const [kontext, setKontext] = useState("");
  const [zastupce, setZastupce] = useState(kampan?.zastupce ?? "");
  const [oblastiIds, setOblastiIds] = useState<string[]>(
    (kampan?.oblasti ?? []).map((o) => o.id),
  );
  const [prehled, setPrehled] = useState<PrehledOblasti[]>([]);
  const [jidelny, setJidelny] = useState<Jidelna[]>([]);
  const [otevrenaId, setOtevrenaId] = useState<string | null>(null);
  /**
   * Brát i firmy, u kterých registr velikost neuvádí? Výchozí ne — z těch
   * 12 630 plzeňských je většina živnostníků a rešerše u nich stojí čas.
   * Ale schovat je úplně by bylo horší: polovina jsou skutečná s.r.o.
   */
  const [zahrnoutNezname, setZahrnoutNezname] = useState(false);
  const [lide, setLide] = useState<Clovek[]>([]);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [pocty, setPocty] = useState<{ uvnitr: number; projde: number; vPrekryvu: number } | null>(
    null,
  );
  const [pruzkumy, setPruzkumy] = useState<PruzkumOblasti[]>([]);
  const [firmy, setFirmy] = useState<FirmaKampane[]>([]);
  const [vynechano, setVynechano] = useState<NaplneniKampane["vynechano"]>([]);
  const [kVyrazeni, setKVyrazeni] = useState<FirmaKampane | null>(null);
  const [duvodVyrazeni, setDuvodVyrazeni] = useState("");
  const [schvalit, setSchvalit] = useState(false);
  const [udajeFirem, setUdajeFirem] = useState<Firma[]>([]);
  const [kategorie, setKategorie] = useState<Kategorie[]>([]);
  /**
   * Kolik firem z území v kampani ještě není. Načítá se při vstupu do
   * 4. kroku a po každém doplnění, takže platí i po znovuotevření kampaně —
   * na rozdíl od hlášky, která se dřív ukázala jen hned po stisku a pak
   * zmizela. Kampaň nad Čachrovem kvůli tomu mlčela o 68 firmách, které
   * čekaly, a vypadala jako rozbitá.
   */
  const [cekajici, setCekajici] = useState<PocetKosu | null>(null);
  /** Který koš se právě potvrzuje v dialogu. */
  const [pridat, setPridat] = useState<"nezname" | "mikro" | null>(null);

  const smi = smiUpravovat(kampan, role, email);
  /**
   * Schválená kampaň se ze seznamu otevřít DÁ (`Kampane.tsx`, klik na název)
   * a schvalovací dialog slibuje, že se seznam uzamkne. Databáze to ale
   * nehlídá — `smi_do_kampane` se ptá jen KDO, ne v jakém je kampaň stavu.
   * Do nápravy v databázi to tedy drží obrazovka: u schválené kampaně se
   * doplňování nenabízí vůbec.
   */
  const zamcena = kampan?.stav === "schvalena";

  /** Složení vybraných oblastí dohromady. */
  const slozeniVyberu = useMemo(() => {
    const vybrane = prehled.filter((o) => oblastiIds.includes(o.id));
    // Pozor: u překrývajících se oblastí se firma započítá dvakrát. Je to
    // odhad pro rozhodnutí o rozsahu, ne konečný počet firem v kampani —
    // ten se ukáže po naplnění a bere se z něj `distinct`.
    return vybrane.reduce(
      (a, o) => ({
        firem: a.firem + o.firem,
        mikro: a.mikro + o.mikro,
        stredni: a.stredni + o.stredni,
        korporat: a.korporat + o.korporat,
        bez_velikosti: a.bez_velikosti + o.bez_velikosti,
      }),
      { firem: 0, mikro: 0, stredni: 0, korporat: 0, bez_velikosti: 0 },
    );
  }, [prehled, oblastiIds]);

  useEffect(() => {
    // Seznam lidí je pro výběr zástupu. Když se nenačte, průvodce funguje
    // dál — jen bez zástupu, což je nepovinné pole.
    nactiLidi()
      .then(setLide)
      .catch(() => setLide([]));
  }, []);

  // Přehled oblastí pro výběr území. Načítá se jednou; kdo mezitím nakreslí
  // novou oblast v mapě pod seznamem, dostane ji doplněnou přes `onZmena`.
  const nactiPrehled = useCallback(() => {
    Promise.all([nactiPrehledOblasti(), nactiJidelny()])
      .then(([o, j]) => {
        setPrehled(o);
        setJidelny(j);
      })
      .catch(() => setPrehled([]));
  }, []);

  useEffect(() => {
    if (krok === 2) nactiPrehled();
  }, [krok, nactiPrehled]);

  // Kolik firem v území leží a kolik jich projde sítem. Dvě čísla, ne jedno:
  // mezi územím a kampaní je síto, takže se liší — a kdyby to obrazovka
  // zamlčela, vypadal by rozdíl v posledním kroku jako chyba.
  useEffect(() => {
    if (oblastiIds.length === 0) {
      setPocty(null);
      return;
    }
    let platne = true;

    Promise.all([nactiFirmy(), nactiOblasti(), nactiPravidlaSita()])
      .then(([firmy, oblasti, sito]) => {
        if (!platne) return;
        const tvary = oblastiIds
          .map((id) => oblasti.find((o) => o.id === id))
          .filter((o) => o !== undefined)
          .map(naOblast);
        if (tvary.length === 0) {
          setPocty(null);
          return;
        }

        // Firma se počítá jednou, i když leží ve dvou vybraných oblastech —
        // jinak by souhrn sliboval víc firem, než kampaň dostane (TP-5).
        // Kolik jich je v překryvu, se hlásí zvlášť: bývá to znamení, že
        // výběr je omylem širší, než měl být.
        let vPrekryvu = 0;
        const uvnitr = firmy.filter((f) => {
          if (f.lat === null || f.lng === null) return false;
          const bod = { lat: f.lat, lng: f.lng };
          const kolikrat = tvary.filter((t) => bodVOblasti(t, bod)).length;
          if (kolikrat > 1) vPrekryvu++;
          return kolikrat > 0;
        });

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

        setPocty({ uvnitr: uvnitr.length, projde: projde.length, vPrekryvu });
      })
      .catch(() => setPocty(null));

    return () => {
      platne = false;
    };
  }, [oblastiIds]);

  // Stav objednávky průzkumu. Načítá se při vstupu do kroku 3 a po každé
  // akci — hlídka běží na pozadí, takže se postup mění bez našeho přičinění.
  const nactiPruzkum = useCallback(() => {
    if (!id || oblastiIds.length === 0) return;
    const uzemi = oblastiIds.map((oid) => ({
      id: oid,
      nazev: prehled.find((o) => o.id === oid)?.nazev ?? "oblast",
    }));
    nactiPruzkumyKampane(id, uzemi)
      .then(setPruzkumy)
      .catch(() => setPruzkumy([]));
  }, [id, oblastiIds, prehled]);

  useEffect(() => {
    if (krok === 3) nactiPruzkum();
  }, [krok, nactiPruzkum]);

  // Přehled kvůli názvům oblastí ve třetím kroku — bez něj by postup mluvil
  // o „oblasti" místo o Plzeňsku.
  useEffect(() => {
    if (krok === 3 && prehled.length === 0) nactiPrehled();
  }, [krok, prehled.length, nactiPrehled]);

  async function objednej() {
    if (!id || pruzkumy.length === 0) return;
    setUklada(true);
    setChyba(null);
    try {
      const v = await objednejPruzkumZAplikace(id, pruzkumy, email);
      if (v.objednano.length === 0) {
        setChyba("Všechny vybrané oblasti už prozkoumané jsou nebo na průzkum čekají.");
      }
      nactiPruzkum();
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setUklada(false);
    }
  }

  /** Označí jako spěchající tu objednávku, na které se právě stojí. */
  async function spechaj(pruzkumId: string) {
    setUklada(true);
    setChyba(null);
    try {
      await oznacUrgentni(pruzkumId);
      nactiPruzkum();
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setUklada(false);
    }
  }

  // Seznam kampaně se skládá ze dvou zdrojů: členství (kdo v kampani je
  // a s jakým stavem) a plné údaje o firmě (velikost, zaměření, spojení).
  // Díky tomu jde použít tentýž seznam jako v kartotéce — i s filtry
  // a hledáním, které by vlastní tabulka neměla.
  const nactiSeznam = useCallback(() => {
    if (!id) return;
    Promise.all([
      nactiFirmyKampane(id),
      nactiFirmy(),
      nactiKategorie(),
      spocitejCekajici(id, oblastiIds),
    ])
      .then(([vKampani, vsechny, kat, ceka]) => {
        setFirmy(vKampani);
        const podleIco = new Map(vsechny.map((f) => [f.ico, f]));
        setUdajeFirem(
          vKampani.map((k) => podleIco.get(k.ico)).filter((f): f is Firma => f !== undefined),
        );
        setKategorie(kat);
        setCekajici(ceka);
      })
      .catch(() => {
        setFirmy([]);
        setUdajeFirem([]);
        setCekajici(null);
      });
  }, [id, oblastiIds]);

  useEffect(() => {
    if (krok === 4) nactiSeznam();
  }, [krok, nactiSeznam]);

  async function naplnit() {
    if (!id || oblastiIds.length === 0) return;
    setUklada(true);
    setChyba(null);
    try {
      const v = await naplnKampanZOblasti(id, oblastiIds, { zahrnoutNezname });
      setVynechano(v.vynechano);
      nactiSeznam();
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setUklada(false);
    }
  }

  /**
   * Doplní z území včetně vybraného koše. Cílová velikost se bere vždycky,
   * takže tohle nikdy nepřidá míň než „Doplnit z území".
   */
  async function pridejKos(kos: "nezname" | "mikro") {
    if (!id || oblastiIds.length === 0) return;
    setUklada(true);
    setChyba(null);
    try {
      const v = await naplnKampanZOblasti(id, oblastiIds, {
        zahrnoutNezname: kos === "nezname",
        zahrnoutMikro: kos === "mikro",
      });
      setVynechano(v.vynechano);
      nactiSeznam();
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setPridat(null);
      setUklada(false);
    }
  }

  async function vyrad() {
    if (!id || !kVyrazeni) return;
    setUklada(true);
    setChyba(null);
    try {
      await vyradZKampane(id, kVyrazeni.ico, duvodVyrazeni);
      setKVyrazeni(null);
      setDuvodVyrazeni("");
      nactiSeznam();
    } catch (e) {
      setChyba((e as Error).message);
      setKVyrazeni(null);
    } finally {
      setUklada(false);
    }
  }

  async function schval() {
    if (!id) return;
    setUklada(true);
    setChyba(null);
    try {
      await schvalKampan(id);
      setSchvalit(false);
      onHotovo();
    } catch (e) {
      setChyba((e as Error).message);
      setSchvalit(false);
    } finally {
      setUklada(false);
    }
  }

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

  /** Krok 2 — uloží vybrané území a pustí dál na průzkum. */
  async function ulozUzemi() {
    if (!id || oblastiIds.length === 0) return;
    setUklada(true);
    setChyba(null);

    try {
      await nastavUzemiKampane(id, oblastiIds);
      await supabase.from("kampane").update({ krok: 3 }).eq("id", id);
      setKrok(3);
    } catch (e) {
      setChyba(`Území se nepodařilo uložit: ${(e as Error).message}`);
    } finally {
      setUklada(false);
    }
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
    /**
     * Kolik firem kampaň opravdu dostane — se započtenou volbou velikosti.
     *
     * Bez toho tu stálo „do kampaně projde 12 760" a o dva řádky níž
     * „620 firem v cílové velikosti". Dvě různá čísla o téže věci; člověk
     * pak nevěří ani jednomu.
     */
    const doKampane =
      slozeniVyberu.stredni +
      slozeniVyberu.korporat +
      (zahrnoutNezname ? slozeniVyberu.bez_velikosti : 0);
    return (
      <>
        <div className="sloupec">
          <h2>{nazev || "Nová kampaň"}</h2>
          <Krokovnik krok={2} />
          <p className="podnadpis">
            Zaškrtněte oblasti, ze kterých se kampaň naplní. Může jich být víc —
            firmy se sjednotí. Novou nakreslíte v mapě pod seznamem.
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
                <span className="hodnota">{pocty.uvnitr.toLocaleString("cs")}</span>
              </p>
              <p className="udaj vyrazny">
                <span className="popisek">Do kampaně projde</span>
                <span className="hodnota">{doKampane.toLocaleString("cs")}</span>
              </p>
              {vyrazeno > 0 && (
                <p className="hlaska je-klid">
                  {vyrazeno === 1
                    ? "Jednu firmu"
                    : `${vyrazeno.toLocaleString("cs")} ${cesky(vyrazeno, "firmu", "firmy", "firem")}`}{" "}
                  síto nepustí — je na blacklistu, je to bytový dům, naše
                  partnerská jídelna, nebo má vlastní jídelnu. Důvod u každé
                  uvidíte v posledním kroku.
                </p>
              )}
              {/* Složení výběru — z holého počtu se nepozná, jestli je území
                  použitelné, nebo je to hromada živnostníků. */}
              <ProuzekSlozeni s={slozeniVyberu} />

              <div className="volba-rozsahu">
                <label className="zaskrtnuti-radek">
                  <input
                    type="checkbox"
                    checked={zahrnoutNezname}
                    onChange={(e) => setZahrnoutNezname(e.target.checked)}
                  />
                  <span>
                    Zahrnout i {slozeniVyberu.bez_velikosti.toLocaleString("cs")}{" "}
                    {cesky(slozeniVyberu.bez_velikosti, "firmu", "firmy", "firem")}{" "}
                    <strong>s neznámou velikostí</strong>
                  </span>
                </label>
                <p className="poznamka">
                  {zahrnoutNezname ? (
                    <>
                      Kampaň bude mít{" "}
                      {(slozeniVyberu.stredni + slozeniVyberu.korporat + slozeniVyberu.bez_velikosti).toLocaleString("cs")}{" "}
                      firem. Dohledání kontaktů zabere navíc{" "}
                      <strong>{odhadKontaktu(slozeniVyberu.bez_velikosti)}</strong> —
                      registr o jejich velikosti mlčí, takže se ukáže až při rešerši,
                      jestli stojí za oslovení.
                    </>
                  ) : (
                    <>
                      Naplnění vezme jen firmy s doloženými 25 a více zaměstnanci.
                      Zbylých {slozeniVyberu.bez_velikosti.toLocaleString("cs")} firem
                      má mezi sebou i skutečné firmy, u kterých registr velikost
                      prostě neuvádí — <strong>přibrat je můžete i potom</strong>,
                      tlačítkem v posledním kroku.
                    </>
                  )}
                </p>
              </div>

              {pocty.vPrekryvu > 0 && (
                <p className="hlaska je-klid">
                  {pocty.vPrekryvu === 1
                    ? "Jedna firma leží"
                    : `${pocty.vPrekryvu} firem leží`}{" "}
                  ve víc vybraných oblastech naráz. V kampani bude jednou —
                  oslovení odejde jen jedno. Jestli jste to tak nechtěli, bude
                  jedna z oblastí ve výběru navíc.
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
            {oblastiIds.length > 0
              ? `Kampaň se opře o ${oblastiIds.length} ${cesky(oblastiIds.length, "oblast", "oblasti", "oblastí")}. Průzkum se objedná pro každou zvlášť.`
              : "Zaškrtněte aspoň jednu oblast, nebo nakreslete novou v mapě."}
          </p>

          <div className="tlacitka vlevo">
            <button className="tlacitko tise" onClick={() => setKrok(1)}>
              Zpět na založení
            </button>
            <button
              className="tlacitko"
              disabled={oblastiIds.length === 0 || uklada}
              onClick={ulozUzemi}
            >
              {uklada ? "Ukládám…" : "Pokračovat na průzkum"}
            </button>
          </div>
        </div>

        <div className="sloupec">
          <SeznamOblasti
            oblasti={prehled}
            jidelny={jidelny}
            role={role}
            otevrenaId={otevrenaId}
            onOtevri={setOtevrenaId}
            vybrane={new Set(oblastiIds)}
            onVyber={setOblastiIds}
            dovolUklid={false}
          />
        </div>

        <MapaOblasti
          role={role}
          vybranaId={otevrenaId}
          onVyber={setOtevrenaId}
          onZmena={nactiPrehled}
        />
      </>
    );
  }

  // ── krok 3: průzkum

  if (krok === 3) {
    // Postup se počítá pro každou oblast zvlášť a pak se shrne. Sčítat obce
    // napříč oblastmi by lhalo — dvě oblasti se můžou překrývat.
    const postupy = pruzkumy.map((o) => ({
      nazev: o.oblastNazev,
      stav: o.pruzkum?.stav ?? null,
      postup: o.pruzkum
        ? postupPruzkumu({
            stav: o.pruzkum.stav,
            useky: o.pruzkum.useky,
            bezPredMinutami: o.pruzkum.bezPredMinutami,
            bezicíObec: o.pruzkum.bezicíObec,
            blokujeJiny: o.pruzkum.blokujeJiny,
            dalsiBehZa: dalsiBehZa(o.pruzkum.urgentni),
          })
        : null,
    }));
    const souhrn = souhrnPruzkumu(postupy);
    const vseHotovo = souhrn.celkem > 0 && souhrn.hotovych === souhrn.celkem;
    const chybiObjednavka = souhrn.bezObjednavky.length > 0;
    const kSpechu = pruzkumy.find(
      (o) => o.pruzkum && !o.pruzkum.urgentni && ["ceka", "bezi"].includes(o.pruzkum.stav),
    );
    // Oblasti, které se od svého průzkumu překreslily (migrace 0031).
    const zmeneneTvary = pruzkumy
      .filter((o) => prehled.find((p) => p.id === o.oblastId)?.tvar_zmenen)
      .map((o) => o.oblastNazev);

    return (
      <div className="sloupec">
        <h2>{nazev}</h2>
        <Krokovnik krok={3} />

        <p className="udaj">
          <span className="popisek">Území kampaně</span>
          <span className="hodnota">
            {pruzkumy.map((o) => o.oblastNazev).join(", ") || "—"}
          </span>
        </p>

        {chybiObjednavka && (
          <>
            <p className="hlaska je-klid">
              {souhrn.bezObjednavky.length === souhrn.celkem
                ? "Území ještě prozkoumané není."
                : `Průzkum chybí u ${souhrn.bezObjednavky.length} ${cesky(souhrn.bezObjednavky.length, "oblasti", "oblastí", "oblastí")}: ${souhrn.bezObjednavky.join(", ")}.`}{" "}
              Objednávku si Čmuchal vyzvedne sám — hlídka u hodin se do fronty
              dívá třikrát denně. Objedná se jedna na každou oblast; už
              prozkoumané se znovu neobjednávají.
            </p>
            <div className="tlacitka vlevo">
              <button className="tlacitko" onClick={objednej} disabled={uklada}>
                {uklada ? "Objednávám…" : "Objednat průzkum"}
              </button>
            </div>
          </>
        )}

        {vseHotovo && (
          <p className="hlaska je-hotovo">
            {souhrn.popis} Můžete pokračovat na seznam firem.
          </p>
        )}

        {/* Oblast se od průzkumu překreslila. Kampaň se naplní z dnešního
            tvaru, ale v dokreslené části nikdo nehledal — takže by tam firmy
            chyběly, aniž by to bylo na čemkoli vidět. */}
        {zmeneneTvary.length > 0 && (
          <p className="hlaska" role="alert">
            {zmeneneTvary.length === 1
              ? `Oblast „${zmeneneTvary[0]}" se od průzkumu překreslila.`
              : `Tyhle oblasti se od průzkumu překreslily: ${zmeneneTvary.join(", ")}.`}{" "}
            V dokreslené části se ještě nehledalo, takže odtud firmy chybí.
            Objednejte průzkum znovu, ať je seznam úplný.
          </p>
        )}

        {/* Proužek na každou oblast zvlášť — ať je vidět, kde to vázne. */}
        {postupy.map((o, i) => {
          const p = pruzkumy[i]!.pruzkum;
          if (!p) return null;
          return (
            <div className="postup" key={pruzkumy[i]!.oblastId}>
              <div className="postup-pruh">
                {p.useky.length === 0 ? (
                  <i />
                ) : (
                  p.useky.map((u, j) => (
                    <i
                      key={j}
                      className={
                        u.stav === "hotovo"
                          ? "hotovo"
                          : u.stav === "bezi"
                            ? "bezi"
                            : u.stav === "selhalo"
                              ? "selhalo"
                              : ""
                      }
                    />
                  ))
                )}
              </div>
              <span className="postup-popis">
                <strong>{o.nazev}</strong> — {o.postup?.popis}
                {p.stav === "selhalo" && pruzkumy[i]!.chyba ? ` (${pruzkumy[i]!.chyba})` : ""}
              </span>
            </div>
          );
        })}

        {souhrn.celkem > 1 && !vseHotovo && !chybiObjednavka && (
          <p className="poznamka zvyraznena">{souhrn.popis}</p>
        )}

        {!vseHotovo && souhrn.celkem > 0 && !chybiObjednavka && (
          <p className="hlaska je-klid">
            Okno můžete zavřít — kampaň zůstane rozpracovaná a v seznamu
            uvidíte, až bude průzkum hotový.
          </p>
        )}

        {kSpechu ? (
          <div className="tlacitka vlevo">
            <button
              className="tlacitko tise"
              onClick={() => spechaj(kSpechu.pruzkum!.id)}
              disabled={uklada}
            >
              Spěchá — vyřídit {souhrn.celkem > 1 ? `„${kSpechu.oblastNazev}" ` : ""}přednostně
            </button>
          </div>
        ) : (
          // Jen dokud se na něco čeká — u hotového průzkumu už značka
          // spěchu nic neznamená a mátla by.
          pruzkumy.some(
            (o) => o.pruzkum?.urgentni && ["ceka", "bezi"].includes(o.pruzkum.stav),
          ) && (
            <p className="poznamka">
              Označeno jako spěchající — hlídka se na frontu dívá každých deset
              minut. Tlačítko Čmuchala nespustí, jen ho navede.
            </p>
          )
        )}

        {chyba && (
          <p className="hlaska" role="alert">
            {chyba}
          </p>
        )}

        <div className="tlacitka vlevo">
          <button className="tlacitko tise" onClick={() => setKrok(2)}>
            Zpět na území
          </button>
          <button className="tlacitko tise" onClick={nactiPruzkum}>
            Načíst znovu
          </button>
          <button className="tlacitko" onClick={() => setKrok(4)}>
            {vseHotovo ? "Pokračovat na seznam firem" : "Přeskočit na seznam firem"}
          </button>
        </div>
        {!vseHotovo && (
          <p className="poznamka">
            Přeskočit jde vždycky, ale <strong>schválit kampaň půjde až po
            dokončení průzkumu</strong> — hlídá to databáze, ne tlačítko.
          </p>
        )}
      </div>
    );
  }

  // ── krok 4: seznam firem a schválení

  if (krok === 4) {
    const vybrane = firmy.filter((f) => f.stav === "vybrana");
    const rozpad = { jmenna: 0, proNabidky: 0, obecna: 0, zadny: 0 };
    for (const f of vybrane) {
      const u = nejlepsiUroven(f);
      if (u === 1) rozpad.jmenna++;
      else if (u === 2) rozpad.proNabidky++;
      else if (u === 3) rozpad.obecna++;
      else rozpad.zadny++;
    }
    const seSpojenim = vybrane.length - rozpad.zadny;

    return (
      <>
        <div className="sloupec">
          <h2>{nazev}</h2>
          <Krokovnik krok={4} />
          <p className="podnadpis">
            Z čeho se pozná, jestli má smysl kampaň pouštět dál — a proč tam
            někdo je i proč tam někdo není.
          </p>

          {zamcena ? (
            <p className="hlaska je-hotovo">
              Kampaň je schválená, seznam firem je uzavřený. Přidávat do něj
              už nejde.
            </p>
          ) : (
            <div className="tlacitka vlevo">
              <button
                className="tlacitko tise"
                onClick={naplnit}
                disabled={uklada || oblastiIds.length === 0}
              >
                {uklada ? "Pracuji…" : firmy.length === 0 ? "Naplnit z území" : "Doplnit z území"}
              </button>
            </div>
          )}

          {/*
            Co v území čeká, se musí říct pořád — ne jen hned po stisku
            doplnění. Číslo se dopočítá z dat při každém otevření, takže
            nemůže zastarat: co je tu napsané, to tlačítko doopravdy přidá.

            Nabídky jsou dvě, ne jedna sloučená. Přibrat firmy bez známé
            velikosti a přibrat malé firmy jsou dvě různá rozhodnutí.
          */}
          {!zamcena && cekajici && cekajici.bezVelikosti + cekajici.mikro > 0 && (
            <div className={`hlaska ${firmy.length === 0 ? "" : "je-klid"}`}>
              {firmy.length === 0 && (
                <strong>Do kampaně se zatím nedostala žádná firma. </strong>
              )}

              {cekajici.bezVelikosti > 0 && (
                <>
                  <p>
                    V území čeká {cekajici.bezVelikosti.toLocaleString("cs")}{" "}
                    {cesky(cekajici.bezVelikosti, "firma", "firmy", "firem")},
                    u {cesky(cekajici.bezVelikosti, "které", "kterých", "kterých")}{" "}
                    <strong>registr neuvádí velikost</strong>. Dohledání kontaktů
                    u nich zabere navíc {odhadKontaktu(cekajici.bezVelikosti)}.
                  </p>
                  <div className="tlacitka vlevo">
                    <button
                      className="tlacitko"
                      disabled={uklada}
                      onClick={() => setPridat("nezname")}
                    >
                      Přidat {cekajici.bezVelikosti.toLocaleString("cs")}{" "}
                      {cesky(cekajici.bezVelikosti, "firmu", "firmy", "firem")} s neznámou velikostí
                    </button>
                  </div>
                </>
              )}

              {cekajici.mikro > 0 && (
                <>
                  <p>
                    A dál {cekajici.mikro.toLocaleString("cs")}{" "}
                    {cesky(cekajici.mikro, "firma", "firmy", "firem")}{" "}
                    <strong>do 24 zaměstnanců</strong>. Dohledání kontaktů u nich
                    zabere navíc {odhadKontaktu(cekajici.mikro)}.
                  </p>
                  <div className="tlacitka vlevo">
                    <button
                      className="tlacitko"
                      disabled={uklada}
                      onClick={() => setPridat("mikro")}
                    >
                      Přidat {cekajici.mikro.toLocaleString("cs")}{" "}
                      {cesky(cekajici.mikro, "malou firmu", "malé firmy", "malých firem")}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {chyba && (
            <p className="hlaska" role="alert">
              {chyba}
            </p>
          )}

          {firmy.length > 0 && (
            <>
              <p className="udaj">
                <span className="popisek">Firem v seznamu</span>
                <span className="hodnota">{vybrane.length}</span>
              </p>
              <p className="udaj">
                <span className="popisek">Se spojením</span>
                <span className="hodnota">{seSpojenim}</span>
              </p>
              <p className="udaj">
                <span className="popisek">Na jmenovanou osobu</span>
                <span className="hodnota">{rozpad.jmenna}</span>
              </p>
              <p className="udaj">
                <span className="popisek">Na adresu pro nabídky</span>
                <span className="hodnota">{rozpad.proNabidky}</span>
              </p>
              <p className="udaj">
                <span className="popisek">Jen obecná adresa</span>
                <span className="hodnota">{rozpad.obecna}</span>
              </p>
              <p className="udaj">
                <span className="popisek">Bez spojení</span>
                <span className="hodnota">{rozpad.zadny}</span>
              </p>
            </>
          )}

          {/* Vyřazené schválně NAHOŘE, ne schované. Kdo nevidí, proč firma
              v seznamu chybí, přestane pravidlům věřit a začne je obcházet.
              Vypisuje se ale jen prvních padesát — počet v nadpisu zůstává
              úplný, takže se nic nezatajuje, jen se to vejde na obrazovku. */}
          {vynechano.length > 0 && (
            <div className="hlaska je-klid">
              <strong>V území leží, ale do kampaně nepatří ({vynechano.length}):</strong>
              <ul>
                {vynechano.slice(0, 50).map((v) => (
                  <li key={v.ico}>
                    {v.nazev} — {v.duvod}: {v.detail}
                  </li>
                ))}
              </ul>
              {vynechano.length > 50 && (
                <p className="poznamka">
                  … a dalších {(vynechano.length - 50).toLocaleString("cs")}{" "}
                  {cesky(vynechano.length - 50, "firma", "firmy", "firem")}.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="sloupec">
          {/* Tentýž seznam jako v kartotéce — hledání podle názvu, obce
              i IČO a filtry na velikost, zaměření a spojení. Vlastní
              tabulka by o to všechno přišla. */}
          <SeznamFirem
            firmy={udajeFirem}
            kategorie={kategorie}
            nadpis="Firmy v kampani"
            popisAkce="V kampani"
            akce={(f) => {
              const v = firmy.find((x) => x.ico === f.ico);
              if (v?.stav === "vyrazena") {
                return (
                  <span className="stav je-zamitnuty">
                    <span className="znak" />
                    vyřazena: {v.duvod_vyrazeni}
                  </span>
                );
              }
              return (
                <button
                  className="tlacitko tise"
                  disabled={uklada}
                  onClick={() => v && setKVyrazeni(v)}
                >
                  Vyřadit
                </button>
              );
            }}
          />
        </div>

        <div className="sloupec">
          <div className="tlacitka vlevo">
            <button className="tlacitko tise" onClick={() => setKrok(3)}>
              Zpět na průzkum
            </button>
            <button className="tlacitko tise" onClick={onHotovo}>
              Zavřít a vrátit se na kampaně
            </button>
            {/* Schvalovat smí jen admin — ostatním se tlačítko nenabízí vůbec,
                databáze by je stejně zamítla. */}
            {(role === "admin" || role === "super-admin") && (
              <button
                className="tlacitko"
                disabled={uklada || seSpojenim === 0}
                onClick={() => setSchvalit(true)}
              >
                Schválit kampaň
              </button>
            )}
          </div>
          {(role === "admin" || role === "super-admin") && seSpojenim === 0 && (
            <p className="poznamka">
              Schválit půjde, až bude v seznamu aspoň jedna firma s doloženým
              spojením. Teď je jich 0 z {vybrane.length}.
            </p>
          )}
          {role === "uzivatel" && (
            <p className="poznamka">Schválit kampaň může jen admin.</p>
          )}
        </div>

        {kVyrazeni && (
          <div className="zaclona" role="dialog" aria-modal="true" aria-label="Vyřadit firmu">
            <div className="dialog">
              <h3>Vyřadit „{kVyrazeni.nazev}“ ze seznamu?</h3>
              <p>
                Firma v kampani zůstane vidět jako vyřazená a doplnění z území
                ji už nevrátí.
              </p>
              <label className="pole">
                <span>Důvod (povinný)</span>
                <input
                  value={duvodVyrazeni}
                  onChange={(e) => setDuvodVyrazeni(e.target.value)}
                  placeholder="např. jednali jsme loni, nemají zájem"
                />
              </label>
              <p className="poznamka">
                Bez důvodu se pravidla nebrousí — za měsíc už nikdo nepozná, proč
                tam ta firma není.
              </p>
              <div className="tlacitka vlevo">
                <button
                  className="tlacitko tise"
                  onClick={() => {
                    setKVyrazeni(null);
                    setDuvodVyrazeni("");
                  }}
                >
                  Nechat být
                </button>
                <button
                  className="tlacitko"
                  disabled={uklada || !duvodVyrazeni.trim()}
                  onClick={vyrad}
                >
                  Vyřadit
                </button>
              </div>
            </div>
          </div>
        )}

        {schvalit && (
          <div className="zaclona" role="dialog" aria-modal="true" aria-label="Schválit kampaň">
            <div className="dialog">
              <h3>Schválit kampaň „{nazev}“?</h3>
              <p>
                Seznam {vybrane.length} firem se tím uzamkne a nepůjde do něj
                přidávat. <strong>Nic se neodesílá</strong> — oslovování přijde
                na řadu později.
              </p>
              <div className="tlacitka vlevo">
                <button className="tlacitko tise" onClick={() => setSchvalit(false)}>
                  Ještě ne
                </button>
                <button className="tlacitko" disabled={uklada} onClick={schval}>
                  {uklada ? "Schvaluji…" : "Schválit"}
                </button>
              </div>
            </div>
          </div>
        )}

        {pridat && cekajici && (
          <div
            className="zaclona"
            role="dialog"
            aria-modal="true"
            aria-label="Přidat firmy do kampaně"
          >
            <div className="dialog">
              {pridat === "nezname" ? (
                <>
                  <h3>
                    Přidat {cekajici.bezVelikosti.toLocaleString("cs")}{" "}
                    {cesky(cekajici.bezVelikosti, "firmu", "firmy", "firem")} s neznámou velikostí?
                  </h3>
                  <p>
                    Registr o jejich velikosti mlčí — jestli stojí za oslovení,
                    se ukáže až při rešerši. Dohledání kontaktů u nich zabere
                    navíc <strong>{odhadKontaktu(cekajici.bezVelikosti)}</strong>.
                  </p>
                </>
              ) : (
                <>
                  <h3>
                    Přidat {cekajici.mikro.toLocaleString("cs")}{" "}
                    {cesky(cekajici.mikro, "malou firmu", "malé firmy", "malých firem")}?
                  </h3>
                  <p>
                    Firmy do 24 zaměstnanců. Dohledání kontaktů u nich zabere
                    navíc <strong>{odhadKontaktu(cekajici.mikro)}</strong>.
                    Společenství vlastníků a bytová družstva mezi nimi nejsou —
                    ta vyřazuje síto bez ohledu na velikost.
                  </p>
                </>
              )}
              <p className="poznamka">
                Zpátky to jde jen po jedné, tlačítkem Vyřadit u konkrétní firmy.
                Hromadné odebrání není — smazalo by i rozhodnutí, která jste
                mezitím udělali.
              </p>
              <div className="tlacitka vlevo">
                <button className="tlacitko tise" onClick={() => setPridat(null)}>
                  Ještě ne
                </button>
                <button
                  className="tlacitko"
                  disabled={uklada}
                  onClick={() => pridejKos(pridat)}
                >
                  {uklada ? "Přidávám…" : "Přidat"}
                </button>
              </div>
            </div>
          </div>
        )}
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
