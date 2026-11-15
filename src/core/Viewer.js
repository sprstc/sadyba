/**
 * src/core/Viewer.js
 * Główny silnik sceny 3D Three.js dla Cyfrowego Bliźniaka przy Segmentu Bliźniaczego (1955 / 1966 / 2026).
 * Integruje konstrukcję Segmentu B + Bliźniaka A, Heliodon, Exploded View, przekroje X/Y/Z,
 * Raycasting inspektora pomieszczeń, Miarkę 3D oraz projekcję etykiet wymiarowych.
 */

import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { ELEVATIONS, ROOMS_SPEC } from '../data/houseSpec.js';
import { MaterialsManager } from '../models/Materials.js';
import { FoundationBuilder } from '../models/FoundationBuilder.js';
import { FloorKleinBuilder } from '../models/FloorKleinBuilder.js';
import { BuildingBuilder } from '../models/BuildingBuilder.js';
import { RoofTrussBuilder } from '../models/RoofTrussBuilder.js';
import { SurroundingsBuilder } from '../models/SurroundingsBuilder.js';
import { HumanAvatar } from './HumanAvatar.js';
import { DoorManager } from './DoorManager.js';
import { SectionManager } from './SectionManager.js';
import { CameraManager } from './CameraManager.js';

export class Viewer {
  constructor(container, labelsContainer, callbacks = {}) {
    this.container = container;
    this.labelsContainer = labelsContainer;
    this.callbacks = callbacks;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1118);
    this.scene.fog = new THREE.FogExp2(0x0c1118, 0.008);

