/**
 * ============================================================================
 * src/models/FoundationBuilder.js
 * Konstruktor podziemia, ław fundamentowych (bankietów), garaży, cokołu
 * zewnętrznego (+1.60 m), żelbetowych schodów piwnicznych oraz kotłowni.
 * ============================================================================
 */

import * as THREE from 'three';
import { ELEVATIONS, WALL_THICKNESS, BUILDING_DIMS } from '../data/houseSpec.js';

export class FoundationBuilder {
  constructor(materialsManager) {
    this.mats = materialsManager.materials;
  }

  /**
   * Buduje kompletny zespół podziemia i fundamentów dla jednego segmentu.
   * @param {Object} options - { includeVeranda1966: boolean }
   * @returns {{ basementGroup: THREE.Group, interiorsGroup: THREE.Group, walkables: THREE.Object3D[] }}
   */
  build(options = { includeVeranda1966: true }) {
    const basementGroup = new THREE.Group();
    basementGroup.name = 'Layer_Basement';

    const interiorsGroup = new THREE.Group();
    interiorsGroup.name = 'Layer_Basement_Interiors';

    const walkables = [];

    const yFootBottom = ELEVATIONS.FOUNDATION_BOTTOM; // -1.55 m
    const yFloor = ELEVATIONS.BASEMENT_FLOOR;         // -0.92 m
    const yCeil = ELEVATIONS.BASEMENT_CEILING;        // +1.30 m
    const wallH = yCeil - yFloor;                     // 2.22 m
    const footH = yFloor - yFootBottom;               // 0.63 m

    const xFront = BUILDING_DIMS.X_FRONT_FACE;        // +5.50 m
    const xMainRear = BUILDING_DIMS.X_MAIN_REAR_FACE; // -5.50 m
    const xVeranda = BUILDING_DIMS.X_VERANDA_FACE;    // -8.20 m
    const xWestEnd = options.includeVeranda1966 ? xVeranda : xMainRear;

    const zSouth = BUILDING_DIMS.Z_PARTY_AXIS;        // 0.00 m
    const zNorth = BUILDING_DIMS.Z_NORTH_FACE;        // -6.08 m
    const tExt = WALL_THICKNESS.BASEMENT_EXT;         // 0.51 m

    // 1. Ławy fundamentowe (bankiety z betonu Rw=110 wg str. 10-11 obl. stat. 1955)
    const footingsGroup = new THREE.Group();
    footingsGroup.name = 'Footings_1955';

    const addFooting = (x1, z1, x2, z2, width) => {
      const lenX = Math.abs(x2 - x1);
      const lenZ = Math.abs(z2 - z1);
      const isAlongX = lenX >= lenZ;
      const sx = isAlongX ? lenX + width : width;
      const sz = isAlongX ? width : lenZ + width;
      const geo = new THREE.BoxGeometry(sx, footH, sz);
      const mesh = new THREE.Mesh(geo, this.mats.foundationConcrete);
      mesh.position.set((x1 + x2) * 0.5, yFootBottom + footH * 0.5, (z1 + z2) * 0.5);
      mesh.receiveShadow = true;
      footingsGroup.add(mesh);
    };

    // Obwód ław zewnętrznych (szer. 69-85 cm) i ława kominowa (145 cm wg str. 11 obl. 1955)
    addFooting(xFront - 0.25, zSouth, xFront - 0.25, zNorth, WALL_THICKNESS.FOUNDATION_FOOTING_EXT);
    addFooting(xWestEnd + 0.25, zSouth, xWestEnd + 0.25, zNorth, WALL_THICKNESS.FOUNDATION_FOOTING_EXT);
    addFooting(xWestEnd, zNorth + 0.25, xFront, zNorth + 0.25, WALL_THICKNESS.FOUNDATION_FOOTING_INT);
    addFooting(xWestEnd, zSouth - 0.45, xFront, zSouth - 0.45, WALL_THICKNESS.FOUNDATION_CHIMNEY);
    addFooting(-1.05, zSouth, -1.05, zNorth, WALL_THICKNESS.FOUNDATION_FOOTING_INT);
    basementGroup.add(footingsGroup);

    // 2. Posadzka betonowa podziemia głównego (Y = -0.92 m, X od -5.50 do +5.50 m)
    const mainDepth = xFront - xMainRear;
    const floorGeo = new THREE.BoxGeometry(mainDepth, 0.14, BUILDING_DIMS.SEGMENT_WIDTH);
    const floorMesh = new THREE.Mesh(floorGeo, this.mats.basementFloor);
    floorMesh.position.set((xFront + xMainRear) * 0.5, yFloor - 0.07, -BUILDING_DIMS.SEGMENT_WIDTH * 0.5);
    floorMesh.receiveShadow = true;
    basementGroup.add(floorMesh);
    walkables.push(floorMesh);

    // Posadzka wykończona w pomieszczeniu użytkowym pod werandą (12,48 m²: X od -8.20 do -5.50 m)
    if (options.includeVeranda1966) {
      const verandaSubDepth = Math.abs(xMainRear - xVeranda);
      const verandaSubFloorGeo = new THREE.BoxGeometry(verandaSubDepth, 0.15, BUILDING_DIMS.SEGMENT_WIDTH - 0.50);
      const verandaSubFloorMesh = new THREE.Mesh(verandaSubFloorGeo, this.mats.terrazzo);
      verandaSubFloorMesh.position.set(
        (xMainRear + xVeranda) * 0.5,
        yFloor - 0.06,
        -BUILDING_DIMS.SEGMENT_WIDTH * 0.5
      );
      verandaSubFloorMesh.receiveShadow = true;
      verandaSubFloorMesh.name = 'Posadzka pomieszczenia użytkowego pod werandą (12,48 m²)';
      basementGroup.add(verandaSubFloorMesh);
      walkables.push(verandaSubFloorMesh);
    }

    // 3. Zewnętrzna ściana WSCHODNIA (od ulicy frontowej, X = +5.50 m, grub. 51 cm)
    // Z otworem bramy garażowej Garażu I (Z od -3.10 do -5.20 m, oś Z = -4.15 m, wys. 2.00 m)
    // i oknem kotłowni (Z od -0.95 do -1.95 m)
    this._buildWallWithOpenings(basementGroup, {
      axis: 'Z',
      fixedCoord: xFront - tExt * 0.5,
      thickness: tExt,
      start: zNorth,
      end: zSouth,
      yBottom: yFloor,
      yTop: yCeil,
      material: this.mats.plinthPlaster,
      openings: [
        // Brama garażowa 2.10 x 2.00 m (w osi zjazdu Z = -4.15 m)
        { cMin: -5.20, cMax: -3.10, yMin: yFloor, yMax: yFloor + 2.00, type: 'garageDoor' },
        // Okno kotłowni 1.00 x 0.60 m
        { cMin: -1.95, cMax: -0.95, yMin: yFloor + 1.32, yMax: yFloor + 1.92, type: 'basementWin' },
      ],
    });

    // Nadproże stalowe nad wjazdem do garażu: 2 × I NP 16 (wg str. 9 obliczeń statycznych 1955 r.)
    const lintelGeo = new THREE.BoxGeometry(0.24, 0.16, 2.50);
    const lintelMesh = new THREE.Mesh(lintelGeo, this.mats.steelBeamINP);
    lintelMesh.position.set(xFront - tExt * 0.5, yFloor + 2.08, -4.15);
    basementGroup.add(lintelMesh);

    // 4. Zewnętrzna ściana PÓŁNOCNA (od wejścia, Z = -6.08 m, grub. 51 cm)
    this._buildWallWithOpenings(basementGroup, {
      axis: 'X',
      fixedCoord: zNorth + tExt * 0.5,
      thickness: tExt,
      start: xWestEnd,
      end: xFront - tExt,
      yBottom: yFloor,
      yTop: yCeil,
      material: this.mats.plinthPlaster,
      openings: [
        // Okienko piwniczne w Garażu II / pod salonem (90 x 60 cm)
        { cMin: -3.70, cMax: -2.80, yMin: yFloor + 1.32, yMax: yFloor + 1.92, type: 'basementWin' },
        // Okienko wnęki północnej Garażu I (85 x 60 cm wg rzutu 1966 r.)
        { cMin: 0.10, cMax: 0.95, yMin: yFloor + 1.32, yMax: yFloor + 1.92, type: 'basementWin' },
      ],
    });

    // 5. Ściana POŁUDNIOWA (dylatacyjna / kominowa, Z = 0.00 m, grub. 51 cm)
    this._buildWallWithOpenings(basementGroup, {
      axis: 'X',
      fixedCoord: zSouth - tExt * 0.5,
      thickness: tExt,
      start: xWestEnd,
      end: xFront - tExt,
      yBottom: yFloor,
      yTop: yCeil,
      material: this.mats.basementWall,
      openings: [],
    });

    // 6. Zewnętrzna ściana ZACHODNIA (od ogrodu) i POMIESZCZENIE UŻYTKOWE POD WERANDĄ (12,48 m²)
    if (options.includeVeranda1966) {
      // Ściana zewnętrzna zachodnia pomieszczenia użytkowego pod werandą (X = -8.20 m, grub. 25 cm wg rzutu 1966)
      // Dwa okna 90 × 60 cm (92 cm od ściany płd., 116 cm filarek, 132 cm od ściany płn. -> 520 cm w świetle)
      this._buildWallWithOpenings(basementGroup, {
        axis: 'Z',
        fixedCoord: xVeranda + 0.14,
        thickness: 0.28,
        start: zNorth + tExt,
        end: zSouth - tExt,
        yBottom: yFloor,
        yTop: yCeil,
        material: this.mats.plinthPlaster,
        openings: [
          { cMin: -4.26, cMax: -3.36, yMin: yFloor + 1.25, yMax: yFloor + 1.85, type: 'basementWin' },
          { cMin: -2.20, cMax: -1.30, yMin: yFloor + 1.25, yMax: yFloor + 1.85, type: 'basementWin' },
        ],
      });

      // Otynkowane wykończenie wewnętrzne ścian pomieszczenia użytkowego pod werandą (12,48 m²)
      this._buildWallWithOpenings(basementGroup, {
        axis: 'Z',
        fixedCoord: xVeranda + 0.29,
        thickness: 0.02,
        start: zNorth + tExt,
        end: zSouth - tExt,
        yBottom: yFloor,
        yTop: yCeil,
        material: this.mats.interiorWall,
        openings: [
          { cMin: -4.26, cMax: -3.36, yMin: yFloor + 1.25, yMax: yFloor + 1.85, type: 'openArch' },
          { cMin: -2.20, cMax: -1.30, yMin: yFloor + 1.25, yMax: yFloor + 1.85, type: 'openArch' },
        ],
      });

      // Ściana między Garażem II (21,06 m²) a Pomieszczeniem użytkowym pod werandą (12,48 m²) na X = -5.50 m
      // Wg rzutu 1966 r.: 260 cm od płd. + otwór drzwiowy 130 × 200 cm (Z od -4.28 do -2.98 m) + 150 cm do płn.
      this._buildWallWithOpenings(basementGroup, {
        axis: 'Z',
        fixedCoord: xMainRear + 0.19,
        thickness: 0.38,
        start: zNorth + tExt,
        end: zSouth - tExt,
        yBottom: yFloor,
        yTop: yCeil,
        material: this.mats.interiorWall,
        openings: [
          { cMin: -4.28, cMax: -2.98, yMin: yFloor, yMax: yFloor + 2.00, type: 'usableRoomDoor' },
        ],
      });

      // Wyposażenie pomieszczenia użytkowego pod werandą (grzejnik, stół warsztatowo-użytkowy, regał)
      this._buildVerandaUsableRoomInterior(interiorsGroup, yFloor);
    } else {
      // Wariant 1955: ściana zachodnia na X = -5.50 m
      this._buildWallWithOpenings(basementGroup, {
        axis: 'Z',
        fixedCoord: xMainRear + tExt * 0.5,
        thickness: tExt,
        start: zNorth + tExt,
        end: zSouth - tExt,
        yBottom: yFloor,
        yTop: yCeil,
        material: this.mats.plinthPlaster,
        openings: [
          { cMin: -4.50, cMax: -3.70, yMin: yFloor + 1.32, yMax: yFloor + 1.92, type: 'basementWin' },
        ],
      });
    }

    // 7. Wewnętrzne ściany podziemia (zgodnie z Rzutem Podziemia 1966 r. i inwentaryzacją Skan 3D):
    // a) Ściana środkowa nośna (X = -1.05 m, grub. 28 cm) między Garażem I (19,95 m²) / klatką schodową
    //    a Garażem II pod salonem (21,06 m²), z wrotami dwuskrzydłowymi 160 × 200 cm (Z od -4.75 do -3.15 m)
    this._buildWallWithOpenings(basementGroup, {
      axis: 'Z',
      fixedCoord: -1.05,
      thickness: 0.28,
      start: zNorth + tExt,
      end: zSouth - tExt,
      yBottom: yFloor,
      yTop: yCeil,
      material: this.mats.basementWall,
      openings: [
        { cMin: -4.75, cMax: -3.15, yMin: yFloor, yMax: yFloor + 2.00, type: 'doubleDoor' },
      ],
    });

    // b) Ściana podłużna wydzielająca Kotłownię (8,66 m²) od Garażu I (19,95 m²)
    //    Biegnie na Z = -2.55 m, X od +1.02 do +5.00 m (grub. 25 cm)
    this._buildWallWithOpenings(basementGroup, {
      axis: 'X',
      fixedCoord: -2.55,
      thickness: 0.25,
      start: 1.02,
      end: xFront - tExt,
      yBottom: yFloor,
      yTop: yCeil,
      material: this.mats.basementWall,
      openings: [],
    });

    // c) Ściana zachodnia Kotłowni (X = +1.02 m, Z od -2.55 do -0.51 m, grub. 22 cm)
    //    z drzwiami 80 × 200 cm prowadzącymi do przedsionka pod schodami
    this._buildWallWithOpenings(basementGroup, {
      axis: 'Z',
      fixedCoord: 1.02,
      thickness: 0.22,
      start: -2.55,
      end: zSouth - tExt,
      yBottom: yFloor,
      yTop: yCeil,
      material: this.mats.basementWall,
      openings: [
        { cMin: -2.35, cMax: -1.55, yMin: yFloor, yMax: yFloor + 2.00, type: 'singleDoor' },
      ],
    });

    // d) Ścianka działowa wzdłuż biegu schodów piwnicznych (X = +0.05 m, Z od -2.65 do -1.15 m)
    //    wydzielająca schowek pod schodami (1,65 m² wg rzutu 1966 r.) z drzwiami 80 × 190 cm
    this._buildWallWithOpenings(basementGroup, {
      axis: 'Z',
      fixedCoord: 0.05,
      thickness: 0.12,
      start: -2.65,
      end: -1.15,
      yBottom: yFloor,
      yTop: yCeil,
      material: this.mats.basementWall,
      openings: [
        { cMin: -2.10, cMax: -1.30, yMin: yFloor, yMax: yFloor + 1.85, type: 'singleDoor' },
      ],
    });

    // e) Ściana północna zamykająca klatkę schodową i przedsionek kotłowni (Z = -2.65 m, X od -0.95 do +1.02 m)
    //    Posiada drzwi 80 × 200 cm u dołu biegu schodów (X od -0.88 do -0.08 m) wychodzące do Garażu I
    //    oraz otwór przejścia (X od +0.14 do +0.92 m) do drzwi kotłowni i schowka 1,65 m²!
    this._buildWallWithOpenings(basementGroup, {
      axis: 'X',
      fixedCoord: -2.65,
      thickness: 0.16,
      start: -0.95,
      end: 1.02,
      yBottom: yFloor,
      yTop: yCeil,
      material: this.mats.basementWall,
      openings: [
        { cMin: -0.88, cMax: -0.08, yMin: yFloor, yMax: yFloor + 2.00, type: 'singleDoor' },
        { cMin: 0.14,  cMax: 0.92,  yMin: yFloor, yMax: yFloor + 2.00, type: 'openArch' },
      ],
    });

    // 8. Żelbetowe schody piwniczne w prawidłowej orientacji PÓŁNOC-POŁUDNIE (oś Z)
    //    Bieg schodzi spod drzwi na parterze (Z = -1.35 m) na północ (do Z = -2.65 m)
    const stairsGroup = this._buildBasementStairs(yFloor, ELEVATIONS.GROUND_FLOOR);
    basementGroup.add(stairsGroup);
    walkables.push(...stairsGroup.children);

    // 9. Gzyms cokołowy zewnętrzny (na rzędnej parteru Y = +1.60 m)
    this._buildPlinthWaterTable(basementGroup, xFront, xWestEnd, zNorth, zSouth);

    // 10. Wyposażenie Kotłowni (historyczny kocioł żeliwny + współczesny Vaillant ecoTEC ze zdjęć!)
    this._buildBoilerRoomEquipment(interiorsGroup, yFloor);

    return { basementGroup, interiorsGroup, walkables };
  }

