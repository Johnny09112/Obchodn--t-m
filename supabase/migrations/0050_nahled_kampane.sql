-- Podklady pro náhled zprávy — jedním dotazem pro jádro i obrazovku.
--
-- Vrací pro každou firmu v kampani: co jí chybí do oslovení a údaje, ze
-- kterých se skládá text (příjmení, krátké označení, vzdálenost, cena).
--
-- **Proč v databázi, a ne v TypeScriptu:** pravidlo „co firmě chybí" musí
-- platit stejně pro příkazovou řádku i pro obrazovku kampaně, a obrazovka
-- na jádro nedosáhne (Vercel instaluje jen závislosti `app/`). Dvě
-- implementace téhož pravidla by se rozešly a každá by tvrdila jiný počet
-- oslovitelných firem. Past: paměť „pravidlo-v-jadru-nehlida-obrazovku".
--
-- Samotné **skládání textu** v databázi není — to dělá `src/text-zpravy.ts`,
-- který je čistý a importuje si ho jádro i aplikace. Dělící čára je
-- schválně tady: data a pravidla do SQL, čeština do TypeScriptu.

create or replace function public.nahled_kampane(p_kampan_id uuid)
returns table (
  ico text,
  nazev text,
  chybi text[],
  prijmeni text,
  oznaceni text,
  vzdalenost_m int,
  cena text
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
  -- Povinná pole šablony kampaně; bez vybrané šablony se ustoupí na
  -- schválenou, ať přehled netvrdí, že je připravená každá firma.
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

  -- Cena = cena oběda + provize, nejnižší z dotčených jídelen; při rozdílu
  -- s předřazeným „od" (rozhodl majitel 18. 8. 2026).
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
           -- E-mail není pole šablony, a přesto vyřazuje: bez adresy není
           -- kam napsat. Je to podmínka odeslání, ne údaj ve zprávě.
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
         cena_text as cena
    from (select distinct c2.ico, c2.nazev
            from kampan_oblasti ko
            join oblast_firmy o on o.oblast_id = ko.oblast_id
            join companies c2 on c2.ico = o.ico
           where ko.kampan_id = p_kampan_id) c
   order by c.nazev;
end $$;

comment on function public.nahled_kampane is
  'Podklady pro náhled zprávy: co firmě chybí do oslovení a čím se vyplní pole.';
