-- Hodnota parametru se kontroluje v databázi, ne jen v kódu.
--
-- Objeveno proklikáním 18. 8. 2026, den po nasazení 0045: do ostré
-- databáze šlo uložit cenu **−5 Kč**. Kontrola `zkontrolujHodnotu` sedí
-- v `src/parametry.ts`, jenže obrazovka Jídelny zapisuje do Supabase
-- přímo a na kořenové zdroje nedosáhne (Vercel instaluje jen závislosti
-- `app/`). Obrazovka tedy neměla žádnou pojistku.
--
-- Opsat kontrolu do aplikace by znamenalo třetí kopii téhož pravidla —
-- a tahle past už si v projektu vybrala svou daň (viz paměť
-- „tri-kopie-seznamu-atributu"). Pravidlo proto sedí tam, kudy musí projít
-- každý zápis: v databázi. Kód i obrazovka si smějí kontrolovat dopředu
-- kvůli rychlé odezvě, ale zárukou je tohle.
--
-- Hlášky jsou česky schválně: aplikace je ukazuje uživateli tak, jak
-- přijdou, takže tady vzniká text, který uvidí člověk.

create or replace function public.zkontroluj_hodnotu_parametru()
returns trigger language plpgsql as $$
declare
  p record;
  cislo numeric;
  volba text;
begin
  select kod, nazev, druh, moznosti into p
    from parametry_nabidky where id = new.parametr_id;

  if not found then
    raise exception 'Parametr neexistuje.';
  end if;

  if p.druh = 'cislo' then
    begin
      cislo := replace(btrim(new.hodnota), ',', '.')::numeric;
    exception when others then
      raise exception '„%" má být číslo, ne „%".', p.nazev, new.hodnota;
    end;
    if cislo < 0 then
      raise exception '„%" nemůže být záporné.', p.nazev;
    end if;

  elsif p.druh = 'ano_ne' then
    if new.hodnota not in ('ano', 'ne') then
      raise exception '„%" je ano, nebo ne — ne „%".', p.nazev, new.hodnota;
    end if;

  elsif p.druh = 'vyber' then
    -- Hodnota je JSON pole; každá volba musí být v nabídce parametru.
    -- Prázdný výběr je platný — znamená „zatím nevíme, co umíme".
    for volba in
      select jsonb_array_elements_text(new.hodnota::jsonb)
    loop
      if not (volba = any (p.moznosti)) then
        raise exception '„%" nezná volbu „%".', p.nazev, volba;
      end if;
    end loop;

  elsif p.druh = 'text' then
    if char_length(new.hodnota) > 200 then
      raise exception '„%" má být kratší než 200 znaků.', p.nazev;
    end if;
  end if;

  return new;
end $$;

create trigger hodnoty_parametru_kontrola
  before insert or update on hodnoty_parametru
  for each row execute function public.zkontroluj_hodnotu_parametru();

-- Úklid po chybě: hodnoty, které se stihly uložit, než pojistka vznikla.
-- Konkrétně cena −5 Kč u ZŠ a MŠ Hrádek, zapsaná při proklikávání.
delete from hodnoty_parametru h
 using parametry_nabidky p
 where p.id = h.parametr_id
   and p.druh = 'cislo'
   and (h.hodnota !~ '^-?[0-9]+([.,][0-9]+)?$' or replace(h.hodnota, ',', '.')::numeric < 0);