  /**
   * Uniwersalny generator ściany z otworami okiennymi / drzwiowymi w podziemiu.
   */
  _buildWallWithOpenings(parentGroup, cfg) {
    const { axis, fixedCoord, thickness, start, end, yBottom, yTop, material, openings } = cfg;
    const sorted = [...openings].sort((a, b) => a.cMin - b.cMin);
    const totalH = yTop - yBottom;

    const addBox = (c1, c2, y1, y2, mat = material) => {
      const len = c2 - c1;
      const h = y2 - y1;
      if (len <= 0.005 || h <= 0.005) return;
      const sx = axis === 'X' ? len : thickness;
      const sz = axis === 'Z' ? len : thickness;
      const geo = new THREE.BoxGeometry(sx, h, sz);
      const mesh = new THREE.Mesh(geo, mat);
      const cMid = (c1 + c2) * 0.5;
      const yMid = (y1 + y2) * 0.5;
      if (axis === 'X') {
        mesh.position.set(cMid, yMid, fixedCoord);
      } else {
        mesh.position.set(fixedCoord, yMid, cMid);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parentGroup.add(mesh);
    };

    let cursor = start;
    for (const op of sorted) {
      if (op.cMin > cursor) {
        addBox(cursor, op.cMin, yBottom, yTop);
      }
      // Podokiennik (sill wall)
      if (op.yMin > yBottom) {
        addBox(op.cMin, op.cMax, yBottom, op.yMin);
      }
      // Nadproże (lintel wall)
      if (op.yMax < yTop) {
        addBox(op.cMin, op.cMax, op.yMax, yTop);
      }
      // Stolarka w otworze
      this._populateBasementOpening(parentGroup, axis, fixedCoord, thickness, op);
      cursor = op.cMax;
    }
    if (cursor < end) {
      addBox(cursor, end, yBottom, yTop);
    }
  }

  _populateBasementOpening(parentGroup, axis, fixedCoord, thickness, op) {
    const cMid = (op.cMin + op.cMax) * 0.5;
    const yMid = (op.yMin + op.yMax) * 0.5;
    const width = op.cMax - op.cMin;
    const height = op.yMax - op.yMin;

    if (op.type === 'basementWin') {
      const winGroup = new THREE.Group();
      // Biała opaska zewnętrzna i rama okienka piwnicznego
      const frameGeo = new THREE.BoxGeometry(
        axis === 'X' ? width : 0.08,
        height,
        axis === 'Z' ? width : 0.08
      );
      const frame = new THREE.Mesh(frameGeo, this.mats.windowFrameWhite);
      const glassGeo = new THREE.BoxGeometry(
        axis === 'X' ? width - 0.1 : 0.02,
        height - 0.1,
        axis === 'Z' ? width - 0.1 : 0.02
      );
      const glass = new THREE.Mesh(glassGeo, this.mats.glassClear);
      winGroup.add(frame, glass);
      if (axis === 'X') {
        winGroup.position.set(cMid, yMid, fixedCoord);
      } else {
        winGroup.position.set(fixedCoord, yMid, cMid);
      }
      parentGroup.add(winGroup);
    } else if (op.type === 'garageDoor') {
      // Dwuskrzydłowa brama garażowa (lekko uchylona dla lepszej czytelności wjazdu)
      const leafW = width * 0.5 - 0.02;
      const leafGeo = new THREE.BoxGeometry(0.06, height - 0.04, leafW);
      const leftLeaf = new THREE.Mesh(leafGeo, this.mats.garageDoorMat);
      leftLeaf.position.set(fixedCoord, yMid, op.cMin + leafW * 0.5);
      const rightLeaf = new THREE.Mesh(leafGeo, this.mats.garageDoorMat);
      rightLeaf.position.set(fixedCoord, yMid, op.cMax - leafW * 0.5);
      parentGroup.add(leftLeaf, rightLeaf);
    } else if (op.type === 'singleDoor') {
      // Jednoskrzydłowe drzwi piwniczne w ościeżnicy (np. 80 × 200 cm u dołu schodów i do kotłowni)
      const frameThick = Math.max(thickness + 0.02, 0.14);
      const topFrameGeo = new THREE.BoxGeometry(
        axis === 'X' ? width : frameThick,
        0.05,
        axis === 'Z' ? width : frameThick
      );
      const topFrame = new THREE.Mesh(topFrameGeo, this.mats.windowFrameWhite);
      topFrame.position.set(
        axis === 'X' ? cMid : fixedCoord,
        op.yMax - 0.025,
        axis === 'Z' ? cMid : fixedCoord
      );
      parentGroup.add(topFrame);

      // Skrzydło drzwiowe lekko uchylone (35°), aby ułatwić wgląd i przejście awatara
      const leafPivot = new THREE.Group();
      leafPivot.position.set(
        axis === 'X' ? op.cMin + 0.03 : fixedCoord,
        yMid,
        axis === 'Z' ? op.cMin + 0.03 : fixedCoord
      );
      const leafGeo = new THREE.BoxGeometry(
        axis === 'X' ? width - 0.06 : 0.04,
        height - 0.05,
        axis === 'Z' ? width - 0.06 : 0.04
      );
      const leafMesh = new THREE.Mesh(leafGeo, this.mats.oakWood || this.mats.windowFrameWhite);
      leafMesh.position.set(
        axis === 'X' ? (width - 0.06) * 0.5 : 0,
        0,
        axis === 'Z' ? (width - 0.06) * 0.5 : 0
      );
      leafPivot.add(leafMesh);
      leafPivot.rotation.y = axis === 'X' ? 0.55 : -0.55;
      parentGroup.add(leafPivot);
    } else if (op.type === 'doubleDoor' || op.type === 'usableRoomDoor') {
      // Ościeżnica i dwuskrzydłowe drzwi wewnętrzne (np. 160×200 cm między garażami lub 130×200 cm do pom. pod werandą)
      const frameThick = Math.max(thickness + 0.02, 0.18);
      const lintelFrame = new THREE.Mesh(
        new THREE.BoxGeometry(
          axis === 'X' ? width : frameThick,
          0.06,
          axis === 'Z' ? width : frameThick
        ),
        this.mats.windowFrameWhite
      );
      lintelFrame.position.set(
        axis === 'X' ? cMid : fixedCoord,
        op.yMax - 0.03,
        axis === 'Z' ? cMid : fixedCoord
      );
      parentGroup.add(lintelFrame);

      const leafW = width * 0.5 - 0.03;
      const mat = op.type === 'usableRoomDoor' ? this.mats.windowFrameWhite : this.mats.garageDoorMat;
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        const zHinge = side < 0 ? op.cMin + 0.02 : op.cMax - 0.02;
        pivot.position.set(fixedCoord, yMid, zHinge);
        const leaf = new THREE.Mesh(
          new THREE.BoxGeometry(0.045, height - 0.06, leafW),
          mat
        );
        leaf.position.set(0, 0, side < 0 ? leafW * 0.5 : -leafW * 0.5);
        pivot.add(leaf);
        pivot.rotation.y = side < 0 ? 1.15 : -1.15; // otwarte do wnętrza
        parentGroup.add(pivot);
      }
    }
  }

