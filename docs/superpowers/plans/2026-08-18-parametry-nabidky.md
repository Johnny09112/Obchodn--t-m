# Parametry nabídky — plán první dodávky

> **Pro agentní pracovníky:** POVINNÝ PODSKILL: použij
> superpowers:subagent-driven-development (doporučeno) nebo
> superpowers:executing-plans a odpracuj plán úkol po úkolu. Kroky mají
> zaškrtávátka (`- [ ]`) kvůli sledování postupu.

**Cíl:** Údaje o tom, co prodáváme (cena, provize, možnosti výdeje), se
přestanou psát do kódu — zavádějí se a vyplňují v aplikaci, v okně, které
se otevře tlačítkem *Upravit* u jídelny.

**Architektura:** Nová tabulka `nabidky` odděluje „to, co prodáváme“ od
jídelny; jídelně zůstávají poloha, zóna a kapacita, protože podle nich se
počítá dosah. Definice parametrů (`parametry_nabidky`) visí na produktu,
jejich hodnoty (`hodnoty_parametru`) na nabídce. Hodnota je vždy text a
převádí ji kód podle druhu parametru.

**Technologie:** TypeScript, PGlite/Postgres, React + Supabase klient,
Vitest. Bez nových závislostí.

**Zadání:** `docs/superpowers/specs/2026-08-18-nastaveni-zpravy-design.md`

## Globální omezení

- **Jazyk:** čeština v komentářích, názvech domén, dokumentech i commit
  messages. Identifikátory česky bez diakritiky (`nactiParametry`).
- **TDD:** nejdřív test, pak implementace. `npm test` musí projít vždy,
  offline, bez env proměnných.
- **Migrace jen přidávat** do `supabase/migrations/`. Nasazená migrace se
  needituje. Další volné číslo je **0045**.
- **Do `companies` a `evidence` se nesahá.** Tenhle celek se jich netýká;
  parametr popisuje naši nabídku, ne oslovovanou firmu.
- **Odesílání zůstává vypnuté** (TP-8). Žádný krok tohoto plánu ho neumí
  zapnout ani se ho nedotkne.
- **Ostrá data jsou v cloudu** za `DATABASE_URL`, ne v `data/pgdata-v5`.
  Příkaz nad ostrými daty:
  `set -a && . ~/.cantinero/.env && set +a && npm run cli -- <příkaz>`
- **Hotovo** znamená `npm test` **a** `npm run typecheck`, u frontendu
  navíc proklikání v prohlížeči a `npm run build --prefix app`.

## Struktura souborů

| Soubor | Za co odpovídá |
|---|---|
| `supabase/migrations/0045_parametry_nabidky.sql` | schéma, pravidla přístupu, převod stávajících jídelen na nabídky, čtyři výchozí parametry |
| `src/parametry.ts` | čtení definic a hodnot, kontrola hodnoty podle druhu, zavedení parametru |
| `test/parametry.test.ts` | testy k tomu |
| `src/cli.ts` | příkaz `parametry` (výpis a nastavení bez aplikace) |
| `app/src/data.ts` | načtení a uložení parametrů z prohlížeče |
| `app/src/OknoParametru.tsx` | okno, které se otevře tlačítkem *Upravit* |
| `app/src/Jidelny.tsx` | sloupec se souhrnem a tlačítko *Upravit* |

Okno je vlastní soubor schválně: `Jidelny.tsx` má dnes 305 řádků a s
vyplňováním parametrů i zaváděním nových by přerostlo do neúnosna.

---

### Úkol 1: Migrace — nabídky, parametry a hodnoty

**Soubory:**
- Vytvořit: `supabase/migrations/0045_parametry_nabidky.sql`
- Test: `test/parametry.test.ts`

**Rozhraní:**
- Spotřebovává: nic
- Poskytuje: tabulky `nabidky`, `parametry_nabidky`, `hodnoty_parametru`,
  sloupec `jidelny.nabidka_id`; čtyři výchozí parametry produktu
  `cantinero` s kódy `cena_obeda`, `provize`, `moznosti_vydeje`,
  `vari_o_prazdninach`

- [ ] **Krok 1: Napiš padající test**

Do nového `test/parametry.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("migrace parametrů nabídky", () => {
  it("každá jídelna má po migraci svoji nabídku", async () => {
    await db.query(
      `insert into jidelny (nazev, adresa, lat, lng, zona_metru)
       values ('ZŠ Zkušební', 'Zkušební 1', 49.7, 13.4, 3000)`,
    );
    // Nabídka vzniká spouští při zápisu jídelny — jinak by ji musel
    // zakládat každý, kdo jídelnu vytváří, a někdo by na to zapomněl.
    const r = await db.query<{ pocet: number }>(
      `select count(*)::int as pocet from jidelny j
        join nabidky n on n.id = j.nabidka_id`,
    );
    expect(r[0]?.pocet).toBe(1);
  });

  it("výchozí parametry Cantinera jsou čtyři a mají svůj druh", async () => {
    const r = await db.query<{ kod: string; druh: string }>(
      `select kod, druh from parametry_nabidky
        where produkt_kod = 'cantinero' order by poradi`,
    );
    expect(r.map((x) => x.kod)).toEqual([
      "cena_obeda",
      "provize",
      "moznosti_vydeje",
      "vari_o_prazdninach",
    ]);
    expect(r.map((x) => x.druh)).toEqual(["cislo", "cislo", "vyber", "ano_ne"]);
  });

  it("možnosti výdeje nabízejí čtyři volby", async () => {
    const r = await db.query<{ moznosti: string[] }>(
      `select moznosti from parametry_nabidky where kod = 'moznosti_vydeje'`,
    );
    expect(r[0]?.moznosti).toEqual([
      "na místě",
      "do vlastního jídlonosiče",
      "do jednorázového obalu",
      "hromadný odvoz nebo rozvoz",
    ]);
  });

  it("tentýž kód parametru nejde v jednom produktu zavést dvakrát", async () => {
    await expect(
      db.query(
        `insert into parametry_nabidky (produkt_kod, kod, nazev, druh)
         values ('cantinero', 'cena_obeda', 'Cena podruhé', 'cislo')`,
      ),
    ).rejects.toThrow();
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/parametry.test.ts`
Očekávej: FAIL — `relation "nabidky" does not exist`.

- [ ] **Krok 3: Napiš migraci**

Do `supabase/migrations/0045_parametry_nabidky.sql`:

