# Fáze 0 — přípravná: orchestrace

Návrh celé přípravné fáze projektu Cantinero. Spojuje dvě věci, které SPEC
i realita vyžadují **před** ostrým během čehokoli:

- **A. Pracovní prostředí** (co chybělo: CLAUDE.md, agenti, skilly, paměť,
  oprávnění) — aby se na projektu dalo systematicky a bezpečně pracovat.
- **B. Obchodní a infrastrukturní příprava dle SPEC kap. 12, fáze 0**
  (jídelny a zóny, knihovna tvrzení, šablony, odesílací doména, podepsaná
  osoba, právní konzultace).

Stav k **17. 8. 2026**: fáze 0 běží, fáze 1 je hotová (běžela vědomě napřed).
Stavy jednotlivých sessions jsou u nich; přehled ověřený proti datům je
v `docs/vizualizace/plan-fazi-a-sessions-2026-08-17.html`.

> **Tenhle dokument je zdroj pravdy o postupu.** Když se něco naplánuje
> v hovoru a nezapíše se sem, přestane to existovat — přesně to se stalo
> re-designu (dnes S0.11) i celé aplikaci, která v původním rozpisu nebyla.

---

## 1. Inventura — co už máme a co s tím

Vše z předchozí práce zůstává použitelné **bez ohledu na volbu technologie**:

| Co | Kde | Hodnota nezávislá na technologii |
|---|---|---|
| Zadání v2 | `SPEC.md` | Zdroj pravdy; nemění se |
| DB schéma + tvrdá pravidla v DB | `supabase/migrations/0001_init.sql` | Čistý Postgres — funguje v Supabase, Neonu, vlastním PG |
| Tvrdá pravidla jako testy | `test/*.test.ts` (52 testů) | Vykonatelná dokumentace TP-1/2/3/6/8/13 |
| Deterministická logika | `src/` (IČO, ARES, geo, zóny, skóre) | Přenositelné knihovní funkce |
| Enrichment návrh | `src/enrich.ts` | Prompt + validace přenositelné do libovolného harnessu |
| Plán fáze 1 | `docs/superpowers/plans/…` | Referenční, po fázi 0 se reviduje |
| Playbook Čmuchala | `playbook-cmuchal.md` | Kostra sebezlepšování |

**Důsledek:** volba technologie (kap. 3) mění hlavně *kdo drží smyčku agenta*
(orchestraci), ne datový model ani pravidla. To nejcennější je hotové.

---

## 2. Struktura fáze 0 — tři pracovní proudy

```
Proud A — Prostředí        Proud B — Obchodní příprava     Proud C — Infrastruktura
(bez blokací, hned)        (potřebuje tvoje vstupy)        (potřebuje rozhodnutí)
─────────────────────      ──────────────────────────      ────────────────────────
S0.1 Workspace ✅          S0.4 Jídelny a zóny ✅          S0.2 Architektura (ADR) ~
S0.3 Agenti + skilly ~     S0.5 Tvrzení + šablony ❌       S0.6 DB projekt ✅
                           S0.7 E-mail + podpis ❌         S0.8 Právní podklady ~

Proud D — Aplikace (vznikl za pochodu, v původním rozpisu nebyl)
────────────────────────────────────────────────────────────────
9 odpracovaných celků se zadáním a plánem v docs/superpowers/
S0.11 Vzhled aplikace — naplánováno 17. 8., spouští se na signál (viz níže)
```

Pořadí: **S0.1 → S0.2** jsou první (S0.1 nic neblokuje, S0.2 blokuje S0.3
a S0.6). Proud B může běžet paralelně, jakmile dodáš vstupy. Fáze 0 končí
kontrolní session S0.9 (go/no-go do fáze 1).

**Proud D není v původním plánu schválně — vznikl z potřeby.** Rozpis počítal
s tím, že se všechno ovládá příkazovou řádkou. Jakmile se ukázalo, že majitel
musí vidět a rozhodovat (které firmy, které území, jaká kapacita), vznikla
webová aplikace: dnes 6 obrazovek, 24 souborů, ~7 100 řádků. Je to největší
kus odvedené práce a v rozpisu chyběl celý.

---

## 3. S0.2 — Rozhodnutí o technologii

> **Částečně rozhodnuto 2026-07-26 (majitel):** provoz na **předplatném
> Claude Max 5×**, ne na API tokenech. Cílový objem 20–50 firem denně.
> API se řeší až u případného externího klienta. Databáze **lokálně**, žádný
> cloud. → Vybrána varianta **V2 s kódovým jádrem** (viz níže). Zbývá sepsat
> ADR a doladit, jak přesně se běhy spouštějí (konverzačně vs. naplánovaně).

