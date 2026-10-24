/**
 * src/ui/UIManager.js
 * Kompleksowy menedżer interfejsu użytkownika (Dark Architectural Blueprint UI)
 * łączący wszystkie kontrolki z index.html z silnikiem 3D Viewer.js.
 */

import { ROOMS_SPEC } from '../data/houseSpec.js';
import { ArchiveModal } from './ArchiveModal.js';

export class UIManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.archiveModal = new ArchiveModal();

    this.panelStates = {
      top: false,    // false = rozwinięty, true = zwinięty
      left: false,
      right: false,
      bottom: false,
    };
    this.zenMode = false;

    this.initCallbacks();
    this.bindSidebarToggle();
    this.bindSectionAccordions();
    this.bindZenAndFullscreen();
    this.bindModeButtons();
    this.bindSlidersAndCuts();
    this.bindLayerCheckboxes();
    this.bindCameraPresets();
    this.bindWalkControls();
    this.bindMeasureTool();
    this.bindInspectorActions();
    this.renderRoomPills();

    // Domyślnie wybierz Salon ogrodowy na parterze (g-salon)
    this.viewer.selectRoomById('g-salon', false);
  }

  initCallbacks() {
    this.viewer.callbacks.onRoomSelected = (roomSpec) => {
      this.updateRoomInspector(roomSpec);
      this.highlightActivePill(roomSpec.id);
    };

    this.viewer.callbacks.onMeasureUpdate = (data) => {
      const statusEl = document.getElementById('measure-status');
      const resultEl = document.getElementById('measure-result');
      const deltasEl = document.getElementById('measure-deltas');

      if (!data) {
        if (statusEl) statusEl.textContent = 'Kliknij pierwszy punkt na dowolnym elemencie budynku...';
        if (resultEl) resultEl.textContent = '0,00 m';
        if (deltasEl) deltasEl.textContent = 'ΔX: 0.00 m | ΔY: 0.00 m | ΔZ: 0.00 m';
        return;
      }

      if (statusEl && data.statusText) {
        statusEl.textContent = data.statusText;
      }
      if (!data.firstPointOnly && typeof data.total === 'number') {
        if (resultEl) resultEl.textContent = `${data.total.toFixed(2).replace('.', ',')} m`;
        if (deltasEl) {
          deltasEl.textContent = `ΔX: ${data.dx.toFixed(2)} m | ΔY: ${data.dy.toFixed(2)} m | ΔZ: ${data.dz.toFixed(2)} m`;
        }
      }
    };

    this.viewer.callbacks.onWalkHudUpdate = (hud) => {
      const floorEl = document.getElementById('hud-floor-name');
      const elevEl = document.getElementById('hud-elevation');
      const noclipEl = document.getElementById('hud-noclip-state');
      const autoBtn = document.getElementById('btn-hud-autopilot');
      const autoHeaderBtn = document.getElementById('btn-autopilot-header');
      const noclipBtn = document.getElementById('btn-hud-noclip');

      if (floorEl) floorEl.textContent = hud.floorName;
      if (elevEl) elevEl.textContent = hud.elevationText;
      if (noclipEl) noclipEl.textContent = hud.noclip ? 'ON' : 'OFF';
      if (autoBtn) autoBtn.classList.toggle('active', Boolean(hud.autopilot));
      if (autoHeaderBtn) autoHeaderBtn.classList.toggle('active', Boolean(hud.autopilot));
      if (noclipBtn) noclipBtn.classList.toggle('active', Boolean(hud.noclip));

      this.syncWalkHudVisibility(hud.walkMode);
    };

    this.viewer.cameraManager.onWalkExitCallback = () => {
      this.syncWalkHudVisibility(false);
    };
  }

  /**
   * Ustawia stan zwinięcia konkretnego panelu ('top' | 'left' | 'right' | 'bottom')
   * oraz synchronizuje pływające uchwyty (Dock Tabs) i pasek Zen.
   */
  setPanelCollapsed(panelKey, collapsed) {
    this.panelStates[panelKey] = Boolean(collapsed);

    const map = {
      top: { el: document.getElementById('top-header'), dock: document.getElementById('dock-expand-top') },
      left: { el: document.getElementById('left-sidebar'), dock: document.getElementById('dock-expand-left') },
      right: { el: document.getElementById('right-sidebar'), dock: document.getElementById('dock-expand-right') },
      bottom: { el: document.getElementById('bottom-bar'), dock: document.getElementById('dock-expand-bottom') },
    };

    const item = map[panelKey];
    if (item && item.el) {
      item.el.classList.toggle('collapsed', this.panelStates[panelKey]);
    }

    document.body.classList.toggle('top-collapsed', this.panelStates.top);
    document.body.classList.toggle('bottom-collapsed', this.panelStates.bottom);

    const allCollapsed =
      this.panelStates.top &&
      this.panelStates.left &&
      this.panelStates.right &&
      this.panelStates.bottom;

    this.zenMode = allCollapsed;

    // Pływający pasek Zen pojawia się, gdy górny nagłówek jest zwinięty lub gdy aktywny jest tryb Zen / Pełny ekran
    const zenBar = document.getElementById('zen-floating-bar');
    const showZenBar = allCollapsed || this.panelStates.top || Boolean(document.fullscreenElement);
    zenBar?.classList.toggle('hidden', !showZenBar);

    const zenRestoreBtn = document.getElementById('btn-zen-restore');
    if (zenRestoreBtn) {
      zenRestoreBtn.innerHTML = allCollapsed
        ? '👁️ Pokaż wszystkie menu <kbd>H</kbd>'
        : '👁️ Ukryj wszystkie menu <kbd>H</kbd>';
    }

    const headerZenBtn = document.getElementById('btn-zen-mode');
    headerZenBtn?.classList.toggle('active', allCollapsed);

    // Pływające uchwyty boczne dla pojedynczych paneli
    Object.entries(map).forEach(([key, objs]) => {
      if (!objs.dock) return;
      if (key === 'top' && showZenBar) {
        // Gdy widoczny jest pasek Zen na górze, uchwyt top-dock po lewej stronie też jest dostępny do przywrócenia samego nagłówka
        objs.dock.classList.toggle('hidden', !this.panelStates.top);
      } else {
        objs.dock.classList.toggle('hidden', !this.panelStates[key]);
      }
    });
  }

  toggleZenMode(forceState) {
    const nextZen = typeof forceState === 'boolean' ? forceState : !this.zenMode;
    this.setPanelCollapsed('top', nextZen);
    this.setPanelCollapsed('left', nextZen);
    this.setPanelCollapsed('right', nextZen);
    this.setPanelCollapsed('bottom', nextZen);
  }

  bindSidebarToggle() {
    // 1. Pojedyncze zwijanie / rozwijanie 4 głównych paneli
    document.getElementById('btn-collapse-top')?.addEventListener('click', () => {
      this.setPanelCollapsed('top', true);
    });
    document.getElementById('dock-expand-top')?.addEventListener('click', () => {
      this.setPanelCollapsed('top', false);
    });

    document.getElementById('btn-collapse-left')?.addEventListener('click', () => {
      this.setPanelCollapsed('left', true);
    });
    document.getElementById('dock-expand-left')?.addEventListener('click', () => {
      this.setPanelCollapsed('left', false);
    });

    document.getElementById('btn-collapse-right')?.addEventListener('click', () => {
      this.setPanelCollapsed('right', true);
    });
    document.getElementById('dock-expand-right')?.addEventListener('click', () => {
      this.setPanelCollapsed('right', false);
    });

    document.getElementById('btn-collapse-bottom')?.addEventListener('click', () => {
      this.setPanelCollapsed('bottom', true);
    });
    document.getElementById('dock-expand-bottom')?.addEventListener('click', () => {
      this.setPanelCollapsed('bottom', false);
    });
  }

  /**
   * Zwijanie i rozwijanie poszczególnych sekcji (akordeonów) wewnątrz lewego i prawego panelu
   */
  bindSectionAccordions() {
    const sections = document.querySelectorAll('[data-collapsible-section]');
    sections.forEach((sec) => {
      const header = sec.querySelector('.section-toggle-header');
      const foldBtn = sec.querySelector('.btn-section-fold');

      const toggleSection = () => {
        const isFolded = sec.classList.toggle('section-folded');
        if (foldBtn) {
          foldBtn.textContent = isFolded ? '▸' : '▾';
        }
      };

      foldBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSection();
      });

      header?.addEventListener('click', (e) => {
        // Ignoruj kliknięcie w inne przyciski akcji znajdujące się w nagłówku (np. Reset cięć, Rentgen, 360°, ▶)
        if (e.target.closest('button') && !e.target.closest('.btn-section-fold')) {
          return;
        }
        toggleSection();
      });
    });

    // Przycisk zbiorczego zwinięcia/rozwinięcia wszystkich sekcji w lewym panelu
    const foldAllLeftBtn = document.getElementById('btn-fold-all-left');
    foldAllLeftBtn?.addEventListener('click', () => {
      const leftSections = document.querySelectorAll('#left-sidebar [data-collapsible-section]');
      const anyOpen = Array.from(leftSections).some((s) => !s.classList.contains('section-folded'));
      leftSections.forEach((sec) => {
        sec.classList.toggle('section-folded', anyOpen);
        const btn = sec.querySelector('.btn-section-fold');
        if (btn) btn.textContent = anyOpen ? '▸' : '▾';
      });
      foldAllLeftBtn.textContent = anyOpen ? '⊞' : '⊟';
    });
  }

  /**
   * Obsługa Trybu Czystej Bryły (Zen Mode [H]), Pełnego Ekranu Przeglądarki ([F]),
   * Auto-Obrotu 360° ([O]) oraz skrótów klawiaturowych do analizy bryły.
   */
  bindZenAndFullscreen() {
    const zenBtn = document.getElementById('btn-zen-mode');
    const zenRestoreBtn = document.getElementById('btn-zen-restore');
    const fsBtn = document.getElementById('btn-fullscreen');
    const zenFsBtn = document.getElementById('btn-zen-fullscreen');
    const autoRotateCamBtn = document.getElementById('btn-autorotate-cam');
    const zenAutoRotateBtn = document.getElementById('btn-zen-autorotate');
    const zenTwinBtn = document.getElementById('btn-zen-twin');
    const zenIsoBtn = document.getElementById('btn-zen-iso');

    zenBtn?.addEventListener('click', () => this.toggleZenMode());
    zenRestoreBtn?.addEventListener('click', () => this.toggleZenMode());

    const syncAutoRotateUI = (active) => {
      autoRotateCamBtn?.classList.toggle('active', active);
      zenAutoRotateBtn?.classList.toggle('active', active);
    };

    const handleToggleAutoRotate = () => {
      const active = this.viewer.cameraManager.toggleAutoRotate();
      syncAutoRotateUI(active);
    };

    autoRotateCamBtn?.addEventListener('click', handleToggleAutoRotate);
    zenAutoRotateBtn?.addEventListener('click', handleToggleAutoRotate);

    const handleToggleFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          // Wchodząc w pełny ekran, automatycznie zwiń menu, aby od razu odsłonić czystą bryłę 3D
          this.toggleZenMode(true);
        } else {
          await document.exitFullscreen();
        }
      } catch (err) {
        // Fallback: jeśli przeglądarka zablokuje Fullscreen API, włącz pełny tryb Zen
        this.toggleZenMode(!this.zenMode);
      }
    };

    fsBtn?.addEventListener('click', handleToggleFullscreen);
    zenFsBtn?.addEventListener('click', handleToggleFullscreen);

    document.addEventListener('fullscreenchange', () => {
      const isFs = Boolean(document.fullscreenElement);
      fsBtn?.classList.toggle('active', isFs);
      zenFsBtn?.classList.toggle('active', isFs);
      if (zenFsBtn) {
        zenFsBtn.innerHTML = isFs ? '⛶ Wyjdź <kbd>F</kbd>' : '⛶ Pełny ekran <kbd>F</kbd>';
      }
      // Odśwież widoczność paska Zen
      this.setPanelCollapsed('top', this.panelStates.top);
    });

    // Szybkie przełączanie Segment B / Cały Bliźniak A+B z paska Zen
    zenTwinBtn?.addEventListener('click', () => {
      this.setTwinModeUI(!this.viewer.isTwinMode);
    });

    // Szybki reset do widoku ISO z paska Zen
    zenIsoBtn?.addEventListener('click', () => {
      this.viewer.cameraManager.setPreset('iso');
    });

    // Globalne skróty klawiaturowe do inspekcji bryły
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const archiveDialog = document.getElementById('archive-modal');
      if (archiveDialog && archiveDialog.open) return;

      if (e.code === 'KeyH') {
        e.preventDefault();
        this.toggleZenMode();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        handleToggleFullscreen();
      } else if (e.code === 'KeyO') {
        e.preventDefault();
        handleToggleAutoRotate();
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        this.setTwinModeUI(!this.viewer.isTwinMode);
      } else if (e.code === 'KeyI') {
        e.preventDefault();
        this.viewer.cameraManager.setPreset('iso');
      } else if (e.code === 'BracketLeft') {
        e.preventDefault();
        this.setPanelCollapsed('left', !this.panelStates.left);
      } else if (e.code === 'BracketRight') {
        e.preventDefault();
        this.setPanelCollapsed('right', !this.panelStates.right);
      }
    });
  }

  setTwinModeUI(enableTwin) {
    const btnSingle = document.getElementById('btn-mode-single');
    const btnTwin = document.getElementById('btn-mode-twin');
    const zenTwinBtn = document.getElementById('btn-zen-twin');

    btnSingle?.classList.toggle('active', !enableTwin);
    btnTwin?.classList.toggle('active', enableTwin);
    zenTwinBtn?.classList.toggle('active', enableTwin);
    this.viewer.setTwinMode(enableTwin);
  }

  bindModeButtons() {
    const btnSingle = document.getElementById('btn-mode-single');
    const btnTwin = document.getElementById('btn-mode-twin');

    btnSingle?.addEventListener('click', () => this.setTwinModeUI(false));
    btnTwin?.addEventListener('click', () => this.setTwinModeUI(true));

    const btnEra66 = document.getElementById('btn-era-1966');
    const btnEra55 = document.getElementById('btn-era-1955');

    btnEra66?.addEventListener('click', () => {
      btnEra66.classList.add('active');
      btnEra55?.classList.remove('active');
      this.viewer.setEraMode('1966');
    });

    btnEra55?.addEventListener('click', () => {
      btnEra55.classList.add('active');
      btnEra66?.classList.remove('active');
      this.viewer.setEraMode('1955');
    });
  }

  bindSlidersAndCuts() {
    // 1. Suwak Exploded View i przyciski szybkiego wyboru
    const explodeSlider = document.getElementById('slider-explode');
    const explodeVal = document.getElementById('val-explode');

    const applyExplodePct = (pct) => {
      const val = Math.max(0, Math.min(100, parseFloat(pct)));
      if (explodeSlider) explodeSlider.value = String(val);
      if (explodeVal) explodeVal.textContent = `${Math.round(val)}%`;
      this.viewer.setExplodedFactor(val / 100);
    };

    explodeSlider?.addEventListener('input', (e) => {
      applyExplodePct(e.target.value);
    });

    document.querySelectorAll('button[data-explode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyExplodePct(btn.getAttribute('data-explode'));
      });
    });

    // 2. Przekroje dynamiczne Y, X, Z
    const cutY = document.getElementById('slider-cut-y');
    const valY = document.getElementById('val-cut-y');
    const applyCutY = (vFloat) => {
      const v = parseFloat(vFloat);
      if (cutY) cutY.value = String(v);
      if (v >= 11.45) {
        this.viewer.sectionManager.setClipY(12.5);
        if (valY) valY.textContent = 'WYŁ.';
      } else {
        this.viewer.sectionManager.setClipY(v);
        if (valY) valY.textContent = `Y = +${v.toFixed(2)} m`;
      }
    };

    cutY?.addEventListener('input', (e) => applyCutY(e.target.value));
    document.querySelectorAll('button[data-cut-y]').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyCutY(btn.getAttribute('data-cut-y'));
      });
    });

    const cutX = document.getElementById('slider-cut-x');
    const valX = document.getElementById('val-cut-x');
    cutX?.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (v >= 6.45) {
        this.viewer.sectionManager.setClipX(12.0);
        if (valX) valX.textContent = 'WYŁ.';
      } else {
        this.viewer.sectionManager.setClipX(v);
        if (valX) valX.textContent = `X = ${v.toFixed(2)} m`;
      }
    });

    const cutZ = document.getElementById('slider-cut-z');
    const valZ = document.getElementById('val-cut-z');
    cutZ?.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (v <= -7.75) {
        this.viewer.sectionManager.setClipZ(-10.5);
        if (valZ) valZ.textContent = 'WYŁ.';
      } else {
        this.viewer.sectionManager.setClipZ(v);
        if (valZ) valZ.textContent = `Z = ${v.toFixed(2)} m`;
      }
    });

    const resetCutsBtn = document.getElementById('btn-reset-cuts');
    resetCutsBtn?.addEventListener('click', () => {
      this.viewer.sectionManager.resetAll();
      if (cutY) cutY.value = '11.5';
      if (cutX) cutX.value = '6.5';
      if (cutZ) cutZ.value = '-7.8';
      if (valY) valY.textContent = 'WYŁ.';
      if (valX) valX.textContent = 'WYŁ.';
      if (valZ) valZ.textContent = 'WYŁ.';
    });

    // 3. Heliodon (słońce 52.2°N)
    const sunSlider = document.getElementById('slider-sun-time');
    const sunVal = document.getElementById('val-sun-time');
    sunSlider?.addEventListener('input', (e) => {
      const h = parseFloat(e.target.value);
      this.viewer.setSunHour(h);
      const hrs = Math.floor(h);
      const mins = Math.round((h - hrs) * 60);
      const timeStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      let sideLabel = 'Południe';
      if (h < 11.0) sideLabel = 'Wschód/Ulica';
      else if (h >= 14.0) sideLabel = 'Zachód/Ogród';
      if (sunVal) sunVal.textContent = `${timeStr} (${sideLabel})`;
    });
  }

  bindLayerCheckboxes() {
    const checkboxes = document.querySelectorAll('input[data-layer]');
    checkboxes.forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const layerKey = e.target.getAttribute('data-layer');
        this.viewer.setLayerVisibility(layerKey, e.target.checked);
      });
    });

    const xrayBtn = document.getElementById('btn-xray-klein');
    xrayBtn?.addEventListener('click', () => {
      const active = this.viewer.toggleXRayMode();
      xrayBtn.classList.toggle('active', active);
      xrayBtn.textContent = active ? '🔍 Rentgen: AKTYWNY' : '🔍 Rentgen Kleina';
    });
  }

  bindCameraPresets() {
    const camBtns = document.querySelectorAll('button[data-cam]');
    camBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        camBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const camKey = btn.getAttribute('data-cam');
        this.syncWalkHudVisibility(false);

        if (camKey === 'section') {
          // Automatycznie załącz przekrój podłużny Z jak na rysunku z 1966 r.
          const cutZ = document.getElementById('slider-cut-z');
          const valZ = document.getElementById('val-cut-z');
          if (cutZ) cutZ.value = '-3.2';
          if (valZ) valZ.textContent = 'Z = -3.20 m';
          this.viewer.sectionManager.setClipZ(-3.2);
        }

        this.viewer.cameraManager.setPreset(camKey);
      });
    });
  }

  bindWalkControls() {
    const walkBtn = document.getElementById('btn-walk-mode');
    const autoHeaderBtn = document.getElementById('btn-autopilot-header');
    const hudAutoBtn = document.getElementById('btn-hud-autopilot');
    const hudNoclipBtn = document.getElementById('btn-hud-noclip');
    const hudExitBtn = document.getElementById('btn-hud-exit-walk');

    walkBtn?.addEventListener('click', () => {
      const next = !this.viewer.cameraManager.walkMode;
      this.viewer.cameraManager.setWalkMode(next);
      this.syncWalkHudVisibility(next);
    });

    autoHeaderBtn?.addEventListener('click', () => {
      this.viewer.cameraManager.toggleAutopilot();
    });

    hudAutoBtn?.addEventListener('click', () => {
      this.viewer.cameraManager.toggleAutopilot();
    });

    hudNoclipBtn?.addEventListener('click', () => {
      this.viewer.cameraManager.toggleNoclip();
    });

    hudExitBtn?.addEventListener('click', () => {
      this.viewer.cameraManager.setWalkMode(false);
      this.syncWalkHudVisibility(false);
    });
  }

  syncWalkHudVisibility(isWalking) {
    document.getElementById('btn-walk-mode')?.classList.toggle('active', Boolean(isWalking));
    document.getElementById('walk-hud')?.classList.toggle('hidden', !isWalking);
    document.getElementById('walk-crosshair')?.classList.toggle('hidden', !isWalking);
  }

  bindMeasureTool() {
    const measureBtn = document.getElementById('btn-measure-tool');
    const measureCard = document.getElementById('measure-card');
    const clearBtn = document.getElementById('btn-clear-measure');

    measureBtn?.addEventListener('click', () => {
      const next = !this.viewer.measureMode;
      this.viewer.setMeasureMode(next);
      measureBtn.classList.toggle('active', next);
      measureCard?.classList.toggle('hidden', !next);
    });

    clearBtn?.addEventListener('click', () => {
      this.viewer.clearMeasurements();
    });
  }

  bindInspectorActions() {
    const teleportBtn = document.getElementById('btn-teleport-room');
    teleportBtn?.addEventListener('click', () => {
      if (this.viewer.selectedRoomId) {
        this.viewer.selectRoomById(this.viewer.selectedRoomId, true);
      }
    });
  }

  updateRoomInspector(room) {
    document.getElementById('insp-floor-badge').textContent = room.floorLabel;
    document.getElementById('insp-room-name').textContent = room.name;
    document.getElementById('insp-room-code').textContent = room.code;
    document.getElementById('insp-area-1966').textContent = `${room.area1966.toFixed(2).replace('.', ',')} m²`;
    document.getElementById('insp-area-2026').textContent = `${room.area2026.toFixed(2).replace('.', ',')} m²`;
    document.getElementById('insp-area-1955').textContent = `${room.area1955.toFixed(2).replace('.', ',')} m²`;
    document.getElementById('insp-dims').textContent = room.dimsClear;
    document.getElementById('insp-elev').textContent = `Y = ${room.elevationY >= 0 ? '+' : ''}${room.elevationY.toFixed(2).replace('.', ',')} m`;
    document.getElementById('insp-floor-mat').textContent = room.floorFinish;
    document.getElementById('insp-ceiling-mat').textContent = room.ceilingStruct;
    document.getElementById('insp-description').textContent = room.description;
  }

  renderRoomPills() {
    const bar = document.getElementById('room-pills-bar');
    if (!bar) return;
    bar.innerHTML = '';

    for (const room of ROOMS_SPEC) {
      const btn = document.createElement('button');
      btn.className = 'room-pill';
      btn.setAttribute('data-room-id', room.id);
      btn.innerHTML = `${room.name} <small>${room.area2026.toFixed(1)}m²</small>`;
      btn.addEventListener('click', () => {
        this.viewer.selectRoomById(room.id, true);
      });
      bar.appendChild(btn);
    }
  }

  highlightActivePill(roomId) {
    const pills = document.querySelectorAll('.room-pill');
    pills.forEach((p) => {
      p.classList.toggle('active', p.getAttribute('data-room-id') === roomId);
    });
  }
}
