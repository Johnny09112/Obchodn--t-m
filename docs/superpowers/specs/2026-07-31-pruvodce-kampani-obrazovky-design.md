# Průvodce kampaní — obrazovky (etapa A)

> Návrh obrazovek, textů a chybějících součástek designového systému.
> Navazuje na `2026-07-29-kampane-design.md`, které popisuje chování a data;
> tenhle dokument popisuje, **jak to vypadá a co to říká člověku**.
>
> Vizuální podoba: `docs/vizualizace/pruvodce-kampani-navrh.html`
> Postup celé práce: `docs/PRUVODCE-KAMPANI-POSTUP.md`

## 1. Co v původním zadání zastaralo

Zadání z 29. 7. je jinak platné, ale dvě jeho místa už neodpovídají skutečnosti:

- **Kap. 12 „Čmuchal zatím neumí prozkoumat oblast" neplatí.** Umí to od
  30. 7., sloučeno do `main` 31. 7. Krok 3 průvodce tedy dojede naplno
  i nad nově nakresleným územím.
- **Kap. 8 vylučovala „naplánované spouštění agenta".** Majitel to 31. 7.
  otočil — plánovaný běh se staví jako etapa B+, před obrazovkami. Bez něj
  by krok 3 čekal na člověka s příkazovou řádkou.

Přibylo naopak něco, co zadání znát nemohlo: **mezi územím a kampaní je od
31. 7. síto** (`duvodNeoslovovat`). Počet firem v území a počet firem
v kampani se proto liší a obrazovky s tím musí počítat.

## 2. Rozhodnutí majitele (31. 7. 2026)

1. **Celá mapa včetně kreslení je přímo v průvodci**, ne odkaz na obrazovku
   Oblasti. Doporučoval jsem opak (méně práce, jedna mapa); majitel zvolil
   plynulejší průchod. **Provedení:** mapa a kreslení se vyříznou do sdílené
   součástky, kterou použijí obě obrazovky. Dvě samostatné mapy by se časem
   rozešly a to je horší než ta práce navíc.
2. **Mobil částečně** — kroky 1–2 na počítači, krok 4 čitelný i na telefonu.
3. **Schvalovat smí jen admin a výš**, beze změny.
4. **Správcem je zakladatel kampaně** a smí pověřit **zástup** — druhou
   osobu, která kampaň upraví, když on nemůže. Úpravy se tím zamykají na
   správce, zástup a admina; dnes do nich smí kdokoli přihlášený. Zástup
   **neschvaluje** — schválení zůstává na adminovi. Podrobně v 3.5.

## 3. Obrazovky

Pět obrazovek: seznam kampaní a čtyři kroky průvodce.

### 3.0 Seznam kampaní

Nová položka v horní liště vedle Oblastí a Kartotéky. Odsud se kampaň zakládá
a sem se člověk vrací k rozdělané.

Sloupce: název · stav · území · firem · správce · změněno.

**Stav se kóduje tvarem i barvou** (existující součástka `.stav`):
rozpracovaná = prázdné kolečko · čeká na průzkum = plné kolečko ·
k posouzení = kosočtverec · schválená = čtvereček · zrušená = křížek.

**Dokončený průzkum se ohlašuje tady.** Systém ve fázi 0–2 nic neodesílá
(TP-8), takže e-mailové upozornění nepřipadá v úvahu — stavět kvůli němu
odesílání by porazilo tvrdé pravidlo. Řádek kampaně proto nese značku
„Průzkum dokončen — pokračovat". Seznam je jediné místo, kde se to člověk
dozví, a je to vědomá volba, ne opomenutí.

Prázdný stav: „Zatím tu žádná kampaň není. Kampaň je pojmenovaný seznam
firem, které chcete oslovit — nic se z ní neodesílá."

### 3.1 Krok 1 — Založení

Pole: **Název kampaně** (povinný, jedinečný) · **K čemu kampaň je**
(nepovinné) · **Správce kampaně**.

Popis a kontext ze schématu se v rozhraní slučují do jednoho pole
„K čemu kampaň je"; zapisuje se do sloupce `kontext`, `popis` zůstává
prázdný. Dvě volná textová pole vedle sebe nikdo nerozliší a jedno z nich
zůstane vždy nevyplněné.

**Správcem je automaticky ten, kdo kampaň zakládá** (rozhodnuto 31. 7.).
Jeho e-mail se jen ukáže, nevybírá se. Vynucuje to i databáze — viz 3.5.

**Zástup (nepovinné).** Druhá osoba, která smí kampaň upravovat, když
správce není k dispozici (nemoc, dovolená). Vybírá se z evidence lidí
(3.5). Výchozí hodnota „nikdo".

