---
name: vizual-neni-samovysvetlujici
description: Majitel chce předělat vizuál aplikace — obrazovky nejsou na 100 % pochopitelné; re-design (S0.11) čeká na jeho signál
metadata:
  type: feedback
---

Majitel 19. 8. 2026 (po ladění objednávky rešerše): *„pamatuj, že chceme
předělat vizuál, protože to není na 100% pochopitelné."* Už předtím
17. 8. zmínil re-design přes Claude Design (S0.11).

**Why:** Obrazovky vznikaly funkčně po celcích a majitel se v nich musí
doptávat, co které číslo znamená (naposledy rozpad kontaktů vs. stav
rešerše na jedné obrazovce). Funkčnost je v pořádku, srozumitelnost ne.

**How to apply:** Re-design se spouští **na majitelův signál**, ne
samovolně. Do té doby: každý nový prvek stavět tak, aby se vysvětlil sám
(popisek u čísla, poznámka pod tlačítkem), a u dialogů nešetřit místem —
pop-up výběru rešerše se 19. 8. na jeho žádost zvětšoval o ~30 %
(`.dialog.vyber-reserse`). Až signál přijde, začít soupisem
nesrozumitelných míst, ne barvami.
