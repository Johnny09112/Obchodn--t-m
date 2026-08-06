# Fronta AI průzkumu — zadání

**Stav:** k odsouhlasení · **Datum:** 2026-08-06

> Navazuje na `docs/adr/0002-dve-vrstvy-a-nastavitelnost.md` (schváleno
> 2026-08-06) a na `docs/superpowers/specs/2026-08-03-dodatecne-rozsireni-kampane-design.md`
> (hotovo, nasazeno). Při rozporu platí `SPEC.md`.

## 1. K čemu to je

Majitel si dnes může objednat **průzkum** (sběr firem z rejstříků) tlačítkem
v aplikaci. **Rešerši agentem** si objednat nemůže — spouští se jen na
vyžádání v chatu, protože pro ni neexistuje fronta ani obsluha.

To je poslední místo, kde je majitel závislý na tom, že u toho někdo sedí
a píše do chatu. Kampaň nad Čachrovem má 91 firem a spojení nula z nich; bez
rešerše se ve fázi 3 neosloví nikdo.

## 2. Rozhodnutí majitele

- **Tlačítko v aplikaci**, ne jen fronta pro člověka s příkazovou řádkou
  (2026-08-04).
- **Agent smí běžet bez dozoru — ale jen po zmáčknutí tlačítka** (2026-08-06).
  Hlídka objednávku vyřídí; sama si žádnou nevymyslí. Žádný rozvrh.
- **Objednávka nese zadání, co hledat.** Příprava na profily produktu
  z ADR 0002 — teď se použije jedno výchozí zadání, ale cesta je hotová.
- **Vyřazené firmy se neposílají** (2026-08-04). Vyřazení už dnes znamená
  „tuhle neoslovovat"; pouštět na ni rešerši je zbytečná práce.
- **Ostrý provoz jede z předplatného**, ne přes API klíč (ADR 0002).

## 3. Co uvidí majitel

Ve 4. kroku průvodce, pod panelem čekajících firem, přibude druhá nabídka:

> **48 firem v kampani ještě rešerší neprošlo.**
> Průzkum u nich zabere zhruba 50 minut. Poběží na pozadí — okno můžete
> zavřít.
> `[ Poslat 20 firem na AI průzkum ]`  `[ všechny ]`

Výchozí dávka je **20 firem**; tlačítko „všechny" pošle zbytek. Po objednání
se řádek změní na stav objednávky, stejně jako u průzkumu:

> **AI průzkum běží** — 12 z 20 firem hotovo.
> Hlídka u hodin se na frontu dívá každých deset minut.

**Kdo se do fronty dostane:** firma je v kampani, není vyřazená, a nemá
razítko `obohaceno_at`. Tedy tytéž firmy, které ukazuje sloupec „neprošla"
(kap. 4).

## 4. Nové sloupce v seznamu firem

Majitel si vyžádal čtyři údaje (2026-08-04). Všechny jdou odvodit z dat,
migraci na ně nepotřebujeme:

| Sloupec | Odkud |
|---|---|
| **Prošla / neprošla** | `companies.obohaceno_at is null` |
| **Prošla, ale bez spojení** | prošla + žádný kontakt s e-mailem ani telefonem |
| **Kdy naposledy** | `obohaceno_at` |
| **Známe jednatele** | existuje kontakt s vyplněným příjmením |

Podle všech čtyř půjde filtrovat. „Prošla, ale bez spojení" je užitečná sama
o sobě: říká, které firmy **nemají webovou stopu**, a ty nemá smysl posílat
znovu.

## 5. Fronta

Nová tabulka `reserse`, postavená na vzoru `pruzkumy` (migrace 0018):

