# Průvodce kampaní — etapa B (kroky 1 a 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kampaň jde založit a dostat území přímo v aplikaci — se zamčenými právy, zástupem a sdílenou mapou.

**Architecture:** Nejdřív databáze (evidence lidí, zástup, zamčení práv), pak doplňky designového systému, pak výřez mapy do sdílené součástky, teprve potom obrazovky. Pořadí je dané závislostmi: obrazovka kroku 1 potřebuje evidenci lidí pro výběr zástupu, krok 2 potřebuje sdílenou mapu.

**Tech Stack:** PostgreSQL (Supabase) + migrace v `supabase/migrations/`, TypeScript, React + Vite v `app/`, testy Vitest nad PGlite (offline, bez proměnných prostředí).

## Global Constraints

- **Jazyk:** čeština v komentářích, názvech domén, dokumentech i commit messages. Identifikátory česky bez diakritiky (`zalozKampan`).
- **TDD:** nejdřív test, pak implementace. `npm test` musí projít vždy, bez proměnných prostředí.
- **Migrace: pouze přidávat nové soubory** do `supabase/migrations/`. Existující se needitují.
- **Nic se neodesílá.** V této etapě nesmí vzniknout kód, který odesílá, skládá text zprávy nebo sahá na `system_state.sending_enabled` (TP-8).
- **Tvrdá pravidla se vynucují v databázi**, ne ve formuláři. Zašedlé tlačítko je pohodlí, ne pojistka.
- **Migrace musí projít i na PGlite bez Supabase Auth.** Zavedený způsob: `do $$ ... if to_regnamespace('auth') is null then ...` — viz `0016_role_a_pravidla.sql`.
- **Role se čte z `app_metadata`**, nikdy z `user_metadata`.
- Kořenový `npm test` se netýká `app/`; aplikace se spouští `npm --prefix app run dev` (port 5173).
- Zdroj pravdy pro zadání: `docs/superpowers/specs/2026-07-31-pruvodce-kampani-obrazovky-design.md`.

## Struktura souborů

| Soubor | Za co odpovídá |
|---|---|
| `supabase/migrations/0023_uzivatele.sql` | Evidence lidí + `email_uzivatele()` |
| `supabase/migrations/0024_kampan_zastup.sql` | Sloupec `zastupce` + zamčení práv ke kampani |
| `test/uzivatele.test.ts` | Schéma a pravidla evidence lidí |
| `test/kampan-prava.test.ts` | Pravidla přístupu ke kampani |
| `app/src/styl.css` | Doplňky: stupnice, krokovník, podoby hlášky, 4 barvy |
| `app/src/MapaOblasti.tsx` | Sdílená mapa: zobrazení, kreslení, výběr oblasti |
| `app/src/Krokovnik.tsx` | Ukazatel kroku průvodce |
| `app/src/Kampane.tsx` | Seznam kampaní |
| `app/src/PruvodceKampani.tsx` | Průvodce, kroky 1 a 2 |
| `app/src/hledaniMista.ts` | Hledání obce podle jména (Nominatim) |
| `app/src/data.ts` | Načítání a zápis kampaní a lidí |
| `test/hledani-mista.test.ts` | Překlad odpovědi Nominatimu, chybové cesty |

---

### Task 1: Evidence lidí (migrace 0023)

**Files:**
- Create: `supabase/migrations/0023_uzivatele.sql`
- Create: `test/uzivatele.test.ts`

**Interfaces:**
- Consumes: nic (první úkol).
- Produces: tabulka `public.uzivatele (id uuid, email text)`, funkce `public.email_uzivatele() returns text`. Task 2 na `email_uzivatele()` staví pravidla přístupu; Task 5 čte `uzivatele`.

**Proč tabulka a ne pohled do `auth.users`:** vypsat přihlašovací účty umí jen servisní klíč, který obchází všechna pravidla přístupu a nesmí do programu běžícího v prohlížeči. Pohled přímo nad `auth.users` navíc Supabase označuje jako bezpečnostní nález. Tabulka plněná spouští je doporučený postup.

- [ ] **Step 1: Napiš padající test**

Vytvoř `test/uzivatele.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("evidence lidí", () => {
  it("tabulka uzivatele existuje a má jen e-mail, žádné tajemství", async () => {
    const s = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'uzivatele'
       order by column_name`,
    );
    expect(s.map((x) => x.column_name)).toEqual(["email", "id"]);
  });

  it("evidence jde jen číst, ne měnit přes API", async () => {
    // Plní ji spoušť z auth.users. Kdyby šla měnit zvenčí, dal by si
    // kdokoli do zástupu cizí e-mail a získal práva k cizí kampani.
    const p = await db.query<{ cmd: string }>(
      `select cmd from pg_policies where tablename = 'uzivatele'`,
    );
    expect(p.map((x) => x.cmd)).toEqual(["SELECT"]);
  });

  it("RLS je na evidenci zapnuté", async () => {
    const r = await db.query<{ rowsecurity: boolean }>(
      `select rowsecurity from pg_tables where tablename = 'uzivatele'`,
    );
    expect(r[0]?.rowsecurity).toBe(true);
  });

  it("email_uzivatele bez přihlášení vrací prázdno, ne chybu", async () => {
    const r = await db.query<{ e: string | null }>(
      "select public.email_uzivatele() as e",
    );
    expect(r[0]?.e).toBeNull();
  });

  it("spoušť nad auth.users existuje, aby se evidence plnila sama", async () => {
    const t = await db.query<{ tgname: string }>(
      `select tgname from pg_trigger
       where tgrelid = 'auth.users'::regclass and not tgisinternal`,
    );
    expect(t.map((x) => x.tgname)).toContain("uzivatele_sync");
  });

  it("nový účet se do evidence propíše sám", async () => {
    await db.query(
      `insert into auth.users (id, email) values (gen_random_uuid(), 'novy@cantinero.cz')`,
    );
    const u = await db.query<{ email: string }>(
      "select email from uzivatele where email = 'novy@cantinero.cz'",
    );
    expect(u).toHaveLength(1);
  });

  it("změna e-mailu se v evidenci projeví", async () => {
    await db.query(
      `insert into auth.users (id, email) values (gen_random_uuid(), 'stary@cantinero.cz')`,
    );
    await db.query(
      `update auth.users set email = 'zmeneny@cantinero.cz' where email = 'stary@cantinero.cz'`,
    );
    const u = await db.query<{ email: string }>(
      "select email from uzivatele order by email",
    );
    expect(u.map((x) => x.email)).toEqual(["zmeneny@cantinero.cz"]);
  });
});
```

- [ ] **Step 2: Spusť test a ověř, že padá**

Run: `npx vitest run test/uzivatele.test.ts`
Expected: FAIL — `relation "public.uzivatele" does not exist` (nebo `auth.users` neexistuje).

- [ ] **Step 3: Napiš migraci**

Vytvoř `supabase/migrations/0023_uzivatele.sql`:

```sql
-- Evidence lidí, kteří mají do aplikace přístup.
--
-- K čemu: správce kampaně smí pověřit zástup (migrace 0024) a ten se musí
-- dát vybrat ze seznamu. Vypsat rovnou `auth.users` ale aplikace nesmí —
-- šlo by to jen servisním klíčem, který obchází všechna pravidla přístupu,
-- a ten do programu běžícího v prohlížeči nepatří (kdokoli si ho tam
-- přečte). Držíme proto vlastní opis, ve kterém není žádné tajemství.
--
-- ROLE SE SEM NEKOPÍRUJE. Mění se do `app_metadata` příkazem
-- `cli uzivatel role` a druhý opis by se dřív nebo později rozešel s pravdou.

