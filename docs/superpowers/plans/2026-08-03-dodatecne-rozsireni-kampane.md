# Dodatečné rozšíření kampaně o firmy bez známé velikosti — plán

> **Pro agentní pracovníky:** POVINNÁ PODDOVEDNOST: použij
> `superpowers:subagent-driven-development` (doporučeno) nebo
> `superpowers:executing-plans` a odpracuj plán úkol po úkolu. Kroky jsou
> zaškrtávací (`- [ ]`).

> **Rozsah se během práce rozšířil.** Tenhle plán zůstal ve verzi, ve které
> se malé firmy (koš `mikro`) do kampaně nedaly přibrat vůbec — ř. 33 níž
> a úryvky u „preskoceno"/`jenCilove` tomu odpovídají. Zadání
> (`docs/superpowers/specs/2026-08-03-dodatecne-rozsireni-kampane-design.md`)
> se mezitím aktualizovalo a **platí ono, ne tenhle plán**. Co se změnilo:
> malé firmy (do 24 zaměstnanců) jde majitel přibrat stejně jako firmy bez
> známé velikosti, jen vlastním tlačítkem; parametr `jenCilove` nahradily
> dva nezávislé příznaky `zahrnoutNezname`/`zahrnoutMikro`; návratové pole
> `preskoceno` zaniklo (nahradil ho trvalý panel `spocitejCekajici`); a výpis
> vyřazených firem (`vynechano`) se v obrazovce omezuje na 50 položek.

**Zadání:** `docs/superpowers/specs/2026-08-03-dodatecne-rozsireni-kampane-design.md`

**Cíl:** Majitel může firmy bez známé velikosti přibrat do kampaně i dodatečně,
tlačítkem u seznamu firem ve 4. kroku průvodce.

**Architektura:** Pravidlo „kdo z území do kampaně (ne)patří a proč" se vytáhne
z `naplnKampanZOblasti` do čistého modulu `src/kampan-kandidati.ts` bez
databáze. Nad ním pak stojí dvě věci: plnění (vkládá) a nový počet čekajících
(jen počítá). Jedno pravidlo, dvě použití — čísla se nemůžou rozejít.

**Technologie:** TypeScript, React 18, Vitest, Supabase (PostgREST). Žádná
migrace, žádná nová závislost.

## Globální omezení

- **Čeština** v komentářích, testech i commit messages. Identifikátory česky
  bez diakritiky (`roztridKandidaty`).
- **TDD:** nejdřív test, pak implementace. `npm test` musí projít vždy, offline,
  bez env proměnných.
- **`src/kampan-kandidati.ts` nesmí importovat `db.js` ani `repo.js`** ani nic,
  co si je přitáhne. Hlídá to `test/hranice-aplikace.test.ts`; porušení shodí
  sestavení na Vercelu, ne doma.
- **Nic se neodesílá** (TP-8). Tenhle plán se odesílání nedotýká.
- Aktivní data: `CANTINERO_DATA_DIR=data/pgdata-v5`. Pro tenhle plán nejsou
  potřeba — všechny nové testy jsou čistý výpočet bez databáze.
- Firmy `mikro` se do kampaně neberou nikdy, za žádného rozsahu.

## Struktura souborů

| Soubor | Odpovědnost |
|---|---|
| `src/kampan-kandidati.ts` (nový) | Čisté třídění: firma z území → koš + důvod. Bez databáze, bez Supabase. |
| `test/kampan-kandidati.test.ts` (nový) | Testy třídění, včetně pastí (už v kampani, ručně vyřazená). |
| `app/src/data.ts` (změna) | `naplnKampanZOblasti` přejde na sdílené třídění; přibude `spocitejCekajici`. |
| `app/src/PruvodceKampani.tsx` (změna) | Panel čekajících + potvrzovací dialog ve 4. kroku; přeformulovaná poznámka ve 2. kroku. |

---

### Úkol 1: Čisté třídění kandidátů

**Soubory:**
- Vytvořit: `src/kampan-kandidati.ts`
- Test: `test/kampan-kandidati.test.ts`

