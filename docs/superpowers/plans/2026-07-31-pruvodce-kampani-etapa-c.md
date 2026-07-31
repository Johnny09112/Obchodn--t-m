# Průvodce kampaní — etapa C (kroky 3 a 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kampaň se dá dotáhnout do konce — objednat průzkum, počkat na něj a schválit seznam firem.

**Architecture:** Krok 3 objedná průzkum a ukazuje jeho postup z `pruzkum_useky`; hlídka Čmuchala (etapa B+) ho vyřídí. Krok 4 naplní kampaň firmami přes sdílené síto, ukáže souhrn i vyřazené s důvodem a nabídne schválení. Odesílání se v této etapě nedotýká vůbec.

**Tech Stack:** TypeScript, React + Vite v `app/`, PostgreSQL (Supabase), testy Vitest nad PGlite.

## Global Constraints

- **Jazyk:** čeština v komentářích, dokumentech i commit messages; identifikátory česky bez diakritiky.
- **TDD:** nejdřív test, pak implementace. `npm test` musí projít bez proměnných prostředí.
- **Migrace: pouze přidávat nové soubory.** Poslední je `0027_pruzkum_urgentni.sql`.
- **Nic se neodesílá** (TP-8). V této etapě nesmí vzniknout kód, který odesílá, skládá text zprávy nebo sahá na `system_state.sending_enabled`.
- **Tvrdá pravidla vynucuje databáze**, ne formulář. Zašedlé tlačítko je pohodlí, ne pojistka.
- **Zamítnutý zápis Supabase nehlásí jako chybu** — jen změní nula řádků. Každý zápis z aplikace proto `.select("id")` a kontrola počtu (viz `poznatky.md`).
- **Migrace nasadit** (`npm run cli -- migrate`) — do předávky patří „co je nasazené", ne jen „co je otestované".
- Zdroj pravdy: `docs/superpowers/specs/2026-07-31-pruvodce-kampani-obrazovky-design.md`.

## Struktura souborů

| Soubor | Za co odpovídá |
|---|---|
| `app/src/styl.css` | Proužek postupu (odložený z etapy B) |
| `app/src/data.ts` | Objednávka průzkumu, jeho postup, naplnění a souhrn kampaně |
| `app/src/PruvodceKampani.tsx` | Kroky 3 a 4 |
| `test/kampan-souhrn.test.ts` | Souhrn kampaně a rozpad kontaktů |

## Co víme předem

**Aplikace nemůže volat `naplnZOblasti`** — to je kód jádra běžící v Node.
Naplnění kampaně proto musí udělat sama: přečte `oblast_firmy`, uplatní
`duvodNeoslovovat` (sdílené, už se používá v kroku 2) a vloží do
`kampan_firmy`. **Pravidlo zůstává jedno**, jen ho volají dvě místa —
stejně jako počty v kroku 2.

**Postup průzkumu je hotový údaj.** `pruzkum_useky` má stav u každé obce,
nic se nepočítá znovu.

---

### Task 1: Proužek postupu

**Files:** Modify `app/src/styl.css`

**Interfaces:** Produces třídy `.postup`, `.postup-pruh`, `.postup-pruh i` (varianty `.hotovo`, `.bezi`), `.postup-popis`. Task 3 je používá.

- [ ] **Step 1: Přidej styl na konec `app/src/styl.css`**

```css
/* ──────────────────────────────────────────────── postup po obcích */

/*
 * Průzkum se dělí na úseky po obcích a jejich stav je v databázi — proužek
 * ho jen ukazuje. Stav nese barva i výplň, ne jen barva.
 */
.postup {
  display: flex;
  flex-direction: column;
  gap: var(--o2);
  margin: var(--o3) 0;
}

.postup-pruh {
  display: flex;
  gap: 2px;
}

.postup-pruh > i {
  flex: 1;
  height: 0.5rem;
  background: var(--linka);
  border-radius: 1px;
}

.postup-pruh > i.hotovo {
  background: var(--zelen);
}

.postup-pruh > i.bezi {
  background: var(--horcice);
}

.postup-pruh > i.selhalo {
  background: var(--cihla);
}

.postup-popis {
  font-family: var(--pismo-data);
  font-size: var(--t-maly);
  color: var(--inkoust-slaby);
}
```

