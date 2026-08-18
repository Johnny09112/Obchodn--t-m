# Krok „Zpráva“ u kampaně — plán druhé dodávky

> **Pro agentní pracovníky:** POVINNÝ PODSKILL: použij
> superpowers:subagent-driven-development (doporučeno) nebo
> superpowers:executing-plans a odpracuj plán úkol po úkolu.

**Cíl:** U kampaně přibude pátý krok, ve kterém se vybere šablona, určí se
čím se vyplní jednotlivá pole, ukáže se hotový mail na skutečné firmě
a vypíše se, které firmy z kampaně vypadnou a proč.

**Architektura:** Pole šablony (`pole_sablony`) a jejich nastavení
u kampaně (`nastaveni_pole`) jsou data, ne kód. Skládání zprávy je čistá
funkce nad načtenými údaji, aby šla otestovat bez sítě. Zdroje pro režim
„vzít z dat“ jsou dané kódem — každý je dotaz — ale **parametry nabídky
jsou mezi nimi automaticky**, takže nový parametr je hned použitelný.

**Technologie:** TypeScript, PGlite/Postgres, React + Supabase, Vitest.

**Zadání:** `docs/superpowers/specs/2026-08-18-nastaveni-zpravy-design.md`
**Předchozí dodávka:** `docs/superpowers/plans/2026-08-18-parametry-nabidky.md`

> **Poznámka o hloubce zápisu.** Úkoly 1–5 nesou rozhodnutí, která by se
> jinak ztratila (pravidla oslovení, výpočet ceny, co znamená „chybí“),
> a jsou rozepsané do kroků včetně kódu. Úkoly 6–9 jsou obvyklá práce
> podle vzorů, které v repozitáři existují (`cmdParametry`, `OknoParametru`),
> a jsou zapsané jako osnova. Píšu to nahlas, aby si to nikdo nespletl
> s nedodělkem: rozhodnutí jsou v plánu, opisování vzorů ne.

## Globální omezení

- **Jazyk:** čeština všude, identifikátory bez diakritiky.
- **TDD:** nejdřív test. `npm test` offline, bez env proměnných.
- **Migrace jen přidávat.** Další volné číslo je **0048**.
- **Pravidlo, které má hlídat i obrazovku, patří do databáze** — aplikace
  na `src/` nedosáhne ([[pravidlo-v-jadru-nehlida-obrazovku]]). V téhle
  dodávce se ale **nic neukládá do zprávy**, jen se skládá náhled, takže
  většina pravidel je čtecí a v jádře je správně.
- **Odesílání zůstává vypnuté** (TP-8). Tenhle celek staví náhled, ne odesílání.
- **Ostrá data v cloudu:** `set -a && . ~/.cantinero/.env && set +a && npm run cli -- …`
  Lokální běh vyžaduje `DATABASE_URL=` (prázdnou), jinak se sáhne naostro.
- **Hotovo** = `npm test`, `npm run typecheck`, proklikání v prohlížeči,
  `npm run build --prefix app`.

## Co je v datech (ověřeno 18. 8.)

| Údaj | Hodnota |
|---|---|
| Kvalifikovaných firem | 165 |
| Z toho s e-mailem | 78 |
| Z toho s příjmením | 39 |
| S doloženým oborem | 62 |
| Ceny u jídelen | 95 · 100 · 105 · 105 · 100 Kč |
| Provize | 15 Kč u všech |
| Možnosti výdeje | u všech „na místě“ + „do vlastního jídlonosiče“ |

**Cena pro firmu = cena oběda + provize** (rozhodl majitel 18. 8.), tedy
110–120 Kč. Nejnižší je 110, ceny se liší → v mailu bude **„od 110 Kč“**.

## Struktura souborů

| Soubor | Za co odpovídá |
|---|---|
| `supabase/migrations/0048_pole_sablony.sql` | `pole_sablony`, `nastaveni_pole`, `kampane.template_id`, pátý krok průvodce, osazení polí dnešní šablony |
| `src/osloveni.ts` | české oslovení z příjmení — jen bezpečná pravidla, jinak „Dobrý den,“ |
| `src/zprava.ts` | zdroje údajů, cena kampaně, složení náhledu, výčet vyřazených firem |
| `app/src/KrokZprava.tsx` | pátý krok průvodce |
| `app/src/data.ts` | čtení a ukládání nastavení polí |
| `app/src/PruvodceKampani.tsx` | zapojení kroku |

