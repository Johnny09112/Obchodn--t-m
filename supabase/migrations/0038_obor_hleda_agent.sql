-- Obor podnikání: agent ho smí hledat.
--
-- Proč: `obor` má v ARESu kód činnosti (cz_nace), a ten stačí na filtrování
-- podle profilu (`oborProchazi`). Na oslovení firmy ale kód činnosti
-- nestačí — do zprávy jde `obor` jako čitelná věta ("čím se firma živí"),
-- a tu kód nedá. Dřív měl `obor` `hleda_agent = false`, takže se do pole
-- `chybi` (viz `firmyKObohaceni`) nikdy nedostal a agent neměl svolení ho
-- zapsat, i když stál přímo na firemním webu, kde to stálo napsané.
--
-- Popis se přepisuje zároveň, protože jde rovnou agentovi do zadání
-- (`atributy.popis`, viz komentář v 0035_atributy.sql) — dosavadní znění
-- neříkalo, KDE hledat, jen CO zjistit.
update atributy
set hleda_agent = true,
    popis = 'čím se firma živí — krátká věta vlastními slovy, ne opsaný ' ||
            'marketingový slogan; hledej v sekci „o nás“, v nabídce služeb ' ||
            'nebo na úvodní stránce webu'
where kod = 'obor';