```sql
-- Parametry nabídky — co o prodávané věci sledujeme.
--
-- Požadavek majitele (18. 8. 2026): „Pokud u docházkového systému budu
-- chtít nějakou část vždy měnit na základě dat, musí to jít nastavit
-- snadno přes user-friendly rozhraní — bez kódování." Jídelny jsou první
-- případ užití, ne jediný.
--
-- Proč `nabidky` vedle `jidelny`: docházkový systém ani on-line služba
-- nemají zónu ani polohu. Kdyby hodnoty visely na `jidelny`, druhý produkt
-- by si vynutil buď falešnou jídelnu, nebo přepis všeho, co dnes na
-- `jidelny` závisí (`dosah`, `zona`, `cmuchal`). Jídelně zůstávají jen
-- údaje, které jsou opravdu jen její.

create table nabidky (
  id uuid primary key default gen_random_uuid(),
  produkt_kod text not null,                    -- shodné s profily.kod
  nazev text not null,
  vytvoreno_at timestamptz not null default now()
);

comment on table nabidky is
  'Co prodáváme. Dnes školní obědy z jídelny, jindy docházkový systém.';

alter table jidelny add column nabidka_id uuid references nabidky(id);

-- Definice parametru. Visí na produktu, ne na jednotlivé nabídce —
-- „cena oběda" má smysl u všech jídelen, ne jen u té jedné.
create table parametry_nabidky (
  id uuid primary key default gen_random_uuid(),
  produkt_kod text not null,
  kod text not null,
  nazev text not null,
  druh text not null check (druh in ('cislo', 'text', 'ano_ne', 'vyber')),
  jednotka text,
  moznosti text[] not null default '{}',        -- jen u druhu 'vyber'
  poradi int not null default 0,
  vytvoreno_at timestamptz not null default now(),
  unique (produkt_kod, kod),
  -- Výběr bez možností by byl prázdný seznam k vybírání.
  check (druh <> 'vyber' or cardinality(moznosti) > 0)
);

-- Hodnota je JEDEN textový sloupec pro všechny čtyři druhy; převod dělá
-- kód podle `druh`. Čtyři sloupce pro čtyři druhy by znamenaly, že tři
-- jsou u každého řádku prázdné, a pátý druh by si vynutil migraci.
create table hodnoty_parametru (
  nabidka_id uuid not null references nabidky(id) on delete cascade,
  parametr_id uuid not null references parametry_nabidky(id) on delete cascade,
  hodnota text not null,
  zmeneno_at timestamptz not null default now(),
  primary key (nabidka_id, parametr_id)
);

-- Každá jídelna má právě jednu nabídku. Spoušť schválně: kdyby ji zakládal
-- volající, dřív nebo později vznikne jídelna bez nabídky a ta pak tiše
-- vypadne ze všeho, co se o parametry opírá.
create or replace function public.zaloz_nabidku_k_jidelne()
returns trigger language plpgsql as $$
begin
  if new.nabidka_id is null then
    insert into nabidky (produkt_kod, nazev)
      values ('cantinero', new.nazev)
      returning id into new.nabidka_id;
  end if;
  return new;
end $$;

create trigger jidelny_nabidka
  before insert on jidelny
  for each row execute function public.zaloz_nabidku_k_jidelne();

-- Jídelny, které existovaly před touhle migrací.
insert into nabidky (produkt_kod, nazev)
  select 'cantinero', nazev from jidelny where nabidka_id is null;

update jidelny j
   set nabidka_id = n.id
  from nabidky n
 where j.nabidka_id is null and n.nazev = j.nazev;

-- Výchozí parametry Cantinera. Majitel je smí přejmenovat i smazat —
-- je to výchozí obsah, ne pravidlo.
insert into parametry_nabidky (produkt_kod, kod, nazev, druh, jednotka, moznosti, poradi)
values
  ('cantinero', 'cena_obeda', 'Cena oběda', 'cislo', 'Kč', '{}', 1),
  ('cantinero', 'provize', 'Naše provize', 'cislo', 'Kč', '{}', 2),
  ('cantinero', 'moznosti_vydeje', 'Možnosti výdeje', 'vyber', null,
    array['na místě', 'do vlastního jídlonosiče', 'do jednorázového obalu',
          'hromadný odvoz nebo rozvoz'], 3),
  ('cantinero', 'vari_o_prazdninach', 'Vaří o prázdninách', 'ano_ne', null, '{}', 4);

-- Přístup: čte kdokoli přihlášený, mění admin a výš — stejně jako
-- u jídelen, kapacity a ostatních pravidel hry (migrace 0016).
alter table nabidky enable row level security;
alter table parametry_nabidky enable row level security;
alter table hodnoty_parametru enable row level security;

do $$
declare t text;
begin
  foreach t in array array['nabidky', 'parametry_nabidky', 'hodnoty_parametru'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_cteni', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.role_uzivatele() in (''super-admin'', ''admin''))
         with check (public.role_uzivatele() in (''super-admin'', ''admin''))',
      t || '_sprava', t);
  end loop;
end $$;

create index hodnoty_parametru_nabidka_idx on hodnoty_parametru (nabidka_id);
```

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/parametry.test.ts`
Očekávej: PASS, 4 testy.

- [ ] **Krok 5: Ověř, že nic jiného nespadlo**

Spusť: `npm test`
Očekávej: všechny soubory zelené. Pozor hlavně na testy, které zakládají
jídelnu — spoušť jim nově dopisuje `nabidka_id`.

- [ ] **Krok 6: Commit**

```bash
git add supabase/migrations/0045_parametry_nabidky.sql test/parametry.test.ts
git commit -m "feat: nabídky a parametry nabídky (migrace 0045)

Nabídka odděluje to, co prodáváme, od jídelny — docházkový systém nemá
zónu ani polohu. Jídelně zůstávají poloha, zóna a kapacita, podle nich
se počítá dosah.

Hodnota parametru je jeden textový sloupec pro všechny čtyři druhy;
převod dělá kód. Čtyři sloupce by u každého řádku nechaly tři prázdné."
```

---

### Úkol 2: Čtení parametrů a hodnot

**Soubory:**
- Vytvořit: `src/parametry.ts`
- Test: `test/parametry.test.ts` (přidat popis)

**Rozhraní:**
- Spotřebovává: tabulky z úkolu 1
- Poskytuje:
  - `type DruhParametru = "cislo" | "text" | "ano_ne" | "vyber"`
  - `interface ParametrNabidky { id: string; produktKod: string; kod: string; nazev: string; druh: DruhParametru; jednotka: string | null; moznosti: string[]; poradi: number }`
  - `nactiParametry(db: Db, produktKod: string): Promise<ParametrNabidky[]>`
  - `nactiHodnoty(db: Db, nabidkaId: string): Promise<Record<string, string>>`

- [ ] **Krok 1: Napiš padající test**

Přidej do `test/parametry.test.ts`:

```typescript
import { nactiParametry, nactiHodnoty } from "../src/parametry.js";

/** Založí jídelnu a vrátí id její nabídky. */
async function zalozNabidku(db: Db, nazev = "ZŠ Zkušební"): Promise<string> {
  const r = await db.query<{ nabidka_id: string }>(
    `insert into jidelny (nazev, adresa, lat, lng, zona_metru)
     values ($1, 'Zkušební 1', 49.7, 13.4, 3000) returning nabidka_id`,
    [nazev],
  );
  return r[0]!.nabidka_id;
}