`osloveni.ts` je zvlášť, protože je to jazyková věc s vlastními pravidly
a vlastní sadou testů; do skládání zprávy by se to zamotalo.

---

### Úkol 1: České oslovení z příjmení

**Soubory:**
- Vytvořit: `src/osloveni.ts`
- Test: `test/osloveni.test.ts`

**Rozhraní:**
- Poskytuje: `osloveni(prijmeni: string | null): string` — vrací celý řádek
  včetně čárky, tedy `"Vážená paní Nováková,"` nebo `"Dobrý den,"`

**Proč konzervativně:** oslovit někoho špatně skloňovaným jménem je horší
než ho neoslovit jménem vůbec. Skloňuje se jen tam, kde je pravidlo
jednoznačné; u zbytku se vrátí „Dobrý den,“, což není nikdy chyba.

- [ ] **Krok 1: Napiš padající test**

```typescript
import { describe, expect, it } from "vitest";
import { osloveni } from "../src/osloveni.js";

describe("české oslovení", () => {
  it("ženské příjmení na -ová se neskloňuje", () => {
    expect(osloveni("Nováková")).toBe("Vážená paní Nováková,");
    expect(osloveni("Dvořáková")).toBe("Vážená paní Dvořáková,");
  });

  it("mužské příjmení na -a má vokativ na -o", () => {
    expect(osloveni("Procházka")).toBe("Vážený pane Procházko,");
    expect(osloveni("Blecha")).toBe("Vážený pane Blecho,");
  });

  it("přídavné jméno na -ý zůstává beze změny", () => {
    expect(osloveni("Buranský")).toBe("Vážený pane Buranský,");
  });

  it("příjmení na -r a -l má vokativ na -e", () => {
    expect(osloveni("Bayer")).toBe("Vážený pane Bayere,");
    expect(osloveni("Redl")).toBe("Vážený pane Redle,");
  });

  it("nejisté tvary raději neskloňuje a osloví obecně", () => {
    // -ek a -ec mají vypadávající -e- (Duchek → Duchku, Drnec → Drnče)
    // a výjimek je tolik, že se to nedá spolehlivě uhodnout.
    expect(osloveni("Duchek")).toBe("Dobrý den,");
    expect(osloveni("Drnec")).toBe("Dobrý den,");
    expect(osloveni("Janíček")).toBe("Dobrý den,");
  });

  it("bez příjmení osloví obecně", () => {
    expect(osloveni(null)).toBe("Dobrý den,");
    expect(osloveni("")).toBe("Dobrý den,");
    expect(osloveni("   ")).toBe("Dobrý den,");
  });

  it("jednopísmenné a podivné vstupy nespadnou", () => {
    expect(osloveni("X")).toBe("Dobrý den,");
    expect(osloveni("123")).toBe("Dobrý den,");
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/osloveni.test.ts`
Očekávej: FAIL — `Cannot find module '../src/osloveni.js'`.

- [ ] **Krok 3: Napiš minimální implementaci**

