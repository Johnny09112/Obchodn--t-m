/**
 * Obrazovka pro nasazení, kterému chybí nastavení databáze.
 *
 * Ukazuje se **místo celé aplikace**, ne uvnitř ní — dřív, než se cokoli
 * zeptá databáze. Kdyby se to řešilo až uvnitř, uživatel by koukal na
 * nekonečné načítání a nevěděl proč.
 *
 * Vzniklo 20. 8. 2026 při přípravě druhého zákazníka: do té doby měla
 * aplikace v kódu záložní adresu produkční databáze Cantinera, takže
 * nasazení bez nastavení by se tiše připojilo k cizím datům.
 */
export function ChybejiciNastaveni({ chybi }: { chybi: readonly string[] }) {
  return (
    <div className="brana">
      <div className="listek">
        <p className="eyebrow">Nastavení nasazení</p>
        <h1 className="znacka">Chybí připojení</h1>

        <hr className="rozdelovac" />

        <p>
          Tomuhle nasazení není řečeno, ke které databázi patří, takže se
          nepřipojí k žádné. Je to schválně — bez toho by hrozilo, že sáhne
          do dat jiné firmy.
        </p>

        <p>Doplňte v nastavení nasazení tyto hodnoty a nasaďte znovu:</p>

        <ul>
          {chybi.map((klic) => (
            <li key={klic}>
              <code>{klic}</code>
            </li>
          ))}
        </ul>

        <p className="poznamka">
          Adresu databáze i veřejný klíč najdete v projektu databáze
          v sekci nastavení API.
        </p>
      </div>
    </div>
  );
}
