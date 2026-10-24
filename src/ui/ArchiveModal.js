/**
 * src/ui/ArchiveModal.js
 * Komponent okna modalnego <dialog> prezentującego pełną metrykę archiwalną (1955 / 1966 / 2026),
 * audyt inżynieryjno-konstrukcyjny oraz tabelę porównawczą wszystkich 15 pomieszczeń.
 */

import { ARCHIVE_METADATA, ROOMS_SPEC } from '../data/houseSpec.js';

export class ArchiveModal {
  constructor() {
    this.dialog = document.getElementById('archive-modal');
    this.contentEl = document.getElementById('archive-modal-content');
    this.openBtn = document.getElementById('btn-open-archive');
    this.closeBtn = document.getElementById('btn-close-archive');

    this.renderContent();
    this.bindEvents();
  }

  bindEvents() {
    if (this.openBtn && this.dialog) {
      this.openBtn.addEventListener('click', () => {
        this.dialog.showModal();
      });
    }
    if (this.closeBtn && this.dialog) {
      this.closeBtn.addEventListener('click', () => {
        this.dialog.close();
      });
    }
    if (this.dialog) {
      this.dialog.addEventListener('click', (e) => {
        const rect = this.dialog.getBoundingClientRect();
        const inDialog =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        if (!inDialog) this.dialog.close();
      });
    }
  }

  renderContent() {
    if (!this.contentEl) return;

    const p55 = ARCHIVE_METADATA.project1955;
    const inv66 = ARCHIVE_METADATA.inventory1966;
    const m26 = ARCHIVE_METADATA.modernScan2026;

    const sum1955 = ROOMS_SPEC.reduce((acc, r) => acc + r.area1955, 0);
    const sum1966 = ROOMS_SPEC.reduce((acc, r) => acc + r.area1966, 0);
    const sum2026 = ROOMS_SPEC.reduce((acc, r) => acc + r.area2026, 0);

    const rowsHtml = ROOMS_SPEC.map(
      (r) => `
      <tr>
        <td class="mono-text">${r.code}</td>
        <td><strong>${r.name}</strong><br><small style="color:#94a3b8">${r.floorLabel}</small></td>
        <td class="mono-text">${r.area1955.toFixed(2)} m²</td>
        <td class="mono-text" style="color:#f0ca50;font-weight:600">${r.area1966.toFixed(2)} m²</td>
        <td class="mono-text" style="color:#4ade80;font-weight:600">${r.area2026.toFixed(2)} m²</td>
        <td class="mono-text">${r.dimsClear}</td>
        <td>${r.floorFinish}</td>
      </tr>
    `
    ).join('');

    this.contentEl.innerHTML = `
      <div class="archive-grid">
        <div class="archive-box">
          <h4>1. Projekt Pierwotny i Statyka (19.X.1955 r.)</h4>
          <ul class="archive-list">
            <li><span>Zatwierdzenie:</span> <strong>${p55.approvalNumber} (${p55.approvalDate})</strong></li>
            <li><span>Projektanci:</span> <strong>${p55.authors}</strong></li>
            <li><span>Weryfikacja statyki:</span> <strong>${p55.structuralReviewer}</strong></li>
            <li><span>Inwestor spółdzielczy:</span> <strong>${ARCHIVE_METADATA.cooperative}</strong></li>
            <li><span>Pow. zabudowy / Kubatura (1955):</span> <strong>${p55.footprintArea.toFixed(2)} m² / ${p55.volume.toFixed(0)} m³</strong></li>
          </ul>
        </div>

        <div class="archive-box">
          <h4>2. Operat Inwentaryzacji Budowlanej (7.III.1966 r.)</h4>
          <ul class="archive-list">
            <li><span>Sygnatura zatwierdzenia:</span> <strong>${inv66.approvalNumber} (${inv66.approvalDate})</strong></li>
            <li><span>Autorzy operatu:</span> <strong>${inv66.authors}</strong></li>
            <li><span>Właściciel (Segment B):</span> <strong>${ARCHIVE_METADATA.investor1966}</strong></li>
            <li><span>Odbiór kominiarski:</span> <strong>${inv66.chimneyReport}</strong></li>
            <li><span>Pow. zabudowy / Kubatura (1966):</span> <strong>${inv66.footprintArea.toFixed(2)} m² / ${inv66.volume.toFixed(0)} m³</strong></li>
          </ul>
        </div>
      </div>

      <div class="archive-box">
        <h4>3. Krytyczny Audyt Inżynieryjny i Weryfikacja Geometrii z Dokumentacją Archiwalną</h4>
        <ul class="archive-list">
          <li>
            <span>Korekta łańcucha głębokości budynku (11,00 m + 2,70 m = 13,70 m):</span>
            <strong>Na oryginalnym rzucie parteru z 1966 r. (str. 6) łańcuch wymiarowy wynosi dokładnie 1100 cm korpusu głównego + 270 cm werandy = 1370 cm (13,70 m), a ze schodami ogrodowymi (237 cm) łącznie 1607 cm (16,07 m). Daje to powierzchnię zabudowy 6,08 × 13,70 = 83,30 m² + 1,87 m² (ganek północny) = 85,17 m² – co do setnej części metra potwierdza wpis na karcie tytułowej inwentaryzacji!</strong>
          </li>
          <li>
            <span>Stropy Kleina z powojennych belek rozbiórkowych (I NP 24 / 22 / 18 / 14):</span>
            <strong>Zgodnie z „Obliczeniami statycznymi” z 1955 r. (str. 4–8) użyto stalowych dwuteowników walcowanych z rozbiórki (obniżenie naprężeń dopuszczalnych o 10% do k = 1260 kg/cm²): belki główne I NP 24 (PN 24 na przekroju z 1966 r.) oraz I NP 22, belki skrócone I NP 18 przy klatce schodowej, wymian stalowy klatki schodowej I NP 14 oraz nadproża 2 × I NP 16 nad bramą garażową.</strong>
          </li>
          <li>
            <span>Współczesny skan laserowy (${m26.provider}):</span>
            <strong>Całkowita powierzchnia wewnętrzna: ${m26.totalInternalArea.toFixed(1)} m² (Podziemie ${m26.floorsBreakdown.basement} m², Parter ${m26.floorsBreakdown.groundFloor} m², I Piętro ${m26.floorsBreakdown.firstFloor} m², Poddasze ${m26.floorsBreakdown.attic} m²) + Taras I piętra ${m26.terraceArea} m².</strong>
          </li>
        </ul>
      </div>

      <div class="archive-table-wrap">
        <table class="archive-table">
          <thead>
            <tr>
              <th>Kod</th>
              <th>Pomieszczenie i Kondygnacja</th>
              <th>Proj. 1955</th>
              <th>Inwent. 1966</th>
              <th>Pomiar 2026</th>
              <th>Wymiary w świetle</th>
              <th>Posadzka i wykończenie</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2">SUMA BILANSOWA (Z TARASEM I PODDASZEM)</td>
              <td class="mono-text">${sum1955.toFixed(2)} m²</td>
              <td class="mono-text">${sum1966.toFixed(2)} m²</td>
              <td class="mono-text">${sum2026.toFixed(2)} m²</td>
              <td colspan="2">Zgodność bilansu z operatem 1966 r. oraz skanem Skan 3D</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }
}
