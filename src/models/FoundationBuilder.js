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

    // 2. Posadzka betonowa podziemia (Y = -0.92 m)
    const totalDepth = xFront - xWestEnd;
    const floorGeo = new THREE.BoxGeometry(totalDepth, 0.14, BUILDING_DIMS.SEGMENT_WIDTH);
    const floorMesh = new THREE.Mesh(floorGeo, this.mats.basementFloor);
    floorMesh.position.set((xFront + xWestEnd) * 0.5, yFloor - 0.07, -BUILDING_DIMS.SEGMENT_WIDTH * 0.5);
    floorMesh.receiveShadow = true;
    basementGroup.add(floorMesh);
    walkables.push(floorMesh);

    // 3. Zewnętrzna ściana WSCHODNIA (od ulicy frontowej, X = +5.50 m, grub. 51 cm)
    // Z otworem bramy garażowej (Z od -3.10 do -5.20 m, wys. 2.00 m) i oknem kotłowni (Z od -0.95 do -1.95 m)
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
        // Brama garażowa 2.10 x 2.00 m
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
        // Okienko piwniczne pod salonem (80 x 60 cm)
        { cMin: -3.65, cMax: -2.85, yMin: yFloor + 1.32, yMax: yFloor + 1.92, type: 'basementWin' },
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

    // 6. Zewnętrzna ściana ZACHODNIA (od ogrodu)
    if (options.includeVeranda1966) {
      // Ściana zewnętrzna pod werandą (X = -8.20 m) z 2 okienkami piwnicznymi
      this._buildWallWithOpenings(basementGroup, {
        axis: 'Z',
        fixedCoord: xVeranda + 0.19,
        thickness: 0.38,
        start: zNorth + tExt,
        end: zSouth - tExt,
        yBottom: yFloor,
        yTop: yCeil,
        material: this.mats.plinthPlaster,
        openings: [
          { cMin: -4.60, cMax: -3.80, yMin: yFloor + 1.32, yMax: yFloor + 1.92, type: 'basementWin' },
          { cMin: -2.30, cMax: -1.50, yMin: yFloor + 1.32, yMax: yFloor + 1.92, type: 'basementWin' },
        ],
      });

      // Dawna ściana zewnętrzna z 1955 r. (X = -5.50 m) z przejściem 1.30 x 2.00 m do części pod werandą
      this._buildWallWithOpenings(basementGroup, {
        axis: 'Z',
        fixedCoord: xMainRear + 0.19,
        thickness: 0.38,
        start: zNorth + tExt,
        end: zSouth - tExt,
        yBottom: yFloor,
        yTop: yCeil,
        material: this.mats.basementWall,
        openings: [
          { cMin: -3.70, cMax: -2.40, yMin: yFloor, yMax: yFloor + 2.00, type: 'openArch' },
        ],
      });
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

    // 7. Wewnętrzne ściany podziemia (wg rzutu podziemia 1966 r. i Skan 3D):
    // a) Ściana środkowa poprzeczna (X = -1.05 m) między Garażem I a Garażem II (z szerokimi wrotami 2.00 m)
    this._buildWallWithOpenings(basementGroup, {
      axis: 'Z',
      fixedCoord: -1.05,
      thickness: 0.25,
      start: zNorth + tExt,
      end: zSouth - tExt,
      yBottom: yFloor,
      yTop: yCeil,
      material: this.mats.basementWall,
      openings: [
        { cMin: -4.45, cMax: -2.45, yMin: yFloor, yMax: yFloor + 2.00, type: 'doubleDoor' },
      ],
    });

    // b) Ściana podłużna wydzielająca Kotłownię (8.4 m²) od Garażu I (Z = -2.45 m, X od +1.60 do +5.00 m)
    this._buildWallWithOpenings(basementGroup, {
      axis: 'X',
      fixedCoord: -2.45,
      thickness: 0.25,
      start: 1.55,
      end: xFront - tExt,
      yBottom: yFloor,
      yTop: yCeil,
      material: this.mats.basementWall,
      openings: [],
    });

    // c) Ścianka poprzeczna kotłowni z drzwiami (X = +1.55 m, Z od -2.45 do -0.51 m)
    this._buildWallWithOpenings(basementGroup, {
      axis: 'Z',
      fixedCoord: 1.55,
      thickness: 0.16,
      start: -2.45,
      end: zSouth - tExt,
      yBottom: yFloor,
      yTop: yCeil,
      material: this.mats.basementWall,
      openings: [
        { cMin: -2.20, cMax: -1.35, yMin: yFloor, yMax: yFloor + 1.95, type: 'singleDoor' },
      ],
    });

    // 8. Żelbetowe schody piwniczne (płyta 5 cm zbrojona 3 Ø 6 mm wg str. 11 obl. stat. 1955)
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
    }
  }

  _buildBasementStairs(yBottom, yTop) {
    const group = new THREE.Group();
    group.name = 'Basement_Concrete_Stairs';
    const steps = 13;
    const dY = (yTop - yBottom) / steps;
    const xStart = 0.85;
    const xEnd = -0.85;
    const dX = (xEnd - xStart) / steps;

    for (let i = 0; i < steps; i++) {
      const stepH = dY;
      const stepY = yBottom + (i + 0.5) * dY;
      const stepX = xStart + (i + 0.5) * dX;
      const stepGeo = new THREE.BoxGeometry(Math.abs(dX) + 0.04, stepH, 0.92);
      const stepMesh = new THREE.Mesh(stepGeo, this.mats.foundationConcrete);
      stepMesh.position.set(stepX, stepY, -1.85);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      group.add(stepMesh);
    }
    return group;
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