    const isMobile =
      /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.innerWidth <= 768 && 'ontouchstart' in window);
    this.isMobile = isMobile;

    const width = this.container.clientWidth || window.innerWidth || 800;
    const height = this.container.clientHeight || window.innerHeight || 600;
    const aspect = width / (height || 1);

    this.camera = new THREE.PerspectiveCamera(
      aspect < 1.0 ? 56 : 46,
      aspect,
      0.06,
      260
    );

    const rendererOptions = {
      antialias: !isMobile,
      powerPreference: isMobile ? 'default' : 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    };

    try {
      this.renderer = new THREE.WebGLRenderer(rendererOptions);
    } catch (e1) {
      console.warn('Pierwotna inicjalizacja WebGLRenderer nie powiodła się, fallback:', e1);
      this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'default' });
    }

    this._lastW = width;
    this._lastH = height;
    this.contextLost = false;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 2));
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x0c1118, 1);
    this.renderer.shadowMap.enabled = !isMobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.canvas = this.renderer.domElement;
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.touchAction = 'none';
    this.canvas.style.backgroundColor = '#0c1118';
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);

    // Bezpieczna obsługa utraty i przywrócenia kontekstu GPU na urządzeniach mobilnych
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.contextLost = true;
      console.warn('Three.js: WebGL Context Lost.');
    }, false);

    this.canvas.addEventListener('webglcontextrestored', () => {
      console.info('Three.js: WebGL Context Restored.');
      this.contextLost = false;
      this.renderer.render(this.scene, this.camera);
    }, false);

    this.materials = new MaterialsManager();
    this.sectionManager = new SectionManager(this.renderer);

    this.avatar = new HumanAvatar();
    this.scene.add(this.avatar.group);

    this.cameraManager = new CameraManager(
      this.camera,
      this.canvas,
      this.avatar,
      (hudData) => {
        if (
          hudData.walkMode &&
          typeof hudData.playerY === 'number' &&
          this.sectionManager &&
          this.sectionManager.state.y < hudData.playerY + 2.1
        ) {
          this.sectionManager.setClipY(12.5);
        }
        if (this.callbacks.onWalkHudUpdate) this.callbacks.onWalkHudUpdate(hudData);
      }
    );

    this.doorManager = new DoorManager(this.cameraManager.soundEngine);
    this.cameraManager.setDoorManager(this.doorManager);

    this.layerStates = {
      roofCover: true,
      roofTruss: true,
      atticWalls: true,
      firstFloor: true,
      groundFloor: true,
      kleinSlabs: true,
      basement: true,
      interiors: true,
      vines: true,
      utilityPole: true,
      surroundings: true,
      dimensions: false,
    };

    this.layerMap = {};
    this.interactiveRooms = [];
    this.selectedRoomId = 'g-salon';

    this.isTwinMode = false;
    this.eraMode = '1966';
    this.explodeFactor = 0.0;

    // Stan Miarki 3D
    this.measureMode = false;
    this.measurePoints = [];
    this.measureGroup = new THREE.Group();
    this.measureGroup.name = 'Measure3D_Visuals';
    this.scene.add(this.measureGroup);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.pointerDownPos = new THREE.Vector2();

    this.clock = new THREE.Clock();

    this.setupLighting();
    this.buildSurroundingsAndDimensions();
    this.buildHouseSegments(true);
    this.bindInteractionEvents();
  }

  /**
   * Oświetlenie nieba, słońca z miękkimi cieniami PCF (Heliodon) oraz ciepłe światło wnętrz
   */
  setupLighting() {
    this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x334155, 0.74);
    this.hemiLight.position.set(0, 32, 0);
    this.scene.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.34);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    this.sunLight.castShadow = !this.isMobile;
    if (!this.isMobile) {
      this.sunLight.shadow.mapSize.width = 2048;
      this.sunLight.shadow.mapSize.height = 2048;
      this.sunLight.shadow.camera.near = 1.0;
      this.sunLight.shadow.camera.far = 80.0;
      const d = 22;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.sunLight.shadow.bias = -0.0005;
    }
    this.scene.add(this.sunLight);

    // Ciepłe doświetlenie wnętrz parteru i piętra
    const interiorLightGF = new THREE.PointLight(0xffedd5, 0.75, 14);
    interiorLightGF.position.set(-1.5, ELEVATIONS.GROUND_FLOOR + 2.3, -2.5);
    this.scene.add(interiorLightGF);

    const interiorLightFF = new THREE.PointLight(0xffedd5, 0.65, 14);
    interiorLightFF.position.set(-1.5, ELEVATIONS.FIRST_FLOOR + 2.1, -2.5);
    this.scene.add(interiorLightFF);

    this.setSunHour(14.5);
  }

  /**
   * Heliodon – ustawia pozycję słońca dla szerokości geograficznej 52.2°N
   */
  setSunHour(hourFloat) {
    const h = THREE.MathUtils.clamp(parseFloat(hourFloat), 6.0, 20.0);
    const progress = (h - 6.0) / 14.0; // 0 .. 1
    const azimuth = progress * Math.PI; // 0 (+X Wschód) -> PI/2 (+Z Południe) -> PI (-X Zachód)
    const elevation = Math.sin(progress * Math.PI) * 1.05 + 0.14;

    const radius = 34;
    const sx = Math.cos(azimuth) * Math.cos(elevation) * radius;
    const sy = Math.sin(elevation) * radius;
    const sz = Math.sin(azimuth) * Math.cos(elevation) * radius;

    this.sunLight.position.set(sx, sy, sz);

    const warmth = Math.sin(progress * Math.PI);
    this.sunLight.intensity = 1.15 + warmth * 1.25;
    this.sunLight.color.setHSL(0.08 + warmth * 0.03, 0.65 - warmth * 0.35, 0.65 + warmth * 0.3);

    const skyLum = 0.055 + warmth * 0.055;
    this.scene.background.setHSL(0.6, 0.35, skyLum);
    this.scene.fog.color.copy(this.scene.background);
  }

  /**
   * Buduje otoczenie działki (10.52 x 30.13 m), ulicę frontową, słup ŻN i linie wymiarowe 3D
   */
  buildSurroundingsAndDimensions() {
    const surroundingsBuilder = new SurroundingsBuilder(this.materials);
    const {
      surroundingsGroup,
      segASurroundings,
      utilityPoleGroup,
      dimensionsGroup,
      labelAnchors,
    } = surroundingsBuilder.build();

    this.surroundingsGroup = surroundingsGroup;
    this.segASurroundings = segASurroundings;
    this.segASurroundings.visible = this.isTwinMode;
    this.utilityPoleGroup = utilityPoleGroup;
    this.dimensionsGroup = dimensionsGroup;
    this.labelAnchors = labelAnchors;

    this.scene.add(surroundingsGroup, utilityPoleGroup, dimensionsGroup);
  }

  /**
   * Buduje lub przebudowuje bryłę Segmentu B (Segment B) oraz lustrzanego Segmentu A (Segment A)
   * w wybranym wariancie historycznym (includeVeranda1966 = true dla 1966/2026 lub false dla 1955).
   */
  buildHouseSegments(includeVeranda1966 = true) {
    if (this.segmentBRoot) {
      this.scene.remove(this.segmentBRoot);
    }
    if (this.segmentARoot) {
      this.scene.remove(this.segmentARoot);
    }

    this.segmentBRoot = new THREE.Group();
    this.segmentBRoot.name = 'SegmentB_SegmentB';
    this.scene.add(this.segmentBRoot);

    const opts = { includeVeranda1966 };

    // 1. Fundamenty, piwnice, garaże i kotłownia (-0.92 m)
    const foundationBuilder = new FoundationBuilder(this.materials);
    const {
      basementGroup,
      interiorsGroup: basementInteriorsGroup,
    } = foundationBuilder.build(opts);
    basementGroup.userData.explodeLevel = -0.35;
    basementInteriorsGroup.userData.explodeLevel = -0.35;
    this.segmentBRoot.add(basementGroup, basementInteriorsGroup);

    // 2. Stropy Kleina (I NP 24 / 22 / 18 + wymian I NP 14 + płyty ceramiczne)
    const kleinBuilder = new FloorKleinBuilder(this.materials);
    const { kleinGroup } = kleinBuilder.build(opts);
    this.segmentBRoot.add(kleinGroup);

    // 3. Kondygnacje naziemne (Parter, I Piętro, Poddasze, Schody zabiegowe, Stolarka, Wnętrza, Winorośl)
    const buildingBuilder = new BuildingBuilder(this.materials);
    const {
      groundFloorGroup,
      firstFloorGroup,
      atticWallsGroup,
      interiorsGroup,
      vinesGroup,
      interactiveRooms,
    } = buildingBuilder.build(opts);

    this.interactiveRooms = interactiveRooms;
    this.segmentBRoot.add(
      groundFloorGroup,
      firstFloorGroup,
      atticWallsGroup,
      interiorsGroup,
      vinesGroup
    );

    // 4. Więźba dachowa stolcowo-kleszczowa, Komin 7-przewodowy i Pokrycie dachu z lukarnami
    const roofBuilder = new RoofTrussBuilder(this.materials);
    const { roofTrussGroup, roofCoverGroup } = roofBuilder.build();
    this.segmentBRoot.add(roofTrussGroup, roofCoverGroup);

    // Zapisz bazowe rzędne Y na potrzeby Exploded View
    this.segmentBRoot.traverse((child) => {
      if (child.userData && typeof child.userData.explodeLevel === 'number') {
        child.userData.baseY = child.position.y;
      }
    });

    // 5. Lustrzany Segment A (południowy bliźniak) – odbicie w osi dylatacji Z = 0.00 m
    this.segmentARoot = this.segmentBRoot.clone(true);
    this.segmentARoot.name = 'SegmentA_TwinMirror';
    this.segmentARoot.scale.set(1, 1, -1);
    this.segmentARoot.visible = this.isTwinMode;
    this.scene.add(this.segmentARoot);

    this.segmentARoot.traverse((child) => {
      if (child.userData && typeof child.userData.explodeLevel === 'number') {
        child.userData.baseY = child.position.y;
      }
    });

    // Powiązanie warstw z przełącznikami w UI
    this.layerMap = {
      roofCover: [roofCoverGroup, this.segmentARoot.getObjectByName('Layer_RoofCover')],
      roofTruss: [roofTrussGroup, this.segmentARoot.getObjectByName('Layer_RoofTruss')],
      atticWalls: [atticWallsGroup, this.segmentARoot.getObjectByName('Layer_AtticWalls')],
      firstFloor: [firstFloorGroup, this.segmentARoot.getObjectByName('Layer_FirstFloor')],
      groundFloor: [groundFloorGroup, this.segmentARoot.getObjectByName('Layer_GroundFloor')],
      kleinSlabs: [kleinGroup, this.segmentARoot.getObjectByName('Layer_Klein_Slabs')],
      basement: [basementGroup, this.segmentARoot.getObjectByName('Layer_Basement')],
      interiors: [
        interiorsGroup,
        basementInteriorsGroup,
        this.segmentARoot.getObjectByName('Layer_Interiors'),
        this.segmentARoot.getObjectByName('Layer_Basement_Interiors'),
      ],
      vines: [vinesGroup, this.segmentARoot.getObjectByName('Layer_Vines')],
      utilityPole: [this.utilityPoleGroup],
      surroundings: [this.surroundingsGroup],
      dimensions: [this.dimensionsGroup],
    };

    // Uzupełnienie trawnika z 1955 r. zamiast werandy z 1966 r.
    if (this.surroundingsGroup) {
      const patchB = this.surroundingsGroup.getObjectByName('Grass_Infill_1955_B');
      const patchA = this.surroundingsGroup.getObjectByName('Grass_Infill_1955_A');
      if (patchB) patchB.visible = !includeVeranda1966;
      if (patchA) patchA.visible = !includeVeranda1966;
    }

    // Przywróć aktualny stan widoczności warstw i Exploded View bez wielokrotnej odbudowy Octree
    this._suppressColliderRebuild = true;
    Object.entries(this.layerStates).forEach(([key, vis]) => {
      this.setLayerVisibility(key, vis);
    });
    this.setExplodedFactor(this.explodeFactor);
    this._suppressColliderRebuild = false;

    if (this.selectedRoomId) {
      this.selectRoomById(this.selectedRoomId, false);
    }

    this.updateWalkColliders();
  }

  /**
   * Zbiera interaktywne drzwi oraz buduje trójkątne drzewo kolizji Octree całej sceny
   * (ściany, stropy, schody, połacie dachu, meble i teren z uwzględnieniem odbicia lustrzanego Segmentu A).
   */
  updateWalkColliders() {
    if (!this.cameraManager || !this.segmentBRoot) return;

    const t0 = performance.now();
    this.scene.updateMatrixWorld(true);

    const doorRoots = [this.segmentBRoot];
    if (this.surroundingsGroup) doorRoots.push(this.surroundingsGroup);
    if (this.isTwinMode && this.segmentARoot) doorRoots.push(this.segmentARoot);

    if (this.doorManager) {
      this.doorManager.collectDoors(doorRoots, this.scene);
    }

    const hasFlagInAncestors = (obj, flagName) => {
      let cur = obj;
      while (cur && cur !== this.scene) {
        if (cur.userData && cur.userData[flagName]) return true;
        cur = cur.parent;
      }
      return false;
    };

    const isHierarchyVisible = (obj) => {
      let cur = obj;
      while (cur && cur !== this.scene) {
        if (!cur.visible) return false;
        cur = cur.parent;
      }
      return true;
    };

    const isInsideLayer = (obj, layerName) => {
      let cur = obj;
      while (cur && cur !== this.scene) {
        if (cur.name === layerName) return true;
        cur = cur.parent;
      }
      return false;
    };

    const mats = this.materials.materials || {};
    const woodMats = new Set([
      mats.oakParquet,
      mats.oakStairs,
      mats.atticPineFloor,
      mats.wainscotingWood,
      mats.doorWood,
      mats.roofTimber,
      mats.windowFrameWhite,
    ]);
    const tileMats = new Set([
      mats.terrazzo,
      mats.verandaMosaic,
      mats.terraceTiles,
      mats.clinkerStairs,
      mats.roofTileKarpiowka,
      mats.ridgeTileMat,
    ]);
    const glassMats = new Set([mats.glassClear, mats.glassOrnamental]);

    const classifySurface = (mat) => {
      if (!mat) return 'concrete';
      if (mat === mats.grass) return 'grass';
      if (woodMats.has(mat)) return 'wood';
      if (tileMats.has(mat)) return 'tile';
      return 'concrete';
    };

    const worldOctree = new Octree();
    const roots = [this.segmentBRoot];
    if (this.surroundingsGroup) roots.push(this.surroundingsGroup);
    if (this.utilityPoleGroup) roots.push(this.utilityPoleGroup);
    if (this.isTwinMode && this.segmentARoot) roots.push(this.segmentARoot);

    const _v1 = new THREE.Vector3();
    const _v2 = new THREE.Vector3();
    const _v3 = new THREE.Vector3();
    const _e1 = new THREE.Vector3();
    const _e2 = new THREE.Vector3();

    const addTri = (a, b, c, surfaceType, isWindowGlass, isInvisibleCollider) => {
      _e1.subVectors(b, a);
      _e2.subVectors(c, a);
      if (_e1.cross(_e2).lengthSq() < 1e-10) return;

      const tri = new THREE.Triangle(a.clone(), b.clone(), c.clone());
      tri.surfaceType = surfaceType;
      tri.isWindowGlass = isWindowGlass;
      tri.isInvisibleCollider = isInvisibleCollider;
      worldOctree.addTriangle(tri);
    };

    for (const root of roots) {
      if (!root || !root.visible) continue;
      root.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;
        if (!isHierarchyVisible(child)) return;
        if (child.userData && child.userData.roomSpec) return;
        if (isInsideLayer(child, 'Layer_Vines') || isInsideLayer(child, 'Layer_Dimensions')) return;
        if (hasFlagInAncestors(child, 'isInteractiveDoor')) return;
        if (child.geometry.type === 'TorusGeometry') return;

        const posAttr = child.geometry.attributes?.position;
        if (!posAttr || posAttr.count < 3) return;

        const mat = Array.isArray(child.material) ? child.material[0] : child.material;
        const surfaceType = classifySurface(mat);
        const isInvisibleCollider = Boolean(mat && mat.visible === false);
        const isWindowGlass = Boolean(child.userData?.isGlassPane || (mat && glassMats.has(mat)));

        const matrix = child.matrixWorld;
        const flipWinding = matrix.determinant() < 0;
        const index = child.geometry.index;

        if (index) {
          const count = index.count;
          for (let i = 0; i + 2 < count; i += 3) {
            _v1.fromBufferAttribute(posAttr, index.getX(i)).applyMatrix4(matrix);
            _v2.fromBufferAttribute(posAttr, index.getX(i + 1)).applyMatrix4(matrix);
            _v3.fromBufferAttribute(posAttr, index.getX(i + 2)).applyMatrix4(matrix);
            if (flipWinding) {
              addTri(_v1, _v3, _v2, surfaceType, isWindowGlass, isInvisibleCollider);
            } else {
              addTri(_v1, _v2, _v3, surfaceType, isWindowGlass, isInvisibleCollider);
            }
          }
        } else {
          const count = posAttr.count;
          for (let i = 0; i + 2 < count; i += 3) {
            _v1.fromBufferAttribute(posAttr, i).applyMatrix4(matrix);
            _v2.fromBufferAttribute(posAttr, i + 1).applyMatrix4(matrix);
            _v3.fromBufferAttribute(posAttr, i + 2).applyMatrix4(matrix);
            if (flipWinding) {
              addTri(_v1, _v3, _v2, surfaceType, isWindowGlass, isInvisibleCollider);
            } else {
              addTri(_v1, _v2, _v3, surfaceType, isWindowGlass, isInvisibleCollider);
            }
          }
        }
      });
    }

    // Zewnętrzna siatka bezpieczeństwa podłoża Y = -0.002 m z wycięciem na piwnice i pochylnie garażowe
    const xRear = this.eraMode === '1966' ? -8.20 : -5.50;
    const xs = [-45, xRear, 5.50, 10.50, 45];
    const zs = [-45, -6.08, -5.60, -2.70, 0.00, 2.70, 5.60, 6.08, 45];
    const groundY = -0.002;
    const hasBasement = Boolean(this.layerStates.basement);

    for (let xi = 0; xi < xs.length - 1; xi++) {
      const x0 = xs[xi];
      const x1 = xs[xi + 1];
      const cx = (x0 + x1) * 0.5;
      for (let zi = 0; zi < zs.length - 1; zi++) {
        const z0 = zs[zi];
        const z1 = zs[zi + 1];
        const cz = (z0 + z1) * 0.5;

        if (hasBasement) {
          const inBHouse = cx > xRear && cx < 5.50 && cz > -6.08 && cz < 0.00;
          const inBRamp = cx > 5.50 && cx < 10.50 && cz > -5.60 && cz < -2.70;
          if (inBHouse || inBRamp) continue;

          if (this.isTwinMode) {
            const inAHouse = cx > xRear && cx < 5.50 && cz > 0.00 && cz < 6.08;
            const inARamp = cx > 5.50 && cx < 10.50 && cz > 2.70 && cz < 5.60;
            if (inAHouse || inARamp) continue;
          }
        }

        const p00 = new THREE.Vector3(x0, groundY, z0);
        const p01 = new THREE.Vector3(x0, groundY, z1);
        const p11 = new THREE.Vector3(x1, groundY, z1);
        const p10 = new THREE.Vector3(x1, groundY, z0);
        addTri(p00, p01, p11, 'grass', false, false);
        addTri(p00, p11, p10, 'grass', false, false);
      }
    }

    worldOctree.build();
    this._lastOctreeBuildMs = performance.now() - t0;

    this.cameraManager.setColliders({
      worldOctree,
      isTwinMode: this.isTwinMode,
    });
  }

  /**
   * Przełącznik: Pojedynczy Segment B (Segment B) vs Cały Bliźniak (Segment A + B)
   */
  setTwinMode(enabled) {
    this.isTwinMode = Boolean(enabled);
    if (this.segmentARoot) this.segmentARoot.visible = this.isTwinMode;
    if (this.segASurroundings) this.segASurroundings.visible = this.isTwinMode;
    this.setExplodedFactor(this.explodeFactor);
    this.updateWalkColliders();
    if (this.cameraManager) {
      this.cameraManager.setOrbitCenterForTwinMode(this.isTwinMode);
    }
  }

  /**
   * Przełącznik wariantu historycznego: '1966' (z werandą i drugim garażem) vs '1955' (projekt pierwotny)
   */
  setEraMode(era) {
    if (this.eraMode === era) return;
    this.eraMode = era;
    this.buildHouseSegments(era === '1966');
  }

  /**
   * Suwak Exploded View (rozstrzelenie kondygnacji i stropów Kleina w osi Y)
   */
  setExplodedFactor(factor) {
    this.explodeFactor = THREE.MathUtils.clamp(parseFloat(factor), 0, 1);
    const maxOffsetPerLevel = 2.65;

    const applyExplode = (root) => {
      if (!root) return;
      root.traverse((child) => {
        if (child.userData && typeof child.userData.explodeLevel === 'number') {
          const baseY = child.userData.baseY || 0;
          child.position.y =
            baseY + child.userData.explodeLevel * this.explodeFactor * maxOffsetPerLevel;
        }
      });
    };

    applyExplode(this.segmentBRoot);
    applyExplode(this.segmentARoot);
    if (!this._suppressColliderRebuild) this.updateWalkColliders();
  }

  /**
   * Włącza/wyłącza widoczność wybranej warstwy konstrukcyjnej
   */
  setLayerVisibility(layerKey, visible) {
    this.layerStates[layerKey] = Boolean(visible);

    const targets = this.layerMap[layerKey];
    if (targets) {
      targets.forEach((obj) => {
        if (obj) obj.visible = Boolean(visible);
      });
    }
    if (!this._suppressColliderRebuild) this.updateWalkColliders();
  }

  /**
   * Przełącza tryb „Rentgen Kleina” (X-Ray)
   */
  toggleXRayMode() {
    const next = !this.materials.xrayActive;
    this.materials.setXRayMode(next);
    return next;
  }

  handleResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    if (width === 0 || height === 0) return;
    if (width === this._lastW && height === this._lastH) return;
    this._lastW = width;
    this._lastH = height;
    const aspect = width / height;
    this.camera.aspect = aspect;
    if (aspect < 1.0 && this.camera.fov < 50) {
      this.camera.fov = 56;
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  bindInteractionEvents() {
    window.addEventListener('resize', () => {
      this.handleResize();
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.handleResize(), 150);
      setTimeout(() => this.handleResize(), 400);
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      this.pointerDownPos.set(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('pointerup', (e) => {
      const moveDist = Math.hypot(
        e.clientX - this.pointerDownPos.x,
        e.clientY - this.pointerDownPos.y
      );
      if (moveDist > 5 || e.button !== 0) return;
      if (this.cameraManager.walkMode) return;

      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      if (this.measureMode) {
        this.handleMeasureClick();
      } else {
        this.handleRoomInspectionClick();
      }
    });
  }

  handleRoomInspectionClick() {
    const intersects = this.raycaster.intersectObjects(this.interactiveRooms, false);
    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      const roomSpec = hitMesh.userData.roomSpec;
      if (roomSpec) {
        this.selectRoomById(roomSpec.id, false);
      }
    }
  }

  /**
   * Podświetla wybrane pomieszczenie w 3D i przekazuje jego metrykę do UIManager
   */
  selectRoomById(roomId, moveCamera = true) {
    const roomSpec = ROOMS_SPEC.find((r) => r.id === roomId);
    if (!roomSpec) return;

    this.selectedRoomId = roomId;

    // Zaktualizuj podświetlenie padów w interactiveRooms
    for (const pad of this.interactiveRooms) {
      const isSelected = pad.userData.roomSpec && pad.userData.roomSpec.id === roomId;
      pad.material.opacity = isSelected ? 0.28 : 0.0;
      if (pad.userData.highlightEdges) {
        pad.userData.highlightEdges.material.opacity = isSelected ? 0.95 : 0.0;
      }
    }

    if (moveCamera) {
      this.cameraManager.focusOnRoom(roomSpec);
    }

    if (this.callbacks.onRoomSelected) {
      this.callbacks.onRoomSelected(roomSpec);
    }
  }

  setMeasureMode(enabled) {
    this.measureMode = Boolean(enabled);
    if (!this.measureMode) {
      this.clearMeasurements();
    }
  }

  clearMeasurements() {
    this.measurePoints = [];
    while (this.measureGroup.children.length > 0) {
      this.measureGroup.remove(this.measureGroup.children[0]);
    }
    if (this.callbacks.onMeasureUpdate) {
      this.callbacks.onMeasureUpdate(null);
    }
  }

  handleMeasureClick() {
    const targets = [this.segmentBRoot, this.surroundingsGroup];
    if (this.isTwinMode) targets.push(this.segmentARoot);

    const hits = this.raycaster.intersectObjects(targets, true);
    const validHit = hits.find(
      (h) => h.object.visible && !h.object.userData.roomSpec
    );
    if (!validHit) return;

    const pt = validHit.point.clone();

    if (this.measurePoints.length >= 2) {
      this.clearMeasurements();
    }

    this.measurePoints.push(pt);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    marker.position.copy(pt);
    this.measureGroup.add(marker);

    if (this.measurePoints.length === 1) {
      if (this.callbacks.onMeasureUpdate) {
        this.callbacks.onMeasureUpdate({
          statusText: 'Punkt 1 zapisany. Kliknij drugi punkt na modelu...',
          firstPointOnly: true,
        });
      }
    } else if (this.measurePoints.length === 2) {
      const [p1, p2] = this.measurePoints;
      const lineGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0xf0ca50 });
      this.measureGroup.add(new THREE.Line(lineGeom, lineMat));

      const distTotal = p1.distanceTo(p2);
      const dx = Math.abs(p2.x - p1.x);
      const dy = Math.abs(p2.y - p1.y);
      const dz = Math.abs(p2.z - p1.z);

      if (this.callbacks.onMeasureUpdate) {
        this.callbacks.onMeasureUpdate({
          statusText: 'Pomiar ukończony (kliknij ponownie, aby rozpocząć nowy):',
          total: distTotal,
          dx,
          dy,
          dz,
        });
      }
    }
  }

  start() {
    const animate = () => {
      requestAnimationFrame(animate);
      if (this.contextLost) return;
      const dt = Math.min(this.clock.getDelta(), 0.1);

      if (this.doorManager) {
        this.doorManager.update(
          dt,
          this.cameraManager.playerPos,
          this.cameraManager.walkMode && !this.cameraManager.noclip
        );
      }

      this.cameraManager.update(dt);

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
}