```sql
create table reserse (
  id uuid primary key default gen_random_uuid(),
  kampan_id uuid not null references kampane(id) on delete cascade,
  stav text not null default 'ceka' check (stav in ('ceka','bezi','hotovo','selhalo')),
  -- Kolik firem si z fronty vzít. Firmy se vybírají až při vyřízení, ne teď —
  -- objednávka tak nemůže zestárnout, když se kampaň mezitím změní.
  firem_zadano int not null check (firem_zadano > 0),
  -- Co hledat. Vkládá aplikace; po zavedení profilů produktu (ADR 0002)
  -- ho bude skládat profil kampaně. Výchozí hodnota viz kap. 5.1.
  zadani text not null,
  pozadal text not null,
  pozadano_at timestamptz not null default now(),
  zahajeno_at timestamptz,
  dokonceno_at timestamptz,
  run_id uuid references agent_runs(id),
  firem_zpracovano int,
  firem_s_nalezem int,
  chyba text,
  constraint selhani_ma_chybu check (stav <> 'selhalo' or chyba is not null)
);

create index reserse_fronta_idx on reserse (stav, pozadano_at);
```

Pravidla přístupu stejná jako u `pruzkumy` — zapisovat smí správce kampaně,
jeho zástup a admin (`smi_do_kampane`).

### 5.1 Co je v `zadani`

Zatím jediná hodnota, kterou aplikace vkládá:

> Dohledej u každé firmy kontaktní osobu a spojení na ni podle svého
> playbooku. Nic navíc nesbírej.

Je to schválně **odkaz na playbook, ne jeho kopie.** Playbook si Čmuchal
upravuje sám po každém běhu; kdyby se sem opsal, začal by za týden lhát.
Sloupec existuje proto, aby šlo zadání jednou nahradit profilem produktu —
ne proto, aby se tu už teď psalo něco vlastního.

## 6. Kdo objednávku vyřídí — a proč je to jiné než u průzkumu

**Průzkum vyřizuje kód.** Hlídka spustí `npm run cli -- pruzkum obsluz`
a ten udělá práci sám.

**Rešerši dělá agent.** Nový příkaz `reserse obsluz` proto práci nedělá —
**spustí Claude Code v neinteraktivním režimu** a počká na něj:

```
claude -p "<zadání objednávky>" --agent cmuchal --output-format json
```

Ověřeno 2026-08-06: Claude Code 2.1.220 je na majitelově počítači nainstalovaný
a všechny tři přepínače existují.

Krok za krokem:

1. `reserse obsluz` vezme z fronty nejstarší čekající objednávku a zamkne ji
   **stávajícím zámkem `ZAMEK_CMUCHAL`** — tím samým, který používá průzkum.
   Je to záměr: obojí dělá Čmuchal, obojí chodí na cizí weby, a běžet naráz
   by znamenalo dvojí zátěž na tytéž zdroje. **Důsledek: dlouhá rešerše
   pozdrží průzkum a naopak.** Při dávce 20 firem jde o desítky minut, což je
   přijatelné; kdyby to začalo vadit, je to důvod zavést druhý zámek, ne
   překvapení.
2. Vybere firmy: v kampani, nevyřazené, bez razítka `obohaceno_at`, nejvýš
   `firem_zadano`, seřazené podle skóre sestupně.
3. Zapíše je do souboru v `data/` a spustí Claude Code s odkazem na ten soubor
   a se `zadani` z objednávky.
4. Počká na doběhnutí, přečte výsledek, uzavře objednávku a spočítá, u kolika
   firem přibylo spojení.
5. Do hlídky se přidá vedle `pruzkum obsluz`, aby se fronta obsluhovala
   společně s tou stávající.

### Meze, které musí být v kódu

- **Časový strop.** Naměřeno **64 s na firmu** ([[resurse-agentem-zmereno]]),
  takže 20 firem ≈ 21 minut. Strop je **dvojnásobek** toho odhadu, tedy
  `firem_zadano × 128 s`, a nejméně 10 minut. Po jeho vypršení se běh ukončí
  a objednávka spadne do `selhalo` s čitelnou chybou. Bez toho by zaseknutá
  objednávka držela zámek napořád — a s ním i průzkum.
- **Omezené nástroje.** Agent dostane přes `--allowedTools` jen to, co
  potřebuje: hledání a čtení webu, čtení souborů, zápis do pracovního souboru,
  a z příkazové řádky **jen dva příkazy** — `k-obohaceni` a `zapis-nalezy`.
  Nic jiného spustit nesmí.
