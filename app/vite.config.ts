import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Výpočet tvaru oblasti si aplikace bere přímo z jádra (`../src`), aby
    // mapa počítala totéž, co se pak uloží. Vite proto musí smět číst
    // i o adresář výš.
    fs: { allow: [".."] },
  },
});