**Rozhraní:**
- Spotřebovává: `duvodNeoslovovat`, `Neoslovovat`, `Pravidlo` ze `src/sito.js`.
- Poskytuje: `roztridKandidaty(vstup): Kandidat[]`, typy `Kosik`, `Kandidat`,
  `FirmaProTrideni`, `VstupTrideni` a pomocnou `spoctiKose(kandidati): PocetKosu`.
  Úkoly 2 a 3 na tom stojí.

- [ ] **Krok 1: Napiš padající test**

Vytvoř `test/kampan-kandidati.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  roztridKandidaty,
  spoctiKose,
  type FirmaProTrideni,
} from "../src/kampan-kandidati.js";

/** Firma s rozumnými výchozími hodnotami; test přepíše jen to, na čem záleží. */
function firma(zmeny: Partial<FirmaProTrideni> & { ico: string }): FirmaProTrideni {
  return {
    nazev: `Firma ${zmeny.ico}`,
    velikost_kategorie: "stredni",
    cz_nace: [],
    pravni_forma: "112",
    ma_vlastni_jidelnu: null,
    ...zmeny,
  };
}

const PRAZDNE_SITO = { partnerskaIca: new Set<string>(), blacklist: [] };

/** Zkratka: všechny uvedené firmy leží v území a v kampani zatím nikdo není. */
function roztrid(firmy: FirmaProTrideni[], jizVKampani: string[] = []) {
  return roztridKandidaty({
    firmy,
    vUzemi: new Set(firmy.map((f) => f.ico)),
    jizVKampani: new Set(jizVKampani),
    sito: PRAZDNE_SITO,
  });
}

describe("třídění kandidátů z území do kampaně", () => {
  it("firma v cílové velikosti patří do koše cilova", () => {
    const k = roztrid([firma({ ico: "1", velikost_kategorie: "stredni" })]);
    expect(k).toHaveLength(1);
    expect(k[0]!.kosik).toBe("cilova");
  });

  it("korporát je taky cílový", () => {
    const k = roztrid([firma({ ico: "1", velikost_kategorie: "korporat" })]);
    expect(k[0]!.kosik).toBe("cilova");
  });

  it("firma bez známé velikosti není cílová, ale ani zahozená", () => {
    const k = roztrid([firma({ ico: "1", velikost_kategorie: null })]);
    expect(k[0]!.kosik).toBe("bez_velikosti");
  });

  it("firma do 24 zaměstnanců je vždycky mikro", () => {
    const k = roztrid([firma({ ico: "1", velikost_kategorie: "mikro" })]);
    expect(k[0]!.kosik).toBe("mikro");
  });

  it("síto má přednost před velikostí a nese důvod", () => {
    const k = roztridKandidaty({
      firmy: [firma({ ico: "1", velikost_kategorie: "korporat" })],
      vUzemi: new Set(["1"]),
      jizVKampani: new Set(),
      sito: {
        partnerskaIca: new Set(["1"]),
        blacklist: [],
      },
    });
    expect(k[0]!.kosik).toBe("sito");
    expect(k[0]!.duvod?.duvod).toBe("partnerska_jidelna");
  });

  it("firma mimo území se neobjeví vůbec", () => {
    const k = roztridKandidaty({
      firmy: [firma({ ico: "1" }), firma({ ico: "2" })],
      vUzemi: new Set(["1"]),
      jizVKampani: new Set(),
      sito: PRAZDNE_SITO,
    });
    expect(k.map((x) => x.ico)).toEqual(["1"]);
  });

  it("firma už v kampani se mezi čekající nepočítá", () => {
    const k = roztrid([firma({ ico: "1" }), firma({ ico: "2" })], ["1"]);
    expect(spoctiKose(k)).toEqual({ cilova: 1, bezVelikosti: 0, mikro: 0 });
  });

  // Past z kapitoly 5 zadání: vyřazené firmy jsou v `kampan_firmy` taky,
  // takže `jizVKampani` je obsahuje. Kdyby se počítaly mezi čekající, panel
  // by sliboval víc, než tlačítko přidá — plnění je nevzkřísí.
  it("ručně vyřazená firma se mezi čekající nepočítá", () => {
    const k = roztrid([firma({ ico: "1", velikost_kategorie: null })], ["1"]);
    expect(spoctiKose(k)).toEqual({ cilova: 0, bezVelikosti: 0, mikro: 0 });
  });

  it("počty se sečtou po koších", () => {
    const k = roztrid([
      firma({ ico: "1", velikost_kategorie: "stredni" }),
      firma({ ico: "2", velikost_kategorie: null }),
      firma({ ico: "3", velikost_kategorie: null }),
      firma({ ico: "4", velikost_kategorie: "mikro" }),
    ]);
    expect(spoctiKose(k)).toEqual({ cilova: 1, bezVelikosti: 2, mikro: 1 });
  });

  it("firmy zadržené sítem se do počtů čekajících nepletou", () => {
    const k = roztridKandidaty({
      firmy: [firma({ ico: "1" }), firma({ ico: "2" })],
      vUzemi: new Set(["1", "2"]),
      jizVKampani: new Set(),
      sito: { partnerskaIca: new Set(["2"]), blacklist: [] },
    });
    expect(spoctiKose(k)).toEqual({ cilova: 1, bezVelikosti: 0, mikro: 0 });
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

```bash
npm test -- kampan-kandidati
```

Očekávej: FAIL, `Cannot find module '../src/kampan-kandidati.js'`.

- [ ] **Krok 3: Napiš modul**

Vytvoř `src/kampan-kandidati.ts`:

```ts
/**
 * Kdo z území do kampaně patří a proč — jedno pravidlo pro plnění i pro počty.
 *
 * **Čistý modul. Nesmí sem přijít nic, co sahá na databázi.** Používá ho webová
 * aplikace (`app/src/data.ts`), a ta si přes `src/` nesmí přitáhnout `db.ts` —
 * Vercel kořenové závislosti neinstaluje a sestavení by spadlo. Hlídá
 * `test/hranice-aplikace.test.ts`.
 *
 * Proč vlastní soubor: dřív to byl cyklus uvnitř `naplnKampanZOblasti`, který
 * zároveň třídil i vkládal. Obrazovka pak nemohla říct, kolik firem čeká, aniž
 * by pravidlo opsala podruhé — a dvě opsaná pravidla se dřív nebo později
 * rozejdou.
 */
