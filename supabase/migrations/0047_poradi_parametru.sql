-- Nový parametr patří na konec seznamu, ne na jeho začátek.
--
-- Objeveno proklikáním 18. 8. 2026, hned po 0046: parametr zavedený
-- z obrazovky Jídelny skočil nad Cenu oběda. Důvod je tentýž jako
-- u kontroly hodnot — `zavedParametr` v `src/parametry.ts` pořadí
-- dopočítává, jenže obrazovka zapisuje do Supabase přímo a na jádro
-- nedosáhne. Výchozí nula ji poslala na první místo.
--
-- Pravidlo proto sedí v databázi, tedy tam, kudy musí projít každý zápis.
-- Výslovně zadané pořadí se nepřepisuje: migrace 0045 si tak zakládá
-- výchozí čtyři parametry v pořadí, které jim patří.

create or replace function public.poradi_noveho_parametru()
returns trigger language plpgsql as $$
begin
  if new.poradi is null or new.poradi = 0 then
    select coalesce(max(poradi), 0) + 1 into new.poradi
      from parametry_nabidky where produkt_kod = new.produkt_kod;
  end if;
  return new;
end $$;

create trigger parametry_nabidky_poradi
  before insert on parametry_nabidky
  for each row execute function public.poradi_noveho_parametru();
