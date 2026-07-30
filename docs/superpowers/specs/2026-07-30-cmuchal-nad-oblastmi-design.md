# Čmuchal nad oblastmi — zadání

**Stav:** k odsouhlasení · **Datum:** 2026-07-30

> Předpoklad kroku 3 průvodce kampaní. Viz `docs/superpowers/specs/2026-07-29-kampane-design.md`
> kap. 12, kde se ta mezera popsala. Při rozporu platí `SPEC.md`.

## 1. K čemu to je

Kampaň nad **novým územím** dnes nemá kdo vyřídit. Sběr (`src/cmuchal.ts`,
příkaz `run --jidelna`) vychází z **jídelny a jejího kruhu**; o oblastech neví
a nakreslený tvar prozkoumat neumí. Fronta objednávek (`pruzkumy`) se proto
zatím zavírá ručně.

Tahle práce ji naučí vyřídit se sama.

## 2. Jádro problému a jak se řeší

**Registr ČSÚ hledá podle územní jednotky, ne podle souřadnic** — žádné
souřadnice nemá (`RegistrKlient.zamestnavateleVJednotkach`). Nakreslený tvar
má naopak jen souřadnice. Chybí překlad **tvar → obce**, a to je celá tahle
práce; zbytek už umíme.

Řešení: **mřížka bodů uvnitř tvaru a zpětné dohledání obcí.** U kruhu 12 km
vyjde při kroku 3 km asi dvacet bodů, tedy dvacet dotazů na Nominatim —
dvacet sekund. Pro srovnání: zaměření 719 firem v Plzni trvá přes dvanáct minut.

Obce se pak překládají na jednotky podle **názvu a PSČ**; samotný název
nestačí, Hrádek je v ČR šestkrát. Kdyby se to i tak spletlo, nic zlého se
nestane — na konci se každá firma testuje proti tvaru, takže z omylu vzejde
zbytečná práce, ne špatná data.

## 3. Rozhodnutí majitele (2026-07-30)

1. **Obce si systém najde sám z tvaru.** Člověk kreslí, nic nevypisuje.
2. **Firmy z oblasti bez jídelny se ukládají bez nejbližší jídelny.**
   Prázdná hodnota je legitimní stav; jídelna se doplní po jednání.
3. **Velké území se vnitřně dělí na úseky.** Průzkum musí jít přerušit
   a navázat, aniž by se cokoli ztratilo nebo dělalo dvakrát.
4. **Tvrdá hranice 500 firem se ruší.** Měla smysl, dokud byl běh
   nepřerušitelný. Nahrazuje ji odhad před startem a volitelný strop na
   jeden běh.

## 4. Jak to poběží

### 4.1 Rozhlédnutí

1. Z tvaru se udělá mřížka bodů (výchozí krok **3 km**), ponechají se ty
   uvnitř (`bodVOblasti`).
2. Každý bod se zpětně dohledá → název obce a PSČ.
3. Obce se přeloží na územní jednotky registru.
4. Registr se **prohledá bez zaměřování** a spočítají se kandidáti.
5. Vypíše se odhad: kolik obcí, kolik kandidátů, kolik z nich ještě nemá
   zaměřenou adresu a kolik to zhruba zabere času.

Rozhlédnutí je levné — jediné síťové dotazy jsou ta mřížka.

Odhad času vychází z toho, kolik firem ještě nemá zaměřenou adresu,
násobeno prodlevou geokodéru (dnes 1,1 s na dotaz). Nic jiného v běhu
znatelně netrvá.

**Když tvar nezabírá žádnou obec** (les, voda, tvar mimo ČR), rozhlédnutí
to řekne, žádné úseky nezaloží a objednávka se rovnou uzavře jako `hotovo`
s nulou nalezených firem. Bez toho by kampaň čekala navždy na průzkum,
který nemá co dělat.

**Když se zpětné dohledání u některého bodu nepovede**, bod se přeskočí
a poznamená. Když se nepovede u **všech**, objednávka skončí `selhalo`
s důvodem — to není prázdné území, to je nedostupná služba.

### 4.2 Úseky

**Jeden úsek = jedna územní jednotka.** Velká města jsou v registru sama
o sobě rozdělená na obvody (Plzeň 10, Praha 57), takže i největší sousto se
rozpadne bez další práce.

Úseky se založí při rozhlédnutí. **Když se pustí vyřízení a úseky ještě
nejsou, rozhlédnutí se provede samo** — samostatný příkaz je jen pro toho,
kdo chce napřed vidět odhad.

Ještě před prvním úsekem se **převezmou už známé firmy**: `prepocitejOblastFirmy`
zapíše do oblasti ty, které v tvaru leží a v kartotéce už jsou. Ty se
nehledají ani nezaměřují znovu — jejich počet je `firemPrevzato`.

