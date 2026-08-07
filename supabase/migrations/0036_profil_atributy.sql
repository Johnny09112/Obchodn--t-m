-- Co který profil o firmě zjišťuje, a který profil kampaň používá.

create table profil_atributy (
  profil_kod text not null references profily(kod) on delete cascade,
  atribut_kod text not null references atributy(kod) on delete restrict,
  primary key (profil_kod, atribut_kod)
);

-- Oba dnešní profily dostanou všech osm — dosavadní chování se tím nemění.
insert into profil_atributy (profil_kod, atribut_kod)
select p.kod, a.kod from profily p cross join atributy a;

-- Profil kampaně. NULL = použij globálně aktivní, takže stávající kampaně
-- fungují dál beze změny.
--
-- Dvě mechaniky vedle sebe jsou ZÁMĚR: sběr běží nad územím, kde kampaň
-- ještě není, takže musí mít globální profil. Rešerše naopak běží uvnitř
-- kampaně, a tam má rozhodovat ona.
alter table kampane add column profil_kod text references profily(kod) on delete set null;

-- RLS jako u `atributy` — a ze stejného důvodu. `0015_rls.sql` zapnul RLS
-- jednorázově na tabulkách, které tehdy existovaly; každá pozdější migrace
-- si to musí udělat sama (viz 0018, 0022, 0034).
alter table profil_atributy enable row level security;

create policy profil_atributy_cteni on profil_atributy
  for select to authenticated using (true);

create policy profil_atributy_zapis on profil_atributy
  for all to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin'))
  with check (public.role_uzivatele() in ('super-admin', 'admin'));

comment on column kampane.profil_kod is
  'Profil produktu kampaně. NULL = globálně aktivní profil.';
