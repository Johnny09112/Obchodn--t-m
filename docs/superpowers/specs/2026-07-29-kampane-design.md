# Kampaně — zadání

**Stav:** k odsouhlasení · **Datum:** 2026-07-29 · **Krok 5** frontendového plánu
(ADR `docs/adr/0001-frontend.md`)

> Obrázek celého procesu: `docs/vizualizace/kampane-proces.html`.
> Při rozporu s SPEC.md platí SPEC.md.

## 1. K čemu to je

Majitel potřebuje pojmenovat záměr („sháníme strávníky na západě Čech",
„jídelna ve Varech nabízí 30 obědů od srpna"), vymezit mu území a dostat
z něj seznam firem, na které se dá obrátit. Dnes to jde jen tak, že si
oblast nakreslí a seznam vyexportuje očima — kampaň nikde nežije, takže
se nedá vrátit, porovnat ani předat kolegovi.

**Kampaň je pojmenovaný seznam firem s vlastním kontextem.** Nic víc.
Není to rozesílka.

## 2. Rozhodnutí, ze kterých návrh vychází

### 2.1 Kampaň není kampaňový režim

SPEC kap. 10.2 říká u Obchodníka doslova **„Režim: individuální oslovení,
ne kampaň"** a v úvodu je mezi změnami proti verzi 1 uvedeno, že Obchodník
z kampaňového režimu odešel. Kampaň v tomto zadání proto znamená **seznam
práce**, ze kterého později odchází oslovení po jedné firmě, každé zvlášť
personalizované a schválené.

Majitel to potvrdil 2026-07-29.

### 2.2 Odesílání se nestaví, ani nanečisto

Majitel v původním popisu chtěl jako krok 4 „reálné rozhraní pro e-mail"
se shrnutím, na kolik adres to odchází. **To je odesílání a TP-8 ho kódu
fáze 0–2 zakazuje implementovat i zapínat.** Fáze 3 navíc podle SPEC kap. 12
předpokládá hotovou právní konzultaci, knihovnu tvrzení, tři schválené
šablony, odesílací doménu s SPF/DKIM/DMARC a zahřátím a jmenovanou osobu
podepsanou pod zprávami. Nic z toho hotové není.

Krok 4 je proto rozdělený: **posouzení seznamu** (staví se teď) a
**oslovení** (fáze 3). Posouzení dá majiteli shrnutí, které chtěl —
kolik firem, kolik z nich má spojení, jaké úrovně adres — jen z něj místo
odeslaných zpráv vyjde schválený seznam.

### 2.3 Aplikace agenta nespouští, objednává si ho

Podle ADR 0001 běží agent v Claude Code na předplatném uživatele a
aplikace nemá backend. Krok „prozkoumej území" tedy nemůže proběhnout
v prohlížeči. Aplikace zapíše **požadavek na průzkum** a agent si ho
vyzvedne, až ho někdo pustí.

Naplánované spouštění agenta je samostatné rozhodnutí mimo toto zadání
(majitel 2026-07-29: až po kampaních).

### 2.4 Překryv upozorňuje, nebrání

Majitel zvolil měkké hlídání: systém ukáže, které firmy jsou už v jiné
kampani, a nechá rozhodnutí na člověku.

**Tvrdé pravidlo tím není oslabené.** TP-5 nemluví o seznamech, ale
o odeslání — být na dvou seznamech není porušení, poslat dvakrát ano.
Tvrdá pojistka proto sedí až u odesílání (fáze 3) a opírá se o
`companies.osloveno_at`, které v schématu existuje od migrace 0001 přesně
na tohle.

### 2.5 Seznam firem zamrzne

Kampaň si firmy uloží, nedopočítává je při každém zobrazení. Kdyby se
dopočítávaly, kampaň by tiše rostla pokaždé, když Čmuchal doplní další
firmy, a člověk by nevěděl, komu se vlastně chystá psát. Doplnit nové jde
tlačítkem, tedy vědomě.

### 2.6 Správce kampaně je odpovědná osoba, ne systém oprávnění

Máme čtyři uživatele a tři role, které fungují (migrace 0016). Zavádět ke
každé kampani vlastní seznam „kdo co smí" je složitost, kterou zatím nikdo
nepotřebuje. Ukládá se **kdo za kampaň odpovídá**; co kdo smí, dál řídí role.

## 3. Datový model

Nové tabulky, migrace `0018_kampane.sql`.

### `kampane`

| sloupec | typ | poznámka |
|---|---|---|
| `id` | uuid pk | |
| `nazev` | text not null | jedinečný bez ohledu na velikost písmen |
| `popis` | text | volitelný |
| `kontext` | text | čím se kampaň liší — podklad pro člověka, ne šablona |
| `spravce` | text not null | e-mail odpovědné osoby (viz pozn. níže) |
| `oblast_id` | uuid → `oblasti` | povinné od stavu `ceka_na_pruzkum` dál |
| `jidelna_id` | uuid → `jidelny` | nepovinné, stejně jako u oblasti |
| `stav` | text not null | viz kap. 5, výchozí `rozpracovana` |
| `krok` | int not null | na kterém kroku průvodce se skončilo (1–4) |
| `duvod_zruseni` | text | povinný při stavu `zrusena` |
| `created_at`, `updated_at` | timestamptz | |

Jedinečnost názvu vynucuje unikátní index nad `lower(nazev)` — kontrola
v aplikaci sama nestačí, dva lidé mohou zakládat naráz.

**K poli `spravce`:** aplikace **nemá jak vypsat seznam uživatelů** —
účty žijí v Supabase Auth a přes publishable klíč se čtou jen údaje
přihlášeného. Pole se proto předvyplní e-mailem toho, kdo kampaň zakládá,
a jde přepsat na jiný. Skutečný výběr ze seznamu by znamenal pohled nad
`auth.users` s vlastními pravidly — mimo rozsah tohoto zadání.

### `kampan_firmy`

| sloupec | typ | poznámka |
|---|---|---|
| `kampan_id` | uuid → `kampane` on delete cascade | pk s `ico` |
| `ico` | text → `companies` on delete cascade | |
| `stav` | text not null | `vybrana` \| `vyrazena` |
| `duvod_vyrazeni` | text | povinný při `vyrazena` |
| `zaradeno_at` | timestamptz not null | |

Vyřazení si drží důvod ze stejného důvodu jako deník vyřazení u sběru:
bez něj se pravidla nedají brousit.

### `pruzkumy`

Fronta požadavků na průzkum území. Aplikace do ní zapisuje, agent si z ní
bere práci.

| sloupec | typ | poznámka |
|---|---|---|
| `id` | uuid pk | |
| `oblast_id` | uuid → `oblasti` not null | co se má prozkoumat |
| `kampan_id` | uuid → `kampane` | kvůli které kampani, nepovinné |
| `stav` | text not null | `ceka` \| `bezi` \| `hotovo` \| `selhalo` |
| `pozadal` | text not null | e-mail toho, kdo objednal |
| `pozadano_at` | timestamptz not null | |
| `zahajeno_at`, `dokonceno_at` | timestamptz | |
| `run_id` | uuid → `agent_runs` | běh, který požadavek vyřídil (TP-13) |
| `firem_prevzato` | int | kolik se převzalo z překryvu, bez hledání |
| `firem_novych` | int | kolik Čmuchal našel nově |
| `chyba` | text | vyplněné při `selhalo` |

`pruzkumy` a `agent_runs` jsou dvě různé věci: první je **objednávka**,
druhá **provedení**. Jeden požadavek může mít i víc pokusů.

### Pravidla přístupu

Migrace přidá pravidla ve stylu migrace 0016: čtení kdokoli přihlášený,
zápis role `super-admin`, `admin`, `uzivatel`. Nepřihlášený nevidí nic.
Po nasazení se pustí kontrola `get_advisors` typu `security`.

## 4. Průvodce

Čtyři kroky. Po každém se kontroluje, jestli se dá pokračovat. Rozdělaná
kampaň se ukládá po každém kroku (`stav = rozpracovana`, `krok` = kde se
skončilo), takže se dá kdykoli opustit a vrátit se.

### Krok 1 — Založení

Vyplní se název, popis (volitelný), kontext a správce kampaně.

**Kontrola:** název je vyplněný a ještě neexistuje (bez ohledu na velikost
písmen); správce je vybraný ze seznamu uživatelů.

### Krok 2 — Území

Mapa se všemi uloženými oblastmi, jak ji zná uživatel z obrazovky Oblasti.
Přibývá **hledání místa** — zadá se název obce, pohled se přesune.
Vyhledávání jde přes Nominatim, nejvýš **jeden dotaz za sekundu**;
psaní se proto zdržuje, dotaz odejde až po odmlce. Kontaktní e-mail
v hlavičce, jak to dělá jádro, tady nastavit nejde — prohlížeč hlavičku
`User-Agent` měnit nedovolí. Nominatim v takovém případě identifikuje
volajícího podle adresy stránky, která dotaz poslala, což jeho podmínkám
odpovídá.

Uživatel buď vybere existující oblast, nebo nakreslí novou (kruh i tvar,
stejné ovládání jako dnes).

**Kontrola:** oblast je vybraná a má tvar, který ohraničí plochu.

### Krok 3 — Průzkum

Větví se podle toho, co vzniklo v kroku 2:

**Existující oblast** — firmy jsou prozkoumané, jde se rovnou dál.
Do kampaně se převezmou firmy, které v oblasti leží.

**Nové území** — nejdřív se **převezmou firmy z překryvu** s už
prozkoumanými oblastmi; ty se nehledají znovu. Na zbytek se založí
požadavek do `pruzkumy` a kampaň přejde do stavu `ceka_na_pruzkum`.

Tlačítko **Přeskočit** posune uživatele na krok 4 s tím, co je k dispozici.
Kampaň ale zůstane ve stavu `ceka_na_pruzkum` a **schválit ji nejde**,
dokud průzkum neproběhne.

**Kontrola pro postup na schválení:** požadavek je ve stavu `hotovo`
a kampaň má aspoň jednu firmu se zapsaným kontaktem.

### Krok 4 — Posouzení seznamu

Shrnutí, ze kterého se pozná, jestli má smysl kampaň pouštět dál:

- kolik firem je v seznamu a kolik z nich má doložené spojení
- rozpad kontaktů podle úrovně adresy (TP-6: obecná / poptávková / jmenná)
- kolik firem už je v jiné kampani, se jmény těch kampaní — **upozorní, nebrání**
- volná kapacita jídelny proti počtu firem, když je kapacita známá

Firmu jde ze seznamu vyřadit ručně; důvod je povinný.

**Výstup:** stav `schvalena`. Nic se neodesílá.

## 5. Stavy kampaně

| stav | znamená | kam se dá |
|---|---|---|
| `rozpracovana` | průvodce rozdělaný a uložený | `ceka_na_pruzkum`, `k_posouzeni`, `zrusena` |
| `ceka_na_pruzkum` | požadavek objednaný, agent nedokončil | `k_posouzeni`, `zrusena` |
| `k_posouzeni` | seznam hotový, čeká na člověka | `schvalena`, `ceka_na_pruzkum`, `zrusena` |
| `schvalena` | seznam potvrzený; **dál se ve fázi 0–2 nedostane** | `zrusena` |
| `bezi` | oslovení probíhá — **až fáze 3** | — |
| `uzavrena` | hotovo a vyhodnoceno — **až fáze 3** | — |
| `zrusena` | zrušená s důvodem | — |

`bezi` a `uzavrena` jsou v číselníku od začátku, aby se schéma kvůli fázi 3
nemuselo měnit. **Žádný kód je v této fázi nenastavuje** a přechod do nich
neexistuje.

**Kampaně se nemažou.** Zrušení je stav s důvodem. Mazání dat je
rozhodnutí majitele, ne výchozí chování.

## 6. Kde vstupují agenti

| krok | kdo jedná | co dělá |
|---|---|---|
| 1 | člověk | pojmenuje záměr; tohle agent nezastane |
| 2 | člověk | kreslí tvar sám; návrh tvaru Čmuchalem je odložený do fáze 4 (kap. 11) |
| 3 | **Čmuchal** | vyzvedne požadavek z `pruzkumy`, dohledá firmy a kontakty, zapíše výsledek a `run_id` |
| 4 | systém počítá, člověk schvaluje | souhrn je obyčejný výpočet, žádný agent |
| fáze 3 | **Obchodník** | píše oslovení po jedné firmě; mimo rozsah tohoto zadání |

Ve fázi 0–2 tedy vstupuje do průvodce **jediný agent, Čmuchal, a jen
v kroku 3**. Zbytek je člověk a obyčejný výpočet.

## 7. Pojistky

1. **Kampaň nejde schválit bez jediné firmy s kontaktem.**
2. **Kampaň nejde schválit s nedokončeným průzkumem.**

   Obojí hlídá **spoušť v databázi** nad `kampane` při přechodu do
   `schvalena`, ne jen formulář. Prostá podmínka (`check`) na to nestačí —
   musí se koukat do jiných tabulek. Aplikace tlačítko zašedne dřív, ale
   to je pohodlí, ne pojistka.

3. **Vyřazení má povinný důvod**, zrušení kampaně také.
4. **Název je jedinečný** na úrovni databáze, ne jen formuláře.
5. **Odesílání:** v tomto rozsahu nevzniká žádný kód, který by odesílal,
   skládal text zprávy nebo sahal na `system_state.sending_enabled`.

## 8. Co se nestaví

- odesílání čehokoli
- skládání textu zpráv, šablony, knihovna tvrzení
- stav oslovení u jednotlivé firmy (`osloven`, `odpovedel`…)
- vlastní oprávnění ke kampani nad rámec rolí
- naplánované spouštění agenta

## 9. Testy

Nad PGlite, offline, bez proměnných prostředí — jako zbytek sady.

- založení kampaně a jedinečnost názvu (včetně různé velikosti písmen)
- přechody stavů: povolené projdou, nepovolené spadnou
- schválení bez firmy s kontaktem neprojde
- schválení s nedokončeným průzkumem neprojde
- **vyřazená firma zůstane vyřazená i po doplnění nových firem** —
  regrese, kterou by bylo snadné zavést
- převzetí firem z překryvu nezaloží požadavek na už známé firmy
- výpočet překryvu s jinými kampaněmi vrací správné firmy i názvy kampaní
- zrušení bez důvodu neprojde

## 10. Pořadí prací

Ve dvou dávkách, aby se dalo po první zastavit a přehodnotit:

1. **Jádro bez obrazovky** — migrace, repository vrstva, přechody stavů,
   fronta `pruzkumy`, příkazy do CLI, celá testovací sada. Po téhle dávce
   umí kampaně vzniknout a projít stavy z příkazové řádky.
2. **Průvodce v aplikaci** — čtyři kroky, hledání místa v mapě, souhrn
   a schválení.

Stejné pořadí jako u oblastí: jádro nejdřív, obrazovka až na hotovém.

## 11. Rozhodnuto majitelem (2026-07-29)

1. **Schválit kampaň smí jen `admin` a `super-admin`.** Připravit ji smí
   i `uzivatel`. Schválení je brána, za kterou ve fázi 3 začne odcházet
   komunikace ven, a drží se proto výš. Vynucují pravidla přístupu
   v databázi, ne jen zašedlé tlačítko.
2. **Čmuchal zatím tvar oblasti nenavrhuje.** Odloženo do **fáze 4**
   (optimalizace) — tam se poprvé měří, co doopravdy funguje, a teprve
   podle toho půjde poznat, jestli je návrh tvaru k něčemu, nebo ho
   člověk stejně vždy překreslí. V první verzi si tvar kreslí člověk sám.
   Kapitola 6 tomu odpovídá: návrh tvaru je označený jako volitelný přínos.