- [ ] **Step 2: Ověř, že se nic nerozbilo**

Run: `npm --prefix app run dev` a projdi Kampaně i Oblasti — nic se měnit nemá, přidávají se jen nové třídy.

- [ ] **Step 3: Commit**

```bash
git add app/src/styl.css
git commit -m "feat: proužek postupu po obcích do designového systému"
```

---

### Task 2: Souhrn kampaně v jádru

**Files:**
- Modify: `src/kampan.ts`
- Create: `test/kampan-souhrn.test.ts`

**Interfaces:**
- Consumes: `duvodNeoslovovat` z `src/kvalifikace.ts`.
- Produces:

```typescript
export interface RozpadKontaktu {
  jmenna: number;      // úroveň 1 — konkrétní osoba
  proNabidky: number;  // úroveň 2 — adresa pro obchodní nabídky
  obecna: number;      // úroveň 3 — info@ a podobně
  zadny: number;       // firma bez doloženého spojení
}

export async function rozpadKontaktuKampane(db: Db, kampanId: string): Promise<RozpadKontaktu>;
```

**Proč v jádru a ne jen v aplikaci:** rozpad podle úrovně adresy je pravidlo
z TP-6, ne zobrazení. Aplikace ho jen ukáže.

- [ ] **Step 1: Napiš padající test**

Vytvoř `test/kampan-souhrn.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { pripojPglite, spustMigrace, type Db } from "../src/db.js";
import { rozpadKontaktuKampane, zalozKampan } from "../src/kampan.js";
import { zalozFirmu, zapisKontakt } from "../src/repo.js";
import type { AresZaznam } from "../src/ares.js";

let db: Db;

beforeEach(async () => {
  db = await pripojPglite();
  await spustMigrace(db);
});

const zaznam = (ico: string): AresZaznam => ({
  ico, nazev: `Firma ${ico}`, adresa: "x", obec: "Zbůch",
  czNace: ["25610"], velikostKategorie: "stredni", kodObce: 559661, pravniForma: "112",
});

/** Firma v kampani, volitelně s kontaktem dané úrovně. */
async function firmaVKampani(kampanId: string, ico: string, uroven?: 1 | 2 | 3) {
  await zalozFirmu(db, zaznam(ico));
  await db.query("insert into kampan_firmy (kampan_id, ico) values ($1,$2)", [kampanId, ico]);
  if (uroven) {
    await zapisKontakt(db, {
      ico, email: `k${ico}@example.cz`, urovenAdresy: uroven,
      zdrojUrl: "https://example.cz/kontakty", citace: "kontakt na stránkách",
    });
  }
}

describe("rozpad kontaktů v kampani", () => {
  it("roztřídí firmy podle úrovně adresy", async () => {
    const id = await zalozKampan(db, { nazev: "K1", spravce: "a@b.cz" });
    await firmaVKampani(id, "25232657", 1);
    await firmaVKampani(id, "48362956", 2);
    await firmaVKampani(id, "17439523", 3);
    await firmaVKampani(id, "60193531");

    expect(await rozpadKontaktuKampane(db, id)).toEqual({
      jmenna: 1, proNabidky: 1, obecna: 1, zadny: 1,
    });
  });

  it("firmu s víc kontakty počítá podle toho nejlepšího", async () => {
    // Jinak by jedna firma přispěla do dvou sloupců a součet by nesouhlasil
    // s počtem firem v kampani.
    const id = await zalozKampan(db, { nazev: "K2", spravce: "a@b.cz" });
    await firmaVKampani(id, "25232657", 3);
    await zapisKontakt(db, {
      ico: "25232657", email: "reditel@example.cz", urovenAdresy: 1,
      zdrojUrl: "https://example.cz/vedeni", citace: "ředitel",
    });

    expect(await rozpadKontaktuKampane(db, id)).toEqual({
      jmenna: 1, proNabidky: 0, obecna: 0, zadny: 0,
    });
  });

  it("vyřazené firmy do rozpadu nepatří", async () => {
    const id = await zalozKampan(db, { nazev: "K3", spravce: "a@b.cz" });
    await firmaVKampani(id, "25232657", 1);
    await db.query(
      "update kampan_firmy set stav = 'vyrazena', duvod_vyrazeni = 'ručně' where ico = $1",
      ["25232657"],
    );
    expect(await rozpadKontaktuKampane(db, id)).toEqual({
      jmenna: 0, proNabidky: 0, obecna: 0, zadny: 0,
    });
  });
});
```

