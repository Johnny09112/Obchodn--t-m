# Čmuchal nad oblastmi · plán implementace

> **Pro agentní pracovníky:** POVINNÝ PODSKILL: použij
> `superpowers:subagent-driven-development` (doporučeno) nebo
> `superpowers:executing-plans` a jeď úkol po úkolu. Kroky mají zaškrtávátka
> (`- [ ]`) na sledování postupu.

**Cíl:** Naučit sběr pracovat nad nakresleným tvarem, ne jen kolem jídelny —
a rozdělit ho na úseky po obcích, aby šel přerušit a navázat.

**Architektura:** Tvar se přeloží na obce mřížkou bodů a zpětným dohledáním
(`src/uzemi.ts`), obce na územní jednotky registru. Každá jednotka je jeden
úsek (`pruzkum_useky`); běh je bere popořadě a odškrtává. Vyřízení objednávky
žije v `src/cmuchal-oblast.ts`, aby `src/cmuchal.ts` dál nerostl.

**Zadání:** `docs/superpowers/specs/2026-07-30-cmuchal-nad-oblastmi-design.md`.
Při rozporu platí zadání; při rozporu se zadáním platí `SPEC.md`.

**Technologie:** TypeScript (ESM, přípona `.js` v importech), PGlite pro
testy, Postgres/Supabase v provozu, vitest.

## Globální omezení

- **Nic se neodesílá.** Nevzniká kód, který odesílá, skládá text zprávy nebo
  sahá na `system_state.sending_enabled` (TP-8).
- **Firma vzniká jen přes `zalozFirmu()`** po ověření v ARES (TP-1). Žádné
  přímé INSERTy do `companies`, `contacts` ani `evidence`.
- **Každý dohledaný údaj má zdroj** (TP-2). Bez zdroje zůstává NULL.
- **Oblast nepřiřazuje firmu k jídelně.** Firmy z oblasti se ukládají
  s prázdnou jídelnou; o přiřazení rozhoduje vzdálenost a je to samostatná
  funkce mimo tento plán.
- **Externí zdroje šetrně:** Nominatim nejvýš 1 dotaz za sekundu, a to
  dohromady za všechny druhy dotazů.
- **Testy běží offline nad PGlite, bez proměnných prostředí a bez sítě.**
  `npm test` musí projít vždy. Na vstupu je zelených **300**.
- **Jazyk:** čeština v komentářích, dokumentaci i commit messages;
  identifikátory česky bez diakritiky.
- **Migrace se jen přidávají.** Soubory 0001–0021 se needitují (0018–0021
  jsou nasazené).
- **Neznámý údaj se nikdy netváří jako nula.**

---

## Struktura souborů

| soubor | odpovědnost |
|---|---|
| `src/uzemi.ts` | z tvaru na obce: mřížka bodů, zpětné dohledání, sloučení |
| `src/geocode.ts` (úprava) | zpětné dohledání místa ze souřadnic |
| `src/registr.ts` (úprava) | překlad místa na územní jednotku |
| `src/repo.ts` (úprava) | firma smí být bez jídelny |
| `src/cmuchal-oblast.ts` | rozhlédnutí a vyřízení objednávky po úsecích |
| `src/cli.ts` (úprava) | příkazy `pruzkum rozhlednuti / vyrid / useky` |
| `supabase/migrations/0022_pruzkum_useky.sql` | úseky a nový stav objednávky |
| `test/uzemi.test.ts` | mřížka a obce v oblasti |
| `test/registr-jednotky.test.ts` | překlad místa na jednotku |
| `test/cmuchal-oblast.test.ts` | rozhlédnutí, úseky, navázání |

---

## Úkol 1: Mřížka bodů uvnitř tvaru

**Soubory:** Vytvořit `src/uzemi.ts`, `test/uzemi.test.ts`

**Rozhraní:**
- Spotřebovává: `bodVOblasti`, `Oblast` z `./oblast-tvar.js`; `Bod` z `./geo.js`.
- Poskytuje: `mrizkaVOblasti(oblast: Oblast, krokM: number): Bod[]`.

- [ ] **Krok 1: Napiš padající test**

`test/uzemi.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mrizkaVOblasti } from "../src/uzemi.js";
import { bodVOblasti, type Oblast } from "../src/oblast-tvar.js";

const STRED = { lat: 49.6, lng: 13.2 };
const kruh: Oblast = { typ: "kruh", stred: STRED, polomerM: 12_000 };

describe("mřížka bodů uvnitř tvaru", () => {
  it("vrátí jen body, které leží uvnitř", () => {
    const body = mrizkaVOblasti(kruh, 3000);
    expect(body.length).toBeGreaterThan(5);
    for (const b of body) expect(bodVOblasti(kruh, b)).toBe(true);
  });

  it("u konkávního tvaru nedá body do zálivu", () => {
    // Písmeno L: pravý horní roh do tvaru nepatří.
    const eL: Oblast = {
      typ: "polygon",
      body: [
        { lat: 49.60, lng: 13.20 },
        { lat: 49.70, lng: 13.20 },
        { lat: 49.70, lng: 13.25 },
        { lat: 49.65, lng: 13.25 },
        { lat: 49.65, lng: 13.35 },
        { lat: 49.60, lng: 13.35 },
      ],
    };
    const body = mrizkaVOblasti(eL, 2000);
    expect(body.length).toBeGreaterThan(3);
    for (const b of body) expect(bodVOblasti(eL, b)).toBe(true);
    // V zálivu (vpravo nahoře) nesmí být nic.
    expect(body.some((b) => b.lat > 49.66 && b.lng > 13.28)).toBe(false);
  });

  it("malý tvar nezůstane bez jediného bodu", () => {
    // Kruh o 400 m je menší než krok 3 km — mřížka ho musí zjemnit,
    // jinak by se území tvářilo jako prázdné.
    const drobek: Oblast = { typ: "kruh", stred: STRED, polomerM: 400 };
    const body = mrizkaVOblasti(drobek, 3000);
    expect(body.length).toBeGreaterThan(0);
    for (const b of body) expect(bodVOblasti(drobek, b)).toBe(true);
  });

  it("nesmyslný krok skončí chybou, ne nekonečným během", () => {
    expect(() => mrizkaVOblasti(kruh, 0)).toThrow();
    expect(() => mrizkaVOblasti(kruh, -100)).toThrow();
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/uzemi.test.ts`
Čekej: FAIL — `Cannot find module '../src/uzemi.js'`.

