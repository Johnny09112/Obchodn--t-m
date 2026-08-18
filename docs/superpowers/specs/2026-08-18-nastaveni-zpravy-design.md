# Nastavení zprávy u kampaně — parametry nabídky a editor šablony

**Stav:** schváleno majitelem 18. 8. 2026 · **Datum:** 2026-08-18

> Návrh nanečisto, který majitel schvaloval:
> `docs/vizualizace/navrh-nastaveni-zpravy-2026-08-18.html`.
> Při rozporu platí `SPEC.md`.

## 1. K čemu to je

Text oslovení dnes leží v kódu (`src/obsah-schvaleny.ts`). Změnit větu
znamená sáhnout do repozitáře, takže to majitel nemůže udělat sám —
a u dalšího zákazníka by to znamenalo psát mu texty ručně.

Majitel to 18. 8. shrnul takhle: *„Pokud u docházkového systému budu chtít
nějakou část vždy měnit na základě dat, musí to jít nastavit snadno přes
user-friendly rozhraní — bez kódování."* A o kus dál: *„Nastavení parametrů
e-mailů musí být principielně vždy ke kampani. Mohu si vybrat šablonu, ale
reálně mohu mít vícero produktů a každý zaměřovat a specifikovat zvlášť
pro danou oblast."*

Z toho plyne rozdělení odpovědností, na kterém stojí celý návrh:

| Kdo | Za co odpovídá |
|---|---|
| **Nabídka** (dnes jídelna) | fakta o tom, co prodáváme — cena, provize, co umíme dodat |
| **Kampaň** | co se v mailu doopravdy řekne — která šablona, čím se vyplní pole, co se vynechá |
| **Šablona** | stavba zprávy a její text; je společná víc kampaním |

Cena patří nabídce, protože se na ní někdo dohodl. Rozhodnutí, jestli se
cena v mailu vůbec zmíní, patří kampani.

## 2. Naléhavý důvod, proč to není jen pohodlí

Dnešní šablona tvrdí každé firmě „s možností obědvat na místě **nebo** si
jídlo odvážet v jídlonosičích". Majitel 18. 8. upozornil, že jídelna může
umět jen výdej do jídlonosičů, nebo naopak jen stravování na místě —
**u které jídelny to jak je, zatím nikde zapsané není.** Jakmile bude
mezi partnery jídelna jen s jednou z těch možností a odesílalo by se,
**rozešle systém nepravdivé tvrzení o službě** — přesně ta kategorie chyby,
kvůli které existuje knihovna tvrzení a kontrola stylu.

Věta o výdeji se proto musí skládat z toho, co konkrétní nabídka umí.

## 3. Datový model

### 3.1 Nabídka odděleně od jídelny

Nová tabulka `nabidky` (id, produkt_kod, nazev). `jidelny` dostane
`nabidka_id`. Jídelně zůstávají jen údaje, které jsou opravdu jen její —
poloha, `zona_metru`, `kapacita_volna`, `stav` — protože podle nich se
počítá dosah a nikdo jiný je nemá.

**Proč nová tabulka, a ne sloupce v `jidelny`:** docházkový systém ani
on-line služba nemají zónu ani polohu. Kdyby hodnoty parametrů visely na
`jidelny`, druhý produkt by si vynutil buď falešnou jídelnu, nebo přepis
všeho, co dnes na `jidelny` závisí (`dosah`, `zona`, `cmuchal`).

`produkt_kod` ukazuje na existující profil produktu (`profil_kod`,
migrace 0035–0037) — nezavádí se druhý pojem pro totéž.

### 3.2 Parametry a jejich hodnoty

```
parametry_nabidky   (id, produkt_kod, kod, nazev, druh, jednotka, poradi, moznosti)
hodnoty_parametru   (nabidka_id, parametr_id, hodnota)   -- primární klíč obojí
```

`druh` je jeden ze čtyř: `cislo`, `text`, `ano_ne`, `vyber`. U `vyber`
drží `moznosti` seznam voleb (u možností výdeje čtyři: na místě, jídlonosič,
jednorázový obal, odvoz či rozvoz) a `hodnota` drží vybranou podmnožinu.

`hodnota` je **jeden textový sloupec** pro všechny čtyři druhy; převod na
číslo nebo seznam dělá kód podle `druh`. Čtyři sloupce pro čtyři druhy by
znamenaly, že tři jsou u každého řádku prázdné. Kontrola tvaru (že do
`cislo` nikdo nenapíše slovo) patří do zápisu, ne do schématu — jinak by
přidání pátého druhu znamenalo migraci.

Čtyři druhy schválně, ne víc: pokrývají všechno, co majitel jmenoval, a
každý další druh je rozhodnutí navíc při zavádění každého parametru.

