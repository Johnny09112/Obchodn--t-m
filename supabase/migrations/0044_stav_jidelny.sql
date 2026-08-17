-- Jídelna v provozu vs. jídelna v přípravě.
--
-- Požadavek majitele (17. 8. 2026): u jídelny má být vidět, jestli už jede,
-- nebo se teprve chystá — a podle toho se má rozdělit i volná kapacita na
-- „kolik můžeme prodat dnes" a „kolik budeme mít".
--
-- Proč nový sloupec a ne přetížení `aktivni`: `aktivni` rozhoduje, jestli se
-- jídelna vůbec používá — jestli se jí počítá dosah (src/dosah.ts) a jestli
-- na ni smí Čmuchal (src/cmuchal.ts). Jídelna v přípravě se používat MUSÍ,
-- právě sběrem firem v okolí se totiž připravuje. Jsou to dvě různé otázky:
--   aktivni = pracujeme s ní?        stav = má už co prodat?
--
-- Výchozí `v_provozu` schválně: zachovává dosavadní význam čísel. Kdyby se
-- výchozí stav nastavil na přípravu, spadl by součet volné kapacity na nulu
-- a vypadalo by to jako porucha. Které jídelny se teprve chystají, ví jen
-- majitel — přepne je na obrazovce Jídelny.

alter table jidelny
  add column stav text not null default 'v_provozu'
    check (stav in ('v_provozu', 'priprava'));

comment on column jidelny.stav is
  'v_provozu = kapacitu můžeme prodávat dnes; priprava = teprve se chystá, kapacita je potenciál';
