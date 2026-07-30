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

## Rozhodnuto (2026-07-31)

Aplikace agenta spustit neumí — podle pravidel si o průzkum jen *požádá*.
Čmuchala dnes pouští člověk z příkazové řádky, kterou kolega u sebe nemá.
Krok 3 průvodce by tedy čekal, dokud si někdo nevzpomene spustit příkaz.

**Majitel rozhodl: naplánovaný běh.** Čmuchal se sám podívá na frontu
objednávek každých pár hodin. Aplikace zůstává u objednávání, agenta
nespouští — žádné tvrdé pravidlo se tím nemění. Je to **předpoklad
etapy C** a dělá se před ní.

Dále rozhodnuto:

- **Mobil částečně** — kroky 1–2 na počítači, krok 4 čitelný i na telefonu.
  Kreslení oblasti prstem je nepřesné, prohlédnout a schválit seznam firem
  cestou dává smysl.
- **Schvalovat smí dál jen admin a výš.** Role `uzivatel` kampaň připraví,
  neschválí. Beze změny.

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

### B+ — Naplánovaný běh Čmuchala

Samostatná, čistě serverová práce: Čmuchal si sám bere objednávky z fronty
(`pruzkumy` ve stavu `ceka`) každých pár hodin. Nesouvisí s obrazovkami,
ale **etapa C bez ní nedává smysl** — jinak by průvodce jen ukazoval
čekání, které nikdo neukončí.

Pozor při stavbě: dva běhy nad toutéž objednávkou by si rvaly úseky mezi
sebou (viz komentář ke kroku 4 v `src/cmuchal-oblast.ts`). Plánovač proto
musí zaručit jeden běh naráz.

### C — Kroky 3 a 4: průzkum a posouzení seznamu

Nejvíc logiky a jediné místo, kde se čeká na agenta. Předpokládá hotovou
etapu B+.

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

## Otevřené k dořešení

- **Jak často má plánovač běžet a kde poběží.** Naplánovaný běh je
  odsouhlasený, ale interval a prostředí (server, vlastní stroj) rozhodnuté
  nejsou. Vyřeší se na začátku etapy B+.
- **Jak se uživatel dozví, že je průzkum hotový.** Obrazovka to ukáže při
  načtení; jestli má přijít i upozornění, je věc návrhu v etapě A.
