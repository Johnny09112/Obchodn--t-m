-- Krátké označení firmy — jedno slovo, kterým firma sama sebe nazývá.
--
-- Proč: věta oslovení zní „pár minut od Vaší truhlárny". Uložený `obor` je
-- ale popisná věta pro člověka („Bezpečnostní agentura poskytující ochranu
-- osob a majetku a komplexní úklidové služby."), takže se do té vazby
-- nedá vložit. Změřeno 18. 8. 2026: z 91 firem s doloženým oborem šla
-- vyskloňovat jediná.
--
-- **Pojistka proti špatnému slovu** (upozornil na ni majitel týž den):
-- agent tohle slovo NEVYMÝŠLÍ, jen ho opisuje. Popis níž mu ukládá vzít
-- výraz, kterým se firma označuje sama, a doložit ho doslovnou citací —
-- stejně jako každý jiný atribut (TP-2). Když se firma nikde krátce
-- nepojmenuje, atribut zůstane prázdný a věta ustoupí na „od Vás".
-- Vymyšlené označení je horší než žádné: „od Vaší truhlárny" firmě, která
-- se považuje za nábytkářství, je drobná urážka hned v první větě.

insert into atributy (kod, nazev, popis, do_zpravy, hleda_agent)
values (
  'oznaceni',
  'krátké označení firmy',
  'JEDNO podstatné jméno v prvním pádě, kterým firma sama sebe nazývá — truhlárna, pekárna, autoservis, lékárna, penzion. Opiš ho z webu firmy doslova, NEVYMÝŠLEJ ho a neodvozuj z oboru: do citace patří věta, ve které se firma takhle označuje (například „Naše truhlárna vyrábí nábytek na míru"). Když se firma nikde jedním slovem nepojmenuje, atribut vynech — prázdno je lepší než tvůj odhad.',
  true,
  true
);

insert into profil_atributy (profil_kod, atribut_kod)
values ('cantinero', 'oznaceni');
