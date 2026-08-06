# Fronta AI průzkumu — plán

> **Pro agentní pracovníky:** POVINNÁ PODDOVEDNOST: použij
> `superpowers:subagent-driven-development` (doporučeno) nebo
> `superpowers:executing-plans` a odpracuj plán úkol po úkolu. Kroky jsou
> zaškrtávací (`- [ ]`).

**Zadání:** `docs/superpowers/specs/2026-08-06-fronta-ai-pruzkumu-design.md`

**Cíl:** Majitel si tlačítkem v kampani objedná rešerši; hlídka u hodin ji
vyzvedne a pustí Čmuchala neinteraktivně, bez čekání na chat.

**Architektura:** Nová tabulka `reserse` na vzoru `pruzkumy`. Jádro
(`src/reserse.ts`) umí vybrat firmy do dávky a přepínat stavy objednávky.
Spuštění agenta je **předaná závislost**, takže se dá v testech nahradit —
testuje se výběr a stavy, ne to, že jde spustit cizí program.

**Technologie:** TypeScript, ESM, PGlite/Postgres, Vitest, React 18, Supabase,
PowerShell (hlídka). Žádná nová závislost.

## Globální omezení

- **Čeština** v komentářích, testech i commit messages. Identifikátory česky
  bez diakritiky (`dalsiReserseKVyrizeni`).
- **TDD:** nejdřív test, pak implementace. `npm test` musí projít offline,
  bez env proměnných a bez sítě.
- **Migrace jen přidávat.** Nový soubor `supabase/migrations/0034_reserse.sql`;
  starší se needitují.
- **`app/src/` nesmí přes `src/` přitáhnout `db.ts` ani `repo.ts`** — hlídá
  `test/hranice-aplikace.test.ts`. Aplikace mluví se Supabase přímo, jak to
  dělá u `pruzkumy`.
- V `app/` se importy ze `src/` píšou BEZ přípony `.js`; v `src/` a `test/`
  S příponou.
- **Nic se neodesílá** (TP-8). Agent nemá odesílací nástroj a `sending_enabled`
  zůstává vypnuté.
- **Každý běh agenta do `agent_runs`** (TP-13).
- Aktivní data: `CANTINERO_DATA_DIR=data/pgdata-v5`. Testy ho nepotřebují.

## Struktura souborů

| Soubor | Odpovědnost |
|---|---|
| `supabase/migrations/0034_reserse.sql` (nový) | Tabulka objednávek, index fronty, pravidla přístupu. |
| `src/reserse.ts` (nový) | Výběr firem do dávky, přechody stavů, počítání úspěšnosti. |
| `test/reserse.test.ts` (nový) | Testy výběru a stavů nad PGlite. |
| `src/cmuchal-spousteni.ts` (nový) | Spuštění Claude Code jako proces. Jediné místo, které sahá na `child_process`. |
| `src/cli.ts` (změna) | Příkaz `reserse obsluz` — slepí jádro, spouštěč a oznámení. |
| `skripty/cmuchal-hlidka.ps1` (změna) | Přidat `reserse obsluz` do rotace. |
| `app/src/data.ts` (změna) | Objednání z aplikace, stav objednávky, čtyři nové údaje o firmě. |
| `app/src/SeznamFirem.tsx` + `PruvodceKampani.tsx` (změna) | Sloupce, filtr, tlačítko, stav běhu. |

---

### Úkol 1: Tabulka objednávek

**Soubory:**
- Vytvořit: `supabase/migrations/0034_reserse.sql`
- Test: `test/reserse.test.ts` (založí se tady, plní se v úkolu 2)

**Rozhraní:**
- Spotřebovává: funkci `public.smi_do_kampane(uuid)` z migrace 0024.
- Poskytuje: tabulku `reserse`. Úkoly 2 a 5 na ní stojí.

- [ ] **Krok 1: Napiš padající test**