**Co to prakticky znamená:** Cantinero *není* samostatná aplikace, která běží
sama a spotřebovává tokeny. Je to **sada nástrojů + agent**:

- **Nástroje = kód** (hotový, zdarma, deterministický): ověření firmy v ARES,
  geokódování, výpočet zóny a vzdálenosti, bodování, zápis do kartotéky
  s vynucenými pojistkami, přehledy a metriky.
- **Agent = Claude Code** na tvém předplatném: rozhoduje, co hledat, dohledává
  na webu to, co nástroje neumí (stravování, kontakty, účel adresy), a výsledky
  cpe do kartotéky přes tytéž pojistky.
- **Data = lokální Postgres** v adresáři `data/` na tvém stroji.

Mezní náklad jednoho běhu je tím pádem **nula** — platíš jen předplatné,
které už máš.

Tři realistické varianty „kdo pohání agenty":

**V1 — Stávající stack: TypeScript pipeline + Claude API + Supabase.**
Agenti = kód s LLM kroky (jak je postavený Čmuchal). Běhy přes plánovač
(GitHub Actions cron / Windows Task Scheduler / Supabase edge cron).
- ✅ Deterministické, levné, plně testovatelné, tvrdá pravidla vynucená v kódu.
- ❌ Každou novou schopnost agenta programuješ; „sebezlepšování" je omezené.

**V2 — Claude Code jako harness.** Agenti = `.claude/agents/*.md`
(subagenti Čmuchal…Ředitel), skilly = pracovní postupy, paměť = `memory/`,
běhy interaktivně nebo přes scheduled routines. Kód z V1 slouží jako nástroje
(CLI), které agenti volají.
- ✅ Nejrychlejší iterace, přirozené „agenti + skilly + paměť", vidíš jim pod ruce.
- ❌ Hůř se garantuje nepřetržitý bezobslužný provoz; disciplínu drží skilly, ne kód.

**V3 — Claude Managed Agents (CMA).** Hostovaný agentní loop od Anthropicu:
persistentní agenti, sessions, scheduled deployments (cron), vaults na
credentials. Nejblíž vizi „běží nepřetržitě bez denního zásahu".
- ✅ Infrastrukturu (smyčku, sandbox, plánování) drží Anthropic; auditní stopa sessions.
- ❌ Beta, vyšší cena, tvrdá pravidla musí zůstat v DB/nástrojích (to máme).

