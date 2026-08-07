# Cantinero — agentní obchodní systém

Zadání pro implementaci. Verze 2.

Tento dokument je závazný pro implementaci. Kde je uvedeno "tvrdé pravidlo",
jde o kontrolu vynucenou v kódu nebo v databázi, nikoli o instrukci v promptu
agenta. Instrukce v promptu není záruka.

**Změny oproti verzi 1:** území se odvozuje od jídelen, ne od krajů.
Přibyla pravidla pro personalizaci a pro styl psaní. Obchodník přešel z
kampaňového režimu na individuální oslovení bez sekvencí. Přibyl kanál
adresné pošty a agent pro partnerství.

---

## 1. Cíl a rozsah

Postavit systém, který v okolí partnerských školních jídelen vyhledá a
kvalifikuje firmy jako potenciální odběratele obědů, osloví je
individuálně a relevantně, spravuje souhlasy a odhlášení, měří výkon a
průběžně se zlepšuje.

Systém běží nepřetržitě bez denního zásahu člověka, ale nikdy nemění
sám sebe v části, která ovlivňuje obsah nebo objem komunikace navenek.

### Co systém dělá
- Vyhledávání a ověřování firem v dojezdové zóně partnerské jídelny
- Obohacování o velikost, obor, kontaktní osoby, stav stravování
- Skórování a řazení podle vhodnosti
- Individuální oslovení e-mailem nebo adresným dopisem
- Správa souhlasů, odhlášení a partnerských vztahů
- Měření výkonu a návrhy zlepšení
- Týdenní reporting pro majitele

### Co systém nedělá
- Nezakládá firmu, kterou neověřil v ARES
- Nevyplňuje údaj, ke kterému nemá zdroj
- Neposílá sekvence ani opakovaná oslovení
- Nemění šablony, tvrzení o produktu, segmenty ani limity bez schválení

---

## 2. Území se odvozuje od jídelny

Toto je základní princip zacílení a mění celou logiku vyhledávání.

Cantinero neprodává software firmám. Zprostředkovává obědy z konkrétní
jídelny. Nabídka je proto smysluplná pouze pro firmu, jejíž zaměstnanci
se do té jídelny reálně dostanou nebo jim je odtud možné oběd doručit.

**Území = zóna kolem každé aktivní jídelny s volnou kapacitou.**
Nikoli kraj, nikoli okres.

Parametry zóny (konfigurovatelné na jídelnu):
- pěší dosah: do 800 m
- krátký dojezd: do 3 km
- doručení: podle dohody s jídelnou

Firma mimo zónu se do fronty oslovení nedostane, i kdyby měla skóre 100.
Může se uložit jako `cekajici_na_jidelnu` pro případ, že v jejím okolí
později přibude partner.

**Důsledek pro plánování:** kapacita jídelen je strop celého obchodu.
Než postavíte agenty na hledání firem, ověřte, kolik zón vůbec máte a
kolik strávníků do nich pojmete. Je-li zón málo, prioritou je získávání
jídelen, ne firem.

---

## 3. Tvrdá pravidla

Tato pravidla jsou vynucena v kódu. Agent je nemůže obejít, přeformulovat
ani si vyžádat výjimku.

**TP-1 — Existence firmy.** Záznam v `companies` lze vytvořit pouze po
úspěšné validaci IČO proti ARES. IČO je primární klíč. Tím jsou fiktivní
firmy i duplicity vyloučeny na úrovni databáze.

**TP-2 — Zdroj, nebo NULL.** Každý dohledaný atribut má odpovídající
záznam v `evidence` se `zdroj_url`, doslovnou citací a `ziskano_at`. Bez
zdroje zůstává pole NULL. NULL znamená "nevíme", nikdy se nenahrazuje
odhadem.

**TP-3 — Personalizace jen z povolené a ověřené množiny.** Viz kapitola 5.
Renderer smí sáhnout pouze na atributy z whitelistu, a jen tam, kde
existuje evidence. Chybí-li, příslušná pasáž ze zprávy vypadne.

**Pravidlo váže zprávu, ne sběr** (upřesněno 2026-08-06). Co o firmě smíme
zjišťovat, určuje profil produktu — pořád ale jen s doloženým zdrojem (TP-2)
a bez zakázaných kategorií z kap. 5.3. Whitelist tedy říká, co smí ven, ne
co smíme vědět.