- [ ] **Step 2: Spusť a ověř, že padá**

Run: `npx vitest run test/kampan-souhrn.test.ts`
Expected: FAIL — `rozpadKontaktuKampane is not a function`.

- [ ] **Step 3: Doplň do `src/kampan.ts`**

```typescript
/** Rozpad firem v kampani podle nejlepší doložené úrovně adresy (TP-6). */
export interface RozpadKontaktu {
  jmenna: number;
  proNabidky: number;
  obecna: number;
  zadny: number;
}

/**
 * Kolik firem má jaké spojení.
 *
 * Firma se počítá podle NEJLEPŠÍHO kontaktu, který má — jinak by jedna
 * firma přispěla do dvou sloupců a součet by nesouhlasil s počtem firem
 * v kampani. Vyřazené firmy se nepočítají vůbec.
 */
export async function rozpadKontaktuKampane(
  db: Db,
  kampanId: string,
): Promise<RozpadKontaktu> {
  const r = await db.query<{ uroven: number | null; pocet: number }>(
    `select nejlepsi as uroven, count(*)::int as pocet from (
       select kf.ico, min(k.uroven_adresy) as nejlepsi
       from kampan_firmy kf
       left join contacts k on k.ico = kf.ico
       where kf.kampan_id = $1 and kf.stav = 'vybrana'
       group by kf.ico
     ) t group by nejlepsi`,
    [kampanId],
  );
  const podle = new Map(r.map((x) => [x.uroven, x.pocet]));
  return {
    jmenna: podle.get(1) ?? 0,
    proNabidky: podle.get(2) ?? 0,
    obecna: podle.get(3) ?? 0,
    zadny: podle.get(null) ?? 0,
  };
}
```

- [ ] **Step 4: Spusť a ověř, že prochází**

Run: `npx vitest run test/kampan-souhrn.test.ts`
Expected: PASS (3 testy).

Pokud padne třetí test, ověř skutečný název sloupce stavu v `kampan_firmy`:
`grep -n "create table kampan_firmy" -A 8 supabase/migrations/0018_kampane.sql`.

- [ ] **Step 5: Celá sada a commit**

```bash
npm test
git add src/kampan.ts test/kampan-souhrn.test.ts
git commit -m "feat: rozpad kontaktů v kampani podle úrovně adresy"
```

---

### Task 3: Krok 3 — průzkum

**Files:** Modify `app/src/data.ts`, `app/src/PruvodceKampani.tsx`

**Interfaces:**
- Consumes: třídy `.postup` (Task 1).
- Produces:

```typescript
export interface StavPruzkumu {
  id: string;
  stav: string;
  urgentni: boolean;
  useky: { stav: string }[];
}

export function nactiPruzkumKampane(kampanId: string): Promise<StavPruzkumu | null>;
export function objednejPruzkumZAplikace(kampanId: string, oblastId: string, pozadal: string): Promise<void>;
export function oznacUrgentni(pruzkumId: string): Promise<void>;
```

- [ ] **Step 1: Doplň do `app/src/data.ts`**