import { duvodNeoslovovat, type Neoslovovat, type Pravidlo } from "./sito.js";

/** Proč firma (ne)patří do kampaně. */
export type Kosik =
  /** Doložených 25 a víc zaměstnanců — bere se vždycky. */
  | "cilova"
  /** Registr velikost neuvádí — bere se jen na vyžádání. */
  | "bez_velikosti"
  /** Do 24 zaměstnanců — nebere se nikdy. */
  | "mikro"
  /** Zadrželo síto (blacklist, bytový dům, partner, vlastní jídelna). */
  | "sito";

/** Firma tak, jak ji třídění potřebuje vidět. Podmnožina `Firma` z aplikace. */
export interface FirmaProTrideni {
  ico: string;
  nazev: string;
  velikost_kategorie: string | null;
  cz_nace: readonly string[];
  pravni_forma: string | null;
  ma_vlastni_jidelnu: boolean | null;
}

export interface Kandidat {
  ico: string;
  nazev: string;
  kosik: Kosik;
  /** Vyplněné jen u koše `sito` — jinak `null`. */
  duvod: Neoslovovat | null;
}

export interface VstupTrideni {
  firmy: readonly FirmaProTrideni[];
  /** IČO firem ležících ve vybraných oblastech, sjednocená. */
  vUzemi: ReadonlySet<string>;
  /**
   * IČO, která v kampani už jsou — **včetně ručně vyřazených**. Ta se
   * doplněním nevzkřísí (`on conflict do nothing`), takže mezi čekající
   * nepatří. Pro plnění se předává prázdná množina.
   */
  jizVKampani: ReadonlySet<string>;
  sito: {
    partnerskaIca: ReadonlySet<string>;
    blacklist: readonly Pravidlo[];
  };
}

