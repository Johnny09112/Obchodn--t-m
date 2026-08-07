# Profil produktu — plán

> **Pro agentní pracovníky:** POVINNÁ PODDOVEDNOST: použij
> `superpowers:subagent-driven-development` (doporučeno) nebo
> `superpowers:executing-plans` a odpracuj plán úkol po úkolu. Kroky jsou
> zaškrtávací (`- [ ]`).

**Zadání:** `docs/superpowers/specs/2026-08-07-profil-produktu-design.md`

**Cíl:** Profil produktu určuje, co se má o firmě zjišťovat, a kampaň si nese
svůj profil — aby šel systém přenastavit pro jinou cílovku bez zásahu do kódu.

**Architektura:** Pevný seznam povolených atributů se přesune z kódu
(`src/whitelist.ts`) a z podmínky `check` do **tabulky** s příznakem
`do_zpravy`. Profil pak vybírá, které z nich se sbírají. `evidence.atribut`
se stane cizím klíčem do té tabulky, takže záruka „vymyšlený atribut
neprojde" zůstává v databázi.

**Technologie:** TypeScript, ESM, PGlite/Postgres, Vitest, React 18, Supabase.
Žádná nová závislost.

## Globální omezení

- **Čeština** v komentářích, testech i commit messages. Identifikátory česky
  bez diakritiky (`nactiAtributyProfilu`).
- **TDD:** nejdřív test, pak implementace. `npm test` musí projít **offline,
  bez sítě a bez env proměnných**.
- **Migrace se jen přidávají** — nové soubory `0035_*.sql`, `0036_*.sql`;
  starší se needitují.
- **Sběr firem se nesmí rozbít.** Stojí na něm 13 858 nasbíraných firem.
  Do profilů se jen **přidává**, stávající pole a chování se nemění.
- **Nic se neodesílá** (TP-8). Žádný kód téhle práce se odesílání nedotýká.
- **Každý atribut má zdroj a doslovnou citaci** (TP-2) — beze změny.
- **`app/src/` nesmí přes `src/` přitáhnout `db.ts` ani `repo.ts`**
  (`test/hranice-aplikace.test.ts`). V `app/` importy bez `.js`, v `src/`
  a `test/` s `.js`.
- **Sociální sítě nikdy**, ani ke čtení.

## Struktura souborů

| Soubor | Odpovědnost |
|---|---|
| `supabase/migrations/0035_atributy.sql` (nový) | Rejstřík atributů, osazení osmi dnešními, cizí klíč z evidence. |
| `supabase/migrations/0036_profil_atributy.sql` (nový) | Vazba profil ↔ atributy, `kampane.profil_kod`. |
| `src/atributy.ts` (nový) | Čtení rejstříku a atributů profilu. Jediné místo, které o rejstříku ví. |
| `src/repo.ts` (změna) | `zapisAtribut` ověřuje proti rejstříku místo pevného seznamu. |
| `src/whitelist.ts` (změna) | Zůstává jako **seznam pro zprávu**; přestává být zdrojem pravdy o sběru. |
| `src/nalezy.ts` (změna) | `chybi` se počítá podle profilu a nese popis. |
| `src/cli.ts` (změna) | Rešerše bere profil z kampaně objednávky. |
| `app/src/data.ts`, `app/src/PruvodceKampani.tsx` (změna) | Výběr profilu u kampaně. |
| `test/atributy.test.ts`, `test/profil-atributy.test.ts` (nové) | Testy rejstříku a profilu. |

---

### Úkol 1: Rejstřík atributů

**Soubory:**
- Vytvořit: `supabase/migrations/0035_atributy.sql`, `test/atributy.test.ts`

**Rozhraní:**
- Spotřebovává: tabulku `evidence` z `0001_init.sql`.
- Poskytuje: tabulku `atributy (kod, nazev, popis, do_zpravy)`. Úkoly 2–5 na ní stojí.

- [ ] **Krok 1: Napiš padající testy**

