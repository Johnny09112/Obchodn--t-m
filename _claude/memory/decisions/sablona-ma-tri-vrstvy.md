---
name: sablona-ma-tri-vrstvy
description: Přenositelná je stavba zprávy, ne její slova — u nového zákazníka si tvrzení vyptá agent a slova z nich složí
type: decision
status: active
created: 2026-08-18
updated: 2026-08-18
related: [onboarding-dotaznik-pro-prodej, personalizace-jen-z-whitelistu, kdo-vari-a-co-se-neprozrazuje]
---

**Vyslovil majitel 18. 8. 2026** při schvalování šablon: *„uvažuj stále nad
tím, že to musí být nasaditelné i u jiné firmy, tj. jak tohle budeme ladit
tam netušíme. To by měl v první řadě právě umět navrhnout AI agent.“*

Odpověď: tři maily o školních jídelnách se u jiného zákazníka ladit
nebudou. **Přenositelná je stavba, ne slova.** Šablona má tři vrstvy:

| Vrstva | Co to je | Kdo ji vytvoří u nového zákazníka |
|---|---|---|
| **Stavba** | vztah k adresátovi → co nabízíme → jak to chodí → právě jedna otázka; plus pravidla (do 120 slov, bez odrážek, prostý text) | zůstává, je to majetek systému — v databázi je na to `templates.struktura_id` |
| **Tvrzení** | osm vět o službě s dokladem | **agent se doptá** (viz [[onboarding-dotaznik-pro-prodej]]) a předloží zákazníkovi ke schválení |
| **Slova** | konkrétní věty mailu | agent je složí ze schválených tvrzení podle stavby a nechá zákazníka přepsat |

**Proč to takhle:** kontrola stylu (`src/styl-zpravy.ts`) i whitelist hlídají
právě stavbu a doložitelnost, ne obsah oboru — jsou tedy přenositelné bez
úprav. Naopak žádné pravidlo neumí říct, jestli je věta o službě pravdivá;
to smí potvrdit jen zákazník.

**Praktický důsledek:** to, co majitel dělá při S0.5 ručně, je zároveň
zkouška postupu, který u dalšího zákazníka odjede agent sám. Proto se
vyplatí projít to jednou podrobně.