/**
 * Roztřídí firmy z území podle toho, proč (ne)patří do kampaně.
 *
 * Pořadí rozhodování je podstatné: **síto má přednost před velikostí.** Firma
 * na blacklistu se nemá objevit mezi čekajícími ani omylem, i kdyby byla
 * sebevětší.
 */
export function roztridKandidaty(vstup: VstupTrideni): Kandidat[] {
  const kandidati: Kandidat[] = [];

  for (const f of vstup.firmy) {
    if (!vstup.vUzemi.has(f.ico)) continue;
    if (vstup.jizVKampani.has(f.ico)) continue;

    const duvod = duvodNeoslovovat({
      ico: f.ico,
      nazev: f.nazev,
      czNace: f.cz_nace,
      pravniForma: f.pravni_forma,
      maVlastniJidelnu: f.ma_vlastni_jidelnu,
      partnerskaIca: vstup.sito.partnerskaIca,
      blacklist: vstup.sito.blacklist,
    });
    if (duvod) {
      kandidati.push({ ico: f.ico, nazev: f.nazev, kosik: "sito", duvod });
      continue;
    }

    const kosik: Kosik =
      f.velikost_kategorie === "mikro"
        ? "mikro"
        : f.velikost_kategorie === "stredni" || f.velikost_kategorie === "korporat"
          ? "cilova"
          : "bez_velikosti";

    kandidati.push({ ico: f.ico, nazev: f.nazev, kosik, duvod: null });
  }

  return kandidati;
}

/** Počty firem po koších. Koš `sito` se nepočítá — ty nečekají, ty nepatří. */
export interface PocetKosu {
  cilova: number;
  bezVelikosti: number;
  mikro: number;
}

export function spoctiKose(kandidati: readonly Kandidat[]): PocetKosu {
  const p: PocetKosu = { cilova: 0, bezVelikosti: 0, mikro: 0 };
  for (const k of kandidati) {
    if (k.kosik === "cilova") p.cilova++;
    else if (k.kosik === "bez_velikosti") p.bezVelikosti++;
    else if (k.kosik === "mikro") p.mikro++;
  }
  return p;
}
```

- [ ] **Krok 4: Spusť testy a ověř, že prošly**

```bash
npm test -- kampan-kandidati
```

Očekávej: PASS, 10 testů.

- [ ] **Krok 5: Ověř, že hranice aplikace drží**

```bash
npm test -- hranice-aplikace
```

Očekávej: PASS. Kdyby padlo, importuje nový modul něco, co sahá na databázi —
oprav import, ne test.

- [ ] **Krok 6: Commit**

```bash
git add src/kampan-kandidati.ts test/kampan-kandidati.test.ts
git commit -m "feat: třídění kandidátů z území do kampaně jako čistý modul"
```

---

### Úkol 2: Plnění a počty čekajících nad sdíleným tříděním

**Soubory:**
- Změnit: `app/src/data.ts:743-844` (`NaplneniKampane`, `naplnKampanZOblasti`)

**Rozhraní:**
- Spotřebovává: `roztridKandidaty`, `spoctiKose`, typ `PocetKosu` z úkolu 1.
- Poskytuje: `spocitejCekajici(kampanId, oblastiIds): Promise<PocetKosu>` —
  úkol 3 to volá. `naplnKampanZOblasti` si **ponechává dosavadní podpis
  i návratový tvar** `NaplneniKampane`; 4. krok ho používá beze změny.

- [ ] **Krok 1: Přepiš `naplnKampanZOblasti` na sdílené třídění**

V `app/src/data.ts` doplň k importům ze `src/`:

```ts
import {
  roztridKandidaty,
  spoctiKose,
  type PocetKosu,
} from "../../src/kampan-kandidati";
```

Pak nahraď tělo cyklu (dnešní řádky 785–828, od `const vynechano` po konec
`for`) tímhle:

```ts
  const kandidati = roztridKandidaty({
    firmy,
    vUzemi: vOblastech,
    // Prázdná schválně: duplicity odchytí `on conflict do nothing` a seznam
    // `vynechano` musí dál vypisovat VŠECHNY firmy zadržené sítem, ne jen ty,
    // které v kampani ještě nejsou. Kdo nevidí, proč firma chybí, přestane
    // pravidlům věřit.
    jizVKampani: new Set<string>(),
    sito,
  });

  const vynechano: NaplneniKampane["vynechano"] = kandidati
    .filter((k) => k.kosik === "sito")
    .map((k) => ({
      ico: k.ico,
      nazev: k.nazev,
      duvod: POPIS_DUVODU[k.duvod!.duvod] ?? k.duvod!.duvod,
      detail: k.duvod!.detail,
    }));

  const pocty = spoctiKose(kandidati);
  const preskoceno = {
    mikro: pocty.mikro,
    // Přeskočené jen tehdy, když se braly jen cílové. Při širokém rozsahu
    // se nepřeskočilo nic — vešly se do kampaně.
    bezVelikosti: opts.jenCilove ? pocty.bezVelikosti : 0,
  };

  const kVlozeni = kandidati
    .filter((k) => k.kosik === "cilova" || (!opts.jenCilove && k.kosik === "bez_velikosti"))
    .map((k) => ({ kampan_id: kampanId, ico: k.ico }));