Vytvoř `test/atributy.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("rejstřík atributů", () => {
  it("obsahuje dnešních osm a všechny smějí do zprávy", async () => {
    const r = await db.query<{ kod: string; do_zpravy: boolean }>(
      "select kod, do_zpravy from atributy order by kod",
    );
    expect(r.map((x) => x.kod)).toEqual([
      "adresa",
      "kontakt",
      "ma_vlastni_jidelnu",
      "obor",
      "ucel_adresy",
      "velikost_kategorie",
      "zamestnanci_odhad",
      "zpusob_stravovani",
    ]);
    expect(r.every((x) => x.do_zpravy)).toBe(true);
  });

  it("každý atribut má popis, co se u něj hledá", async () => {
    const r = await db.query<{ kod: string; popis: string | null }>(
      "select kod, popis from atributy",
    );
    // Popis jde rovnou agentovi — prázdný by znamenal, že si musí domyslet,
    // co hledat, což je přesně dnešní stav a důvod téhle práce.
    expect(r.filter((x) => !x.popis?.trim()).map((x) => x.kod)).toEqual([]);
  });

  // Tvrdé pravidlo TP-3: databáze nesmí pustit atribut, který nikdo nezavedl.
  // Dřív to hlídala pevná podmínka `check`, nově cizí klíč do rejstříku.
  it("vymyšlený atribut databáze nepustí", async () => {
    await expect(
      db.query(
        `insert into evidence (ico, atribut, hodnota, zdroj_url)
         values ('25232657', 'kdovico', 'x', 'https://e.cz')`,
      ),
    ).rejects.toThrow();
  });

  it("atribut z rejstříku projde", async () => {
    await db.query(
      `insert into companies (ico, nazev, stav) values ('25232657','X','kvalifikovany')
       on conflict do nothing`,
    );
    await db.query(
      `insert into evidence (ico, atribut, hodnota, zdroj_url)
       values ('25232657', 'obor', 'pekárna', 'https://e.cz')`,
    );
    const r = await db.query<{ pocet: number }>(
      "select count(*)::int as pocet from evidence where atribut = 'obor'",
    );
    expect(r[0]!.pocet).toBe(1);
  });
});
```

**Pozor:** vkládání firmy přímým INSERTem je tady výjimka pro test schématu —
`zalozFirmu` (TP-1) potřebuje falešný ARES a pro test cizího klíče je to
zbytečné. Jinde v projektu se firmy takhle zakládat **nesmějí**.

- [ ] **Krok 2: Spusť a ověř, že padají**

```bash
npm test -- atributy
```
Očekávej: FAIL, `relation "atributy" does not exist`.

- [ ] **Krok 3: Napiš migraci**

Vytvoř `supabase/migrations/0035_atributy.sql`:

```sql
-- Rejstřík atributů: co se o firmě smí vědět a co z toho smí do zprávy.
--
-- Nahrazuje pevný seznam na dvou místech (src/whitelist.ts a podmínka
-- `check` na evidence.atribut). Důvod je v ADR 0002: whitelist nově váže
-- OBSAH ZPRÁVY, ne sběr — co se sbírá, určuje profil produktu.
--
-- Záruka „vymyšlený atribut neprojde" zůstává v databázi, jen se stěhuje
-- z podmínky do cizího klíče. Je slabší v tom, že rejstřík jde rozšířit —
-- ale jen záměrně a jen člověkem, ne agentem.

create table atributy (
  kod text primary key,
  nazev text not null,
  -- Co se u tohohle atributu hledá. Jde ROVNOU AGENTOVI do zadání, takže
  -- se to píše pro něj: konkrétně a s příklady, ne definičně.
  popis text not null check (length(trim(popis)) > 0),
  -- Smí se objevit v oslovení? Tohle je whitelist z SPEC kap. 5.2.
  do_zpravy boolean not null default false,
  created_at timestamptz not null default now()
);

insert into atributy (kod, nazev, popis, do_zpravy) values
  ('velikost_kategorie', 'velikost firmy',
   'kategorie podle počtu zaměstnanců (mikro do 24, střední 25–249, korporát 250+)', true),
  ('zamestnanci_odhad', 'počet zaměstnanců',
   'přibližný počet zaměstnanců, pokud ho firma sama uvádí', true),
  ('ma_vlastni_jidelnu', 'vlastní jídelna',
   'má firma vlastní závodní jídelnu nebo kantýnu? hledej v sekci o firmě, na kariérní stránce a mezi benefity', true),
  ('zpusob_stravovani', 'způsob stravování',
   'jak firma řeší obědy — stravenky, stravenkový paušál, příspěvek, dovoz, vlastní jídelna, nebo nic', true),
  ('ucel_adresy', 'účel zveřejněné adresy',
   'k čemu firma tu adresu zveřejnila — pro nabídky, pro dodavatele, obecné dotazy', true),
  ('kontakt', 'kontakt', 'jméno, pozice, e-mail nebo telefon na konkrétní osobu', true),
  ('obor', 'obor podnikání', 'čím se firma živí, obecně a vlastními slovy z jejího webu', true),
  ('adresa', 'adresa', 'adresa provozovny nebo sídla', true);

-- Cizí klíč místo dosavadní podmínky. Podmínku je nutné napřed zrušit —
-- jinak by platila obojí a rejstřík by šlo rozšířit jen naoko.
alter table evidence drop constraint if exists evidence_atribut_check;
alter table evidence add constraint evidence_atribut_fk
  foreign key (atribut) references atributy(kod);

comment on table atributy is
  'Co se o firmě smí vědět. `do_zpravy` je whitelist pro oslovení (SPEC kap. 5.2); co se SBÍRÁ, určuje profil produktu.';
```