- [ ] **Krok 3: Napiš `src/uzemi.ts`**

```ts
/**
 * Z nakresleného tvaru na seznam obcí.
 *
 * Registr ČSÚ hledá firmy podle územní jednotky, ne podle souřadnic — tvar
 * má naopak jen souřadnice. Tenhle modul ten překlad zajišťuje: rozseje
 * do tvaru mřížku bodů a u každého se zeptá, jaká obec na něm leží.
 */
import { bodVOblasti, type Oblast } from "./oblast-tvar.js";
import type { Bod } from "./geo.js";

/** Stupeň zeměpisné šířky má zhruba tolik metrů, všude stejně. */
const METRU_NA_STUPEN = 111_320;

interface Obal {
  jih: number;
  sever: number;
  zapad: number;
  vychod: number;
}

function obalTvaru(oblast: Oblast): Obal {
  if (oblast.typ === "kruh") {
    if (!oblast.stred || oblast.polomerM === undefined) {
      throw new Error("Kruh bez středu nebo poloměru nemá obal.");
    }
    const dLat = oblast.polomerM / METRU_NA_STUPEN;
    const dLng =
      oblast.polomerM / (METRU_NA_STUPEN * Math.cos((oblast.stred.lat * Math.PI) / 180));
    return {
      jih: oblast.stred.lat - dLat,
      sever: oblast.stred.lat + dLat,
      zapad: oblast.stred.lng - dLng,
      vychod: oblast.stred.lng + dLng,
    };
  }
  const body = oblast.body ?? [];
  if (body.length < 3) throw new Error("Tvar s méně než třemi body neohraničí plochu.");
  return {
    jih: Math.min(...body.map((b) => b.lat)),
    sever: Math.max(...body.map((b) => b.lat)),
    zapad: Math.min(...body.map((b) => b.lng)),
    vychod: Math.max(...body.map((b) => b.lng)),
  };
}

/**
 * Body pravidelné mřížky, které leží uvnitř tvaru.
 *
 * Když mřížka nechytí ani jeden bod, krok se opakovaně půlí. Malý tvar —
 * třeba jedna průmyslová zóna — by se jinak tvářil jako prázdné území
 * a průzkum by nenašel nic.
 */
export function mrizkaVOblasti(oblast: Oblast, krokM: number): Bod[] {
  if (!(krokM > 0)) throw new Error("Krok mřížky musí být kladný.");

  const obal = obalTvaru(oblast);
  // Pět zjemnění stačí: z 3 km se dostaneme pod 100 m.
  for (let pokus = 0, krok = krokM; pokus < 6; pokus++, krok /= 2) {
    const body = posbirej(oblast, obal, krok);
    if (body.length > 0) return body;
  }
  return [];
}

function posbirej(oblast: Oblast, obal: Obal, krokM: number): Bod[] {
  const krokLat = krokM / METRU_NA_STUPEN;
  const body: Bod[] = [];

  // Začíná se od poloviny kroku, aby body nepadaly přesně na hranici tvaru.
  for (let lat = obal.jih + krokLat / 2; lat <= obal.sever; lat += krokLat) {
    // Poledníky se k pólům sbíhají, takže krok na délku závisí na šířce.
    const krokLng = krokM / (METRU_NA_STUPEN * Math.cos((lat * Math.PI) / 180));
    for (let lng = obal.zapad + krokLng / 2; lng <= obal.vychod; lng += krokLng) {
      const bod = { lat, lng };
      if (bodVOblasti(oblast, bod)) body.push(bod);
    }
  }
  return body;
}
```

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/uzemi.test.ts`
Čekej: PASS, 4 testy.

- [ ] **Krok 5: Celá sada**

Spusť: `npm test` — čekej 304 zelených.

- [ ] **Krok 6: Commit**

```bash
git add src/uzemi.ts test/uzemi.test.ts
git commit -m "feat: mřížka bodů uvnitř nakresleného tvaru"
```

---

## Úkol 2: Zpětné dohledání místa v geokodéru

**Soubory:** Upravit `src/geocode.ts`; vytvořit `test/geocode-zpetne.test.ts`

**Rozhraní:**
- Poskytuje: typ `Misto { obec: string; psc: string | null }` a metodu
  `Geokoder.zpetne(bod: Bod): Promise<Misto | null>`.

- [ ] **Krok 1: Napiš padající test**

`test/geocode-zpetne.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { vytvorGeokoder } from "../src/geocode.js";

function odpoved(telo: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(telo) } as Response);
}

