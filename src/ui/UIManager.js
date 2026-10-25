/**
 * src/ui/UIManager.js
 * Kompleksowy menedżer interfejsu użytkownika (Dark Architectural Blueprint UI)
 * łączący kontrolki z index.html z silnikiem 3D Viewer.js oraz poziomami (levelsSpec.js).
 */

import { ROOMS_SPEC } from '../data/houseSpec.js';
import {
  LEVELS,
  WHOLE_BUILDING,
  getLevel,
  getRoomsForLevel,
  levelKeyForClipY,
} from '../data/levelsSpec.js';
import { ArchiveModal } from './ArchiveModal.js';

export class UIManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.archiveModal = new ArchiveModal();

    this.panelStates = {
      top: false,
      left: false,
      right: false,
      bottom: false,
    };
    this.zenMode = false;

    this.currentLevelKey = 'groundFloor';
    this.currentViewMode = 'level'; // 'level' | 'room'

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
    this.bindDetailsNavigation();
    this.bindMoreMenu();
    this.bindMobileNavigation();

    // Renderowanie selektora kondygnacji i inicjalizacja widoku
    this.renderLevelPicker();
    this.selectLevel('groundFloor', true);
  }

  initCallbacks() {
    this.viewer.callbacks.onRoomSelected = (roomSpec) => {
      this.showRoomDetails(roomSpec);
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

  // =========================================================================
  // SELEKTOR KONDYGNACJI I KARTA SZCZEGÓŁÓW (LEWY -> PRAWY PANEL)
  // =========================================================================

  renderLevelPicker() {
    const container = document.getElementById('level-picker');
    if (!container) return;
    container.innerHTML = '';

    const allItems = [...LEVELS, WHOLE_BUILDING];
    allItems.forEach((lvl) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'level-btn';
      btn.setAttribute('data-level-key', lvl.key);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');

      if (lvl.key === WHOLE_BUILDING.key) {
        btn.innerHTML = `
          <div class="level-info">
            <span class="level-name">${lvl.name}</span>
            <span class="level-meta">Wszystkie poziomy</span>
          </div>
          <span class="level-badge">3D</span>
        `;
      } else {
        btn.innerHTML = `
          <div class="level-info">
            <span class="level-name">${lvl.name}</span>
            <span class="level-meta">${lvl.projElev} m · ${lvl.area2026.toFixed(1)} m²</span>
          </div>
          <span class="level-arrow">›</span>
        `;
      }

      btn.addEventListener('click', () => {
        this.selectLevel(lvl.key, true);
      });

      container.appendChild(btn);
    });
  }

  selectLevel(levelKey, applyCut = true) {
    this.currentLevelKey = levelKey;

    // Aktualizacja aktywnego przycisku w selektorze po lewej stronie
    const buttons = document.querySelectorAll('#level-picker .level-btn');
    buttons.forEach((b) => {
      const isActive = b.getAttribute('data-level-key') === levelKey;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });

    const level = getLevel(levelKey);

    // Dynamiczny przekrój poziomy 3D
    if (applyCut && typeof level.clipY === 'number') {
      const cutY = document.getElementById('slider-cut-y');
      const valY = document.getElementById('val-cut-y');
      if (level.key === WHOLE_BUILDING.key) {
        this.viewer.sectionManager.setClipY(12.5);
        if (cutY) cutY.value = '11.5';
        if (valY) valY.textContent = 'WYŁ.';
      } else {
        this.viewer.sectionManager.setClipY(level.clipY);
        if (cutY) cutY.value = String(level.clipY);
        if (valY) valY.textContent = `Y = +${level.clipY.toFixed(2)} m`;
      }
    }

    // Wyświetlenie karty szczegółów kondygnacji w prawym panelu
    this.showLevelDetails(levelKey);
  }

  showLevelDetails(levelKey) {
    this.currentViewMode = 'level';
    const levelView = document.getElementById('details-level-view');
    const roomView = document.getElementById('details-room-view');
    const backBtn = document.getElementById('btn-details-back');
    const eyebrow = document.getElementById('details-eyebrow');

    if (roomView) roomView.classList.add('hidden');
    if (levelView) levelView.classList.remove('hidden');
    if (backBtn) backBtn.classList.add('hidden');

    if (levelKey === WHOLE_BUILDING.key) {
      if (eyebrow) eyebrow.textContent = 'Budynek';
      if (levelView) {
        levelView.innerHTML = `
          <div class="details-title-block">
            <span class="chip">Segment B (Północny)</span>
            <h3 class="details-title">Cały budynek</h3>
          </div>

          <div class="stat-grid">
            <div class="stat">
              <span class="stat-label">Pow. całkowita</span>
              <strong class="stat-val gold-text">222,7 m²</strong>
            </div>
            <div class="stat">
              <span class="stat-label">Zabudowa 1966</span>
              <strong class="stat-val">85,17 m²</strong>
            </div>
            <div class="stat">
              <span class="stat-label">Kubatura</span>
              <strong class="stat-val">614,0 m³</strong>
            </div>
          </div>

          <p class="details-desc">
            Modernistyczny segment bliźniaczy (1955 / 1966 / 2026). Tradycyjna konstrukcja murowana
            ze stropami Kleina na belkach stalowych I NP. Wybierz kondygnację po lewej stronie, aby zbadać jej rzut i pomieszczenia.
          </p>

          <span class="group-title mt-8">Kondygnacje budynku</span>
          <div class="rooms-chip-grid">
            ${LEVELS.map(
              (l) => `
              <button class="room-chip" type="button" data-select-level="${l.key}">
                <div class="room-chip-title">
                  <span class="room-name-text">${l.name}</span>
                  <span class="room-code-tag">${l.projElev} m</span>
                </div>
                <strong class="room-area-text">${l.area2026.toFixed(1).replace('.', ',')} m²</strong>
              </button>
            `
            ).join('')}
          </div>
        `;

        levelView.querySelectorAll('[data-select-level]').forEach((btn) => {
          btn.addEventListener('click', () => {
            this.selectLevel(btn.getAttribute('data-select-level'), true);
          });
        });
      }
      return;
    }

    const level = getLevel(levelKey);
    const rooms = getRoomsForLevel(levelKey);

    if (eyebrow) eyebrow.textContent = `Kondygnacja · ${level.projElev} m`;

    if (levelView) {
      levelView.innerHTML = `
        <div class="details-title-block">
          <span class="chip">${level.projElev} m (Y = ${level.worldY >= 0 ? '+' : ''}${level.worldY.toFixed(2)} m)</span>
          <h3 class="details-title">${level.name}</h3>
        </div>

        <div class="stat-grid">
          <div class="stat">
            <span class="stat-label">Pow. kondygnacji</span>
            <strong class="stat-val gold-text">${level.area2026.toFixed(1).replace('.', ',')} m²</strong>
          </div>
          <div class="stat">
            <span class="stat-label">Wysokość</span>
            <strong class="stat-val">${level.clearHeight.toFixed(2).replace('.', ',')} m</strong>
          </div>
          <div class="stat">
            <span class="stat-label">Pokoje</span>
            <strong class="stat-val">${rooms.length}</strong>
          </div>
        </div>

        <dl class="fact-list">
          <div class="fact">
            <dt>Konstrukcja stropu</dt>
            <dd>${level.structureAbove}</dd>
          </div>
        </dl>

        <p class="details-desc">${level.summary}</p>

        <span class="group-title mt-8">Pomieszczenia tej kondygnacji</span>
        <div class="rooms-chip-grid">
          ${rooms
            .map(
              (r) => `
            <button class="room-chip ${r.id === this.viewer.selectedRoomId ? 'active' : ''}" type="button" data-room-chip="${r.id}">
              <div class="room-chip-title">
                <span class="room-code-tag">${r.code}</span>
                <span class="room-name-text">${r.name}</span>
              </div>
              <strong class="room-area-text">${r.area2026.toFixed(1).replace('.', ',')} m²</strong>
            </button>
          `
            )
            .join('')}
        </div>
      `;

      levelView.querySelectorAll('[data-room-chip]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const roomId = btn.getAttribute('data-room-chip');
          this.viewer.selectRoomById(roomId, true);
        });
      });
    }
  }

  showRoomDetails(roomSpec) {
    this.currentViewMode = 'room';
    const levelView = document.getElementById('details-level-view');
    const roomView = document.getElementById('details-room-view');
    const backBtn = document.getElementById('btn-details-back');
    const backLabel = document.getElementById('details-back-label');
    const eyebrow = document.getElementById('details-eyebrow');

    if (levelView) levelView.classList.add('hidden');
    if (roomView) roomView.classList.remove('hidden');

    const level = getLevel(roomSpec.floorKey);
    this.currentLevelKey = roomSpec.floorKey;

    // Synchronizacja zaznaczenia w selektorze kondygnacji
    document.querySelectorAll('#level-picker .level-btn').forEach((b) => {
      const isActive = b.getAttribute('data-level-key') === roomSpec.floorKey;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });

    if (backBtn && backLabel) {
      backBtn.classList.remove('hidden');
      backLabel.textContent = level.name;
    }

    if (eyebrow) {
      eyebrow.textContent = `Pomieszczenie · ${level.name}`;
    }

    this.updateRoomInspector(roomSpec);
  }

  bindDetailsNavigation() {
    const backBtn = document.getElementById('btn-details-back');
    backBtn?.addEventListener('click', () => {
      this.showLevelDetails(this.currentLevelKey);
    });
  }

  // =========================================================================
  // ZARZĄDZANIE PANELAMI I TRYB ZEN
  // =========================================================================

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

    const zenBar = document.getElementById('zen-floating-bar');
    const showZenBar = allCollapsed || this.panelStates.top || Boolean(document.fullscreenElement);
    zenBar?.classList.toggle('hidden', !showZenBar);

    const zenRestoreBtn = document.getElementById('btn-zen-restore');
    if (zenRestoreBtn) {
      zenRestoreBtn.innerHTML = allCollapsed
        ? '👁️ Pokaż panele'
        : '👁️ Ukryj panele';
    }

    const headerZenBtn = document.getElementById('btn-zen-mode');
    headerZenBtn?.classList.toggle('active', allCollapsed);

    Object.entries(map).forEach(([key, objs]) => {
      if (!objs.dock) return;
      if (key === 'top' && showZenBar) {
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
    document.getElementById('btn-collapse-top')?.addEventListener('click', () => {
      this.setPanelCollapsed('top', true);
    });
    document.getElementById('dock-expand-top')?.addEventListener('click', () => {
      this.setPanelCollapsed('top', false);
    });

    document.getElementById('btn-collapse-left')?.addEventListener('click', () => {
      if (window.innerWidth > 768) {
        this.setPanelCollapsed('left', true);
      }
    });
    document.getElementById('dock-expand-left')?.addEventListener('click', () => {
      this.setPanelCollapsed('left', false);
    });

    document.getElementById('btn-collapse-right')?.addEventListener('click', () => {
      if (window.innerWidth > 768) {
        this.setPanelCollapsed('right', true);
      }
    });
    document.getElementById('dock-expand-right')?.addEventListener('click', () => {
      this.setPanelCollapsed('right', false);
    });

    document.getElementById('btn-collapse-bottom')?.addEventListener('click', () => {
      if (window.innerWidth > 768) {
        this.setPanelCollapsed('bottom', true);
      }
    });
    document.getElementById('dock-expand-bottom')?.addEventListener('click', () => {
      this.setPanelCollapsed('bottom', false);
    });
  }

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
        if (e.target.closest('button') && !e.target.closest('.btn-section-fold')) {
          return;
        }
        toggleSection();
      });
    });
  }

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
          this.toggleZenMode(true);
        } else {
          await document.exitFullscreen();
        }
      } catch (err) {
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
        zenFsBtn.innerHTML = isFs ? '⛶ Wyjdź' : '⛶ Pełny ekran';
      }
      this.setPanelCollapsed('top', this.panelStates.top);
    });

    zenTwinBtn?.addEventListener('click', () => {
      this.setTwinModeUI(!this.viewer.isTwinMode);
    });

    zenIsoBtn?.addEventListener('click', () => {
      this.viewer.cameraManager.setPreset('iso');
    });

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
    // 1. Exploded View
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

    // 2. Przekroje dynamiczne
    const cutY = document.getElementById('slider-cut-y');
    const valY = document.getElementById('val-cut-y');
    const applyCutY = (vFloat, syncPicker = true) => {
      const v = parseFloat(vFloat);
      if (cutY) cutY.value = String(v);
      if (v >= 11.45) {
        this.viewer.sectionManager.setClipY(12.5);
        if (valY) valY.textContent = 'WYŁ.';
      } else {
        this.viewer.sectionManager.setClipY(v);
        if (valY) valY.textContent = `Y = +${v.toFixed(2)} m`;
      }

      if (syncPicker) {
        const detectedKey = levelKeyForClipY(v);
        if (detectedKey !== this.currentLevelKey) {
          this.currentLevelKey = detectedKey;
          document.querySelectorAll('#level-picker .level-btn').forEach((b) => {
            const isActive = b.getAttribute('data-level-key') === detectedKey;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-checked', isActive ? 'true' : 'false');
          });
          this.showLevelDetails(detectedKey);
        }
      }
    };

    cutY?.addEventListener('input', (e) => applyCutY(e.target.value, true));

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
      this.selectLevel(WHOLE_BUILDING.key, false);
    });

    // 3. Heliodon
    const sunSlider = document.getElementById('slider-sun-time');
    const sunVal = document.getElementById('val-sun-time');
    sunSlider?.addEventListener('input', (e) => {
      const h = parseFloat(e.target.value);
      this.viewer.setSunHour(h);
      const hrs = Math.floor(h);
      const mins = Math.round((h - hrs) * 60);
      const timeStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      if (sunVal) sunVal.textContent = timeStr;
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
      xrayBtn.textContent = active ? '🔍 Rentgen: WŁ.' : '🔍 Rentgen konstrukcji';
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

  // =========================================================================
  // MENU DROPDOWN & MOBILE NAVIGATION (SHEETS)
  // =========================================================================

  bindMoreMenu() {
    const moreBtn = document.getElementById('btn-more-menu');
    const moreMenu = document.getElementById('more-menu');
    if (!moreBtn || !moreMenu) return;

    const toggleMenu = (forceState) => {
      const isHidden = moreMenu.classList.contains('hidden');
      const show = typeof forceState === 'boolean' ? forceState : isHidden;
      moreMenu.classList.toggle('hidden', !show);
      moreBtn.setAttribute('aria-expanded', show ? 'true' : 'false');
    };

    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    document.addEventListener('click', (e) => {
      if (!moreMenu.contains(e.target) && e.target !== moreBtn) {
        toggleMenu(false);
      }
    });

    moreMenu.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        toggleMenu(false);
      });
    });
  }

  bindMobileNavigation() {
    const mobileButtons = document.querySelectorAll('#mobile-nav .mnav-btn');
    const sidebars = {
      left: document.getElementById('left-sidebar'),
      right: document.getElementById('right-sidebar'),
      bottom: document.getElementById('bottom-bar'),
    };

    const closeAllMobileSheets = () => {
      Object.values(sidebars).forEach((sb) => sb?.classList.remove('sheet-open'));
      mobileButtons.forEach((btn) => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      });
    };

    mobileButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const sheetKey = btn.getAttribute('data-sheet');
        const target = sidebars[sheetKey];
        if (!target) return;

        const isCurrentlyOpen = target.classList.contains('sheet-open');
        closeAllMobileSheets();

        if (!isCurrentlyOpen) {
          target.classList.add('sheet-open');
          target.classList.remove('collapsed');
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
        }
      });
    });

    // Przyciski zamykania w nagłówkach paneli
    document.getElementById('btn-collapse-left')?.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeAllMobileSheets();
    });
    document.getElementById('btn-collapse-right')?.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeAllMobileSheets();
    });
    document.getElementById('btn-collapse-bottom')?.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeAllMobileSheets();
    });
  }
}
