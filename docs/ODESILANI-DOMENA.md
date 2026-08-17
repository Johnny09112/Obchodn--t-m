# S0.7 — Odesílací doména a podepsaná osoba

> Stav: **připraveno k provedení** (17. 8. 2026). Odesílání je pořád vypnuté
> (TP-8) a tenhle krok na tom nic nemění — jen připravuje doménu, aby byla
> důvěryhodná, až se odesílat začne.

## Co se rozhodlo (majitel, 17. 8. 2026)

| Otázka | Rozhodnutí |
|---|---|
| Z jaké adresy se posílá | **Z adresy přihlášeného uživatele** — `laub@cantinero.cz`, `sasek@cantinero.cz` |
| Doména | **Nastavitelná per firma** — systém se bude prodávat, takže odesílací doménu si určuje každý zákazník sám |
| Kdo nastaví DNS | Majitel podle tohohle návodu (Cloudflare) |
| Čím se odesílá | **Resend** |

**Podepsaná osoba podle TP-10 je tím vyřešená**: pod zprávou je podepsaný ten,
kdo ji poslal, a odpovědi chodí jemu. Žádná neosobní schránka.

## Jak to bude fungovat

Zpráva má **dvě adresy**, a to je důvod, proč se nemusí sahat na dnešní poštu:

- **Viditelný odesílatel (`From`)** — `laub@cantinero.cz`. To vidí příjemce
  a na to odpovídá.
- **Technická zpáteční adresa (`Return-Path`)** — `send.cantinero.cz`. Sem
  chodí zprávy o nedoručení a podle ní se posuzuje SPF.

Proto se **stávající SPF záznam nemění**. Dnešní `v=spf1 a mx
include:_spf.forpsi.com ~all` platí dál pro poštu na Forpsi; Resend si vezme
vlastní subdoménu `send`. Kdyby se místo toho přidával `include:amazonses.com`
do kořenového SPF, sahalo by se do záznamu, na kterém stojí veškerá firemní
pošta — zbytečné riziko.

Důvěryhodnost `From` adresy zajistí **DKIM podpis** vydaný pro `cantinero.cz`.

## Dnešní stav DNS (ověřeno 17. 8. 2026)

| Záznam | Hodnota | Co s ním |
|---|---|---|
| NS | `dee.ns.cloudflare.com`, `walt.ns.cloudflare.com` | DNS je na Cloudflare ✅ |
| MX | `mxavas.forpsi.com` (10) | pošta běží na Forpsi — **neměnit** |
| TXT (SPF) | `v=spf1 a mx include:_spf.forpsi.com ~all` | **neměnit** |
| TXT `_dmarc` | `v=DMARC1; p=quarantine` | doplnit adresu pro hlášení (níž) |

## Postup

### 1. Založit účet v Resendu

<https://resend.com> → Sign up. Bezplatné pásmo je **100 zpráv denně a 3 000
měsíčně**; fáze 3 počítá s deseti denně, takže se do něj vejdeme s rezervou.
Platit se nebude nic, dokud objem nevyroste.

### 2. Přidat doménu

V Resendu **Domains → Add Domain** → `cantinero.cz`, region **EU (Ireland)**
— data zůstanou v Evropě, což se hodí i k GDPR argumentaci ve fázi 3.

Resend vypíše tři záznamy. **Konkrétní hodnoty se generují pro váš účet**,
takže je nelze předepsat dopředu — opíšou se z obrazovky. Tvar bude tento:

| Typ | Název | Hodnota | Poznámka |
|---|---|---|---|
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | priorita 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | |
| TXT | `resend._domainkey` | `p=…` (dlouhý klíč) | DKIM |

### 3. Vložit je do Cloudflare

DNS → Records → Add record. Tři věci, na kterých to nejčastěji ztroskotá:

1. **Do políčka „Name" patří jen `send`, ne `send.cantinero.cz`.** Cloudflare
   si doménu doplní sám — jinak vznikne `send.cantinero.cz.cantinero.cz`.
2. **Proxy musí být vypnutá** (šedý mráček, „DNS only"). Oranžový mráček
   znamená, že Cloudflare záznam přepisuje, a ověření domény pak nikdy
   neprojde.
3. **Stávající SPF a MX nechte být.** Nepřidávejte druhý TXT se `v=spf1` na
   kořen domény — dva SPF záznamy na jedné doméně jsou chyba a pošta začne
   padat do spamu.

### 4. Ověřit

V Resendu **Verify**. Trvá to obvykle minuty; Cloudflare mění DNS rychle.

### 5. Doplnit adresu pro hlášení do DMARC

Dnešní `v=DMARC1; p=quarantine` funguje, ale **nikam neposílá hlášení**, takže
se o problému s doručováním nedozvíte. Upravte TXT `_dmarc` na:

```
v=DMARC1; p=quarantine; rua=mailto:dmarc@cantinero.cz; pct=100; adkim=r; aspf=r
```

Adresu `dmarc@cantinero.cz` je potřeba mít funkční (stačí přesměrování do
existující schránky). Hlášení chodí jednou denně jako XML od velkých
poskytovatelů — číst se dají nástrojem, nebo je stačí archivovat pro případ
sporu.

> `p=quarantine` je přísnější nastavení: nevyhovující zpráva jde rovnou do
> spamu. Do doby, než je DKIM ověřený, tedy **neposílejte nic** — skončilo by
> to ve spamu a poškodilo to reputaci.

### 6. Zkušební zpráva

Až Resend ukáže doménu jako ověřenou, pošlete jednu zprávu **sami sobě** na
schránku u jiného poskytovatele (Gmail, Seznam) a v hlavičce zkontrolujte,
že `SPF=pass`, `DKIM=pass` a `DMARC=pass`. Gmail to ukáže přes „Zobrazit
originál".

## Zahřívání — poctivé zpřesnění

Dřív jsem psal, že zahřívání trvá týdny a je to nejdelší lhůta v přípravě.
Platí to pro rozesílání ve stovkách a tisících zpráv denně. **Při deseti
zprávách denně je situace mírnější** — takový objem sám o sobě žádný poplach
nespustí. Co pořád platí:

- doména potřebuje **nějakou** historii, než jí velcí poskytovatelé začnou
  věřit; první zprávy mají větší šanci skončit v přehlédnutých složkách,
- reputaci nezničí objem, ale **stížnosti** — proto TP-5 (jedna firma = jedno
  oslovení) a proto se prvních 50 zpráv schvaluje ručně,
- nastavit doménu teď má smysl i tak: až se rozhodne odesílat, nebude se čekat
  vůbec na nic.

## Co zůstává na později

- **Nastavitelnost domény per firma** — vyplynula z rozhodnutí majitele
  a je to podmínka produktizace. Dnes se nic neimplementuje; až bude
  odesílání na řadě (fáze 3), musí se doména vzít z nastavení zákazníka,
  ne z konstanty v kódu. Zapsáno v paměti jako rozhodnutí.
- **Vlastní implementace odesílání** — TP-8 platí: `sending_enabled` je
  `false` a žádný kód fáze 0–2 odesílání implementovat nesmí.