**Pozor na název podmínky.** `evidence_atribut_check` je odhad podle zvyklosti
Postgresu (`<tabulka>_<sloupec>_check`). **Ověř skutečný název** dřív, než to
pustíš na sdílenou databázi:

```bash
npm run cli -- migrate
```

Kdyby podmínka zůstala, test „vymyšlený atribut databáze nepustí" projde
i tak (spadne na podmínce místo na klíči) — a to by se poznalo až tehdy, až
by někdo přidal nový atribut a on by neprošel. Proto si po nasazení ověř,
že na `evidence` žádná podmínka na `atribut` nezbyla.

- [ ] **Krok 4: Spusť testy a ověř, že prošly**

```bash
npm test -- atributy
```
Očekávej: PASS, 4 testy.

- [ ] **Krok 5: Spusť celou sadu**

```bash
npm test
```
Očekávej: PASS. **Když něco spadne, je to nález, ne nepříjemnost** — hledej,
kdo psal do evidence atribut mimo těch osm.

- [ ] **Krok 6: Commit**

```bash
git add supabase/migrations/0035_atributy.sql test/atributy.test.ts
git commit -m "feat: rejstřík atributů místo pevného seznamu"
```

---

### Úkol 2: TP-3 se rozdělí — sběr proti rejstříku, zpráva podle příznaku

**Soubory:**
- Vytvořit: `src/atributy.ts`
- Změnit: `src/repo.ts`, `src/whitelist.ts`
- Test: `test/atributy.test.ts` (rozšíření)

**Rozhraní:**
- Spotřebovává: tabulku `atributy` z úkolu 1.
- Poskytuje (úkoly 4 a 5 na tom stojí):

```ts
export interface Atribut { kod: string; nazev: string; popis: string; doZpravy: boolean }
export function nactiAtributy(db: Db): Promise<Atribut[]>;
export function jeZnamyAtribut(db: Db, kod: string): Promise<boolean>;
```

**Tohle je nejrizikovější úkol celé práce** — mění se tvrdé pravidlo, které
brání agentovi vymýšlet si údaje. Čti pomalu.

- [ ] **Krok 1: Napiš padající testy**

Přidej do `test/atributy.test.ts`:

```ts
import { nactiAtributy, jeZnamyAtribut } from "../src/atributy.js";
import { zalozFirmu, zapisAtribut } from "../src/repo.js";
import { POVOLENE_ATRIBUTY } from "../src/whitelist.js";

describe("zápis atributu proti rejstříku (TP-3)", () => {
  // Firmu smí založit jen `zalozFirmu` (TP-1). Falešný záznam z ARESu si
  // opiš z `test/kampan-souhrn.test.ts`, kde už takový pomocník je.
  async function firma(ico: string): Promise<void> {
    await zalozFirmu(db, { ico, nazev: `Firma ${ico}`, pravniForma: "112" } as never);
  }

  it("atribut z rejstříku projde", async () => {
    await firma("25232657");
    await zapisAtribut(db, "25232657", "obor", "pekárna", {
      zdrojUrl: "https://e.cz/o-nas",
      citace: "Jsme rodinná pekárna.",
    });
    const r = await db.query<{ pocet: number }>(
      "select count(*)::int as pocet from evidence where ico = '25232657'",
    );
    expect(r[0]!.pocet).toBe(1);
  });

  it("atribut mimo rejstřík neprojde a řekne proč", async () => {
    await firma("25232657");
    await expect(
      zapisAtribut(db, "25232657", "kdovico", "x", {
        zdrojUrl: "https://e.cz",
        citace: "c",
      }),
    ).rejects.toThrow(/TP-3/);
  });

  // Nově zavedený atribut MUSÍ projít — jinak by rejstřík byl jen ozdoba
  // a nastavitelnost by neexistovala.
  it("nově zavedený atribut projde bez zásahu do kódu", async () => {
    await firma("25232657");
    await db.query(
      `insert into atributy (kod, nazev, popis, do_zpravy)
       values ('smenny_provoz', 'směnný provoz', 'jestli firma jede na směny a na kolik', false)`,
    );
    await zapisAtribut(db, "25232657", "smenny_provoz", "třísměnný", {
      zdrojUrl: "https://e.cz/kariera",
      citace: "Pracujeme ve třísměnném provozu.",
    });
    expect(await jeZnamyAtribut(db, "smenny_provoz")).toBe(true);
  });

  it("bez zdroje neprojde ani známý atribut (TP-2 platí dál)", async () => {
    await firma("25232657");
    await expect(
      zapisAtribut(db, "25232657", "obor", "pekárna", {
        zdrojUrl: "",
        citace: "",
      }),
    ).rejects.toThrow();
  });

  it("whitelist pro zprávu odpovídá příznaku do_zpravy", async () => {
    const vRejstriku = (await nactiAtributy(db))
      .filter((a) => a.doZpravy)
      .map((a) => a.kod)
      .sort();
    expect(vRejstriku).toEqual([...POVOLENE_ATRIBUTY].sort());
  });

  it("atribut s do_zpravy = false do zprávy nepatří", async () => {
    await db.query(
      `insert into atributy (kod, nazev, popis, do_zpravy)
       values ('smenny_provoz', 'směnný provoz', 'jestli firma jede na směny', false)`,
    );
    const doZpravy = (await nactiAtributy(db)).filter((a) => a.doZpravy).map((a) => a.kod);
    expect(doZpravy).not.toContain("smenny_provoz");
  });
});
```

