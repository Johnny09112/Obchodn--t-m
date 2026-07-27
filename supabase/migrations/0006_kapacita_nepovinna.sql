-- Volná kapacita jídelny přestává být podmínkou pro sběr dat.
--
-- Proč: kapacita neovlivňuje, které firmy se najdou, jak se obodují ani do
-- které zóny spadnou. Je to obchodní strop (SPEC kap. 2) — rozhoduje o tom,
-- KOLIK firem se smí oslovit, ne o tom, jestli se smí hledat.
--
-- Původní `not null default 0` navíc nutil vyplnit číslo i tam, kde ho nikdo
-- nezná, což vede k vymýšlení. NULL je poctivější: znamená „nevíme".
-- Tvrdou podmínkou se kapacita stane až ve fázi 3, u fronty na oslovení.

alter table jidelny alter column kapacita_volna drop not null;
alter table jidelny alter column kapacita_volna drop default;

-- Nuly vzniklé jen kvůli původní povinnosti převedeme na „nevíme".
update jidelny set kapacita_volna = null where kapacita_volna = 0;
