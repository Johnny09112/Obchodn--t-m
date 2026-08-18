---
name: reserse-i-bez-jidelny
description: Rešerše smí i na firmy bez jídelny v dosahu — data se předpřipravují, tvrdá zábrana je až u odeslání
type: decision
status: active
created: 2026-08-18
updated: 2026-08-18
related: [pravidlo-v-jadru-nehlida-obrazovku, firma-bez-razitka-se-vraci-navzdy]
---

**Rozhodl majitel 18. 8. 2026 večer** a ruší tím přísnější pravidlo
z 13. 8. („na firmy čekající na jídelnu se agentní čas nevydává"):

> „Mohu dělat research i bez jídelny — až v případě odeslání e-mailu
> nebude kam, tam se to musí zastavit. Ale předpřipravit data si
> v oblasti přeci mohu."

**Co platí od teď** (migrace 0055, funkce `firmy_pro_reserse`):

| Filtr fronty rešerše | Stav |
|---|---|
| jen vybrané firmy kampaně | beze změny |
| bez razítka `obohaceno_at` | beze změny |
| méně než 3 pokusy | beze změny |
| `zamitnuty` | dál zakázaný — „tuhle neoslovovat" (4. 8.) |
| `cekajici_na_jidelnu` | **nově povolený** |

**Kde zůstává tvrdá zábrana:** u oslovení. Firma bez jídelny nemá
vzdálenost ani cenu, takže ji `nahled_kampane` vyřadí z kroku „Zpráva"
sama — připravit data jde, napsat ne. Nic dalšího se stavět nemuselo.

**Kontext, proč se to změnilo:** týž den se ukázalo, že objednávka
rešerše nad Hrobcemi (61 firem, všechny čekající na jídelnu) skončila
„hotovo, 0 firem". Napřed se opravilo mlčení obrazovky (0054), pak
majitel přehodnotil samotné pravidlo. Hrobce mají po změně 26 firem
ve frontě.