- [ ] **Krok 2: Spusť a ověř, že padají**

```bash
npm test -- atributy
```
Očekávej: FAIL, `Cannot find module '../src/atributy.js'`.

- [ ] **Krok 3: Napiš modul rejstříku**

Vytvoř `src/atributy.ts`:

```ts
/**
 * Rejstřík atributů — co se o firmě smí vědět.
 *
 * Zdroj pravdy je tabulka `atributy`, ne kód. `src/whitelist.ts` zůstává
 * jako seznam pro **zprávu** (SPEC kap. 5.2, příznak `do_zpravy`), ale
 * o tom, co se smí **sbírat**, už nerozhoduje — to určuje profil produktu.
 */
import type { Db } from "./db.js";

export interface Atribut {
  kod: string;
  nazev: string;
  /** Co se u atributu hledá. Jde rovnou agentovi do zadání. */
  popis: string;
  doZpravy: boolean;
}

export async function nactiAtributy(db: Db): Promise<Atribut[]> {
  return db.query<Atribut>(
    `select kod, nazev, popis, do_zpravy as "doZpravy" from atributy order by kod`,
  );
}

export async function jeZnamyAtribut(db: Db, kod: string): Promise<boolean> {
  const r = await db.query<{ pocet: number }>(
    "select count(*)::int as pocet from atributy where kod = $1",
    [kod],
  );
  return (r[0]?.pocet ?? 0) > 0;
}
```

- [ ] **Krok 4: Přepni `zapisAtribut` na rejstřík**

V `src/repo.ts`:

1. Změň typ parametru `atribut` z `PovolenyAtribut` na `string` — seznam už
   není znám při překladu, ověřuje se za běhu proti databázi.
2. Nahraď kontrolu:

```ts
  // TP-3 se dělí (ADR 0002): sbírat se smí, co je v rejstříku; do zprávy
  // jen to, co má `do_zpravy`. Ověřuje se proti databázi, protože rejstřík
  // je nově daty, ne kódem. Cizí klíč na `evidence.atribut` je druhá
  // pojistka — tahle kontrola je tu proto, aby chyba přišla se srozumitelnou
  // hláškou, ne jako porušení cizího klíče.
  if (!(await jeZnamyAtribut(db, atribut))) {
    throw new Error(
      `TP-3: atribut '${atribut}' není v rejstříku. Zaveď ho do tabulky 'atributy', ` +
        `nebo oprav překlep — sbírat se smí jen to, co někdo vědomě zavedl.`,
    );
  }
```

3. `ATRIBUTY_SLOUPCE` **nech, jak je**. Vlastní atributy sloupec v `companies`
   nemají a mít nemají — žijí jen v evidenci. Vyhledávání ve `sloupec` prostě
   nic nenajde a propis se přeskočí, což je správné chování.

**Ve `src/whitelist.ts` neměň seznam** — zůstává jako seznam pro zprávu.
Přepiš jen komentář nahoře, ať netvrdí, že omezuje sběr:

```ts
/**
 * Atributy, které smějí do ZPRÁVY (SPEC kap. 5.2, TP-3).
 *
 * **Neomezuje sběr.** Co se smí o firmě zjišťovat, určuje profil produktu
 * nad rejstříkem `atributy` (ADR 0002, dvě vrstvy). Tenhle seznam musí
 * odpovídat atributům s `do_zpravy = true`; hlídá to test v
 * `test/atributy.test.ts`.
 */
```

- [ ] **Krok 5: Spusť testy**

```bash
npm test
```
Očekávej: PASS. Pokud spadne něco v `enrich.ts` nebo `nalezy.ts`, je to tím,
že mají vlastní kopii seznamu — **neopravuj to rozšířením kopie**, ale
podívej se, jestli tam ta kopie má co dělat, a zapiš to do zprávy.

- [ ] **Krok 6: Commit**