Zástup jde změnit **kdykoli později**, nejen při zakládání — nemoc se
dopředu neplánuje. Pole je proto i na kartě kampaně, nejen v kroku 1.

Popisek: „Zástup (nepovinné) — kdo smí kampaň upravovat, když nebudete
k dispozici. Schvalovat kampaň může dál jen admin."

Chyba u jména: „Kampaň s tímhle názvem už existuje. Zvolte jiný — na
velikosti písmen nezáleží."

**Žádné tlačítko „uložit".** Rozdělaná kampaň se ukládá po každém kroku
(`stav = rozpracovana`, `krok` = kde se skončilo).

### 3.2 Krok 2 — Území

Hledání místa, mapa s uloženými oblastmi, kreslení kruhu i tvaru — sdílená
součástka s obrazovkou Oblasti.

**Ukazují se dvě čísla, ne jedno:**

```
V území leží ·············· 41 firem
Do kampaně projde ········· 38 firem
```

s vysvětlením, co ty tři firmy vyřadilo. Dnešní mapa ukazuje jen „firem
uvnitř"; kdyby obrazovka rozdíl zamlčela, vypadal by v kroku 4 jako chyba.

Kontrola: oblast je vybraná a má tvar, který ohraničí plochu.

### 3.3 Krok 3 — Průzkum

