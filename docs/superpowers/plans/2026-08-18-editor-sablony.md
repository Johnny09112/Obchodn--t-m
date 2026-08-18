# Editor šablony — plán třetí dodávky

> **Pro agentní pracovníky:** POVINNÝ PODSKILL: superpowers:executing-plans.

**Cíl:** Text oslovení se píše v aplikaci. Do textu se vkládají pole,
označené větě se přiřadí podmínka vybraná z nabídky, uložená změna je
koncept a platnou verzí se stane až tlačítkem „pustit do provozu“.

**Architektura:** Podmínka se neváže na pozici znaku (ta se při psaní
posune), ale na **pořadí odstavce a věty**. Vyhodnocení podmínek je čistá
funkce v `src/text-zpravy.ts`, tedy tentýž kód pro jádro i obrazovku.
Kontrola stylu (`src/styl-zpravy.ts`) je taky čistá, takže ji obrazovka
pustí při psaní.

**Zadání:** `docs/superpowers/specs/2026-08-18-nastaveni-zpravy-design.md`
(kap. 3.4, 4.3, 4.4, 5.3)

## Globální omezení

Stejná jako u předchozích dodávek. Navíc:

- **Pravidlo, na které sáhne obrazovka, patří do databáze nebo do čistého
  modulu** ([[pravidlo-v-jadru-nehlida-obrazovku]]). Aplikace nesmí
  importovat nic, co se připojuje k databázi.
- **Nová tabulka dostane politiku hned v téže migraci**
  ([[rls-bez-politiky-je-tiche-prazdno]]).
- Odesílání zůstává vypnuté (TP-8).

## Úkoly

### 1. Migrace 0052 — podmíněné pasáže a jedna platná verze

- `podminky_pasaze (id, template_id, odstavec int, veta int, parametr_kod
  text, ocekavana_hodnota text null)` + politiky (čte přihlášený, mění admin).
- **Publikování:** funkce `pust_sablonu_do_provozu(p_template_id uuid)`
  přepne šablonu na `schvaleno` a **starší verze téhož segmentu a kanálu
  na `vyrazeno`**, aby platná byla vždy právě jedna. Odeslané zprávy se
  na starou verzi dál odkazují přes `template_id` (TP-13), řádek zůstává.

### 2. Vyhodnocení podmínek (čistý modul)

Do `src/text-zpravy.ts`:

- `PodkladyFirmy` dostane `parametry: Record<string, string>` — hodnoty
  parametrů té nabídky, která firmu obsluhuje.
- `interface PodminkaPasaze { odstavec: number; veta: number; parametrKod: string; ocekavanaHodnota: string | null }`
- `slozText(kostra, nastaveni, podklady, podminky)` — před dosazením polí
  vypustí věty, jejichž podmínka neplatí.
- Vyhodnocení: `ocekavanaHodnota === null` → „parametr je vyplněný";
  u výběru → „obsahuje tuhle volbu"; jinak → rovnost.

### 3. Podklady o parametrech jídelny

`nahled_kampane` (migrace 0053) vrátí navíc `parametry jsonb` — hodnoty
parametrů nabídky, která firmu obsluhuje. Když je jídelen víc, bere se ta
nejbližší, protože podle ní se počítá i vzdálenost.

### 4. Obrazovka Šablony

Nová položka v horním menu. Obsahuje:

- seznam šablon se stavem (platná / koncept / vyřazená),
- editor: předmět, tělo, tlačítko „vložit pole", živá kontrola stylu,
- seznam vět s možností přiřadit podmínku z nabídky parametrů,
- „Uložit koncept" a „Pustit do provozu" (druhé jen pro admina).

### 5. Nasazení a proklikání

Jako u předchozích dodávek: migrace, `npm run build --prefix app`,
proklikat v prohlížeči na ostrých datech, uklidit zkušební data.

## Co tahle dodávka nedělá

- **Neodesílá.** Odesílání zůstává vypnuté.
- **Neřeší poučení podle čl. 14 GDPR** — čeká na právní konzultaci.
- **Nezavádí schvalovací kolečko víc lidí** — mění admin, platnost
  odklepne admin.
