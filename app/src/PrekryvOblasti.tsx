import type { Prekryv, Vrstva } from "./vrstvy";

/**
 * Firmy, které leží ve víc zobrazených oblastech naráz.
 *
 * Vyčleněno z `PanelVrstev`, aby to šlo ukázat i tam, kde panel není —
 * na obrazovce Oblasti ovládá vrstvy seznam pod mapou a panel by jen
 * podruhé vypisoval tytéž oblasti.
 *
 * Proč to vůbec je vidět: na jednu firmu smí odejít jen jedno oslovení
 * (TP-5), takže firma ve dvou oblastech je znamení, že se výběr překrývá
 * víc, než měl.
 */
export function PrekryvOblasti({ prekryv, vrstvy }: { prekryv: Prekryv; vrstvy: Vrstva[] }) {
  if (prekryv.firmy.size === 0) {
    return vrstvy.length > 1 ? (
      <p className="poznamka bez-prekryvu">Zobrazené oblasti se nepřekrývají.</p>
    ) : null;
  }

  return (
    <div className="prekryv">
      <p className="udaj">
        <span className="popisek">V překryvu</span>
        <span className="hodnota">{prekryv.firmy.size.toLocaleString("cs")} firem</span>
      </p>
      <p className="poznamka">
        Tyhle firmy leží ve víc zobrazených oblastech. Na jednu firmu smí
        odejít jen jedno oslovení, takže se do dvou kampaní dostat nesmí —
        v mapě jsou vyznačené kroužkem.
      </p>
      <ul className="dvojice">
        {prekryv.dvojice.slice(0, 4).map((d) => (
          <li key={`${d.a}|${d.b}`}>
            {d.a} × {d.b} — {d.pocet.toLocaleString("cs")}
          </li>
        ))}
      </ul>
      {prekryv.dvojice.length > 4 && (
        <p className="poznamka">…a další {prekryv.dvojice.length - 4} dvojice.</p>
      )}
    </div>
  );
}