```typescript
/**
 * České oslovení z příjmení.
 *
 * **Skloňuje se jen tam, kde je pravidlo jednoznačné.** Oslovit někoho
 * špatně skloňovaným jménem je horší než ho neoslovit jménem vůbec —
 * „Dobrý den," je vždycky správně, „pane Drnče" nemusí být.
 *
 * Rod se pozná jedině z příjmení (-ová/-á). Podle křestního jména se
 * neurčuje: spletený rod je v prvním oslovení horší chyba než obecný
 * pozdrav.
 */

/** Souhlásky, u kterých je vokativ na -e spolehlivý. */
const NA_E = ["r", "l", "n", "m", "s", "z", "d", "t", "p", "b", "v"];

export function osloveni(prijmeni: string | null): string {
  const p = (prijmeni ?? "").trim();
  const OBECNE = "Dobrý den,";
  if (p.length < 2 || !/\p{L}/u.test(p)) return OBECNE;

  // Ženské příjmení: -ová i -á se v oslovení nemění.
  if (/(ová|á)$/u.test(p)) return `Vážená paní ${p},`;

  // Přídavné jméno mužského rodu — vokativ je stejný jako první pád.
  if (/ý$/u.test(p)) return `Vážený pane ${p},`;

  // -ek, -ec, -ěk a měkké -č mají vypadávající -e- nebo alternaci;
  // výjimek je tolik, že se to nedá uhodnout.
  if (/(ek|ec|ěk|ec|č|c|g|h|ch|ž|š|ř|j|k)$/u.test(p)) return OBECNE;

  // Mužské příjmení na -a: Procházka → Procházko.
  if (/a$/u.test(p)) return `Vážený pane ${p.slice(0, -1)}o,`;

  const posledni = p.slice(-1).toLowerCase();
  if (NA_E.includes(posledni)) return `Vážený pane ${p}e,`;

  return OBECNE;
}
```

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/osloveni.test.ts`
Očekávej: PASS.

- [ ] **Krok 5: Změř pokrytí na skutečných příjmeních**

Napiš dočasný skript, který projede příjmení kvalifikovaných firem
s e-mailem a vypíše, kolik jich dostane jméno a kolik „Dobrý den,“.
Výsledek napiš do commit message — je to údaj, který majitele zajímá.

- [ ] **Krok 6: Commit**

```bash
git add src/osloveni.ts test/osloveni.test.ts
git commit -m "feat: české oslovení z příjmení, jen bezpečná pravidla"
```

---

### Úkol 2: Migrace — pole šablony a jejich nastavení u kampaně

**Soubory:**
- Vytvořit: `supabase/migrations/0048_pole_sablony.sql`
- Test: `test/zprava.test.ts`

**Rozhraní:**
- Poskytuje: tabulky `pole_sablony`, `nastaveni_pole`, sloupec
  `kampane.template_id`, rozšířený rozsah `kampane.krok` na 1–5,
  osazení čtyř polí dnešní šablony

- [ ] **Krok 1: Napiš padající test**

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { ulozSablonu } from "../src/obsah.js";
import { SABLONA_HLAVNI } from "../src/obsah-schvaleny.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

describe("pole šablony", () => {
  it("uložená šablona dostane pole podle zástupných údajů v textu", async () => {
    await ulozSablonu(db, SABLONA_HLAVNI);

    const r = await db.query<{ kod: string; povinne: boolean }>(
      `select p.kod, p.povinne from pole_sablony p
         join templates t on t.id = p.template_id
        order by p.poradi`,
    );
    expect(r.map((x) => x.kod)).toEqual([
      "osloveni",
      "vzdalenost",
      "od_vasi_firmy",
      "cena",
    ]);
    // Jméno je jediné pole s náhradou, ostatní firmu vyřadí.
    expect(r.map((x) => x.povinne)).toEqual([false, true, true, true]);
  });

  it("průvodce kampaní má nově pět kroků", async () => {
    const [o] = await db.query<{ id: string }>(
      `insert into oblasti (nazev, tvar) values ('Zkušební', '{"typ":"kruh","stred":{"lat":49.6,"lng":13.2},"polomerM":3000}') returning id`,
    );
    await db.query(
      `insert into kampane (nazev, spravce, oblast_id, krok) values ('Zkušební', 'majitel', $1, 5)`,
      [o!.id],
    );
    const [k] = await db.query<{ krok: number }>("select krok from kampane");
    expect(k?.krok).toBe(5);
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/zprava.test.ts`
Očekávej: FAIL — `relation "pole_sablony" does not exist`.

- [ ] **Krok 3: Napiš migraci**

