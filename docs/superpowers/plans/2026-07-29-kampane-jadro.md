# Kampaně — jádro (bez obrazovky) · plán implementace

> **Pro agentní pracovníky:** POVINNÝ PODSKILL: použij
> `superpowers:subagent-driven-development` (doporučeno) nebo
> `superpowers:executing-plans` a jeď úkol po úkolu. Kroky mají zaškrtávátka
> (`- [ ]`) na sledování postupu.

**Cíl:** Kampaň jako pojmenovaný seznam firem — vznik, stavy, seznam firem,
fronta požadavků na průzkum a příkazy do CLI. Bez obrazovky, bez odesílání.

**Architektura:** Nová migrace `0018` přidá tři tabulky (`kampane`,
`kampan_firmy`, `pruzkumy`), pravidla přístupu ve stylu migrace 0016
a spoušť, která hlídá podmínky schválení. Doménová logika ve dvou
soustředěných modulech: `src/kampan.ts` (kampaň a její firmy) a
`src/pruzkum.ts` (fronta požadavků). CLI je jen tenká slupka nad nimi.

**Zadání:** `docs/superpowers/specs/2026-07-29-kampane-design.md`.
Při rozporu platí zadání; při rozporu se zadáním platí `SPEC.md`.

**Technologie:** TypeScript (ESM, přípona `.js` v importech), PGlite pro
testy, Postgres/Supabase v provozu, vitest.

## Globální omezení

- **Nic se neodesílá.** V tomto plánu nevzniká kód, který by odesílal,
  skládal text zprávy nebo sahal na `system_state.sending_enabled` (TP-8).
- **Stavy `bezi` a `uzavrena` jsou v číselníku, ale žádný kód je nenastavuje.**
  Jsou tam, aby se schéma kvůli fázi 3 nemuselo měnit.
- **Testy běží offline nad PGlite, bez proměnných prostředí.** `npm test`
  musí projít vždy.
- **Jazyk:** čeština v komentářích, dokumentaci i commit messages;
  identifikátory česky bez diakritiky (`zalozKampan`).
- **Migrace se jen přidávají.** Soubory 0001–0017 se needitují.
- **Repository vrstva se neobchází** — žádné přímé INSERTy do `companies`
  ani `contacts`.

---

## Struktura souborů

| soubor | odpovědnost |
|---|---|
| `supabase/migrations/0018_kampane.sql` | tabulky, indexy, pravidla přístupu, spoušť schválení |
| `src/kampan.ts` | kampaň: vznik, stavy, firmy v ní, souhrn, překryv |
| `src/pruzkum.ts` | fronta požadavků na průzkum území |
| `src/cli.ts` (úprava) | příkazy `kampan` a `pruzkum` |
| `test/kampan.test.ts` | kampaň a její firmy |
| `test/kampan-schvaleni.test.ts` | přechody stavů a pojistky schválení |
| `test/pruzkum.test.ts` | fronta požadavků |

Proč dva moduly a tři testy: kampaň a fronta jsou dvě různé věci s vlastním
životním cyklem, a přechody stavů mají dost pravidel na to, aby si zasloužily
vlastní soubor s testy. Kdyby to bylo v jednom, nikdo se v tom nevyzná.

---

## Úkol 1: Migrace — tabulky, pravidla, spoušť

**Soubory:**
- Vytvořit: `supabase/migrations/0018_kampane.sql`
- Test: `test/kampan.test.ts` (jen první test, zbytek přidají další úkoly)

**Rozhraní:**
- Spotřebovává: `oblasti`, `jidelny`, `companies`, `contacts`, `agent_runs`
  (migrace 0001–0011), funkci `nastav_updated_at()` (0001) a
  `public.role_uzivatele()` (0016).
- Poskytuje: tabulky `kampane`, `kampan_firmy`, `pruzkumy`.

- [ ] **Krok 1: Napiš padající test**

`test/kampan.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("schéma kampaní", () => {
  it("název kampaně je jedinečný bez ohledu na velikost písmen", async () => {
    await db.query("insert into kampane (nazev, spravce) values ($1,$2)", [
      "Západní Čechy", "laub@cantinero.cz",
    ]);
    await expect(
      db.query("insert into kampane (nazev, spravce) values ($1,$2)", [
        "západní čechy", "laub@cantinero.cz",
      ]),
    ).rejects.toThrow();
  });

  it("zrušení bez důvodu neprojde", async () => {
    await expect(
      db.query("insert into kampane (nazev, spravce, stav) values ($1,$2,'zrusena')", [
        "Bez důvodu", "laub@cantinero.cz",
      ]),
    ).rejects.toThrow();
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/kampan.test.ts`
Čekej: FAIL — `relation "kampane" does not exist`.

- [ ] **Krok 3: Napiš migraci**

`supabase/migrations/0018_kampane.sql`:

```sql
-- Kampaň = pojmenovaný seznam firem s vlastním kontextem.
--
-- NENÍ to rozesílka. SPEC kap. 10.2 kampaňový režim zrušil („individuální
-- oslovení, ne kampaň"); kampaň je tu seznam práce, ze kterého ve fázi 3
-- odchází oslovení po jedné firmě. Zadání:
-- docs/superpowers/specs/2026-07-29-kampane-design.md

create table kampane (
  id uuid primary key default gen_random_uuid(),
  nazev text not null,
  popis text,
  -- Čím se kampaň liší. Podklad pro člověka, ne šablona zprávy.
  kontext text,
  spravce text not null,
  -- Území, ze kterého kampaň vychází. `restrict`, aby se oblast nedala
  -- smazat zpod nohou kampani, která na ní stojí.
  oblast_id uuid references oblasti(id) on delete restrict,
  jidelna_id uuid references jidelny(id) on delete set null,
  stav text not null default 'rozpracovana' check (stav in (
    'rozpracovana', 'ceka_na_pruzkum', 'k_posouzeni',
    'schvalena', 'bezi', 'uzavrena', 'zrusena')),
  -- Na kterém kroku průvodce se skončilo, aby se dalo navázat.
  krok int not null default 1 check (krok between 1 and 4),
  duvod_zruseni text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zruseni_ma_duvod check (stav <> 'zrusena' or duvod_zruseni is not null)
);

-- Jedinečnost hlídá databáze, ne formulář: dva lidé mohou zakládat naráz.
create unique index kampane_nazev_idx on kampane (lower(nazev));

create trigger kampane_updated_at before update on kampane
  for each row execute function nastav_updated_at();

create table kampan_firmy (
  kampan_id uuid not null references kampane(id) on delete cascade,
  ico text not null references companies(ico) on delete cascade,
  stav text not null default 'vybrana' check (stav in ('vybrana', 'vyrazena')),
  duvod_vyrazeni text,
  zaradeno_at timestamptz not null default now(),
  primary key (kampan_id, ico),
  -- Stejně jako u deníku vyřazení při sběru: bez důvodu se pravidla nebrousí.
  constraint vyrazeni_ma_duvod check (stav <> 'vyrazena' or duvod_vyrazeni is not null)
);

create index kampan_firmy_kampan_idx on kampan_firmy (kampan_id);

-- Fronta objednávek průzkumu. Aplikace agenta spustit neumí (běží v Claude
-- Code, ne na serveru), takže si ho objedná a agent si práci vyzvedne.
-- `pruzkumy` je objednávka, `agent_runs` provedení — jedna objednávka může
-- mít i víc pokusů.
create table pruzkumy (
  id uuid primary key default gen_random_uuid(),
  oblast_id uuid not null references oblasti(id) on delete cascade,
  kampan_id uuid references kampane(id) on delete set null,
  stav text not null default 'ceka' check (stav in ('ceka', 'bezi', 'hotovo', 'selhalo')),
  pozadal text not null,
  pozadano_at timestamptz not null default now(),
  zahajeno_at timestamptz,
  dokonceno_at timestamptz,
  run_id uuid references agent_runs(id),
  firem_prevzato int,
  firem_novych int,
  chyba text,
  constraint selhani_ma_chybu check (stav <> 'selhalo' or chyba is not null)
);

create index pruzkumy_fronta_idx on pruzkumy (stav, pozadano_at);

-- ─────────────────────────────────────────── pojistky u schválení
--
-- Prostá podmínka (`check`) na tohle nestačí — musí se koukat do jiných
-- tabulek. Formulář tlačítko zašedne dřív, ale to je pohodlí, ne pojistka.

create or replace function public.kampan_pred_schvalenim() returns trigger
language plpgsql
as $$
begin
  if new.stav = 'schvalena' and old.stav is distinct from 'schvalena' then
    if exists (
      select 1 from pruzkumy p
      where p.kampan_id = new.id and p.stav in ('ceka', 'bezi')
    ) then
      raise exception 'Kampaň nejde schválit, dokud neproběhl objednaný průzkum';
    end if;

    if not exists (
      select 1 from kampan_firmy kf
      join contacts c on c.ico = kf.ico
      where kf.kampan_id = new.id and kf.stav = 'vybrana'
    ) then
      raise exception 'Kampaň nejde schválit bez jediné firmy s doloženým kontaktem';
    end if;
  end if;
  return new;
end $$;

create trigger kampan_schvaleni before update on kampane
  for each row execute function public.kampan_pred_schvalenim();

-- ─────────────────────────────────────────── kdo co smí
--
-- Ve stylu migrace 0016. Čtení kdokoli přihlášený, zápis tým.
-- Schválit smí jen admin a výš — je to brána, za kterou ve fázi 3 začne
-- odcházet komunikace ven. Pravidlo se dá zapsat přes `with check`, protože
-- to kouká na výslednou podobu řádku.

alter table kampane enable row level security;
alter table kampan_firmy enable row level security;
alter table pruzkumy enable row level security;

create policy kampane_cteni on kampane
  for select to authenticated using (true);

create policy kampane_zapis on kampane
  for all to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'))
  with check (
    public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel')
    and (stav <> 'schvalena' or public.role_uzivatele() in ('super-admin', 'admin'))
  );

create policy kampan_firmy_cteni on kampan_firmy
  for select to authenticated using (true);

create policy kampan_firmy_zapis on kampan_firmy
  for all to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'))
  with check (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'));

create policy pruzkumy_cteni on pruzkumy
  for select to authenticated using (true);

create policy pruzkumy_zapis on pruzkumy
  for all to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'))
  with check (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'));

comment on table kampane is
  'Pojmenovaný seznam firem s kontextem. Není to rozesílka — SPEC kap. 10.2.';
```

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/kampan.test.ts`
Čekej: PASS, 2 testy.

- [ ] **Krok 5: Ověř, že nic jiného nespadlo**

Spusť: `npm test`
Čekej: PASS, 266 testů (264 + 2 nové).

- [ ] **Krok 6: Commit**

```bash
git add supabase/migrations/0018_kampane.sql test/kampan.test.ts
git commit -m "feat: schéma kampaní, fronty průzkumů a pojistek u schválení"
```

---

## Úkol 2: Vznik kampaně a čtení

**Soubory:**
- Vytvořit: `src/kampan.ts`
- Upravit: `test/kampan.test.ts`

**Rozhraní:**
- Spotřebovává: `Db` z `src/db.js`.
- Poskytuje: typ `StavKampane`, rozhraní `Kampan`, funkce `zalozKampan`,
  `nactiKampan`, `seznamKampani`, `nastavUzemi`.

- [ ] **Krok 1: Napiš padající testy**

Přidej do `test/kampan.test.ts`:

```ts
import { nactiKampan, seznamKampani, zalozKampan } from "../src/kampan.js";