**TP-4 — Území.** Odeslat lze pouze firmě, která má vyplněné
`nejblizsi_jidelna_id` a `vzdalenost_m` v rámci nastavené zóny.

**TP-5 — Jedna firma, jedno oslovení.** Na jednu firmu smí odejít jedno
iniciační oslovení. Žádné sekvence, žádné "ještě jednou pro jistotu",
žádné oslovení druhé osoby po nereagování první. Navázat lze pouze po
odpovědi od firmy. Opakované oslovení je možné nejdříve po 12 měsících a
jen po schválení člověkem.

**TP-6 — Priorita adres podle účelu.** Pořadí volby adresáta:
1. adresa nebo formulář zveřejněný pro příjem nabídek (`poptavky@`,
   `nabidky@`, `obchod@`, kontaktní formulář)
2. obecná firemní adresa (`info@`)
3. jmenná adresa konkrétní osoby
Nižší úroveň se použije jen tehdy, není-li vyšší k dispozici. U úrovně 3
je povinná informace podle čl. 14 GDPR přímo ve zprávě.

**TP-7 — Suppression.** E-mail ani doména nesmí být v `suppressions`.
Jakýkoli náznak nezájmu, stížnost, odhlášení nebo tvrdé odmítnutí zapisuje
doménu i adresu natrvalo.

**TP-8 — Limity a kill switch.** Odesílá se jen při
`system_state.sending_enabled = true` a v rámci denního limitu. Statistik
i Ředitel mohou vypnout. Zpět zapnout může pouze člověk.

**TP-9 — Knihovna tvrzení.** Agenti smí o produktu tvrdit pouze to, co je
v tabulce `claims` ve stavu `schvaleno`. Smí to přeformulovat, nesmí
přidat nové tvrzení. Nové tvrzení jde do `proposals`.

**TP-10 — Reálný podpis.** Každá odchozí zpráva je podepsaná skutečnou
osobou, která existuje, je uvedená na webu a odpovědi skutečně čte.
Systém nesmí vymyslet jméno obchodníka. Odpověď musí do 24 hodin dorazit
k člověku, ne jen do fronty agenta.

**TP-11 — Povinné náležitosti.** Zřetelné označení obchodního sdělení,
identifikace odesílatele včetně sídla a IČO, funkční možnost odmítnout
další komunikaci, hlavička List-Unsubscribe.

**TP-12 — Bez sledovacích pixelů.** První oslovení neobsahuje sledovací
pixel ani přesměrovávané odkazy. Řídicí metrikou je odpověď, ne otevření.
Sledování se zapíná až v komunikaci po udělení souhlasu.

**TP-13 — Auditovatelnost.** Každý běh agenta se zapisuje do `agent_runs`.
Každá odchozí zpráva má uložený finální text tak, jak odešel.

---

## 4. Prahové hodnoty pro automatické zastavení

Překročení kteréhokoli prahu okamžitě nastaví `sending_enabled = false`,
založí záznam v `incidents` a upozorní majitele.

| Metrika | Práh | Okno |
|---|---|---|
| Stížnost na spam od příjemce | 1 kus | kdykoli |
| Odpověď s právní výhradou nebo odkazem na ÚOOÚ | 1 kus | kdykoli |
| Podíl negativních odpovědí | 5 % | posledních 100 zpráv |
| Tvrdé odmítnutí (hard bounce) | 3 % | posledních 200 zpráv |
| Odhlášení | 1,5 % | posledních 500 zpráv |
| Neúspěšné běhy agenta | 3 za sebou | kdykoli |
| Odeslání mimo zónu nebo bez evidence | 1 kus | kdykoli |

Po zastavení: Ředitel vypracuje review, navrhne nápravná opatření, provede
jejich vlastní kontrolu a předloží majiteli ke schválení. Teprve po
schválení lze obnovit odesílání.

---

## 5. Znalost o firmě a personalizace

> Rozděleno na dvě vrstvy rozhodnutím majitele 2026-08-06 (viz
> `docs/adr/0002-dve-vrstvy-a-nastavitelnost.md`). Dřív byla kapitola jedna
> a whitelist omezoval sběr i zprávu naráz.

**Cílem je relevance, ne demonstrace toho, kolik jsme toho zjistili.
Přehnaná personalizace působí jako sledování a snižuje odezvu.** Tahle věta
platí beze změny — ale platí o **zprávě**, ne o tom, co smíme vědět.