```sql
-- Pole šablony a jejich nastavení u kampaně.
--
-- Rozhodl majitel 18. 8. 2026: „Nastavení parametrů e-mailů musí být
-- principielně vždy ke kampani." Šablona je společná, nastavení polí je
-- kampaně — dvě kampaně nad týmž územím tak můžou říkat jiné věci, aniž
-- by se navzájem přepsaly.

create table pole_sablony (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  kod text not null,
  nazev text not null,
  -- Chybí-li povinné pole, firma se do kampaně nezahrne (rozhodnutí
  -- majitele 18. 8.). Nepovinné pole má náhradu — dnes jen oslovení.
  povinne boolean not null default true,
  poradi int not null default 0,
  unique (template_id, kod)
);

create table nastaveni_pole (
  kampan_id uuid not null references kampane(id) on delete cascade,
  pole_id uuid not null references pole_sablony(id) on delete cascade,
  rezim text not null check (rezim in ('z_dat', 'pevne', 'vynechat')),
  -- U 'z_dat' kód zdroje, u 'pevne' text platný pro celou kampaň.
  hodnota text,
  primary key (kampan_id, pole_id)
);

alter table kampane add column template_id uuid references templates(id);

-- Pátý krok průvodce: Zpráva.
alter table kampane drop constraint kampane_krok_check;
alter table kampane add constraint kampane_krok_check check (krok between 1 and 5);

-- Pole se zakládají ze zástupných údajů v textu šablony. Spoušť schválně:
-- kdyby je zakládal volající, vznikla by šablona bez polí a ta by se tiše
-- vyplnila prázdnem (past „pravidlo-v-jadru-nehlida-obrazovku").
create or replace function public.zaloz_pole_sablony()
returns trigger language plpgsql as $$
declare
  nalez text;
  poradi_pole int := 0;
  nazvy jsonb := '{
    "osloveni": "Oslovení",
    "vzdalenost": "Vzdálenost k jídelně",
    "od_vasi_firmy": "Obor firmy",
    "cena": "Cena"
  }'::jsonb;
begin
  for nalez in
    select distinct (regexp_matches(new.telo, '\[([a-z_]+)\]', 'g'))[1]
  loop
    poradi_pole := poradi_pole + 1;
    insert into pole_sablony (template_id, kod, nazev, povinne, poradi)
      values (
        new.id,
        nalez,
        coalesce(nazvy ->> nalez, nalez),
        nalez <> 'osloveni',
        position('[' || nalez || ']' in new.telo)
      )
      on conflict (template_id, kod) do nothing;
  end loop;
  return new;
end $$;

create trigger templates_pole
  after insert on templates
  for each row execute function public.zaloz_pole_sablony();

-- Šablona uložená před touhle migrací pole nemá — doplní se stejnou cestou.
do $$
declare t record;
begin
  for t in select id, telo from templates loop
    perform public.zaloz_pole_sablony_pro(t.id, t.telo);
  end loop;
end $$;

alter table pole_sablony enable row level security;
alter table nastaveni_pole enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pole_sablony', 'nastaveni_pole'] loop
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
```

**Pozor:** zpětné doplnění volá `zaloz_pole_sablony_pro`, kterou je potřeba
napsat jako obyčejnou funkci se dvěma parametry a spoušť ji má volat taky —
jinak by tatáž logika žila dvakrát. Uprav migraci tak, aby existovala
jediná funkce `zaloz_pole_sablony_pro(p_template_id uuid, p_telo text)`
a spoušť byla jednořádkový obal nad ní.

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/zprava.test.ts`
Očekávej: PASS.

- [ ] **Krok 5: Ověř, že nic jiného nespadlo**

Spusť: `npm test`
Očekávej: vše zelené. Pozor na `test/obsah.test.ts` — ukládá šablonu, takže
mu nově vzniknou i pole.

- [ ] **Krok 6: Commit**

```bash
git add supabase/migrations/0048_pole_sablony.sql test/zprava.test.ts
git commit -m "feat: pole šablony a jejich nastavení u kampaně (migrace 0048)"
```

---

### Úkol 3: Cena kampaně

**Soubory:**
- Vytvořit: `src/zprava.ts`
- Test: `test/zprava.test.ts`

**Rozhraní:**
- Poskytuje: `cenaKampane(db: Db, kampanId: string): Promise<string | null>`
  — vrací `"110 Kč"`, `"od 110 Kč"`, nebo `null`, když cenu nemá odkud vzít

- [ ] **Krok 1: Napiš padající test**

```typescript
import { cenaKampane } from "../src/zprava.js";

/** Založí jídelnu s cenou a provizí a vrátí její id. */
async function jidelnaSCenou(db: Db, nazev: string, cena: string, provize: string) {
  const [j] = await db.query<{ id: string; nabidka_id: string }>(
    `insert into jidelny (nazev, adresa, lat, lng, zona_metru)
     values ($1, 'Zkušební 1', 49.7, 13.4, 3000) returning id, nabidka_id`,
    [nazev],
  );
  for (const [kod, hodnota] of [["cena_obeda", cena], ["provize", provize]]) {
    const [p] = await db.query<{ id: string }>(
      "select id from parametry_nabidky where kod = $1",
      [kod],
    );
    await db.query(
      `insert into hodnoty_parametru (nabidka_id, parametr_id, hodnota) values ($1, $2, $3)`,
      [j!.nabidka_id, p!.id, hodnota],
    );
  }
  return j!.id;
}

