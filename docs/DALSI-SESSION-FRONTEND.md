# Předání: stavba aplikace

> **Pro Claude v nové session.** Přečti po `memory/MEMORY.md` a `memory/stav.md`.
> Návrh a zdůvodnění je v `docs/adr/0001-frontend.md` — tenhle soubor je
> odrazový můstek, ne náhrada.
>
> Psáno 2026-07-29 na konci session, kde se dokončila celá příprava.

## Kde to stojí

Přípravné kroky 1–3 z plánu jsou **hotové a ověřené**. Zbývá krok 4 a 5:
samotná aplikace.

| hotovo | co to znamená |
|---|---|
| Oblast je samostatná věc | Smí vzniknout bez jídelny, může být kruh i nakreslený tvar. `src/oblast.ts`, migrace 0011. |
| Kategorie a blacklist | Data, ne kód. Migrace 0012–0013. |
| Profily projektu | „Koho hledáme" se přepíná bez zásahu do programu. Migrace 0014. |
| Sdílená databáze | Supabase `Customer_finder`, data přenesená (3 695 řádků). |
| Zabezpečení | RLS všude, pravidla podle rolí. Migrace 0015–0016. |
| Uživatelé | 4 účty s rolemi, ověřené. |

**264 testů zelených, náklady 0 Kč.**

## Co postavit

### Krok 4 — mapa a oblasti (to hlavní)

Kvůli tomuhle celá aplikace vzniká: **kruh nestačí**, protože usekne
sousední město v půlce, a zvětšení poloměru nabere na druhé straně, co nemá.
Majitel potřebuje tvar natáhnout jedním směrem.

Obrazovka: mapa nahoře, seznam firem dole.

1. **Zobrazit oblast** — existující i navrženou před sběrem
2. **Upravit ji** — poloměr, nebo nakreslit vlastní tvar
3. **Vypsat firmy uvnitř** s filtry (velikost, kategorie, stav kontaktu)
4. **Založit oblast bez jídelny** a přiřadit jídelnu až po jednání

Logika je hotová: `bodVOblasti()` počítá i konkávní tvary, `prepocitejOblastFirmy()`
naplní příslušnost. Aplikace to jen zobrazí a zapíše.

### Krok 5 — kampaně

Předfiltr z databáze → mapa + seznam → výběr bodem nebo kresbou → kampaň.
**Odesílání zůstává zavřené** (TP-8) a odemknout ho smí jen majitel, navíc
až budou hotová tvrzení, šablony a právní posouzení z fáze 0.

## Technické zadání

- **Hosting: Vercel** (majitel ho má placený a má do něj přístup)
- **Adresa: `find.cantinero.cz`** — DNS je na **Cloudflare**, ne na Forpsi;
  majitel do něj přístup má. `find.cantinero.cz` se dnes už překládá
  (nejspíš zástupný záznam `*`), takže ho bude potřeba přebít konkrétním.
- **Databáze:** Supabase `Customer_finder`, ref `sedjnwllzyeuiruxgoil`,
  eu-central-1. Připojení **přes pooler** (`aws-0-eu-central-1.pooler.supabase.com`,
  uživatel `postgres.<ref>`, port 5432) — přímá adresa je jen na IPv6.
- **Přihlašování:** Supabase Auth. Role v `app_metadata`:
  `super-admin` · `admin` · `uzivatel`.
- **Klíč pro frontend:** publishable/anon, **nikdy service_role.**
- **Mapa:** Leaflet — už se používá v `src/mapa.ts`, odkud jde vyjít.

### Co aplikace NEDĚLÁ

- **Nespouští agenta.** Sběr a rešerše zůstávají v Claude Code na
  předplatném každého uživatele. Aplikace jen čte a zapisuje data.
- **Neodesílá e-maily.** Ani je odeslat neumí.

## Na co narazíš

| past | co s tím |
|---|---|
| **RLS je zapnuté a bez pravidel u tabulek pozdějších fází** (zprávy, souhlasy, šablony). Je to záměr. | Až na ně dojde, přidat pravidla — ne je vypínat. |
| **Frontend jde přes anon klíč**, tedy pravidla platí naplno. Náš CLI je obchází, protože se připojuje jako vlastník. | Co funguje z příkazové řádky, nemusí fungovat z aplikace. Testovat přihlášeným účtem. |
| **Kartotéka je jen ke čtení** i pro adminy — zapisuje ji agent. | Pokud aplikace potřebuje zapisovat, je to změna pravidel, ne obejití. |
| **UPDATE potřebuje i SELECT pravidlo**, jinak tiše neudělá nic. | Viz skill `supabase`. |
| Po každé změně schématu | spustit kontrolu `get_advisors` typu `security`. |

## Otevřené, rozhodne majitel

- **Kolik prostoru dát mikrofirmám** — 81 jich má jméno bez spojení;
  podle dřívějšího rozhodnutí se na ně cílí jinou formou než e-mailem.
- **Návrh Čmuchala ke schválení:** u firem bez webu zkusit registry
  zadávacích řízení. Agent to podle pravidel nezkusil a čeká.
- **Je firma „hotová", když je jméno na jednom záznamu a e-mail na druhém?**
  Přísně 18 z 20, na úrovni firmy 19 z 20.
- **Analýza trhu a potenciálu prodeje** systému dalším firmám — majitel
  ji chce jako samostatnou session.

## Čím rozumně začít

1. Kostra aplikace + přihlášení, ověřit že přihlášený uživatel **vidí
   kartotéku** a nepřihlášený **nevidí nic**. To otestuje celý řetěz
   (Auth → pravidla → data) dřív, než se postaví cokoli složitého.
2. Teprve pak mapa a kreslení.

Nasazení na `find.cantinero.cz` až nakonec — do té doby stačí adresa
od Vercelu.