| Vrstva | Co to je | Jak široká |
|---|---|---|
| **A — znalost o firmě** | podklad pro obchod, schůzku, nabídku | široká, nastavitelná profilem produktu |
| **B — obsah oslovení** | co firmě napíšeme | úzká, drží whitelist a test pohlednice |

**Vrstva B smí čerpat jen z whitelistu níž, ne z celé vrstvy A.**
Sběr se rozšiřuje, zpráva ne.

### 5.1 Vrstva A — co smíme o firmě zjišťovat

Rozsah určuje **profil produktu**, ne pevný seznam v této kapitole — jiná
cílovka potřebuje jiné údaje. Bez ohledu na profil ale platí:

- **Každý údaj má `zdroj_url` a doslovnou citaci** (TP-2). Bez zdroje se
  nezapíše. Žádné odhady, žádné dopočty.
- **Sociální sítě nikdy**, ani ke čtení.
- **Nikoho neoslovujeme** kvůli zjištění údaje.
- Zakázané kategorie z 5.3 platí i pro sběr, s jednou výjimkou popsanou tam.

### 5.2 Vrstva B — co smí do zprávy

Whitelist atributů (`src/whitelist.ts`). Renderer smí sáhnout jen sem, a jen
tam, kde existuje evidence. Chybí-li, pasáž ze zprávy vypadne.

#### Povolené atributy

| Atribut | Zdroj | Poznámka |
|---|---|---|
| název firmy | ARES | vždy |
| obec / část města | ARES | vždy |
| obor podnikání | CZ-NACE | obecně, ne detailně |
| přibližná velikost | ARES / závěrka | kategorie, ne přesné číslo |
| název a adresa jídelny | vlastní data | jádro nabídky |
| vzdálenost k jídelně | výpočet | v metrech nebo minutách chůze |
| způsob stravování | web firmy | jen s doslovnou citací zdroje |
| jméno a pozice adresáta | veřejný zdroj | max jednou ve zprávě |

#### Zakázané atributy

Ve zprávě nikdy:

- cokoli ze soukromých profilů na sociálních sítích
- jména jiných zaměstnanců než adresáta
- finanční údaje z účetní závěrky prezentované jako znalost o firmě
- odkazy na inzeráty, recenze nebo hodnocení firmy
- jakýkoli údaj bez záznamu v `evidence`
- odhad či dopočet čehokoli

### 5.3 Které z těch zákazů platí i pro sběr

Všechny **kromě pracovních inzerátů**. Ty se číst smějí — jsou to veřejná
data, u kterých zaměstnavatel sám zveřejnil, jak to u něj chodí, a jsou
nejlepším zdrojem informací o směnném provozu a benefitech. Systém je ostatně
už dnes čte z otevřených dat úřadu práce.

**Do zprávy se ale nedostanou nikdy** — ani obsahem, ani narážkou. To, že
před třemi týdny inzerovali pozici účetní, je přesně ten typ znalosti, který
adresáta znepokojí. Tenhle rozdíl je celý smysl rozdělení na dvě vrstvy.

Sociální sítě zůstávají zakázané v obou vrstvách.

### Test pohlednice

Před použitím atributu si položte otázku: kdyby adresát viděl přesně,
odkud jsme každý údaj vzali, působilo by to přirozeně, nebo nepříjemně?
Vzdálenost k jídelně je v pořádku. To, že před třemi týdny inzerovali
pozici účetní, není.

### Struktura relevance

Zpráva má stát na jednom konkrétním, ověřitelném a pro adresáta užitečném
faktu, ne na výčtu personalizačních polí. Nosná věta má tvar:

> Vaše sídlo v [obec] je [vzdálenost] od jídelny [název], která má volnou
> kapacitu pro [počet] obědů denně.

Vše ostatní je doplněk. Nemáme-li tuhle větu ověřenou, oslovení se
neodesílá.

---

## 6. Styl psaní

Cílem je, aby zpráva vypadala jako e-mail od člověka, který si dal práci.
To znamená dobrou práci s jazykem, nikoli zastírání odesílatele —
identifikace odesílatele je povinná podle TP-11 a nesmí být oslabena.

### Pravidla