describe("cena kampaně", () => {
  it("stejné ceny se píšou bez „od“", async () => {
    // …založ kampaň se dvěma jídelnami po 95 + 15
    expect(await cenaKampane(db, kampanId)).toBe("110 Kč");
  });

  it("různé ceny se píšou jako „od“ té nejnižší", async () => {
    // …95+15 a 105+15
    expect(await cenaKampane(db, kampanId)).toBe("od 110 Kč");
  });

  it("cena je součet ceny oběda a provize", async () => {
    // …jediná jídelna 100 + 15
    expect(await cenaKampane(db, kampanId)).toBe("115 Kč");
  });

  it("jídelna bez ceny se do výpočtu nepočítá", async () => {
    // …jedna s 95+15, druhá bez vyplněné ceny
    expect(await cenaKampane(db, kampanId)).toBe("110 Kč");
  });

  it("bez jediné ceny vrátí null, ne nulu", async () => {
    expect(await cenaKampane(db, kampanId)).toBeNull();
  });
});
```

Testy dopiš tak, aby si každý založil vlastní kampaň s oblastí a firmami
v dosahu — pomocnou funkci `kampanSJidelnami` napiš do téhož souboru.

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run test/zprava.test.ts`
Očekávej: FAIL — `cenaKampane is not a function`.

- [ ] **Krok 3: Napiš minimální implementaci**

```typescript
/**
 * Cena, která půjde do zprávy.
 *
 * Rozhodl majitel 18. 8. 2026: **cena pro firmu je cena oběda plus naše
 * provize.** Mají-li všechny dotčené jídelny stejnou, píše se bez „od";
 * liší-li se, vezme se nejnižší a předřadí „od". Všichni adresáti jedné
 * kampaně tak dostanou totéž číslo — líp se to kontroluje a nižší cenou
 * se nikdo nepoškodí.
 *
 * **Dotčená jídelna** je ta, která má v dosahu aspoň jednu firmu z oblastí
 * kampaně. Jídelna bez vyplněné ceny se do výpočtu nepočítá — místo toho
 * vyřadí své firmy, protože povinné pole nemá čím vyplnit.
 */
export async function cenaKampane(db: Db, kampanId: string): Promise<string | null> {
  const r = await db.query<{ celkem: number }>(
    `select (co.hodnota::numeric + coalesce(pr.hodnota::numeric, 0))::int as celkem
       from kampan_oblasti ko
       join oblast_firmy of on of.oblast_id = ko.oblast_id
       join dosah d on d.ico = of.ico and d.v_zone
       join jidelny j on j.id = d.jidelna_id
       join parametry_nabidky pco on pco.kod = 'cena_obeda'
       join hodnoty_parametru co
         on co.nabidka_id = j.nabidka_id and co.parametr_id = pco.id
       left join parametry_nabidky ppr on ppr.kod = 'provize'
       left join hodnoty_parametru pr
         on pr.nabidka_id = j.nabidka_id and pr.parametr_id = ppr.id
      where ko.kampan_id = $1
      group by 1`,
    [kampanId],
  );
  if (r.length === 0) return null;

  const ceny = r.map((x) => Number(x.celkem));
  const nejnizsi = Math.min(...ceny);
  const stejne = ceny.every((c) => c === nejnizsi);
  return `${stejne ? "" : "od "}${nejnizsi} Kč`;
}
```

- [ ] **Krok 4: Spusť test a ověř, že prochází**

Spusť: `npx vitest run test/zprava.test.ts`
Očekávej: PASS.

- [ ] **Krok 5: Commit**

```bash
git add src/zprava.ts test/zprava.test.ts
git commit -m "feat: cena kampaně je součet ceny a provize, při rozdílu s „od“"
```

---

### Úkol 4: Co firmě chybí do oslovení

**Soubory:**
- Upravit: `src/zprava.ts`
- Test: `test/zprava.test.ts`

**Rozhraní:**
- Poskytuje:
  - `interface StavFirmy { ico: string; nazev: string; chybi: string[] }`
  - `firmyKOsloveni(db: Db, kampanId: string): Promise<{ pripravene: StavFirmy[]; vyrazene: StavFirmy[] }>`

- [ ] **Krok 1: Napiš padající test**