Vytvoř `test/reserse.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";

// Čerstvá databáze na každý test — stejný vzor jako test/kampan-souhrn.test.ts.
let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("tabulka objednávek rešerše", () => {
  it("nová objednávka je ve stavu ceka", async () => {
    const k = await db.query<{ id: string }>(
      `insert into kampane (nazev, spravce) values ('K1','a@b.cz') returning id`,
    );
    const r = await db.query<{ stav: string; firem_zadano: number }>(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal)
       values ($1, 20, 'dohledej kontakt', 'a@b.cz')
       returning stav, firem_zadano`,
      [k[0]!.id],
    );
    expect(r[0]!.stav).toBe("ceka");
    expect(r[0]!.firem_zadano).toBe(20);
  });

  // Bez téhle podmínky by selhaná objednávka nikomu neřekla proč.
  it("selhání bez důvodu databáze nepustí", async () => {
    const k = await db.query<{ id: string }>(
      `insert into kampane (nazev, spravce) values ('K2','a@b.cz') returning id`,
    );
    await expect(
      db.query(
        `insert into reserse (kampan_id, firem_zadano, zadani, pozadal, stav)
         values ($1, 5, 'z', 'a@b.cz', 'selhalo')`,
        [k[0]!.id],
      ),
    ).rejects.toThrow();
  });

  it("dávka musí být kladná", async () => {
    const k = await db.query<{ id: string }>(
      `insert into kampane (nazev, spravce) values ('K3','a@b.cz') returning id`,
    );
    await expect(
      db.query(
        `insert into reserse (kampan_id, firem_zadano, zadani, pozadal)
         values ($1, 0, 'z', 'a@b.cz')`,
        [k[0]!.id],
      ),
    ).rejects.toThrow();
  });
});
```

Firmy v testech zakládej **jen přes `zalozFirmu`** ze `src/repo.js` (TP-1) —
přímý INSERT do `companies` je zakázaný a `test/kampan-souhrn.test.ts` ukazuje,
jak se to dělá včetně falešného záznamu z ARESu.

- [ ] **Krok 2: Spusť test a ověř, že padá**

```bash
npm test -- reserse
```

Očekávej: FAIL, `relation "reserse" does not exist`.

- [ ] **Krok 3: Napiš migraci**

Vytvoř `supabase/migrations/0034_reserse.sql`:

```sql
-- Fronta objednávek AI průzkumu.
--
-- Postavená na vzoru `pruzkumy` (0018), ale s jedním podstatným rozdílem:
-- průzkum vyřizuje kód, rešerši dělá agent. Obsluha proto práci neudělá
-- sama — spustí Claude Code a počká na něj (viz src/cmuchal-spousteni.ts).
--
-- Firmy se do dávky vybírají až při vyřízení, ne při objednání. Objednávka
-- tak nemůže zestárnout, když se kampaň mezitím změní.

create table reserse (
  id uuid primary key default gen_random_uuid(),
  kampan_id uuid not null references kampane(id) on delete cascade,
  stav text not null default 'ceka' check (stav in ('ceka','bezi','hotovo','selhalo')),
  firem_zadano int not null check (firem_zadano > 0),
  -- Co hledat. Zatím jedna výchozí věta odkazující na playbook; po zavedení
  -- profilů produktu (ADR 0002) sem přijde profil kampaně.
  zadani text not null,
  pozadal text not null,
  pozadano_at timestamptz not null default now(),
  zahajeno_at timestamptz,
  dokonceno_at timestamptz,
  run_id uuid references agent_runs(id),
  firem_zpracovano int,
  firem_s_nalezem int,
  chyba text,
  constraint selhani_ma_chybu check (stav <> 'selhalo' or chyba is not null)
);

create index reserse_fronta_idx on reserse (stav, pozadano_at);

alter table reserse enable row level security;

create policy reserse_cteni on reserse
  for select to authenticated using (true);

-- Zapisovat smí správce kampaně, jeho zástup a admin — stejně jako
-- u firem v kampani.
create policy reserse_zapis on reserse
  for all to authenticated
  using (public.smi_do_kampane(kampan_id))
  with check (public.smi_do_kampane(kampan_id));
```

- [ ] **Krok 4: Spusť test a ověř, že prošel**

```bash
npm test -- reserse
```

Očekávej: PASS, 3 testy.

- [ ] **Krok 5: Spusť celou sadu**

```bash
npm test
```

Očekávej: PASS. Migrace se v testech aplikuje automaticky; kdyby ne, podívej
se, jak to dělá `test/db.test.ts`.

- [ ] **Krok 6: Commit**

```bash
git add supabase/migrations/0034_reserse.sql test/reserse.test.ts
git commit -m "feat: tabulka objednávek AI průzkumu"
```

---

### Úkol 2: Jádro fronty — výběr firem a přechody stavů

**Soubory:**
- Vytvořit: `src/reserse.ts`
- Změnit: `test/reserse.test.ts`

**Rozhraní:**
- Spotřebovává: tabulku `reserse` z úkolu 1, typ `Db` ze `src/db.js`.
- Poskytuje (úkol 3 na tom stojí):

```ts
export interface Reserse {
  id: string; kampanId: string;
  stav: "ceka" | "bezi" | "hotovo" | "selhalo";
  firemZadano: number; zadani: string; pozadal: string;
}
export interface FirmaKReserse { ico: string; nazev: string; skore: number | null }