```bash
git add src/atributy.ts src/repo.ts src/whitelist.ts test/atributy.test.ts
git commit -m "feat: sběr se ověřuje proti rejstříku, whitelist váže zprávu"
```

---

### Úkol 3: Profil vybírá atributy, kampaň nese profil

**Soubory:**
- Vytvořit: `supabase/migrations/0036_profil_atributy.sql`, `test/profil-atributy.test.ts`
- Změnit: `src/atributy.ts`

**Rozhraní:**
- Spotřebovává: `atributy` (úkol 1), `nactiAtributy` (úkol 2), `profily`
  a `kampane` ze stávajícího schématu.
- Poskytuje (úkoly 4 a 5):

```ts
export function nactiAtributyProfilu(db: Db, profilKod: string): Promise<Atribut[]>;
export function profilProKampan(db: Db, kampanId: string): Promise<string>;
```

- [ ] **Krok 1: Napiš padající testy**

Vytvoř `test/profil-atributy.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { nactiAtributyProfilu, profilProKampan } from "../src/atributy.js";
import { zalozKampan } from "../src/kampan.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("atributy profilu", () => {
  it("výchozí profil sbírá dnešních osm", async () => {
    const a = await nactiAtributyProfilu(db, "cantinero");
    expect(a.map((x) => x.kod).sort()).toEqual([
      "adresa", "kontakt", "ma_vlastni_jidelnu", "obor",
      "ucel_adresy", "velikost_kategorie", "zamestnanci_odhad", "zpusob_stravovani",
    ]);
  });

  // Jádro nastavitelnosti: atribut v rejstříku, ale mimo profil, se nesbírá.
  it("atribut mimo profil se nesbírá", async () => {
    await db.query(
      `insert into atributy (kod, nazev, popis, do_zpravy)
       values ('smenny_provoz', 'směnný provoz', 'jestli firma jede na směny', false)`,
    );
    const a = await nactiAtributyProfilu(db, "cantinero");
    expect(a.map((x) => x.kod)).not.toContain("smenny_provoz");
  });

  it("přidání do profilu ho zpřístupní", async () => {
    await db.query(
      `insert into atributy (kod, nazev, popis, do_zpravy)
       values ('smenny_provoz', 'směnný provoz', 'jestli firma jede na směny', false)`,
    );
    await db.query(
      "insert into profil_atributy (profil_kod, atribut_kod) values ('cantinero','smenny_provoz')",
    );
    const a = await nactiAtributyProfilu(db, "cantinero");
    expect(a.map((x) => x.kod)).toContain("smenny_provoz");
    expect(a.find((x) => x.kod === "smenny_provoz")?.popis).toContain("směny");
  });
});

describe("profil kampaně", () => {
  it("kampaň bez profilu padá na globálně aktivní", async () => {
    const id = await zalozKampan(db, { nazev: "K1", spravce: "a@b.cz" });
    expect(await profilProKampan(db, id)).toBe("cantinero");
  });

  it("kampaň s profilem přebije globální", async () => {
    const id = await zalozKampan(db, { nazev: "K2", spravce: "a@b.cz" });
    await db.query("update kampane set profil_kod = 'cantinero-business' where id = $1", [id]);
    expect(await profilProKampan(db, id)).toBe("cantinero-business");
  });
});
```

- [ ] **Krok 2: Spusť a ověř, že padají**

```bash
npm test -- profil-atributy
```
Očekávej: FAIL, `relation "profil_atributy" does not exist`.

- [ ] **Krok 3: Napiš migraci**

Vytvoř `supabase/migrations/0036_profil_atributy.sql`:

```sql
-- Co který profil o firmě zjišťuje, a který profil kampaň používá.

create table profil_atributy (
  profil_kod text not null references profily(kod) on delete cascade,
  atribut_kod text not null references atributy(kod) on delete restrict,
  primary key (profil_kod, atribut_kod)
);

-- Oba dnešní profily dostanou všech osm — dosavadní chování se tím nemění.
insert into profil_atributy (profil_kod, atribut_kod)
select p.kod, a.kod from profily p cross join atributy a;

-- Profil kampaně. NULL = použij globálně aktivní, takže stávající kampaně
-- fungují dál beze změny.
--
-- Dvě mechaniky vedle sebe jsou ZÁMĚR: sběr běží nad územím, kde kampaň
-- ještě není, takže musí mít globální profil. Rešerše naopak běží uvnitř
-- kampaně, a tam má rozhodovat ona.
alter table kampane add column profil_kod text references profily(kod) on delete set null;

comment on column kampane.profil_kod is
  'Profil produktu kampaně. NULL = globálně aktivní profil.';
```

- [ ] **Krok 4: Doplň modul**

Do `src/atributy.ts`:

