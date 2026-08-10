# Záloha razítek `companies.obohaceno_at` před resetem — 7. 8. 2026

Deset firem kampaně Hrobce, u kterých agent při rešerši stál na jejich
**vlastním webu**. Razítko se maže, aby šly znovu do dávky s nově zapnutými
atributy `obor` a `web` (migrace 0038 a 0039).

**Maže se jen razítko.** Nálezy, kontakty ani evidence se nemažou.

| IČO | Firma | Původní `obohaceno_at` |
|---|---|---|
| 06943586 | EVS Reality s.r.o. | 2026-08-07 15:49 |
| 27276554 | GEOVIA s.r.o. | 2026-08-07 15:49 |
| 01535293 | Gusto Energy s.r.o. | 2026-08-06 14:02 |
| 22798188 | Josef Klement s.r.o. | 2026-08-07 15:49 |
| 19304340 | LUMSENSPRO s.r.o. | 2026-08-06 14:02 |
| 00263664 | Obec Hrobce | 2026-08-07 15:49 |
| 00526070 | Obec Oleško | 2026-08-07 15:49 |
| 00526479 | Obec Židovice | 2026-08-07 15:49 |
| 28750110 | PLUSPAP a.s. | 2026-08-06 14:02 |
| 28685351 | Stavební stroje a doprava, s.r.o. | 2026-08-07 15:49 |

Vrácení zpět, kdyby bylo potřeba:

```sql
update companies set obohaceno_at = '2026-08-07 15:49' where ico in
  ('06943586','27276554','22798188','00263664','00526070','00526479','28685351');
update companies set obohaceno_at = '2026-08-06 14:02' where ico in
  ('01535293','19304340','28750110');
```

Časy jsou zaokrouhlené na minuty — přesnou hodnotu na sekundy už databáze
po resetu nemá. Pro účel „firma už rešerší prošla" to stačí.