export function dalsiReserseKVyrizeni(db: Db): Promise<Reserse | null>;
export function firmyProReserse(db: Db, kampanId: string, limit: number): Promise<FirmaKReserse[]>;
export function zahajReserse(db: Db, id: string, runId: string): Promise<void>;
export function uzavriReserse(db: Db, id: string, v: { firemZpracovano: number; firemSNalezem: number }): Promise<void>;
export function selhalaReserse(db: Db, id: string, chyba: string): Promise<void>;
export function pocetSeSpojenim(db: Db, ica: readonly string[]): Promise<number>;
```

- [ ] **Krok 1: Napiš padající testy**

Do `test/reserse.test.ts` přidej nový blok. Pomocníky na zakládání firem si
opiš ze sousedního testu (`test/kampan-souhrn.test.ts`) — firma musí vzniknout
přes `zalozFirmu`, přímé INSERTy do `companies` jsou zakázané (TP-1):

```ts
describe("výběr firem do dávky", () => {
  it("vezme jen firmy z kampaně, které rešerší neprošly", async () => {
    const { kampanId, ica } = await pripravKampan(db, [
      { ico: "25232657", obohaceno: false },
      { ico: "48362956", obohaceno: true },
    ]);
    const v = await firmyProReserse(db, kampanId, 10);
    expect(v.map((f) => f.ico)).toEqual(["25232657"]);
    expect(ica).toHaveLength(2);
  });

  // Vyřazení už dnes znamená „tuhle neoslovovat". Pouštět na ni rešerši
  // je zbytečná práce a majitel to výslovně rozhodl (2026-08-04).
  it("vyřazenou firmu do dávky nedá", async () => {
    const { kampanId } = await pripravKampan(db, [
      { ico: "25232657", obohaceno: false, vyrazena: true },
      { ico: "48362956", obohaceno: false },
    ]);
    const v = await firmyProReserse(db, kampanId, 10);
    expect(v.map((f) => f.ico)).toEqual(["48362956"]);
  });

  it("respektuje velikost dávky a řadí podle skóre sestupně", async () => {
    const { kampanId } = await pripravKampan(db, [
      { ico: "25232657", obohaceno: false, skore: 10 },
      { ico: "48362956", obohaceno: false, skore: 50 },
      { ico: "17439523", obohaceno: false, skore: 30 },
    ]);
    const v = await firmyProReserse(db, kampanId, 2);
    expect(v.map((f) => f.ico)).toEqual(["48362956", "17439523"]);
  });
});

