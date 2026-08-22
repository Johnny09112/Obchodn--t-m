---
name: dve-domeny-mapleed-a-cantinero
description: Mapleed je neviditelná infrastruktura pro běh aplikace, Cantinero je doména, ze které se odesílá — odesílací doména je to nejviditelnější na mailu
type: decision
status: active
created: 2026-08-21
updated: 2026-08-22
related: [odesilaci-domena-a-adresa, druha-firma-vlastni-instance, zkusebni-odeslani-na-vlastni-adresu]
---

**Rozhodl majitel 20.–21. 8. 2026.** Koupil doménu `mapleed.cz` a upřesnil,
že **Mapleed má zatím zůstat neviditelný** — „closed věc, která bude sloužit
jen pro běh aplikace", ven se s ní půjde, až se bude řešit prodej systému.

## Rozdělení

| Doména | DNS | K čemu |
|---|---|---|
| `cantinero.cz` | Cloudflare | **odesílání** — z ní odchází pošta firmám |
| `mapleed.cz` | Cloudflare (přesunuto 21. 8. z Forpsi) | **aplikace** — `cantinero.mapleed.cz`, `behere.mapleed.cz` |

**Proč se neodesílá z Mapleedu:** odesílací doména je to nejviditelnější na
celém mailu — je v poli „Od", čtou ji filtry i příjemci. Kdyby Cantinero psalo
z `@mapleed.cz`, byl by Mapleed po pár desítkách zpráv první věcí, na kterou
lidé narazí. Navíc doména bez webu působí podezřele, takže by se muselo volit
mezi zviditelněním a horší doručitelností.

**Odesílá se z `jméno@cantinero.cz`** podle přihlášeného uživatele, **bez
podsložky** (majitel 20. 8. — podsložku zvažoval a zamítl). V Resendu se
ověřuje doména, ne adresa, takže nový člověk nepotřebuje žádné nastavování.
`laub@cantinero.cz` je skutečná schránka, takže odpovědi chodí samy a Reply-To
se nastavuje jen tam, kde by se adresa lišila.

**Poznámka k neviditelnosti:** znamená „nepropagujeme", ne „je to tajné".
Jakmile na Mapleedu poběží aplikace přes HTTPS, certifikát se zapíše do
veřejného seznamu a doména se dohledat dá. Majitel to ví.

## Stav Mapleedu k 21. 8.

Přesunutý na Cloudflare (NSSET `MAPLEED-CF`, servery `cosmin`/`tessa`).
Nese A záznam na parkovací stránku Forpsi (`81.2.196.19`) a **dva MX na
Seznam Email Profi** — pošta na té doméně existuje, takže se při přesunu
musely záznamy přenést. Nemá SPF ani DMARC; až se přes tu schránku bude
posílat, bude to chtít doplnit.

**Past, na kterou se u toho přišlo:** doména měla aktivní DNSSEC a přepnutí
serverů bez odebrání podpisu by ji položilo celou. Podrobnosti a správné
pořadí jsou v osobním vaultu ([[dnssec-blokuje-presun-dns]]) — platí to pro
jakýkoli projekt, ne jen pro tenhle.

**Web pro Mapleed** se bude stavět, až přijde prodej ven; doporučeno na
Vercelu, kde už běží aplikace, ne třetím systémem navíc.

## Změna 22. 8. 2026 — neviditelnost končí

**Majitel rozhodl 22. 8.,** že prezentační web na `mapleed.cz` vzniká teď
a mluví **k zájemcům o koupi systému**. Tím padá dosavadní „closed věc, jen
pro běh aplikace" — Mapleed jde ven jako dodavatel software.

Vzhled si majitel dělá sám v Claude Designu a pošle ho sem; převod do
skutečného webu (responzivita, formulář, SEO, doména) se dělá v kódu.
Technický návrh a dělící čára návrh/kód:
`docs/vizualizace/web-mapleed-navrh-2026-08-22.html`. **Nic se nestaví,
dokud majitel návrh neodkývne.**

Beze změny zůstává: odesílá se dál z `cantinero.cz`, aplikace běží na
podoménách Mapleedu, MX Seznamu na doméně se nesmí rozbít.
