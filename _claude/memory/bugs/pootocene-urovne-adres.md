---
name: pootocene-urovne-adres
description: Obrazovka i příkazová řádka hlásily úroveň 1 jako jmenovanou osobu, ačkoli TP-6 říká opak — a právě to číslo hlídá GDPR
type: bug
status: fixed
created: 2026-08-06
updated: 2026-08-06
related: [dve-vrstvy-znalost-a-zprava]
---

**Příznak:** rozpad kontaktů v kampani ukazoval pootočené popisky.

| Úroveň | Podle SPEC (TP-6) | Co se zobrazovalo |
|---|---|---|
| 1 | adresa pro nabídky | „Na jmenovanou osobu" |
| 2 | obecná `info@` | „Na adresu pro nabídky" |
| 3 | jmenovaná osoba | „Jen obecná adresa" |

**Root cause:** v `app/src/data.ts` i v `src/kampan.ts` stál shodný komentář
„1 je jmenovaná osoba, 3 obecná adresa" a mapování podle něj. Je to přesný
opak TP-6. Sběr (`src/kontakty.ts`) přitom zapisoval správně — jednatel
z rejstříku i kontakt z MPSV dostávají úroveň 3.

**Proč to nechytily testy:** `test/kampan-souhrn.test.ts` měl na každé úrovni
právě jednu firmu, takže výsledek `{1,1,1}` seděl i s pootočenými popisky.
Druhý test měl navíc v datech tentýž omyl — e-mail na ředitele s úrovní 1.

**Proč na tom záleží:** není to kosmetika. Počet firem oslovených **na
jmenovanou osobu** je ten, u kterého patří do zprávy poučení podle
**čl. 14 GDPR**. Obrazovka ho hlásila jako „jen obecná adresa", tedy jako
nejneškodnější variantu. Před fází 3 by to byla nepříjemná chyba.

**Oprava:** mapování srovnáno s TP-6 na obou místech, komentáře přepsány
i s důvodem pořadí, a test přepsán tak, aby měl na každé úrovni **jiný
počet** firem — pootočení teď spadne.

## Poučení

**TP-6 není pořadí podle toho, kdo o nabídce rozhoduje.** Je to právní
žebříček: adresa zveřejněná pro příjem nabídek je pozvánka, kdežto u jmenované
osoby zpracováváme osobní údaj získaný odjinud. Kdo si to splete (jako já při
první úvaze), navrhne „přezacílit na HR" — a přitom volba osoby je ve SPEC
řešená zvlášť (kap. 10, „priorita: HR nebo people ops, office management,
provozní ředitel, u malých firem jednatel") a je správně už dnes.

**Test s jedničkou v každé kategorii netestuje mapování.** Kdykoli se
kontroluje roztřídění do skupin, dej každé skupině jiný počet.