describe("čtení parametrů", () => {
  it("vrátí parametry produktu v pořadí, v jakém se mají ukazovat", async () => {
    const p = await nactiParametry(db, "cantinero");
    expect(p.map((x) => x.kod)).toEqual([
      "cena_obeda",
      "provize",
      "moznosti_vydeje",
      "vari_o_prazdninach",
    ]);
    expect(p[0]?.jednotka).toBe("Kč");
    expect(p[2]?.moznosti).toHaveLength(4);
  });

  it("cizí produkt nevrátí nic", async () => {
    expect(await nactiParametry(db, "dochazka")).toEqual([]);
  });

  it("hodnoty se vracejí pod kódem parametru, ne pod jeho id", async () => {
    const nabidka = await zalozNabidku(db);
    const [p] = await db.query<{ id: string }>(
      `select id from parametry_nabidky where kod = 'cena_obeda'`,
    );
    await db.query(
      `insert into hodnoty_parametru (nabidka_id, parametr_id, hodnota)
       values ($1, $2, '115')`,
      [nabidka, p!.id],
    );

    expect(await nactiHodnoty(db, nabidka)).toEqual({ cena_obeda: "115" });
  });

  it("nabídka bez vyplněných hodnot vrátí prázdno, ne chybu", async () => {
    const nabidka = await zalozNabidku(db, "ZŠ Prázdná");
    expect(await nactiHodnoty(db, nabidka)).toEqual({});
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/parametry.test.ts`
Očekávej: FAIL — `Cannot find module '../src/parametry.js'`.

- [ ] **Krok 3: Napiš minimální implementaci**

Do `src/parametry.ts`:

```typescript
/**
 * Parametry nabídky — co o prodávané věci sledujeme.
 *
 * Definice visí na produktu (`produkt_kod`), hodnoty na konkrétní nabídce.
 * Hodnota je vždy text; převod na číslo nebo seznam dělá tenhle modul
 * podle druhu parametru.
 *
 * **Parametr popisuje naši nabídku, ne oslovovanou firmu.** Údaj o cizí
 * firmě sem nepatří — ten smí do zprávy jen se záznamem v `evidence`,
 * zdrojem a doslovnou citací (TP-2, TP-3).
 */

import type { Db } from "./db.js";

export type DruhParametru = "cislo" | "text" | "ano_ne" | "vyber";

export interface ParametrNabidky {
  id: string;
  produktKod: string;
  kod: string;
  nazev: string;
  druh: DruhParametru;
  jednotka: string | null;
  moznosti: string[];
  poradi: number;
}

interface RadekParametru {
  id: string;
  produkt_kod: string;
  kod: string;
  nazev: string;
  druh: DruhParametru;
  jednotka: string | null;
  moznosti: string[];
  poradi: number;
}

export async function nactiParametry(db: Db, produktKod: string): Promise<ParametrNabidky[]> {
  const r = await db.query<RadekParametru>(
    `select id, produkt_kod, kod, nazev, druh, jednotka, moznosti, poradi
       from parametry_nabidky where produkt_kod = $1 order by poradi, nazev`,
    [produktKod],
  );
  return r.map((x) => ({
    id: x.id,
    produktKod: x.produkt_kod,
    kod: x.kod,
    nazev: x.nazev,
    druh: x.druh,
    jednotka: x.jednotka,
    moznosti: x.moznosti ?? [],
    poradi: x.poradi,
  }));
}

/** Hodnoty pod kódem parametru — volající pracuje s kódem, ne s id. */
export async function nactiHodnoty(db: Db, nabidkaId: string): Promise<Record<string, string>> {
  const r = await db.query<{ kod: string; hodnota: string }>(
    `select p.kod, h.hodnota
       from hodnoty_parametru h
       join parametry_nabidky p on p.id = h.parametr_id
      where h.nabidka_id = $1`,
    [nabidkaId],
  );
  return Object.fromEntries(r.map((x) => [x.kod, x.hodnota]));
}
```

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/parametry.test.ts`
Očekávej: PASS.

- [ ] **Krok 5: Commit**

```bash
git add src/parametry.ts test/parametry.test.ts
git commit -m "feat: čtení parametrů nabídky a jejich hodnot"
```

---

### Úkol 3: Kontrola hodnoty podle druhu a její uložení

**Soubory:**
- Upravit: `src/parametry.ts`
- Test: `test/parametry.test.ts`

**Rozhraní:**
- Spotřebovává: `ParametrNabidky` z úkolu 2
- Poskytuje:
  - `zkontrolujHodnotu(p: ParametrNabidky, hodnota: string): string | null`
    — vrací větu pro člověka, nebo `null`, když je hodnota v pořádku
  - `ulozHodnotu(db: Db, nabidkaId: string, kod: string, hodnota: string): Promise<void>`
  - `naSeznam(hodnota: string): string[]` a `zeSeznamu(volby: string[]): string`

- [ ] **Krok 1: Napiš padající test**

```typescript
import { zkontrolujHodnotu, ulozHodnotu, naSeznam, zeSeznamu } from "../src/parametry.js";

describe("kontrola hodnoty podle druhu", () => {
  it("do čísla nepustí slovo a řekne proč", async () => {
    const [cena] = await nactiParametry(db, "cantinero");
    expect(zkontrolujHodnotu(cena!, "draho")).toMatch(/číslo/i);
    expect(zkontrolujHodnotu(cena!, "115")).toBeNull();
  });

  it("záporná cena je chyba", async () => {
    const [cena] = await nactiParametry(db, "cantinero");
    expect(zkontrolujHodnotu(cena!, "-5")).toMatch(/záporn/i);
  });

  it("ano/ne bere jen ano nebo ne", async () => {
    const p = await nactiParametry(db, "cantinero");
    const prazdniny = p.find((x) => x.kod === "vari_o_prazdninach")!;
    expect(zkontrolujHodnotu(prazdniny, "ano")).toBeNull();
    expect(zkontrolujHodnotu(prazdniny, "ne")).toBeNull();
    expect(zkontrolujHodnotu(prazdniny, "možná")).toMatch(/ano/i);
  });

  it("výběr nepustí volbu, která není v nabídce", async () => {
    const p = await nactiParametry(db, "cantinero");
    const vydej = p.find((x) => x.kod === "moznosti_vydeje")!;
    expect(zkontrolujHodnotu(vydej, zeSeznamu(["na místě"]))).toBeNull();
    expect(zkontrolujHodnotu(vydej, zeSeznamu(["poštou"]))).toMatch(/poštou/);
  });

  it("prázdný výběr je platný — jídelna zatím neví, co umí", async () => {
    const p = await nactiParametry(db, "cantinero");
    const vydej = p.find((x) => x.kod === "moznosti_vydeje")!;
    expect(zkontrolujHodnotu(vydej, zeSeznamu([]))).toBeNull();
  });

  it("seznam voleb přežije uložení a načtení", () => {
    expect(naSeznam(zeSeznamu(["na místě", "do jednorázového obalu"]))).toEqual([
      "na místě",
      "do jednorázového obalu",
    ]);
  });
});

describe("uložení hodnoty", () => {
  it("uloží hodnotu a druhé uložení ji přepíše", async () => {
    const nabidka = await zalozNabidku(db, "ZŠ Uložená");
    await ulozHodnotu(db, nabidka, "cena_obeda", "115");
    await ulozHodnotu(db, nabidka, "cena_obeda", "120");

    expect(await nactiHodnoty(db, nabidka)).toEqual({ cena_obeda: "120" });
  });

  it("neplatnou hodnotu neuloží a řekne proč", async () => {
    const nabidka = await zalozNabidku(db, "ZŠ Odmítnutá");
    await expect(ulozHodnotu(db, nabidka, "cena_obeda", "draho")).rejects.toThrow(/číslo/i);
    expect(await nactiHodnoty(db, nabidka)).toEqual({});
  });

  it("neznámý parametr je chyba, ne tiché nic", async () => {
    const nabidka = await zalozNabidku(db, "ZŠ Neznámá");
    await expect(ulozHodnotu(db, nabidka, "vymysleny", "1")).rejects.toThrow(/vymysleny/);
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/parametry.test.ts`
Očekávej: FAIL — `zkontrolujHodnotu is not a function`.

- [ ] **Krok 3: Napiš minimální implementaci**

Přidej do `src/parametry.ts`:

```typescript
/**
 * Seznam voleb se ukládá jako JSON pole. Oddělovač čárkou by se rozbil
 * na volbě, která čárku obsahuje — a to se pozná až u zákazníka.
 */
export function zeSeznamu(volby: string[]): string {
  return JSON.stringify(volby);
}

export function naSeznam(hodnota: string): string[] {
  if (hodnota.trim() === "") return [];
  try {
    const x: unknown = JSON.parse(hodnota);
    return Array.isArray(x) ? x.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Vrátí větu pro člověka, nebo `null`, když je hodnota v pořádku.
 *
 * Kontroluje se tady, ne v databázi: pátý druh parametru by jinak
 * znamenal migraci, a hlášku „musí to být číslo" stejně musí složit kód.
 */
export function zkontrolujHodnotu(p: ParametrNabidky, hodnota: string): string | null {
  switch (p.druh) {
    case "cislo": {
      const n = Number(hodnota.replace(",", ".").trim());
      if (hodnota.trim() === "" || Number.isNaN(n)) {
        return `„${p.nazev}" má být číslo, ne „${hodnota}".`;
      }
      if (n < 0) return `„${p.nazev}" nemůže být záporné.`;
      return null;
    }
    case "ano_ne":
      return hodnota === "ano" || hodnota === "ne"
        ? null
        : `„${p.nazev}" je ano, nebo ne — ne „${hodnota}".`;
    case "vyber": {
      const cizi = naSeznam(hodnota).filter((v) => !p.moznosti.includes(v));
      return cizi.length === 0
        ? null
        : `„${p.nazev}" nezná volbu ${cizi.map((v) => `„${v}"`).join(", ")}.`;
    }
    case "text":
      return hodnota.length <= 200 ? null : `„${p.nazev}" má být kratší než 200 znaků.`;
  }
}

export async function ulozHodnotu(
  db: Db,
  nabidkaId: string,
  kod: string,
  hodnota: string,
): Promise<void> {
  const [radek] = await db.query<RadekParametru>(
    `select p.id, p.produkt_kod, p.kod, p.nazev, p.druh, p.jednotka, p.moznosti, p.poradi
       from parametry_nabidky p
       join nabidky n on n.produkt_kod = p.produkt_kod
      where n.id = $1 and p.kod = $2`,
    [nabidkaId, kod],
  );
  if (!radek) throw new Error(`Nabídka nezná parametr „${kod}".`);

  const p: ParametrNabidky = {
    id: radek.id,
    produktKod: radek.produkt_kod,
    kod: radek.kod,
    nazev: radek.nazev,
    druh: radek.druh,
    jednotka: radek.jednotka,
    moznosti: radek.moznosti ?? [],
    poradi: radek.poradi,
  };

  const vytka = zkontrolujHodnotu(p, hodnota);
  if (vytka) throw new Error(vytka);

  await db.query(
    `insert into hodnoty_parametru (nabidka_id, parametr_id, hodnota)
     values ($1, $2, $3)
     on conflict (nabidka_id, parametr_id)
       do update set hodnota = excluded.hodnota, zmeneno_at = now()`,
    [nabidkaId, p.id, hodnota],
  );
}
```

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/parametry.test.ts`
Očekávej: PASS.

- [ ] **Krok 5: Zkontroluj typy**

Spusť: `npm run typecheck`
Očekávej: bez chyb. Projekt má přísné indexování — `r[0]` je možná
`undefined`, používej `?.` nebo `!` s rozmyslem.

- [ ] **Krok 6: Commit**

```bash
git add src/parametry.ts test/parametry.test.ts
git commit -m "feat: kontrola hodnoty parametru podle druhu a její uložení"
```

---

### Úkol 4: Zavedení nového parametru

**Soubory:**
- Upravit: `src/parametry.ts`
- Test: `test/parametry.test.ts`

**Rozhraní:**
- Poskytuje:
  - `kodZNazvu(nazev: string): string`
  - `zavedParametr(db: Db, v: NovyParametr): Promise<string>` (vrací id)
  - `interface NovyParametr { produktKod: string; nazev: string; druh: DruhParametru; jednotka?: string; moznosti?: string[] }`

- [ ] **Krok 1: Napiš padající test**

```typescript
import { kodZNazvu, zavedParametr } from "../src/parametry.js";

describe("zavedení parametru", () => {
  it("kód vznikne z názvu bez diakritiky a mezer", () => {
    expect(kodZNazvu("Rozvoz zdarma od")).toBe("rozvoz_zdarma_od");
    expect(kodZNazvu("Počet zaměstnanců v ceně")).toBe("pocet_zamestnancu_v_cene");
  });

  it("zavedený parametr je hned vidět v seznamu produktu", async () => {
    await zavedParametr(db, {
      produktKod: "cantinero",
      nazev: "Rozvoz zdarma od",
      druh: "cislo",
      jednotka: "obědů",
    });

    const p = await nactiParametry(db, "cantinero");
    expect(p.map((x) => x.kod)).toContain("rozvoz_zdarma_od");
    expect(p[p.length - 1]?.nazev).toBe("Rozvoz zdarma od");
  });

  it("druhý parametr téhož názvu se odmítne", async () => {
    await expect(
      zavedParametr(db, { produktKod: "cantinero", nazev: "Cena oběda", druh: "cislo" }),
    ).rejects.toThrow(/už existuje/i);
  });

  it("výběr bez možností se odmítne — nebylo by z čeho vybírat", async () => {
    await expect(
      zavedParametr(db, { produktKod: "cantinero", nazev: "Balení", druh: "vyber" }),
    ).rejects.toThrow(/možnost/i);
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/parametry.test.ts`
Očekávej: FAIL — `kodZNazvu is not a function`.

- [ ] **Krok 3: Napiš minimální implementaci**

Přidej do `src/parametry.ts`:

```typescript
export interface NovyParametr {
  produktKod: string;
  nazev: string;
  druh: DruhParametru;
  jednotka?: string;
  moznosti?: string[];
}

/**
 * Kód se odvodí z názvu, aby ho nikdo nemusel vymýšlet. Diakritika pryč —
 * kód se objeví v šabloně jako `[rozvoz_zdarma_od]` a tam se hodí něco,
 * co jde napsat na každé klávesnici.
 */
export function kodZNazvu(nazev: string): string {
  return nazev
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function zavedParametr(db: Db, v: NovyParametr): Promise<string> {
  const kod = kodZNazvu(v.nazev);
  if (kod === "") throw new Error("Název parametru musí obsahovat aspoň jedno písmeno nebo číslici.");

  const moznosti = v.moznosti ?? [];
  if (v.druh === "vyber" && moznosti.length === 0) {
    throw new Error("Výběr z možností potřebuje aspoň jednu možnost.");
  }

  const [uz] = await db.query<{ id: string }>(
    "select id from parametry_nabidky where produkt_kod = $1 and kod = $2",
    [v.produktKod, kod],
  );
  if (uz) throw new Error(`Parametr „${v.nazev}" už existuje.`);

  // Přísné indexování v tomhle projektu tvrdí, že `r[0]` může chybět —
  // proto přes proměnnou a `??`, ne destrukturováním s přetypováním.
  const [radekPoradi] = await db.query<{ dalsi: number }>(
    "select coalesce(max(poradi), 0) + 1 as dalsi from parametry_nabidky where produkt_kod = $1",
    [v.produktKod],
  );
  const dalsi = Number(radekPoradi?.dalsi ?? 1);

  const [novy] = await db.query<{ id: string }>(
    `insert into parametry_nabidky (produkt_kod, kod, nazev, druh, jednotka, moznosti, poradi)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [v.produktKod, kod, v.nazev, v.druh, v.jednotka ?? null, moznosti, dalsi],
  );
  return novy!.id;
}
```

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/parametry.test.ts`
Očekávej: PASS.

- [ ] **Krok 5: Commit**

```bash
git add src/parametry.ts test/parametry.test.ts
git commit -m "feat: zavedení nového parametru nabídky z aplikace"
```

---

### Úkol 5: Příkaz `parametry`

**Soubory:**
- Upravit: `src/cli.ts` (import u ostatních, funkce před `cmdVzorekKontroly`,
  `case` u `obsah`, řádek v nápovědě)

**Rozhraní:**
- Spotřebovává: `nactiParametry`, `nactiHodnoty`, `ulozHodnotu` z úkolů 2–3
- Poskytuje: `parametry [seznam]`, `parametry nastav --jidelna <id> --kod <kod> --hodnota <text>`

Příkaz je tu proto, aby šlo stav zkontrolovat a opravit bez prohlížeče —
stejně jako u `obsah`.

- [ ] **Krok 1: Přidej import**

V `src/cli.ts` k ostatním importům:

```typescript
import { nactiHodnoty, nactiParametry, ulozHodnotu } from "./parametry.js";
```

- [ ] **Krok 2: Napiš funkci příkazu**

Vlož před `async function cmdVzorekKontroly`:

```typescript
/**
 * Parametry nabídky z příkazové řádky.
 *
 * Obrazovka je hlavní cesta; tohle je záchranná brzda pro případ, kdy se
 * potřebuju podívat, co je v datech, aniž bych otevíral prohlížeč.
 */
async function cmdParametry(argv: string[]): Promise<void> {
  const podprikaz = argv[0] ?? "seznam";
  const { values } = parseArgs({
    args: podprikaz === "seznam" ? argv : argv.slice(1),
    options: {
      jidelna: { type: "string" },
      kod: { type: "string" },
      hodnota: { type: "string" },
      produkt: { type: "string", default: "cantinero" },
    },
    allowPositionals: true,
  });

  const db = await pripojDb();
  try {
    if (podprikaz === "nastav") {
      if (!values.jidelna || !values.kod || values.hodnota === undefined) {
        console.log("Chybí --jidelna, --kod nebo --hodnota.");
        return;
      }
      const [j] = await db.query<{ nabidka_id: string; nazev: string }>(
        "select nabidka_id, nazev from jidelny where id = $1",
        [values.jidelna],
      );
      if (!j) {
        console.log("Taková jídelna není.");
        return;
      }
      await ulozHodnotu(db, j.nabidka_id, values.kod, values.hodnota);
      console.log(`${j.nazev}: ${values.kod} = ${values.hodnota}`);
      return;
    }

    const parametry = await nactiParametry(db, values.produkt);
    console.log(`Parametry produktu „${values.produkt}" (${parametry.length}):`);
    for (const p of parametry) {
      const jednotka = p.jednotka ? ` [${p.jednotka}]` : "";
      const moznosti = p.moznosti.length > 0 ? ` — ${p.moznosti.join(" · ")}` : "";
      console.log(`  ${p.kod}${jednotka} (${p.druh}) — ${p.nazev}${moznosti}`);
    }

    const jidelny = await db.query<{ id: string; nazev: string; nabidka_id: string }>(
      "select id, nazev, nabidka_id from jidelny order by nazev",
    );
    console.log("\nHodnoty u jídelen:");
    for (const j of jidelny) {
      const h = await nactiHodnoty(db, j.nabidka_id);
      const vypis = parametry
        .map((p) => `${p.kod}=${h[p.kod] ?? "—"}`)
        .join(" · ");
      console.log(`  ${j.nazev}: ${vypis}`);
    }
  } finally {
    await db.close();
  }
}
```

- [ ] **Krok 3: Zapoj příkaz a doplň nápovědu**

K `case "obsah":` přidej:

```typescript
  case "parametry":
    await cmdParametry(zbytek);
    break;
```

Do nápovědy nad řádek `vzorek-kontroly`:

```
  parametry [seznam] [--produkt cantinero]
                                   vypíše parametry nabídky a jejich hodnoty
  parametry nastav --jidelna <id> --kod <kod> --hodnota <text>
```

- [ ] **Krok 4: Ověř typy a testy**

Spusť: `npm run typecheck && npm test`
Očekávej: obojí bez chyb.

- [ ] **Krok 5: Vyzkoušej příkaz nad ostrými daty (jen čtení)**

Spusť: `set -a && . ~/.cantinero/.env && set +a && npm run cli -- parametry`
Očekávej: čtyři parametry a pět jídelen, u všech hodnoty `—`.
**Migrace musí být předtím nasazená:** `npm run cli -- migrate`.

- [ ] **Krok 6: Commit**

```bash
git add src/cli.ts
git commit -m "feat: příkaz parametry — výpis a nastavení bez prohlížeče"
```

---

### Úkol 6: Datová vrstva aplikace

**Soubory:**
- Upravit: `app/src/data.ts`

**Rozhraní:**
- Poskytuje:
  - `interface ParametrNabidky { id: string; kod: string; nazev: string; druh: "cislo" | "text" | "ano_ne" | "vyber"; jednotka: string | null; moznosti: string[]; poradi: number }`
  - `nactiParametryProduktu(produktKod: string): Promise<ParametrNabidky[]>`
  - `nactiHodnotyNabidky(nabidkaId: string): Promise<Record<string, string>>`
  - `ulozHodnotuParametru(nabidkaId: string, parametrId: string, hodnota: string): Promise<void>`
  - `zavedParametrProduktu(v: { produktKod: string; kod: string; nazev: string; druh: string; jednotka: string | null; moznosti: string[] }): Promise<void>`
  - do `interface Jidelna` přibude `nabidka_id: string`

Aplikace nesmí sáhnout na `src/` v kořeni (Vercel instaluje jen závislosti
`app/`), proto se typ i kontroly opisují. Je to vědomá duplicita jednoho
tvaru dat, ne logiky.

**Past, na kterou si dej pozor:** `nactiHodnoty` v `src/parametry.ts` vrací
hodnoty pod **kódem** parametru, `nactiHodnotyNabidky` v aplikaci pod jeho
**id**. Není to nedopatření: příkazová řádka pracuje s kódem, který člověk
napíše, kdežto aplikace potřebuje id kvůli zápisu. Obojí se jmenuje
podobně, tak ať se nesplete — v aplikaci se sahá `hodnoty[p.id]`, v jádře
`hodnoty[p.kod]`.

- [ ] **Krok 1: Doplň typ jídelny**

V `app/src/data.ts` do `interface Jidelna` přidej:

```typescript
  /** Nabídka, na které visí parametry (migrace 0045). */
  nabidka_id: string;
```

A do dotazu v `nactiJidelny` přidej `nabidka_id` mezi vybírané sloupce.

- [ ] **Krok 2: Napiš funkce**

```typescript
export interface ParametrNabidky {
  id: string;
  kod: string;
  nazev: string;
  druh: "cislo" | "text" | "ano_ne" | "vyber";
  jednotka: string | null;
  moznosti: string[];
  poradi: number;
}

export async function nactiParametryProduktu(produktKod: string): Promise<ParametrNabidky[]> {
  const { data, error } = await supabase
    .from("parametry_nabidky")
    .select("id, kod, nazev, druh, jednotka, moznosti, poradi")
    .eq("produkt_kod", produktKod)
    .order("poradi");
  if (error) throw new Error(error.message);
  return (data ?? []) as ParametrNabidky[];
}

export async function nactiHodnotyNabidky(nabidkaId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("hodnoty_parametru")
    .select("parametr_id, hodnota")
    .eq("nabidka_id", nabidkaId);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((r) => [r.parametr_id, r.hodnota]));
}

/**
 * Zamítnutý zápis Supabase nehlásí jako chybu — jen změní nula řádků.
 * Proto `select` a kontrola počtu (past `zamitnuty-zapis-bez-chyby`).
 */
export async function ulozHodnotuParametru(
  nabidkaId: string,
  parametrId: string,
  hodnota: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("hodnoty_parametru")
    .upsert(
      { nabidka_id: nabidkaId, parametr_id: parametrId, hodnota, zmeneno_at: new Date().toISOString() },
      { onConflict: "nabidka_id,parametr_id" },
    )
    .select("parametr_id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Hodnotu se nepodařilo uložit — měnit ji smí jen admin.");
  }
}

