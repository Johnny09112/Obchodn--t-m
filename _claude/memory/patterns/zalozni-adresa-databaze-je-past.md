---
name: zalozni-adresa-databaze-je-past
description: Záložní („??") adresa databáze v kódu aplikace se u druhého nasazení mění v tiché připojení k cizím datům — nastavení musí chybět hlasitě
type: pattern
status: active
created: 2026-08-20
updated: 2026-08-20
related: [druha-firma-vlastni-instance, vercel-instaluje-jen-app-zavislosti]
---

**Nalezeno 20. 8. 2026** při přípravě druhého zákazníka, dřív než to stihlo
uškodit.

`app/src/supabase.ts` měl:

```ts
const URL = import.meta.env.VITE_SUPABASE_URL ?? "https://sedjnwllzyeuiruxgoil.supabase.co";
```

Dokud běžela jedna firma, byla to úspora psaní. U druhého nasazení je to
past: **nasazení bez nastavených proměnných by se tiše připojilo k datům
první firmy.** Přihlášení projde, data se ukážou, jen patří někomu jinému —
a nic nekřičí.

**Pravidlo:** u údaje, který rozhoduje, **čí data uvidím**, se záložní hodnota
do kódu nepíše. Chybějící nastavení musí být vidět, ne obejít.

**Jak je to vyřešené:** `app/src/nastaveni.ts` vrací seznam chybějících
proměnných a místo adresy dá `https://nenastaveno.invalid` (RFC 2606 — nikam
nevede). `main.tsx` podle toho vykreslí obrazovku „Chybí připojení"
**místo celé aplikace**, takže se nestihne položit ani jeden dotaz.
Regresní test `test/nastaveni-pripojeni.test.ts` hlídá, že se při chybějícím
nastavení nikdy neobjeví adresa produkční databáze.

**Past při nasazování:** verze bez záložní hodnoty se smí nasadit **až po**
doplnění proměnných u stávajícího projektu ve Vercelu. Opačné pořadí shodí
běžící provoz na obrazovku „Chybí připojení".