Vyřízení začíná voláním `zahajPruzkum` (objednávka přejde do `bezi`);
`dokoncPruzkum` totiž jinou než běžící objednávku odmítne.

Běh pak bere úseky popořadě. V každém:

1. vyhledají se zaměstnavatelé v jednotce (registr, MPSV, OpenStreetMap —
   stejné zdroje jako dnes),
2. kandidáti projdou stávajícími filtry a ověřením v ARES (TP-1),
3. adresy se zaměří — **firmy, které už souřadnice mají, se přeskakují**,
4. firma se otestuje proti tvaru (`bodVOblasti`); mimo tvar se zahodí
   se záznamem do deníku vyřazení,
5. firmy uvnitř se uloží a zapíší do `oblast_firmy`,
6. úsek se označí za hotový.

### 4.3 Přerušení a navázání

- **Hotové úseky zůstanou hotové** a další běh je přeskočí.
- **Rozdělaný úsek se udělá znovu**, ale levněji: zaměřování se u známých
  firem přeskočí.
- Objednávka průzkumu zůstane ve stavu `bezi` a další běh naváže.
- Objednávka se uzavře na `hotovo` teprve tehdy, když jsou hotové všechny
  úseky. Úsek, který opakovaně selhal, jde označit za neúspěšný s důvodem;
  objednávka pak skončí `selhalo`.

**Strop na jeden běh** (`--nejvyse <počet úseků>`) umožní projíždět velké
území po kouscích. Hodí se i pro naplánované běhy.

## 5. Datový model

Migrace `0022_pruzkum_useky.sql`.

### `pruzkum_useky`

| sloupec | typ | poznámka |
|---|---|---|
| `id` | uuid pk | |
| `pruzkum_id` | uuid → `pruzkumy` on delete cascade | |
| `jednotka` | int not null | RÚIAN kód územní jednotky |
| `obec` | text not null | jen pro čitelný výpis |
| `poradi` | int not null | v jakém pořadí se zpracovávají |
| `stav` | text not null | `ceka` \| `bezi` \| `hotovo` \| `selhalo` |
| `firem_novych` | int | kolik firem v úseku přibylo |
| `firem_mimo_tvar` | int | kolik jich tvar odmítl |
| `chyba` | text | povinné při `selhalo` |
| `dokonceno_at` | timestamptz | |

Dvojice `(pruzkum_id, jednotka)` je jedinečná — tatáž jednotka se do jedné
objednávky nesmí dostat dvakrát.

Pravidla přístupu ve stylu migrace 0016: čtení kdokoli přihlášený, zápis
role `super-admin`, `admin`, `uzivatel`. Po nasazení se pustí kontrola
`get_advisors` typu `security`.

**Funkce v databázi musí mít pevnou `search_path`** a tabulky uvnitř psané
i se schématem — poznatek z migrace 0019.

## 6. Změny v existujícím kódu

### 6.1 `src/geocode.ts` — zpětné dohledání

Rozhraní `Geokoder` dostane druhou metodu:

```ts
export interface Misto {
  obec: string;
  psc: string | null;
}

export interface Geokoder {
  geokoduj(adresa: string): Promise<Bod | null>;
  /** Zpětné dohledání místa ze souřadnic; nenalezeno → null (nikdy odhad). */
  zpetne(bod: Bod): Promise<Misto | null>;
}
```

Stejná fronta a stejná prodleva jako u `geokoduj` — jeden dotaz za sekundu
platí na celý Nominatim, ne na metodu.

### 6.2 `src/registr.ts` — překlad místa na jednotku

`RegistrKlient` dostane metodu:

```ts
/**
 * Územní jednotky odpovídající zadaným místům. Hledá podle názvu obce
 * a PSČ — samotný název nestačí, „Hrádek" je v ČR šestkrát.
 */
jednotkyPodleMist(mista: readonly Misto[]): Promise<Array<{ jednotka: number; obec: string }>>;
```

**Jedním průchodem registru pro všechna místa naráz.** Registr má 541 MB;
průchod na každé místo zvlášť by u dvaceti bodů znamenal dvacet průchodů.

### 6.3 `src/repo.ts` — firma nemusí mít jídelnu

`GeoVstup` dnes vyžaduje `jidelnaId: string`, ačkoli firma k žádné jídelně
patřit nemusí. Testy to obcházejí zápisem `null as unknown as string`, což
je známka toho, že typ neodpovídá skutečnosti. Opraví se:

```ts
export interface GeoVstup {
  lat: number;
  lng: number;
  jidelnaId: string | null;
  vzdalenostM: number | null;
  vZone: boolean | null;
}
```

Existující volání se nemění (předávají hodnoty dál), jen se z testů odstraní
ten trik.

## 7. Nový modul a běh

### `src/uzemi.ts` — z tvaru na obce

Čistý počet a jeden síťový krok, bez databáze:

