/**
 * ============================================================================
 * src/models/BuildingBuilder.js
 * Konstruktor architektury naziemnej:
 * - Parter (+1.60 m), Weranda ogrodowa (1966), Ganek wejściowy północny,
 * - I Piętro (+4.70 m), Taras nad werandą (15,9 m²), Gzyms podokapowy ciągniony,
 * - Poddasze użytkowe (+7.55 m, ścianki działowe 37 m² + 13 m² wg Skan 3D),
 * - Kunsztowne dębowe schody zabiegowe (18 wzniosów) i schody na poddasze,
 * - Stolarka okienna ze szprosami, drzwi przeszklone, boazeria i winorośl.
 * ============================================================================
 */

import * as THREE from 'three';
import { ELEVATIONS, WALL_THICKNESS, BUILDING_DIMS, ROOMS_SPEC } from '../data/houseSpec.js';

export class BuildingBuilder {
  constructor(materialsManager) {
    this.mats = materialsManager.materials;
  }

  /**
   * Buduje wszystkie kondygnacje naziemne dla pojedynczego segmentu.
   * @param {Object} options - { includeVeranda1966: boolean }
   */
  build(options = { includeVeranda1966: true }) {
    const groundFloorGroup = new THREE.Group();
    groundFloorGroup.name = 'Layer_GroundFloor';
    groundFloorGroup.userData.explodeLevel = 0.5;

    const firstFloorGroup = new THREE.Group();
    firstFloorGroup.name = 'Layer_FirstFloor';
    firstFloorGroup.userData.explodeLevel = 1.35;

    const atticWallsGroup = new THREE.Group();
    atticWallsGroup.name = 'Layer_AtticWalls';
    atticWallsGroup.userData.explodeLevel = 2.35;

    const interiorsGroup = new THREE.Group();
    interiorsGroup.name = 'Layer_Interiors';

    const vinesGroup = new THREE.Group();
    vinesGroup.name = 'Layer_Vines';
    vinesGroup.userData.explodeLevel = 1.0;

    const interactiveRooms = [];
    const walkables = [];

    // 1. PARTER (Y = +1.60 do +4.40 m)
    this._buildGroundFloor(groundFloorGroup, interiorsGroup, walkables, options);

    // 2. SCHODY ZABIEGOWE DĘBOWE (z parteru +1.60 m na I piętro +4.70 m)
    const mainStairs = this._buildOakWinderStairs(
      ELEVATIONS.GROUND_FLOOR,
      ELEVATIONS.FIRST_FLOOR,
      18,
      true
    );
    groundFloorGroup.add(mainStairs);
    walkables.push(...mainStairs.children);

    // 3. I PIĘTRO (Y = +4.70 do +7.28 m) + TARAS + GZYMS PODOKAPOWY
    this._buildFirstFloor(firstFloorGroup, interiorsGroup, walkables, options);

    // 4. SCHODY NA PODDASZE (z I piętra +4.70 m na strych +7.55 m)
    const atticStairs = this._buildOakWinderStairs(
      ELEVATIONS.FIRST_FLOOR,
      ELEVATIONS.ATTIC_FLOOR,
      16,
      false
    );
    firstFloorGroup.add(atticStairs);
    walkables.push(...atticStairs.children);

    // 5. PODDASZE / PIĘTRO 2 (Y = +7.55 m: posadzka i ścianki działowe 37 m² + 13 m²)
    this._buildAtticFloorAndPartitions(atticWallsGroup, walkables);

    // 6. WINOROŚL OGRODOWA (oplatająca werandę i balustradę tarasu I piętra)
    if (options.includeVeranda1966) {
      this._buildGardenGrapevines(vinesGroup);
    }

    // 7. KLIKALNE STREFY POMIESZCZEŃ (Raycasting + obrys podświetlenia)
    this._buildInteractiveRoomVolumes(
      { groundFloorGroup, firstFloorGroup, atticWallsGroup },
      interactiveRooms
    );

    return {
      groundFloorGroup,
      firstFloorGroup,
      atticWallsGroup,
      interiorsGroup,
      vinesGroup,
      interactiveRooms,
      walkables,
    };
  }

