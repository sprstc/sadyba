/**
 * src/main.js
 * Punkt wejściowy aplikacji Cyfrowego Bliźniaka Architektonicznego 3D (Segment Bliźniaczy, 1955 / 1966 / 2026).
 */

import { AuthGate } from './core/AuthGate.js';
import { Viewer } from './core/Viewer.js';
import { UIManager } from './ui/UIManager.js';

window.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('canvas-container');
  const labelsContainer = document.getElementById('labels-container');

  if (!container) {
    console.error('Nie znaleziono kontenera #canvas-container.');
    return;
  }

  // Zablokuj inicjalizację i ładowanie sceny 3D do czasu poprawnej weryfikacji kodu PIN / hasła (Web Crypto API)
  const authGate = new AuthGate();
  await authGate.waitForUnlock();

  // Wymuś aktualizację wymiarów po ukryciu wirtualnej klawiatury na telefonach
  window.dispatchEvent(new Event('resize'));

  const viewer = new Viewer(container, labelsContainer);
  const ui = new UIManager(viewer);

  // Eksponujemy instancję do celów inspekcji deweloperskiej w konsoli
  window.archDigitalTwin = { viewer, ui, authGate };

  viewer.start();

  // Odświeżenie geometrii tylko jeśli wymiary faktycznie uległy zmianie po schowaniu klawiatury
  setTimeout(() => viewer.handleResize(), 250);
});