**Zvoleno: V2 s kódovým jádrem (hybrid V1+V2).** Jádro (DB, pravidla, ARES,
geo, skóre) zůstává kód — to je neprůstřelnost, kterou SPEC vyžaduje
(„kontrola vynucená v kódu, nikoli v promptu"). Nad ním Claude Code
s definovanými agenty a skilly. V3 (nebo V1 s API) se vrací na stůl teprve
tehdy, až bude potřeba nepřetržitý bezobslužný provoz — tedy fáze 3+ nebo
externí klient. Rozhodnutí se zapíše jako ADR do `docs/adr/0001-technologie.md`.

**Co zbývá dořešit v S0.2:** (a) limity předplatného pro dávkové běhy 20–50
firem denně — ověřit prakticky na prvním běhu; (b) jestli běhy spouštíš
konverzačně, nebo je chceš naplánované; (c) jak přepsat `src/enrich.ts`
z API cesty na nástroj pro agenta (zůstane jako varianta pro klienta).

---

## 4. Sessions fáze 0

Každá session = jedno samostatné zadání pro Claude Code (můžeš ho zkopírovat
jako první prompt). U každé je uvedeno, co budu potřebovat od tebe.

### S0.1 — Workspace: CLAUDE.md, paměť, oprávnění *(může běžet hned)*
**Cíl:** projekt má vlastní `CLAUDE.md` (pravidla práce, tvrdá pravidla v TL;DR,
konvence), strukturu projektové paměti `memory/` v gitu (týmové znalosti — ne
vault), `.claude/settings.json` s allowlistem bezpečných příkazů (`npm test`,
`npm run cli -- stav|metriky`…) a `.env.example` aktuální.
**Od tebe:** revize draftu CLAUDE.md (první verze je připravena, viz níže).
**Výstup:** commitnutý workspace základ.

### S0.2 — Architektura a technologie (ADR) *(rozhodovací, krátká)*
**Cíl:** projít kap. 3 tohoto dokumentu, rozhodnout V1/V2/V3 (nebo jinou
technologii, pokud máš na mysli konkrétní), zapsat ADR s důsledky pro fáze 1–5.
**Od tebe:** rozhodnutí (mám doporučení hybrid V1+V2).
**Výstup:** `docs/adr/0001-technologie.md`.

### S0.3 — Agenti a skilly *(po S0.2)*
**Cíl:** definice šesti rolí ze SPEC kap. 10 jako `.claude/agents/`
(Čmuchal, Obchodník, Spojka, Statistik, Marketér, Ředitel) — každý s popisem
smí/nesmí, povolenými nástroji a eskalacemi; aktivní bude zprvu jen Čmuchal.
Skilly do `.claude/skills/`: `overeni-firmy` (ARES+evidence postup),
`kontrola-kvality` (ruční kontrola vzorku 30 firem dle fáze 1),
`tydenni-report` (kostra pro Ředitele, aktivace až fáze 5).
**Od tebe:** nic, jen review.
**Výstup:** commitnuté definice agentů a skillů.

### S0.3c — Čmuchal v2: obrácené hledání *(zásadní, nahrazuje dosavadní postup)*

**Problém zjištěný prvním ostrým během:** hledání „firmy podle obce sídla"
najde skořápky a živnostníky, a mine skutečné zaměstnavatele. V Bezdružicích
nenašlo zinkovnu (její firma sídlí jinde), zato našlo 40 subjektů, z nichž
většina nemá jediného zaměstnance.

**Řešení — obrátit pořadí.** Dnes: *rejstřík → firmy → kde jsou*.
Nově: *místo → kdo tam pracuje → kdo to právně je*.

1. **Najdi pracoviště v zóně** (fyzická místa, kde někdo pracuje):
   OpenStreetMap/Overpass (kanceláře, průmysl, hotely, obchody, školy,
   ordinace), web a mapy, stránky obce, pracovní inzeráty s místem výkonu.
2. **Přiřaď právní subjekt** — název pracoviště → ARES → IČO.
   TP-1 zůstává v platnosti: firma vzniká pořád jen po ověření v ARES.
3. **Filtruj podle zaměstnanců** — sub-registr RES vrací
   `kategoriePoctuPracovniku`; kód `000` (bez zaměstnanců) = zahodit.
   Tím padá problém s OSVČ i se schránkami.
4. **Boduj podle pracoviště**, ne podle sídla — obědy se jedí tam, kde se
   pracuje.

**Ponechat** i dosavadní sweep podle obce jako druhotný zdroj, ale s tvrdou
podmínkou „má aspoň jednoho zaměstnance".

**Otevřená otázka pro majitele:** Google Places / Firmy.cz jsou kvalitní, ale
placené nebo s omezením podmínek užití. Návrh: zůstat u bezplatných a legálních
zdrojů (OSM + ARES + weby firem), a placené zvážit až podle výsledků.

### S0.3b — Oprava: ARES limit 1 000 výsledků *(nutné před během na Plzni)*
**Cíl:** `najdiFirmyVObci` spadne na obcích nad 1 000 subjektů — Plzeň jich má
49 831. Navrhnout a implementovat zúžení dotazu (městská část / CZ-NACE /
ulice), aby každý dílčí dotaz zůstal pod limitem, a doplnit test.
**Poznámka:** malé obce (Bezdružice 212, Hrádek 450, Zbůch 556, Tlučná 745)
projdou bez úprav — proto se dá začít Bezdružicemi hned.

### S0.4 — Jídelny a zóny *(potřebuje tvoje data; blokuje smysluplnost celé fáze 1)*
**Cíl:** zmapovat partnerské jídelny: název, adresa, souřadnice, kód obce,
volná kapacita, zóna, stav smlouvy → nasypat do `jidelny` (seed skript už je).
Spočítat **strop obchodu** (suma kapacit) — SPEC: je-li zón málo, prioritou je
získávání jídelen, ne firem.
**Od tebe:** seznam jídelen (klidně hrubý — adresy a odhad kapacit dohledám/doplním).
**Výstup:** naplněná tabulka jídelen + přehled kapacity.

### S0.5 — Knihovna tvrzení a šablony *(potřebuje tvoje znalosti produktu)*
**Cíl:** naplnit `claims` (co smíme o produktu tvrdit, s doklady — schvaluješ
ty), 3 šablony a 3–5 větných struktur na segment (mikro/střední/korporát)
podle stylu kap. 6, včetně automatické kontroly zakázaných frází (tu napíšu
jako kód + test).
**Od tebe:** fakta o produktu/službě (ceny ne — ty se neslibují), schválení tvrzení.
**Výstup:** schválená knihovna tvrzení, šablony ve stavu `navrzeno`→`schvaleno`.

### S0.6 — Prostředí a databáze *(z velké části hotovo 2026-07-26)*
**Cíl:** funkční lokální prostředí bez cloudu a bez nákladů.
**Hotovo:** lokální Postgres v `data/pgdata` (PGlite), idempotentní migrace,
`data/` mimo git, `npm run cli -- migrate|stav` ověřeno. **Stávající Supabase
projekty zůstávají nedotčené — nic se nepozastavuje.**
**Zbývá:** přepnout enrichment z API na nástroj pro agenta (viz S0.2),
pak dry-run Čmuchala na 5 firmách.
**Od tebe:** nic. Cloud (Supabase/Neon) se řeší až kdyby data měla být
sdílená mezi více lidmi nebo stroji — dnes to není potřeba.

### S0.7 — Odesílací doména a podepsaná osoba *(příprava na fázi 3, dlouhé lhůty!)*
**Cíl:** vybrat odesílací (sub)doménu, nastavit SPF, DKIM, DMARC, naplánovat
zahřívání; určit skutečnou osobu, která bude podepsaná pod zprávami a bude
číst odpovědi (TP-10). Zahřívání trvá týdny — proto patří do fáze 0, i když
odesílat se bude až ve fázi 3.
**Od tebe:** volba domény, přístup k DNS, jméno osoby.
**Výstup:** technicky připravená doména + zdokumentovaný warm-up plán.

### S0.8 — Právní podklady *(paralelně, deadline před fází 3)*
**Cíl:** připravit podklady pro advokáta (e-privacy/OOÚ): popis systému,
kanály, TP pravidla, konkrétní otázky (oprávněný zájem, výklad „hromadně nebo
opakovaně", adresný dopis, telefon, budoucí produktizace se správou souhlasů).
**Od tebe:** výběr advokáta a schůzka.
**Výstup:** brief pro advokáta v `docs/pravni-brief.md`.

### S0.10 — Analýza: má smysl systém prodávat? *(paralelní proud, rozhoduje o produktizaci)*
**Cíl:** než se cokoli investuje do „appky pro klienty", zjistit, jestli je to
byznys. Obsah analýzy: kdo je cílový zákazník (jídelny? cateringy? firmy?
obchodní týmy obecně?), jakou bolest to řeší a čím se to dnes řeší, konkurence
a náhražky, cenový model (jednorázově / měsíčně / podíl), co by se muselo
doprogramovat (správa souhlasů jako nevypnutelná součást, izolace dat mezi
klienty, účtování API — dle SPEC kap. 13 je to i právní podmínka), a jaká je
minimální ověřovací varianta (např. 3 rozhovory s potenciálními zákazníky).
**Klíčové zjištění dopředu:** Cantinero pro vlastní potřebu = předplatné, nula
mezních nákladů. Cantinero jako produkt pro klienty = API tokeny, hosting,
podpora, právní odpovědnost. Jsou to dva různé produkty s různou ekonomikou.
**Od tebe:** kontext trhu a tvoje ambice; rozhodnutí, jestli tenhle proud vůbec
otevřít teď, nebo až po vyhodnocení fáze 1 (**doporučuji až po fázi 1** —
budeš mít reálná data o tom, jestli systém vůbec funguje).
**Výstup:** `docs/analyza-produkt.md` + rozhodnutí jít/nejít do produktizace.

### S0.11 — Vzhled aplikace *(naplánováno 17. 8. 2026, spouští se na signál)*

**Cíl:** projít aplikaci jako celek a sjednotit vzhled — typografii, barvy
stavů, rozestupy, chování na úzkém okně — místo dnešního postupného
přirůstání obrazovku po obrazovce. Nástroj: Claude Design (majitel si ho
vyžádal 17. 8.).

**Co se NEmění:** obsah obrazovek ani toky. Tohle je vzhled, ne přestavba —
kdyby se měnilo obojí najednou, nepozná se, co rozbilo co.

**Doporučení, kdy to pustit — ne dřív než nastane jedna z těchto věcí:**

1. **Aplikaci uvidí někdo zvenčí** — partner, zřizovatel jídelny, potenciální
   zákazník produktu (fáze 2, nebo produktizace ze S0.10). Do té doby ji
   používá jeden až dva lidé, kteří vědí, kde co je.
2. **Přibude sedmá a osmá obrazovka** — dnešních šest se do lišty vejde,
   dalších pár už ne a navigaci bude potřeba přestavět tak jako tak.
3. **Vzhled začne překážet v práci** — projeví se to jako opakované „nevím,
   kam kliknout" nebo přehlédnuté číslo, ne jako „nelíbí se mi to".

**Proč ne teď (můj názor, rozhoduje majitel):** aplikace má vlastní
konzistentní jazyk (tečkovaný vodič mezi popiskem a hodnotou, data
neproporcionálním písmem, stavy kódované tvarem i barvou kvůli barvosleposti)
a **žádná z vad nalezených při proklikání 17. 8. nebyla estetická** — všech
pět byla věcná nebo textová. Přednější je to, co blokuje fázi 3: tvrzení,
šablony a odesílací doména. Re-design nepřinese ani jednu oslovenou firmu.

**Co udělat hned a levně místo toho** (drobnosti, ne session): projít úzké
okno na mobilu, sjednotit velikost písma v tabulkách a doplnit stavům
jednotné pořadí barev. Odhad: hodina práce.

**Od tebe:** signál, že nastala jedna ze tří situací výše — nebo pokyn, že
to chceš dřív. Pak připravím zadání a návrh nanečisto, jako u detailu firmy.

### S0.9 — Kontrolní session: go/no-go *(závěr fáze 0)*
**Cíl:** projít checklist dokončení (kap. 5), vyhodnotit, rozhodnout start
fáze 1 (ostré běhy Čmuchala) a revidovat plán fáze 1 podle ADR.

---

## 5. Kritéria dokončení fáze 0

*(Odškrtnuto podle skutečnosti k 17. 8. 2026 — ověřeno v datech a repozitáři,
ne odhadem.)*

- [x] Lokální prostředí a databáze běží, migrace idempotentní (S0.6)
- [x] Rozhodnut režim provozu: předplatné, 20–50 firem/den, bez cloudu (S0.2)
- [x] CLAUDE.md, paměť, oprávnění a agenti commitnuté (S0.1, S0.3)
- [ ] **Skilly** `overeni-firmy`, `kontrola-kvality`, `tydenni-report` (S0.3)
      — složka `.claude/skills/` neexistuje
- [ ] ADR o technologii sepsané (S0.2) — rozhodnutí padlo a platí, ale zapsané
      je jen v kap. 3 tohohle dokumentu; ADR jsou zatím o frontendu a o dvou
      vrstvách. *Enrichment přepnutý z API na agenta je hotový.*
- [x] ≥ 1 aktivní jídelna se zónou a kapacitou; znám strop obchodu (S0.4)
      — 5 jídelen, 80 obědů/den k prodeji, 40 v přípravě
- [ ] **Knihovna tvrzení schválená, šablony navržené (S0.5)** — v databázi je
      0 tvrzení a 0 šablon. **Blokuje fázi 3.**
- [x] Dry-run Čmuchala prošel (S0.6) — a po něm stovky ostrých firem
- [ ] **Doména s SPF/DKIM/DMARC, zahřívání běží, podepsaná osoba (S0.7)**
      — nezačato. **Blokuje fázi 3 a má nejdelší lhůty ze všeho.**
- [ ] Právní brief hotový, konzultace domluvená (S0.8) — brief hotový 11. 8.,
      konzultace neznámo
- [x] Analýza produktizace (S0.10) — `docs/analyza-produkt.md`, 11. 8.
- [ ] Go/no-go do fáze 1 (S0.9) — neproběhlo; fáze 1 se rozjela bez něj

## 6. Rozhodnutí, která jsou jen tvoje (souhrn)

| # | Rozhodnutí | Stav |
|---|---|---|
| 1 | Technologie a režim provozu (S0.2) | ✅ předplatné + lokální DB, 20–50/den |
| 2 | Cloudová DB (S0.6) | ✅ zatím nepotřeba, Supabase se nedotýkáme |
| 3 | Seznam jídelen (S0.4) | ✅ 5 jídelen, kapacita 120 obědů/den |
| 4 | **Fakta o produktu a schválení tvrzení (S0.5)** | ⏳ **blokuje fázi 3** |
| 5 | **Doména + podepsaná osoba (S0.7)** | ⏳ **blokuje fázi 3**, nejdelší lhůty |
| 6 | Advokát (S0.8) | ⏳ brief hotový, konzultace na tobě |
| 7 | Analýza produktizace (S0.10) | ✅ hotová 11. 8., rozhodnutí otevřené |
| 8 | Kdy pustit vzhled aplikace (S0.11) | ⏳ doporučuji na signál, ne teď |
| 9 | Překvalifikace 2 301 plzeňských firem | ⏸ vědomě odloženo na kapacitu |
| 10 | Přepsat 7 vadných oborů (≈ 8 min agentní práce) | ⏳ čeká na pokyn |
