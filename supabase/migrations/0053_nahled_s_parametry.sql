-- Náhled zprávy potřebuje i parametry jídelny, která firmu obsluhuje.
--
-- Bez nich se nedají vyhodnotit podmíněné věty (migrace 0052): věta
-- o jídlonosičích se má ukázat jen tam, kde je jídelna umí vydat.
--
-- Když je jídelen v dosahu víc, bere se **ta nejbližší** — podle ní se
-- počítá i vzdálenost, takže zpráva mluví celou dobu o jedné jídelně.
-- Míchat vzdálenost od jedné a možnosti výdeje od druhé by dalo větu,
-- která je po částech pravdivá a jako celek ne.

-- Přibyl sloupec, a to `create or replace` neumí („cannot change return
-- type of existing function"). Proto se stará funkce zahodí a založí znovu.
drop function if exists public.nahled_kampane(uuid);

create function public.nahled_kampane(p_kampan_id uuid)
returns table (
  ico text,
  nazev text,
  chybi text[],
  prijmeni text,
  oznaceni text,
  vzdalenost_m int,
  cena text,
  parametry jsonb
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  povinna text[];
  ceny int[];
  nejnizsi int;
  cena_text text;
begin
  select array_agg(p.kod) into povinna
    from pole_sablony p
    join kampane k on k.template_id = p.template_id
   where k.id = p_kampan_id and p.povinne;

  if povinna is null then
    select array_agg(distinct p.kod) into povinna
      from pole_sablony p
      join templates t on t.id = p.template_id
     where t.stav = 'schvaleno' and p.povinne;
  end if;
  povinna := coalesce(povinna, '{}');

  select array_agg(distinct (co.hodnota::numeric + coalesce(pr.hodnota::numeric, 0))::int)
    into ceny
    from kampan_oblasti ko
    join oblast_firmy o on o.oblast_id = ko.oblast_id
    join dosah d on d.ico = o.ico and d.v_zone
    join jidelny j on j.id = d.jidelna_id
    join parametry_nabidky pco
      on pco.kod = 'cena_obeda' and pco.produkt_kod = 'cantinero'
    join hodnoty_parametru co
      on co.nabidka_id = j.nabidka_id and co.parametr_id = pco.id
    left join parametry_nabidky ppr
      on ppr.kod = 'provize' and ppr.produkt_kod = 'cantinero'
    left join hodnoty_parametru pr
      on pr.nabidka_id = j.nabidka_id and pr.parametr_id = ppr.id
   where ko.kampan_id = p_kampan_id;

  if ceny is null or array_length(ceny, 1) is null then
    cena_text := null;
  else
    select min(x) into nejnizsi from unnest(ceny) as x;
    cena_text := case when array_length(ceny, 1) = 1 then '' else 'od ' end
                 || nejnizsi || ' Kč';
  end if;

  return query
  select c.ico,
         c.nazev,
         (
           case when not exists (select 1 from contacts k
                                  where k.ico = c.ico and k.email is not null and k.email <> '')
                then array['není kam napsat — chybí e-mail'] else '{}' end
           || case when 'od_vasi_firmy' = any (povinna)
                    and not exists (select 1 from evidence e
                                     where e.ico = c.ico and e.atribut = 'obor')
                then array['chybí obor — nevíme, jak firmu pojmenovat'] else '{}' end
           || case when 'vzdalenost' = any (povinna)
                    and not exists (select 1 from dosah d where d.ico = c.ico and d.v_zone)
                then array['není spočítaná vzdálenost k jídelně'] else '{}' end
           || case when 'cena' = any (povinna)
                    and not exists (
                      select 1 from dosah d
                        join jidelny j on j.id = d.jidelna_id
                        join parametry_nabidky p
                          on p.kod = 'cena_obeda' and p.produkt_kod = 'cantinero'
                        join hodnoty_parametru h
                          on h.nabidka_id = j.nabidka_id and h.parametr_id = p.id
                       where d.ico = c.ico and d.v_zone)
                then array['u jídelny v dosahu není vyplněná cena'] else '{}' end
         )::text[] as chybi,
         (select k.prijmeni from contacts k
           where k.ico = c.ico and k.email is not null and k.email <> ''
           order by (k.prijmeni is null) limit 1) as prijmeni,
         (select e.hodnota from evidence e
           where e.ico = c.ico and e.atribut = 'oznaceni' limit 1) as oznaceni,
         (select min(d.vzdalenost_m)::int from dosah d
           where d.ico = c.ico and d.v_zone) as vzdalenost_m,
         cena_text as cena,
         -- Parametry nejbližší jídelny v dosahu.
         coalesce((
           select jsonb_object_agg(p.kod, h.hodnota)
             from dosah d
             join jidelny j on j.id = d.jidelna_id
             join hodnoty_parametru h on h.nabidka_id = j.nabidka_id
             join parametry_nabidky p on p.id = h.parametr_id
            where d.ico = c.ico and d.v_zone
              and d.vzdalenost_m = (select min(d2.vzdalenost_m) from dosah d2
                                     where d2.ico = c.ico and d2.v_zone)
         ), '{}'::jsonb) as parametry
    from (select distinct c2.ico, c2.nazev
            from kampan_oblasti ko
            join oblast_firmy o on o.oblast_id = ko.oblast_id
            join companies c2 on c2.ico = o.ico
           where ko.kampan_id = p_kampan_id) c
   order by c.nazev;
end $$;