describe("založení kampaně", () => {
  it("založí a přečte kampaň ve výchozím stavu", async () => {
    const id = await zalozKampan(db, {
      nazev: "Vary — kapacita od srpna",
      spravce: "laub@cantinero.cz",
      kontext: "Jídelna ve Varech nabízí 30 obědů od srpna.",
    });
    const k = await nactiKampan(db, id);
    expect(k?.nazev).toBe("Vary — kapacita od srpna");
    expect(k?.stav).toBe("rozpracovana");
    expect(k?.krok).toBe(1);
    expect(k?.oblastId).toBeNull();
  });

  it("neznámé id vrátí null, ne výjimku", async () => {
    expect(await nactiKampan(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("seznam vrací nejnovější první", async () => {
    await zalozKampan(db, { nazev: "První", spravce: "a@b.cz" });
    await zalozKampan(db, { nazev: "Druhá", spravce: "a@b.cz" });
    const seznam = await seznamKampani(db);
    expect(seznam.map((k) => k.nazev)).toEqual(["Druhá", "První"]);
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/kampan.test.ts`
Čekej: FAIL — `Cannot find module '../src/kampan.js'`.

- [ ] **Krok 3: Napiš `src/kampan.ts`**

```ts
/**
 * Kampaň — pojmenovaný seznam firem s vlastním kontextem.
 *
 * **Není to rozesílka.** SPEC kap. 10.2 kampaňový režim zrušil; kampaň je
 * seznam práce, ze kterého ve fázi 3 odchází oslovení po jedné firmě.
 * V tomto modulu proto nikdy nesmí přibýt nic, co skládá nebo odesílá zprávy.
 */
import type { Db } from "./db.js";

export type StavKampane =
  | "rozpracovana"
  | "ceka_na_pruzkum"
  | "k_posouzeni"
  | "schvalena"
  | "bezi"
  | "uzavrena"
  | "zrusena";

export interface Kampan {
  id: string;
  nazev: string;
  popis: string | null;
  kontext: string | null;
  spravce: string;
  oblastId: string | null;
  jidelnaId: string | null;
  stav: StavKampane;
  krok: number;
  duvodZruseni: string | null;
}

const SLOUPCE = `id, nazev, popis, kontext, spravce,
  oblast_id as "oblastId", jidelna_id as "jidelnaId",
  stav, krok, duvod_zruseni as "duvodZruseni"`;

export async function zalozKampan(
  db: Db,
  v: { nazev: string; spravce: string; popis?: string; kontext?: string },
): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into kampane (nazev, spravce, popis, kontext)
     values ($1,$2,$3,$4) returning id`,
    [v.nazev, v.spravce, v.popis ?? null, v.kontext ?? null],
  );
  return r[0]!.id;
}

export async function nactiKampan(db: Db, id: string): Promise<Kampan | null> {
  const r = await db.query<Kampan>(`select ${SLOUPCE} from kampane where id = $1`, [id]);
  return r[0] ?? null;
}

export async function seznamKampani(db: Db): Promise<Kampan[]> {
  return db.query<Kampan>(`select ${SLOUPCE} from kampane order by created_at desc`);
}

/**
 * Přiřadí kampani území. Jídelna je nepovinná ze stejného důvodu jako
 * u oblasti — může se doplnit až po jednání.
 */
export async function nastavUzemi(
  db: Db,
  kampanId: string,
  v: { oblastId: string; jidelnaId?: string | null },
): Promise<void> {
  await db.query(
    `update kampane set oblast_id = $1, jidelna_id = $2, krok = greatest(krok, 2)
     where id = $3`,
    [v.oblastId, v.jidelnaId ?? null, kampanId],
  );
}
```

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/kampan.test.ts`
Čekej: PASS.

- [ ] **Krok 5: Commit**

```bash
git add src/kampan.ts test/kampan.test.ts
git commit -m "feat: vznik a čtení kampaně"
```

---

## Úkol 3: Firmy v kampani

**Soubory:**
- Upravit: `src/kampan.ts`
- Upravit: `test/kampan.test.ts`

**Rozhraní:**
- Spotřebovává: `prepocitejOblastFirmy` a `zalozOblast` z `src/oblast.js`,
  `zalozFirmu`, `nastavGeo` z `src/repo.js`.
- Poskytuje: `naplnZOblasti(db, kampanId) → { pridano, jizBylo }`,
  `vyradFirmu(db, kampanId, ico, duvod)`, `firmyKampane(db, kampanId)`.

- [ ] **Krok 1: Napiš padající testy**

Přidej do `test/kampan.test.ts` (doplň i importy nahoře):

```ts
import { zalozOblast } from "../src/oblast.js";
import { nastavGeo, zalozFirmu } from "../src/repo.js";
import { firmyKampane, naplnZOblasti, nastavUzemi, vyradFirmu } from "../src/kampan.js";
import type { AresZaznam } from "../src/ares.js";

const STRED = { lat: 49.6, lng: 13.2 };
const severne = (m: number) => ({ lat: STRED.lat + m / 111_320, lng: STRED.lng });

const zaznam = (ico: string, nazev: string): AresZaznam => ({
  ico, nazev, adresa: "x", obec: "Zbůch", czNace: ["25610"],
  velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
});

/** Založí dvě firmy uvnitř a jednu daleko, a k tomu kruhovou oblast 3 km. */
async function pripravUzemi(): Promise<string> {
  for (const [ico, nazev, m] of [
    ["25232657", "Blízká s.r.o.", 500],
    ["48362956", "Prostřední s.r.o.", 2000],
    ["17439523", "Daleká s.r.o.", 9000],
  ] as const) {
    await zalozFirmu(db, zaznam(ico, nazev));
    const p = severne(m);
    // `jidelnaId` je v GeoVstup povinné, ale tyhle firmy k žádné jídelně
    // nepatří. Stejný obrat používá test/oblast-db.test.ts.
    await nastavGeo(db, ico, {
      lat: p.lat, lng: p.lng, jidelnaId: null as unknown as string,
      vzdalenostM: m, vZone: true,
    });
  }
  return zalozOblast(db, {
    nazev: "Zkušební", oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
  });
}

describe("firmy v kampani", () => {
  it("naplní se z oblasti jen firmy uvnitř", async () => {
    const oblastId = await pripravUzemi();
    const id = await zalozKampan(db, { nazev: "K1", spravce: "a@b.cz" });
    await nastavUzemi(db, id, { oblastId });

    const vysledek = await naplnZOblasti(db, id);
    expect(vysledek.pridano).toBe(2);
    expect(vysledek.jizBylo).toBe(0);

    const firmy = await firmyKampane(db, id);
    expect(firmy.map((f) => f.ico).sort()).toEqual(["25232657", "48362956"]);
  });

  it("vyřazená firma zůstane vyřazená i po doplnění nových", async () => {
    // Regrese: naplnit znovu nesmí vzkřísit ručně vyřazenou firmu.
    const oblastId = await pripravUzemi();
    const id = await zalozKampan(db, { nazev: "K2", spravce: "a@b.cz" });
    await nastavUzemi(db, id, { oblastId });
    await naplnZOblasti(db, id);

    await vyradFirmu(db, id, "25232657", "má vlastní jídelnu");

    const znovu = await naplnZOblasti(db, id);
    expect(znovu.pridano).toBe(0);
    expect(znovu.jizBylo).toBe(2);

    const firmy = await firmyKampane(db, id);
    const vyrazena = firmy.find((f) => f.ico === "25232657");
    expect(vyrazena?.stav).toBe("vyrazena");
    expect(vyrazena?.duvodVyrazeni).toBe("má vlastní jídelnu");
  });

  it("vyřazení bez důvodu neprojde", async () => {
    const oblastId = await pripravUzemi();
    const id = await zalozKampan(db, { nazev: "K3", spravce: "a@b.cz" });
    await nastavUzemi(db, id, { oblastId });
    await naplnZOblasti(db, id);
    await expect(vyradFirmu(db, id, "25232657", "  ")).rejects.toThrow();
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/kampan.test.ts`
Čekej: FAIL — `naplnZOblasti is not a function`.

- [ ] **Krok 3: Doplň do `src/kampan.ts`**

```ts
import { prepocitejOblastFirmy } from "./oblast.js";

export interface FirmaVKampani {
  ico: string;
  nazev: string;
  obec: string | null;
  stav: "vybrana" | "vyrazena";
  duvodVyrazeni: string | null;
  kontaktu: number;
  skore: number | null;
}

/**
 * Doplní do kampaně firmy, které leží v její oblasti.
 *
 * **Ručně vyřazené firmy se nevzkřísí** — `on conflict do nothing`. Bez toho
 * by každé doplnění vrátilo zpátky všechno, co člověk vyhodil, a rozhodnutí
 * by tiše mizela.
 *
 * Příslušnost se před vložením přepočítá, aby se nevycházelo ze zastaralého
 * seznamu.
 */
export async function naplnZOblasti(
  db: Db,
  kampanId: string,
): Promise<{ pridano: number; jizBylo: number }> {
  const k = await nactiKampan(db, kampanId);
  if (!k?.oblastId) return { pridano: 0, jizBylo: 0 };

  await prepocitejOblastFirmy(db, k.oblastId);

  const pred = await pocetRadku(db, kampanId);
  await db.query(
    `insert into kampan_firmy (kampan_id, ico)
     select $1, of.ico from oblast_firmy of where of.oblast_id = $2
     on conflict (kampan_id, ico) do nothing`,
    [kampanId, k.oblastId],
  );
  const po = await pocetRadku(db, kampanId);
  return { pridano: po - pred, jizBylo: pred };
}

async function pocetRadku(db: Db, kampanId: string): Promise<number> {
  const r = await db.query<{ pocet: number }>(
    "select count(*)::int as pocet from kampan_firmy where kampan_id = $1",
    [kampanId],
  );
  return r[0]?.pocet ?? 0;
}

/** Vyřadí firmu z kampaně. Důvod je povinný — bez něj se pravidla nebrousí. */
export async function vyradFirmu(
  db: Db,
  kampanId: string,
  ico: string,
  duvod: string,
): Promise<void> {
  if (!duvod.trim()) throw new Error("Vyřazení firmy potřebuje důvod.");
  await db.query(
    `update kampan_firmy set stav = 'vyrazena', duvod_vyrazeni = $1
     where kampan_id = $2 and ico = $3`,
    [duvod.trim(), kampanId, ico],
  );
}

export async function firmyKampane(db: Db, kampanId: string): Promise<FirmaVKampani[]> {
  return db.query<FirmaVKampani>(
    `select kf.ico, c.nazev, c.obec, kf.stav,
            kf.duvod_vyrazeni as "duvodVyrazeni", c.skore,
            (select count(*)::int from contacts k where k.ico = kf.ico) as kontaktu
     from kampan_firmy kf
     join companies c on c.ico = kf.ico
     where kf.kampan_id = $1
     order by c.skore desc nulls last`,
    [kampanId],
  );
}
```

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/kampan.test.ts`
Čekej: PASS.

- [ ] **Krok 5: Commit**

```bash
git add src/kampan.ts test/kampan.test.ts
git commit -m "feat: seznam firem v kampani, vyřazení s důvodem"
```

---

## Úkol 4: Fronta požadavků na průzkum

**Soubory:**
- Vytvořit: `src/pruzkum.ts`
- Vytvořit: `test/pruzkum.test.ts`

**Rozhraní:**
- Spotřebovává: `Db`, tabulku `pruzkumy` z úkolu 1.
- Poskytuje: `objednejPruzkum`, `dalsiPruzkum`, `zahajPruzkum`,
  `dokoncPruzkum`, `selhalPruzkum`, `nedokonceneProKampan`.

- [ ] **Krok 1: Napiš padající testy**

`test/pruzkum.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozOblast } from "../src/oblast.js";
import {
  dalsiPruzkum, dokoncPruzkum, nedokonceneProKampan, objednejPruzkum,
  selhalPruzkum, zahajPruzkum,
} from "../src/pruzkum.js";
import { zalozKampan } from "../src/kampan.js";

let db: Db;
let oblastId: string;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  oblastId = await zalozOblast(db, {
    nazev: "Území", oblast: { typ: "kruh", stred: { lat: 49.6, lng: 13.2 }, polomerM: 3000 },
  });
});

describe("fronta průzkumů", () => {
  it("objednávka čeká a dá se vyzvednout", async () => {
    const id = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    const dalsi = await dalsiPruzkum(db);
    expect(dalsi?.id).toBe(id);
    expect(dalsi?.stav).toBe("ceka");
  });

  it("vyzvedává se nejstarší objednávka první", async () => {
    const prvni = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    expect((await dalsiPruzkum(db))?.id).toBe(prvni);
  });

  it("zahájená objednávka se už nevyzvedne podruhé", async () => {
    // Jinak by dva běhy agenta dělaly tutéž práci.
    const id = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    await zahajPruzkum(db, id);
    expect(await dalsiPruzkum(db)).toBeNull();
  });

  it("dokončení zapíše počty a uzavře objednávku", async () => {
    const id = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    await zahajPruzkum(db, id);
    await dokoncPruzkum(db, id, { firemPrevzato: 12, firemNovych: 3 });
    const r = await db.query<{ stav: string; firem_novych: number }>(
      "select stav, firem_novych from pruzkumy where id = $1", [id],
    );
    expect(r[0]?.stav).toBe("hotovo");
    expect(r[0]?.firem_novych).toBe(3);
  });

  it("selhání bez popisu chyby neprojde", async () => {
    const id = await objednejPruzkum(db, { oblastId, pozadal: "a@b.cz" });
    await expect(selhalPruzkum(db, id, "  ")).rejects.toThrow();
  });

  it("spočítá nedokončené objednávky kampaně", async () => {
    const kampanId = await zalozKampan(db, { nazev: "K", spravce: "a@b.cz" });
    await objednejPruzkum(db, { oblastId, kampanId, pozadal: "a@b.cz" });
    expect(await nedokonceneProKampan(db, kampanId)).toBe(1);

    const id = await objednejPruzkum(db, { oblastId, kampanId, pozadal: "a@b.cz" });
    await zahajPruzkum(db, id);
    await dokoncPruzkum(db, id, { firemPrevzato: 0, firemNovych: 0 });
    expect(await nedokonceneProKampan(db, kampanId)).toBe(1);
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/pruzkum.test.ts`
Čekej: FAIL — `Cannot find module '../src/pruzkum.js'`.

- [ ] **Krok 3: Napiš `src/pruzkum.ts`**

```ts
/**
 * Fronta objednávek na průzkum území.
 *
 * Aplikace agenta spustit neumí — běží v Claude Code na předplatném
 * uživatele, ne na serveru (ADR 0001). Objedná si ho tedy tudy a agent si
 * práci vyzvedne, až ho někdo pustí.
 *
 * `pruzkumy` je objednávka, `agent_runs` provedení. Jedna objednávka může
 * mít i víc pokusů, proto se `run_id` zapisuje až při zahájení.
 */
import type { Db } from "./db.js";

export type StavPruzkumu = "ceka" | "bezi" | "hotovo" | "selhalo";

export interface Pruzkum {
  id: string;
  oblastId: string;
  kampanId: string | null;
  stav: StavPruzkumu;
  pozadal: string;
}

const SLOUPCE = `id, oblast_id as "oblastId", kampan_id as "kampanId", stav, pozadal`;

export async function objednejPruzkum(
  db: Db,
  v: { oblastId: string; kampanId?: string; pozadal: string },
): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into pruzkumy (oblast_id, kampan_id, pozadal) values ($1,$2,$3) returning id`,
    [v.oblastId, v.kampanId ?? null, v.pozadal],
  );
  return r[0]!.id;
}

/** Nejstarší čekající objednávka, nebo null. Zahájené se už nevydávají. */
export async function dalsiPruzkum(db: Db): Promise<Pruzkum | null> {
  const r = await db.query<Pruzkum>(
    `select ${SLOUPCE} from pruzkumy where stav = 'ceka'
     order by pozadano_at limit 1`,
  );
  return r[0] ?? null;
}

export async function zahajPruzkum(db: Db, id: string, runId?: string): Promise<void> {
  await db.query(
    `update pruzkumy set stav = 'bezi', zahajeno_at = now(), run_id = $1
     where id = $2 and stav = 'ceka'`,
    [runId ?? null, id],
  );
}

export async function dokoncPruzkum(
  db: Db,
  id: string,
  v: { firemPrevzato: number; firemNovych: number },
): Promise<void> {
  await db.query(
    `update pruzkumy set stav = 'hotovo', dokonceno_at = now(),
            firem_prevzato = $1, firem_novych = $2
     where id = $3`,
    [v.firemPrevzato, v.firemNovych, id],
  );
}

/** Selhání se zapisuje s popisem — bez něj se nedá poznat, co opravit. */
export async function selhalPruzkum(db: Db, id: string, chyba: string): Promise<void> {
  if (!chyba.trim()) throw new Error("Neúspěšný průzkum potřebuje popis chyby.");
  await db.query(
    `update pruzkumy set stav = 'selhalo', dokonceno_at = now(), chyba = $1 where id = $2`,
    [chyba.trim(), id],
  );
}

export async function nedokonceneProKampan(db: Db, kampanId: string): Promise<number> {
  const r = await db.query<{ pocet: number }>(
    `select count(*)::int as pocet from pruzkumy
     where kampan_id = $1 and stav in ('ceka','bezi')`,
    [kampanId],
  );
  return r[0]?.pocet ?? 0;
}
```

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/pruzkum.test.ts`
Čekej: PASS, 6 testů.

- [ ] **Krok 5: Commit**

```bash
git add src/pruzkum.ts test/pruzkum.test.ts
git commit -m "feat: fronta objednávek na průzkum území"
```

---

## Úkol 5: Přechody stavů a pojistky schválení

**Soubory:**
- Upravit: `src/kampan.ts`
- Vytvořit: `test/kampan-schvaleni.test.ts`

**Rozhraní:**
- Spotřebovává: `naplnZOblasti`, `nastavUzemi` (úkol 3), `objednejPruzkum`,
  `zahajPruzkum`, `dokoncPruzkum` (úkol 4), `zapisKontakt` z `src/repo.js`.
- Poskytuje: `zmenStav(db, kampanId, novy, duvod?)`, konstantu `PRECHODY`.

- [ ] **Krok 1: Napiš padající testy**

`test/kampan-schvaleni.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozOblast } from "../src/oblast.js";
import { nastavGeo, zalozFirmu, zapisKontakt } from "../src/repo.js";
import { naplnZOblasti, nastavUzemi, zalozKampan, zmenStav } from "../src/kampan.js";
import { dokoncPruzkum, objednejPruzkum, zahajPruzkum } from "../src/pruzkum.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;
let oblastId: string;
let kampanId: string;

const STRED = { lat: 49.6, lng: 13.2 };

const zaznam = (ico: string): AresZaznam => ({
  ico, nazev: "Firma " + ico, adresa: "x", obec: "Zbůch", czNace: ["25610"],
  velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
});

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
  await zalozFirmu(db, zaznam("25232657"));
  await nastavGeo(db, "25232657", {
    ...STRED, jidelnaId: null as unknown as string, vzdalenostM: 0, vZone: true,
  });
  oblastId = await zalozOblast(db, {
    nazev: "Území", oblast: { typ: "kruh", stred: STRED, polomerM: 3000 },
  });
  kampanId = await zalozKampan(db, { nazev: "K", spravce: "a@b.cz" });
  await nastavUzemi(db, kampanId, { oblastId });
  await naplnZOblasti(db, kampanId);
});

describe("přechody stavů", () => {
  it("povolený přechod projde", async () => {
    await zmenStav(db, kampanId, "k_posouzeni");
    await expect(zmenStav(db, kampanId, "ceka_na_pruzkum")).resolves.toBeUndefined();
  });

  it("nepovolený přechod spadne", async () => {
    // Z rozpracované rovnou do schválené se nesmí — musí projít posouzením.
    await expect(zmenStav(db, kampanId, "schvalena")).rejects.toThrow(/přejít/);
  });

  it("zrušení bez důvodu spadne", async () => {
    await expect(zmenStav(db, kampanId, "zrusena")).rejects.toThrow(/důvod/);
  });

  it("do stavu bezi ani uzavrena se v této fázi nedá přejít", async () => {
    // TP-8: kód fáze 0–2 odesílání neimplementuje ani nezapíná.
    await zmenStav(db, kampanId, "k_posouzeni");
    await expect(zmenStav(db, kampanId, "bezi")).rejects.toThrow();
  });
});

describe("pojistky u schválení", () => {
  it("bez firmy s kontaktem schválit nejde", async () => {
    await zmenStav(db, kampanId, "k_posouzeni");
    await expect(zmenStav(db, kampanId, "schvalena")).rejects.toThrow(/kontakt/);
  });

  it("s firmou s kontaktem schválit jde", async () => {
    await zapisKontakt(db, "25232657", {
      email: "info@firma.cz", urovenAdresy: 2,
      zdrojUrl: "https://firma.cz/kontakt", citace: "info@firma.cz",
    });
    await zmenStav(db, kampanId, "k_posouzeni");
    await expect(zmenStav(db, kampanId, "schvalena")).resolves.toBeUndefined();
  });

  it("s nedokončeným průzkumem schválit nejde", async () => {
    await zapisKontakt(db, "25232657", {
      email: "info@firma.cz", urovenAdresy: 2,
      zdrojUrl: "https://firma.cz/kontakt", citace: "info@firma.cz",
    });
    const p = await objednejPruzkum(db, { oblastId, kampanId, pozadal: "a@b.cz" });
    await zmenStav(db, kampanId, "k_posouzeni");
    await expect(zmenStav(db, kampanId, "schvalena")).rejects.toThrow(/průzkum/);

    await zahajPruzkum(db, p);
    await dokoncPruzkum(db, p, { firemPrevzato: 1, firemNovych: 0 });
    await expect(zmenStav(db, kampanId, "schvalena")).resolves.toBeUndefined();
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/kampan-schvaleni.test.ts`
Čekej: FAIL — `zmenStav is not a function`.

- [ ] **Krok 3: Doplň do `src/kampan.ts`**

```ts
/**
 * Kam se z kterého stavu smí.
 *
 * `bezi` a `uzavrena` nemají žádnou příchozí cestu schválně — jsou
 * v číselníku kvůli fázi 3, ale kód fáze 0–2 do nich nepustí (TP-8).
 */
export const PRECHODY: Record<StavKampane, readonly StavKampane[]> = {
  rozpracovana: ["ceka_na_pruzkum", "k_posouzeni", "zrusena"],
  ceka_na_pruzkum: ["k_posouzeni", "zrusena"],
  k_posouzeni: ["schvalena", "ceka_na_pruzkum", "zrusena"],
  schvalena: ["zrusena"],
  bezi: [],
  uzavrena: [],
  zrusena: [],
};

/**
 * Změní stav kampaně. Nepovolený přechod skončí výjimkou.
 *
 * Podmínky schválení (průzkum doběhl, aspoň jedna firma s kontaktem) hlídá
 * navíc spoušť v databázi — tady jsou proto jen kvůli srozumitelné hlášce,
 * ne jako jediná pojistka.
 */
export async function zmenStav(
  db: Db,
  kampanId: string,
  novy: StavKampane,
  duvod?: string,
): Promise<void> {
  const k = await nactiKampan(db, kampanId);
  if (!k) throw new Error("Kampaň neexistuje.");

  if (!PRECHODY[k.stav].includes(novy)) {
    throw new Error(`Z „${k.stav}" nejde přejít do „${novy}".`);
  }
  if (novy === "zrusena" && !duvod?.trim()) {
    throw new Error("Zrušení kampaně potřebuje důvod.");
  }

  await db.query("update kampane set stav = $1, duvod_zruseni = $2 where id = $3", [
    novy,
    novy === "zrusena" ? duvod!.trim() : k.duvodZruseni,
    kampanId,
  ]);
}
```

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/kampan-schvaleni.test.ts`
Čekej: PASS, 7 testů.

- [ ] **Krok 5: Commit**

```bash
git add src/kampan.ts test/kampan-schvaleni.test.ts
git commit -m "feat: přechody stavů kampaně a pojistky u schválení"
```

---

## Úkol 6: Souhrn pro posouzení a překryv kampaní

**Soubory:**
- Upravit: `src/kampan.ts`
- Upravit: `test/kampan.test.ts`

**Rozhraní:**
- Spotřebovává: `firmyKampane` (úkol 3).
- Poskytuje: rozhraní `Souhrn`, funkce `souhrnKampane(db, kampanId)`,
  `prekryvKampani(db, kampanId)`.

- [ ] **Krok 1: Napiš padající testy**

Přidej do `test/kampan.test.ts`:

```ts
import { prekryvKampani, souhrnKampane } from "../src/kampan.js";
import { zapisKontakt } from "../src/repo.js";

describe("souhrn a překryv", () => {
  it("souhrn spočítá firmy, spojení a rozpad podle úrovně adresy", async () => {
    const oblastId = await pripravUzemi();
    const id = await zalozKampan(db, { nazev: "S1", spravce: "a@b.cz" });
    await nastavUzemi(db, id, { oblastId });
    await naplnZOblasti(db, id);
    await zapisKontakt(db, "25232657", {
      email: "poptavka@firma.cz", urovenAdresy: 2,
      zdrojUrl: "https://firma.cz/kontakt", citace: "poptavka@firma.cz",
    });

    const s = await souhrnKampane(db, id);
    expect(s.firem).toBe(2);
    expect(s.vyrazenych).toBe(0);
    expect(s.seSpojenim).toBe(1);
    expect(s.podleUrovne).toContainEqual({ uroven: 2, pocet: 1 });
  });

  it("překryv vypíše, ve kterých kampaních firma ještě je", async () => {
    const oblastId = await pripravUzemi();
    const prvni = await zalozKampan(db, { nazev: "Široká", spravce: "a@b.cz" });
    await nastavUzemi(db, prvni, { oblastId });
    await naplnZOblasti(db, prvni);

    const druha = await zalozKampan(db, { nazev: "Úzká", spravce: "a@b.cz" });
    await nastavUzemi(db, druha, { oblastId });
    await naplnZOblasti(db, druha);

    const p = await prekryvKampani(db, druha);
    expect(p).toEqual([{ nazev: "Široká", pocet: 2 }]);
  });

  it("vyřazená firma se do překryvu nepočítá", async () => {
    const oblastId = await pripravUzemi();
    const prvni = await zalozKampan(db, { nazev: "Prvni", spravce: "a@b.cz" });
    await nastavUzemi(db, prvni, { oblastId });
    await naplnZOblasti(db, prvni);
    await vyradFirmu(db, prvni, "25232657", "nezajímavá");
    await vyradFirmu(db, prvni, "48362956", "nezajímavá");

    const druha = await zalozKampan(db, { nazev: "Druha", spravce: "a@b.cz" });
    await nastavUzemi(db, druha, { oblastId });
    await naplnZOblasti(db, druha);

    expect(await prekryvKampani(db, druha)).toEqual([]);
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/kampan.test.ts`
Čekej: FAIL — `souhrnKampane is not a function`.

- [ ] **Krok 3: Doplň do `src/kampan.ts`**

```ts
export interface Souhrn {
  firem: number;
  vyrazenych: number;
  seSpojenim: number;
  /** Rozpad kontaktů podle úrovně adresy (TP-6). `null` = úroveň neurčena. */
  podleUrovne: Array<{ uroven: number | null; pocet: number }>;
  kapacitaVolna: number | null;
}

/**
 * Podklad pro posouzení kampaně před schválením.
 *
 * Kapacita se bere ze jídelny kampaně a může být neznámá — pak zůstane
 * `null` a nikde se z ní nesmí dělat nula.
 */
export async function souhrnKampane(db: Db, kampanId: string): Promise<Souhrn> {
  const zaklad = await db.query<{
    firem: number; vyrazenych: number; seSpojenim: number;
  }>(
    `select
       count(*) filter (where kf.stav = 'vybrana')::int as firem,
       count(*) filter (where kf.stav = 'vyrazena')::int as vyrazenych,
       count(*) filter (where kf.stav = 'vybrana' and exists (
         select 1 from contacts c where c.ico = kf.ico))::int as "seSpojenim"
     from kampan_firmy kf where kf.kampan_id = $1`,
    [kampanId],
  );

  const urovne = await db.query<{ uroven: number | null; pocet: number }>(
    `select c.uroven_adresy as uroven, count(*)::int as pocet
     from kampan_firmy kf
     join contacts c on c.ico = kf.ico
     where kf.kampan_id = $1 and kf.stav = 'vybrana'
     group by c.uroven_adresy order by c.uroven_adresy nulls last`,
    [kampanId],
  );

  const kapacita = await db.query<{ kapacita: number | null }>(
    `select j.kapacita_volna as kapacita
     from kampane k left join jidelny j on j.id = k.jidelna_id
     where k.id = $1`,
    [kampanId],
  );

  return {
    firem: zaklad[0]?.firem ?? 0,
    vyrazenych: zaklad[0]?.vyrazenych ?? 0,
    seSpojenim: zaklad[0]?.seSpojenim ?? 0,
    podleUrovne: urovne,
    kapacitaVolna: kapacita[0]?.kapacita ?? null,
  };
}

/**
 * Ve kterých jiných kampaních jsou firmy z této kampaně.
 *
 * Podle TP-5 smí na firmu odejít jedno oslovení; překryv proto **upozorňuje**
 * (rozhodnutí majitele 2026-07-29). Tvrdá pojistka sedí až u odesílání
 * ve fázi 3, podle `companies.osloveno_at`.
 */
export async function prekryvKampani(
  db: Db,
  kampanId: string,
): Promise<Array<{ nazev: string; pocet: number }>> {
  return db.query<{ nazev: string; pocet: number }>(
    `select k.nazev, count(*)::int as pocet
     from kampan_firmy moje
     join kampan_firmy jina
       on jina.ico = moje.ico and jina.kampan_id <> moje.kampan_id
     join kampane k on k.id = jina.kampan_id
     where moje.kampan_id = $1
       and moje.stav = 'vybrana' and jina.stav = 'vybrana'
       and k.stav <> 'zrusena'
     group by k.nazev order by count(*) desc, k.nazev`,
    [kampanId],
  );
}
```

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/kampan.test.ts`
Čekej: PASS.

- [ ] **Krok 5: Commit**

```bash
git add src/kampan.ts test/kampan.test.ts
git commit -m "feat: souhrn kampaně a překryv s jinými kampaněmi"
```

---

## Úkol 7: Příkazy do CLI

**Soubory:**
- Upravit: `src/cli.ts` (přidat `case "kampan"` a `case "pruzkum"` k ostatním
  a doplnit oba do nápovědy)

**Rozhraní:**
- Spotřebovává: celé `src/kampan.js` a `src/pruzkum.js`.
- Poskytuje: příkazy `kampan` a `pruzkum`.

CLI vrstva se v tomto projektu netestuje automaticky — testuje se logika pod
ní, která je pokrytá úkoly 2–6. Ověření je proto ruční.

- [ ] **Krok 1: Přidej obsluhu příkazů**

Napodob styl okolních příkazů (`case "oblast"`). Podpříkazy:

```
kampan nova <název> --spravce <e-mail> [--kontext <text>]
kampan seznam
kampan uzemi <id kampaně> <id oblasti> [--jidelna <id>]
kampan napln <id kampaně>
kampan firmy <id kampaně>
kampan vyrad <id kampaně> <ičo> --duvod <text>
kampan souhrn <id kampaně>
kampan stav <id kampaně> <nový stav> [--duvod <text>]

pruzkum objednej <id oblasti> [--kampan <id>]
pruzkum fronta
pruzkum dalsi
```

`kampan souhrn` vypíše i překryv z `prekryvKampani`. Kde je kapacita `null`,
napiš `neznámá`, **nikdy 0**.

- [ ] **Krok 2: Doplň oba příkazy do nápovědy**

Do textu nápovědy v `src/cli.ts` (hledej `k-obohaceni [--limit N]`).

- [ ] **Krok 3: Ověř ručně na lokální databázi**

```bash
CANTINERO_DATA_DIR=data/pgdata-zkouska npm run cli -- migrate
CANTINERO_DATA_DIR=data/pgdata-zkouska npm run cli -- kampan nova "Zkouška" --spravce a@b.cz
CANTINERO_DATA_DIR=data/pgdata-zkouska npm run cli -- kampan seznam
```

Čekej: kampaň se založí a vypíše ve stavu `rozpracovana`.
Pak adresář `data/pgdata-zkouska` smaž.

- [ ] **Krok 4: Kontrola typů a celá sada**

```bash
npm run typecheck
npm test
```

Čekej: bez chyb; testů 264 + nové z úkolů 1–6.

- [ ] **Krok 5: Commit**

```bash
git add src/cli.ts
git commit -m "feat: příkazy kampan a pruzkum v CLI"
```

---

## Úkol 8: Nasazení migrace a kontrola pravidel

**Soubory:** žádné — ověřovací úkol.

- [ ] **Krok 1: Nasaď migraci do sdílené databáze**

```bash
npm run cli -- migrate
```

Čekej: `Aplikováno migrací: 0018_kampane.sql`.

- [ ] **Krok 2: Ověř pravidla přístupu simulací přihlášení**

Postup je v `memory/poznatky.md` („Jak vyzkoušet pravidla RLS bez
přihlašování"). Ověř tři věci:

1. nepřihlášený (`anon`) nevidí v `kampane` nic,
2. role `uzivatel` kampaň založí a upraví,
3. role `uzivatel` **neschválí** — pokus o `stav = 'schvalena'` musí spadnout,
   zatímco `admin` projde.

Každou zkoušku obal do `begin … rollback`, aby po sobě nenechala data.

- [ ] **Krok 3: Bezpečnostní kontrola po změně schématu**

Spusť kontrolu `get_advisors` typu `security` nad projektem Supabase.
Čekej: žádné nové nálezy proti stavu před migrací (informativní hlášky
u tabulek pozdějších fází bez pravidel jsou známé a v pořádku).

- [ ] **Krok 4: Zapiš stav do paměti**

Doplň do `memory/stav.md`, že jádro kampaní je hotové a co zbývá
(průvodce v aplikaci). Do `memory/rozhodnuti.md` nic — rozhodnutí jsou
zapsaná už ze zadání.

- [ ] **Krok 5: Commit**

```bash
git add memory/stav.md
git commit -m "docs: jádro kampaní hotové"
```

---

## Co tento plán nedělá

- **obrazovku průvodce** — dostane vlastní plán, až tohle jádro projde
- **napojení Čmuchala na frontu** — viz níž, je to samostatná práce
- odesílání, skládání textu zpráv, šablony, tvrzení
- stav oslovení u jednotlivé firmy
- naplánované spouštění agenta
- návrh tvaru oblasti Čmuchalem (odloženo do fáze 4)

## Mezera, na kterou se přišlo při psaní plánu

Zadání v kap. 6 předpokládá, že Čmuchal si vyzvedne požadavek z `pruzkumy`
a území prozkoumá. **To dnes neumí.** Sběr (`src/cmuchal.ts`, příkaz
`run --jidelna`) vychází z **jídelny a její kruhové zóny**; o oblastech
neví vůbec — v celém modulu se slovo „oblast" nevyskytuje. Prozkoumat
nakreslený tvar tedy zatím nejde.

Tenhle plán proto staví **frontu** (objednávka, vyzvednutí, dokončení,
záznam počtů), ale **ne toho, kdo ji vyřídí**. Po jeho dokončení se dá
požadavek objednat a ručně uzavřít; automaticky ho vyřídit ne.

Napojení Čmuchala na oblasti je samostatná práce se svým plánem a je
**podmínkou pro krok 3 průvodce**. Bez ní průvodce dojede jen tam, kde
kampaň stojí na už prozkoumaném území.