- **Chybějící Claude Code** (neinstalovaný, nepřihlášený) musí skončit
  čitelnou chybou v objednávce, ne tichým zaseknutím.

## 7. Co drží bezpečnost

Poběží to bez dozoru, takže mantinely nesmějí stát na slibu v promptu:

- **Každý zápis prochází `zapis-nalezy`**, které vyžaduje `zdroj_url`
  a doslovnou citaci (TP-2) a odmítá atributy mimo whitelist (TP-3). Co agent
  nedoloží, neprojde — bez ohledu na to, co si model myslí.
- **Agent nemá nástroj k odesílání** a `system_state.sending_enabled` zůstává
  vypnuté (TP-8).
- **Běh se zapisuje do `agent_runs`** (TP-13); objednávka na něj drží `run_id`.
- **Objednávku zakládá jen člověk** zmáčknutím tlačítka.

**Riziko, které tím nezmizí:** když se agent splete způsobem, který kontrola
nechytí — třeba doloží kontakt citací, která patří jiné firmě — zapíše se to
a nikdo si toho hned nevšimne. Majitel o tom ví a rozhodl se do toho jít
(2026-08-06). Proto ta první verze **neběží podle rozvrhu**: každá dávka má
za sebou lidské rozhodnutí a je vidět v seznamu objednávek.

## 8. Oznámení

Po doběhnutí se ozve bublina u hodin, stejně jako u průzkumu — text skládá
jádro, hlídka ho jen zobrazí ([[oznameni-u-hodin]]):

> Cantinero — AI průzkum hotov
> Firmy Čachrov: 20 firem, spojení přibylo u 17.

## 9. Co se nemění

- **Nic se neodesílá** (TP-8).
- Whitelist dál omezuje, co smí do zprávy (SPEC kap. 5 po změně z ADR 0002).
- Sociální sítě zůstávají zakázané.
- Vyřazené firmy se nevzkřísí ani rešerší.
- Schválená kampaň se nemění — objednat rešerši v ní nejde.

## 10. Testy

Čistý výpočet, offline, v `test/reserse-fronta.test.ts`:

1. Objednávka se založí ve stavu `ceka`.
2. **Do dávky se nedostane vyřazená firma** — i když nemá `obohaceno_at`.
3. **Do dávky se nedostane firma s razítkem `obohaceno_at`** — ta už prošla.
4. Dávka respektuje `firem_zadano` a řadí podle skóre sestupně.
5. Dvě objednávky nad toutéž kampaní si neberou tytéž firmy.
6. Objednávka bez čekajících firem skončí rovnou `hotovo`, ne `bezi`.
7. Selhání zapíše `chyba` — podmínka v databázi to jinak nepustí.

Spuštění Claude Code se v testech **neprovádí**; závislost se předá jako
parametr a v testech se nahradí. Testovat se má výběr firem a přechody stavů,
ne to, že jde spustit cizí program.

## 11. Co znamená „hotovo"

1. `npm test` a `npm run typecheck` zeleně.
2. `npm run build --prefix app` projde.
3. **Migrace nasazená** (`npm run cli -- migrate`).
4. **Proklikáno v prohlížeči** — objednávka se založí, řádek ukáže stav.
5. **Jedna dávka doopravdy proběhne** na malém vzorku (Hrobce, 5 firem)
   a v kartotéce po ní přibydou kontakty se zdrojem a citací.

## 12. Co tahle práce neřeší

- **Profily produktu** (ADR 0002 bod 3). Objednávka nese `zadani` jako text;
  že ho jednou bude skládat profil kampaně, je připravené, ne hotové.
- **Cestu přes API klíč.** Poběží z předplatného, jak majitel rozhodl.
- **Rozvrh.** Hlídka objednávku vyřídí, ale sama žádnou nezakládá.
- **Vrstvu A** (širší sběr). Agent zatím hledá totéž co dnes; rozšíření toho,
  co smí sbírat, je vlastní práce po zavedení profilů.