export async function zavedParametrProduktu(v: {
  produktKod: string;
  kod: string;
  nazev: string;
  druh: string;
  jednotka: string | null;
  moznosti: string[];
}): Promise<void> {
  const { data, error } = await supabase
    .from("parametry_nabidky")
    .insert({
      produkt_kod: v.produktKod,
      kod: v.kod,
      nazev: v.nazev,
      druh: v.druh,
      jednotka: v.jednotka,
      moznosti: v.moznosti,
    })
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Parametr se nepodařilo zavést — zavádět je smí jen admin.");
  }
}
```

- [ ] **Krok 3: Ověř typy a sestavení**

Spusť: `npm run typecheck && npm run build --prefix app`
Očekávej: obojí bez chyb.

- [ ] **Krok 4: Commit**

```bash
git add app/src/data.ts
git commit -m "feat: aplikace umí načíst a uložit parametry nabídky"
```

---

### Úkol 7: Okno s parametry

**Soubory:**
- Vytvořit: `app/src/OknoParametru.tsx`
- Upravit: `app/src/styl.css` (jen doplnit třídy, existující neměnit)

**Rozhraní:**
- Spotřebovává: funkce z úkolu 6
- Poskytuje: `<OknoParametru jidelna={j} onZavri={() => void} onUlozeno={() => void} />`

- [ ] **Krok 1: Napiš komponentu**

```tsx
import { useEffect, useState } from "react";
import {
  nactiHodnotyNabidky,
  nactiParametryProduktu,
  ulozHodnotuParametru,
  type Jidelna,
  type ParametrNabidky,
} from "./data";