describe("přechody stavů objednávky", () => {
  it("fronta bere nejstarší čekající", async () => {
    const { kampanId } = await pripravKampan(db, []);
    await db.query(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal, pozadano_at)
       values ($1, 5, 'z', 'a@b.cz', now() - interval '1 hour')`,
      [kampanId],
    );
    await db.query(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal)
       values ($1, 5, 'z', 'a@b.cz')`,
      [kampanId],
    );
    const p = await dalsiReserseKVyrizeni(db);
    expect(p?.firemZadano).toBe(5);
    const vsechny = await db.query<{ pocet: number }>(
      "select count(*)::int as pocet from reserse where stav = 'ceka'",
    );
    expect(vsechny[0]!.pocet).toBe(2);
  });

  // Po pádu procesu zůstane objednávka v 'bezi' a nikdo ji nečeká. Kdyby si
  // ji fronta nevzala, visela by navždy — stejné rozhodnutí jako u průzkumu.
  it("bere i objednávku uvíznutou ve stavu bezi", async () => {
    const { kampanId } = await pripravKampan(db, []);
    await db.query(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal, stav)
       values ($1, 5, 'z', 'a@b.cz', 'bezi')`,
      [kampanId],
    );
    expect(await dalsiReserseKVyrizeni(db)).not.toBeNull();
  });

  it("hotovou objednávku už nebere", async () => {
    const { kampanId } = await pripravKampan(db, []);
    await db.query(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal, stav)
       values ($1, 5, 'z', 'a@b.cz', 'hotovo')`,
      [kampanId],
    );
    expect(await dalsiReserseKVyrizeni(db)).toBeNull();
  });

  it("uzavření zapíše počty a čas", async () => {
    const { kampanId } = await pripravKampan(db, []);
    const r = await db.query<{ id: string }>(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal)
       values ($1, 5, 'z', 'a@b.cz') returning id`,
      [kampanId],
    );
    await uzavriReserse(db, r[0]!.id, { firemZpracovano: 5, firemSNalezem: 4 });
    const po = await db.query<{ stav: string; firem_s_nalezem: number; dokonceno_at: string }>(
      "select stav, firem_s_nalezem, dokonceno_at::text from reserse where id = $1",
      [r[0]!.id],
    );
    expect(po[0]!.stav).toBe("hotovo");
    expect(po[0]!.firem_s_nalezem).toBe(4);
    expect(po[0]!.dokonceno_at).not.toBeNull();
  });

  it("selhání zapíše důvod", async () => {
    const { kampanId } = await pripravKampan(db, []);
    const r = await db.query<{ id: string }>(
      `insert into reserse (kampan_id, firem_zadano, zadani, pozadal)
       values ($1, 5, 'z', 'a@b.cz') returning id`,
      [kampanId],
    );
    await selhalaReserse(db, r[0]!.id, "Claude Code se nepodařilo spustit");
    const po = await db.query<{ stav: string; chyba: string }>(
      "select stav, chyba from reserse where id = $1",
      [r[0]!.id],
    );
    expect(po[0]!.stav).toBe("selhalo");
    expect(po[0]!.chyba).toContain("nepodařilo spustit");
  });
});
```

Pomocník `pripravKampan(db, firmy)` napiš nahoře v souboru: založí kampaň,
firmy přes `zalozFirmu`, vloží je do `kampan_firmy`, u `obohaceno: true`
nastaví `companies.obohaceno_at = now()`, u `vyrazena: true` nastaví
`kampan_firmy.stav = 'vyrazena'` s důvodem, a vrátí `{ kampanId, ica }`.

- [ ] **Krok 2: Spusť testy a ověř, že padají**

```bash
npm test -- reserse
```

Očekávej: FAIL, `Cannot find module '../src/reserse.js'`.

- [ ] **Krok 3: Napiš modul**

Vytvoř `src/reserse.ts`:

```ts
/**
 * Fronta objednávek AI průzkumu.
 *
 * Vzor je `src/fronta.ts` pro průzkum, ale s jedním rozdílem: tenhle modul
 * práci nedělá. Umí jen vybrat firmy do dávky a přepínat stavy — samotné
 * spuštění agenta je jinde (`src/cmuchal-spousteni.ts`), aby šlo v testech
 * nahradit.
 */
import type { Db } from "./db.js";

export interface Reserse {
  id: string;
  kampanId: string;
  stav: "ceka" | "bezi" | "hotovo" | "selhalo";
  firemZadano: number;
  zadani: string;
  pozadal: string;
}

export interface FirmaKReserse {
  ico: string;
  nazev: string;
  skore: number | null;
}

const SLOUPCE = `id, kampan_id as "kampanId", stav,
  firem_zadano as "firemZadano", zadani, pozadal`;

/**
 * Co si má obsluha z fronty vzít — nejstarší čekající.
 *
 * Bere i objednávky ve stavu 'bezi': v tom stavu zůstane objednávka po pádu
 * procesu a nikdo ji nečeká. Kdyby si ji fronta nevzala, visela by navždy.
 * Totéž rozhodnutí jako u průzkumu (`src/fronta.ts`).
 */
export async function dalsiReserseKVyrizeni(db: Db): Promise<Reserse | null> {
  const r = await db.query<Reserse>(
    `select ${SLOUPCE} from reserse
     where stav in ('ceka','bezi')
     order by pozadano_at
     limit 1`,
  );
  return r[0] ?? null;
}

/**
 * Firmy, které mají jít na rešerši: v kampani, NEvyřazené, bez razítka
 * `obohaceno_at`. Nejlepší napřed.
 *
 * Vyřazená firma je vyřazená i pro rešerši — vyřazení znamená „tuhle
 * neoslovovat" a dohledávat na ni kontakt je zbytečná práce (rozhodnutí
 * majitele 2026-08-04).
 */
export async function firmyProReserse(
  db: Db,
  kampanId: string,
  limit: number,
): Promise<FirmaKReserse[]> {
  return db.query<FirmaKReserse>(
    `select c.ico, c.nazev, c.skore
     from kampan_firmy kf
     join companies c on c.ico = kf.ico
     where kf.kampan_id = $1
       and kf.stav = 'vybrana'
       and c.obohaceno_at is null
     order by c.skore desc nulls last, c.ico
     limit $2`,
    [kampanId, limit],
  );
}

export async function zahajReserse(db: Db, id: string, runId: string): Promise<void> {
  await db.query(
    `update reserse set stav = 'bezi', zahajeno_at = now(), run_id = $2 where id = $1`,
    [id, runId],
  );
}

export async function uzavriReserse(
  db: Db,
  id: string,
  v: { firemZpracovano: number; firemSNalezem: number },
): Promise<void> {
  await db.query(
    `update reserse set stav = 'hotovo', dokonceno_at = now(),
       firem_zpracovano = $2, firem_s_nalezem = $3
     where id = $1`,
    [id, v.firemZpracovano, v.firemSNalezem],
  );
}

export async function selhalaReserse(db: Db, id: string, chyba: string): Promise<void> {
  await db.query(
    `update reserse set stav = 'selhalo', dokonceno_at = now(), chyba = $2 where id = $1`,
    [id, chyba],
  );
}

/** Kolik z daných firem má doložené spojení (e-mail nebo telefon). */
export async function pocetSeSpojenim(db: Db, ica: readonly string[]): Promise<number> {
  if (ica.length === 0) return 0;
  const r = await db.query<{ pocet: number }>(
    `select count(distinct k.ico)::int as pocet from contacts k
     where k.ico = any($1) and (k.email is not null or k.telefon is not null)`,
    [ica as string[]],
  );
  return r[0]?.pocet ?? 0;
}
```

- [ ] **Krok 4: Spusť testy a ověř, že prošly**

```bash
npm test -- reserse
```

Očekávej: PASS.

- [ ] **Krok 5: Commit**

```bash
git add src/reserse.ts test/reserse.test.ts
git commit -m "feat: jádro fronty AI průzkumu — výběr firem a stavy"
```

---

### Úkol 3: Spuštění agenta a příkaz `reserse obsluz`

**Soubory:**
- Vytvořit: `src/cmuchal-spousteni.ts`
- Změnit: `src/cli.ts`

**Rozhraní:**
- Spotřebovává: vše z úkolu 2; `zamkni`/`odemkni` ze `src/fronta.js`;
  `zacniBeh`/`ukonciBeh` (podívej se, odkud je bere `src/nalezy.ts`).
- Poskytuje: `spustCmuchala(v): Promise<VysledekSpusteni>` a příkaz
  `npm run cli -- reserse obsluz`. Úkol 4 ten příkaz volá.

- [ ] **Krok 1: Napiš spouštěč**

Vytvoř `src/cmuchal-spousteni.ts`:

```ts
/**
 * Spuštění Čmuchala neinteraktivně.
 *
 * **Jediné místo v projektu, které spouští cizí proces.** Je oddělené proto,
 * aby šlo v testech nahradit — testovat se má výběr firem a stavy fronty,
 * ne to, že jde spustit Claude Code.
 *
 * Ověřeno 2026-08-06 na Claude Code 2.1.220: `-p` je neinteraktivní režim,
 * `--agent` vybere agenta z `.claude/agents/`, `--output-format json` vrátí
 * strojově čitelný výsledek.
 */
import { spawn } from "node:child_process";

export interface VysledekSpusteni {
  ok: boolean;
  chyba: string | null;
}

/**
 * Nástroje, které agent při rešerši dostane. Nic víc spustit nesmí.
 *
 * Z příkazové řádky jen dva příkazy: vzít si práci a zapsat nálezy. Oba
 * procházejí kontrolou, která vyžaduje zdroj a doslovnou citaci — proto na
 * nich nezáleží, co si model myslí.
 */
const POVOLENE_NASTROJE = [
  "WebSearch",
  "WebFetch",
  "Read",
  "Write",
  "Bash(npm run cli -- k-obohaceni*)",
  "Bash(npm run cli -- zapis-nalezy*)",
];

/** Strop: dvojnásobek naměřených 64 s na firmu, nejméně deset minut. */
export function stropMs(firem: number): number {
  return Math.max(600_000, firem * 128_000);
}

export async function spustCmuchala(v: {
  prompt: string;
  koren: string;
  stropMs: number;
}): Promise<VysledekSpusteni> {
  return new Promise((hotovo) => {
    const proces = spawn(
      "claude",
      [
        "-p",
        v.prompt,
        "--agent",
        "cmuchal",
        "--output-format",
        "json",
        "--allowedTools",
        ...POVOLENE_NASTROJE,
      ],
      { cwd: v.koren, shell: true },
    );

    let chyboryStdout = "";
    proces.stderr.on("data", (d) => {
      chyboryStdout += String(d);
    });

    const casovac = setTimeout(() => {
      proces.kill();
      hotovo({
        ok: false,
        chyba:
          `Čmuchal nedoběhl do ${Math.round(v.stropMs / 60_000)} minut a byl ukončen. ` +
          `Dávka mohla zůstat rozdělaná — firmy bez razítka půjdou znovu.`,
      });
    }, v.stropMs);

    proces.on("error", (e) => {
      clearTimeout(casovac);
      hotovo({
        ok: false,
        chyba:
          `Claude Code se nepodařilo spustit (${e.message}). ` +
          `Je nainstalovaný a přihlášený na tomhle počítači?`,
      });
    });

    proces.on("close", (kod) => {
      clearTimeout(casovac);
      if (kod === 0) hotovo({ ok: true, chyba: null });
      else
        hotovo({
          ok: false,
          chyba: `Čmuchal skončil s chybou ${kod}: ${chyboryStdout.slice(0, 500) || "bez výstupu"}`,
        });
    });
  });
}
```

- [ ] **Krok 2: Přidej příkaz do CLI**

V `src/cli.ts` přidej k importům `src/reserse.js` a `src/cmuchal-spousteni.js`,
a přidej větev pro `reserse` vedle stávající větve `pruzkum`. Tělo:

```ts
if (prikaz === "reserse" && akce === "obsluz") {
  const drzitel = `${hostname()}:${process.pid}`;
  // Stejný zámek jako průzkum — obojí dělá Čmuchal a chodí na cizí weby.
  // Důsledek: dlouhá rešerše pozdrží průzkum a naopak. Záměr, ne opomenutí.
  if (!(await zamkni(db, ZAMEK_CMUCHAL, drzitel))) {
    console.log("Čmuchal už běží jinde — tenhle běh nic nedělá.");
    return;
  }
  try {
    const o = await dalsiReserseKVyrizeni(db);
    if (!o) {
      console.log("Fronta rešerší je prázdná.");
      return;
    }

    const firmy = await firmyProReserse(db, o.kampanId, o.firemZadano);
    if (firmy.length === 0) {
      // Prázdná dávka není selhání — všechny firmy už rešerší prošly.
      await uzavriReserse(db, o.id, { firemZpracovano: 0, firemSNalezem: 0 });
      console.log(`Objednávka ${o.id}: žádná firma nečeká, uzavírám.`);
      return;
    }

    const ica = firmy.map((f) => f.ico);
    const predtim = await pocetSeSpojenim(db, ica);

    const behId = await zacniBeh(db, "cmuchal-reserse", {
      objednavka: o.id,
      firem: firmy.length,
    });
    await zahajReserse(db, o.id, behId);

    const prompt =
      `${o.zadani}\n\nFirmy (IČO): ${ica.join(", ")}\n` +
      `Vezmi si je příkazem k-obohaceni, nálezy zapiš příkazem zapis-nalezy.`;

    console.log(`Objednávka ${o.id}: ${firmy.length} firem, pouštím Čmuchala…`);
    const v = await spustCmuchala({
      prompt,
      koren: process.cwd(),
      stropMs: stropMs(firmy.length),
    });

    const potom = await pocetSeSpojenim(db, ica);
    const pribylo = potom - predtim;

    if (v.ok) {
      await uzavriReserse(db, o.id, {
        firemZpracovano: firmy.length,
        firemSNalezem: pribylo,
      });
      console.log(`  hotovo — spojení přibylo u ${pribylo} z ${firmy.length}`);
    } else {
      await selhalaReserse(db, o.id, v.chyba ?? "neznámá chyba");
      console.log(`  selhalo: ${v.chyba}`);
    }
    await ukonciBeh(db, behId, { firem: firmy.length, pribylo }, [], 0);
  } finally {
    await odemkni(db, ZAMEK_CMUCHAL, drzitel);
  }
  return;
}
```

**Pozor:** přesný tvar `zacniBeh`/`ukonciBeh` a to, jak `cli.ts` větví příkazy,
si ověř ve zdrojích — kód výš je vzor, ne doslovný zápis. Podívej se, jak to
dělá větev `pruzkum obsluz` kolem řádku 909, a drž se téhož stylu. Do nápovědy
na konci `cli.ts` přidej řádek:

```
  reserse obsluz                   vyřídí jednu objednávku AI průzkumu
                                   (spustí Čmuchala neinteraktivně)
```

- [ ] **Krok 3: Ověř**

```bash
npm run typecheck
```
Očekávej: bez chyb.

```bash
npm test
```
Očekávej: PASS.

```bash
npm run cli -- reserse obsluz
```
Očekávej: `Fronta rešerší je prázdná.` — žádná objednávka zatím neexistuje.
**Nesmí to spustit Claude Code.**

- [ ] **Krok 4: Commit**

```bash
git add src/cmuchal-spousteni.ts src/cli.ts
git commit -m "feat: obsluha fronty AI průzkumu spouští Čmuchala neinteraktivně"
```

---

### Úkol 4: Hlídka a oznámení

**Soubory:**
- Změnit: `skripty/cmuchal-hlidka.ps1`

**Rozhraní:**
- Spotřebovává: příkaz `reserse obsluz` z úkolu 3.
- Poskytuje: nic dalšího.

- [ ] **Krok 1: Přidej rešerši do rotace**

V `skripty/cmuchal-hlidka.ps1` je funkce `Spust`, která volí přepínače podle
toho, jestli jde o urgentní běh. Řádný běh dnes spouští jen průzkum:

```powershell
"pruzkum obsluz --nejvyse-objednavek 3"
```

Změň řádný běh tak, aby po průzkumu vyřídil i jednu objednávku rešerše:

```powershell
"pruzkum obsluz --nejvyse-objednavek 3 & npm run cli -- reserse obsluz"
```

**Urgentní běh nech beze změny** — ten se pouští každých deset minut a rešerše
trvá desítky minut; pustit ji tam by znamenalo, že hlídka bude pořád zaneprázdněná.

**Soubor má UTF-8 BOM a musí ho mít i po úpravě** — PowerShell 5.1 čte `.ps1`
jako ANSI a česká písmena by se rozsypala ([[powershell-ps1-potrebuje-bom]]).
Ověř to po uložení; kdyby BOM zmizel, vrať ho.

- [ ] **Krok 2: Ověř, že se skript načte**

```bash
powershell -NoProfile -Command "\$null = [ScriptBlock]::Create((Get-Content -Raw skripty/cmuchal-hlidka.ps1)); 'skript se načetl'"
```
Očekávej: `skript se načetl`. Čeština v hláškách musí zůstat čitelná.

- [ ] **Krok 3: Commit**

```bash
git add skripty/cmuchal-hlidka.ps1
git commit -m "feat: hlídka vyřizuje i objednávky AI průzkumu"
```

---

### Úkol 5: Aplikace — čtyři údaje o firmě, tlačítko a stav objednávky

**Soubory:**
- Změnit: `app/src/data.ts`, `app/src/SeznamFirem.tsx`, `app/src/PruvodceKampani.tsx`

**Rozhraní:**
- Spotřebovává: tabulku `reserse` z úkolu 1.
- Poskytuje: nic dalšího — poslední úkol.

- [ ] **Krok 1: Doplň údaje o rešerši do načtení firem**

V `app/src/data.ts` rozšiř typ `Firma` o dvě pole a doplň je do dotazu
v `nactiFirmy`:

```ts
  /** Kdy firma naposledy prošla rešerší; `null` = neprošla nikdy. */
  obohaceno_at: string | null;
```

Kontakty se už načítají (`contacts`), takže „známe jednatele" a „má spojení"
jde odvodit. Přidej k tomu čisté pomocné funkce:

```ts
/** Stav rešerše u firmy — tři možnosti, které majitel chtěl rozlišit. */
export type StavReserse = "neprosla" | "prosla_se_spojenim" | "prosla_bez_spojeni";

export function stavReserse(f: {
  obohaceno_at: string | null;
  maSpojeni: boolean;
}): StavReserse {
  if (f.obohaceno_at === null) return "neprosla";
  return f.maSpojeni ? "prosla_se_spojenim" : "prosla_bez_spojeni";
}
```

**Pozor na strop řádků** — `nactiFirmy` už stránkuje, nová pole na tom nic
nemění, jen je nezapomeň přidat do `select` ([[postgrest-strop-na-radky]]).

- [ ] **Krok 2: Přidej sloupce a filtr do seznamu firem**

V `app/src/SeznamFirem.tsx` přidej sloupec **Rešerše** se třemi stavy
a k němu filtr „nerozhoduje / neprošla / prošla se spojením / prošla bez
spojení". Stav kóduj **barvou i tvarem**, ne jen textem — použij stávající
třídy `stav` a `znak`, jak to dělá sloupec „Stav":

- neprošla → neutrální, text „neprošla"
- prošla se spojením → `je-hotovo`, text „prošla · spojení"
- prošla bez spojení → `je-zamitnuty`, text „prošla · bez stopy"

Datum přidej jako `title` u buňky, ať se dá najet myší; samostatný sloupec by
tabulku roztáhl. Sloupec **Známe jednatele** nedělej samostatný — to už
ukazuje stávající sloupec „Spojení".

- [ ] **Krok 3: Přidej objednání a stav do data.ts**

```ts
export interface ObjednavkaReserse {
  id: string;
  stav: "ceka" | "bezi" | "hotovo" | "selhalo";
  firemZadano: number;
  firemZpracovano: number | null;
  firemSNalezem: number | null;
  chyba: string | null;
}

/** Výchozí zadání. Odkazuje na playbook schválně — ten se mění, tohle ne. */
const ZADANI_VYCHOZI =
  "Dohledej u každé firmy kontaktní osobu a spojení na ni podle svého " +
  "playbooku. Nic navíc nesbírej.";

export async function objednejReserse(
  kampanId: string,
  firemZadano: number,
  pozadal: string,
): Promise<void> {
  const { error } = await supabase.from("reserse").insert({
    kampan_id: kampanId,
    firem_zadano: firemZadano,
    zadani: ZADANI_VYCHOZI,
    pozadal,
  });
  if (error) throw new Error(error.message);
}

/** Poslední objednávka kampaně, nebo `null`. */
export async function posledniReserse(kampanId: string): Promise<ObjednavkaReserse | null> {
  const { data, error } = await supabase
    .from("reserse")
    .select("id,stav,firem_zadano,firem_zpracovano,firem_s_nalezem,chyba")
    .eq("kampan_id", kampanId)
    .order("pozadano_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const r = data?.[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    id: r.id as string,
    stav: r.stav as ObjednavkaReserse["stav"],
    firemZadano: r.firem_zadano as number,
    firemZpracovano: (r.firem_zpracovano as number | null) ?? null,
    firemSNalezem: (r.firem_s_nalezem as number | null) ?? null,
    chyba: (r.chyba as string | null) ?? null,
  };
}
```

- [ ] **Krok 4: Přidej nabídku do 4. kroku průvodce**

V `app/src/PruvodceKampani.tsx`, pod stávající panel čekajících firem
(hledej `cekajici.bezVelikosti + cekajici.mikro > 0`), přidej druhý panel.
Počet neprozkoumaných spočítej z `udajeFirem` přes `stavReserse`.

Když objednávka **běží nebo čeká**, ukaž místo tlačítek její stav:

```tsx
{!zamcena && objednavka && ["ceka", "bezi"].includes(objednavka.stav) ? (
  <p className="hlaska je-klid">
    <strong>AI průzkum {objednavka.stav === "bezi" ? "běží" : "čeká ve frontě"}</strong> —
    {" "}{objednavka.firemZadano.toLocaleString("cs")}{" "}
    {cesky(objednavka.firemZadano, "firma", "firmy", "firem")}. Hlídka u hodin
    se na frontu dívá třikrát denně. Okno můžete zavřít.
  </p>
) : (
  /* nabídka s tlačítky — viz níž */
)}
```

Nabídka s tlačítky (výchozí dávka 20, druhé tlačítko na zbytek). Potvrzovací
dialog udělej stejným způsobem jako u přidávání firem — `zaclona`/`dialog`,
s odhadem času (`neprozkoumanych × 64 s`) a s větou, že to poběží bez dozoru.

Když poslední objednávka **selhala**, ukaž nad nabídkou `hlaska` s `role="alert"`
a textem chyby, ať majitel ví, proč se nic nestalo.

- [ ] **Krok 5: Ověř**

```bash
npm run typecheck
```
Očekávej: bez chyb.

```bash
npm run build --prefix app
```
Očekávej: úspěch.

```bash
npm test
```
Očekávej: PASS.

- [ ] **Krok 6: Commit**

```bash
git add app/src/data.ts app/src/SeznamFirem.tsx app/src/PruvodceKampani.tsx
git commit -m "feat: objednání AI průzkumu z kampaně a stav rešerše u firem"
```

---

## Nasazení a ověření s majitelem

Testy tuhle práci nekryjí celou — hlídka je PowerShell, obrazovka React
a spuštění agenta je cizí proces.

- [ ] **Nasaď migraci:** `npm run cli -- migrate`. Bez toho aplikace na
      `reserse` nedosáhne a objednání spadne.
- [ ] `npm run dev --prefix app`, majitel se přihlásí v panelu Browser.
- [ ] Otevři **Kampaň Hrobce**, 4. krok. Sloupec Rešerše ukazuje u firem
      „neprošla".
- [ ] Objednej **5 firem**. Řádek se přepne na „AI průzkum čeká ve frontě".
- [ ] Spusť ručně `npm run cli -- reserse obsluz` (nečekej na hlídku).
      **Sleduj, že se opravdu spustí Claude Code** a doběhne.
- [ ] Po doběhnutí: objednávka je `hotovo`, u firem přibylo razítko a sloupec
      se přepnul. **V kartotéce zkontroluj u dvou firem, že nový kontakt má
      zdroj i doslovnou citaci** — to je jediná pojistka proti tomu, že si
      agent něco vymyslel.
- [ ] Zkus **objednávku na kampani, kde nic nečeká** — musí skončit `hotovo`
      s nulou, ne `bezi`.

## Sebekontrola plánu

| Kapitola zadání | Kde se plní |
|---|---|
| 3. Co uvidí majitel (nabídka, dávka 20, stav běhu) | Úkol 5, kroky 4 |
| 4. Čtyři údaje o firmě | Úkol 5, kroky 1–2 |
| 5. Fronta (tabulka, stavy, přístup) | Úkoly 1 a 2 |
| 5.1 Co je v `zadani` | Úkol 5, krok 3 (`ZADANI_VYCHOZI`) |
| 6. Kdo vyřídí (Claude Code, kroky 1–5) | Úkol 3 |
| 6. Meze: strop, nástroje, chybějící Claude Code | Úkol 3, krok 1 |
| 7. Bezpečnost (zápis přes `zapis-nalezy`, `agent_runs`) | Úkol 3, krok 2 |
| 8. Oznámení u hodin | **Viz níž** |
| 9. Co se nemění | Nikde se nesahá na odesílání ani na whitelist |
| 10. Testy (7 případů) | Úkoly 1 a 2 — je jich 9 |
| 11. Hotovo | Sekce Nasazení a ověření |

**Odchylka od zadání — oznámení u hodin (kap. 8).** Zadání ho slibuje, plán
ho nestaví. Důvod: hlídka čte výsledky z výstupního souboru, který skládá
`pruzkum obsluz`; napojit na to rešerši znamená sáhnout do `src/oznameni.ts`
a do formátu toho souboru, což je vlastní práce a zvětšilo by tenhle plán
o pátý dotčený subsystém. **Bez oznámení se dá žít** — stav objednávky je
vidět v kampani. Navrhuju to jako samostatný úkol hned potom; kdyby to majiteli
vadilo, přidá se do úkolu 4.

**Sloupec „Známe jednatele" se nestaví samostatně** (zadání kap. 4). Ukazuje
to už stávající sloupec „Spojení"; další sloupec s týmž obsahem by tabulku
jen roztáhl. Kdyby to majiteli nestačilo, je to jednořádková změna.
