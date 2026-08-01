---
name: zapis-po-jedne-je-lokalne-neviditelny
description: Přepočet oblasti vkládal firmy po jedné — na PGlite rychle, přes síť minuty
type: bug
status: fixed
created: 2026-08-01
updated: 2026-08-01
related: [prehled-oblasti-pohledem]
---

**Příznak:** `oblast prepocitej` proti ostré databázi neskončil ani po deseti
minutách. Testy přitom běžely rychle a nic nehlásily.

**Příčina:** `prepocitejOblastFirmy` vkládal **jeden `insert` na firmu**.
Na PGlite je to v procesu, takže 12 762 firem Plzně proběhne skoro hned.
Přes pooler je každý zápis jedna cesta tam a zpět — desítky milisekund —
takže totéž trvá minuty.

**Oprava:** vkládá se po dávkách po 500 řádcích, stejně jako to už dělala
aplikace v `zapisPrislusnost`. Místa parametrů skládá `mistaVDavce()` a testuje
se zvlášť (`test/oblast-davka.test.ts`) — je to jediné místo v projektu, kde se
čísla parametrů počítají ručně, tedy jediné, kde se dá udělat chyba o jedna.

**Poučení:** **výkon zápisu se na PGlite neotestuje.** Testy běží v procesu,
kde je round trip zdarma; kód, který dělá N dotazů místo jednoho, projde zeleně.
Když se něco zapisuje ve smyčce, dávkuj rovnou — nebo to aspoň zkus proti ostré
databázi, než to prohlásíš za hotové.
