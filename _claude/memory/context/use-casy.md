---
name: use-casy
description: Které use-casy dnes systém obsluhuje — stravování pro střední a větší firmy, docházkové systémy pro obce i firmy
type: context
status: active
created: 2026-08-10
updated: 2026-08-10
related: [produkt-neni-vazany-na-obor, dva-profily-sber-a-reserse]
---

Majitel upřesnil 10. 8. 2026. Systém **není vázaný na obor**
([[produkt-neni-vazany-na-obor]]); tohle je stav k dnešku, ne strop.

| Use-case | Koho oslovuje | Co se prodává |
|---|---|---|
| **Stravování** | střední a větší firmy | obědy z partnerských školních jídelen |
| **Docházkové systémy** | **obce** i firmy | docházkový systém |

## Co z toho plyne pro návrh

**Směnnost je cennější pro docházku než pro obědy.** U obědů říká, kolik
lidí kdy jí; u docházky je vícesměnný nebo nepřetržitý provoz **přímo tím
důvodem**, proč firma docházkový systém potřebuje — evidence směn ručně
nejde. Zavedli jsme ji 10. 8. kvůli obědům, ale hlavní užitek bude jinde.

**Obce nakupují přes veřejné zakázky a smlouvy.** U nich nemá smysl hledat
kariérní stránky ani stravovací benefity — rozhoduje se ve výběrovém řízení
a **končící smlouva je nejsilnější možný signál**. Registr smluv
(`data.smlouvy.gov.cz`, měsíční XML) je proto pro tenhle use-case
důležitější než celý web firmy.

**Dva use-casy chtějí opačné síto.** Stravování vylučuje firmy s vlastní
jídelnou; docházka je naopak nevylučuje vůbec. Proto to musí být dva
profily, ne jedno nastavení s výjimkami.
