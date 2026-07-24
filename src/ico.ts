/**
 * Validace IČO: 8 číslic + kontrolní číslice mod 11.
 * Váhy 8..2 na prvních 7 číslicích; kontrolní číslice = (11 - suma % 11) % 10.
 */
export function jeValidniIco(ico: string): boolean {
  if (!/^[0-9]{8}$/.test(ico)) return false;
  let suma = 0;
  for (let i = 0; i < 7; i++) {
    suma += Number(ico[i]) * (8 - i);
  }
  const kontrolni = (11 - (suma % 11)) % 10;
  return kontrolni === Number(ico[7]);
}