```ts
/** Atributy, které daný profil o firmě zjišťuje. */
export async function nactiAtributyProfilu(db: Db, profilKod: string): Promise<Atribut[]> {
  return db.query<Atribut>(
    `select a.kod, a.nazev, a.popis, a.do_zpravy as "doZpravy"
     from profil_atributy pa
     join atributy a on a.kod = pa.atribut_kod
     where pa.profil_kod = $1
     order by a.kod`,
    [profilKod],
  );
}

/**
 * Profil kampaně, nebo globálně aktivní, když kampaň žádný nemá.
 *
 * Rešerše bere profil odsud — běží uvnitř kampaně. Sběr naopak zůstává na
 * globálním profilu, protože běží nad územím, kde kampaň ještě není.
 */
export async function profilProKampan(db: Db, kampanId: string): Promise<string> {
  const r = await db.query<{ kod: string }>(
    `select coalesce(k.profil_kod, (select kod from profily where aktivni)) as kod
     from kampane k where k.id = $1`,
    [kampanId],
  );
  const kod = r[0]?.kod;
  if (!kod) throw new Error(`Kampaň ${kampanId} nemá profil a žádný není aktivní.`);
  return kod;
}
```

- [ ] **Krok 5: Spusť testy a celou sadu**

```bash
npm test
```
Očekávej: PASS.

- [ ] **Krok 6: Commit**

```bash
git add supabase/migrations/0036_profil_atributy.sql src/atributy.ts test/profil-atributy.test.ts
git commit -m "feat: profil vybírá atributy, kampaň si nese profil"
```

---

### Úkol 4: `chybi` se počítá podle profilu a nese popis

**Soubory:**
- Změnit: `src/nalezy.ts` (`firmyKObohaceni`, kolem řádků 188–280)
- Test: `test/nalezy.test.ts` (rozšíření)

**Rozhraní:**
- Spotřebovává: `nactiAtributyProfilu` z úkolu 3.
- Poskytuje: `FirmaKObohaceni.chybi` nově jako `{ kod, popis }[]`;
  `firmyKObohaceni` přijímá `profilKod`. Úkol 5 to volá.

**Pozor — `chybi` dnes míchá dvě různé věci.** Obsahuje atributy
(`ma_vlastni_jidelnu`, `zpusob_stravovani`), ale i `kontakt` a `spojeni`,
což jsou odvozené značky z tabulky `contacts`, ne atributy z evidence.
`kontakt` v rejstříku je, `spojeni` ne.

**Rozhodnutí:** profil řídí **atributy**; `spojeni` se hledá **vždycky**.
Bez spojení nemá celý systém výstup, takže je to univerzální potřeba, ne
volba produktu. Napiš to do komentáře, ať to někdo příště nepovažuje za
opomenutí.

- [ ] **Krok 1: Napiš padající testy**

Přidej do `test/nalezy.test.ts` (pomocníky na zakládání firem a kampaní si
opiš z existujících testů v tom souboru):

```ts
describe("chybi podle profilu", () => {
  it("nese kód i popis, aby agent věděl, co hledat", async () => {
    const { kampanId } = await pripravKampanSFirmou(db, "25232657");
    const f = await firmyKObohaceni(db, { kampanId, profilKod: "cantinero", limit: 5 });
    const stravovani = f[0]!.chybi.find((c) => c.kod === "zpusob_stravovani");
    expect(stravovani?.popis).toContain("stravenky");
  });

  it("atribut mimo profil se v chybi neobjeví", async () => {
    const { kampanId } = await pripravKampanSFirmou(db, "25232657");
    await db.query("delete from profil_atributy where atribut_kod = 'zpusob_stravovani'");
    const f = await firmyKObohaceni(db, { kampanId, profilKod: "cantinero", limit: 5 });
    expect(f[0]!.chybi.map((c) => c.kod)).not.toContain("zpusob_stravovani");
  });

  // Spojení není atribut a profil ho neřídí — bez něj nemá systém výstup.
  it("spojeni se hledá i u profilu bez atributů", async () => {
    const { kampanId } = await pripravKampanSFirmou(db, "25232657");
    await db.query("delete from profil_atributy where profil_kod = 'cantinero'");
    const f = await firmyKObohaceni(db, { kampanId, profilKod: "cantinero", limit: 5 });
    expect(f[0]!.chybi.map((c) => c.kod)).toContain("spojeni");
  });

  it("nově zavedený atribut se objeví v chybi", async () => {
    const { kampanId } = await pripravKampanSFirmou(db, "25232657");
    await db.query(
      `insert into atributy (kod, nazev, popis, do_zpravy)
       values ('smenny_provoz', 'směnný provoz', 'jestli firma jede na směny a na kolik', false)`,
    );
    await db.query(
      "insert into profil_atributy (profil_kod, atribut_kod) values ('cantinero','smenny_provoz')",
    );
    const f = await firmyKObohaceni(db, { kampanId, profilKod: "cantinero", limit: 5 });
    expect(f[0]!.chybi.map((c) => c.kod)).toContain("smenny_provoz");
  });
});
```