```typescript
import { firmyKOsloveni } from "../src/zprava.js";

describe("kdo se osloví a kdo ne", () => {
  it("firma se vším potřebným je připravená", async () => {
    // firma s e-mailem, oborem a vzdáleností
    const { pripravene } = await firmyKOsloveni(db, kampanId);
    expect(pripravene.map((f) => f.ico)).toContain("25232657");
  });

  it("firma bez e-mailu se vyřadí a důvod je čitelný", async () => {
    const { vyrazene } = await firmyKOsloveni(db, kampanId);
    const f = vyrazene.find((x) => x.ico === "25232657");
    expect(f?.chybi).toContain("není kam napsat — chybí e-mail");
  });

  it("firma bez oboru se vyřadí", async () => {
    const { vyrazene } = await firmyKOsloveni(db, kampanId);
    expect(vyrazene[0]?.chybi.some((x) => x.includes("obor"))).toBe(true);
  });

  it("firma bez jména se NEvyřadí — osloví se „Dobrý den“", async () => {
    const { pripravene } = await firmyKOsloveni(db, kampanId);
    expect(pripravene).toHaveLength(1);
  });

  it("firmě chybí víc věcí najednou a vypíšou se všechny", async () => {
    const { vyrazene } = await firmyKOsloveni(db, kampanId);
    expect(vyrazene[0]?.chybi.length).toBeGreaterThan(1);
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Očekávej: FAIL — `firmyKOsloveni is not a function`.

- [ ] **Krok 3: Napiš minimální implementaci**

Povinnost čti z `pole_sablony.povinne` u šablony kampaně, ne ze seznamu
v kódu — jinak vznikne druhá kopie pravidla. Pro každé povinné pole zjisti,
jestli má firma z čeho vyplnit:

| Pole | Odkud | Co znamená „chybí“ |
|---|---|---|
| `od_vasi_firmy` | `evidence` atribut `obor` | „chybí obor — nevíme, jak firmu pojmenovat“ |
| `vzdalenost` | `dosah` (v zóně) | „není spočítaná vzdálenost k jídelně“ |
| `cena` | parametry jídelen v dosahu | „u jídelny není vyplněná cena“ |

Navíc, bez ohledu na pole: firma bez kontaktu s e-mailem má
`„není kam napsat — chybí e-mail“`. Není to pole šablony, je to podmínka
odeslání.

- [ ] **Krok 4: Spusť test a ověř, že prochází**

- [ ] **Krok 5: Změř na ostrých datech**

Spusť náhled nad skutečnou kampaní a porovnej čísla s dotazem do databáze.
Čekej řádově: 62 připravených, zbytek vyřazený (87 bez e-mailu, 16 bez oboru).

- [ ] **Krok 6: Commit**

```bash
git add src/zprava.ts test/zprava.test.ts
git commit -m "feat: výčet firem k oslovení a důvodů, proč ostatní vypadnou"
```

---

### Úkol 5: Složení náhledu zprávy

**Soubory:**
- Upravit: `src/zprava.ts`
- Test: `test/zprava.test.ts`

**Rozhraní:**
- Poskytuje: `slozZpravu(db: Db, kampanId: string, ico: string): Promise<{ predmet: string; telo: string; chybi: string[] }>`

- [ ] **Krok 1: Napiš padající test**

```typescript
describe("složení zprávy", () => {
  it("doplní oslovení, obor, vzdálenost i cenu", async () => {
    const z = await slozZpravu(db, kampanId, "25232657");
    expect(z.telo).toContain("Vážený pane Honzíku,");   // podle pravidel oslovení
    expect(z.telo).toContain("od Vaší truhlárny");
    expect(z.telo).toContain("110 Kč");
    expect(z.telo).not.toContain("[");                    // žádný nevyplněný údaj
  });

  it("bez jména osloví „Dobrý den“ a zprávu složí", async () => {
    const z = await slozZpravu(db, kampanId, "25232657");
    expect(z.telo.startsWith("Dobrý den,")).toBe(true);
    expect(z.chybi).toEqual([]);
  });

  it("pole v režimu „pevné“ použije text kampaně, ne data", async () => {
    const z = await slozZpravu(db, kampanId, "25232657");
    expect(z.telo).toContain("od 120 Kč");
  });

  it("pole v režimu „vynechat“ odstraní celou větu, ve které stojí", async () => {
    const z = await slozZpravu(db, kampanId, "25232657");
    expect(z.telo).not.toContain("Kompletní menu");
  });

  it("hotová zpráva projde kontrolou stylu", async () => {
    const z = await slozZpravu(db, kampanId, "25232657");
    expect(zkontrolujZpravu(z.telo, { predmet: z.predmet })).toEqual([]);
  });
});
```

Poslední test je ten nejcennější: hlídá, že **složená** zpráva dodrží
pravidla ze SPEC kap. 6, ne jen kostra.

- [ ] **Krok 2: Spusť test a ověř, že padá**

- [ ] **Krok 3: Napiš minimální implementaci**

Věta se pozná jako úsek mezi tečkami; „vynechat“ maže větu i s mezerou za ní.

- [ ] **Krok 4: Spusť test a ověř, že prochází**

- [ ] **Krok 5: Commit**

```bash
git add src/zprava.ts test/zprava.test.ts
git commit -m "feat: složení náhledu zprávy pro konkrétní firmu"
```

---

### Úkol 6: Příkaz `zprava`

**Soubory:**
- Upravit: `src/cli.ts`

**Rozhraní:**
- Poskytuje: `zprava --kampan <id> [--ico <ico>]` — vypíše cenu kampaně,
  počty připravených a vyřazených firem a hotový mail pro jednu z nich

- [ ] **Krok 1: Napiš funkci příkazu** podle vzoru `cmdParametry`
- [ ] **Krok 2: Zapoj `case "zprava"` a doplň nápovědu**
- [ ] **Krok 3: `npm run typecheck && npm test`**
- [ ] **Krok 4: Vyzkoušej nad ostrou kampaní** (jen čte, nic nezapisuje)
- [ ] **Krok 5: Commit**

---

### Úkol 7: Krok „Zpráva“ v aplikaci

**Soubory:**
- Vytvořit: `app/src/KrokZprava.tsx`
- Upravit: `app/src/data.ts`, `app/src/PruvodceKampani.tsx`, `app/src/Krokovnik.tsx`

- [ ] **Krok 1: Rozšiř krokovník na pět kroků**

V `app/src/Krokovnik.tsx` doplň `"Zpráva"` do `KROKY` a rozšiř typ
`krok` na `1 | 2 | 3 | 4 | 5`. Text pro čtečku („krok 2 ze 4“) se počítá
z délky pole, takže se opraví sám — ověř to.

- [ ] **Krok 2: Datová vrstva** — čtení polí šablony a nastavení, uložení
  režimu pole, načtení náhledu (počítá se v prohlížeči ze stažených dat,
  aby se nemusel volat server pro každou firmu)

- [ ] **Krok 3: Obrazovka kroku** — výběr šablony, řádek na každé pole
  s výběrem režimu, náhled na první připravené firmě, výčet vyřazených

- [ ] **Krok 4: Zapoj krok do průvodce** za „Seznam firem“

- [ ] **Krok 5: `npm run typecheck && npm run build --prefix app`**

- [ ] **Krok 6: Commit**

---

### Úkol 8: Upozornění v seznamu firem

**Soubory:**
- Upravit: `app/src/SeznamFirem.tsx`

- [ ] **Krok 1: Přidej sloupec „Chybí do oslovení“** — u připravené firmy
  zelená fajfka, u vyřazené výrazné upozornění s výčtem, co chybí
- [ ] **Krok 2: `npm run typecheck && npm run build --prefix app`**
- [ ] **Krok 3: Commit**

---

### Úkol 9: Nasazení a proklikání

- [ ] **Krok 1: Nasaď migraci** — `npm run cli -- migrate`
- [ ] **Krok 2: Proklikej v prohlížeči:**
  1. Průvodce má pět kroků a dá se mezi nimi chodit tam i zpět.
  2. Krok Zpráva ukáže šablonu a čtyři pole.
  3. Náhled ukáže hotový mail bez jediné hranaté závorky.
  4. Cena v náhledu je **od 110 Kč**.
  5. Změna režimu pole na „vynechat“ se v náhledu okamžitě projeví.
  6. Výčet vyřazených firem sedí s tím, co vypíše `npm run cli -- zprava`.
  7. Uživatel bez práv admina nastavení nezmění.
- [ ] **Krok 3: Ukliď zkušební nastavení**, pokud nějaké vzniklo
- [ ] **Krok 4: Zapiš do paměti** a přepiš `project-context.md`

## Co tahle dodávka nedělá

- **Needituje šablonu.** Text se pořád mění v `src/obsah-schvaleny.ts`;
  editor je třetí dodávka.
- **Nezavádí podmíněné pasáže.** Věta o výdeji se zatím neskládá
  z možností jídelny — taky třetí dodávka.
- **Neodesílá.** Odesílání zůstává vypnuté (TP-8).