**Hranice, která se nesmí smazat:** parametr popisuje **naši nabídku**, ne
oslovovanou firmu. Údaj o cizí firmě se sem zavést nedá. O firmě smí do
zprávy jen to, co má záznam v `evidence` se zdrojem a doslovnou citací
(TP-2, TP-3) — kdyby šlo obojí zadávat na jednom místě, dřív nebo později
by do mailu odešlo tvrzení o firmě, které nikdo nedoložil.

### 3.3 Pole šablony a jejich nastavení u kampaně

```
pole_sablony        (id, template_id, kod, nazev, povinne, poradi)
nastaveni_pole      (kampan_id, pole_id, rezim, hodnota)
```

`rezim` je `z_dat`, `pevne` nebo `vynechat`. U `z_dat` říká `hodnota`, který
zdroj se použije; u `pevne` je to text platný pro celou kampaň.

**Zdroje pro `z_dat`** jsou dané kódem, protože každý je dotaz do dat:

| Zdroj | Odkud | Poznámka |
|---|---|---|
| jméno adresáta | `contacts` | jediné pole s náhradou — viz 4.1 |
| vzdálenost k jídelně | `dosah` | vlastní výpočet, netýká se whitelistu |
| obor firmy | `evidence` (atribut `obor`) | jen s doloženým zdrojem |
| obec firmy | `companies` | z ARES |
| kterýkoli parametr nabídky | `hodnoty_parametru` | přibývají bez zásahu do kódu |

Poslední řádek je ta podstatná část: **zavedený parametr se sám stane
použitelným polem i podmínkou.** Bez toho by přidávání parametrů znamenalo
sledovat údaj, který nejde použít.

### 3.4 Podmíněné pasáže

```
podminky_pasaze     (id, template_id, od_znaku, do_znaku, parametr_id, ocekavana_hodnota)
```

Pasáž textu se zobrazí, jen když parametr nabídky odpovídá. Podmínka se
**vybírá z nabídky, nepíše** — žádný jazyk se šablonami se nezavádí.

## 4. Pravidla, která systém vynucuje

### 4.1 Chybějící údaj

Rozhodl majitel 18. 8. (paměť `jedna-sablona-a-uplnost-blokuje`):

- **jméno adresáta** chybí → doplní se „Dobrý den," a mail se pošle;
- **kterýkoli jiný povinný údaj** chybí → firma **se do kampaně nezahrne**
  a v seznamu firem má výrazné upozornění, co jí chybí.

Povinnost je vlastnost pole (`pole_sablony.povinne`), ne seznam v kódu.
Dnešní `POVINNE_SLOTY` v `src/obsah.ts` se stane odvozeninou z dat, aby
seznam nežil ve dvou kopiích (past `tri-kopie-seznamu-atributu`).

### 4.2 Cena při víc jídelnách

Rozhodl majitel 18. 8.: mají-li všechny dotčené nabídky **stejnou** cenu,
napíše se „115 Kč" bez „od". **Liší-li se**, vezme se **nejnižší** a předřadí
se „od": „od 115 Kč".

**Dotčená nabídka** = ta, která má v dosahu aspoň jednu firmu ze seznamu
k oslovení dané kampaně. Ne každá nabídka v území: firmy, které z kampaně
vypadly, cenu neovlivňují. Nabídka s nevyplněnou cenou se do výpočtu
nepočítá — místo toho **vyřadí své firmy** podle pravidla 4.1, protože
povinné pole nemá čím vyplnit.

Všichni adresáti jedné kampaně dostanou totéž číslo — líp se to kontroluje
a nižší cenou se nikdo nepoškodí.

### 4.3 Co kontrola nepustí do uložené šablony

Beze změny proti dnešku, jen se to přesune z kódu do obrazovky:

1. text neprojde `zkontrolujZpravu` (zakázaná fráze, přes 120 slov, odrážky,
   jiný počet otázek než jedna, malé „vaše", HTML, clickbait v předmětu);
2. pole čerpá z atributu firmy, který není ve whitelistu (TP-3).

Kontrola se ozve **při psaní**, ne až při odeslání. Šablona se schvaluje
jednou a použije tisíckrát.

### 4.4 Verze a spuštění

Rozhodl majitel 18. 8.: měnit smí **admin a výš** (stejná role, která dnes
mění kapacitu jídelny). Uložená změna je **koncept**; platnou verzí se stane
teprve tlačítkem „pustit do provozu". Stará verze zůstává, protože odeslané
zprávy se na ni odkazují (TP-13).

## 5. Obrazovky

### 5.1 Jídelny (úprava)

Seznam dostane jeden sloupec se souhrnem („115 Kč · 4 ze 4 vyplněno", při
chybějícím povinném parametru červeně) a tlačítko **Upravit**.

Úpravy se dějí ve **vyskakovacím okně**, ne v řádku seznamu — u pátého
parametru by se řádek rozpadl. Okno má dvě skupiny: *Vlastní jídelně*
(kapacita, stav) a *Parametry nabídky*. Dole tlačítko **+ Přidat parametr**,
které otevře krátký formulář (název, druh údaje, jednotka, pro který produkt).

### 5.2 Kampaň, nový krok „Zpráva"

Průvodce má dnes čtyři kroky (Založení · Území · Průzkum · Seznam firem);
zpráva je pátý. Obsahuje: výběr šablony, řádek pro každé pole s volbou
režimu, **náhled hotového mailu na skutečné firmě ze seznamu** a výčet
firem, které z kampaně vypadnou i s důvodem.

### 5.3 Šablony (nová obrazovka)

Souvislý text tak, jak ho majitel napsal. Tlačítka: *vložit pole*,
*podmínka pro označenou větu*, *náhled na skutečné firmě*, *pustit do
provozu*. Podmínka se u označené pasáže vybírá z nabídky parametrů.

## 6. Rozdělení na tři dodávky

Majitel schválil obecný editor v plném rozsahu; tohle je pořadí, ne osekání.

| # | Co | Proč zrovna tady |
|---|---|---|
| **1** | parametry nabídky, hodnoty, okno u jídelny, přidávání parametrů | odemyká všechno ostatní — bez cen se nemá pole čím vyplnit; majitel může začít plnit data hned |
| **2** | krok „Zpráva" u kampaně, náhled na skutečné firmě, vyřazení neúplných firem | poprvé je vidět hotový mail na reálných datech |
| **3** | editor šablony: pole, podmínky, koncept a spuštění, verze | nejtěžší část se staví se zkušeností z kroků 1 a 2 |

Každá dodávka má vlastní plán a končí stavem, který jde použít.

## 7. Testy

Nad PGlite, bez sítě, jako zbytek sady:

- parametr druhu `vyber` uloží podmnožinu možností a načte ji zpět;
- hodnota parametru se váže na nabídku, ne na jídelnu — nabídka bez jídelny
  funguje stejně;
- pole v režimu `z_dat` napojené na parametr nabídky se vyplní jeho hodnotou;
- pole v režimu `vynechat` odstraní ze zprávy celou větu, ve které stojí;
- podmíněná pasáž se vypustí, když parametr neodpovídá (jídelna bez
  jídlonosičů → „s možností obědvat na místě");
- **cena: stejné ceny → bez „od"; různé → nejnižší s „od"**;
- firma bez povinného pole se do seznamu k oslovení nedostane a nese důvod;
- firma bez jména se do seznamu dostane a má „Dobrý den,";
- uložení šablony, která neprojde kontrolou stylu, selže a nic nezapíše;
- pole napojené na atribut firmy mimo whitelist selže při uložení (TP-3);
- koncept se neprojeví v tom, co by se odeslalo, dokud se nepustí do provozu.

## 8. Co znamená „hotovo"

Nad rámec obvyklého (`npm test`, `npm run typecheck`, migrace nasazené,
`npm run build --prefix app`):

- obrazovky **proklikané v prohlížeči** na ostrých datech
  (past `zelene-testy-nejsou-hotova-obrazovka`);
- u dodávky 1: majitel doplnil ceny a možnosti výdeje aspoň u jídelen
  v provozu;
- u dodávky 2: náhled ukáže hotový mail na skutečné firmě a čísla vyřazených
  firem sedí s dotazem do databáze;
- odesílání zůstává vypnuté (TP-8) a žádná část tohohle celku ho neumí
  zapnout.

## 9. Rizika

**Přeschematizování.** Nabídky, parametry, hodnoty, pole, nastavení,
podmínky — šest nových tabulek kvůli jednomu mailu. Kdyby se ukázalo, že druhý produkt
nikdy nepřijde, byla by to složitost navíc. Majitel na tohle riziko byl
upozorněn 18. 8. a rozhodl jít do plného rozsahu; důvodem je, že systém
chce prodávat dál.

**Editor je psaní textu, který odejde ven.** Kontrola stylu chytí formu,
ne pravdivost. Nepravdivé tvrzení o službě napsané do šablony projde,
pokud dodrží formu. Proti tomu stojí jen knihovna tvrzení a lidské oko —
proto „pustit do provozu" jako samostatný krok.

**Nabidky vedle jidelny.** Zavedení `nabidky` znamená sáhnout na tabulku,
na které visí dosah, zóna a sběr. Migrace musí být přidání (nová tabulka
plus `nabidka_id`), ne přesun; existující dotazy se nemění.

## 10. Co tahle práce neřeší

- **Odesílání.** Zůstává vypnuté, tenhle celek se ho nedotýká.
- **Poučení podle čl. 14 GDPR** do textu mailu — patří na právní konzultaci
  (S0.8).
- **Skládání zprávy agentem.** Obchodník (fáze 3) bude šablonu používat;
  tady se jen nastavuje a ukazuje náhled.
- **Doplnění chybějících oborů** u 16 firem. Je to práce pro Čmuchala, ne
  pro tenhle celek.
- **Onboardingový dotazník pro nového zákazníka** (paměť
  `onboarding-dotaznik-pro-prodej`) — až po prvním ostrém prodeji.
