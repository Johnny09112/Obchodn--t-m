# Průvodce kampaní v aplikaci — postup

> Návrh postupu, ne zadání. Zadání obrazovek je
> `docs/superpowers/specs/2026-07-29-kampane-design.md`.
> Sepsáno 2026-07-31, poté co byly opraveny obě překážky (skóre firem
> z oblasti, postupová čísla průzkumu).

## Kde jsme

Jádro kampaní je hotové a otestované. Ovládá se **jen z příkazové řádky**
(`cli kampan`, `cli pruzkum`). V aplikaci o kampaních není ani řádek —
`app/src/` má přihlášení, kartotéku, mapu a oblasti.

Chybí tedy obrazovky, ne logika.

## Nejdřív rozhodnout: kdo pustí Čmuchala

**Tohle je největší riziko celé práce a není technické.**

Aplikace agenta spustit neumí — podle pravidel si o průzkum jen *požádá*
a Čmuchal si práci vyzvedne, až poběží. Jenže Čmuchala dnes pouští člověk
z příkazové řádky.

Krok 3 průvodce tedy skončí obrazovkou „čeká na průzkum", která bude čekat
tak dlouho, dokud si někdo nevzpomene spustit příkaz. Uživatel (kolega)
u sebe příkazovou řádku nemá.

Bez rozhodnutí, jak se tahle mezera překlene, je průvodce nedokončitelný —
postaví se krásná cesta, která v půlce končí u zdi. Návrh variant je
v otázkách na konci.

## Etapy

Pořadí je dané tím, co komu odemyká práci, ne velikostí.

### A — Design napřed, bez psaní kódu

Dosud se obrazovky stavěly rovnou z kódu. U průvodce se to nevyplatí:
jsou to čtyři obrazovky s jedním průběžným stavem, kde se snadno vyrobí
čtyři různé dialekty téhož.

1. **Audit designového systému** (`/design-system audit`).
   Aplikace má dnes 125 designových proměnných, pojmenovanou paletu a tři
   role písma — základ existuje. Audit zjistí, co je pojmenované a co se
   píše natvrdo, a **doplní chybějící součástky, které průvodce bude
   potřebovat**: krokovník, štítek stavu, prázdný stav, potvrzovací dialog.
2. **Návrh čtyř obrazovek** (brainstorming + `frontend-design`).
   Ne vzhled, ale co je na které obrazovce, co jde dál a co zpátky, a jak
   vypadá každá obrazovka, když je prázdná nebo se čeká.
3. **Texty** (`/ux-copy`). Popisky tlačítek, chybové hlášky, prázdné stavy —
   česky a lidsky. Průvodce používá člověk, který nezná slovník systému;
   „Objednat průzkum" a „Spustit agenta" znamenají totéž, ale jen jedno
   z toho je srozumitelné.

Výstup etapy: dokument s obrazovkami a texty ke schválení. **Nic se
nestaví, dokud to majitel neodsouhlasí.**

### B — Kroky 1 a 2: založení a území

Nejmenší riziko, hned použitelné. Kampaň jde založit, pojmenovat, přiřadit
jí správce a nakreslené území. Napojuje se na hotovou mapu.

Použitelné samo o sobě, i kdyby se dál nepokračovalo.

### C — Kroky 3 a 4: průzkum a posouzení seznamu

Nejvíc logiky a jediné místo, kde se čeká na agenta. Předpokládá rozhodnutí
z úvodu (kdo pustí Čmuchala).

Krok 4 je ten cenný: seznam firem s důvody, proč tam kdo je — a proč tam
někdo není (síto z 31. 7. vrací vynechané firmy i s důvodem).

### D — Kritika, přístupnost, předávka

1. **`/design-critique`** nad hotovými obrazovkami — hierarchie, srozumitelnost.
2. **`/accessibility-review`** — hlavně ovládání klávesnicí a kontrast.
   Průvodce je formulář, u formulářů se to vyplácí nejvíc.
3. Zápis do paměti a HTML shrnutí pro majitele.

## Co se v této práci NESTAVÍ

- **Odesílání čehokoli.** Zůstává zakázané až do fáze 3 (TP-8).
- **Spouštění agenta z aplikace**, dokud o tom majitel nerozhodne.
- **Mazání kampaní.** Mazání dat rozhoduje majitel, není součástí zadání.
- **Přiřazování firem k jídelnám.** Samostatná funkce (rozhodnutí 2026-07-30).

## Otázky na majitele

1. **Jak se dozví systém, že má pustit Čmuchala?** Tři varianty:
   - *(a)* Zůstane to ruční: aplikace ukáže „objednáno", majitel průzkum
     pustí z příkazové řádky a aplikace si výsledku všimne. Nejlevnější,
     ale kolega je odkázaný na majitele.
   - *(b)* Naplánovaný běh: Čmuchal se sám ptá na frontu objednávek každých
     pár hodin. Střední práce, žádné nové riziko — pořád nic neodesílá.
   - *(c)* Spuštění z aplikace. Nejpohodlnější, ale znamená to dát webu
     právo pustit agenta; to je změna pravidel a chce vlastní rozvahu.

   **Doporučuji (b)** — odemkne to kolegu a nemění to žádné tvrdé pravidlo.

2. **Má být průvodce použitelný na mobilu?** Kreslení oblastí na telefonu
   je nepraktické, ale *prohlédnout si a schválit* seznam firem cestou dává
   smysl. Doporučuji: kroky 1–2 na počítači, krok 4 čitelný i na mobilu.

3. **Kdo smí kampaň schválit?** Dnes admin a výš. Zůstává to tak i v aplikaci?