```

Zbytek funkce (vkládání po pěti stech a `return { pridano, vynechano, preskoceno }`)
zůstává beze změny. Smaž osiřelý `const podleIco = ...` na dnešním řádku 783 —
třídění si firmy najde samo.

- [ ] **Krok 2: Přidej `spocitejCekajici`**

Hned za `naplnKampanZOblasti` v `app/src/data.ts`:

```ts
/**
 * Kolik firem z území v kampani ještě NENÍ, po koších.
 *
 * Nic neukládá a nikam se nezapisuje — počítá se z dat pokaždé znovu, aby
 * číslo na obrazovce nemohlo zastarat. Co tahle funkce vrátí v `bezVelikosti`,
 * to tlačítko „přidat i firmy s neznámou velikostí" doopravdy přidá.
 */
export async function spocitejCekajici(
  kampanId: string,
  oblastiIds: readonly string[],
): Promise<PocetKosu> {
  if (oblastiIds.length === 0) return { cilova: 0, bezVelikosti: 0, mikro: 0 };

  const [firmy, sito, vOblastech, vKampani] = await Promise.all([
    nactiFirmy(),
    nactiPravidlaSita(),
    nactiIcaVOblastech(oblastiIds),
    nactiFirmyKampane(kampanId),
  ]);

  return spoctiKose(
    roztridKandidaty({
      firmy,
      vUzemi: vOblastech,
      // Vyřazené firmy jsou v `kampan_firmy` taky a doplnění je nevzkřísí —
      // proto sem patří všechny, ne jen ty se stavem `vybrana`.
      jizVKampani: new Set(vKampani.map((f) => f.ico)),
      sito,
    }),
  );
}
```

- [ ] **Krok 3: Ověř typy a sestavení aplikace**

```bash
npm run typecheck
```

Očekávej: bez chyb. Pozor na `POPIS_DUVODU` — je deklarovaný nad
`NaplneniKampane`, takže je k dispozici.

```bash
npm run build --prefix app
```

Očekávej: úspěch. Kdyby spadlo na `Cannot find module '@electric-sql/pglite'`,
přitáhl si nový import databázi — vrať se k úkolu 1.

- [ ] **Krok 4: Spusť celou sadu**

```bash
npm test
```

Očekávej: PASS, všechno zelené (před touhle prací 540 testů v 62 souborech,
teď o soubor a deset testů víc).

- [ ] **Krok 5: Commit**

```bash
git add app/src/data.ts
git commit -m "refactor: plnění kampaně a počet čekajících sdílejí jedno třídění"
```

---

### Úkol 3: Panel čekajících a tlačítko ve 4. kroku

**Soubory:**
- Změnit: `app/src/PruvodceKampani.tsx` (stav a `nactiSeznam` kolem řádku 262;
  4. krok kolem řádků 755–800; poznámka ve 2. kroku kolem řádků 474–492)

**Rozhraní:**
- Spotřebovává: `spocitejCekajici` a typ `PocetKosu` z úkolu 2, `odhadKontaktu`
  ze `src/odhady.js` (už je naimportovaný, řádek 38).
- Poskytuje: nic dalšího — tohle je poslední úkol.

- [ ] **Krok 1: Doplň stav a načítání**

K importům z `./data` přidej `spocitejCekajici` a `type PocetKosu`.

Ke stavům (za `preskoceno`, dnešní řádek 97) přidej:

```tsx
  /**
   * Kolik firem z území v kampani ještě není. Načítá se při vstupu do
   * 4. kroku a po každém doplnění — na rozdíl od `preskoceno` (které se
   * plní jen z výsledku doplnění) tedy platí i po znovuotevření kampaně.
   */
  const [cekajici, setCekajici] = useState<PocetKosu | null>(null);
  const [pridatNezname, setPridatNezname] = useState(false);