**A — území už prozkoumané.** Klidné oznámení („Území je prozkoumané.
Do kampaně se převezme 38 firem, hledat se nic nemusí.") a tlačítko dál.

**B — nové území.** Proužek postupu po obcích, čísla „převzato z okolních
oblastí / nově nalezeno" a vysvětlení, že Čmuchal si objednávku vyzvedne sám
při nejbližším běhu a okno jde zavřít.

Postup po obcích je **hotový údaj** — průzkum se dělí na úseky a jejich stav
je v `pruzkum_useky`. Nic se kvůli tomu nepočítá znovu.

Tlačítko **Přeskočit a jít na seznam** posune na krok 4 s tím, co je
k dispozici; kampaň zůstane `ceka_na_pruzkum` a schválit ji nejde. Napsáno
u tlačítka, ne až po kliknutí.

### 3.4 Krok 4 — Seznam firem

Souhrn: firem v seznamu · se spojením · rozpad podle úrovně adresy (jmenná /
pro nabídky / obecná) · volná kapacita jídelny · překryv s jinými kampaněmi
(upozorní, nebrání).

**Vyřazené firmy jsou nahoře, ne schované** — „V území leží, ale do kampaně
nepatří (3)" i s důvodem u každé. Kdo nevidí, proč firma chybí, přestane
pravidlům věřit a začne je obcházet ručně; zároveň je to nejrychlejší způsob,
jak poznat špatně nastavené pravidlo.

Tabulka firem tříděná podle skóre (funguje i pro firmy z oblasti — opraveno
31. 7.). U každé firmy **Vyřadit** s povinným důvodem.

**Schválit kampaň** otevře dialog: „Seznam 38 firem se tím uzamkne a nepůjde
do něj přidávat. Nic se neodesílá — oslovování přijde na řadu později."

Když schválit nejde, **tlačítko je vidět a je zašedlé, s důvodem vedle**:
„Schválit půjde, až bude v seznamu aspoň jedna firma s doloženým spojením.
Teď je jich 0 z 38." Druhá podoba se týká nedokončeného průzkumu.

Tlačítko se **nezobrazí vůbec** roli `uzivatel` — ať aplikace neláká na
něco, co databáze stejně zamítne. Zamítnutí platí i tak: hlídá ho databáze,
ne tlačítko.

### 3.5 Evidence lidí a kdo smí do kampaně sáhnout

Rozhodnuto majitelem 31. 7. Je to **zpřísnění dnešního stavu**, ne kosmetika.

#### Jak je to dnes

`kampane_zapis` (migrace 0018) pouští k zápisu **kohokoli s rolí `uzivatel`
a výš, do kterékoli kampaně**. Sloupec `spravce` je čistě informativní
cedulka — neváže na sebe žádné právo. Jediné omezení je přechod do
`schvalena`, ten smí admin a výš.

Zástup by tedy dnes nedával smysl: není koho zastupovat, když můžou všichni.

#### Evidence lidí (`uzivatele`)

Aby šlo zástup vybrat, potřebuje aplikace seznam lidí. **Vypsat přihlašovací
účty prohlížeč nesmí** — šlo by to jen servisním klíčem, který obchází
všechna pravidla přístupu, a ten do programu běžícího v prohlížeči nepatří
(kdokoli si ho tam přečte a získá plný přístup k celé databázi).

Řešení je vlastní malá tabulka: `uzivatele (id uuid, email text)`, plněná
spouští při vzniku účtu, čitelná pro přihlášené. **Žádné tajemství v ní
není** — jen e-maily lidí, kteří už tak jeden druhého vidí v kartotéce.

Role se sem **nekopíruje**. Mění se příkazem `cli uzivatel role` do
`app_metadata` a druhý opis by se dřív nebo později rozešel s pravdou.

#### Nová pravidla přístupu

| Co | Kdo smí |
|---|---|
| Číst kampaně | kdokoli přihlášený (beze změny) |
| Založit kampaň | `uzivatel` a výš, a **musí se zapsat jako správce** |
| Upravit kampaň | správce · zástup · admin a výš |
| Schválit kampaň | **admin a výš** (beze změny) |
| Upravit seznam firem kampaně | stejné jako úprava kampaně |

**Admin má přístup vždycky.** Bez toho by kampaň po odchodu správce
osiřela a šla opravit jen ručním zásahem do databáze.

**Seznam firem se musí zamknout taky** (`kampan_firmy`, přes rodičovskou
kampaň). Zamknout kampaň a nechat její seznam firem otevřený by byl zámek
na dveřích vedle otevřeného okna. Totéž platí pro objednávky průzkumu
(`pruzkumy`) navázané na kampaň.

#### Co se schválně nedělá

- **Žádný cizí klíč na `uzivatele`** u sloupců `spravce` a `zastupce`.
  Bezpečnost stojí na pravidle přístupu (`zastupce = auth.email()`);
  překlep tedy znamená jen nefunkční zástup, ne díru. Cizí klíč by naopak
  vynutil evidenci lidí i ve všech testech a v příkazové řádce, kde se
  dnes používají volně psané e-maily.
- **Zástup neschvaluje.** Zastupitelnost u schvalování už existuje —
  admini jsou dva.
- **Není nová role „editor".** Zástup je pověření ke konkrétní kampani,
  ne další stupeň v žebříčku rolí.

## 4. Doplňky designového systému

Audit současného stavu: 10 pojmenovaných barev, 3 role písma, jeden poloměr
zaoblení; komponenta stavu kóduje stav tvarem i barvou; prázdný stav
a viditelné zaostření klávesnicí existují. Aplikace je jednobarevná (světlá)
a **záměrně se to nemění**.

Chybí a doplní se:

| Součástka | K čemu |
|---|---|
| Krokovník | Tři stavy: hotový, právě zde, čeká |
| Dialog | Schválení kampaně, zrušení s povinným důvodem |
| Hláška ve třech podobách | Dnes existuje jen chybová (cihlová) |
| Proužek postupu po obcích | Čekání na průzkum v kroku 3 |
| Stupnice odstupů a velikostí písma | Rozměry se dnes píšou od oka |
| Čtyři chybějící barvy | Dnes psané natvrdo, `#f7ecea` dokonce dvakrát |

Nic z toho nemění dnešní vzhled — jsou to doplňky. Jediná skutečná přestavba
je vyříznutí mapy do sdílené součástky.

## 5. Přístupnost

Kontroluje se až v etapě D, ale návrh s tím počítá od začátku:

- Stav nese vždy **tvar i text**, ne jen barvu.
- Krokovník je seznam, ne obrázek — čtečka přečte „krok 2 ze 4, Území".
- Zašedlé tlačítko má **důvod napsaný vedle**, ne jen v bublině po najetí
  myší; na dotykovém displeji se bublina nedá vyvolat.
- Zaostření klávesnicí už aplikace řeší globálně (`:focus-visible`).

## 6. Co se v této práci nestaví

- Odesílání čehokoli, včetně upozornění na dokončený průzkum (TP-8).
- Mazání kampaní — zrušení je stav s důvodem.
- Návrh tvaru oblasti Čmuchalem (odloženo do fáze 4).
- Přiřazování firem k jídelnám (samostatná funkce).

## 7. Otevřené k dořešení

- **Jak často má plánovač běžet a kde poběží.** Řeší etapa B+; obrazovka
  kroku 3 zmiňuje „nejbližší běh", takže interval se do textu doplní až
  potom.
- **Odhad zbývajícího času** v kroku 3 předpokládá, že se dá spočítat
  z hotových úseků. Ověřit při stavbě; když ne, zůstane jen počet obcí.
- **Naplnění `uzivatele` pro už existující účty.** Spoušť zachytí nově
  vzniklé; čtyři dnešní účty se doplní jednorázově při migraci.
- **Zamčení `pruzkumy`** na správce a zástup — ověřit, že to nerozbije
  objednávku průzkumu z příkazové řádky, kde žádný přihlášený člověk není.