  /**
   * Żelbetowe schody piwniczne w prawidłowej orientacji PÓŁNOC–POŁUDNIE (wzdłuż osi Z),
   * umieszczone bezpośrednio pod klatką schodową parteru (X in [-0.93, +0.95 m]):
   * - Z drzwi piwnicznych na parterze (Z = -1.35 m, X in [+0.14, +0.90], Y = +1.60 m)
   *   wchodzi się na górny zabieg/spocznik przy ścianie południowej (Z in [-1.35, -0.45 m]),
   * - Następnie główny bieg prosty (szer. 94 cm, X in [-0.93, +0.01 m]) schodzi
   *   NA PÓŁNOC (w kierunku -Z: od Z = -1.05 m w dół do Z = -2.62 m na rzędną Y = -0.92 m),
   *   wychodząc przez drzwi 80×200 cm (na Z = -2.65 m) do przedsionka Garażu I (19,95 m²).
   */
  _buildBasementStairs(yBottom, yTop) {
    const group = new THREE.Group();
    group.name = 'Basement_Concrete_Stairs';

    const totalRise = yTop - yBottom; // 2.52 m (14 wzniosów po 18.0 cm)
    const numTotalSteps = 14;
    const stepRise = totalRise / numTotalSteps; // 0.18 m

    // 1. Górne 4 stopnie zabiegowe/spocznikowe (prowadzące od drzwi piwnicznych X=+0.52, Z=-1.35
    //    przez narożnik południowy Z in [-1.25, -0.48] na początek biegu północno-południowego X=-0.46)
    const upperSteps = [
      // Stopień 14 (tuż za progiem drzwi z korytarza parteru na Z = -1.35 m)
      { x: 0.50, z: -1.10, sx: 0.86, sz: 0.44, yTopStep: yTop - 1 * stepRise },
      // Stopień 13 (w narożniku SE pod wysokim zabiegiem schodów dębowych)
      { x: 0.48, z: -0.68, sx: 0.88, sz: 0.44, yTopStep: yTop - 2 * stepRise },
      // Stopień 12 (przejście na stronę zachodnią przy ścianie południowej)
      { x: -0.05, z: -0.68, sx: 0.56, sz: 0.84, yTopStep: yTop - 3 * stepRise },
      // Stopień 11 (spocznik zwrotny na osi głównego biegu X in [-0.93, +0.01])
      { x: -0.46, z: -0.78, sx: 0.94, sz: 0.64, yTopStep: yTop - 4 * stepRise },
    ];

    for (const st of upperSteps) {
      const h = 0.22;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(st.sx, h, st.sz),
        this.mats.foundationConcrete
      );
      mesh.position.set(st.x, st.yTopStep - h * 0.5, st.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    // 2. Główny prosty bieg żelbetowy wzdłuż osi Z (z południa Z = -1.05 m na północ Z = -2.55 m):
    //    10 stopni (nr 10 -> nr 1) o szerokości 94 cm (X od -0.93 do +0.01 m)
    const straightSteps = 10;
    const zStart = -1.08; // góra biegu prostego
    const zEnd = -2.52;   // dół biegu prostego przed drzwiami na Z = -2.65 m
    const treadDepth = Math.abs(zEnd - zStart) / straightSteps; // ~14.4 cm + podcięcie
    const xCenter = -0.46;
    const flightWidth = 0.94;

    for (let i = 0; i < straightSteps; i++) {
      // i = 0 to najniższy stopień przy Z = -2.52 m (y = yBottom + stepRise),
      // i = 9 to najwyższy stopień biegu prostego przy Z = -1.08 m (y = yBottom + 10 * stepRise)
      const stepIndexFromBottom = i + 1;
      const stepTopY = yBottom + stepIndexFromBottom * stepRise;
      const stepZ = zEnd + (i + 0.5) * treadDepth;
      const blockH = Math.min(stepTopY - yBottom, 0.32);

      const stepGeo = new THREE.BoxGeometry(flightWidth, blockH, treadDepth + 0.03);
      const stepMesh = new THREE.Mesh(stepGeo, this.mats.foundationConcrete);
      stepMesh.position.set(xCenter, stepTopY - blockH * 0.5, stepZ);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      group.add(stepMesh);
    }

    // Pochylona płyta policzkowa / spód biegu żelbetowego (płyta 8 cm pod stopniami 1..10)
    const runLenZ = Math.abs(zEnd - zStart);
    const riseStraight = straightSteps * stepRise;
    const slabLen = Math.hypot(runLenZ, riseStraight);
    const slabAngle = Math.atan2(riseStraight, runLenZ);
    const waistSlab = new THREE.Mesh(
      new THREE.BoxGeometry(flightWidth, 0.08, slabLen),
      this.mats.foundationConcrete
    );
    waistSlab.position.set(
      xCenter,
      yBottom + riseStraight * 0.5 - 0.12,
      (zStart + zEnd) * 0.5
    );
    waistSlab.rotation.x = -slabAngle;
    group.add(waistSlab);

    // Stalowa poręcz przyścienna wzdłuż biegu piwnicznego (po stronie wschodniej X = -0.02 m)
    const handrail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, slabLen, 8),
      this.mats.railingSteel
    );
    handrail.position.set(-0.03, yBottom + riseStraight * 0.5 + 0.85, (zStart + zEnd) * 0.5);
    handrail.rotation.x = Math.PI * 0.5 - slabAngle;
    group.add(handrail);