```typescript
/** Objednávka průzkumu pro kampaň i s postupem po obcích. */
export interface StavPruzkumu {
  id: string;
  stav: string;
  urgentni: boolean;
  useky: { stav: string }[];
}

export async function nactiPruzkumKampane(kampanId: string): Promise<StavPruzkumu | null> {
  const { data, error } = await supabase
    .from("pruzkumy")
    .select("id,stav,urgentni,pruzkum_useky(stav)")
    .eq("kampan_id", kampanId)
    .order("pozadano_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const r = data?.[0] as
    | { id: string; stav: string; urgentni: boolean; pruzkum_useky: { stav: string }[] }
    | undefined;
  if (!r) return null;
  return { id: r.id, stav: r.stav, urgentni: r.urgentni, useky: r.pruzkum_useky ?? [] };
}

export async function objednejPruzkumZAplikace(
  kampanId: string,
  oblastId: string,
  pozadal: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("pruzkumy")
    .insert({ kampan_id: kampanId, oblast_id: oblastId, pozadal })
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Průzkum se nepodařilo objednat — kampaň patří někomu jinému.");
  }
  // Kampaň čeká na průzkum; schválit ji do té doby nejde (hlídá databáze).
  await supabase.from("kampane").update({ stav: "ceka_na_pruzkum", krok: 3 }).eq("id", kampanId);
}

/** Označí objednávku jako spěchající. Agenta to NESPUSTÍ — jen ho navede. */
export async function oznacUrgentni(pruzkumId: string): Promise<void> {
  const { data, error } = await supabase
    .from("pruzkumy")
    .update({ urgentni: true })
    .eq("id", pruzkumId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Označit nešlo — objednávka patří ke kampani někoho jiného.");
  }
}
```

- [ ] **Step 2: Přidej krok 3 do `app/src/PruvodceKampani.tsx`**

Rozšiř typ kroku na `1 | 2 | 3 | 4` a za blok `if (krok === 2)` vlož:

```tsx
  if (krok === 3) {
    const hotovo = pruzkum?.useky.filter((u) => u.stav === "hotovo").length ?? 0;
    const celkem = pruzkum?.useky.length ?? 0;
    return (
      <div className="sloupec">
        <h2>{nazev}</h2>
        <Krokovnik krok={3} />

        {!pruzkum && (
          <>
            <p className="hlaska je-klid">
              Území ještě prozkoumané není. Objednávku si Čmuchal vyzvedne sám —
              hlídka u hodin se dívá do fronty třikrát denně.
            </p>
            <div className="tlacitka vlevo">
              <button className="tlacitko" onClick={objednej} disabled={uklada}>
                {uklada ? "Objednávám…" : "Objednat průzkum"}
              </button>
            </div>
          </>
        )}

        {pruzkum && pruzkum.stav === "hotovo" && (
          <p className="hlaska je-hotovo">
            Průzkum je hotový. Můžete pokračovat na seznam firem.
          </p>
        )}

        {pruzkum && (pruzkum.stav === "ceka" || pruzkum.stav === "bezi") && (
          <>
            <div className="postup">
              <div className="postup-pruh">
                {celkem === 0
                  ? <i />
                  : pruzkum.useky.map((u, i) => (
                      <i key={i} className={u.stav === "hotovo" ? "hotovo" : u.stav === "bezi" ? "bezi" : u.stav === "selhalo" ? "selhalo" : ""} />
                    ))}
              </div>
              <span className="postup-popis">
                {celkem === 0 ? "čeká na vyzvednutí" : `hotovo ${hotovo} z ${celkem} obcí`}
              </span>
            </div>
            <p className="hlaska je-klid">
              Okno můžete zavřít — kampaň zůstane rozpracovaná a v seznamu
              uvidíte, až bude průzkum hotový.
            </p>
            {!pruzkum.urgentni && (
              <div className="tlacitka vlevo">
                <button className="tlacitko tise" onClick={spechaj} disabled={uklada}>
                  Spěchá — vyřídit přednostně
                </button>
              </div>
            )}
            {pruzkum.urgentni && (
              <p className="poznamka">
                Označeno jako spěchající — hlídka se na frontu dívá každých
                deset minut. Tlačítko Čmuchala nespustí, jen ho navede.
              </p>
            )}
          </>
        )}

        {pruzkum && pruzkum.stav === "ceka_na_rozhodnuti" && (
          <p className="hlaska">
            Nakreslený tvar nezabírá žádnou obec, takže není z čeho hledat.
            Musí rozhodnout člověk — ozvěte se, prosím.
          </p>
        )}

        {chyba && <p className="hlaska" role="alert">{chyba}</p>}

        <div className="tlacitka vlevo">
          <button className="tlacitko tise" onClick={() => setKrok(2)}>Zpět na území</button>
          <button className="tlacitko tise" onClick={() => setKrok(4)}>
            Přeskočit na seznam firem
          </button>
        </div>
        <p className="poznamka">
          Přeskočit jde vždycky, ale <strong>schválit kampaň půjde až po
          dokončení průzkumu</strong> — hlídá to databáze.
        </p>
      </div>
    );
  }
```