describe("zpětné dohledání místa", () => {
  it("vytáhne obec a PSČ z odpovědi", async () => {
    const fetchFn = vi.fn(() =>
      odpoved({ address: { village: "Zbůch", postcode: "330 22" } }),
    );
    const g = vytvorGeokoder({ fetchFn: fetchFn as unknown as typeof fetch, prodlevaMs: 0, kontakt: "a@b.cz" });
    expect(await g.zpetne({ lat: 49.6, lng: 13.2 })).toEqual({ obec: "Zbůch", psc: "330 22" });
  });

  it("město i obec bez PSČ zvládne taky", async () => {
    const fetchFn = vi.fn(() => odpoved({ address: { town: "Rokycany" } }));
    const g = vytvorGeokoder({ fetchFn: fetchFn as unknown as typeof fetch, prodlevaMs: 0, kontakt: "a@b.cz" });
    expect(await g.zpetne({ lat: 49.7, lng: 13.6 })).toEqual({ obec: "Rokycany", psc: null });
  });

  it("bez obce vrátí null, nikdy si nic nedomýšlí", async () => {
    const fetchFn = vi.fn(() => odpoved({ address: { country: "Česko" } }));
    const g = vytvorGeokoder({ fetchFn: fetchFn as unknown as typeof fetch, prodlevaMs: 0, kontakt: "a@b.cz" });
    expect(await g.zpetne({ lat: 49.0, lng: 14.0 })).toBeNull();
  });

  it("chybu služby nespolkne", async () => {
    const fetchFn = vi.fn(() => Promise.resolve({ ok: false, status: 503 } as Response));
    const g = vytvorGeokoder({ fetchFn: fetchFn as unknown as typeof fetch, prodlevaMs: 0, kontakt: "a@b.cz" });
    await expect(g.zpetne({ lat: 49.6, lng: 13.2 })).rejects.toThrow();
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/geocode-zpetne.test.ts`
Čekej: FAIL — `g.zpetne is not a function`.

- [ ] **Krok 3: Doplň do `src/geocode.ts`**

Do rozhraní `Geokoder` přidej metodu a nový typ:

```ts
export interface Misto {
  obec: string;
  psc: string | null;
}
```

```ts
export interface Geokoder {
  geokoduj(adresa: string): Promise<Bod | null>;
  /**
   * Zpětné dohledání: ze souřadnic na obec. Nenalezeno → null, nikdy odhad.
   *
   * Nominatim vrací název obce v různých polích podle velikosti sídla,
   * proto se zkouší postupně.
   */
  zpetne(bod: Bod): Promise<Misto | null>;
}
```

Implementaci napiš **do stejné fronty a se stejnou prodlevou** jako
`geokoduj` — omezení jednoho dotazu za sekundu platí na celou službu,
ne na metodu. Volá se `https://nominatim.openstreetmap.org/reverse`
s parametry `format=jsonv2`, `lat`, `lon`, `zoom=10`, `addressdetails=1`
a stejnou hlavičkou `User-Agent` jako `geokoduj`.

Z odpovědi ber `address.village`, `address.town`, `address.city`
nebo `address.municipality` — první, které je vyplněné. PSČ z
`address.postcode`, chybí-li, tak `null`. Když není žádné z těch polí,
vrať `null`. Neúspěšnou odpověď služby (`ok === false`) ohlas výjimkou
stejně, jako to dělá `geokoduj`.

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/geocode-zpetne.test.ts` — čekej PASS, 4 testy.

- [ ] **Krok 5: Celá sada a typy**

`npm test` (čekej 308) a `npm run typecheck`.

> **Pozor:** `Geokoder` je rozhraní, které si testy jinde vyrábějí falešné.
> Přidáním metody se rozbijí — dopočítej je a doplň jim `zpetne`, které
> vrací `null`. Kdyby jich bylo víc než pět, ohlas to a zeptej se.

- [ ] **Krok 6: Commit**

```bash
git add src/geocode.ts test/geocode-zpetne.test.ts
git commit -m "feat: zpětné dohledání obce ze souřadnic"
```

---

## Úkol 3: Obce, které tvar zabírá

**Soubory:** Upravit `src/uzemi.ts` a `test/uzemi.test.ts`

**Rozhraní:**
- Spotřebovává: `mrizkaVOblasti` (úkol 1), `Geokoder`, `Misto` (úkol 2).
- Poskytuje: `obceVOblasti(geokoder, oblast, opts?) → Promise<VysledekObci>`.

- [ ] **Krok 1: Napiš padající test**

Přidej do `test/uzemi.test.ts`:

```ts
import { obceVOblasti } from "../src/uzemi.js";
import type { Geokoder, Misto } from "../src/geocode.js";

/** Falešný geokodér: vrací obec podle zeměpisné šířky. */
function falesny(mapa: (b: { lat: number; lng: number }) => Misto | null): Geokoder {
  return {
    geokoduj: async () => null,
    zpetne: async (b) => mapa(b),
  };
}

describe("obce, které tvar zabírá", () => {
  it("stejnou obec vrátí jednou, i když ji trefí víc bodů", async () => {
    const g = falesny(() => ({ obec: "Zbůch", psc: "330 22" }));
    const v = await obceVOblasti(g, kruh, { krokM: 3000 });
    expect(v.mista).toEqual([{ obec: "Zbůch", psc: "330 22" }]);
    expect(v.bodu).toBeGreaterThan(1);
    expect(v.nedohledano).toBe(0);
  });

  it("stejná obec s jiným PSČ je jiné místo", async () => {
    // Hrádek je v ČR šestkrát; PSČ je to, co je rozliší.
    const g = falesny((b) =>
      b.lat > 49.6 ? { obec: "Hrádek", psc: "330 01" } : { obec: "Hrádek", psc: "338 42" },
    );
    const v = await obceVOblasti(g, kruh, { krokM: 3000 });
    expect(v.mista).toHaveLength(2);
  });

  it("nedohledané body spočítá a nespadne", async () => {
    const g = falesny((b) => (b.lat > 49.6 ? { obec: "Zbůch", psc: null } : null));
    const v = await obceVOblasti(g, kruh, { krokM: 3000 });
    expect(v.mista).toEqual([{ obec: "Zbůch", psc: null }]);
    expect(v.nedohledano).toBeGreaterThan(0);
  });

  it("když nevyjde ani jeden bod, řekne to zvlášť", async () => {
    // Rozdíl mezi „tady nic není" a „služba neodpovídá" je podstatný.
    const g = falesny(() => null);
    const v = await obceVOblasti(g, kruh, { krokM: 3000 });
    expect(v.mista).toEqual([]);
    expect(v.nedohledano).toBe(v.bodu);
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/uzemi.test.ts`
Čekej: FAIL — `obceVOblasti is not a function`.

- [ ] **Krok 3: Doplň do `src/uzemi.ts`**

```ts
import type { Geokoder, Misto } from "./geocode.js";

/** Výchozí hustota mřížky. Odhad, ne měření — proto je to přepínač. */
export const KROK_MRIZKY_M = 3000;

export interface VysledekObci {
  mista: Misto[];
  /** Kolik bodů mřížky se dohledávalo. */
  bodu: number;
  /** U kolika z nich služba nic nevrátila. */
  nedohledano: number;
}

/**
 * Obce, které tvar zabírá.
 *
 * Rozdíl mezi „nedohledáno u některých bodů" a „nedohledáno u všech" je
 * podstatný: první je prázdné místo v krajině, druhé znamená nedostupnou
 * službu. Volající se podle toho rozhoduje, proto se počty vracejí.
 */
export async function obceVOblasti(
  geokoder: Geokoder,
  oblast: Oblast,
  opts: { krokM?: number } = {},
): Promise<VysledekObci> {
  const body = mrizkaVOblasti(oblast, opts.krokM ?? KROK_MRIZKY_M);
  const podleKlice = new Map<string, Misto>();
  let nedohledano = 0;

  for (const bod of body) {
    const misto = await geokoder.zpetne(bod);
    if (!misto) {
      nedohledano++;
      continue;
    }
    // Klíčem je obec i PSČ — „Hrádek" je v ČR šestkrát.
    podleKlice.set(`${misto.obec}|${misto.psc ?? ""}`, misto);
  }

  return { mista: [...podleKlice.values()], bodu: body.length, nedohledano };
}
```

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/uzemi.test.ts` — čekej PASS, 8 testů.

- [ ] **Krok 5: Commit**

```bash
git add src/uzemi.ts test/uzemi.test.ts
git commit -m "feat: obce, které nakreslený tvar zabírá"
```

---

## Úkol 4: Překlad místa na územní jednotku

**Soubory:** Upravit `src/registr.ts`; vytvořit `test/registr-jednotky.test.ts`

**Rozhraní:**
- Poskytuje: `RegistrKlient.jednotkyPodleMist(mista) → Promise<Array<{ jednotka: number; obec: string }>>`.

- [ ] **Krok 1: Prohlédni si, jak klient čte registr**

Otevři `src/registr.ts` a najdi, jak `zamestnavateleVJednotkach` prochází
soubor a jak se testuje (`test/registr.test.ts`). Nový překlad musí číst
**stejným způsobem a jedním průchodem** — registr má 541 MB a průchod
na každé místo zvlášť by u dvaceti míst znamenal dvacet průchodů.

- [ ] **Krok 2: Napiš padající test**

`test/registr-jednotky.test.ts` napiš podle vzoru `test/registr.test.ts`
(použij stejný způsob podstrčení falešných dat). Musí ověřit:

```
1. Místo s obcí i PSČ najde svou jednotku.
2. Stejný název obce v jiném PSČ se NEsmí připlést.
   (Zásadní: „Hrádek" je v ČR šestkrát.)
3. Místo bez PSČ najde všechny jednotky toho jména —
   raději víc práce než minout tu správnou.
4. Neznámá obec nevrátí nic a nespadne.
5. Dvě místa v jedné jednotce dají jeden výsledek, ne dva.
6. Prázdný seznam míst vrátí prázdný výsledek bez čtení souboru.
```

- [ ] **Krok 3: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/registr-jednotky.test.ts`
Čekej: FAIL — metoda neexistuje.

- [ ] **Krok 4: Doplň metodu**

Do `RegistrKlient` přidej:

```ts
  /**
   * Územní jednotky odpovídající zadaným místům.
   *
   * Hledá podle názvu obce **a PSČ** — samotný název nestačí, „Hrádek" je
   * v ČR šestkrát a podle jména by se natáhly firmy z cizích obcí. Místo
   * bez PSČ vrátí všechny jednotky toho jména; raději víc práce než minout
   * tu správnou, protože tvar stejně na konci firmy ořeže.
   *
   * Jedním průchodem souboru pro všechna místa naráz.
   */
  jednotkyPodleMist(
    mista: readonly Misto[],
  ): Promise<Array<{ jednotka: number; obec: string }>>;
```

Implementaci napiš tak, aby:
- při prázdném seznamu míst soubor vůbec neotvírala,
- porovnávala názvy bez ohledu na velikost písmen a okolní mezery,
- PSČ porovnávala po odstranění mezer („330 22" = „33022"),
- vracela každou jednotku nejvýš jednou.

- [ ] **Krok 5: Spusť testy**

`npx vitest run test/registr-jednotky.test.ts`, pak `npm test`
a `npm run typecheck`.

- [ ] **Krok 6: Commit**

```bash
git add src/registr.ts test/registr-jednotky.test.ts
git commit -m "feat: překlad obce a PSČ na územní jednotku registru"
```

---

## Úkol 5: Firma smí být bez jídelny

**Soubory:** Upravit `src/repo.ts`; upravit testy, které používaly obcházku

**Rozhraní:**
- Mění: `GeoVstup.jidelnaId`, `.vzdalenostM`, `.vZone` na `| null`.

- [ ] **Krok 1: Najdi obcházku**

Spusť: `grep -rn "null as unknown as string" test/ src/`
Uvidíš místa, kde se do `nastavGeo` propašovala neexistující jídelna.
Ta obcházka je důkaz, že typ neodpovídá skutečnosti.

- [ ] **Krok 2: Uprav `GeoVstup`**

```ts
export interface GeoVstup {
  lat: number;
  lng: number;
  /** Prázdné u firem z průzkumné oblasti — o přiřazení rozhoduje vzdálenost,
   *  ne oblast, a řeší se samostatně. */
  jidelnaId: string | null;
  vzdalenostM: number | null;
  vZone: boolean | null;
}
```

Tělo funkce se nemění — hodnoty se předávají dál a sloupce v databázi
prázdné hodnoty snesou.

- [ ] **Krok 3: Ukliď obcházky v testech**

Ve všech místech z kroku 1 nahraď `null as unknown as string` prostým `null`.
Nic jiného v testech neměň.

- [ ] **Krok 4: Ověř**

`npm run typecheck` a `npm test` — čekej stejný počet zelených jako před
úkolem, žádný nový.

- [ ] **Krok 5: Commit**

```bash
git add src/repo.ts test/
git commit -m "fix: firma smí být bez jídelny, bez obcházky v typech"
```

---

## Úkol 6: Migrace — úseky průzkumu

**Soubory:** Vytvořit `supabase/migrations/0022_pruzkum_useky.sql`,
`test/cmuchal-oblast.test.ts`

- [ ] **Krok 1: Napiš padající test**

`test/cmuchal-oblast.test.ts` — zatím jen schéma:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozOblast } from "../src/oblast.js";
import { objednejPruzkum } from "../src/pruzkum.js";

let db: Db;
let pruzkumId: string;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  const oblastId = await zalozOblast(db, {
    nazev: "Území",
    oblast: { typ: "kruh", stred: { lat: 49.6, lng: 13.2 }, polomerM: 3000 },
  });
  pruzkumId = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
});

describe("schéma úseků průzkumu", () => {
  it("tatáž jednotka se do jedné objednávky nedostane dvakrát", async () => {
    await db.query(
      "insert into pruzkum_useky (pruzkum_id, jednotka, obec, poradi) values ($1,554791,'Zbůch',1)",
      [pruzkumId],
    );
    await expect(
      db.query(
        "insert into pruzkum_useky (pruzkum_id, jednotka, obec, poradi) values ($1,554791,'Zbůch',2)",
        [pruzkumId],
      ),
    ).rejects.toThrow();
  });

  it("neúspěšný úsek bez popisu chyby neprojde", async () => {
    await expect(
      db.query(
        `insert into pruzkum_useky (pruzkum_id, jednotka, obec, poradi, stav)
         values ($1,554791,'Zbůch',1,'selhalo')`,
        [pruzkumId],
      ),
    ).rejects.toThrow();
  });

  it("objednávka smí čekat na rozhodnutí člověka", async () => {
    // Nový stav: tvar nezabírá žádnou obec a čeká se na odpověď.
    await db.query("update pruzkumy set stav = 'ceka_na_rozhodnuti' where id = $1", [pruzkumId]);
    const r = await db.query<{ stav: string }>("select stav from pruzkumy where id = $1", [pruzkumId]);
    expect(r[0]?.stav).toBe("ceka_na_rozhodnuti");
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/cmuchal-oblast.test.ts`
Čekej: FAIL — `relation "pruzkum_useky" does not exist`.

- [ ] **Krok 3: Napiš migraci**

`supabase/migrations/0022_pruzkum_useky.sql`:

```sql
-- Průzkum území po úsecích.
--
-- Jeden úsek = jedna územní jednotka. Velká města jsou v registru sama
-- o sobě rozdělená na obvody (Plzeň 10, Praha 57), takže i největší sousto
-- se rozpadne bez další práce. Bez dělení by výpadek uprostřed velkého
-- území znamenal začínat znovu.

create table pruzkum_useky (
  id uuid primary key default gen_random_uuid(),
  pruzkum_id uuid not null references pruzkumy(id) on delete cascade,
  jednotka int not null,
  -- Jen pro čitelný výpis; rozhoduje `jednotka`.
  obec text not null,
  poradi int not null,
  stav text not null default 'ceka'
    check (stav in ('ceka', 'bezi', 'hotovo', 'selhalo')),
  firem_novych int,
  firem_mimo_tvar int,
  chyba text,
  dokonceno_at timestamptz,
  constraint usek_selhani_ma_chybu check (stav <> 'selhalo' or chyba is not null),
  constraint usek_jednou unique (pruzkum_id, jednotka)
);

create index pruzkum_useky_fronta_idx on pruzkum_useky (pruzkum_id, poradi);

-- Nový stav objednávky: tvar nezabírá žádnou obec a čeká se na člověka.
-- Prázdno v obcích neznamená prázdno ve firmách — OpenStreetMap hledá
-- podle souřadnic, takže odloučenou fabriku najde i tam, kde obec není.
alter table pruzkumy drop constraint pruzkumy_stav_check;
alter table pruzkumy add constraint pruzkumy_stav_check
  check (stav in ('ceka', 'bezi', 'hotovo', 'selhalo', 'ceka_na_rozhodnuti'));

alter table pruzkum_useky enable row level security;

create policy pruzkum_useky_cteni on pruzkum_useky
  for select to authenticated using (true);

create policy pruzkum_useky_zapis on pruzkum_useky
  for all to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'))
  with check (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'));

comment on table pruzkum_useky is
  'Úseky průzkumu po územních jednotkách — aby šel běh přerušit a navázat';
```

> **Ověř skutečný název podmínky** na sloupci `pruzkumy.stav` (v migraci
> 0018 vznikla bez explicitního jména, takže ji Postgres pojmenoval sám).
> Zjistíš ho dotazem na `pg_constraint` nad `public.pruzkumy`. Kdyby se
> jméno lišilo od `pruzkumy_stav_check`, použij to skutečné.

- [ ] **Krok 4: Spusť testy**

`npx vitest run test/cmuchal-oblast.test.ts` (PASS, 3 testy), pak `npm test`.

- [ ] **Krok 5: Commit**

```bash
git add supabase/migrations/0022_pruzkum_useky.sql test/cmuchal-oblast.test.ts
git commit -m "feat: schéma úseků průzkumu a stav čekání na rozhodnutí"
```

---

## Úkol 7: Rozhlédnutí

**Soubory:** Vytvořit `src/cmuchal-oblast.ts`; upravit `test/cmuchal-oblast.test.ts`

**Rozhraní:**
- Spotřebovává: `obceVOblasti` (úkol 3), `jednotkyPodleMist` (úkol 4),
  `nactiOblast` z `./oblast.js`, `CmuchalDeps` z `./cmuchal.js`.
- Poskytuje: `rozhlednuti(deps, pruzkumId, opts?) → Promise<Rozhled>`.

- [ ] **Krok 1: Napiš padající test**

Přidej do `test/cmuchal-oblast.test.ts` testy, které ověří:

```
1. Rozhlédnutí založí jeden úsek na každou nalezenou jednotku,
   očíslované od 1 a všechny ve stavu 'ceka'.
2. Vrátí počet obcí a počet kandidátů.
3. Opakované rozhlédnutí úseky nezdvojí (podmínka v databázi to nepustí,
   takže se musí přeskočit, ne spadnout).
4. Když tvar nezabírá žádnou obec a body se dohledaly:
   objednávka přejde do 'ceka_na_rozhodnuti' a nezaloží se žádný úsek.
5. Když se nedohledal ANI JEDEN bod: objednávka skončí 'selhalo' s důvodem.
   (Rozdíl proti bodu 4 je celý smysl — prázdná krajina versus mrtvá služba.)
```

**Společná příprava pro testy úkolů 7 a 8.** Napiš ji jednou nahoru do
`test/cmuchal-oblast.test.ts` a používej v obou:

```ts
import type { AresKlient, AresZaznam } from "../src/ares.js";
import type { Geokoder, Misto } from "../src/geocode.js";
import type { RegistrKlient, RegistrZaznam } from "../src/registr.js";
import type { CmuchalDeps } from "../src/cmuchal.js";

const STRED = { lat: 49.6, lng: 13.2 };
/** 0,001° zeměpisné šířky ≈ 111 m. */
const severne = (m: number) => ({ lat: STRED.lat + m / 111_320, lng: STRED.lng });

/** Uvnitř kruhu 3 km. */
const uvnitr: AresZaznam = {
  ico: "25232657", nazev: "Blízká s.r.o.", adresa: "Náves 1", obec: "Zbůch",
  czNace: ["25610"], velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
};
/** Sídlí ve stejné jednotce, ale leží 9 km daleko — tvar ji musí odmítnout. */
const mimo: AresZaznam = {
  ico: "17439523", nazev: "Daleká s.r.o.", adresa: "Kraj 9", obec: "Zbůch",
  czNace: ["25610"], velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
};

const souradnice: Record<string, { lat: number; lng: number }> = {
  "25232657": severne(500),
  "17439523": severne(9000),
};

/** Počítá volání, aby šlo ověřit, že se nezaměřuje ani nehledá dvakrát. */
function falesneDeps(db: Db, opts: { mista?: Misto[] } = {}) {
  const pocty = { zamereni: 0, sweepu: 0 };
  const mista = opts.mista ?? [{ obec: "Zbůch", psc: "330 22" }];

  const geokoder: Geokoder = {
    geokoduj: async (adresa) => {
      pocty.zamereni++;
      const zaznam = [uvnitr, mimo].find((z) => adresa.includes(z.adresa));
      return zaznam ? souradnice[zaznam.ico]! : null;
    },
    zpetne: async () => mista[0] ?? null,
  };

  const registr: RegistrKlient = {
    zamestnavateleVJednotkach: async () => {
      pocty.sweepu++;
      return [uvnitr, mimo].map(
        (z): RegistrZaznam => ({
          ico: z.ico, nazev: z.nazev, pravniForma: "112", kategorieKod: "330",
          nace: z.czNace, adresa: z.adresa, obec: z.obec, psc: "330 22",
          jednotka: 559661, zdrojUrl: "https://csu.gov.cz/registr",
        }),
      );
    },
    jednotkyObce: async () => [559661],
    jednotkyPodleMist: async () => [{ jednotka: 559661, obec: "Zbůch" }],
  };

  const ares: AresKlient = {
    overFirmu: async (ico) => [uvnitr, mimo].find((z) => z.ico === ico) ?? null,
    najdiFirmyVObci: async () => [uvnitr, mimo],
    najdiPodleJmena: async () => null,
    najdiStatutarniOrgany: async () => [],
  };

  return { deps: { db, ares, geokoder, registr } as unknown as CmuchalDeps, pocty };
}
```

> Rozhraní `ResKlient` je v `CmuchalDeps` povinné — dopočítej si ho podle
> `test/cmuchal.test.ts` a přidej do `falesneDeps`. Ostatní volitelné
> závislosti (`mpsv`, `osm`, `enricher`) vynech; testy je nepotřebují.

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/cmuchal-oblast.test.ts`
Čekej: FAIL — `Cannot find module '../src/cmuchal-oblast.js'`.

- [ ] **Krok 3: Napiš `src/cmuchal-oblast.ts`**

```ts
/**
 * Průzkum nakresleného území.
 *
 * Vlastní soubor, aby `cmuchal.ts` (už dnes velký) dál nerostl. Sdílí s ním
 * filtry, ověření v ARES i zápis kandidáta.
 *
 * **Oblast nepřiřazuje firmu k jídelně** — firmy se ukládají s prázdnou
 * jídelnou a o přiřazení rozhoduje vzdálenost, což je samostatná funkce.
 */
import type { CmuchalDeps } from "./cmuchal.js";
import { nactiOblast } from "./oblast.js";
import { selhalPruzkum, zahajPruzkum } from "./pruzkum.js";
import { obceVOblasti, KROK_MRIZKY_M } from "./uzemi.js";

export interface Rozhled {
  obci: number;
  useku: number;
  /** Kolik firem v těch jednotkách registr zná. */
  kandidatu: number;
  /** Kolik bodů mřížky se nepodařilo dohledat. */
  nedohledano: number;
  /** Objednávka čeká na rozhodnutí člověka (tvar nezabírá žádnou obec). */
  cekaNaRozhodnuti: boolean;
}

export async function rozhlednuti(
  deps: CmuchalDeps,
  pruzkumId: string,
  opts: { krokM?: number } = {},
): Promise<Rozhled> {
  const p = await nactiPruzkum(deps.db, pruzkumId);
  const o = await nactiOblast(deps.db, p.oblastId);
  if (!o) throw new Error("Oblast průzkumu neexistuje.");
  if (!deps.registr) throw new Error("Průzkum oblasti se bez registru ČSÚ neobejde.");

  // Objednávku je potřeba rozběhnout hned: `selhalPruzkum` i `dokoncPruzkum`
  // přijmou jen tu, která běží, a bez toho by se neúspěch neměl kam zapsat.
  await zahajPruzkum(deps.db, pruzkumId);

  const nalez = await obceVOblasti(deps.geokoder, o.oblast, {
    krokM: opts.krokM ?? KROK_MRIZKY_M,
  });

  // Žádný bod se nedohledal — to není prázdná krajina, to je nedostupná
  // služba. Prohlásit průzkum za hotový by zamlčelo chybu.
  if (nalez.bodu > 0 && nalez.nedohledano === nalez.bodu) {
    await selhalPruzkum(
      deps.db,
      pruzkumId,
      "Zpětné dohledání obcí neodpovědělo ani u jednoho bodu — služba je nejspíš nedostupná.",
    );
    throw new Error("Zpětné dohledání obcí selhalo u všech bodů.");
  }

  if (nalez.mista.length === 0) {
    await deps.db.query("update pruzkumy set stav = 'ceka_na_rozhodnuti' where id = $1", [
      pruzkumId,
    ]);
    return {
      obci: 0, useku: 0, kandidatu: 0,
      nedohledano: nalez.nedohledano, cekaNaRozhodnuti: true,
    };
  }

  const jednotky = await deps.registr.jednotkyPodleMist(nalez.mista);
  let poradi = 0;
  for (const j of jednotky) {
    poradi++;
    await deps.db.query(
      `insert into pruzkum_useky (pruzkum_id, jednotka, obec, poradi)
       values ($1,$2,$3,$4) on conflict (pruzkum_id, jednotka) do nothing`,
      [pruzkumId, j.jednotka, j.obec, poradi],
    );
  }

  // Odhad je zadarmo: `zamestnavateleVJednotkach` čte místní soubor
  // a nic nezaměřuje. Kolik z kandidátů se bude zaměřovat, se pozná až
  // podle toho, které z nich už kartotéka zná — to spočítá CLI.
  const kandidati = await deps.registr.zamestnavateleVJednotkach(
    jednotky.map((j) => j.jednotka),
  );

  return {
    obci: nalez.mista.length,
    useku: jednotky.length,
    kandidatu: kandidati.length,
    nedohledano: nalez.nedohledano,
    cekaNaRozhodnuti: false,
  };
}

async function nactiPruzkum(db: CmuchalDeps["db"], id: string) {
  const r = await db.query<{ oblastId: string }>(
    `select oblast_id as "oblastId" from pruzkumy where id = $1`,
    [id],
  );
  const p = r[0];
  if (!p) throw new Error("Objednávka průzkumu neexistuje.");
  return p;
}
```

- [ ] **Krok 4: Spusť testy a commitni**

`npx vitest run test/cmuchal-oblast.test.ts`, pak `npm test`.

```bash
git add src/cmuchal-oblast.ts test/cmuchal-oblast.test.ts
git commit -m "feat: rozhlédnutí po území a založení úseků"
```

---

## Úkol 8: Vyřízení úseků a navázání

**Soubory:** Upravit `src/cmuchal-oblast.ts` a `test/cmuchal-oblast.test.ts`

**Rozhraní:**
- Spotřebovává: `rozhlednuti` (úkol 7), `zahajPruzkum`, `dokoncPruzkum`,
  `selhalPruzkum` z `./pruzkum.js`, `prepocitejOblastFirmy` z `./oblast.js`,
  `bodVOblasti` z `./oblast-tvar.js`.
- Poskytuje: `vyridPruzkum(deps, pruzkumId, opts?) → Promise<VysledekPruzkumu>`.

- [ ] **Krok 1: Napiš padající test**

Přidej testy, které ověří — tohle je jádro celého plánu:

```
1. Před prvním úsekem se zapíšou už známé firmy z tvaru
   (firemPrevzato > 0, aniž by se cokoli hledalo nebo zaměřovalo).
2. Objednávka přejde do 'bezi' dřív, než se cokoli dokončuje.
3. Firma nalezená UVNITŘ tvaru se uloží s prázdnou jídelnou
   a objeví se v oblast_firmy.
4. Firma nalezená MIMO tvar se neuloží a přibude záznam do deníku vyřazení.
5. HOTOVÝ ÚSEK SE PŘI DALŠÍM BĚHU PŘESKOČÍ — pusť běh dvakrát a ověř,
   že se hledání ve stejné jednotce podruhé nespustilo.
6. FIRMA, KTERÁ UŽ MÁ SOUŘADNICE, SE NEZAMĚŘUJE PODRUHÉ —
   počítej volání geokodéru.
7. `--nejvyse 1` zpracuje jeden úsek a zbytek nechá ve stavu 'ceka';
   objednávka zůstane 'bezi', ne 'hotovo'.
8. Objednávka se uzavře na 'hotovo' teprve po posledním úseku
   a zapíše se do ní firemPrevzato a firemNovych.
9. Když úsek skončí chybou, poznamená se u úseku a běh pokračuje dalším;
   objednávka skončí 'selhalo' teprve tehdy, když nezbyl žádný hotový úsek.
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

`npx vitest run test/cmuchal-oblast.test.ts` — čekej FAIL, `vyridPruzkum is not a function`.

- [ ] **Krok 3: Napiš `vyridPruzkum`**

Do `src/cmuchal-oblast.ts` doplň:

```ts
export interface VysledekPruzkumu {
  uzavreno: boolean;
  usekuHotovo: number;
  usekuCelkem: number;
  firemNovych: number;
  firemPrevzato: number;
}
```

Postup, který funkce dodrží:

1. Nejsou-li úseky, zavolá `rozhlednuti`. Vrátí-li `cekaNaRozhodnuti`,
   skončí bez sběru a nechá objednávku čekat na člověka.
2. `zahajPruzkum` (objednávka do `bezi`) — bez toho ji `dokoncPruzkum`
   odmítne.
3. `prepocitejOblastFirmy` doplní do oblasti už známé firmy uvnitř tvaru.
   Jejich počet je `firemPrevzato`. **Nic se přitom nehledá ani nezaměřuje.**
4. Bere úseky ve stavu `ceka` podle `poradi`, nejvýš `opts.nejvyseUseku`.
   Pro každý:
   - označí úsek `bezi`,
   - vyhledá zaměstnavatele v jednotce stejnými zdroji jako `spustCmuchala`,
   - kandidáty prožene stávajícími filtry a ověřením v ARES,
   - **zaměří jen ty, které souřadnice ještě nemají**,
   - firmy mimo tvar zahodí se záznamem do deníku vyřazení,
   - firmy uvnitř uloží s `jidelnaId: null`, `vzdalenostM: null`,
     `vZone: null` a zapíše do `oblast_firmy`,
   - označí úsek `hotovo` s počty; při chybě `selhalo` s popisem a
     **pokračuje dalším úsekem**.
5. Zbývá-li nějaký úsek ve stavu `ceka`, vrátí `uzavreno: false` a objednávku
   nechá v `bezi`.
6. Jsou-li všechny úseky hotové, zavolá `dokoncPruzkum` s počty.
   Nezbyl-li žádný hotový a všechny selhaly, zavolá `selhalPruzkum`.
7. Celý běh zapíše do `agent_runs` (TP-13) a id zapíše do `pruzkumy.run_id`.

Vyhledání a zpracování kandidáta **nepiš znovu** — vytáhni z `src/cmuchal.ts`
to, co se dá sdílet, a zavolej to. Kdyby to znamenalo přepsat víc než
padesát řádků v `cmuchal.ts`, zastav se a ohlas to.

- [ ] **Krok 4: Spusť testy a commitni**

`npx vitest run test/cmuchal-oblast.test.ts`, `npm test`, `npm run typecheck`.

```bash
git add src/cmuchal-oblast.ts src/cmuchal.ts test/cmuchal-oblast.test.ts
git commit -m "feat: vyřízení průzkumu po úsecích s navázáním"
```

---

## Úkol 9: Příkazy a nasazení

**Soubory:** Upravit `src/cli.ts`

- [ ] **Krok 1: Doplň podpříkazy**

```
pruzkum rozhlednuti <id>            odhad a založení úseků
pruzkum vyrid <id> [--nejvyse N]    zpracuje úseky, naváže tam, kde se skončilo
pruzkum useky <id>                  výpis úseků a jejich stavu
```

`pruzkum fronta` u každé objednávky doplní postup („7 z 23 obcí").

Když je objednávka ve stavu `ceka_na_rozhodnuti`, `pruzkum vyrid` **nic
nespustí** a vypíše srozumitelnou hlášku: tvar nezabírá žádnou obec,
pokračovat jde jen výslovným `--i-bez-obci`.

Kde je údaj neznámý, vypisuj slovem — **nikdy 0**.

- [ ] **Krok 2: Doplň do nápovědy**

Vedle stávajících `pruzkum` podpříkazů v textu nápovědy v `src/cli.ts`.

- [ ] **Krok 3: Ověř ručně nad dočasnou databází**

> **Past, která už jednou zabrala:** `.env` má vyplněnou `DATABASE_URL`
> a `pripojDb()` ji upřednostní **před** `CANTINERO_DATA_DIR`. Bez
> vyprázdnění `DATABASE_URL` jde příkaz do **sdílené** databáze.

```bash
DATABASE_URL= CANTINERO_DATA_DIR=data/pgdata-zkouska npm run cli -- migrate
DATABASE_URL= CANTINERO_DATA_DIR=data/pgdata-zkouska npm run cli -- pruzkum fronta
```

Pak adresář `data/pgdata-zkouska` smaž.

- [ ] **Krok 4: Typy a celá sada**

`npm run typecheck`, `npm test`.

- [ ] **Krok 5: Commit**

```bash
git add src/cli.ts
git commit -m "feat: příkazy pro rozhlédnutí a vyřízení průzkumu"
```

---

## Úkol 10: Nasazení a kontrola

**Soubory:** `memory/stav.md`

- [ ] **Krok 1: Nasazení migrace**

Nasazení do sdílené databáze provádí **řídicí session, ne implementátor**.
Implementátor migraci jen napíše a ověří lokálně.

- [ ] **Krok 2: Kontrola pravidel**

Postup je v `memory/poznatky.md` („Jak vyzkoušet pravidla RLS bez
přihlašování"). Ověř: nepřihlášený nevidí v `pruzkum_useky` nic; role
`uzivatel` zapíše. Každou zkoušku obal do `begin … rollback`.

- [ ] **Krok 3: Bezpečnostní kontrola**

`get_advisors` typu `security`. Čekej žádné nové nálezy. **Pozor na
`function_search_path_mutable`** — kdyby v migraci vznikla nová funkce
bez pevné `search_path`, oprav ji další migrací.

- [ ] **Krok 4: Zápis do paměti a commit**

Do `memory/stav.md` doplň, že Čmuchal umí prozkoumat nakreslenou oblast
a co zbývá (průvodce kampaní v aplikaci). Psáno pro majitele, který není
programátor.

```bash
git add memory/stav.md
git commit -m "docs: Čmuchal umí prozkoumat nakreslenou oblast"
```

---

## Co tento plán nedělá

- **přiřazování firem k jídelnám** — samostatná funkce s vlastním zadáním
- obrazovku průvodce kampaní v aplikaci
- odesílání, šablony, tvrzení
- naplánované spouštění agenta
- návrh tvaru oblasti Čmuchalem (odloženo do fáze 4)
- souběžné vyřizování víc objednávek naráz