-- Lokální náhrada Supabase Auth. Stejný postup jako v 0016: na Supabase
-- `auth.users` existuje a NESMÍ se přepsat, lokálně (PGlite, testy) chybí.
do $$
begin
  if to_regnamespace('auth') is null then
    execute 'create schema auth';
  end if;
  if to_regclass('auth.users') is null then
    execute $t$
      create table auth.users (
        id uuid primary key default gen_random_uuid(),
        email text unique
      )
    $t$;
  end if;
end $$;

create table uzivatele (
  id uuid primary key,
  email text not null unique
);

comment on table uzivatele is
  'Opis e-mailů z auth.users, aby šel vybrat zástup správce kampaně. Role se sem nekopíruje — ta žije v app_metadata.';

alter table uzivatele enable row level security;

-- Číst smí každý přihlášený: jsou to lidé, které stejně vidí v kartotéce.
-- Zápis nemá pravidlo ŽÁDNÉ — plní se jen spouští. Kdyby šla evidence měnit
-- přes API, zapsal by si kdokoli cizí e-mail a získal práva k cizí kampani.
create policy uzivatele_cteni on uzivatele
  for select to authenticated using (true);

-- E-mail přihlášeného. Stejný postup jako `role_uzivatele()` v 0016 —
-- čte se z tokenu, ne z tabulky, takže to funguje i v pravidlech přístupu.
create or replace function public.email_uzivatele() returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.jwt() ->> 'email'
$$;

comment on function public.email_uzivatele() is
  'E-mail přihlášeného z tokenu. Bez přihlášení NULL.';

-- Spoušť: nový nebo přejmenovaný účet se propíše do evidence.
create or replace function public.uzivatele_sync() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.uzivatele (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists uzivatele_sync on auth.users;
create trigger uzivatele_sync
  after insert or update of email on auth.users
  for each row execute function public.uzivatele_sync();

-- Účty, které vznikly dřív než tahle migrace. Lokálně je náhrada prázdná.
insert into uzivatele (id, email)
select id, email from auth.users where email is not null
on conflict (id) do update set email = excluded.email;
```

- [ ] **Step 4: Spusť test a ověř, že prochází**

Run: `npx vitest run test/uzivatele.test.ts`
Expected: PASS (7 testů).

- [ ] **Step 5: Ověř, že se nerozbila stávající sada**

Run: `npm test`
Expected: PASS — všechny soubory. Pozor zvlášť na `test/pravidla.test.ts`, který kontroluje, že **RLS je zapnuté na všech tabulkách** — nová `uzivatele` to musí splnit.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0023_uzivatele.sql test/uzivatele.test.ts
git commit -m "feat: evidence lidí pro výběr zástupu správce kampaně"
```

---

### Task 2: Zástup a zamčení kampaní (migrace 0024)

**Files:**
- Create: `supabase/migrations/0024_kampan_zastup.sql`
- Create: `test/kampan-prava.test.ts`

**Interfaces:**
- Consumes: `public.email_uzivatele()` z Tasku 1.
- Produces: sloupec `kampane.zastupce text`. Task 5 a 6 ho čtou i zapisují.

**Co se mění:** dnešní `kampane_zapis` (migrace 0018) pouští k zápisu kohokoli s rolí `uzivatel` a výš do **kterékoli** kampaně. Nově smí upravovat jen správce, jeho zástup a admin.

**Známé omezení testů:** PGlite nemá Supabase Auth, takže `auth.jwt()` je náhrada vracející NULL a pravidla přístupu **nejde otestovat chováním** — testuje se jejich obsah, stejně jako v `test/pravidla.test.ts`. Skutečné chování ověří majitel ručně (viz Step 6).

- [ ] **Step 1: Napiš padající test**

Vytvoř `test/kampan-prava.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { zalozKampan } from "../src/kampan.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

/** Text pravidla (`using` i `with check`) pro dané tabulky a příkaz. */
async function pravidlo(tabulka: string, cmd: string): Promise<string> {
  const p = await db.query<{ qual: string | null; with_check: string | null }>(
    `select qual, with_check from pg_policies
     where tablename = $1 and cmd = $2`,
    [tabulka, cmd],
  );
  return p.map((x) => `${x.qual ?? ""} ${x.with_check ?? ""}`).join(" ");
}

describe("kdo smí do kampaně sáhnout", () => {
  it("kampaň má sloupec pro zástup", async () => {
    const s = await db.query(
      `select 1 from information_schema.columns
       where table_name = 'kampane' and column_name = 'zastupce'`,
    );
    expect(s).toHaveLength(1);
  });

  it("zástup se ukládá a čte", async () => {
    const id = await zalozKampan(db, { nazev: "K1", spravce: "a@b.cz" });
    await db.query("update kampane set zastupce = $1 where id = $2", ["z@b.cz", id]);
    const r = await db.query<{ zastupce: string | null }>(
      "select zastupce from kampane where id = $1",
      [id],
    );
    expect(r[0]?.zastupce).toBe("z@b.cz");
  });

  it("úpravu kampaně pravidlo váže na správce, zástup i admina", async () => {
    const text = await pravidlo("kampane", "UPDATE");
    expect(text).toContain("spravce");
    expect(text).toContain("zastupce");
    expect(text).toContain("'admin'");
  });

  it("zakladatel se musí zapsat jako správce", async () => {
    // Jinak by šlo založit kampaň na cizí jméno a tvářit se,
    // že za ni odpovídá někdo jiný.
    const text = await pravidlo("kampane", "INSERT");
    expect(text).toContain("spravce");
    expect(text).toContain("email_uzivatele");
  });

  it("seznam firem kampaně je zamčený stejně jako kampaň", async () => {
    // Zamknout kampaň a nechat její seznam firem otevřený by byl
    // zámek na dveřích vedle otevřeného okna.
    const text = await pravidlo("kampan_firmy", "ALL");
    expect(text).toContain("spravce");
    expect(text).toContain("zastupce");
  });

  it("objednávky průzkumu jsou zamčené stejně", async () => {
    const text = await pravidlo("pruzkumy", "ALL");
    expect(text).toContain("spravce");
    expect(text).toContain("zastupce");
  });

  it("schvalovat smí dál jen admin a výš", async () => {
    const text = await pravidlo("kampane", "UPDATE");
    expect(text).toContain("schvalena");
    expect(text).toContain("super-admin");
  });

  it("běžný uživatel sám o sobě k úpravě nestačí", async () => {
    // Regrese proti návratu starého pravidla, které pouštělo
    // kohokoli s rolí `uzivatel` do kterékoli kampaně.
    const p = await db.query<{ policyname: string }>(
      `select policyname from pg_policies
       where tablename = 'kampane' and policyname = 'kampane_zapis'`,
    );
    expect(p).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Spusť test a ověř, že padá**

Run: `npx vitest run test/kampan-prava.test.ts`
Expected: FAIL — `column "zastupce" does not exist` u prvního testu.

- [ ] **Step 3: Napiš migraci**

Vytvoř `supabase/migrations/0024_kampan_zastup.sql`:

```sql
-- Zástup správce kampaně a zamčení úprav.
--
-- Rozhodnutí majitele 2026-07-31: kampaň upravuje správce (= ten, kdo ji
-- založil), jeho zástup a admin. Dosud do ní směl KDOKOLI přihlášený
-- s rolí `uzivatel` a výš (migrace 0018) a sloupec `spravce` byl jen
-- informativní cedulka — zástup by tedy neměl koho zastupovat.
--
-- Schválení zůstává na adminovi a výš, beze změny. Zástup je pověření ke
-- konkrétní kampani, NE nová role — role zůstávají tři.

alter table kampane add column zastupce text;

comment on column kampane.zastupce is
  'E-mail člověka, který smí kampaň upravovat místo správce (nemoc, dovolená). Neschvaluje.';

-- Bez cizího klíče na `uzivatele` schválně: bezpečnost stojí na pravidle
-- přístupu (`zastupce = email_uzivatele()`), takže překlep znamená jen
-- nefunkční zástup, ne díru. Cizí klíč by naopak vynutil evidenci lidí
-- i ve všech testech a v příkazové řádce, kde se používají volné e-maily.

-- Kdo smí kampaň upravovat. Používá se i pro seznam firem a objednávky.
create or replace function public.smi_do_kampane(kampan uuid) returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.kampane k
    where k.id = kampan
      and (
        public.role_uzivatele() in ('super-admin', 'admin')
        or k.spravce = public.email_uzivatele()
        or k.zastupce = public.email_uzivatele()
      )
  )