- [ ] **Krok 2: Spusť a ověř, že padají**

```bash
npm test -- nalezy
```
Očekávej: FAIL — `chybi` je dnes `string[]`, ne pole objektů.

- [ ] **Krok 3: Přepiš výpočet**

V `src/nalezy.ts`:

1. Změň typ:

```ts
export interface ChybejiciAtribut {
  kod: string;
  /** Co se u něj hledá. Jde agentovi do zadání. */
  popis: string;
}
```
a v `FirmaKObohaceni` nahraď `chybi: string[]` za `chybi: ChybejiciAtribut[]`.

2. Přidej `profilKod?: string` do `opts`.

3. Nahraď dosavadní pevný výpočet:

```ts
  // Co u firmy chybí, určuje PROFIL, ne pevný seznam. „Chybí" znamená
  // „není o tom v evidenci ani řádek" — jednotně pro dnešních osm i pro
  // nově zavedené atributy, které sloupec v `companies` nemají.
  //
  // `spojeni` je výjimka: není to atribut a profil ho neřídí. Bez spojení
  // nemá celý systém výstup, takže se hledá vždycky.
  const atributy = opts.profilKod
    ? await nactiAtributyProfilu(db, opts.profilKod)
    : await nactiAtributy(db);

  const maEvidenci = new Set(
    (
      await db.query<{ ico: string; atribut: string }>(
        `select distinct ico, atribut from evidence where ico = any($1)`,
        [radky.map((r) => r.ico)],
      )
    ).map((e) => `${e.ico}|${e.atribut}`),
  );
```

a v mapování na výstup:

```ts
    const chybi: ChybejiciAtribut[] = atributy
      .filter((a) => !maEvidenci.has(`${r.ico}|${a.kod}`))
      .map((a) => ({ kod: a.kod, popis: a.popis }));
    if (r.spojeni === 0) chybi.push({ kod: "spojeni", popis: "e-mail nebo telefon na osobu" });
```

**Pozor na prázdný seznam IČO** — `= any('{}')` je v Postgresu past. Když
`radky` nic neobsahují, funkce stejně vrací prázdno dřív; ověř to.

- [ ] **Krok 4: Sroven volání, ať se to přeloží**

`firmyKObohaceni` volá `src/cli.ts` na dvou místech (příkaz `k-obohaceni`
a obsluha rešerše). Přidej `--profil` k příkazu `k-obohaceni`; když se
nezadá a je zadaný `--kampan`, vezmi profil kampaně přes `profilProKampan`.

- [ ] **Krok 5: Spusť testy**

```bash
npm test && npm run typecheck
```
Očekávej: PASS, bez chyb.

- [ ] **Krok 6: Commit**

```bash
git add src/nalezy.ts src/cli.ts test/nalezy.test.ts
git commit -m "feat: co se u firmy hledá, určuje profil — i s popisem pro agenta"
```

---

### Úkol 5: Rešerše bere profil kampaně, obrazovka ho umí vybrat

**Soubory:**
- Změnit: `src/cli.ts` (`cmdReserse`), `app/src/data.ts`, `app/src/PruvodceKampani.tsx`

**Rozhraní:**
- Spotřebovává: `profilProKampan` (úkol 3), `firmyKObohaceni` s `profilKod`
  (úkol 4).
- Poskytuje: nic dalšího — poslední úkol.

- [ ] **Krok 1: Rešerše ať použije profil kampaně**

V `cmdReserse` v `src/cli.ts` doplň před sestavením souboru s prací:

```ts
        // Profil bere z KAMPANĚ, ne globální — kampaň může patřit jinému
        // produktu než ten, co je zrovna aktivní pro sběr.
        const profilKod = await profilProKampan(db, o.kampanId);
        const prace = await firmyKObohaceni(db, {
          kampanId: o.kampanId,
          profilKod,
          limit: firmy.length,
        });
```

a do výpisu na konzoli přidej, který profil se použil — ať je při čtení
deníku vidět, podle čeho se hledalo:

```ts
        console.log(`Objednávka ${o.id}: ${firmy.length} firem, profil ${profilKod}, pouštím Čmuchala…`);
```

- [ ] **Krok 2: Načti profily do aplikace**

Do `app/src/data.ts`:

```ts
export interface Profil {
  kod: string;
  nazev: string;
  aktivni: boolean;
}

export async function nactiProfily(): Promise<Profil[]> {
  const { data, error } = await supabase
    .from("profily")
    .select("kod,nazev,aktivni")
    .order("nazev");
  if (error) throw new Error(error.message);
  return (data ?? []) as Profil[];
}
```

