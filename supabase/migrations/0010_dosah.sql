-- Firma může být v dojezdové zóně VÍC jídelen zároveň.
--
-- Dosud držel `companies.nejblizsi_jidelna_id` jedinou jídelnu — a ve
-- skutečnosti to nebyla ta nejbližší, ale ta, která firmu našla jako první.
-- Přiřazení se po založení nikdy nepřepočítalo.
--
-- Rozhodnutí majitele (2026-07-28): firmu mezi sebou nepřeřazovat, ale
-- zaznamenat, že ji mají v dosahu obě, a do statistiky každé jídelny ji
-- započítat. Jde o obchodní potenciál oblasti, ne o vlastnictví firmy.
--
-- Zbůch a Tlučná jsou od sebe 5 km a obě mají zónu 3 km, takže pruh mezi
-- nimi patří oběma. Zatím v něm žádná firma neleží — ale bude.
--
-- `companies.nejblizsi_jidelna_id` zůstává jako zařazení do kartotéky, aby
-- v plochém seznamu nebyla firma dvakrát. Pravda o dosahu je tady.

create table dosah (
  ico text not null references companies(ico) on delete cascade,
  jidelna_id uuid not null references jidelny(id) on delete cascade,
  vzdalenost_m int not null check (vzdalenost_m >= 0),
  v_zone boolean not null,                 -- vejde se do zóny právě téhle jídelny
  zjisteno_at timestamptz not null default now(),
  primary key (ico, jidelna_id)
);

comment on table dosah is
  'Které jídelny mají firmu v dosahu. Firma smí patřit víc jídelnám zároveň.';

create index dosah_jidelna_idx on dosah (jidelna_id) where v_zone;