- Maximálně 120 slov v prvním oslovení.
- Předmět konkrétní a věcný, běžnou větou, bez superlativů a otazníkového
  clickbaitu. Dobře: `obědy ze ZŠ Komenského pro vaše zaměstnance`.
  Špatně: `Revoluce ve firemním stravování?!`
- Žádné odrážky s benefity v prvním oslovení.
- Jedna otázka na konci, konkrétní a s nízkým prahem. Ne "měl byste zájem
  o schůzku", ale "má u vás smysl to zkusit, nebo obědy řešíte jinak?"
- Jméno adresáta nejvýše jednou.
- Bez obrázků, bez HTML šablony, bez loga v těle. Prostý text.
- Podpis reálné osoby, telefon, název firmy, IČO, sídlo.

### Zakázané fráze

`V dnešní uspěchané době`, `Dovolte mi představit`, `Rád bych Vás oslovil
s`, `Věřím, že by Vás mohlo zaujmout`, `nezávazně`, `řešení na míru`,
`inovativní`, `komplexní řešení`, `win-win`, `synergie`, `posouváme
hranice`, `nechte mě vědět`, `Doufám, že se máte dobře`.

### Zakázané postupy

- Předstírat předchozí kontakt nebo doporučení, které neexistuje.
- Vymyšlený kompliment firmě ("sleduji dlouhodobě vaši práci").
- Falešná naléhavost, časově omezené nabídky, umělá exkluzivita.
- Stejný skelet u všech zpráv. Délka i stavba se musí lišit — generátor
  drží tři až pět odlišných struktur na segment a střídá je.
- Nadužívání pomlček, trojic a souvětí se stejným rytmem.

### Kontrola před odesláním

Automatická kontrola odmítne zprávu, která obsahuje zakázanou frázi,
překračuje délku, obsahuje pole bez evidence, nebo se shoduje s jinou
odeslanou zprávou na více než 70 % textu.

---

## 7. Kanály

| Kanál | Právní režim | Použití |
|---|---|---|
| E-mail bez souhlasu | zákon 480/2004, riziko roste s objemem a stížnostmi | individuální oslovení, tvrdé limity, bez sekvencí |
| E-mail se souhlasem | čistý | veškerá další komunikace, novinky o produktu |
| Adresný dopis | zákon o regulaci reklamy, souhlas se nevyžaduje | plnohodnotný kanál, u menších firem často účinnější |
| Partnerství | mimo režim obchodních sdělení | obce, zřizovatelé, komory, HR platformy |
| Inbound | generuje souhlas | landing page, obsah, cílená reklama |
| Telefon | § 96 zákona o el. komunikacích, přísnější než e-mail | až po předchozím kontaktu, nikdy jako první krok |

Novinky o produktu, aktualizace a jakoukoli opakovanou komunikaci lze
posílat pouze na kontakty se souhlasem. Budování souhlasového seznamu je
proto dlouhodobě nejdůležitější aktivita celého systému.

---

## 8. Datový model

Postgres (Supabase). Zjednodušený nástin, ne finální DDL.

```
companies
  ico                text primary key
  nazev              text not null
  adresa, obec, okres, kraj, psc
  lat, lng           numeric
  cz_nace            text[]
  velikost_kategorie text
  zamestnanci_odhad  int            -- NULL dokud není zdroj
  ma_vlastni_jidelnu boolean        -- NULL = nevíme
  nejblizsi_jidelna_id uuid
  vzdalenost_m       int
  v_zone             boolean
  skore              int
  stav               text  -- novy|kvalifikovany|cekajici_na_jidelnu|
                           -- zamitnuty|osloveny|jednani|zakaznik
  osloveno_at        timestamptz
  created_at, updated_at

contacts
  id uuid pk, ico text
  jmeno, prijmeni, pozice
  email, uroven_adresy int  -- 1=poptavkova, 2=obecna, 3=jmenna
  telefon, linkedin_url
  zdroj_url text not null, ziskano_at, overeno boolean
  gdpr_info_odeslano_at

evidence
  id uuid pk, ico, contact_id
  atribut, hodnota
  zdroj_url text not null
  citace text            -- doslovný úryvek, max 200 znaků
  ziskano_at, confidence

jidelny
  id, nazev, adresa, lat, lng
  kapacita_volna int, zona_metru int
  smlouva_od date, aktivni boolean

consents      id, email, typ, ziskano_at, dukaz jsonb, platnost_do
suppressions  email_nebo_domena pk, duvod, vlozeno_at
claims        id, tvrzeni, doklad, stav, schvaleno_at
templates     id, verze, segment, kanal, predmet, telo, struktura_id,
              stav, schvaleno_kym, schvaleno_at
messages      id, contact_id, template_id, kanal, finalni_text,
              odeslano_at, provider_id, stav
events        id, message_id, typ, at, raw jsonb
partneri      id, typ, nazev, obec, kontakt, stav, posledni_kontakt_at
agent_runs    id, agent, zacatek, konec, vstup, vystup, naklady_usd, chyby
proposals     id, agent, typ, popis, oduvodneni, data jsonb, stav,
              rozhodl, rozhodnuto_at
incidents     id, typ, zavaznost, popis, detekovano_at, stav, opatreni
system_state  sending_enabled, denni_limit, zmeneno_kym, zmeneno_at
```

