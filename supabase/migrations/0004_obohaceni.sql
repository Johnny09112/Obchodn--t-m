-- Kdy agent naposledy dohledával údaje k firmě na webu. Bez toho bychom
-- pořád dokola posílali k rešerši i firmy, u kterých se nic nenašlo.
-- NULL = ještě neproběhlo.
alter table companies add column obohaceno_at timestamptz;