```ts
/** Body mřížky uvnitř tvaru. Čistá funkce — testuje se bez sítě. */
export function mrizkaVOblasti(oblast: Oblast, krokM: number): Bod[];

/** Obce, které tvar zabírá. Zpětně dohledá každý bod mřížky. */
export async function obceVOblasti(
  geokoder: Geokoder,
  oblast: Oblast,
  opts?: { krokM?: number },
): Promise<Misto[]>;
```

### `src/cmuchal-oblast.ts` — vyřízení objednávky

Vlastní soubor, aby `src/cmuchal.ts` (už dnes velký) dál nerostl. Sdílí
s ním filtry, ověření v ARES i zápis kandidáta.

```ts
export interface VysledekPruzkumu {
  uzavreno: boolean;          // došly všechny úseky?
  usekuHotovo: number;
  usekuCelkem: number;
  firemNovych: number;
  firemPrevzato: number;      // z překryvu s už prozkoumanými oblastmi
}

/** Rozhlédnutí: založí úseky a vrátí odhad. Nezaměřuje, nezapisuje firmy. */
export async function rozhlednuti(
  deps: CmuchalDeps,
  pruzkumId: string,
  opts?: { krokM?: number },
): Promise<{ obci: number; kandidatu: number; kZamereni: number; odhadMinut: number }>;

/** Zpracuje úseky popořadě. Vrací, kam se došlo. */
export async function vyridPruzkum(
  deps: CmuchalDeps,
  pruzkumId: string,
  opts?: { nejvyseUseku?: number },
): Promise<VysledekPruzkumu>;
```

Každý běh se zapisuje do `agent_runs` (TP-13) a `pruzkumy.run_id` ukazuje
na poslední z nich.

## 8. Příkazy

```
pruzkum rozhlednuti <id>            odhad; založí úseky
pruzkum vyrid <id> [--nejvyse N]    zpracuje úseky, naváže tam, kde se skončilo
pruzkum useky <id>                  výpis úseků a jejich stavu
```

`pruzkum fronta` u každé objednávky ukáže postup („7 z 23 obcí").

Kde je údaj neznámý, vypisuje se slovem — **nikdy nula**.

## 9. Co se nestaví

- odesílání čehokoli (TP-8 platí beze změny)
- obrazovka průvodce v aplikaci — samostatná práce po tomhle
- naplánované spouštění agenta
- návrh tvaru oblasti Čmuchalem (odloženo do fáze 4)
- souběžné vyřizování víc objednávek naráz

## 10. Testy

Nad PGlite, offline, bez proměnných prostředí a bez sítě. Falešný `Geokoder`
i `RegistrKlient` se předávají přes `CmuchalDeps`, jak je v projektu zvykem.

- `mrizkaVOblasti` u kruhu i u nakresleného tvaru vrací jen body uvnitř
- konkávní tvar (písmeno L) nedostane body v „zálivu"
- `obceVOblasti` vrátí každou obec jednou, i když ji trefí víc bodů
- překlad místa na jednotku: shoda podle názvu i PSČ; stejný název v jiném
  PSČ se nesmí připlést
- firma mimo tvar se neuloží a zapíše se do deníku vyřazení
- firma uvnitř se uloží **bez jídelny** a objeví se v `oblast_firmy`
- **hotový úsek se při dalším běhu přeskočí** — jádro navázání
- **firma, která už má souřadnice, se nezaměřuje podruhé**
- objednávka se uzavře na `hotovo` teprve po posledním úseku
- `--nejvyse` opravdu zastaví po zadaném počtu úseků a zbytek nechá čekat

## 11. Pořadí prací

1. **Z tvaru na obce** — `mrizkaVOblasti`, zpětné dohledání, překlad na
   jednotky. Samostatně ověřitelné, žádná databáze.
2. **Úseky a navázání** — migrace, rozhlédnutí, zpracování úseku po úseku.
3. **Napojení na frontu a CLI** — příkazy a uzavření objednávky.

Po první dávce se dá zastavit a přehodnotit; sama o sobě dává smysl
(„které obce tenhle tvar zabírá" je užitečná odpověď i bez sběru).

## 12. Vědomé kompromisy

Obojí je rozhodnuté, ne otevřené — ale je to odhad, ne měření, takže to
patří napsat nahlas.

1. **Krok mřížky 3 km.** Menší obec by při hrubší mřížce mohla propadnout,
   jemnější zbytečně přidává dotazy. Je to přepínač, aby šel změnit bez
   zásahu do programu, a po prvním ostrém běhu se ověří na skutečném území.
2. **Obec, kterou tvar zabírá jen okrajem, se prohledá celá** a tvar pak
   firmy ořízne. Jednoduché a bezpečné. U velkého města na okraji tvaru to
   znamená prohledat celé město kvůli pár ulicím — řeší se, až to bude
   doopravdy vadit, ne dopředu.