---

## 9. Zdroje dat

Prioritně, od nejspolehlivějšího:

1. **ARES** (`ares.gov.cz`) — REST API, zdarma. Autoritativní. Povinný
   validační krok pro každou firmu.
2. **Obchodní rejstřík a sbírka listin** (`justice.cz`) — účetní závěrky,
   z nich reálný počet zaměstnanců. Statutární orgány.
3. **Web firmy** — kariérní stránka, sekce benefitů, kontaktní stránka.
   Nejlepší zdroj pro otázku stravování i pro určení účelu zveřejněné
   e-mailové adresy.
4. **Pracovní inzeráty** — často explicitně uvádějí formu příspěvku na
   stravování. Použitelné jako zdroj údaje, ale nikdy jako obsah zprávy.
5. **Mapové podklady** — ověření adresy, výpočet vzdálenosti k jídelně.

Pravidla:
- Respektuj `robots.txt` a podmínky užití. Scraping LinkedInu je proti
  jeho podmínkám — kontakty odtud pouze ručně.
- Rozumné tempo dotazů, žádné zahlcování cizích serverů.
- Sbírej jen to, co určuje profil produktu (kap. 5.1, vrstva A). Nic navíc.
  Whitelist z kap. 5.2 váže obsah zprávy, ne sběr. Zákazy z kap. 5.3 platí
  i pro sběr.

---

## 10. Agenti

### 10.1 Čmuchal — vyhledávání a kvalifikace

**Vstup:** aktivní jídelna s volnou kapacitou a její zóna.

**Výstup:** záznamy v `companies`, `contacts`, `evidence`.

**Postup:**
1. Vyjmenuj firmy se sídlem nebo provozovnou uvnitř zóny.
2. Každou ověř v ARES. Bez shody zahoď.
3. Spočítej vzdálenost a dobu chůze k jídelně.
4. Obohať o velikost a obor.
5. Zjisti stav stravování. Bez doslovné citace nech NULL.
6. Najdi kontaktní kanál. Urči jeho úroveň podle TP-6 — hledej explicitní
   účel u zveřejněné adresy a zapiš ho do evidence.
7. Najdi až 2 kontaktní osoby. Priorita: HR nebo people ops, office
   management, provozní ředitel, u malých firem jednatel.
8. Zapiš skóre.

**Skóre** kombinuje: vzdálenost k jídelně, velikost firmy, absenci vlastní
jídelny, obor s převahou kancelářské práce, dostupnost poptávkové adresy.

**Smí:** volně volit vyhledávací strategie, číst veřejné zdroje, zapisovat
do `companies`, `contacts`, `evidence`, upravovat vlastní playbook.

**Nesmí:** zapsat firmu bez ARES nebo mimo zónu, vyplnit atribut bez
zdroje, sbírat atributy mimo profil produktu (kap. 5.1), odesílat cokoli.

**Sebezlepšování:** vede `playbook-cmuchal.md` — které dotazy a zdroje
vedly k ověřenému nálezu a s jakou úspěšností. Playbook mění sám, protože
neovlivňuje nic navenek. Měřítka: podíl firem s ověřeným stavem
stravování, podíl kontaktů úrovně 1, počet ověřených kontaktů na firmu.

### 10.2 Obchodník — individuální oslovení

**Vstup:** firmy ve stavu `kvalifikovany`, seřazené podle skóre.

**Výstup:** zprávy, záznamy do `messages`, aktualizace stavu firmy.