```

A pod `const smi = smiUpravovat(...)` (dnešní řádek 104):

```tsx
  /**
   * Schválená kampaň se ze seznamu otevřít DÁ (`Kampane.tsx`, klik na název),
   * a schvalovací dialog slibuje, že se seznam uzamkne. Databáze to ale
   * nehlídá — `smi_do_kampane` se ptá jen KDO, ne v jakém je kampaň stavu.
   * Do nápravy v databázi to tedy drží obrazovka: u schválené kampaně se
   * doplňování nenabízí vůbec.
   */
  const zamcena = kampan?.stav === "schvalena";
```

V `nactiSeznam` (dnešní řádky 262–277) doplň do `Promise.all` čtvrtý dotaz
a nastav stav. Celý callback nahraď tímhle:

```tsx
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
```

- [ ] **Krok 2: Přidej obsluhu tlačítka**

Za funkci `naplnit` (dnešní řádky 283–297):

```tsx
  /** Doplní z území se širokým rozsahem — tedy i firmy bez známé velikosti. */
  async function pridejNezname() {
    if (!id || oblastiIds.length === 0) return;
    setUklada(true);
    setChyba(null);
    try {
      const v = await naplnKampanZOblasti(id, oblastiIds, { jenCilove: false });
      setVynechano(v.vynechano);
      setPreskoceno(v.preskoceno);
      setPridatNezname(false);
      nactiSeznam();
    } catch (e) {
      setChyba((e as Error).message);
      setPridatNezname(false);
    } finally {
      setUklada(false);
    }
  }
```

- [ ] **Krok 3: Nahraď hlášku ve 4. kroku panelem**

Ve 4. kroku smaž celý dnešní blok `{preskoceno && preskoceno.mikro + ... }`
(řádky 765–790 včetně komentáře nad ním) a na jeho místo dej:

```tsx
          {/*
            Proč seznam nemá víc firem, se musí říct nahlas — a pořád, ne jen
            hned po stisku doplnění. Kampaň nad Čachrovem skončila s nulou
            a jedinou hláškou „v tomhle tvaru zatím žádná firma není"; přitom
            jich tam bylo 91, jen u nich nebyla známá velikost. Prázdný
            výsledek bez důvodu vypadá jako rozbitá aplikace.

            Číslo se dopočítá z dat při každém otevření, takže nemůže zastarat:
            co je tu napsané, to tlačítko doopravdy přidá.
          */}
          {!zamcena && cekajici && cekajici.bezVelikosti > 0 && (
            <div className={`hlaska ${firmy.length === 0 ? "" : "je-klid"}`}>
              {firmy.length === 0 && (
                <strong>Do kampaně se zatím nedostala žádná firma. </strong>
              )}
              V území čeká {cekajici.bezVelikosti.toLocaleString("cs")}{" "}
              {cesky(cekajici.bezVelikosti, "firma", "firmy", "firem")}, u{" "}
              {cesky(cekajici.bezVelikosti, "které", "kterých", "kterých")}{" "}
              <strong>registr neuvádí velikost</strong>. Dohledání kontaktů u nich
              zabere navíc {odhadKontaktu(cekajici.bezVelikosti)}.
              <div className="tlacitka vlevo">
                <button
                  className="tlacitko"
                  disabled={uklada}
                  onClick={() => setPridatNezname(true)}
                >
                  Přidat i {cekajici.bezVelikosti.toLocaleString("cs")}{" "}
                  {cesky(cekajici.bezVelikosti, "firmu", "firmy", "firem")} s neznámou velikostí
                </button>
              </div>
            </div>
          )}

          {/* Mikrofirmy se nabízet nesmějí — jen se zmíní, ať je jasné,
              že se na ně nezapomnělo. */}
          {cekajici && cekajici.mikro > 0 && (
            <p className="poznamka">
              Dalších {cekajici.mikro.toLocaleString("cs")} firem v území je do 24
              zaměstnanců; ty se do kampaně neberou nikdy.
            </p>
          )}
