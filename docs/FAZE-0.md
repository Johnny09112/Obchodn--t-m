# Fáze 0 — přípravná: orchestrace

Návrh celé přípravné fáze projektu Cantinero. Spojuje dvě věci, které SPEC
i realita vyžadují **před** ostrým během čehokoli:

- **A. Pracovní prostředí** (co chybělo: CLAUDE.md, agenti, skilly, paměť,
  oprávnění) — aby se na projektu dalo systematicky a bezpečně pracovat.
- **B. Obchodní a infrastrukturní příprava dle SPEC kap. 12, fáze 0**
  (jídelny a zóny, knihovna tvrzení, šablony, odesílací doména, podepsaná
  osoba, právní konzultace).

Stav: **návrh k odsouhlasení**. Nic z níže uvedeného ještě neběží.

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
S0.1 Workspace             S0.4 Jídelny a zóny             S0.2 Architektura (ADR)
S0.3 Agenti + skilly       S0.5 Tvrzení + šablony          S0.6 DB projekt
                           S0.7 E-mail + podpis            S0.8 Právní podklady
```

Pořadí: **S0.1 → S0.2** jsou první (S0.1 nic neblokuje, S0.2 blokuje S0.3
a S0.6). Proud B může běžet paralelně, jakmile dodáš vstupy. Fáze 0 končí
kontrolní session S0.9 (go/no-go do fáze 1).

---

## 3. S0.2 — Rozhodnutí o technologii (nejdůležitější)

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

**Doporučení: hybrid V1+V2 teď, V3 zvážit od fáze 3.**
Jádro (DB, pravidla, ARES, geo, skóre) zůstává kód — to je neprůstřelnost,
kterou SPEC vyžaduje („kontrola vynucená v kódu, nikoli v promptu"). Nad ním
Claude Code s definovanými agenty a skilly pro fáze 1–2, kde stejně chceš
člověka u ruky. Až bude potřeba 24/7 provoz Obchodníka a Statistika (fáze 3+),
rozhodneme o V3/plánovači podle zkušeností. Rozhodnutí zapíšeme jako ADR do
`docs/adr/0001-technologie.md`.

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

### S0.6 — Databázový projekt a prostředí *(po S0.2)*
**Cíl:** založit produkční DB (Supabase projekt — placené, potvrdíš cenu; nebo
jiná volba z ADR), aplikovat migrace, nastavit `.env`, ověřit `cli stav`.
**Od tebe:** potvrzení založení projektu + ANTHROPIC_API_KEY pro enrichment.
**Výstup:** běžící prostředí, dry-run Čmuchala na 5 firmách.

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

### S0.9 — Kontrolní session: go/no-go *(závěr fáze 0)*
**Cíl:** projít checklist dokončení (kap. 5), vyhodnotit, rozhodnout start
fáze 1 (ostré běhy Čmuchala) a revidovat plán fáze 1 podle ADR.

---

## 5. Kritéria dokončení fáze 0

- [ ] CLAUDE.md, paměť, oprávnění, agenti a skilly commitnuté (S0.1, S0.3)
- [ ] ADR o technologii schválené (S0.2)
- [ ] ≥ 1 aktivní jídelna se zónou a kapacitou v DB; znám strop obchodu (S0.4)
- [ ] Knihovna tvrzení schválená, šablony navržené (S0.5)
- [ ] Produkční DB běží, dry-run Čmuchala prošel (S0.6)
- [ ] Doména s SPF/DKIM/DMARC, zahřívání běží, podepsaná osoba určena (S0.7)
- [ ] Právní brief hotový, konzultace domluvená (S0.8)

## 6. Rozhodnutí, která jsou jen tvoje (souhrn)

1. **Technologie** (S0.2) — doporučuji hybrid: kódové jádro + Claude Code agenti.
2. **Supabase / jiná DB** (S0.6) — placená akce.
3. **Seznam jídelen** (S0.4) — bez nich není území.
4. **Fakta o produktu** a schválení tvrzení (S0.5).
5. **Doména + podepsaná osoba** (S0.7).
6. **Advokát** (S0.8).
7. Denní limity a rozpočet na API náklady (můžeme nechat na fázi 3, ale
   rozpočet na enrichment ve fázi 1 je dobré říct dopředu — hrubý odhad:
   nižší jednotky USD na 10 obohacených firem).