**Režim:** individuální oslovení, ne kampaň. Denní limit začíná na 10 a
zvyšuje se pouze schválením člověka. Jedna firma, jedno oslovení (TP-5).

**Segmentace podle velikosti:**
- mikropodnik (do 25) — krátce, cena, jednoduchost, žádná administrativa
- střední (25–250) — benefit pro zaměstnance, návaznost na příspěvek na
  stravování, pilot na malé skupině
- korporát (nad 250) — proces, kapacita, reference, compliance

**Volba kanálu:** má-li firma kontakt úrovně 1, e-mail. Má-li jen úroveň 3
a jde o firmu s vysokým skóre, upřednostni adresný dopis.

**Smí:** vybírat příjemce z fronty, volit schválenou šablonu a strukturu,
personalizovat z ověřených polí, odpovídat na dotazy z knihovny tvrzení,
zapisovat do dokumentace.

**Nesmí:** psát mimo schválené šablony a struktury, přidávat tvrzení mimo
`claims`, překročit limit, oslovit firmu podruhé, oslovit druhou osobu ve
firmě, která nereagovala, slibovat cenu, termín nebo podmínky.

**Eskalace na člověka do 24 hodin:** dotaz na cenu nad rámec ceníku,
právní dotaz, stížnost, negativní tón, zmínka o GDPR nebo o ÚOOÚ,
jakákoli žádost o smlouvu, zájem o schůzku.

### 10.3 Spojka — partnerství

**Účel:** budovat kanály, které obcházejí problém se studeným oslovením a
zároveň přinášejí důvěryhodnost.

**Cíle:** zřizovatelé jídelen (nejčastěji obce), obecní zpravodaje a
weby, hospodářská komora a místní podnikatelské kluby, poskytovatelé HR a
benefitních systémů, správci business parků a coworků.

**Výstup:** záznamy v `partneri`, návrhy konkrétních oslovení, podklady
pro obecní zpravodaj, materiály pro podnikatelské setkání.

**Smí:** rešeršovat, připravovat podklady, navrhovat oslovení.

**Nesmí:** odesílat cokoli bez schválení. Partnerská komunikace je
vztahová a jde vždy přes člověka.

**Poznámka:** u produktu tohoto typu je pravděpodobné, že tento kanál
přinese víc zákazníků než e-mail. Neodkládejte ho na později.

### 10.4 Statistik — měření

**Vstup:** `events`, `messages`, `companies`.

**Výstup:** denní a týdenní přehled, upozornění na odchylky, incidenty.

**Řídicí metriky:** podíl odpovědí, podíl kladných odpovědí, sjednané
schůzky, uzavřené firmy, náklad na sjednanou schůzku. Segmentově, podle
kanálu, podle struktury zprávy a podle jídelny.

**Nesleduje otevření** — první oslovení podle TP-12 pixel neobsahuje a
míra otevření je u zbytku systematicky zkreslená ochranou soukromí v
poštovních klientech.

**Smí:** číst vše, psát analýzy, zakládat incidenty, vypnout odesílání.

**Nesmí:** měnit šablony, segmenty ani limity.

### 10.5 Marketér — optimalizace

**Vstup:** analýzy od Statistika, aktuální šablony a struktury.

**Výstup:** návrhy v `proposals`.

**Smí:** navrhovat varianty šablon a nové větné struktury, navrhovat testy
v rámci schválených tvrzení, rešeršovat, vyhodnocovat.

**Nesmí:** nasadit variantu do produkce.

**Automatické povýšení** je možné, pokud varianta zvítězila při minimálně
150 odeslaných zprávách na rameno, nezavádí nové tvrzení, nový segment ani
nový kanál, a prošla kontrolou stylu podle kapitoly 6. Vše ostatní čeká na
schválení.

### 10.6 Obchodní ředitel — dohled

**Vstup:** vše.

**Výstup:** týdenní hlášení pro majitele, návrhy, incidenty.

**Týdenní hlášení:** čísla proti minulému týdnu, co fungovalo a co ne, tři
nejzajímavější příležitosti, otevřené návrhy ke schválení, rizika, náklady
na provoz, stav kapacity jídelen proti počtu kvalifikovaných firem.

**Smí:** hodnotit práci ostatních agentů, navrhovat nové agenty a postupy,
zastavit odesílání, kontrolovat korektnost komunikace.