a do `RadekKampane` přidej `profil_kod: string | null` (doplň ho i do
`select` v `nactiKampane`).

- [ ] **Krok 3: Výběr profilu v 1. kroku průvodce**

V `app/src/PruvodceKampani.tsx`, v 1. kroku (založení) pod pole „Zástup",
přidej výběr profilu. Prázdná volba znamená „použij aktivní":

```tsx
      <label className="pole">
        <span>Profil produktu (nepovinné)</span>
        <select value={profilKod} onChange={(e) => setProfilKod(e.target.value)}>
          <option value="">použít aktivní profil</option>
          {profily.map((p) => (
            <option key={p.kod} value={p.kod}>
              {p.nazev}
              {p.aktivni ? " (aktivní)" : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="poznamka">
        Určuje, co se o firmách zjišťuje při AI průzkumu. Když necháte prázdné,
        použije se profil, který je zrovna aktivní pro sběr.
      </p>
```

Stav `profilKod` inicializuj z `kampan?.profil_kod ?? ""` a ukládej ho
v `ulozZalozeni` spolu s ostatními poli (`profil_kod: profilKod || null`).

- [ ] **Krok 4: Ověř**

```bash
npm run typecheck && npm run build --prefix app && npm test
```
Očekávej: bez chyb, PASS.

- [ ] **Krok 5: Commit**

```bash
git add src/cli.ts app/src/data.ts app/src/PruvodceKampani.tsx
git commit -m "feat: rešerše se řídí profilem kampaně a jde vybrat v průvodci"
```

---

## Nasazení a ověření s majitelem

- [ ] **Nasaď migrace:** `npm run cli -- migrate`.
- [ ] **Ověř, že na `evidence` nezbyla stará podmínka na `atribut`** — jinak
      by nový atribut neprošel a poznalo by se to až pozdě.
- [ ] Zaveď atribut **směnný provoz** a přidej ho profilu `cantinero`.
- [ ] `npm run dev --prefix app`, majitel se přihlásí v panelu Browser.
- [ ] Otevři **Kampaň Hrobce**, objednej rešerši na 5 firem, pusť
      `npm run cli -- reserse obsluz`. Ve výpisu musí být, který profil se použil.
- [ ] **Zkontroluj, jestli se směnný provoz u někoho dohledal — a jestli má
      citaci.** Když se nedohledal u nikoho, **řekni to majiteli**: je to
      zpráva o výtěžnosti, ne o kódu, a zadání kap. 2 na to předem upozorňuje.

## Sebekontrola plánu

| Kapitola zadání | Kde se plní |
|---|---|
| 3. Rejstřík atributů (tabulka, popis, `do_zpravy`, cizí klíč) | Úkol 1 |
| 3. TP-3 se dělí | Úkol 2 |
| 4. Profil říká, co sbírat | Úkoly 3 a 4 |
| 5. Kampaň nese profil (a fallback na aktivní) | Úkoly 3 a 5 |
| 6. Co se nemění (TP-2, sítě, TP-8, sloupce, sběr) | Úkol 2, krok 4 (`ATRIBUTY_SLOUPCE` beze změny); sběr se nikde nemění |
| 7. Testy 1–7 | Úkoly 1–4; test 7 (migrace nezničí evidenci) je v úkolu 1, krok 5 |
| 8. Hotovo (včetně ostré dávky) | Sekce Nasazení a ověření |
| 9. Rizika | Úkol 2 je označený jako nejrizikovější; výtěžnost je v ověření |
| 10. Neřeší (zpráva, obrazovka profilů, zámek) | Záměrně mimo plán |

### Nejistoty, které jsem v plánu nechal vědomě

**Název podmínky `evidence_atribut_check` je odhad**, ne ověřený fakt.
Postgres ji pojmenovává podle zvyklosti, ale nemusí sedět. V úkolu 1 je na
to upozornění i způsob, jak to poznat — ale jistota bude až po `migrate`.

**Kopie seznamu atributů v `src/enrich.ts`** (`ENRICH_ATRIBUTY`) se plánem
nemění. Ta cesta nikdy neběžela naostro (0 USD, klíč v `.env` není), takže
ji nechávám být — ale je to druhé místo se seznamem a zaslouží si vlastní
úklid. Úkol 2 krok 5 na to implementátora upozorňuje.

**Pomocníci v testech** (`pripravKampanSFirmou`) se v úkolu 4 neuvádějí
celí — odkazuje se na existující testy. Je to vědomá výjimka z pravidla
„žádné placeholdery": opsat je naslepo by znamenalo hádat tvar falešného
záznamu z ARESu, který se v projektu už několikrát změnil.