```

- [ ] **Krok 4: Přidej potvrzovací dialog**

Vedle dialogu „Schválit kampaň" (na konci 4. kroku, za blok `{schvalit && ...}`):

```tsx
        {pridatNezname && cekajici && (
          <div
            className="zaclona"
            role="dialog"
            aria-modal="true"
            aria-label="Přidat firmy s neznámou velikostí"
          >
            <div className="dialog">
              <h3>
                Přidat {cekajici.bezVelikosti.toLocaleString("cs")}{" "}
                {cesky(cekajici.bezVelikosti, "firmu", "firmy", "firem")} s neznámou
                velikostí?
              </h3>
              <p>
                Registr o jejich velikosti mlčí — jestli stojí za oslovení, se
                ukáže až při rešerši. Dohledání kontaktů u nich zabere navíc{" "}
                <strong>{odhadKontaktu(cekajici.bezVelikosti)}</strong>.
              </p>
              <p className="poznamka">
                Zpátky to jde jen po jedné, tlačítkem Vyřadit u konkrétní firmy.
                Hromadné odebrání není — smazalo by i rozhodnutí, která jste
                mezitím udělali.
              </p>
              <div className="tlacitka vlevo">
                <button className="tlacitko tise" onClick={() => setPridatNezname(false)}>
                  Ještě ne
                </button>
                <button className="tlacitko" disabled={uklada} onClick={pridejNezname}>
                  {uklada ? "Přidávám…" : "Přidat"}
                </button>
              </div>
            </div>
          </div>
        )}
```

- [ ] **Krok 5: Schovej doplňování i u schválené kampaně**

Tentýž problém má **stávající** tlačítko „Naplnit / Doplnit z území" — ve
4. kroku se ukazuje bez ohledu na stav kampaně, takže do schváleného seznamu
dnes jde přidávat. Nechat jedno tlačítko schované a druhé viditelné by
obrazovce protiřečilo, takže se schová obojí. Obal dnešní blok (řádky 755–763)
podmínkou a doplň vysvětlení:

```tsx
          {!zamcena ? (
            <div className="tlacitka vlevo">
              <button
                className="tlacitko tise"
                onClick={naplnit}
                disabled={uklada || oblastiIds.length === 0}
              >
                {uklada ? "Pracuji…" : firmy.length === 0 ? "Naplnit z území" : "Doplnit z území"}
              </button>
            </div>
          ) : (
            <p className="hlaska je-hotovo">
              Kampaň je schválená, seznam firem je uzavřený. Přidávat do něj
              už nejde.
            </p>
          )}
