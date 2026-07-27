# Log rozhodnutí

Formát: datum · kdo · rozhodnutí · proč. Nové řádky nahoru.

- 2026-07-26 · majitel · **Prvních 5 jídelen** (Bezdružice, 34. ZŠ Plzeň,
  Zbůch, Tlučná, Hrádek u Rokycan). **Začínáme Bezdružicemi**, zbytek až po
  testu. Jídelna Bezdružice založena v DB (kodObce 560740, 49.90624/12.97442),
  kapacita zatím 0 — čeká na číslo od majitele.
- 2026-07-26 · majitel · **E-mail se bude posílat z Outlooku** (Microsoft 365).
  Ověřit způsob autentizace — Microsoft ruší Basic auth pro SMTP, půjde
  nejspíš přes Graph API. Detail do S0.7.
- 2026-07-26 · majitel · **Mapa má být na reálném mapovém podkladu**, aby byly
  vidět i malé obce. Pozor: publikované artifacty mají zakázané externí
  požadavky → dlaždice fungují jen v lokální verzi stránky.
- 2026-07-26 · majitel · **Frontend bude potřeba dřív — systém mají používat
  i kolegové.** ⚠ Mění architekturu: víc uživatelů = sdílená databáze
  (lokální nestačí) a agent běžící mimo majitelův Claude Code. Nutno
  rozhodnout rozsah (jen sledování vs. plné ovládání) — otevřeno v S0.2.
- 2026-07-26 · majitel · **Ke každému většímu výstupu vždy HTML vizualizace**
  (do `docs/vizualizace/`, publikovat jako artifact). Majitel si stav
  prohlíží vizuálně, ne v textu. → zapsáno do CLAUDE.md.
- 2026-07-26 · majitel · **Interaktivní mapa ČR** jako průběžný cíl: postupně
  se plní analyzovanými oblastmi (zóny jídelen, vyhodnocené firmy).
- 2026-07-26 · majitel · **Spouštění: nejdřív konverzačně, později
  s možností plánování.** Frontend (mapa, přehledy) slouží ke sledování
  a schvalování, ne jako hlavní ovládání.
- 2026-07-26 · majitel · **Provoz na předplatném, ne na API tokenech.** Majitel
  má Claude Max 5×; API se bude řešit až u případného externího klienta.
  Důsledek: Cantinero není samostatná bezobslužná aplikace — je to sada
  nástrojů (kód) + agent v Claude Code, který je používá. Enrichment tedy
  neběží přes Anthropic SDK, ale jako práce agenta v session.
- 2026-07-26 · majitel · **Cílový objem: 20–50 firem denně**, víc nemá smysl.
  Sedí na dávkový režim na předplatném; nevyžaduje 24/7 infrastrukturu.
- 2026-07-26 · Claude · **Databáze lokálně (PGlite v `data/pgdata`)**, žádný
  cloud. Stávající Supabase projekty majitele zůstávají nedotčené a nic se
  nepozastavuje. Migrace jsou idempotentní (tabulka `_migrace`), `data/` je
  v .gitignore. Přechod na cloudový Postgres = vyplnit DATABASE_URL.
- 2026-07-26 · majitel · **Před investicí do produktizace je potřeba analýza,
  zda má smysl systém prodávat dalším firmám.** → nová session S0.10.
- 2026-07-26 · majitel · **Před ostrým provozem proběhne fáze 0 (přípravná)** —
  workspace, agenti, skilly, paměť, obchodní příprava; teprve pak další postup.
  Technologie se může ještě změnit. → orchestrace v docs/FAZE-0.md.
- 2026-07-24 · Claude · **Local-first vývoj**: testy nad PGlite bez sítě,
  produkční DB se zakládá až po potvrzení majitelem (oba stávající Supabase
  projekty jsou obsazené jinými aplikacemi).
- 2026-07-24 · Claude · **Čeština všude** (kód-komentáře, dokumenty, commity;
  identifikátory bez diakritiky) — konzistence se SPEC.
- 2026-07-24 · Claude (navrženo, nepotvrzeno) · Doporučení technologie =
  hybrid: kódové jádro (tvrdá pravidla) + Claude Code agenti. **Čeká na S0.2.**