  // ==========================================================================
  // PARTER (PIĘTRO 0: Y = +1.60 m .. +4.40 m)
  // ==========================================================================
  _buildGroundFloor(group, interiorsGroup, walkables, options) {
    const y0 = ELEVATIONS.GROUND_FLOOR;   // +1.60 m
    const y1 = ELEVATIONS.GROUND_CEILING; // +4.40 m
    const tExt = WALL_THICKNESS.EXT_MAIN; // 0.38 m
    const tInt = WALL_THICKNESS.INT_LOAD_BEARING; // 0.25 m
    const tPart = WALL_THICKNESS.PARTITION; // 0.12 m

    const xFront = BUILDING_DIMS.X_FRONT_FACE;        // +5.50 m
    const xMainRear = BUILDING_DIMS.X_MAIN_REAR_FACE; // -5.50 m
    const xVeranda = BUILDING_DIMS.X_VERANDA_FACE;    // -8.20 m
    const zSouth = BUILDING_DIMS.Z_PARTY_AXIS;        // 0.00 m
    const zNorth = BUILDING_DIMS.Z_NORTH_FACE;        // -6.08 m

    // Posadzki parteru (z wycięciem otworu na schody piwniczne)
    const addFloorTile = (x1, x2, z1, z2, mat) => {
      const geo = new THREE.BoxGeometry(Math.abs(x2 - x1), 0.04, Math.abs(z2 - z1));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((x1 + x2) * 0.5, y0 + 0.02, (z1 + z2) * 0.5);
      mesh.receiveShadow = true;
      group.add(mesh);
      walkables.push(mesh);
    };

    // Salon (klepka dębowa w jodełkę)
    addFloorTile(-5.15, -1.10, -5.70, -0.38, this.mats.oakParquet);
    // Sypialnia frontowa / gabinet (klepka dębowa)
    addFloorTile(1.12, 5.12, -5.70, -2.45, this.mats.oakParquet);
    // Korytarz i hol główny przed schodami (Z od -5.70 do -2.85) + przejście wschodnie do drzwi piwnicy i WC (X od +0.02 do +1.05, Z od -2.85 do -1.35)
    addFloorTile(-1.10, 1.12, -5.70, -2.85, this.mats.oakParquet);
    addFloorTile(-0.95, 0.02, -2.85, -1.35, this.mats.oakParquet);
    addFloorTile(0.02, 1.05, -2.85, -1.35, this.mats.oakParquet);
    // Kuchnia i WC (lastriko / terakota)
    addFloorTile(1.05, 5.12, -2.45, -0.38, this.mats.terrazzo);

    // Ściana zewnętrzna WSCHODNIA (od ulicy frontowej, X = +5.50 m)
    // Okno kuchni (90×150 cm) i duże okno sypialni frontowej (152×150 cm)
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: xFront - tExt * 0.5,
      thickness: tExt,
      start: zNorth,
      end: zSouth,
      yBottom: y0,
      yTop: y1,
      material: this.mats.facadePlaster,
      openings: [
        { cMin: -4.85, cMax: -3.33, yMin: y0 + 0.85, yMax: y0 + 2.35, type: 'window2' },
        { cMin: -1.95, cMax: -1.05, yMin: y0 + 0.85, yMax: y0 + 2.35, type: 'window2' },
      ],
    });

    // Ściana zewnętrzna PÓŁNOCNA (od wejścia, Z = -6.08 m)
    // Okno salonu (155×150 cm), drzwi wejściowe w ganku (100×215 cm), okno gabinetu (150×150 cm)
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: zNorth + tExt * 0.5,
      thickness: tExt,
      start: xMainRear,
      end: xFront - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.facadePlaster,
      openings: [
        { cMin: -3.95, cMax: -2.40, yMin: y0 + 0.85, yMax: y0 + 2.35, type: 'window2' },
        { cMin: -0.05, cMax: 0.95,  yMin: y0,        yMax: y0 + 2.18, type: 'entryDoor' },
        { cMin: 2.35,  cMax: 3.85,  yMin: y0 + 0.85, yMax: y0 + 2.35, type: 'window2' },
      ],
    });

    // Ściana POŁUDNIOWA (dylatacyjna / kominowa, Z = 0.00 m)
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: zSouth - tExt * 0.5,
      thickness: tExt,
      start: xMainRear,
      end: xFront - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.interiorWall,
      openings: [],
    });

    // Ściana ZACHODNIA korpusu głównego (między Salonem a Werandą, X = -5.50 m)
    // Drzwi dwuskrzydłowe przeszklone (145×215 cm) + szerokie okno wewnętrzne (200×150 cm)
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: xMainRear + 0.175,
      thickness: 0.35,
      start: zNorth + tExt,
      end: zSouth - tExt,
      yBottom: y0,
      yTop: y1,
      material: options.includeVeranda1966 ? this.mats.interiorWall : this.mats.facadePlaster,
      openings: [
        { cMin: -4.85, cMax: -2.85, yMin: y0 + 0.85, yMax: y0 + 2.35, type: 'window3' },
        { cMin: -2.40, cMax: -0.95, yMin: y0,        yMax: y0 + 2.15, type: 'glazedDoubleDoor' },
      ],
    });

    // WERANDA OGRODOWA (1966 r.: 13.50 m² / 2026: Jadalnia 14.2 m²) lub Taras (1955 r.)
    if (options.includeVeranda1966) {
      addFloorTile(xVeranda + 0.25, xMainRear, -5.83, -0.25, this.mats.verandaMosaic);

      // Ściana zachodnia werandy (X = -8.20 m) z 2 szerokimi oknami panoramicznymi
      this._buildWall(group, {
        axis: 'Z',
        fixedCoord: xVeranda + 0.125,
        thickness: 0.25,
        start: zNorth,
        end: zSouth,
        yBottom: y0,
        yTop: y1,
        material: this.mats.facadePlaster,
        openings: [
          { cMin: -5.35, cMax: -3.25, yMin: y0 + 0.80, yMax: y0 + 2.35, type: 'window3' },
          { cMin: -2.85, cMax: -0.75, yMin: y0 + 0.80, yMax: y0 + 2.35, type: 'window3' },
        ],
      });

      // Ściana północna werandy (Z = -6.08 m) z drzwiami ogrodowymi na schody i oknem
      this._buildWall(group, {
        axis: 'X',
        fixedCoord: zNorth + 0.125,
        thickness: 0.25,
        start: xVeranda + 0.25,
        end: xMainRear,
        yBottom: y0,
        yTop: y1,
        material: this.mats.facadePlaster,
        openings: [
          { cMin: -7.85, cMax: -6.90, yMin: y0,        yMax: y0 + 2.15, type: 'gardenDoor' },
          { cMin: -6.70, cMax: -5.65, yMin: y0 + 0.80, yMax: y0 + 2.35, type: 'window2' },
        ],
      });

      // Ściana południowa werandy (dylatacyjna, Z = 0.00 m)
      this._buildWall(group, {
        axis: 'X',
        fixedCoord: zSouth - 0.125,
        thickness: 0.25,
        start: xVeranda + 0.25,
        end: xMainRear,
        yBottom: y0,
        yTop: y1,
        material: this.mats.facadePlaster,
        openings: [],
      });

      // Schody ogrodowe z werandy (wzdłuż ściany północnej, obłożone klinkierem ze stalową poręczą)
      const gardenStairs = this._buildGardenVerandaStairs(y0);
      group.add(gardenStairs);
      walkables.push(...gardenStairs.children);
    } else {
      // Wariant 1955: Otwarty taras parteru (4.085 × 2.00 m) ze schodkami do ogrodu
      addFloorTile(-7.50, xMainRear, -4.80, -0.38, this.mats.terraceTiles);
    }

    // GANEK WEJŚCIOWY PÓŁNOCNY (Podest + 9 stopni z lastriko + zadaszenie dachówką)
    const northPorch = this._buildNorthEntrancePorch(y0);
    group.add(northPorch);
    walkables.push(...northPorch.children);

    // ŚCIANY WEWNĘTRZNE PARTERU:
    // 1) Główna ściana poprzeczna nośna (X = -1.08 m, grub. 25 cm) z szerokim przeszklonym portalem do Salonu
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: -1.08,
      thickness: tInt,
      start: zNorth + tExt,
      end: zSouth - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.interiorWall,
      openings: [
        { cMin: -4.45, cMax: -2.85, yMin: y0, yMax: y0 + 2.18, type: 'salonPortalDoor' },
      ],
    });

    // 2) Ściana między sypialnią frontową (12.8 m²) a korytarzem (X = +1.12 m, Z od -5.70 do -2.45 m)
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: 1.12,
      thickness: tPart,
      start: zNorth + tExt,
      end: -2.45,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [
        { cMin: -3.55, cMax: -2.65, yMin: y0, yMax: y0 + 2.05, type: 'interiorDoor' },
      ],
    });

    // 3) Ściana oddzielająca pasmo kuchni i WC od sypialni (Z = -2.45 m, X od +1.05 do +5.12 m)
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: -2.45,
      thickness: tPart,
      start: 1.05,
      end: xFront - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [
        { cMin: 2.25, cMax: 3.05, yMin: y0, yMax: y0 + 2.05, type: 'interiorDoor' },
      ],
    });

    // 4) Ścianka między kuchnią a WC (X = +2.12 m, Z od -2.45 do -0.38 m)
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: 2.12,
      thickness: tPart,
      start: -2.45,
      end: zSouth - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [],
    });

    // 5) Ścianka między WC a korytarzem/klatką schodową (X = +1.05 m, Z od -2.45 do -0.38 m)
    // z drzwiami do WC (widocznymi po lewej stronie w głębi korytarza na zdjęciu nr 1!)
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: 1.05,
      thickness: tPart,
      start: -2.45,
      end: zSouth - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [
        { cMin: -2.32, cMax: -1.52, yMin: y0, yMax: y0 + 2.02, type: 'interiorDoor' },
      ],
    });

    // 6) Ścianka poprzeczna pod zabiegiem schodów (Z = -1.35 m, X od +0.02 do +1.05 m)
    // z drzwiami zejścia do piwnicy na wprost korytarza (dokładnie jak na zdjęciu nr 1!)
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: -1.35,
      thickness: 0.10,
      start: 0.02,
      end: 1.05,
      yBottom: y0,
      yTop: y0 + 2.38,
      material: this.mats.interiorWall,
      openings: [
        { cMin: 0.14, cMax: 0.94, yMin: y0, yMax: y0 + 2.02, type: 'interiorDoor' },
      ],
    });

    // 7) Pionowa boazeria drewniana w korytarzu oraz meble historyczne parteru
    this._buildGroundFloorInteriors(interiorsGroup, y0, options);
  }

  // ==========================================================================
  // I PIĘTRO (PIĘTRO 1: Y = +4.70 m .. +7.28 m) + TARAS + GZYMS
  // ==========================================================================
  _buildFirstFloor(group, interiorsGroup, walkables, options) {
    const y0 = ELEVATIONS.FIRST_FLOOR;   // +4.70 m
    const y1 = ELEVATIONS.FIRST_CEILING; // +7.28 m
    const tExt = WALL_THICKNESS.EXT_MAIN;
    const tInt = WALL_THICKNESS.INT_LOAD_BEARING;
    const tPart = WALL_THICKNESS.PARTITION;

    const xFront = BUILDING_DIMS.X_FRONT_FACE;        // +5.50 m
    const xMainRear = BUILDING_DIMS.X_MAIN_REAR_FACE; // -5.50 m
    const xVeranda = BUILDING_DIMS.X_VERANDA_FACE;    // -8.20 m
    const zSouth = BUILDING_DIMS.Z_PARTY_AXIS;        // 0.00 m
    const zNorth = BUILDING_DIMS.Z_NORTH_FACE;        // -6.08 m

    const addFloorTile = (x1, x2, z1, z2, mat) => {
      const geo = new THREE.BoxGeometry(Math.abs(x2 - x1), 0.04, Math.abs(z2 - z1));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((x1 + x2) * 0.5, y0 + 0.02, (z1 + z2) * 0.5);
      mesh.receiveShadow = true;
      group.add(mesh);
      walkables.push(mesh);
    };

    // Posadzki I piętra (z wycięciem otworu na klatkę schodową X: -0.95 do +0.98, Z: -2.85 do -0.38,
    // przy czym po stronie wschodniej X: +0.02..+1.05 podest półpiętra sięga do Z = -2.01 m, odbierając górny bieg!)
    // Sypialnia główna zachodnia (25,58 m² / 24,4 m²)
    addFloorTile(-5.15, -1.05, -5.70, -0.38, this.mats.oakParquet);
    // Sypialnia wschodnia (16,70 m² / 16,9 m²) i półpiętro północne
    addFloorTile(-1.05, 5.12, -5.70, -2.85, this.mats.oakParquet);
    // Podest wyjściowy półpiętra po stronie wschodniej słupa centralnego (X: +0.02 do +1.05, Z: -2.85 do -2.01)
    addFloorTile(0.02, 1.05, -2.85, -2.01, this.mats.oakParquet);
    // Łazienka (5,4 m²) i WC (0,9 m²)
    addFloorTile(1.05, 5.12, -2.85, -0.38, this.mats.verandaMosaic);

    // Płyta i balustrada TARASU OGRODOWEGO nad werandą (15,9 m²)
    if (options.includeVeranda1966) {
      addFloorTile(xVeranda, xMainRear, zNorth, zSouth, this.mats.terraceTiles);
      this._buildTerraceBalustrade(group, xVeranda, xMainRear, zNorth, zSouth, y0);
    }

    // Ściana zewnętrzna WSCHODNIA I piętra (od ulicy frontowej)
    // Okno łazienki (90×155 cm) i okno sypialni wschodniej (155×155 cm)
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: xFront - tExt * 0.5,
      thickness: tExt,
      start: zNorth,
      end: zSouth,
      yBottom: y0,
      yTop: y1,
      material: this.mats.facadePlaster,
      openings: [
        { cMin: -4.85, cMax: -3.30, yMin: y0 + 0.78, yMax: y0 + 2.33, type: 'window2' },
        { cMin: -1.95, cMax: -1.05, yMin: y0 + 0.78, yMax: y0 + 2.33, type: 'window2' },
      ],
    });

    // Ściana zewnętrzna PÓŁNOCNA I piętra (od wejścia)
    // Dwa symetryczne okna sypialni (150×155 cm) jak na rysunku Elewacji Północnej 1966 str. 8
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: zNorth + tExt * 0.5,
      thickness: tExt,
      start: xMainRear,
      end: xFront - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.facadePlaster,
      openings: [
        { cMin: -3.95, cMax: -2.40, yMin: y0 + 0.78, yMax: y0 + 2.33, type: 'window2' },
        { cMin: 2.35,  cMax: 3.85,  yMin: y0 + 0.78, yMax: y0 + 2.33, type: 'window2' },
      ],
    });

    // Ściana POŁUDNIOWA I piętra (dylatacyjna / kominowa)
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: zSouth - tExt * 0.5,
      thickness: tExt,
      start: xMainRear,
      end: xFront - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.interiorWall,
      openings: [],
    });

    // Ściana ZACHODNIA I piętra (od ogrodu / tarasu, X = -5.50 m)
    // Portfenetr balkonowy dwuskrzydłowy 150×205 cm (z nadprożem 2 × I NP 14 wg str. 8 obl. 1955)
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: xMainRear + tExt * 0.5,
      thickness: tExt,
      start: zNorth + tExt,
      end: zSouth - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.facadePlaster,
      openings: [
        { cMin: -3.40, cMax: -1.90, yMin: y0 + 0.05, yMax: y0 + 2.15, type: 'balconyPortfenetr' },
      ],
    });

    // ŚCIANY WEWNĘTRZNE I PIĘTRA:
    // 1) Główna ściana poprzeczna nośna (X = -1.00 m) z drzwiami do Sypialni Głównej
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: -1.00,
      thickness: tInt,
      start: zNorth + tExt,
      end: zSouth - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.interiorWall,
      openings: [
        { cMin: -3.55, cMax: -2.65, yMin: y0, yMax: y0 + 2.05, type: 'interiorDoor' },
      ],
    });

    // 2) Ścianka wydzielająca półpiętro od Sypialni Wschodniej (układ L wg rzutu 1966 i Skan 3D)
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: 1.55,
      thickness: tPart,
      start: -3.95,
      end: -2.35,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [],
    });
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: -3.95,
      thickness: tPart,
      start: -1.00,
      end: 1.55,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [
        { cMin: 0.35, cMax: 1.20, yMin: y0, yMax: y0 + 2.05, type: 'interiorDoor' },
      ],
    });

    // 3) Ścianka oddzielająca pasmo Łazienki i WC od półpiętra i sypialni (Z = -2.35 m)
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: -2.35,
      thickness: tPart,
      start: 1.00,
      end: xFront - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [
        { cMin: 1.15, cMax: 1.85, yMin: y0, yMax: y0 + 2.00, type: 'interiorDoor' },
        { cMin: 2.15, cMax: 2.90, yMin: y0, yMax: y0 + 2.00, type: 'interiorDoor' },
      ],
    });

    // 4) Ścianki działowe WC i Łazienki (X = +2.05 m oraz X = +1.05 m)
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: 2.05,
      thickness: tPart,
      start: -2.35,
      end: zSouth - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [],
    });
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: 1.05,
      thickness: tPart,
      start: -2.35,
      end: zSouth - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [],
    });

    // 5) Klasyczny profilowany GZYMS PODOKAPOWY CIĄGNIONY (Cornice) + rynny i rury spustowe
    this._buildCrownCorniceAndGutters(group, xFront, xMainRear, zNorth, zSouth, ELEVATIONS.ATTIC_FLOOR);

    // 6) Wyposażenie I piętra (wanna w łazience, łóżka w sypialniach, biały zestaw żeliwny na tarasie)
    this._buildFirstFloorInteriors(interiorsGroup, y0, options);
  }

  // ==========================================================================
  // PODDASZE / STRYCH (PIĘTRO 2: Y = +7.55 m)
  // ==========================================================================
  _buildAtticFloorAndPartitions(group, walkables) {
    const y0 = ELEVATIONS.ATTIC_FLOOR; // +7.55 m
    const xFront = BUILDING_DIMS.X_FRONT_FACE - 0.38;
    const xRear = BUILDING_DIMS.X_MAIN_REAR_FACE + 0.38;
    const zNorth = BUILDING_DIMS.Z_NORTH_FACE + 0.38;
    const zSouth = -0.38;

    // Posadzka sosnowa poddasza (z wycięciem otworu na schody strychowe)
    const addPineFloor = (x1, x2, z1, z2) => {
      const geo = new THREE.BoxGeometry(Math.abs(x2 - x1), 0.04, Math.abs(z2 - z1));
      const mesh = new THREE.Mesh(geo, this.mats.atticPineFloor);
      mesh.position.set((x1 + x2) * 0.5, y0 + 0.02, (z1 + z2) * 0.5);
      mesh.receiveShadow = true;
      group.add(mesh);
      walkables.push(mesh);
    };

    // Część wschodnia, północna i zachodnia wokół klatki schodowej (z podejściem wyjściowym Z = -2.01 po stronie wschodniej)
    addPineFloor(1.05, xFront, zNorth, zSouth);
    addPineFloor(xRear, 1.05, zNorth, -2.85);
    addPineFloor(0.02, 1.05, -2.85, -2.01);
    addPineFloor(xRear, -0.95, -2.85, zSouth);

    // Ścianka kolankowa obwodowa (wys. 0.45 m pod murłatę)
    const kneeH = 0.32;
    const addKneeWall = (x1, z1, x2, z2) => {
      const lenX = Math.abs(x2 - x1);
      const lenZ = Math.abs(z2 - z1);
      const isX = lenX >= lenZ;
      const geo = new THREE.BoxGeometry(isX ? lenX : 0.25, kneeH, isX ? 0.25 : lenZ);
      const mesh = new THREE.Mesh(geo, this.mats.facadePlaster);
      mesh.position.set((x1 + x2) * 0.5, y0 + kneeH * 0.5, (z1 + z2) * 0.5);
      group.add(mesh);
    };
    addKneeWall(xRear, zNorth, xFront, zNorth);
    addKneeWall(xFront, zNorth, xFront, 0);
    addKneeWall(xRear, zNorth, xRear, 0);

    // Ścianki działowe poddasza wg pomiaru Skan 3D (FLOOR02.png: 37 m² + 13 m² + obudowa klatki)
    const partH = 2.05;
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: -1.00,
      thickness: 0.12,
      start: -5.10,
      end: -2.85,
      yBottom: y0,
      yTop: y0 + partH,
      material: this.mats.partitionWall,
      openings: [
        { cMin: -3.75, cMax: -2.95, yMin: y0, yMax: y0 + 1.90, type: 'interiorDoor' },
      ],
    });
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: -2.85,
      thickness: 0.12,
      start: -4.80,
      end: -1.00,
      yBottom: y0,
      yTop: y0 + partH,
      material: this.mats.partitionWall,
      openings: [],
    });
  }

  // ==========================================================================
  // SCHODY ZABIEGOWE DĘBOWE (DOKŁADNA REKONSTRUKCJA ZE ZDJĘĆ Z NATURY)
  // ==========================================================================
  /**
   * Rekonstrukcja schodów dębowych zabiegowych (18 wzniosów Parter->I Piętro, 16 wzniosów I Piętro->Strych):
   * - Bieg dolny prosty (7 stopni): wznosi się na POŁUDNIE (+Z, od Z = -2.89 do Z = -1.35 m)
   *   wzdłuż zachodniej ściany Salonu (X od -0.94 do +0.02 m).
   * - Słup centralny dębowy (trzon zabiegu): w punkcie (X = +0.02 m, Z = -1.35 m), biegnie
   *   przez pełną wysokość klatki schodowej (widoczny w centrum zdjęć 2 i 3).
   * - Zabieg wachlarzowy 180° (8 stopni klinowych): trójkątno-trapezowe stopnie dębowe (ExtrudeGeometry)
   *   promieniujące ze słupa centralnego do prostokątnych ścian klatki (X_west = -0.94, Z_south = -0.39, X_east = +0.98),
   *   skręcające w lewo (z kierunku +Z -> +X -> -Z).
   * - Bieg górny wyjściowy (3 stopnie): wychodzi na PÓŁNOC (-Z, od Z = -1.35 do Z = -2.01 m)
   *   po wschodniej stronie słupa (X od +0.02 do +0.98 m) prosto na Półpiętro.
   * - Kuta balustrada ze ślimacznicami (S-scrolls) i dębowym pochwytem + białe otynkowane podniebienie biegów.
   */
  _buildOakWinderStairs(yBottom, yTop, totalSteps = 18, isMainFlight = true) {
    const group = new THREE.Group();
    group.name = `Oak_Winder_Stairs_${yBottom.toFixed(1)}`;

    const totalRise = yTop - yBottom;
    const riserH = totalRise / totalSteps; // ~0.1722 m dla Parter -> I Piętro

    const xWest = -0.94;   // Lico wschodnie ściany Salonu
    const xPivot = 0.02;   // Oś centralnego słupa dębowego (szerokość biegu = 0.96 m)
    const xEast = 0.98;    // Lico zachodnie ściany WC
    const zStart = -2.89;  // Pierwszy stopień przy portalu Salonu (jak na zdjęciu nr 1)
    const zPivot = -1.35;  // Oś słupa centralnego i początek zabiegu 180°
    const zSouth = -0.39;  // Lico wewnętrzne południowej ściany dylatacyjnej (głęb. zabiegu = 0.96 m)

    const flightW = xPivot - xWest; // 0.96 m
    const treadThickness = 0.038;
    const nosing = 0.03;

    // ------------------------------------------------------------------------
    // 1. CENTRALNY SŁUP DĘBOWY KONSTRUKCYJNY (TRZON ZABIEGU)
    // ------------------------------------------------------------------------
    const columnHeight = totalRise + 1.15;
    const centralColumn = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, columnHeight, 0.12),
      this.mats.oakStairs
    );
    centralColumn.position.set(xPivot, yBottom + columnHeight * 0.5, zPivot);
    centralColumn.castShadow = true;
    centralColumn.receiveShadow = true;
    group.add(centralColumn);

    // Pionowa listwa cokołowa na słupie centralnym
    const columnTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.135, columnHeight, 0.04),
      this.mats.wainscotingWood
    );
    columnTrim.position.set(xPivot, yBottom + columnHeight * 0.5, zPivot - 0.05);
    group.add(columnTrim);

    // ------------------------------------------------------------------------
    // 2. BIEG DOLNY PROSTY (7 STOPNI W KIERUNKU POŁUDNIOWYM +Z)
    // ------------------------------------------------------------------------
    const nLower = 7;
    const lowerRun = (zPivot - zStart) / nLower; // 1.54 / 7 = 0.22 m
    const xLowerCenter = (xWest + xPivot) * 0.5; // -0.46 m

    for (let i = 0; i < nLower; i++) {
      const stepTopY = yBottom + (i + 1) * riserH;
      const zFront = zStart + i * lowerRun;
      const zBack = zFront + lowerRun;

      // Stopnica dębowa z wyoblonym noskiem od północy (-Z)
      const treadMesh = new THREE.Mesh(
        new THREE.BoxGeometry(flightW, treadThickness, lowerRun + nosing),
        this.mats.oakStairs
      );
      treadMesh.position.set(
        xLowerCenter,
        stepTopY - treadThickness * 0.5,
        (zFront + zBack) * 0.5 - nosing * 0.5
      );
      treadMesh.castShadow = true;
      treadMesh.receiveShadow = true;
      group.add(treadMesh);

      // Pełna podstopnica dębowa (zamykająca przestrzeń między stopniami)
      const riserMesh = new THREE.Mesh(
        new THREE.BoxGeometry(flightW - 0.01, riserH, 0.022),
        this.mats.wainscotingWood
      );
      riserMesh.position.set(xLowerCenter, stepTopY - riserH * 0.5, zFront + 0.01);
      riserMesh.receiveShadow = true;
      group.add(riserMesh);
    }

    // Policzek zewnętrzny (wschodni przy X = xPivot) oraz przyścienny (zachodni przy X = xWest)
    const lowerLenZ = zPivot - zStart;
    const lowerRiseTotal = nLower * riserH;
    const lowerDiag = Math.hypot(lowerLenZ, lowerRiseTotal);
    const lowerPitch = Math.atan2(lowerRiseTotal, lowerLenZ);

    const outerStringer = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.24, lowerDiag + 0.12),
      this.mats.oakStairs
    );
    outerStringer.position.set(
      xPivot - 0.01,
      yBottom + lowerRiseTotal * 0.5 - 0.04,
      (zStart + zPivot) * 0.5
    );
    outerStringer.rotation.x = -lowerPitch;
    outerStringer.castShadow = true;
    group.add(outerStringer);

    const wallStringer = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.24, lowerDiag + 0.12),
      this.mats.wainscotingWood
    );
    wallStringer.position.set(
      xWest + 0.015,
      yBottom + lowerRiseTotal * 0.5 - 0.02,
      (zStart + zPivot) * 0.5
    );
    wallStringer.rotation.x = -lowerPitch;
    group.add(wallStringer);

    // Białe otynkowane podniebienie (soffit) pod biegiem dolnym (widoczne na zdjęciach 2 i 3!)
    const lowerSoffit = new THREE.Mesh(
      new THREE.BoxGeometry(flightW - 0.02, 0.06, lowerDiag + 0.10),
      this.mats.interiorWall
    );
    lowerSoffit.position.set(
      xLowerCenter,
      yBottom + lowerRiseTotal * 0.5 - 0.13,
      (zStart + zPivot) * 0.5
    );
    lowerSoffit.rotation.x = -lowerPitch;
    group.add(lowerSoffit);

    // ------------------------------------------------------------------------
    // 3. ZABIEG WACHLARZOWY 180° (8 STOPNI KLINOWYCH WOKÓŁ SŁUPA CENTRALNEGO)
    // ------------------------------------------------------------------------
    const nWinder = 8; // 4 stopnie w ćwiartce SW + 4 stopnie w ćwiartce SE (jak na zdjęciu nr 2!)
    const radiusBox = 0.96; // odległość od słupa (xPivot, zPivot) do ścian: Zach., Płd., Wsch.

    // Funkcja zwracająca punkt (x, z) na zewnętrznym obrysie ścian klatki dla kąta alpha in [0, PI]
    // alpha = 0 -> Zachód (-X), alpha = PI/2 -> Południe (+Z), alpha = PI -> Wschód (+X)
    const getWallPointAtAngle = (alpha) => {
      const c = -Math.cos(alpha);
      const s = Math.sin(alpha);
      const maxComp = Math.max(Math.abs(c), Math.abs(s), 0.0001);
      const r = radiusBox / maxComp;
      return {
        x: xPivot + c * r,
        z: zPivot + s * r,
        r,
      };
    };

    for (let w = 0; w < nWinder; w++) {
      const stepIdx = nLower + w + 1;
      const stepTopY = yBottom + stepIdx * riserH;

      // Zakres kątowy klinowego stopnia zabiegowego (z lekką zakładką noska 0.035 rad)
      const a0 = (w / nWinder) * Math.PI - 0.025;
      const a1 = ((w + 1) / nWinder) * Math.PI;

      // Budujemy dokładny wielokąt 2D stopnia zabiegowego w płaszczyźnie (X, -Z) dla ExtrudeGeometry
      const shape = new THREE.Shape();
      shape.moveTo(xPivot, -zPivot);

      const sampleAngles = [Math.max(0, a0)];
      // Jeśli stopień obejmuje narożnik południowo-zachodni (PI/4) lub południowo-wschodni (3*PI/4), dodaj wierzchołek narożnika!
      const cornerSW = Math.PI * 0.25;
      const cornerSE = Math.PI * 0.75;
      if (a0 < cornerSW && a1 > cornerSW) sampleAngles.push(cornerSW);
      if (a0 < cornerSE && a1 > cornerSE) sampleAngles.push(cornerSE);
      sampleAngles.push(a1);

      for (const ang of sampleAngles) {
        const pt = getWallPointAtAngle(ang);
        shape.lineTo(pt.x, -pt.z);
      }
      shape.closePath();

      const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: treadThickness,
        bevelEnabled: false,
      });
      // Po obróceniu o -PI/2 wokół osi X: lokalne (x, y, z) -> (x, z_extrude, -y) = (x, y_up, z)!
      extrudeGeo.rotateX(-Math.PI / 2);

      const wedgeTread = new THREE.Mesh(extrudeGeo, this.mats.oakStairs);
      wedgeTread.position.y = stepTopY - treadThickness;
      wedgeTread.castShadow = true;
      wedgeTread.receiveShadow = true;
      group.add(wedgeTread);

      // Pełna podstopnica promieniowa (radial riser) wzdłuż krawędzi natarcia stopnia zabiegowego
      const leadAng = Math.max(0, (w / nWinder) * Math.PI);
      const outerPt = getWallPointAtAngle(leadAng);
      const riserLen = outerPt.r;
      const riserGeo = new THREE.BoxGeometry(riserLen, riserH + 0.01, 0.024);
      const riserMesh = new THREE.Mesh(riserGeo, this.mats.wainscotingWood);
      riserMesh.position.set(
        (xPivot + outerPt.x) * 0.5,
        stepTopY - riserH * 0.5,
        (zPivot + outerPt.z) * 0.5
      );
      // Kierunek od słupa do ściany: (-cos(leadAng), +sin(leadAng))
      riserMesh.rotation.y = leadAng;
      riserMesh.castShadow = true;
      riserMesh.receiveShadow = true;
      group.add(riserMesh);

      // Białe otynkowane podniebienie (soffit) pod klinem zabiegu
      const soffitGeo = new THREE.ExtrudeGeometry(shape, {
        depth: riserH + 0.05,
        bevelEnabled: false,
      });
      soffitGeo.rotateX(-Math.PI / 2);
      const soffitMesh = new THREE.Mesh(soffitGeo, this.mats.interiorWall);
      soffitMesh.position.y = stepTopY - treadThickness - riserH - 0.04;
      group.add(soffitMesh);
    }

    // ------------------------------------------------------------------------
    // 4. BIEG GÓRNY WYJŚCIOWY (POZOSTAŁE STOPNIE W KIERUNKU PÓŁNOCNYM -Z NA PÓŁPIĘTRO)
    // ------------------------------------------------------------------------
    const nUpper = totalSteps - nLower - nWinder; // 3 stopnie dla parteru (18-7-8=3), 1 dla poddasza
    const upperRun = 0.22;
    const xUpperCenter = (xPivot + xEast) * 0.5; // +0.50 m

    for (let u = 0; u < nUpper; u++) {
      const stepIdx = nLower + nWinder + u + 1;
      const stepTopY = yBottom + stepIdx * riserH;
      const zFront = zPivot - u * upperRun; // krawędź wchodząca (od południa)
      const zBack = zFront - upperRun;      // krawędź wychodząca (ku północy)

      const treadMesh = new THREE.Mesh(
        new THREE.BoxGeometry(flightW, treadThickness, upperRun + nosing),
        this.mats.oakStairs
      );
      treadMesh.position.set(
        xUpperCenter,
        stepTopY - treadThickness * 0.5,
        (zFront + zBack) * 0.5 + nosing * 0.5
      );
      treadMesh.castShadow = true;
      treadMesh.receiveShadow = true;
      group.add(treadMesh);

      const riserMesh = new THREE.Mesh(
        new THREE.BoxGeometry(flightW - 0.01, riserH + 0.01, 0.022),
        this.mats.wainscotingWood
      );
      riserMesh.position.set(xUpperCenter, stepTopY - riserH * 0.5, zFront - 0.01);
      group.add(riserMesh);
    }

    // Białe otynkowane podniebienie z charakterystycznym uskokiem pod górnym biegiem
    // (dokładnie jak biały sufit nad drzwiami do piwnicy na zdjęciu nr 1, 2 i 3!)
    const upperSoffitBlock = new THREE.Mesh(
      new THREE.BoxGeometry(flightW, 0.24, Math.max(1, nUpper) * upperRun + 0.08),
      this.mats.interiorWall
    );
    upperSoffitBlock.position.set(
      xUpperCenter,
      yTop - 0.22,
      zPivot - (Math.max(1, nUpper) * upperRun) * 0.5
    );
    group.add(upperSoffitBlock);

    // ------------------------------------------------------------------------
    // 5. KUTA BALUSTRADA ZE ŚLIMACZNICAMI (S-SCROLLS) I DĘBOWYM POCHWYTEM
    // ------------------------------------------------------------------------
    const railHeight = 0.90;
    // Słupek początkowy dębowy przy stopniu nr 1 (X = xPivot, Z = zStart)
    const startPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, railHeight + 0.12, 0.075),
      this.mats.oakStairs
    );
    startPost.position.set(xPivot - 0.01, yBottom + riserH + railHeight * 0.5, zStart + 0.04);
    startPost.castShadow = true;
    group.add(startPost);

    // Głowica słupka początkowego
    const startCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 12, 12),
      this.mats.oakStairs
    );
    startCap.position.set(xPivot - 0.01, yBottom + riserH + railHeight + 0.08, zStart + 0.04);
    group.add(startCap);

    // Pochwyt dębowy profilowany wznoszący się od słupka początkowego do słupa centralnego
    const handrail = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.05, lowerDiag + 0.06),
      this.mats.oakStairs
    );
    handrail.position.set(
      xPivot - 0.01,
      yBottom + lowerRiseTotal * 0.5 + railHeight,
      (zStart + zPivot) * 0.5
    );
    handrail.rotation.x = -lowerPitch;
    handrail.castShadow = true;
    group.add(handrail);

    // Kute tralki pionowe i ślimacznice S-kształtne (widoczne na zdjęciu nr 3 w lewym dolnym rogu!)
    const nBalusters = 7;
    for (let b = 0; b < nBalusters; b++) {
      const t = (b + 0.5) / nBalusters;
      const bz = zStart + t * lowerLenZ;
      const byBase = yBottom + t * lowerRiseTotal + 0.06;
      const bH = railHeight - 0.08;

      // Pręt pionowy kuty
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, bH, 8),
        this.mats.railingSteel
      );
      rod.position.set(xPivot - 0.01, byBase + bH * 0.5, bz);
      group.add(rod);

      // Dekoracyjna kuta ślimacznica (C/S-scroll) co drugi słupek
      if (b % 2 === 1) {
        const scrollUpper = new THREE.Mesh(
          new THREE.TorusGeometry(0.055, 0.006, 8, 16, Math.PI * 1.35),
          this.mats.railingSteel
        );
        scrollUpper.rotation.y = Math.PI * 0.5;
        scrollUpper.position.set(xPivot - 0.01, byBase + bH * 0.62, bz + 0.05);
        group.add(scrollUpper);

        const scrollLower = new THREE.Mesh(
          new THREE.TorusGeometry(0.055, 0.006, 8, 16, Math.PI * 1.35),
          this.mats.railingSteel
        );
        scrollLower.rotation.y = -Math.PI * 0.5;
        scrollLower.position.set(xPivot - 0.01, byBase + bH * 0.36, bz - 0.05);
        group.add(scrollLower);
      }
    }

    return group;
  }

  // ==========================================================================
  // GANEK WEJŚCIOWY PÓŁNOCNY I SCHODY OGRODOWE WERANDY
  // ==========================================================================
  _buildNorthEntrancePorch(yGroundFloor) {
    const group = new THREE.Group();
    group.name = 'North_Entrance_Porch';

    const zWall = BUILDING_DIMS.Z_NORTH_FACE; // -6.08 m
    const zOuter = BUILDING_DIMS.Z_PORCH_OUTER; // -7.43 m
    const porchDepth = Math.abs(zOuter - zWall); // 1.35 m
    const porchWidth = 1.65;
    const xCenter = 0.45;

    // 1. Podest wejściowy murowany na rzędnej Y = +1.60 m
    const landingGeo = new THREE.BoxGeometry(porchWidth, yGroundFloor, porchDepth);
    const landing = new THREE.Mesh(landingGeo, this.mats.plinthPlaster);
    landing.position.set(xCenter, yGroundFloor * 0.5, (zWall + zOuter) * 0.5);
    landing.receiveShadow = true;

    const topSlab = new THREE.Mesh(
      new THREE.BoxGeometry(porchWidth + 0.08, 0.06, porchDepth + 0.06),
      this.mats.terrazzo
    );
    topSlab.position.set(xCenter, yGroundFloor - 0.02, (zWall + zOuter) * 0.5);
    group.add(landing, topSlab);

    // 2. 9 stopni zewnętrznych z lastriko schodzących w kierunku wschodnim (ku ulicy frontowej)
    // Zgodnie z Rzutem Parteru 1966 str. 6 i Elewacją Północną str. 8
    const stepsCount = 9;
    const stepRise = yGroundFloor / stepsCount;
    const stepRun = 0.29;
    const xStart = xCenter + porchWidth * 0.5;

    for (let i = 0; i < stepsCount; i++) {
      const h = yGroundFloor - i * stepRise;
      const sx = xStart + (i + 0.5) * stepRun;
      const stepBlock = new THREE.Mesh(
        new THREE.BoxGeometry(stepRun, h, 1.18),
        this.mats.terrazzo
      );
      stepBlock.position.set(sx, h * 0.5, zWall - 0.62);
      stepBlock.castShadow = true;
      stepBlock.receiveShadow = true;
      group.add(stepBlock);
    }

    // 3. Balustrada stalowa schodów wejściowych i podestu
    const railH = 0.92;
    const handrail = new THREE.Mesh(
      new THREE.BoxGeometry(stepsCount * stepRun + 0.2, 0.04, 0.04),
      this.mats.railingSteel
    );
    handrail.position.set(xStart + (stepsCount * stepRun) * 0.5, yGroundFloor * 0.5 + railH, zWall - 1.16);
    handrail.rotation.z = -Math.atan2(yGroundFloor, stepsCount * stepRun);
    group.add(handrail);

    // 4. Daszek nad wejściem północnym kryty dachówką karpiówką (wsparty na 2 słupkach stalowych)
    // Widoczny wyraźnie na zdjęciu PXL_20260815_083108470.jpg oraz Elewacji Północnej 1966 str. 8
    const postGeo = new THREE.CylinderGeometry(0.035, 0.035, 2.35, 10);
    const postL = new THREE.Mesh(postGeo, this.mats.railingSteel);
    postL.position.set(xCenter - 0.72, yGroundFloor + 1.175, zOuter + 0.08);
    const postR = new THREE.Mesh(postGeo, this.mats.railingSteel);
    postR.position.set(xCenter + 0.72, yGroundFloor + 1.175, zOuter + 0.08);

    const canopyRoof = new THREE.Mesh(
      new THREE.ConeGeometry(1.32, 0.78, 4),
      this.mats.roofTileKarpiowka
    );
    canopyRoof.rotation.y = Math.PI * 0.25;
    canopyRoof.scale.set(1.05, 1.0, 0.82);
    canopyRoof.position.set(xCenter, yGroundFloor + 2.68, zWall - 0.65);
    canopyRoof.castShadow = true;

    group.add(postL, postR, canopyRoof);
    return group;
  }

  _buildGardenVerandaStairs(yGroundFloor) {
    // Schody z werandy do ogrodu wzdłuż północnej osi (długość w rzucie 2.37 m wg inwent. 1966 str. 6)
    // Na zdjęciach PXL_20260814_124223667.jpg wyłożone czerwoną terakotą ze stalową poręczą
    const group = new THREE.Group();
    group.name = 'Garden_Veranda_Stairs';

    const steps = 9;
    const totalLength = BUILDING_DIMS.GARDEN_STAIRS_LENGTH; // 2.37 m
    const stepRun = totalLength / steps;
    const stepRise = yGroundFloor / steps;
    const xStart = BUILDING_DIMS.X_VERANDA_FACE; // -8.20 m
    const zCenter = BUILDING_DIMS.Z_NORTH_FACE - 0.55; // przy północno-zachodnim narożniku werandy

    // Jednak na rzucie 1966 str. 6 i zdjęciach PXL_20260814_124223667.jpg schody schodzą
    // bezpośrednio od drzwi północnych werandy w stronę zachodnią (do ogrodu)!
    for (let i = 0; i < steps; i++) {
      const h = yGroundFloor - i * stepRise;
      const sx = xStart - (i + 0.5) * stepRun;
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(stepRun, h, 1.15),
        this.mats.clinkerStairs
      );
      stepMesh.position.set(sx, h * 0.5, -5.50);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      group.add(stepMesh);
    }

    // Poręcz stalowa schodów ogrodowych
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(totalLength + 0.2, 0.035, 0.035),
      this.mats.railingSteel
    );
    rail.position.set(xStart - totalLength * 0.5, yGroundFloor * 0.5 + 0.88, -6.02);
    rail.rotation.z = Math.atan2(yGroundFloor, totalLength);
    group.add(rail);

    return group;
  }

  _buildTerraceBalustrade(group, xVeranda, xMainRear, zNorth, zSouth, yFloor) {
    const railH = 0.98;
    const depth = Math.abs(xMainRear - xVeranda);
    const width = Math.abs(zSouth - zNorth);

    // Murki słupkowe i stalowa balustrada tarasu I piętra + murek ogniowy od południa (jak na zdjęciach)
    const privacyWall = new THREE.Mesh(
      new THREE.BoxGeometry(depth, 1.75, 0.20),
      this.mats.facadePlaster
    );
    privacyWall.position.set((xVeranda + xMainRear) * 0.5, yFloor + 0.875, zSouth - 0.10);
    privacyWall.castShadow = true;
    group.add(privacyWall);

    // Pochwyt zachodni i północny
    const topRailWest = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, width),
      this.mats.railingSteel
    );
    topRailWest.position.set(xVeranda + 0.06, yFloor + railH, -width * 0.5);

    const topRailNorth = new THREE.Mesh(
      new THREE.BoxGeometry(depth, 0.05, 0.05),
      this.mats.railingSteel
    );
    topRailNorth.position.set((xVeranda + xMainRear) * 0.5, yFloor + railH, zNorth + 0.06);

    group.add(topRailWest, topRailNorth);

    // Słupki pionowe balustrady
    const postGeo = new THREE.BoxGeometry(0.04, railH, 0.04);
    for (let z = zNorth + 0.1; z <= zSouth - 0.2; z += 0.95) {
      const p = new THREE.Mesh(postGeo, this.mats.railingSteel);
      p.position.set(xVeranda + 0.06, yFloor + railH * 0.5, z);
      group.add(p);
    }
    for (let x = xVeranda + 0.1; x <= xMainRear - 0.1; x += 0.90) {
      const p = new THREE.Mesh(postGeo, this.mats.railingSteel);
      p.position.set(x, yFloor + railH * 0.5, zNorth + 0.06);
      group.add(p);
    }
  }

  _buildCrownCorniceAndGutters(group, xFront, xMainRear, zNorth, zSouth, yCornice) {
    // Klasyczny trójstopniowy gzyms podokapowy ciągniony (widoczny na zdjęciach PXL_20260817_174400553.jpg)
    const depth = xFront - xMainRear;
    const width = Math.abs(zSouth - zNorth);

    const tiers = [
      { dy: -0.22, h: 0.08, out: 0.06 },
      { dy: -0.13, h: 0.10, out: 0.14 },
      { dy: -0.03, h: 0.08, out: 0.22 },
    ];

    for (const t of tiers) {
      const y = yCornice + t.dy;
      // Wschód
      const mE = new THREE.Mesh(
        new THREE.BoxGeometry(t.out, t.h, width + t.out * 2),
        this.mats.corniceWhite
      );
      mE.position.set(xFront + t.out * 0.5, y, -width * 0.5);
      // Zachód
      const mW = new THREE.Mesh(
        new THREE.BoxGeometry(t.out, t.h, width + t.out * 2),
        this.mats.corniceWhite
      );
      mW.position.set(xMainRear - t.out * 0.5, y, -width * 0.5);
      // Północ
      const mN = new THREE.Mesh(
        new THREE.BoxGeometry(depth + t.out * 2, t.h, t.out),
        this.mats.corniceWhite
      );
      mN.position.set(0, y, zNorth - t.out * 0.5);

      group.add(mE, mW, mN);
    }

    // Rury spustowe w narożnikach północno-wschodnim i północno-zachodnim
    const pipeH = yCornice - ELEVATIONS.GROUND_LEVEL;
    const pipeGeo = new THREE.CylinderGeometry(0.05, 0.05, pipeH, 10);
    const pipeNE = new THREE.Mesh(pipeGeo, this.mats.zincFlashing);
    pipeNE.position.set(xFront - 0.12, pipeH * 0.5, zNorth - 0.08);
    const pipeNW = new THREE.Mesh(pipeGeo, this.mats.zincFlashing);
    pipeNW.position.set(xMainRear + 0.12, pipeH * 0.5, zNorth - 0.08);
    group.add(pipeNE, pipeNW);
  }

  // ==========================================================================
  // UNIWERSALNY GENERATOR ŚCIAN Z OTWORAMI I STOLARKĄ
  // ==========================================================================
  _buildWall(parentGroup, cfg) {
    const { axis, fixedCoord, thickness, start, end, yBottom, yTop, material, openings } = cfg;
    const sorted = [...openings].sort((a, b) => a.cMin - b.cMin);

    const addSegment = (c1, c2, y1, y2) => {
      const len = c2 - c1;
      const h = y2 - y1;
      if (len <= 0.005 || h <= 0.005) return;
      const sx = axis === 'X' ? len : thickness;
      const sz = axis === 'Z' ? len : thickness;
      const geo = new THREE.BoxGeometry(sx, h, sz);
      const mesh = new THREE.Mesh(geo, material);
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
        addSegment(cursor, op.cMin, yBottom, yTop);
      }
      if (op.yMin > yBottom) {
        addSegment(op.cMin, op.cMax, yBottom, op.yMin);
      }
      if (op.yMax < yTop) {
        addSegment(op.cMin, op.cMax, op.yMax, yTop);
      }
      this._buildJoineryInOpening(parentGroup, axis, fixedCoord, thickness, op);
      cursor = op.cMax;
    }
    if (cursor < end) {
      addSegment(cursor, end, yBottom, yTop);
    }
  }

  /**
   * Modeluje stolarkę okienną (ramy, słupki, szprosy, szyby przezierne, parapety lastrykowe)
   * oraz stolarkę drzwiową w otworach ściennych.
   */
  _buildJoineryInOpening(parentGroup, axis, fixedCoord, thickness, op) {
    const cMid = (op.cMin + op.cMax) * 0.5;
    const yMid = (op.yMin + op.yMax) * 0.5;
    const w = op.cMax - op.cMin;
    const h = op.yMax - op.yMin;

    const joinery = new THREE.Group();
    if (axis === 'X') {
      joinery.position.set(cMid, yMid, fixedCoord);
    } else {
      joinery.position.set(fixedCoord, yMid, cMid);
      joinery.rotation.y = Math.PI * 0.5;
    }

    if (op.type === 'window2' || op.type === 'window3') {
      const panes = op.type === 'window3' ? 3 : 2;
      const frameT = 0.055;
      const depth = 0.09;

      // Ościeżnica zewnętrzna (góra, dół, boki)
      const topBar = new THREE.Mesh(new THREE.BoxGeometry(w, frameT, depth), this.mats.windowFrameWhite);
      topBar.position.y = h * 0.5 - frameT * 0.5;
      const botBar = new THREE.Mesh(new THREE.BoxGeometry(w, frameT, depth), this.mats.windowFrameWhite);
      botBar.position.y = -h * 0.5 + frameT * 0.5;
      const leftBar = new THREE.Mesh(new THREE.BoxGeometry(frameT, h, depth), this.mats.windowFrameWhite);
      leftBar.position.x = -w * 0.5 + frameT * 0.5;
      const rightBar = new THREE.Mesh(new THREE.BoxGeometry(frameT, h, depth), this.mats.windowFrameWhite);
      rightBar.position.x = w * 0.5 - frameT * 0.5;
      joinery.add(topBar, botBar, leftBar, rightBar);

      // Słupki pionowe (mullions) i ślemiona poziome (transoms)
      for (let i = 1; i < panes; i++) {
        const mx = -w * 0.5 + (w / panes) * i;
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.045, h - frameT * 2, depth), this.mats.windowFrameWhite);
        mullion.position.x = mx;
        joinery.add(mullion);
      }
      const transom = new THREE.Mesh(new THREE.BoxGeometry(w - frameT * 2, 0.035, depth * 0.8), this.mats.windowFrameWhite);
      transom.position.y = h * 0.18;
      joinery.add(transom);

      // Tafla szkła architektonicznego (przezierna z obu stron!)
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(w - frameT * 2, h - frameT * 2, 0.015),
        this.mats.glassClear
      );
      joinery.add(glass);

      // Parapet wewnętrzny i zewnętrzny z lastriko
      const sill = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.10, 0.045, thickness + 0.10),
        this.mats.terrazzo
      );
      sill.position.y = -h * 0.5 - 0.01;
      joinery.add(sill);
    } else if (op.type === 'balconyPortfenetr' || op.type === 'glazedDoubleDoor') {
      // Dwuskrzydłowe drzwi balkonowe / werandowe przeszklone
      const frameT = 0.06;
      const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.08), this.mats.windowFrameWhite);
      leftLeaf.position.x = -w * 0.5 + 0.025;
      const rightLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.08), this.mats.windowFrameWhite);
      rightLeaf.position.x = w * 0.5 - 0.025;
      const centerPost = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.08), this.mats.windowFrameWhite);
      const botKick = new THREE.Mesh(new THREE.BoxGeometry(w, 0.38, 0.06), this.mats.windowFrameWhite);
      botKick.position.y = -h * 0.5 + 0.19;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, h - 0.44, 0.015), this.mats.glassClear);
      glass.position.y = 0.18;
      joinery.add(leftLeaf, rightLeaf, centerPost, botKick, glass);
    } else if (op.type === 'salonPortalDoor') {
      // Reprezentacyjne dwuskrzydłowe drzwi z korytarza do salonu (otwarte do wewnątrz, jak na zdjęciu tempImageAedmXv!)
      const frameTop = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, thickness + 0.04), this.mats.oakStairs);
      frameTop.position.y = h * 0.5 - 0.025;
      joinery.add(frameTop);

      const createOpenLeaf = (sign) => {
        const leafGroup = new THREE.Group();
        const leafW = w * 0.48;
        const woodFrame = new THREE.Mesh(new THREE.BoxGeometry(leafW, h - 0.06, 0.045), this.mats.oakStairs);
        woodFrame.position.x = sign * leafW * 0.5;
        const ornGlass = new THREE.Mesh(new THREE.BoxGeometry(leafW * 0.65, h * 0.62, 0.05), this.mats.glassOrnamental);
        ornGlass.position.set(sign * leafW * 0.5, 0.1, 0);
        leafGroup.add(woodFrame, ornGlass);
        leafGroup.position.x = -sign * (w * 0.5 - 0.04);
        leafGroup.rotation.y = sign * 1.18; // uchylone do salonu
        return leafGroup;
      };
      joinery.add(createOpenLeaf(1), createOpenLeaf(-1));
    } else if (op.type === 'entryDoor' || op.type === 'gardenDoor') {
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), this.mats.doorWood);
      const upperGlass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, h * 0.42, 0.08), this.mats.glassClear);
      upperGlass.position.y = h * 0.16;
      joinery.add(doorFrame, upperGlass);
    } else if (op.type === 'interiorDoor') {
      // Ościeżnica drewniana (otwarta dla swobodnego spaceru awatara TPP!)
      const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, thickness + 0.03), this.mats.doorWood);
      jambL.position.x = -w * 0.5 + 0.025;
      const jambR = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, thickness + 0.03), this.mats.doorWood);
      jambR.position.x = w * 0.5 - 0.025;
      const head = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, thickness + 0.03), this.mats.doorWood);
      head.position.y = h * 0.5 - 0.025;
      joinery.add(jambL, jambR, head);
    }

    parentGroup.add(joinery);
  }

  // ==========================================================================
  // DETALE WNĘTRZ I WINOROŚL OGRODOWA (ZE ZDJĘĆ Z NATURY)
  // ==========================================================================
  _buildGroundFloorInteriors(group, y0, options) {
    // 1. Pionowa boazeria drewniana w korytarzu i na całej wysokości zabiegu klatki schodowej
    // (dokładnie jak na zdjęciach 1, 2 i 3!)
    // a) Pas boazerii przy portalu Salonu i wzdłuż dolnego biegu schodów (X = -0.945 m)
    const wainscotLower = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 2.18, 2.45),
      this.mats.wainscotingWood
    );
    wainscotLower.position.set(-0.945, y0 + 1.09, -2.55);
    group.add(wainscotLower);

    // Skośne zwieńczenie boazerii wzdłuż biegu dolnego i I piętra (X = -0.945 m)
    const wainscotUpperWest = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 3.20, 2.50),
      this.mats.wainscotingWood
    );
    wainscotUpperWest.position.set(-0.945, y0 + 3.65, -1.62);
    group.add(wainscotUpperWest);

    // b) Pełna boazeria ściany południowej zabiegu (Z = -0.395 m, X od -0.94 do +0.98 m) przez 2 kondygnacje
    const wainscotSouth = new THREE.Mesh(
      new THREE.BoxGeometry(1.92, 6.10, 0.02),
      this.mats.wainscotingWood
    );
    wainscotSouth.position.set(0.02, y0 + 3.05, -0.395);
    group.add(wainscotSouth);

    // c) Pełna boazeria ściany wschodniej zabiegu (X = +0.975 m, Z od -2.01 do -0.39 m) na I piętrze i w zabiegu
    const wainscotEast = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 3.80, 1.62),
      this.mats.wainscotingWood
    );
    wainscotEast.position.set(0.975, y0 + 4.10, -1.20);
    group.add(wainscotEast);

    // d) Boazeria na ścianie wschodniej korytarza parteru (X = +1.05 m, przy drzwiach do WC i sypialni)
    const wainscotHallEast = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 2.08, 3.20),
      this.mats.wainscotingWood
    );
    wainscotHallEast.position.set(1.04, y0 + 1.04, -4.10);
    group.add(wainscotHallEast);

    // e) Skrzydła drzwiowe w głębi korytarza (drzwi do piwnicy pod schodami Z=-1.35 oraz drzwi do WC X=+1.05)
    const basementDoorLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 1.98, 0.04),
      this.mats.doorWood
    );
    basementDoorLeaf.position.set(0.54, y0 + 0.99, -1.35);
    group.add(basementDoorLeaf);

    const wcDoorLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 1.98, 0.76),
      this.mats.doorWood
    );
    wcDoorLeaf.position.set(1.03, y0 + 0.99, -1.92);
    group.add(wcDoorLeaf);

    // f) Charakterystyczne detale ze zdjęcia nr 1:
    // - Kwietnik z rośliną obok pierwszego biegu schodów i drzwi piwnicznych (X = +0.08, Z = -1.48)
    const standPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.12, 0.62, 10),
      this.mats.railingSteel
    );
    standPole.position.set(0.09, y0 + 0.31, -1.48);
    const plantBush = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.16, 1),
      this.mats.grapevineLeaf
    );
    plantBush.position.set(0.09, y0 + 0.70, -1.48);
    group.add(standPole, plantBush);

    // - Mały obrazek w ciemnej ramce nad drzwiami do piwnicy (Z = -1.36, Y = y0 + 2.20)
    const smallFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.25, 0.02),
      this.mats.railingSteel
    );
    smallFrame.position.set(0.54, y0 + 2.18, -1.36);
    group.add(smallFrame);

    // - Obraz w ramie nad dwuskrzydłowymi drzwiami do Salonu (X = -0.94, Z = -3.65, Y = y0 + 2.45)
    const largePainting = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.48, 0.88),
      this.mats.oakStairs
    );
    largePainting.position.set(-0.94, y0 + 2.46, -3.55);
    group.add(largePainting);

    // 2. Stół jadalniany i narożnik w Salonie (wg zdjęcia tempImagezMOwxN)
    const tableGroup = new THREE.Group();
    tableGroup.position.set(-2.85, y0, -2.55);
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.05, 0.90), this.mats.oakStairs);
    tableTop.position.y = 0.76;
    tableGroup.add(tableTop);
    for (const [dx, dz] of [[-0.62, -0.38], [0.62, -0.38], [-0.62, 0.38], [0.62, 0.38]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), this.mats.oakStairs);
      leg.position.set(dx, 0.375, dz);
      tableGroup.add(leg);
    }
    group.add(tableGroup);

    // 3. Stół w Werandzie / Jadalni (wg zdjęcia tempImageEvfnly)
    if (options.includeVeranda1966) {
      const vTable = new THREE.Mesh(new THREE.BoxGeometry(1.50, 0.74, 0.85), this.mats.windowFrameWhite);
      vTable.position.set(-6.85, y0 + 0.37, -3.20);
      group.add(vTable);
    }
  }

  _buildFirstFloorInteriors(group, y0, options) {
    // 1. Wanna i umywalka w Łazience (wg zdjęcia CAM04971G0-PR0284-STILL017)
    const bathTub = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.56, 0.72),
      this.mats.windowFrameWhite
    );
    bathTub.position.set(3.15, y0 + 0.28, -0.82);
    group.add(bathTub);

    // 2. Biały żeliwny stolik i krzesła ogrodowe na Tarasie I piętra (wg zdjęcia CAM04971G0-PR0284-STILL021)
    if (options.includeVeranda1966) {
      const gardenSet = new THREE.Group();
      gardenSet.position.set(-6.85, y0, -3.10);
      const roundTop = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.03, 20), this.mats.castIronWhite);
      roundTop.position.y = 0.72;
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.28, 0.70, 12), this.mats.castIronWhite);
      ped.position.y = 0.35;
      gardenSet.add(roundTop, ped);
      group.add(gardenSet);
    }
  }

  _buildGardenGrapevines(vinesGroup) {
    // Pnącza winorośli (dzikiego wina) oplatające gzyms werandy i balustradę tarasu I piętra
    // Dokładnie jak na fotografiach PXL_20260815_083108470.jpg i PXL_20260814_125024786.jpg
    const yTerrace = ELEVATIONS.FIRST_FLOOR; // +4.70 m
    const xVeranda = BUILDING_DIMS.X_VERANDA_FACE; // -8.20 m
    const zNorth = BUILDING_DIMS.Z_NORTH_FACE; // -6.08 m

    const leafClusterGeo = new THREE.DodecahedronGeometry(0.32, 1);

    // Pasmo wzdłuż zachodniej balustrady tarasu i gzymsu werandy
    for (let z = -5.95; z <= -0.35; z += 0.36) {
      const c1 = new THREE.Mesh(leafClusterGeo, this.mats.grapevineLeaf);
      c1.position.set(
        xVeranda - 0.05 + Math.sin(z * 3.1) * 0.08,
        yTerrace + 0.65 + Math.cos(z * 2.7) * 0.22,
        z
      );
      c1.scale.set(0.85, 1.15, 1.1);
      c1.castShadow = true;
      vinesGroup.add(c1);

      // Kaskada opadająca na gzyms werandy
      if (Math.abs(z + 3.0) < 1.2 || z < -4.8) {
        const c2 = new THREE.Mesh(leafClusterGeo, this.mats.grapevineLeaf);
        c2.position.set(xVeranda - 0.12, yTerrace - 0.35 + Math.sin(z * 4) * 0.25, z);
        vinesGroup.add(c2);
      }
    }

    // Pasmo wzdłuż północnej balustrady tarasu nad werandą
    for (let x = xVeranda; x <= -5.55; x += 0.38) {
      const cN = new THREE.Mesh(leafClusterGeo, this.mats.grapevineLeaf);
      cN.position.set(x, yTerrace + 0.72 + Math.sin(x * 3.5) * 0.18, zNorth - 0.04);
      cN.castShadow = true;
      vinesGroup.add(cN);
    }
  }

  // ==========================================================================
  // INTERAKTYWNE STREFY POMIESZCZEŃ DO RAYCASTINGU (ROOMS_SPEC)
  // ==========================================================================
  _buildInteractiveRoomVolumes(floorGroups, interactiveRooms) {
    for (const room of ROOMS_SPEC) {
      const { xMin, xMax, yMin, yMax, zMin, zMax } = room.bounds;
      const sx = xMax - xMin;
      const sy = yMax - yMin;
      const sz = zMax - zMin;

      // Poduszka podłogowa do klikania i podświetlania pomieszczenia
      const padGeo = new THREE.BoxGeometry(sx - 0.12, 0.12, sz - 0.12);
      const padMat = new THREE.MeshBasicMaterial({
        color: 0xd4af37,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      });
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.position.set((xMin + xMax) * 0.5, yMin + 0.09, (zMin + zMax) * 0.5);
      padMesh.userData.roomSpec = room;

      // Obrys krawędziowy podświetlonego pokoju
      const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(sx - 0.08, sy * 0.35, sz - 0.08));
      const edgesMat = new THREE.LineBasicMaterial({
        color: 0xf0ca50,
        transparent: true,
        opacity: 0.0,
      });
      const edgesLine = new THREE.LineSegments(edgesGeo, edgesMat);
      edgesLine.position.y = (sy * 0.35) * 0.5;
      padMesh.add(edgesLine);
      padMesh.userData.highlightEdges = edgesLine;

      if (room.floorKey === 'firstFloor') {
        floorGroups.firstFloorGroup.add(padMesh);
      } else if (room.floorKey === 'atticWalls') {
        floorGroups.atticWallsGroup.add(padMesh);
      } else {
        floorGroups.groundFloorGroup.add(padMesh);
      }

      interactiveRooms.push(padMesh);
    }
  }
}