- [ ] **Step 3: Ověř kontrolu typů**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Ověř v prohlížeči**

Run: `npm --prefix app run dev`

Otevři rozpracovanou kampaň s územím → krok 3 → **Objednat průzkum**.
Ověř v deníku hlídky, že si ji vzala (nebo pusť ručně
`npm run cli -- pruzkum obsluz`), a že proužek ukazuje postup.

- [ ] **Step 5: Commit**

```bash
git add app/src/data.ts app/src/PruvodceKampani.tsx
git commit -m "feat: krok 3 průvodce — objednání průzkumu a jeho postup"
```

---

### Task 4: Krok 4 — seznam firem a schválení

**Files:** Modify `app/src/data.ts`, `app/src/PruvodceKampani.tsx`

**Interfaces:**
- Consumes: `duvodNeoslovovat`, `rozpadKontaktuKampane` (Task 2).
- Produces:

```typescript
export interface NaplneniKampane {
  pridano: number;
  vynechano: { ico: string; nazev: string; duvod: string; detail: string }[];
}

export function naplnKampanZOblasti(kampanId: string, oblastId: string): Promise<NaplneniKampane>;
export function vyradZKampane(kampanId: string, ico: string, duvod: string): Promise<void>;
export function schvalKampan(kampanId: string): Promise<void>;
```

- [ ] **Step 1: Doplň naplnění do `app/src/data.ts`**