$$;

comment on function public.smi_do_kampane(uuid) is
  'Správce, zástup nebo admin. Admin vždy — jinak by kampaň po odchodu správce osiřela a spravit by ji šlo jen ručním zásahem do databáze.';

drop policy kampane_zapis on kampane;

-- Založit smí kdokoli z týmu, ale musí se zapsat jako správce. Jinak by
-- šlo založit kampaň na cizí jméno.
create policy kampane_zalozeni on kampane
  for insert to authenticated
  with check (
    public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel')
    and spravce = public.email_uzivatele()
  );

create policy kampane_uprava on kampane
  for update to authenticated
  using (
    public.role_uzivatele() in ('super-admin', 'admin')
    or spravce = public.email_uzivatele()
    or zastupce = public.email_uzivatele()
  )
  with check (
    (
      public.role_uzivatele() in ('super-admin', 'admin')
      or spravce = public.email_uzivatele()
      or zastupce = public.email_uzivatele()
    )
    -- Beze změny z 0018: do `schvalena` smí jen admin a výš.
    and (stav <> 'schvalena' or public.role_uzivatele() in ('super-admin', 'admin'))
  );

-- Mazat kampaně nejde vůbec (rozhodnutí: zrušení je stav s důvodem),
-- takže pravidlo pro DELETE schválně nevzniká.

drop policy kampan_firmy_zapis on kampan_firmy;

create policy kampan_firmy_zapis on kampan_firmy
  for all to authenticated
  using (public.smi_do_kampane(kampan_id))
  with check (public.smi_do_kampane(kampan_id));

-- Objednávky průzkumu navázané na kampaň. Objednávka bez kampaně
-- (`kampan_id is null`) se zakládá z příkazové řádky, kde žádný přihlášený
-- člověk není — ta zůstává na roli, jako dosud.
drop policy if exists pruzkumy_zapis on pruzkumy;

create policy pruzkumy_zapis on pruzkumy
  for all to authenticated
  using (
    case when kampan_id is null
      then public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel')
      else public.smi_do_kampane(kampan_id)
    end
  )
  with check (
    case when kampan_id is null
      then public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel')
      else public.smi_do_kampane(kampan_id)
    end
  );
```

- [ ] **Step 4: Spusť test a ověř, že prochází**

Run: `npx vitest run test/kampan-prava.test.ts`
Expected: PASS (8 testů).

Pokud padne test na `pruzkumy_zapis`, ověř skutečný název pravidla z migrace 0018:
`grep -n "policy pruzkumy" supabase/migrations/0018_kampane.sql` a v migraci ho oprav.

- [ ] **Step 5: Spusť celou sadu**

Run: `npm test`
Expected: PASS. `test/pravidla.test.ts` a `test/kampan-schvaleni.test.ts` musí projít beze změny — schvalovací pojistka se nemění.

- [ ] **Step 6: Commit a poznámka k ručnímu ověření**

```bash
git add supabase/migrations/0024_kampan_zastup.sql test/kampan-prava.test.ts
git commit -m "feat: zástup správce kampaně a zamčení úprav na správce, zástup a admina"
```

Do shrnutí pro majitele napiš, že **skutečné chování pravidel je potřeba ověřit
po nasazení ručně**: přihlásit se jako `sasek@cantinero.cz` a zkusit upravit
kampaň, kterou založil někdo jiný — nesmí to projít. Lokální testy tohle
ověřit neumí, protože PGlite nemá přihlašování.

---

### Task 3: Doplňky designového systému

**Files:**
- Modify: `app/src/styl.css`

**Interfaces:**
- Consumes: nic.
- Produces: třídy `.krokovnik`, `.krok` (varianty `.hotovy`, `.tady`), `.hlaska.je-klid`, `.hlaska.je-hotovo`; proměnné `--o1`…`--o6`, `--t-mikro`…`--t-velky`, `--bila`, `--razitko-tmave`, `--cihla-svetle`, `--zelen-svetle`. Task 6 a 7 je používají.

CSS se testy nepokrývá — ověřuje se pohledem v prohlížeči.

- [ ] **Step 1: Doplň proměnné**

V `app/src/styl.css` do bloku `:root` (za `--zelen`) přidej:

```css
  /* Dosud psané natvrdo na šesti místech. */
  --bila: #fff;
  --razitko-tmave: #243c67;
  --cihla-svetle: #f7ecea;
  --zelen-svetle: #e6efe4;

  /* Stupnice odstupů a velikostí. Bez nich se rozměry píšou od oka
     a se čtyřmi novými obrazovkami se to rozjede. */
  --o1: .25rem;  --o2: .5rem;   --o3: .75rem;
  --o4: 1rem;    --o5: 1.5rem;  --o6: 2rem;
  --t-mikro: .75rem;  --t-maly: .8125rem;  --t-drobny: .875rem;
  --t-zaklad: .9375rem; --t-nadpis: 1.25rem; --t-velky: 1.75rem;
