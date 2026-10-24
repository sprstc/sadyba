# Cyfrowy Bliźniak Architektoniczny 3D (1955 / 1966 / 2026)

Interaktywny model konstrukcyjno-architektoniczny 3D (Digital Twin) budynku jednorodzinnego w zabudowie bliźniaczej (Segment B), wykonany w technologii **Three.js (ES Modules) + Vanilla JS + CSS3/HTML5**.

## Kluczowe cechy
- **Zero-build pipeline:** Działa bezpośrednio w przeglądarce oraz na **GitHub Pages** / **Cloudflare Pages** bez konieczności budowania (natywne `importmap` + proceduralne tekstury PBR generowane w locie na `<canvas>`).
- **Autoryzacja Web Crypto API (`SHA-256`):** Ekran blokady PIN/hasłem przed inicjalizacją sceny WebGL (`src/core/AuthGate.js`).
- **Wierność inżynieryjna:**
  - Stropy Kleina (dwuteowniki stalowe `I NP 24 / 22 / 18 / 14` z wymianem klatki schodowej i płytami ceramicznymi),
  - Dębowe schody zabiegowe wachlarzowe $180^\circ$ z centralnym słupem i kutą balustradą ze ślimacznicami,
  - Więźba dachowa stolcowo-kleszczowa z lukarnami i 7-przewodowym trzonem kominowym,
  - Przełącznik stanu historycznego (`1955` ↔ `1966 / 2026`) oraz trybu `Segment B` ↔ `Cały Bliźniak (A+B)`.
- **Narzędzia inspekcji:**
  - Tryb Czystej Bryły (`[H]`), Pełny Ekran (`[F]`), Auto-obrót 360° (`[O]`),
  - Suwak rozstrzelenia kondygnacji (*Exploded View*) oraz przekroje dynamiczne X / Y / Z (*Clipping Planes*),
  - Tryb spaceru pierwszo-/trzecioosobowego z awatarem 1,80 m (`WASD`) oraz Autopilot (`[P]`).