```typescript
const POPIS_DUVODU: Record<string, string> = {
  partnerska_jidelna: "naše partnerská jídelna",
  bytovy_dum: "bytový dům",
  blacklist: "blacklist",
  vlastni_jidelna: "má vlastní jídelnu",
};

export interface NaplneniKampane {
  pridano: number;
  vynechano: { ico: string; nazev: string; duvod: string; detail: string }[];
}

/**
 * Naplní kampaň firmami z jejího území.
 *
 * Aplikace nemůže zavolat `naplnZOblasti` z jádra (běží v Node), takže dělá
 * totéž sama — ale sítem `duvodNeoslovovat`, které je SDÍLENÉ. Pravidlo tedy
 * zůstává jedno, jen ho volají dvě místa.
 *
 * Ručně vyřazené firmy se nevzkřísí: `on conflict do nothing`.
 */
export async function naplnKampanZOblasti(
  kampanId: string,
  oblastId: string,
): Promise<NaplneniKampane> {
  const [firmy, sito, vOblasti] = await Promise.all([
    nactiFirmy(),
    nactiPravidlaSita(),
    supabase.from("oblast_firmy").select("ico").eq("oblast_id", oblastId),
  ]);
  if (vOblasti.error) throw new Error(vOblasti.error.message);

  const uvnitr = new Set((vOblasti.data ?? []).map((x) => (x as { ico: string }).ico));
  const podleIco = new Map(firmy.map((f) => [f.ico, f]));

  const vynechano: NaplneniKampane["vynechano"] = [];
  const kVlozeni: { kampan_id: string; ico: string }[] = [];

  for (const ico of uvnitr) {
    const f = podleIco.get(ico);
    if (!f) continue;
    const duvod = duvodNeoslovovat({
      ico: f.ico, nazev: f.nazev, czNace: f.cz_nace,
      pravniForma: f.pravni_forma, maVlastniJidelnu: f.ma_vlastni_jidelnu,
      partnerskaIca: sito.partnerskaIca, blacklist: sito.blacklist,
    });
    if (duvod) {
      vynechano.push({
        ico: f.ico, nazev: f.nazev,
        duvod: POPIS_DUVODU[duvod.duvod] ?? duvod.duvod,
        detail: duvod.detail,
      });
    } else {
      kVlozeni.push({ kampan_id: kampanId, ico: f.ico });
    }
  }

  let pridano = 0;
  for (let i = 0; i < kVlozeni.length; i += 500) {
    const { data, error } = await supabase
      .from("kampan_firmy")
      .upsert(kVlozeni.slice(i, i + 500), { onConflict: "kampan_id,ico", ignoreDuplicates: true })
      .select("ico");
    if (error) throw new Error(error.message);
    pridano += data?.length ?? 0;
  }
  return { pridano, vynechano };
}

export async function vyradZKampane(kampanId: string, ico: string, duvod: string): Promise<void> {
  if (!duvod.trim()) throw new Error("Vyřazení potřebuje důvod — bez něj se pravidla nebrousí.");
  const { data, error } = await supabase
    .from("kampan_firmy")
    .update({ stav: "vyrazena", duvod_vyrazeni: duvod.trim() })
    .eq("kampan_id", kampanId).eq("ico", ico)
    .select("ico");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Vyřazení neprošlo — kampaň patří někomu jinému.");
}

/**
 * Schválí kampaň. Podmínky (aspoň jedna firma s doloženým spojením,
 * dokončený průzkum, role admin a výš) hlídá DATABÁZE — tohle je jen cesta,
 * jak se jí zeptat.
 */
export async function schvalKampan(kampanId: string): Promise<void> {
  const { data, error } = await supabase
    .from("kampane")
    .update({ stav: "schvalena", krok: 4 })
    .eq("id", kampanId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "Schválení neprošlo. Schvalovat smí jen admin, a kampaň musí mít aspoň " +
        "jednu firmu s doloženým spojením a dokončený průzkum.",
    );
  }
}
```

Nezapomeň na import `duvodNeoslovovat` z `../../src/kvalifikace`.

- [ ] **Step 2: Přidej krok 4 do průvodce**

Obrazovka podle návrhu (spec 3.4): souhrn, **vyřazené firmy nahoře i s
důvodem**, tabulka firem tříděná podle skóre s tlačítkem Vyřadit, a
Schválit kampaň v dialogu (`.zaclona` + `.dialog`, už existují).

Tlačítko Schválit **zobrazuj jen adminovi** — ostatním se nemá nabízet
něco, co databáze stejně zamítne.

- [ ] **Step 3: Kontrola typů, celá sada, prohlížeč**

Run: `npm run typecheck && npm test`
Pak `npm --prefix app run dev` a projdi celou cestu: založit → území →
objednat průzkum → (pustit hlídku) → seznam firem → schválit.

- [ ] **Step 4: Commit**

```bash
git add app/src/data.ts app/src/PruvodceKampani.tsx
git commit -m "feat: krok 4 průvodce — seznam firem, vyřazení a schválení"
```

---

## Po dokončení

- [ ] `npm test && npm run typecheck`
- [ ] `npm run cli -- migrate` (v této etapě žádná migrace nevzniká — ověř, že je opravdu nic nečeká)
- [ ] Aktualizovat `memory/stav.md` a HTML přehled projektu
- [ ] Předat majiteli s výslovným seznamem, co má proklikat

## Co se v etapě C nestaví

- **Odesílání čehokoli** ani po schválení (TP-8).
- **Stav oslovení u jednotlivé firmy** (`osloven`, `odpovedel`) — fáze 3.
- **Návrh tvaru oblasti agentem** — fáze 4.
