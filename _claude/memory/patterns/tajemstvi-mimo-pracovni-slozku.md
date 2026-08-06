---
name: tajemstvi-mimo-pracovni-slozku
description: Omezení nástrojů agenta není bezpečnostní hranice — tajemství musí ležet mimo pracovní složku
type: pattern
status: active
created: 2026-08-06
updated: 2026-08-06
related: [dve-vrstvy-znalost-a-zprava, zelene-testy-nejsou-hotova-obrazovka]
---

**Past:** při stavbě fronty AI průzkumu jsme se spolehli na `--allowedTools`
jako na zámek. Není to zámek. Ověřeno **živými pokusy 6. 8. 2026**:

| Co jsem zkusil | Výsledek |
|---|---|
| `--allowedTools "Read(playbook-cmuchal.md)"`, pak chtít délku `src/reserse.ts` | **Přečetl to** — vrátil přesných 130 řádků |
| `--disallowedTools "Read(src/**)"` | Zablokováno ✓ |
| `--disallowedTools "Read(.env)"` | **Nezablokováno** |
| `--disallowedTools "Read(**/.env)"` | **Nezablokováno** |

Závěr: **povolovací vzory s cestou neomezují vůbec**, zakazovací zabírají
jen na některé tvary. Dotfily jim utekly.

**Proč na tom záleželo:** Čmuchal běží bez dozoru v pracovní složce a jeho
prací je číst cizí weby, tedy neověřený obsah. Dosáhl by na `.env`
s přístupem do databáze a zároveň má `WebFetch` na libovolnou doménu. To je
hotová cesta ven při vloženém pokynu ze stránky.

## Co s tím

**Tajemství leží mimo pracovní složku.** `src/env.ts` (`vychoziCestaEnv`)
hledá `~/.cantinero/.env`; přebít jde proměnnou `CANTINERO_ENV`. Když soubor
mimo repozitář není, ale staré `.env` v projektu ano, načte se **a nahlas
varuje** — tiché převzetí by znamenalo, že si přesunu nikdo nevšimne.

`.gitignore` nově kryje i `.env.*` (kromě `.env.example`). Dočasný soubor
typu `.env.puvodni` by se jinak dal omylem zacommitovat.

## Poučení do budoucna

**Nestav bezpečnost běhu bez dozoru na tom, co si myslíš, že nastavení
nástrojů dělá.** Ověř to pokusem, nebo se na to nespoléhej. Hranice, které
u tohohle projektu doopravdy drží, jsou v kódu:

1. tajemství nejsou tam, kam agent dosáhne,
2. každý zápis prochází `zapis-nalezy` (zdroj + doslovná citace, whitelist),
3. agent nemá čím odeslat a každý běh je v `agent_runs`.

**Poznámka k okolnostem:** při tom ověřování jsem agenta přiměl `.env`
přečíst (hlásil jen počet řádků, ale obsah prošel jeho kontextem). Majiteli
nahlášeno; čistá odpověď je změnit heslo k databázi.