```

- [ ] **Step 2: Nahraď natvrdo psané barvy**

Šest míst, na kterých se barvy píšou přímo. Najdi je:

Run: `grep -n "#fff\|#243c67\|#f7ecea" app/src/styl.css`
Expected: 6 řádků (přibližně 143, 157, 165, 194, 644, 827).

Každý přepiš na proměnnou: `#fff` → `var(--bila)`, `#243c67` → `var(--razitko-tmave)`, `#f7ecea` → `var(--cihla-svetle)`.

- [ ] **Step 3: Přidej podoby hlášky**

Dnešní `.hlaska` je natvrdo chybová (cihlová). Krok 2 potřebuje klidnou.
Za blok `.hlaska` v `app/src/styl.css` přidej:

```css
/* Hláška má tři podoby. Dosud existovala jen chybová, takže „objednáno,
   čeká se" by se tvářilo jako chyba. */
.hlaska.je-klid {
  border-left-color: var(--razitko);
  background: var(--razitko-svetle);
  color: var(--razitko);
}

.hlaska.je-hotovo {
  border-left-color: var(--zelen);
  background: var(--zelen-svetle);
  color: var(--zelen);
}
```

- [ ] **Step 4: Přidej krokovník**

Na konec `app/src/styl.css`:

```css
/* ─────────────────────────────────────────────────────── krokovník */

.krokovnik {
  display: flex;
  flex-wrap: wrap;
  gap: var(--o1) var(--o3);
  padding-bottom: var(--o3);
  border-bottom: 1px solid var(--linka);
  font-size: var(--t-drobny);
  list-style: none;
  margin: 0;
  padding-left: 0;
}

.krok {
  display: flex;
  align-items: center;
  gap: var(--o2);
  color: var(--inkoust-slaby);
}

.krok .cislo {
  width: 1.35rem;
  height: 1.35rem;
  display: grid;
  place-items: center;
  border: 1px solid var(--linka);
  border-radius: 50%;
  font-family: var(--pismo-data);
  font-size: var(--t-mikro);
  flex: none;
}

.krok.hotovy { color: var(--zelen); }
.krok.hotovy .cislo {
  border-color: var(--zelen);
  background: var(--zelen);
  color: var(--bila);
}

.krok.tady { color: var(--razitko); font-weight: 600; }
.krok.tady .cislo { border-color: var(--razitko); border-width: 2px; color: var(--razitko); }
```

- [ ] **Step 5: Ověř pohledem, že se nic nerozbilo**

Spusť aplikaci a projdi Oblasti i Kartotéku — barvy a rozestupy musí
vypadat stejně jako před úpravou. Nahrazení natvrdo psaných barev za
proměnné je záměrně beze změny vzhledu.

Run: `npm --prefix app run dev`

- [ ] **Step 6: Commit**

```bash
git add app/src/styl.css
git commit -m "feat: stupnice, krokovník a klidná podoba hlášky v designovém systému"
```

---

### Task 4: Sdílená mapa

**Files:**
- Create: `app/src/MapaOblasti.tsx`
- Modify: `app/src/Oblasti.tsx`

**Interfaces:**
- Consumes: `Mapa`, `PanelVrstev`, `spoctiVrstvy`, `najdiPrekryv`, `naOblast` — vše beze změny.
- Produces:

```typescript
export interface MapaOblastiProps {
  /** Kdo se dívá — kreslit smí jen tým, host jen prohlíží. */
  role: Role;
  /** Zavolá se, kdykoli se změní vybraná oblast. `null` = žádná. */
  onVyber?: (oblastId: string | null) => void;
  /** Která oblast je vybraná zvenčí (průvodce si ji drží ve svém stavu). */
  vybranaId?: string | null;
}

export function MapaOblasti(props: MapaOblastiProps): JSX.Element;
```

**Proč výřez a ne druhá mapa:** majitel chce kreslení přímo v průvodci. Dvě samostatné mapy by se časem rozešly — oprava v jedné by druhou minula.

**Postup je čistě mechanický:** kód se stěhuje, nemění. Ověřuje se tím, že obrazovka Oblasti funguje po přesunu úplně stejně.

- [ ] **Step 1: Vytvoř soubor s přesunutým obsahem**

Přesuň z `app/src/Oblasti.tsx` do nového `app/src/MapaOblasti.tsx` **beze změny chování**:
- stavy `firmy`, `jidelny`, `kategorie`, `oblasti`, `nacita`, `chyba`, `navrh`,
  `upravovanaId`, `rezim`, `nazev`, `jidelnaId`, `uklada`, `hlaska`, `zobrazene`
- `useEffect` s načtením dat, `useMemo` s `vrstvy` a `prekryv`
- funkce `zacniKruh`, `zacniPolygon`, `zahod`, `otevri`, `odeberPosledniBod`,
  `zapisPrislusnost`, `uloz`
- celý návrat komponenty (mapa, panel vrstev, seznam oblastí, seznam firem)

Na konec `otevri` a `zahod` přidej ohlášení výběru ven:

```typescript
  function otevri(r: RadekOblasti) {
    setNavrh(naOblast(r));
    setUpravovanaId(r.id);
    setNazev(r.nazev);
    setJidelnaId(r.jidelna_id ?? "");
    setRezim("prohlizeni");
    setHlaska(null);
    props.onVyber?.(r.id);          // ← nové
  }
```

A v `uloz`, hned za `setUpravovanaId(id)`:

```typescript
      props.onVyber?.(id);          // ← nové: čerstvě uložená oblast je vybraná
```

- [ ] **Step 2: Zeštíhli Oblasti.tsx**

`app/src/Oblasti.tsx` zůstane jen obalem s nadpisem:

```typescript
import { MapaOblasti } from "./MapaOblasti";
import type { Role } from "./supabase";

export function Oblasti({ role }: { role: Role }) {
  return (
    <>
      <div className="sloupec">
        <h2>Oblasti</h2>
        <p className="podnadpis">
          Území, ve kterém se hledají firmy. Kruh se rychle nastaví posuvníkem;
          když usekne sousední město v půlce, obkreslete tvar ručně.
        </p>
      </div>
      <MapaOblasti role={role} />
    </>
  );
}
```

- [ ] **Step 3: Ověř, že kontrola typů projde**

Run: `npm run typecheck`
Expected: PASS bez chyb.

- [ ] **Step 4: Ověř pohledem, že Oblasti fungují stejně**

Run: `npm --prefix app run dev`

Projdi v prohlížeči: zobrazení uložených oblastí · nový kruh s posuvníkem ·
obkreslení tvaru · tažení bodů · živý počet firem uvnitř · uložení oblasti.
Všechno se musí chovat jako před přesunem.

- [ ] **Step 5: Commit**

```bash
git add app/src/MapaOblasti.tsx app/src/Oblasti.tsx
git commit -m "refactor: mapa a kreslení oblastí do sdílené součástky"
```

---

### Task 5: Seznam kampaní

**Files:**
- Modify: `app/src/data.ts`
- Create: `app/src/Kampane.tsx`
- Modify: `app/src/App.tsx`

**Interfaces:**
- Consumes: tabulka `uzivatele` (Task 1), sloupec `kampane.zastupce` (Task 2).
- Produces:

```typescript
export interface RadekKampane {
  id: string;
  nazev: string;
  stav: string;
  spravce: string;
  zastupce: string | null;
  krok: number;
  oblast_id: string | null;
  updated_at: string;
}

export interface Clovek { id: string; email: string }

export function nactiKampane(): Promise<RadekKampane[]>;
export function nactiLidi(): Promise<Clovek[]>;
```

- [ ] **Step 1: Doplň načítání do data.ts**

Na konec `app/src/data.ts`:

```typescript
/** Řádek tabulky `kampane` tak, jak chodí z databáze. */
export interface RadekKampane {
  id: string;
  nazev: string;
  stav: string;
  spravce: string;
  zastupce: string | null;
  krok: number;
  oblast_id: string | null;
  updated_at: string;
}

/** Člověk s přístupem do aplikace — pro výběr zástupu. */
export interface Clovek {
  id: string;
  email: string;
}

export async function nactiKampane(): Promise<RadekKampane[]> {
  const { data, error } = await supabase
    .from("kampane")
    .select("id, nazev, stav, spravce, zastupce, krok, oblast_id, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RadekKampane[];
}

export async function nactiLidi(): Promise<Clovek[]> {
  const { data, error } = await supabase
    .from("uzivatele")
    .select("id, email")
    .order("email");
  if (error) throw new Error(error.message);
  return (data ?? []) as Clovek[];
}
```

- [ ] **Step 2: Vytvoř obrazovku seznamu**

Vytvoř `app/src/Kampane.tsx`:

```typescript
import { useEffect, useState } from "react";
import { nactiKampane, type RadekKampane } from "./data";

/** Popis stavu pro člověka + třída, která ho kóduje tvarem i barvou. */
const STAV: Record<string, { popis: string; trida: string }> = {
  rozpracovana: { popis: "Rozpracovaná", trida: "je-rozpracovana" },
  ceka_na_pruzkum: { popis: "Čeká na průzkum", trida: "je-ceka" },
  k_posouzeni: { popis: "K posouzení", trida: "je-posouzeni" },
  schvalena: { popis: "Schválená", trida: "je-schvalena" },
  zrusena: { popis: "Zrušená", trida: "je-zrusena" },
};

export function Kampane({ onNova }: { onNova: () => void }) {
  const [kampane, setKampane] = useState<RadekKampane[]>([]);
  const [nacita, setNacita] = useState(true);
  const [chyba, setChyba] = useState<string | null>(null);

  useEffect(() => {
    nactiKampane()
      .then(setKampane)
      .catch((e: Error) => setChyba(e.message))
      .finally(() => setNacita(false));
  }, []);

  if (chyba) {
    return (
      <p className="hlaska" role="alert">
        Kampaně se nepodařilo načíst: {chyba}
      </p>
    );
  }
  if (nacita) return <p className="nacitani">Načítám kampaně…</p>;

  return (
    <>
      <div className="sloupec">
        <h2>Kampaně</h2>
        <p className="podnadpis">
          Kampaň je pojmenovaný seznam firem, které chcete oslovit. Nic se
          z ní neodesílá.
        </p>
        <div className="tlacitka">
          <button className="tlacitko" onClick={onNova}>
            Nová kampaň
          </button>
        </div>
      </div>

      {kampane.length === 0 ? (
        <div className="sloupec">
          <div className="prazdno">Zatím tu žádná kampaň není.</div>
        </div>
      ) : (
        <div className="sloupec obal-tabulky">
          <table className="tabulka">
            <thead>
              <tr>
                <th>Název</th>
                <th>Stav</th>
                <th>Správce</th>
                <th>Zástup</th>
              </tr>
            </thead>
            <tbody>
              {kampane.map((k) => {
                const s = STAV[k.stav] ?? { popis: k.stav, trida: "" };
                return (
                  <tr key={k.id}>
                    <td>{k.nazev}</td>
                    <td>
                      <span className={`stav ${s.trida}`}>
                        <span className="znak" />
                        {s.popis}
                      </span>
                    </td>
                    <td>{k.spravce}</td>
                    <td>{k.zastupce ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Přidej Kampaně do lišty**

V `app/src/App.tsx` rozšiř typ pohledu a rozcestník:

```typescript
type Pohled = "oblasti" | "kartoteka" | "kampane";
```

Do `<nav className="rozcestnik">` za tlačítko Kartotéka:

```tsx
          <button
            className={pohled === "kampane" ? "aktivni" : ""}
            onClick={() => setPohled("kampane")}
          >
            Kampaně
          </button>
```

A `<main>` přepiš na:

```tsx
      <main>
        {pohled === "oblasti" && <Oblasti role={role} />}
        {pohled === "kartoteka" && <Kartoteka />}
        {pohled === "kampane" && <Kampane onNova={() => setPohled("kampane")} />}
      </main>
```

Nezapomeň na import `import { Kampane } from "./Kampane";`.

- [ ] **Step 4: Ověř kontrolu typů**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Ověř pohledem**

Run: `npm --prefix app run dev`

V prohlížeči: v liště přibyla položka **Kampaně**. Bez kampaní ukáže
prázdný stav „Zatím tu žádná kampaň není." Tlačítko **Nová kampaň** zatím
nic nedělá — průvodce přijde v Tasku 6.

- [ ] **Step 6: Commit**

```bash
git add app/src/data.ts app/src/Kampane.tsx app/src/App.tsx
git commit -m "feat: obrazovka se seznamem kampaní"
```

---

### Task 6: Krok 1 — Založení

**Files:**
- Create: `app/src/Krokovnik.tsx`
- Create: `app/src/PruvodceKampani.tsx`
- Modify: `app/src/Kampane.tsx`

**Interfaces:**
- Consumes: `nactiLidi`, `Clovek` (Task 5); třídy `.krokovnik` (Task 3); pravidlo `kampane_zalozeni` (Task 2).
- Produces:

```typescript
export function Krokovnik({ krok }: { krok: 1 | 2 | 3 | 4 }): JSX.Element;
export function PruvodceKampani(props: {
  role: Role;
  email: string;
  onHotovo: () => void;
}): JSX.Element;
```

- [ ] **Step 1: Vytvoř krokovník**

Vytvoř `app/src/Krokovnik.tsx`:

```typescript
const KROKY = ["Založení", "Území", "Průzkum", "Seznam firem"] as const;

/**
 * Ukazatel kroku průvodce. Je to seznam, ne obrázek — čtečka obrazovky
 * pak přečte „krok 2 ze 4, Území".
 */