    return group;
  }

  /**
   * Wyposażenie pomieszczenia użytkowego pod werandą (12,48 m², 520 × 240 cm):
   * - Grzejnik żeliwny pod oknami zachodnimi,
   * - Drewniany stół roboczy / pracownia oraz regał przy ścianie południowej.
   */
  _buildVerandaUsableRoomInterior(group, yFloor) {
    const roomGroup = new THREE.Group();
    roomGroup.name = 'Veranda_Usable_Room_Interior';

    // 1. Grzejniki pod dwoma oknami zachodnimi (X = -7.84 m)
    for (const zRad of [-3.81, -1.75]) {
      const radiator = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.55, 0.75),
        this.mats.vaillantWhite
      );
      radiator.position.set(-7.82, yFloor + 0.45, zRad);
      radiator.castShadow = true;
      roomGroup.add(radiator);
    }

    // 2. Drewniany stół użytkowy / warsztatowy pod oknem południowo-zachodnim
    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.05, 1.80),
      this.mats.oakParquet || this.mats.windowFrameWhite
    );
    tableTop.position.set(-7.30, yFloor + 0.78, -1.65);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    roomGroup.add(tableTop);

    for (const dx of [-0.36, 0.36]) {
      for (const dz of [-0.80, 0.80]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.76, 0.06),
          this.mats.railingSteel
        );
        leg.position.set(-7.30 + dx, yFloor + 0.38, -1.65 + dz);
        roomGroup.add(leg);
      }
    }

    // 3. Regał użytkowy przy ścianie północnej (Z = -5.32 m)
    const shelfUnit = new THREE.Group();
    shelfUnit.position.set(-6.75, yFloor, -5.32);
    for (let s = 1; s <= 4; s++) {
      const shelf = new THREE.Mesh(
        new THREE.BoxGeometry(1.50, 0.03, 0.42),
        this.mats.windowFrameWhite
      );
      shelf.position.y = s * 0.42;
      shelfUnit.add(shelf);
    }
    roomGroup.add(shelfUnit);

    group.add(roomGroup);
  }

  _buildPlinthWaterTable(parentGroup, xFront, xWestEnd, zNorth, zSouth) {
    // Profilowany gzyms cokołowy oddzielający cokół podziemia (+1.60 m) od tynku parteru
    const yLedge = ELEVATIONS.GROUND_FLOOR - 0.04;
    const depth = xFront - xWestEnd + 0.08;
    const width = Math.abs(zNorth - zSouth) + 0.08;

    const northLedge = new THREE.Mesh(
      new THREE.BoxGeometry(depth, 0.08, 0.08),
      this.mats.corniceWhite
    );
    northLedge.position.set((xFront + xWestEnd) * 0.5, yLedge, zNorth - 0.03);

    const eastLedge = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, width),
      this.mats.corniceWhite
    );
    eastLedge.position.set(xFront + 0.03, yLedge, -width * 0.5 + 0.04);

    const westLedge = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, width),
      this.mats.corniceWhite
    );
    westLedge.position.set(xWestEnd - 0.03, yLedge, -width * 0.5 + 0.04);

    parentGroup.add(northLedge, eastLedge, westLedge);
  }

  /**
   * Modeluje wyposażenie kotłowni zgodnie ze zdjęciami z natury:
   * - Historyczny kocioł żeliwny C.O. w obmurowaniu z cegły szamotowej,
   * - Współczesny wiszący kocioł kondensacyjny Vaillant ecoTEC + czerwone naczynie przeponowe.
   */
  _buildBoilerRoomEquipment(group, yFloor) {
    // 1. Zabytkowy piec/kocioł żeliwny C.O. przy ścianie kominowej (południowej)
    const historicBoiler = new THREE.Group();
    historicBoiler.position.set(3.45, yFloor, -0.88);

    const brickJacket = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 1.18, 0.68),
      this.mats.kleinBrickPlate
    );
    brickJacket.position.y = 0.59;

    const ironCore = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 1.12, 0.72),
      this.mats.castIronBoiler
    );
    ironCore.position.y = 0.58;

    const fluePipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.95, 12),
      this.mats.castIronBoiler
    );
    fluePipe.position.set(0, 1.55, -0.1);

    historicBoiler.add(brickJacket, ironCore, fluePipe);
    group.add(historicBoiler);

    // 2. Współczesny kocioł gazowy Vaillant ecoTEC z czerwonym naczyniem wzbiorczym
    const vaillantGroup = new THREE.Group();
    vaillantGroup.position.set(4.45, yFloor + 1.25, -0.68);

    const vaillantBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.72, 0.34),
      this.mats.vaillantWhite
    );
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.10, 0.35),
      this.mats.railingSteel
    );
    panel.position.set(0, -0.24, 0.01);

    const vessel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.42, 16),
      this.mats.expansionVesselRed
    );
    vessel.position.set(-0.42, -0.35, 0.05);

    vaillantGroup.add(vaillantBody, panel, vessel);
    group.add(vaillantGroup);
  }
}
