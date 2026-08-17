---
name: odesilaci-domena-a-adresa
description: Posílá se z adresy přihlášeného uživatele přes Resend a odesílací doména musí být nastavitelná per firma, protože se systém bude prodávat
type: decision
status: active
created: 2026-08-17
updated: 2026-08-17
related: [odesilani-zakazano-jen-docasne, produkt-neni-vazany-na-obor]
---

**Rozhodl majitel 17. 8. 2026** (session S0.7, postup v `docs/ODESILANI-DOMENA.md`).

| Otázka | Rozhodnutí |
|---|---|
| Odesílatel | **adresa přihlášeného uživatele** — `laub@cantinero.cz`, `sasek@cantinero.cz` |
| Doména | **nastavitelná per firma**, ne konstanta v kódu |
| Služba | **Resend** (bezplatné pásmo 100 zpráv/den pokryje deset denně z fáze 3) |
| DNS | Cloudflare, nastavuje majitel podle návodu |

**Nejdůležitější důsledek — doména je nastavení, ne konstanta.** Majitel to
zdůvodnil produktizací: *„protože se projekt bude dále prodávat, musí být
doména nastavitelná."* Až se bude implementovat odesílání (fáze 3), musí se
odesílací doména i adresa brát z nastavení zákazníka. Kdo to natvrdo zadrátuje,
zavírá cestu k prodeji systému.

**Podepsaná osoba (TP-10) je tím vyřešená:** podepsaný je ten, kdo zprávu
poslal, a odpovědi chodí jemu. Žádná neosobní schránka.

**Proč se nemusí sahat na stávající poštu:** viditelný odesílatel (`From`)
zůstane `@cantinero.cz`, ale technická zpáteční adresa (`Return-Path`) jde na
subdoménu `send.cantinero.cz` — a SPF se posuzuje podle ní. Dnešní SPF
s Forpsi (`include:_spf.forpsi.com`) tedy zůstává beze změny; druhý SPF
záznam na kořeni domény by byl chyba. Důvěryhodnost `From` řeší DKIM.

**Zjištěný stav DNS (17. 8.):** NS na Cloudflare, MX na Forpsi, SPF s Forpsi,
DMARC `p=quarantine` **bez adresy pro hlášení** — o problémech s doručováním
se dnes nikdo nedozví. Doplnit `rua=`.

**Zpřesnění dřívějšího tvrzení:** psal jsem, že zahřívání domény trvá týdny
a je to nejdelší lhůta přípravy. Platí to pro stovky zpráv denně; **při deseti
denně je to mírnější** — reputaci u takového objemu nezničí množství, ale
stížnosti.