```

- [ ] **Krok 6: Přeformuluj poznámku ve 2. kroku**

Ve 2. kroku nahraď větev `) : (` uvnitř `<p className="poznamka">` (dnešní
řádky 484–490) tímhle — stará věta tvrdí, jak to dopadne natrvalo, nová mluví
o nejbližším naplnění:

```tsx
                    <>
                      Naplnění vezme jen firmy s doloženými 25 a více zaměstnanci.
                      Zbylých {slozeniVyberu.bez_velikosti.toLocaleString("cs")} firem
                      má mezi sebou i skutečné firmy, u kterých registr velikost
                      prostě neuvádí — <strong>přibrat je můžete i potom</strong>,
                      tlačítkem v posledním kroku.
                    </>
```

- [ ] **Krok 7: Ověř typy a sestavení**

```bash
npm run typecheck
```

Očekávej: bez chyb.

```bash
npm run build --prefix app
```

Očekávej: úspěch.

- [ ] **Krok 8: Spusť celou sadu**

```bash
npm test
```

Očekávej: PASS, všechno zelené.

- [ ] **Krok 9: Commit**

```bash
git add app/src/PruvodceKampani.tsx
git commit -m "feat: firmy bez známé velikosti jde přibrat i dodatečně, u seznamu firem"
```

---

## Ověření v prohlížeči (majitel u toho musí být)

Zelené testy tady nestačí — týká se to toku a pořadí obrazovek, což testy
nechytí. Postup:

- [ ] `npm run dev --prefix app` (port 5173), majitel se přihlásí v panelu Browser.
- [ ] Otevři kampaň nad **Čachrovem** a projdi na 4. krok.
- [ ] **Panel se ukáže hned po otevření**, bez mačkání „Doplnit z území".
- [ ] Číslo v panelu si zapiš. Stiskni tlačítko, potvrď dialog.
- [ ] **Počet firem v seznamu vzrostl přesně o to číslo** a panel zmizel.
- [ ] Zavři kampaň, otevři ji znovu — panel je pryč a zůstal pryč.
- [ ] Vyřaď jednu z přidaných firem s důvodem, otevři kampaň znovu — **panel se
      nevrátil** (vyřazená firma se mezi čekající nepočítá).
- [ ] Otevři **schválenou** kampaň ze seznamu — panel ani tlačítka doplnění
      tam nejsou, místo nich je věta, že seznam je uzavřený.

## Sebekontrola plánu

Prošel jsem zadání kapitolu po kapitole:

| Kapitola zadání | Kde se plní |
|---|---|
| 3. Co uvidí majitel (tři stavy, mikro poznámka, `odhadKontaktu`) | Úkol 3, krok 3 |
| 4. Co tlačítko udělá (dialog, široký rozsah, znovunačtení) | Úkol 3, kroky 2 a 4 |
| 5. Jedno pravidlo, `roztridKandidaty`, `spocitejCekajici`, past s vyřazenými | Úkoly 1 a 2 |
| 6. Změna poznámky ve 2. kroku | Úkol 3, krok 6 |
| 7. Co se nemění (mikro, vyřazené, návratový tvar) | Úkol 1 (koš `mikro`), úkol 2 (krok 1) |
| 7. Schválená kampaň zůstává zamčená | Úkol 3, kroky 1, 3 a 5 — **viz níž** |
| 8. Testy (7 případů ze zadání) | Úkol 1, krok 1 — je jich 10, sedm ze zadání plus tři na počty |
| 9. Hotovo (testy, typecheck, build, proklikání) | Úkoly 2–3 + sekce Ověření v prohlížeči |
| 10. Neřeší se objednání rešerše | Záměrně mimo plán |

### Nález při psaní plánu: schválený seznam není zamčený

Zadání (kap. 7) předpokládalo, že schválená kampaň je zamčená sama od sebe.
**Není.** Ověřeno v kódu:

- `app/src/Kampane.tsx:190` — klik na název otevře v průvodci **kteroukoli**
  kampaň, i schválenou.
- `supabase/migrations/0024_kampan_zastup.sql:75-78` — pravidlo
  `kampan_firmy_zapis` stojí na `smi_do_kampane(kampan_id)`, a ta funkce
  (řádky 22–37) se ptá **jen kdo** — správce, zástup nebo admin. Stav kampaně
  nekontroluje.

Schvalovací dialog přitom slibuje: „Seznam se tím uzamkne a nepůjde do něj
přidávat." Dnes to není pravda ani pro stávající tlačítko „Doplnit z území".

Plán to drží **na obrazovce** (úkol 3, kroky 1, 3 a 5), což tuhle práci
nepostaví na nepravdivém předpokladu. **Nezavírá to ale díru v databázi** —
projektové pravidlo říká, že tvrdá pravidla se vynucují v kódu/DB, ne
v promptu. Náprava znamená migraci (podmínka na stav kampaně v pravidle zápisu)
a nasazení, což je **vlastní úkol a rozhodnutí majitele**, ne tichý přívažek
téhle práce.