**Nesmí:** vytvořit a spustit nového agenta bez schválení. Návrh nového
agenta musí obsahovat účel, vstupy, výstupy, oprávnění, zákazy a způsob
měření. Nesmí měnit tvrdá pravidla ani prahové hodnoty.

**Kontrola korektnosti:** týdně namátkově zkontroluje 20 odeslaných zpráv
proti knihovně tvrzení, whitelistu personalizace a pravidlům stylu.
Každou odchylku označí jako incident.

---

## 11. Rozhraní pro člověka

Šest obrazovek odpovídajících rolím, aby bylo možné vstoupit do kterékoli
pozice:

1. **Území** — mapa jídelen se zónami, firmy uvnitř, skóre, kapacita.
2. **Fronta** — kdo bude osloven, jakým kanálem, plný náhled finálního
   textu před odesláním.
3. **Partnerství** — obce, komory, stav vztahů, úkoly.
4. **Výkon** — metriky, srovnání struktur, segmentů a jídelen.
5. **Návrhy** — fronta ke schválení, tlačítko schválit a zamítnout.
6. **Incidenty** — co se zastavilo a proč, průběh review.

Vždy viditelný stav odesílání a tlačítko nouzového vypnutí.

---

## 12. Fáze nasazení

**Fáze 0 — příprava.** Právní konzultace k povoleným kanálům a k
oprávněnému zájmu. Zmapování jídelen a jejich zón. Knihovna tvrzení, tři
šablony a tři až pět větných struktur na segment. Odesílací doména, SPF,
DKIM, DMARC, zahřívání. Určení osoby, která bude pod zprávami podepsaná a
bude číst odpovědi.

**Fáze 1 — Čmuchal.** Jen sběr, žádné odesílání. Cíl: 200 ověřených firem
v zónách se zdroji u každého údaje. Ruční kontrola vzorku 30 firem.
Metriky: podíl polí se zdrojem, podíl chybných záznamů, podíl kontaktů
úrovně 1.

**Fáze 2 — Spojka a inbound.** Oslovení zřizovatelů, landing page,
formulář, obsah. Cíl: první partnerství a prvních 100 souhlasů.

**Fáze 3 — Obchodník.** 10 zpráv denně. Prvních 50 schvaluje člověk před
odesláním. Paralelně první série adresných dopisů.

**Fáze 4 — Statistik a Marketér.** Měření, testy struktur.

**Fáze 5 — Ředitel.** Týdenní review, dohled, hlášení.

Postup do další fáze až po vyhodnocení předchozí. Nepřeskakovat.

---

## 13. Právní kontext a míra rizika

Shrnutí pro implementaci, ne právní stanovisko.

Rozesílání obchodních sdělení elektronickými prostředky bez předchozího
souhlasu je přestupkem, pokud probíhá **hromadně nebo opakovaně**. Tyto
pojmy se vykládají s ohledem na společenskou škodlivost jednání a
hromadnost se posuzuje mimo jiné podle počtu stížností vůči jednomu
subjektu. Riziko tedy neroste skokově, ale s objemem, opakováním a
především s nespokojeností příjemců.

Zveřejnění kontaktu firmou samo o sobě souhlas nenahrazuje. Podle
společného výkladového stanoviska ČTÚ, ÚOOÚ a MPO je však u kontaktu
zveřejněného samotným subjektem potřeba posuzovat, k jakému účelu slouží.
To je důvod pro pravidlo TP-6. Zároveň platí, že výkladová stanoviska
nejsou závazná a regulátor podle nich vždy nepostupuje — na tomto
argumentu proto nelze stavět celý obchodní model.

Sankce dosahují u právnických osob až 10 000 000 Kč. Odpovědnost je
objektivní a dopadá i na toho, kdo rozesílání zprostředkuje. Skutečnost,
že zprávy generoval automatizovaný systém, není polehčující okolnost.

Celá architektura tohoto systému — limity, zákaz sekvencí, priorita
poptávkových adres, okamžitá suppression, absence sledování a důraz na
relevanci — je navržena tak, aby se držela na nízkém konci rizikového
spektra. Není to totéž jako záruka souladu s právem.

**Před fází 3 je nutná konzultace s advokátem** se specializací na
e-privacy a ochranu osobních údajů. Chcete-li systém později nabízet
dalším firmám, konzultujte to dřív, než napíšete první prodejní stránku:
správa souhlasů pak musí být nevypnutelnou součástí produktu.