/**
 * Okno, ve kterém se vyplňují parametry nabídky.
 *
 * Proč okno, a ne políčka v řádku seznamu: parametrů může přibývat
 * (majitel si je zavádí sám) a u pátého by se řádek rozpadl. Vyžádal si to
 * majitel 18. 8. 2026.
 */

/** Seznam voleb se ukládá jako JSON pole — čárka by se rozbila na volbě s čárkou. */
function naSeznam(hodnota: string): string[] {
  if (!hodnota.trim()) return [];
  try {
    const x: unknown = JSON.parse(hodnota);
    return Array.isArray(x) ? x.map(String) : [];
  } catch {
    return [];
  }
}

interface Props {
  jidelna: Jidelna;
  onZavri: () => void;
  onUlozeno: () => void;
}

export function OknoParametru({ jidelna, onZavri, onUlozeno }: Props) {
  const [parametry, setParametry] = useState<ParametrNabidky[]>([]);
  const [hodnoty, setHodnoty] = useState<Record<string, string>>({});
  const [nacita, setNacita] = useState(true);
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  useEffect(() => {
    let platne = true;
    Promise.all([
      nactiParametryProduktu("cantinero"),
      nactiHodnotyNabidky(jidelna.nabidka_id),
    ])
      .then(([p, h]) => {
        if (!platne) return;
        setParametry(p);
        setHodnoty(h);
        setNacita(false);
      })
      .catch((e: Error) => {
        if (platne) {
          setChyba(e.message);
          setNacita(false);
        }
      });
    return () => {
      platne = false;
    };
  }, [jidelna.nabidka_id]);

  // Zavření klávesou Escape — okno leží přes stránku a myš není jediná cesta ven.
  useEffect(() => {
    function naKlavesu(e: KeyboardEvent) {
      if (e.key === "Escape") onZavri();
    }
    window.addEventListener("keydown", naKlavesu);
    return () => window.removeEventListener("keydown", naKlavesu);
  }, [onZavri]);

  function nastav(parametrId: string, hodnota: string) {
    setHodnoty((h) => ({ ...h, [parametrId]: hodnota }));
  }

  function prepniVolbu(p: ParametrNabidky, volba: string) {
    const vybrane = naSeznam(hodnoty[p.id] ?? "");
    const nove = vybrane.includes(volba)
      ? vybrane.filter((v) => v !== volba)
      : [...vybrane, volba];
    nastav(p.id, JSON.stringify(nove));
  }

  async function uloz() {
    setPracuje(true);
    setChyba(null);
    try {
      for (const p of parametry) {
        const h = hodnoty[p.id];
        if (h === undefined || h === "") continue;
        await ulozHodnotuParametru(jidelna.nabidka_id, p.id, h);
      }
      onUlozeno();
      onZavri();
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div className="zaclona" role="dialog" aria-modal="true" aria-label={`Parametry — ${jidelna.nazev}`}>
      <div className="dialog parametry">
        <h3>{jidelna.nazev}</h3>

        {nacita ? (
          <p className="nacitani">Načítám parametry…</p>
        ) : (
          <>
            {parametry.length === 0 && (
              <p className="poznamka">U tohohle produktu zatím není zaveden žádný parametr.</p>
            )}

            {parametry.map((p) => (
              <div className="parametr-radek" key={p.id}>
                <label htmlFor={`p-${p.id}`}>
                  {p.nazev}
                  {p.jednotka && <span className="poznamka"> ({p.jednotka})</span>}
                </label>

                {p.druh === "vyber" ? (
                  <div className="volby">
                    {p.moznosti.map((m) => {
                      const vybrano = naSeznam(hodnoty[p.id] ?? "").includes(m);
                      return (
                        <button
                          type="button"
                          key={m}
                          className={`volba ${vybrano ? "zap" : ""}`}
                          aria-pressed={vybrano}
                          disabled={pracuje}
                          onClick={() => prepniVolbu(p, m)}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                ) : p.druh === "ano_ne" ? (
                  <select
                    id={`p-${p.id}`}
                    value={hodnoty[p.id] ?? ""}
                    disabled={pracuje}
                    onChange={(e) => nastav(p.id, e.target.value)}
                  >
                    <option value="">neuvedeno</option>
                    <option value="ano">ano</option>
                    <option value="ne">ne</option>
                  </select>
                ) : (
                  <input
                    id={`p-${p.id}`}
                    type={p.druh === "cislo" ? "number" : "text"}
                    min={p.druh === "cislo" ? 0 : undefined}
                    value={hodnoty[p.id] ?? ""}
                    placeholder="neuvedeno"
                    disabled={pracuje}
                    onChange={(e) => nastav(p.id, e.target.value)}
                  />
                )}
              </div>
            ))}
          </>
        )}

        {chyba && (
          <p className="hlaska" role="alert">
            {chyba}
          </p>
        )}

        <p className="poznamka">
          Prázdné pole znamená „nevím“ — to není totéž co nula. Nevyplněný
          povinný údaj znamená, že se firmám od téhle jídelny nepošle nic.
        </p>

        <div className="tlacitka">
          <button className="tlacitko" disabled={pracuje || nacita} onClick={() => void uloz()}>
            Uložit
          </button>
          <button className="tlacitko tise" disabled={pracuje} onClick={onZavri}>
            Zrušit
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Krok 2: Doplň styly**

Na konec `app/src/styl.css`:

```css
/* ─────────────────────────────────────────────── parametry nabídky */

.dialog.parametry { max-width: 34rem; }

.parametr-radek {
  display: grid;
  grid-template-columns: 11rem 1fr;
  gap: var(--o2);
  align-items: center;
}

.parametr-radek > label { font-size: var(--t-drobny); }

.volby { display: flex; flex-wrap: wrap; gap: var(--o1); }

/* Stav nese barva i rámeček — samotná barva by v odstínech šedi zmizela. */
.volba {
  font: inherit;
  font-size: var(--t-drobny);
  padding: 0.15rem 0.55rem;
  border: 1px solid var(--linka);
  border-radius: var(--r);
  background: transparent;
  color: var(--inkoust-slaby);
  cursor: pointer;
}

.volba.zap {
  border-color: var(--zelen);
  background: var(--zelen-svetle);
  color: var(--zelen);
  font-weight: 600;
}

@media (max-width: 34rem) {
  .parametr-radek { grid-template-columns: 1fr; gap: var(--o1); }
}
```

**Pozor na názvy proměnných:** projekt má `--zelen` a `--zelen-svetle`, ne
`--zelena`. Překlep se neprojeví chybou — tlačítko prostě zůstane
neobarvené a vypadá to jako záměr. Nové barvy nezaváděj.

- [ ] **Krok 3: Ověř sestavení**

Spusť: `npm run typecheck && npm run build --prefix app`
Očekávej: bez chyb.

- [ ] **Krok 4: Commit**

```bash
git add app/src/OknoParametru.tsx app/src/styl.css
git commit -m "feat: okno s parametry nabídky u jídelny"
```

---

### Úkol 8: Sloupec se souhrnem a tlačítko Upravit

**Soubory:**
- Upravit: `app/src/Jidelny.tsx`

**Rozhraní:**
- Spotřebovává: `OknoParametru` z úkolu 7, funkce z úkolu 6

- [ ] **Krok 1: Přidej stav a načtení hodnot**

V `Jidelny.tsx` k ostatním `useState`:

```typescript
  /** Jídelna, jejíž parametry se právě upravují v okně. */
  const [parametryJidelny, setParametryJidelny] = useState<Jidelna | null>(null);
  const [parametry, setParametry] = useState<ParametrNabidky[]>([]);
  const [hodnoty, setHodnoty] = useState<Record<string, Record<string, string>>>({});
```

Do `obnov()` za načtení počtů v dosahu:

```typescript
        const p = await nactiParametryProduktu("cantinero");
        setParametry(p);
        const dvojice = await Promise.all(
          j.map(async (x) => [x.id, await nactiHodnotyNabidky(x.nabidka_id)] as const),
        );
        setHodnoty(Object.fromEntries(dvojice));
```

- [ ] **Krok 2: Napiš souhrn do jednoho řádku**

Nad `export function Jidelny`:

```typescript
/**
 * Krátký souhrn parametrů do seznamu — cena a kolik údajů je vyplněných.
 * Do seznamu patří jen tolik, aby bylo vidět, kde chybí práce; zbytek je
 * v okně.
 */
function souhrnParametru(
  parametry: ParametrNabidky[],
  hodnoty: Record<string, string> | undefined,
): { text: string; chybi: boolean } {
  if (parametry.length === 0) return { text: "—", chybi: false };
  const h = hodnoty ?? {};
  const vyplnenych = parametry.filter((p) => (h[p.id] ?? "") !== "").length;
  const cena = parametry.find((p) => p.kod === "cena_obeda");
  const cenaText = cena && h[cena.id] ? `${h[cena.id]} Kč · ` : "";
  return {
    text: `${cenaText}${vyplnenych} z ${parametry.length} vyplněno`,
    chybi: !cena || !h[cena.id],
  };
}
```

- [ ] **Krok 3: Přidej sloupec do tabulky**

Do `<thead>` mezi „Volná kapacita“ a prázdný sloupec:

```tsx
                  <th>Parametry nabídky</th>
```

Do `<tbody>` na tutéž pozici v řádku:

```tsx
                      <td>
                        {(() => {
                          const s = souhrnParametru(parametry, hodnoty[j.id]);
                          return (
                            <span className={`stav ${s.chybi ? "je-ceka" : "je-kvalifikovany"}`}>
                              <span className="znak" />
                              {s.text}
                            </span>
                          );
                        })()}
                      </td>
```

- [ ] **Krok 4: Přidej tlačítko a okno**

Do posledního sloupce k tlačítku „Změnit kapacitu“:

```tsx
                          <button
                            className="tlacitko tise"
                            disabled={pracuje}
                            onClick={() => setParametryJidelny(j)}
                          >
                            Upravit
                          </button>
```

A na konec návratové hodnoty, před uzavírací `</>`:

```tsx
      {parametryJidelny && (
        <OknoParametru
          jidelna={parametryJidelny}
          onZavri={() => setParametryJidelny(null)}
          onUlozeno={() => void obnov()}
        />
      )}
```

Doplň importy:

```typescript
import { OknoParametru } from "./OknoParametru";
import { nactiHodnotyNabidky, nactiParametryProduktu, type ParametrNabidky } from "./data";
```

- [ ] **Krok 5: Ověř sestavení**

Spusť: `npm run typecheck && npm run build --prefix app`
Očekávej: bez chyb.

- [ ] **Krok 6: Commit**

```bash
git add app/src/Jidelny.tsx
git commit -m "feat: seznam jídelen ukazuje parametry a otevírá okno k úpravě"
```

---

### Úkol 9: Zavedení parametru z okna

**Soubory:**
- Upravit: `app/src/OknoParametru.tsx`

**Rozhraní:**
- Spotřebovává: `zavedParametrProduktu` z úkolu 6

- [ ] **Krok 1: Přidej formulář**

Do `OknoParametru.tsx` doplň stav:

```typescript
  const [pridava, setPridava] = useState(false);
  const [novy, setNovy] = useState({ nazev: "", druh: "cislo", jednotka: "", moznosti: "" });
```

Funkci pro kód z názvu (tentýž tvar jako `kodZNazvu` v `src/parametry.ts` —
opsaný schválně, aplikace nesmí sahat do kořenových zdrojů):

```typescript
function kodZNazvu(nazev: string): string {
  return nazev
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
```

A obsluhu:

```typescript
  async function pridej() {
    setPracuje(true);
    setChyba(null);
    try {
      const moznosti = novy.moznosti
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      if (novy.druh === "vyber" && moznosti.length === 0) {
        throw new Error("Výběr z možností potřebuje aspoň jednu možnost — každou na svůj řádek.");
      }
      await zavedParametrProduktu({
        produktKod: "cantinero",
        kod: kodZNazvu(novy.nazev),
        nazev: novy.nazev.trim(),
        druh: novy.druh,
        jednotka: novy.jednotka.trim() || null,
        moznosti,
      });
      setParametry(await nactiParametryProduktu("cantinero"));
      setPridava(false);
      setNovy({ nazev: "", druh: "cislo", jednotka: "", moznosti: "" });
    } catch (e) {
      setChyba((e as Error).message);
    } finally {
      setPracuje(false);
    }
  }
```

- [ ] **Krok 2: Vykresli formulář**

Před `<div className="tlacitka">`:

```tsx
        {pridava ? (
          <div className="novy-parametr">
            <div className="parametr-radek">
              <label htmlFor="np-nazev">Název</label>
              <input
                id="np-nazev"
                value={novy.nazev}
                placeholder="Rozvoz zdarma od"
                disabled={pracuje}
                onChange={(e) => setNovy({ ...novy, nazev: e.target.value })}
              />
            </div>
            <div className="parametr-radek">
              <label htmlFor="np-druh">Druh údaje</label>
              <select
                id="np-druh"
                value={novy.druh}
                disabled={pracuje}
                onChange={(e) => setNovy({ ...novy, druh: e.target.value })}
              >
                <option value="cislo">číslo</option>
                <option value="text">text</option>
                <option value="ano_ne">ano / ne</option>
                <option value="vyber">výběr z možností</option>
              </select>
            </div>
            {novy.druh === "cislo" && (
              <div className="parametr-radek">
                <label htmlFor="np-jednotka">Jednotka</label>
                <input
                  id="np-jednotka"
                  value={novy.jednotka}
                  placeholder="Kč"
                  disabled={pracuje}
                  onChange={(e) => setNovy({ ...novy, jednotka: e.target.value })}
                />
              </div>
            )}
            {novy.druh === "vyber" && (
              <div className="parametr-radek">
                <label htmlFor="np-moznosti">Možnosti</label>
                <textarea
                  id="np-moznosti"
                  rows={4}
                  value={novy.moznosti}
                  placeholder={"každou na svůj řádek"}
                  disabled={pracuje}
                  onChange={(e) => setNovy({ ...novy, moznosti: e.target.value })}
                />
              </div>
            )}
            <div className="tlacitka">
              <button className="tlacitko" disabled={pracuje || !novy.nazev.trim()} onClick={() => void pridej()}>
                Přidat
              </button>
              <button className="tlacitko tise" disabled={pracuje} onClick={() => setPridava(false)}>
                Zrušit
              </button>
            </div>
          </div>
        ) : (
          <button className="jako-odkaz" disabled={pracuje} onClick={() => setPridava(true)}>
            + Přidat parametr
          </button>
        )}
```

Doplň import `zavedParametrProduktu` do seznamu z `./data`.

- [ ] **Krok 3: Ověř sestavení**

Spusť: `npm run typecheck && npm run build --prefix app`
Očekávej: bez chyb.

- [ ] **Krok 4: Commit**

```bash
git add app/src/OknoParametru.tsx
git commit -m "feat: nový parametr se zavádí přímo z okna u jídelny"
```

---

### Úkol 10: Nasazení a proklikání

**Soubory:** žádné (ověřovací úkol)

- [ ] **Krok 1: Nasaď migraci na ostrá data**

Spusť: `set -a && . ~/.cantinero/.env && set +a && npm run cli -- migrate`
Očekávej: 0045 nasazená.

- [ ] **Krok 2: Ověř převod jídelen na nabídky**

Spusť: `set -a && . ~/.cantinero/.env && set +a && npm run cli -- parametry`
Očekávej: čtyři parametry a **pět jídelen, každá se svou nabídkou**
(žádná bez). Kdyby některá chyběla, převod v migraci pároval podle názvu —
zkontroluj duplicitní názvy jídelen.

- [ ] **Krok 3: Proklikej obrazovku v prohlížeči**

Zelené testy nejsou hotová obrazovka (past
`zelene-testy-nejsou-hotova-obrazovka`). Požádej majitele o přihlášení
a projdi:

1. Seznam ukazuje sloupec „Parametry nabídky“, u všech jídelen zatím
   „0 ze 4 vyplněno“ a stav „čeká“.
2. Tlačítko *Upravit* otevře okno; Escape i *Zrušit* ho zavřou beze změny.
3. Vyplnění ceny a uložení se projeví v seznamu bez ručního obnovení.
4. Do čísla nejde uložit slovo a hláška to řekne česky.
5. Volby výdeje jdou zapnout a vypnout a přežijí zavření a otevření okna.
6. *Přidat parametr* zavede nový parametr a ten se hned objeví v okně.
7. Uživatel bez práv admina tlačítko *Upravit* nevidí.

- [ ] **Krok 4: Nech majitele doplnit data**

Řekni majiteli, že může vyplnit ceny, provize a možnosti výdeje. Bez toho
nemá druhá dodávka co ukazovat.

- [ ] **Krok 5: Zapiš do paměti**

Do `_claude/memory/context/project-context.md` doplň, že první dodávka je
hotová a co je v datech. Nový záznam do `memory/decisions/` **nepiš** —
rozhodnutí už jsou zapsaná v `cena-v-osloveni` a
`jedna-sablona-a-uplnost-blokuje`. Pokud se cestou najde past, patří do
`memory/patterns/`.

Spusť `node .claude/hooks/reindex.cjs`, pak commit a push.

---

## Co tahle dodávka nedělá

- **Nemění text mailu ani šablonu.** Pole `[cena]` se z parametrů začne
  plnit až ve druhé dodávce.
- **Nevyřazuje firmy z kampaně.** To je taky druhá dodávka.
- **Nezavádí `pole_sablony` ani `nastaveni_pole`** — tabulky ze zadání,
  na které dojde ve druhé a třetí dodávce.
- **Nedotýká se odesílání.** Zůstává vypnuté (TP-8).
