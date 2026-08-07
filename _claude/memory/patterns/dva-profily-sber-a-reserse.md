---
name: dva-profily-sber-a-reserse
description: Profil se čte ze dvou míst — sběr bere globálně aktivní, rešerše profil kampaně; kdo ho čte, musí říct který
type: pattern
status: active
created: 2026-08-07
updated: 2026-08-07
related: [dve-vrstvy-znalost-a-zprava, tri-kopie-seznamu-atributu]
---

**Od 7. 8. 2026 nejsou profily jeden mechanismus, ale dva vedle sebe.**
Je to **záměr, ne opomenutí** — a zároveň nejsnazší místo, kde se v téhle
části splést.

| Kdo | Odkud bere profil | Proč |
|---|---|---|
| **Sběr** (`cmuchal`, `cmuchal-oblast`) | globálně aktivní (`profily where aktivni`) | běží nad **územím**, kde kampaň ještě není |
| **Rešerše** (`reserse obsluz`, `k-obohaceni --kampan`) | `kampane.profil_kod`, jinak globálně aktivní | běží **uvnitř kampaně**, a tam má rozhodovat ona |

`kampane.profil_kod` je nepovinný. `NULL` znamená „použij globálně aktivní" —
díky tomu stávající kampaně fungují dál beze změny.

## Pravidlo

**Kdo profil čte, ať v kódu i ve výpisu řekne, který bere.** Jinak příští
čtenář jednu z těch dvou cest opraví na tu druhou v dobré víře, že spravuje
nedopatření. `cmdReserse` proto vypisuje použitý profil do konzole — aby to
šlo poznat i zpětně z deníku běhu.

Funkce jsou v `src/atributy.ts`: `aktivniProfilKod` (sběr) proti
`profilProKampan` (rešerše). Komentáře u obou tenhle rozdíl vysvětlují.

## Co z toho ještě neplyne

**Profil při zápisu nálezů nekontroluje nikdo.** `zapisDavku` pouští každý
atribut s globálním `hleda_agent = true`, bez ohledu na profil té kampaně —
profil se uplatní jen při výpočtu `chybi`, tedy jako **rada agentovi
v promptu**, ne jako kontrola v kódu. Dnes to nemá následek (všechny tři
atributy s `hleda_agent` jsou v obou profilech), ale věta ze zadání „profil
hlídá sběr" je tím pádem pravdivá jen z poloviny.

Odhalila to závěrečná revize 7. 8. jako **mezeru v plánu, ne v provedení**
(`zapisDavku` nedostává `kampanId`, takže by to bez rozšíření rozhraní ani
nešlo). Nechává se vědomě otevřené — ale `CLAUDE.md` říká „instrukce
v promptu není záruka", takže až se profily začnou doopravdy lišit, tohle
je první místo, které se musí dodělat.