export function Krokovnik({ krok }: { krok: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="krokovnik">
      {KROKY.map((nazev, i) => {
        const cislo = i + 1;
        const trida = cislo < krok ? "hotovy" : cislo === krok ? "tady" : "";
        return (
          <li
            key={nazev}
            className={`krok ${trida}`}
            aria-current={cislo === krok ? "step" : undefined}
          >
            <span className="cislo" aria-hidden="true">
              {cislo < krok ? "✓" : cislo}
            </span>
            <span className="skryty">Krok {cislo} ze 4: </span>
            {nazev}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Vytvoř průvodce s krokem 1**

Vytvoř `app/src/PruvodceKampani.tsx`:

```typescript
import { useEffect, useState } from "react";
import { Krokovnik } from "./Krokovnik";
import { nactiLidi, type Clovek } from "./data";
import { supabase, type Role } from "./supabase";

// `role` se v kroku 1 nepoužije, ale krok 2 ho předává mapě (Task 7) —
// rozbalit ho hned je levnější než na to při psaní kroku 2 narazit.
export function PruvodceKampani({
  role,
  email,
  onHotovo,
}: {
  role: Role;
  email: string;
  onHotovo: () => void;
}) {
  const [krok, setKrok] = useState<1 | 2>(1);
  const [nazev, setNazev] = useState("");
  const [kontext, setKontext] = useState("");
  const [zastupce, setZastupce] = useState("");
  const [lide, setLide] = useState<Clovek[]>([]);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  useEffect(() => {
    nactiLidi()
      .then(setLide)
      .catch(() => setLide([]));
  }, []);

  async function zaloz() {
    if (!nazev.trim()) {
      setChyba("Kampaň potřebuje název — podle něj ji poznáte v seznamu.");
      return;
    }
    setUklada(true);
    setChyba(null);

    const { error } = await supabase.from("kampane").insert({
      nazev: nazev.trim(),
      kontext: kontext.trim() || null,
      spravce: email,
      zastupce: zastupce || null,
    });

    setUklada(false);
    if (error) {
      // 23505 = porušení jedinečnosti. Databáze hlídá název bez ohledu
      // na velikost písmen, formulář by to sám nepoznal.
      setChyba(
        error.code === "23505"
          ? "Kampaň s tímhle názvem už existuje. Zvolte jiný — na velikosti písmen nezáleží."
          : `Kampaň se nepodařilo založit: ${error.message}`,
      );
      return;
    }
    setKrok(2);
  }

  if (krok === 2) {
    return (
      <div className="sloupec">
        <Krokovnik krok={2} />
        <p className="hlaska je-klid">
          Území se vybírá na další obrazovce — přijde v dalším kroku stavby.
        </p>
        <div className="tlacitka">
          <button className="tlacitko tise" onClick={onHotovo}>
            Zpět na kampaně
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sloupec">
      <h2>Nová kampaň</h2>
      <Krokovnik krok={1} />

      <div className="pole">
        <label htmlFor="nazev">Název kampaně</label>
        <input
          id="nazev"
          value={nazev}
          onChange={(e) => setNazev(e.target.value)}
        />
        <span className="poznamka">
          Podle názvu kampaň poznáte v seznamu. Musí být jedinečný.
        </span>
      </div>

      <div className="pole">
        <label htmlFor="kontext">K čemu kampaň je (nepovinné)</label>
        <textarea
          id="kontext"
          value={kontext}
          onChange={(e) => setKontext(e.target.value)}
          rows={3}
        />
        <span className="poznamka">Poznámka pro vás a kolegy. Nikam se neposílá.</span>
      </div>

      <div className="pole">
        <label>Správce kampaně</label>
        <p className="poznamka">{email} — vy. Doplní se sám podle přihlášení.</p>
      </div>

      <div className="pole">
        <label htmlFor="zastupce">Zástup (nepovinné)</label>
        <select
          id="zastupce"
          value={zastupce}
          onChange={(e) => setZastupce(e.target.value)}
        >
          <option value="">Nikdo</option>
          {lide
            .filter((c) => c.email !== email)
            .map((c) => (
              <option key={c.id} value={c.email}>
                {c.email}
              </option>
            ))}
        </select>
        <span className="poznamka">
          Kdo smí kampaň upravovat, když nebudete k dispozici. Schvalovat
          kampaň může dál jen admin. Změnit jde kdykoli později.
        </span>
      </div>

      {chyba && (
        <p className="hlaska" role="alert">
          {chyba}
        </p>
      )}

      <div className="tlacitka">
        <button className="tlacitko tise" onClick={onHotovo}>
          Zrušit
        </button>
        <button className="tlacitko" onClick={zaloz} disabled={uklada}>
          {uklada ? "Zakládám…" : "Pokračovat na území"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Napoj průvodce na seznam**

V `app/src/Kampane.tsx` přidej stav, který přepíná mezi seznamem a průvodcem.
Uprav podpis komponenty a doplň import:

```typescript
import { PruvodceKampani } from "./PruvodceKampani";
import type { Role } from "./supabase";
```

```typescript
export function Kampane({ role, email }: { role: Role; email: string }) {
  const [pruvodce, setPruvodce] = useState(false);
```

Hned za deklarace stavů (před `useEffect`) přidej:

```typescript
  if (pruvodce) {
    return (
      <PruvodceKampani
        role={role}
        email={email}
        onHotovo={() => {
          setPruvodce(false);
          nactiKampane().then(setKampane).catch(() => undefined);
        }}
      />
    );
  }
```

A tlačítko „Nová kampaň" přepni na `onClick={() => setPruvodce(true)}`
(parametr `onNova` z Tasku 5 tím zaniká).

V `app/src/App.tsx` uprav volání:

```tsx
        {pohled === "kampane" && <Kampane role={role} email={session.user.email ?? ""} />}
```

- [ ] **Step 4: Ověř kontrolu typů**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Ověř pohledem**

Run: `npm --prefix app run dev`

V prohlížeči: Kampaně → **Nová kampaň** → krokovník ukazuje krok 1 zvýrazněný.
Vyplň název, ulož → přeskočí na krok 2 (zatím jen s hláškou).
Zkus druhou kampaň se stejným názvem, jen jinak psaným velkými písmeny →
musí přijít hláška „Kampaň s tímhle názvem už existuje."

Ověř, že se **v roletce zástupu nabízí ostatní lidé, ne vy sám.**

- [ ] **Step 6: Commit**

```bash
git add app/src/Krokovnik.tsx app/src/PruvodceKampani.tsx app/src/Kampane.tsx app/src/App.tsx
git commit -m "feat: krok 1 průvodce kampaní — založení se zástupem"
```

---

### Task 7: Krok 2 — Území

**Files:**
- Modify: `app/src/PruvodceKampani.tsx`
- Modify: `app/src/data.ts`

**Interfaces:**
- Consumes: `MapaOblasti` (Task 4), `duvodNeoslovovat` ze `src/kvalifikace.ts`, `bodVOblasti` ze `src/oblast-tvar.ts`.
- Produces: nic pro další úkoly — krok 2 je poslední v etapě B.

**Dvě čísla, ne jedno.** Mapa dnes ukazuje jen „firem uvnitř". Od 31. 7. je
mezi územím a kampaní síto, takže se počty liší — a kdyby to obrazovka
zamlčela, vypadal by rozdíl v kroku 4 jako chyba.

- [ ] **Step 1: Rozšiř načítání firem o pole, která síto potřebuje**

`duvodNeoslovovat` chce `nazev`, `czNace`, `pravniForma`, `maVlastniJidelnu`.
V `app/src/data.ts` najdi `export interface Firma` a doplň:

```typescript
  cz_nace: string[];
  pravni_forma: string | null;
  ma_vlastni_jidelnu: boolean | null;
```

Sloupce se nevypisují v `nactiFirmy` přímo, ale v konstantě `SLOUPCE_FIRMY`.
Najdi ji:

Run: `grep -n "SLOUPCE_FIRMY" app/src/data.ts`

a do jejího řetězce dopiš `,cz_nace,pravni_forma,ma_vlastni_jidelnu`.

- [ ] **Step 2: Doplň načtení blacklistu a partnerských IČO**

Na konec `app/src/data.ts`:

```typescript
import type { Pravidlo } from "../../src/blacklist";

/** Podklady pro síto „koho vůbec chceme oslovit". */
export async function nactiPravidlaSita(): Promise<{
  blacklist: Pravidlo[];
  partnerskaIca: Set<string>;
}> {
  const [b, j] = await Promise.all([
    supabase.from("blacklist").select("typ, hodnota, duvod"),
    supabase.from("jidelny").select("ico"),
  ]);
  if (b.error) throw new Error(b.error.message);
  if (j.error) throw new Error(j.error.message);
  return {
    blacklist: (b.data ?? []) as Pravidlo[],
    partnerskaIca: new Set(
      (j.data ?? []).map((x) => (x as { ico: string | null }).ico).filter((x): x is string => !!x),
    ),
  };
}
```

- [ ] **Step 3: Nahraď zástupnou obrazovku kroku 2**

V `app/src/PruvodceKampani.tsx` nahraď blok `if (krok === 2) { ... }`.
Doplň importy:

```typescript
import { MapaOblasti } from "./MapaOblasti";
import { nactiFirmy, nactiOblasti, nactiPravidlaSita, type Firma } from "./data";
import { duvodNeoslovovat } from "../../src/kvalifikace";
import { bodVOblasti } from "../../src/oblast-tvar";
import { naOblast } from "./vrstvy";
```

a stavy (k ostatním `useState`):

```typescript
  const [oblastId, setOblastId] = useState<string | null>(null);
  const [pocty, setPocty] = useState<{ uvnitr: number; projde: number } | null>(null);
```

Přepočet počtů při změně vybrané oblasti:

```typescript
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
        if (!radek) return;
        const tvar = naOblast(radek);
        const uvnitr = firmy.filter(
          (f: Firma) =>
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
```

A samotná obrazovka:

```tsx
  if (krok === 2) {
    const vyrazeno = pocty ? pocty.uvnitr - pocty.projde : 0;
    return (
      <div className="sloupec">
        <h2>Nová kampaň</h2>
        <Krokovnik krok={2} />

        <MapaOblasti role={role} vybranaId={oblastId} onVyber={setOblastId} />

        {pocty && (
          <>
            <div className="udaj">
              <span className="popisek">V území leží</span>
              <span className="vodic" />
              <span className="hodnota">{pocty.uvnitr} firem</span>
            </div>
            <div className="udaj">
              <span className="popisek">Do kampaně projde</span>
              <span className="vodic" />
              <span className="hodnota">{pocty.projde} firem</span>
            </div>
            {vyrazeno > 0 && (
              <p className="hlaska je-klid">
                {vyrazeno === 1 ? "Jednu firmu" : `${vyrazeno} firem`} síto
                nepustí — je na blacklistu, je to bytový dům, naše partnerská
                jídelna, nebo má vlastní jídelnu. Důvody u každé uvidíte
                v posledním kroku.
              </p>
            )}
          </>
        )}

        <div className="tlacitka">
          <button className="tlacitko tise" onClick={onHotovo}>
            Zpět na kampaně
          </button>
          <button className="tlacitko" disabled={!oblastId} onClick={onHotovo}>
            Pokračovat na průzkum
          </button>
        </div>
        {!oblastId && (
          <span className="poznamka">
            Nejdřív vyberte v mapě oblast, nebo nakreslete novou.
          </span>
        )}
      </div>
    );
  }
```

- [ ] **Step 4: Ověř kontrolu typů**

Run: `npm run typecheck`
Expected: PASS.

Pokud si `duvodNeoslovovat` stěžuje na typ `czNace`, ověř, že `Firma.cz_nace`
je `string[]` a ne `string`.

- [ ] **Step 5: Ověř pohledem, že čísla sedí**

Run: `npm --prefix app run dev`

Kampaně → Nová kampaň → vyplň název → Pokračovat → v mapě vyber oblast.
Musí se ukázat obě čísla. Ověř proti příkazové řádce, že „v území leží"
odpovídá:

```bash
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- oblast firmy --oblast <id>
```

Přidej dočasně firmu na blacklist a znovu načti — „do kampaně projde"
musí klesnout o jedna a hláška se musí objevit.

- [ ] **Step 6: Commit**

```bash
git add app/src/PruvodceKampani.tsx app/src/data.ts
git commit -m "feat: krok 2 průvodce kampaní — území se dvěma počty firem"
```

---

### Task 8: Hledání místa v mapě

**Files:**
- Create: `app/src/hledaniMista.ts`
- Modify: `app/src/MapaOblasti.tsx`
- Create: `test/hledani-mista.test.ts`

**Interfaces:**
- Consumes: `MapaOblasti` z Tasku 4.
- Produces:

```typescript
export interface Misto { nazev: string; lat: number; lng: number }
export function najdiMisto(dotaz: string, fetchFn?: typeof fetch): Promise<Misto[]>;
```

**Proč to tu je:** obrazovka Oblasti dnes umí hledat jen v **uložených
oblastech** (`PanelVrstev`) a v **seznamu firem** (`SeznamFirem`). Přesunout
pohled na obec podle jména neumí vůbec. Zadání i návrh to slibují.

**Dvě omezení Nominatimu, která se musí dodržet:**
1. **Nejvýš jeden dotaz za sekundu.** Psaní se proto zdržuje — dotaz odejde
   až po odmlce (600 ms bez stisku klávesy).
2. **Hlavičku `User-Agent` prohlížeč měnit nedovolí.** Nominatim v takovém
   případě identifikuje volajícího podle adresy stránky, což jeho podmínkám
   odpovídá. Kontaktní e-mail, jak ho posílá jádro, se tady nastavit nedá.

- [ ] **Step 1: Napiš padající test**

Vytvoř `test/hledani-mista.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { najdiMisto } from "../app/src/hledaniMista.js";

/** Odpověď Nominatimu tak, jak doopravdy chodí (zkráceno). */
const ODPOVED = [
  { display_name: "Zbůch, okres Plzeň-sever", lat: "49.6000", lon: "13.2000" },
  { display_name: "Zbůch, nádraží", lat: "49.6100", lon: "13.2100" },
];

function falesnyFetch(telo: unknown, ok = true) {
  return (async () =>
    ({ ok, json: async () => telo }) as unknown as Response) as typeof fetch;
}

describe("hledání místa", () => {
  it("přeloží odpověď na body v mapě", async () => {
    const m = await najdiMisto("Zbůch", falesnyFetch(ODPOVED));
    expect(m).toHaveLength(2);
    expect(m[0]).toEqual({ nazev: "Zbůch, okres Plzeň-sever", lat: 49.6, lng: 13.2 });
  });

  it("prázdný dotaz se neptá vůbec", async () => {
    let volano = false;
    const sledovany = (async () => {
      volano = true;
      return { ok: true, json: async () => [] } as unknown as Response;
    }) as typeof fetch;

    expect(await najdiMisto("   ", sledovany)).toEqual([]);
    expect(volano).toBe(false);
  });

  it("chyba služby vrátí prázdno, ne výjimku", async () => {
    // Mapová služba je cizí a občas neodpoví. Rozbít kvůli tomu celou
    // obrazovku by bylo horší než nenajít obec.
    expect(await najdiMisto("Zbůch", falesnyFetch(null, false))).toEqual([]);
  });

  it("nesmyslné souřadnice se zahodí", async () => {
    const spatne = [{ display_name: "x", lat: "nesmysl", lon: "13.2" }];
    expect(await najdiMisto("x", falesnyFetch(spatne))).toEqual([]);
  });
});
```

- [ ] **Step 2: Spusť test a ověř, že padá**

Run: `npx vitest run test/hledani-mista.test.ts`
Expected: FAIL — `Cannot find module '../app/src/hledaniMista.js'`.

- [ ] **Step 3: Napiš hledání**

Vytvoř `app/src/hledaniMista.ts`:

```typescript
/**
 * Hledání místa podle jména (Nominatim, OpenStreetMap).
 *
 * Prohlížeč nedovolí nastavit hlavičku `User-Agent`, takže se volající
 * identifikuje adresou stránky. Podmínkám Nominatimu to odpovídá.
 *
 * `fetchFn` se dá podstrčit kvůli testům — jinak se použije prohlížečový.
 */
export interface Misto {
  nazev: string;
  lat: number;
  lng: number;
}

const ADRESA = "https://nominatim.openstreetmap.org/search";

export async function najdiMisto(
  dotaz: string,
  fetchFn: typeof fetch = fetch,
): Promise<Misto[]> {
  const q = dotaz.trim();
  if (!q) return [];

  try {
    const url = `${ADRESA}?format=json&limit=5&countrycodes=cz&q=${encodeURIComponent(q)}`;
    const odpoved = await fetchFn(url);
    if (!odpoved.ok) return [];

    const data = (await odpoved.json()) as
      | { display_name?: string; lat?: string; lon?: string }[]
      | null;
    if (!Array.isArray(data)) return [];

    return data
      .map((r) => ({
        nazev: r.display_name ?? "",
        lat: Number(r.lat),
        lng: Number(r.lon),
      }))
      // Souřadnice z cizí služby se neberou na slovo — nesmysl by poslal
      // mapu do prázdna a vypadalo by to jako chyba aplikace.
      .filter((m) => m.nazev !== "" && Number.isFinite(m.lat) && Number.isFinite(m.lng));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Spusť test a ověř, že prochází**

Run: `npx vitest run test/hledani-mista.test.ts`
Expected: PASS (4 testy). Žádný dotaz na síť neodejde — testy podstrkují
vlastní `fetchFn`.

- [ ] **Step 5: Napoj hledání na mapu**

V `app/src/MapaOblasti.tsx` doplň import a stavy:

```typescript
import { najdiMisto, type Misto } from "./hledaniMista";
```

```typescript
  const [dotazMista, setDotazMista] = useState("");
  const [nalezena, setNalezena] = useState<Misto[]>([]);
```

Odložený dotaz (Nominatim snese nejvýš jeden za sekundu, 600 ms odmlky
je bezpečně nad limitem):

```typescript
  useEffect(() => {
    if (!dotazMista.trim()) {
      setNalezena([]);
      return;
    }
    const casovac = setTimeout(() => {
      najdiMisto(dotazMista).then(setNalezena).catch(() => setNalezena([]));
    }, 600);
    return () => clearTimeout(casovac);
  }, [dotazMista]);
```

A nad mapu vlož pole s výsledky. `stred` a `zoom` jsou stavy, které už
komponenta pro mapu má — přesun pohledu je jejich přenastavení:

```tsx
      <div className="pole">
        <label htmlFor="misto">Hledat obec nebo adresu</label>
        <input
          id="misto"
          value={dotazMista}
          onChange={(e) => setDotazMista(e.target.value)}
          placeholder="Zbůch"
        />
      </div>
      {nalezena.length > 0 && (
        <ul className="seznam-oblasti">
          {nalezena.map((m) => (
            <li key={`${m.lat},${m.lng}`}>
              <button
                className="tlacitko tise"
                onClick={() => {
                  setStred({ lat: m.lat, lng: m.lng });
                  setZoom(13);
                  setNalezena([]);
                  setDotazMista("");
                }}
              >
                {m.nazev}
              </button>
            </li>
          ))}
        </ul>
      )}
```

Pokud `MapaOblasti` po přesunu z Tasku 4 stav pohledu nedrží (pohled si
řídí `Mapa` sama), přidej ho: `const [stred, setStred] = useState(VYCHOZI.stred)`
a `const [zoom, setZoom] = useState(VYCHOZI.zoom)`, a předej je do `<Mapa>`.

- [ ] **Step 6: Ověř kontrolu typů a celou sadu**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 7: Ověř pohledem**

Run: `npm --prefix app run dev`

Napiš do pole „Zbůch“ — po krátké odmlce naskočí nabídka, kliknutím se
pohled přesune. Ověř, že se **při psaní neodesílá dotaz po každém písmenu**
(síťová karta v nástrojích prohlížeče: jeden dotaz po dopsání, ne pět).

- [ ] **Step 8: Commit**

```bash
git add app/src/hledaniMista.ts app/src/MapaOblasti.tsx test/hledani-mista.test.ts
git commit -m "feat: hledání obce v mapě přes Nominatim s odloženým dotazem"
```

---

## Co se v etapě B schválně nestaví

- **Dialog a proužek postupu** z návrhu designového systému. Dialog potřebuje
  až schválení a zrušení kampaně (krok 4), proužek až čekání na průzkum
  (krok 3) — obojí je etapa C. Stavět je teď by znamenalo psát součástku,
  kterou nikdo nevolá.
- **Značka „Průzkum dokončen"** v seznamu kampaní — stav `ceka_na_pruzkum`
  vzniká až v kroku 3.
- **Kroky 3 a 4** průvodce.

## Po dokončení všech úkolů

- [ ] **Spusť celou sadu a kontrolu typů**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Aktualizuj paměť**

`memory/stav.md` — etapa B hotová, další je B+ (naplánovaný běh Čmuchala).
`memory/rozhodnuti.md` — jen pokud během stavby padlo nové rozhodnutí.
`memory/poznatky.md` — gotchas z výřezu mapy a z pravidel přístupu.

- [ ] **Připrav HTML shrnutí pro majitele**

Do `docs/vizualizace/`, publikovat jako artifact. Musí obsahovat **výzvu
k ručnímu ověření pravidel**: přihlásit se jako `sasek@cantinero.cz`
a zkusit upravit cizí kampaň — nesmí to projít. Lokální testy to ověřit
neumí, protože PGlite nemá přihlašování.
