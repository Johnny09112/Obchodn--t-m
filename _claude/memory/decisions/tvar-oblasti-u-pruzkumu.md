---
name: tvar-oblasti-u-pruzkumu
description: Průzkum si zapamatuje tvar oblasti, který skutečně prošel — zapisuje se při zahájení
type: decision
status: active
created: 2026-08-02
updated: 2026-08-02
related: [kampan-nad-vice-oblastmi, prehled-oblasti-pohledem]
---

**Kontext:** Majitel 31. 7.: oblasti slouží k zadání hledání, takže „i Plzeň se
může čas od času měnit (rozšiřovat/zmenšovat)". Bez otisku by starý průzkum
tvrdil „analyzovali jsme Plzeň", jenže ta Plzeň by mezitím znamenala něco
jiného. Průzkum je evidence — musí popisovat, co se stalo, ne dnešní stav.

**Rozhodnutí (migrace 0031):** `pruzkumy.tvar` (jsonb v podobě typu `Oblast`)
a `pruzkumy.oblast_nazev`.

**Zapisuje se při ZAHÁJENÍ, ne při objednání.** Zaznamenává se tvar, který
Čmuchal skutečně prošel; mezi objednávkou a během se dá oblast ještě
překreslit. Technicky je zápis součástí téhož `update` v `zahajPruzkum`, který
objednávku rozbíhá — proto se stane právě jednou. `vyridPruzkum` volá
`zahajPruzkum` při každém navazujícím běhu a na běžící objednávku nesahá, takže
se doklad neposouvá s každým pokusem.

**Skládá to SQL funkce `tvar_oblasti(uuid)`.** Používá ji zahájení průzkumu
i pohled `oblasti_prehled`, kde se porovnává. Dvě kopie téhož skládání by se
rozešly a přehled by hlásil změnu tam, kde žádná není.

**`oblasti_prehled.tvar_zmenen`** = oblast se od posledního zaznamenaného tvaru
překreslila. Bere se **nejnovější průzkum, který tvar má** — čekající
objednávka tvar ještě nemá a nesmí přebít doklad staršího dokončeného průzkumu,
zrovna když je to hlášení nejužitečnější.

**Staré průzkumy se nedoplňují.** Dva průzkumy z 31. 7. tvar nemají a nikdy mít
nebudou — dopsat jim dnešní tvar by byla lež. `tvar_zmenen` je u nich `false`,
protože není proti čemu porovnávat, ne protože se nic nezměnilo.

**V aplikaci:** seznam oblastí to hlásí pod stavem průzkumu, krok 3 průvodce
jako varování („v dokreslené části se ještě nehledalo, takže odtud firmy
chybí").

**Neověřeno v prohlížeči** — port 5173 držela jiná session, aplikace naskočila
na 5174 a tam je odhlášená. Ověřeno na úrovni databáze (9 testů včetně
majitelova případu s rozšířenou Plzní) a dotazem nad ostrým pohledem.
