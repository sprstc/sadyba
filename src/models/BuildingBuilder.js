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

    // 4. SCHODY NA PODDASZE (z I piętra +4.70 m na strych +7.55 m: 14 stopni × 21/21 cm wg rzutu 1966 r.)
    const atticStairs = this._buildOakWinderStairs(
      ELEVATIONS.FIRST_FLOOR,
      ELEVATIONS.ATTIC_FLOOR,
      14,
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
    // Pokój frontowy / gabinet (12,52 m² wg rzutu 1966 r. – klepka dębowa w jodełkę)
    addFloorTile(1.05, 5.12, -5.70, -2.45, this.mats.oakParquet);
    // Centralny Wiatrołap / Ganek wejściowy (1,61 m², głęb. 95 cm × szer. 170 cm wg rzutu 1966 r.):
    // Zagłębiony centralnie między podestem zewnętrznym (Z = -6.22 m) a korytarzem (Z = -5.27 m) w osi X = -0.02 m!
    addFloorTile(-0.87, 0.83, -6.22, -5.27, this.mats.terrazzo);
    // Korytarz główny (7,24 m²) w układzie litery "L":
    // - pełna szerokość części północnej przed schodami (X od -1.10 do +1.05, Z od -5.27 do -2.85),
    // - przejście wzdłuż biegu schodów (X od +0.02 do +1.05, Z od -2.85 do -1.35),
    // - wnęka rozdzielcza "L" (110×90 cm: X od +1.05 do +1.95, Z od -2.45 do -1.35) przed wejściem do pokoju, kuchni i WC!
    // Otwór nad biegiem schodów piwnicznych (X od -0.95 do +0.02, Z od -2.65 do -0.38) pozostaje otwarty!
    addFloorTile(-1.10, 1.05, -5.27, -2.85, this.mats.oakParquet);
    addFloorTile(-0.95, 0.02, -2.85, -2.65, this.mats.oakParquet);
    addFloorTile(0.02, 1.05, -2.85, -1.35, this.mats.oakParquet);
    addFloorTile(1.05, 1.95, -2.45, -1.35, this.mats.oakParquet);
    // Toaleta / WC parteru (0,99 m², 120×97 cm w narożniku przy kominie: X od +1.02 do +2.22, Z od -1.35 do -0.38)
    addFloorTile(1.02, 2.22, -1.35, -0.38, this.mats.terrazzo);
    // Kuchnia (5,96 m², 230×284 cm + strefa wejściowa: jasna drobna terakota/mozaika jak na zdjęciu z wnętrza)
    addFloorTile(1.95, 2.22, -2.45, -1.35, this.mats.verandaMosaic);
    addFloorTile(2.22, 5.12, -2.45, -0.38, this.mats.verandaMosaic);

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
    // Okno salonu (155×150 cm), centralna wnęka ganku/wiatrołapu (X od -0.87 do +0.83 m) oraz okno gabinetu (150×150 cm)
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
        { cMin: -0.62, cMax: 0.58,  yMin: y0,        yMax: y0 + 2.18, type: 'openArch' },
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

      // Ściana zachodnia werandy (X = -8.20 m):
      // Zgodnie ze zdjęciem z natury: po lewej (od północy, Z od -5.35 do -4.50 m) znajdują się białe,
      // w pełni przeszklone drzwi ogrodowe wychodzące wprost na podest schodów ogrodowych,
      // połączone w jeden zestaw z oknem panoramicznym (Z od -4.50 do -3.15 m),
      // a po prawej (Z od -2.80 do -0.70 m) drugie szerokie okno panoramiczne.
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
          { cMin: -5.35, cMax: -4.50, yMin: y0,        yMax: y0 + 2.35, type: 'verandaGardenDoor' },
          { cMin: -4.50, cMax: -3.15, yMin: y0 + 0.80, yMax: y0 + 2.35, type: 'window2' },
          { cMin: -2.80, cMax: -0.70, yMin: y0 + 0.80, yMax: y0 + 2.35, type: 'window2' },
        ],
      });

      // Pionowa rura spustowa na środkowym filarku ściany zachodniej werandy (widoczna na zdjęciu!)
      const verandaPipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, y1 - ELEVATIONS.GROUND_LEVEL, 10),
        this.mats.railingSteel
      );
      verandaPipe.position.set(xVeranda - 0.04, (y1 - ELEVATIONS.GROUND_LEVEL) * 0.5, -2.97);
      group.add(verandaPipe);

      // Ściana północna werandy (Z = -6.08 m) z oknem bocznym (bez wiszących w powietrzu drzwi!)
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
          { cMin: -7.55, cMax: -5.95, yMin: y0 + 0.80, yMax: y0 + 2.35, type: 'window2' },
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

    // 1b) Centralny Wiatrołap / Ganek wejściowy (1,61 m², głęb. 95 cm × szer. 170 cm wg rzutu 1966 r. i zdjęć):
    // - Zewnętrzna ścianka frontowa ganku (Z = -6.22 m, X od -0.87 do +0.83 m) z centralnymi drzwiami wejściowymi 110×200 cm (X od -0.57 do +0.53 m),
    // - Boczne ścianki i szafy wnękowe w wiatrołapie (po lewej X od +0.58 do +0.83 m i po prawej X od -0.87 do -0.62 m, Z od -6.22 do -5.27 m),
    // - Wewnętrzna ścianka wiatrołapu zamykająca korytarz od północy (Z = -5.27 m, X od -1.08 do +1.05 m)
    //   z centralnie umieszczonymi półtoraskrzydłowymi przeszklonymi drzwiami 120×200 cm (X od -0.62 do +0.58 m)!
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: -6.22,
      thickness: 0.16,
      start: -0.87,
      end: 0.83,
      yBottom: y0,
      yTop: y1,
      material: this.mats.facadePlaster,
      openings: [
        { cMin: -0.57, cMax: 0.53, yMin: y0, yMax: y0 + 2.10, type: 'entryDoor' },
      ],
    });

    // Boczne ścianki zagłębienia ganku i jasne drewniane szafy wnękowe po obu stronach wiatrołapu (jak na zdjęciu nr 4!)
    for (const xSide of [-0.745, 0.705]) {
      const closetBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, y1 - y0, 0.95),
        this.mats.oakParquet
      );
      closetBox.position.set(xSide, (y0 + y1) * 0.5, -5.745);
      closetBox.castShadow = true;
      closetBox.receiveShadow = true;
      group.add(closetBox);
    }

    // Wewnętrzna ściana oddzielająca Wiatrołap od Korytarza (Z = -5.27 m, na całej szerokości korytarza X od -1.08 do +1.05 m)
    // Centralne drzwi półtoraskrzydłowe 120×200 cm (X od -0.62 do +0.58 m, oś X = -0.02 m)
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: -5.27,
      thickness: tPart,
      start: -1.08,
      end: 1.05,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [
        { cMin: -0.62, cMax: 0.58, yMin: y0, yMax: y0 + 2.05, type: 'vestibuleInnerDoor' },
      ],
    });

    // 2) Ściana między Pokojem frontowym (12,52 m²) a Korytarzem (X = +1.05 m, Z od -5.70 do -2.45 m)
    // Zgodnie z rzutem inwentaryzacji 1966 r. (280 cm) oraz zdjęciem z wnętrza:
    // Ściana ta jest PEŁNA (bez otworu drzwiowego!), wykończona boazerią i grzejnikiem,
    // natomiast wejście do pokoju (0,80×2,00 m) znajduje się w ścianie poprzecznej Z = -2.45 m z wnęki "L"!
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: 1.05,
      thickness: tPart,
      start: zNorth + tExt,
      end: -2.45,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [],
    });

    // 3) Ściana poprzeczna na Z = -2.45 m (X od +1.05 do +5.12 m):
    // - W odcinku wnęki rozdzielczej korytarza (X od +1.05 do +1.95 m): mieści DRZWI DO POKOJU (12,52 m²) 0,80×2,00 m!
    // - W odcinku między Kuchnią (5,96 m²) a Pokojem (X od +1.95 do +5.12 m, dł. 313 cm): PEŁNA ŚCIANA bez drzwi!
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
        { cMin: 1.10, cMax: 1.90, yMin: y0, yMax: y0 + 2.02, type: 'interiorDoor' },
      ],
    });

    // 4) Ścianka wschodnia wnęki "L" korytarza z DRZWIAMI DO KUCHNI (5,96 m²) 0,80×2,00 m
    //    (X = +1.95 m, Z od -2.45 do -1.35 m, szer. wnęki 110 cm wg rzutu 1966 r.)
    //    Patrząc ze schodów w prawo (na wschód), wchodzi się prosto przez te drzwi do kuchni (jak na zdjęciu!)
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: 1.95,
      thickness: tPart,
      start: -2.45,
      end: -1.35,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [
        { cMin: -2.30, cMax: -1.50, yMin: y0, yMax: y0 + 2.02, type: 'interiorDoor' },
      ],
    });

    // 5) Ścianka północna pod zabiegiem schodów i przed WC (Z = -1.35 m, X od +0.02 do +2.22 m):
    // - W części pod schodami (X od +0.02 do +1.02 m): drzwi zejścia do piwnicy 0,80×2,00 m (cMin: 0.14, cMax: 0.90),
    // - W części WC (X od +1.02 do +2.22 m, szer. 120 cm wg rzutu 1966 r.): drzwi do WC 0,60×2,00 m (cMin: 1.15, cMax: 1.75)!
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: -1.35,
      thickness: 0.10,
      start: 0.02,
      end: 2.22,
      yBottom: y0,
      yTop: y1,
      material: this.mats.interiorWall,
      openings: [
        { cMin: 0.14, cMax: 0.90, yMin: y0, yMax: y0 + 2.02, type: 'interiorDoor' },
        { cMin: 1.15, cMax: 1.75, yMin: y0, yMax: y0 + 2.02, type: 'interiorDoor' },
      ],
    });

    // 6) Ścianka wschodnia WC oddzielająca WC (0,99 m², 120×97 cm) od Kuchni (5,96 m²)
    //    (X = +2.22 m, Z od -1.35 do -0.38 m – tworzy charakterystyczny uskok 120×160 cm w kuchni na rzucie 1966!)
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: 2.22,
      thickness: tPart,
      start: -1.35,
      end: zSouth - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [],
    });

    // 6b) Ścianka zachodnia WC oddzielająca WC od zabiegu schodów dębowych (X = +1.02 m, Z od -1.35 do -0.38 m)
    //     Kończy się na Z = -1.35 m, dzięki czemu wnęka korytarza (Z od -2.45 do -1.35 m) jest w pełni otwarta!
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: 1.02,
      thickness: tPart,
      start: -1.35,
      end: zSouth - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [],
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

    // Posadzki I piętra (dokładnie wg Rzutu 1-ego Piętra 1966 r. oraz detalu korytarza 3,76 m²):
    // 1. Sypialnia Główna Zachodnia (25,58 m²):
    //    - główny trakt zachodni (szer. 400 cm × dł. 560 cm: X od -5.15 do -1.00 m, Z od -5.70 do -0.38 m),
    //    - poszerzenie północno-wschodnie do 513 cm (50 cm przejścia + 63 cm szafy wnękowej: X od -1.00 do +0.02 m, Z od -5.70 do -3.05 m)!
    addFloorTile(-5.15, -1.00, -5.70, -0.38, this.mats.oakParquet);
    addFloorTile(-1.00, 0.02, -5.70, -3.05, this.mats.oakParquet);

    // 2. Sypialnia Wschodnia (16,58 m²):
    //    - szerokość od północy 507 cm (287 cm + 220 cm: X od +0.02 do +5.12 m, Z od -5.70 do -3.05 m),
    //    - trakt wschodni za łazienką (szer. 287 cm: X od +1.95 do +5.12 m, Z od -3.05 do -2.35 m),
    //    - strefa wejściowa za drzwiami z korytarza (X od +1.02 do +1.95 m, Z od -3.05 do -2.95 m).
    addFloorTile(0.02, 5.12, -5.70, -3.05, this.mats.oakParquet);
    addFloorTile(1.95, 5.12, -3.05, -2.35, this.mats.oakParquet);
    addFloorTile(1.02, 1.95, -3.05, -2.95, this.mats.oakParquet);

    // 3. Korytarz I piętra (3,76 m² wg rzutu 1966 r. i załączonego detalu korytarza):
    //    - wnęka wschodnia (dł. 160 cm: X od +1.02 do +1.95 m, Z od -2.95 do -1.35 m) między drzwiami WC (Z = -1.35),
    //      drzwiami Łazienki (X = +1.95) i drzwiami Sypialni Wschodniej (Z = -2.95),
    //    - część centralna przed wyjściem schodów z parteru (głęb. 128 cm, szer. 110 cm: X od +0.02 do +1.02 m, Z od -3.05 do -1.92 m),
    //    - przejście zachodnie (szer. 73/84 cm: X od -1.00 do +0.02 m, Z od -3.05 do -2.21 m) przed pierwszym stopniem
    //      schodów strychowych (183 cm od ściany płd.), prowadzące do drzwi Sypialni Głównej (X = -1.00 m)!
    addFloorTile(1.02, 1.95, -2.95, -1.35, this.mats.oakParquet);
    addFloorTile(0.02, 1.02, -3.05, -1.92, this.mats.oakParquet);
    addFloorTile(-1.00, 0.02, -3.05, -2.21, this.mats.oakParquet);

    // 4. Toaleta / WC I piętra (0,80 m², 107×83 cm w narożniku przy kominie: X od +1.02 do +2.09 m, Z od -1.35 do -0.38 m)
    addFloorTile(1.02, 2.09, -1.35, -0.38, this.mats.terrazzo);

    // 5. Łazienka (5,06 m², 290×185 cm z uskokiem WC: X od +1.95 do +5.12 m, Z od -2.35 do -0.38 m)
    addFloorTile(1.95, 2.09, -2.35, -1.35, this.mats.verandaMosaic);
    addFloorTile(2.09, 5.12, -2.35, -0.38, this.mats.verandaMosaic);

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

    // ŚCIANY WEWNĘTRZNE I PIĘTRA (dokładnie wg Rzutu 1-ego Piętra 1966 r., detalu korytarza 3,76 m² oraz zdjęć 3 i 4):
    // 1) Ściana zachodnia klatki schodowej i korytarza (X = -1.00 m, Z od -3.05 do -0.38 m):
    //    - od Z = -2.21 do -0.38 m (dł. 183 cm): pełna ściana wzdłuż dolnego biegu schodów strychowych (14×21/21),
    //    - od Z = -3.05 do -2.21 m (szer. przejścia 73/84 cm przed schodami strychowymi):
    //      mieści DRZWI DO SYPIALNI GŁÓWNEJ (25,58 m²) 0,80×2,00 m!
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: -1.00,
      thickness: tInt,
      start: -3.05,
      end: zSouth - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.interiorWall,
      openings: [
        { cMin: -3.01, cMax: -2.21, yMin: y0, yMax: y0 + 2.02, type: 'interiorDoor' },
      ],
    });

    // 2) Pełna ściana północna korytarza I piętra (Z = -3.05 m, X od -1.00 do +1.04 m, gr. 15 cm):
    //    - od X = -1.00 do +0.02 m: zamyka od północy przejście (73 cm) przed schodami strychowymi (za ścianą znajduje się
    //      50 cm przejścia i 63 cm szafy wnękowej Sypialni Głównej!),
    //    - od X = +0.02 do +1.04 m (odcinek 110 cm w odległości 128 cm od schodów): pełna ściana z ciemną boazerią
    //      oddzielająca korytarz od poszerzenia (220 cm) Sypialni Wschodniej!
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: -3.05,
      thickness: 0.15,
      start: -1.00,
      end: 1.04,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [],
    });

    // 3) Ściana działowa między dwoma sypialniami w części północnej (X = +0.02 m, Z od -5.70 do -3.05 m, dł. 282 cm):
    //    Przedłuża centralną oś klatki schodowej do ściany północnej budynku, dzieląc front północny na:
    //    - Sypialnię Wschodnią (16,58 m²) o szerokości 287 + 220 = 507 cm (X od +0.02 do +5.12 m),
    //    - Sypialnię Główną (25,58 m²) o szerokości 63 + 50 + 400 = 513 cm (X od -5.12 do +0.02 m, z szafą wnękową 63 cm przy tej ścianie)!
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: 0.02,
      thickness: tPart,
      start: zNorth + tExt,
      end: -3.05,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [],
    });

    // 4) Ścianka północna wschodniej wnęki korytarza z DRZWIAMI DO SYPIALNI WSCHODNIEJ (16,58 m²) 0,80×2,00 m
    //    (Z = -2.95 m, X od +1.02 do +1.95 m – z 10 cm uskokiem względem ściany Z = -3.05 m, dokładnie jak na detalu korytarza!)
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: -2.95,
      thickness: tPart,
      start: 1.02,
      end: 1.95,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [
        { cMin: 1.08, cMax: 1.88, yMin: y0, yMax: y0 + 2.02, type: 'interiorDoor' },
      ],
    });

    // 5) Ścianka wschodnia korytarza (X = +1.95 m, Z od -2.95 do -1.35 m, łączna długość 160 cm wg rzutu 1966 r.):
    //    - od Z = -2.95 do -2.35 m (odcinek 30 cm + mur): pełna ścianka narożnika Sypialni Wschodniej,
    //    - od Z = -2.35 do -1.35 m: ścianka z DRZWIAMI DO ŁAZIENKI (5,06 m²) 0,75×2,00 m!
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: 1.95,
      thickness: tPart,
      start: -2.95,
      end: -1.35,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [
        { cMin: -2.20, cMax: -1.45, yMin: y0, yMax: y0 + 2.00, type: 'interiorDoor' },
      ],
    });

    // 6) Pełna ściana poprzeczna między Łazienką (5,06 m², szer. 185 cm) a Sypialnią Wschodnią (16,58 m²)
    //    (Z = -2.35 m, X od +1.95 do +5.12 m, dł. 287/290 cm)
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: -2.35,
      thickness: tPart,
      start: 1.95,
      end: xFront - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [],
    });

    // 7) Ścianka frontowa WC I piętra (Z = -1.35 m, WYŁĄCZNIE od X = +1.02 do +2.09 m, szer. 107 cm wg rzutu 1966 r.):
    //    Mieści DRZWI DO WC (0,80 m²) 0,60×2,00 m i NIE wchodzi w światło schodów (X od +0.02 do +1.02 m jest w pełni otwarte)!
    this._buildWall(group, {
      axis: 'X',
      fixedCoord: -1.35,
      thickness: 0.10,
      start: 1.02,
      end: 2.09,
      yBottom: y0,
      yTop: y1,
      material: this.mats.interiorWall,
      openings: [
        { cMin: 1.12, cMax: 1.72, yMin: y0, yMax: y0 + 2.00, type: 'interiorDoor' },
      ],
    });

    // 8) Ścianka wschodnia WC oddzielająca WC (0,80 m², 107×83 cm) od Łazienki (5,06 m²)
    //    (X = +2.09 m, Z od -1.35 do -0.38 m – tworzy charakterystyczny uskok 165/290 cm w Łazience na rzucie 1966!)
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: 2.09,
      thickness: tPart,
      start: -1.35,
      end: zSouth - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [],
    });

    // 9) Ścianka zachodnia WC oddzielająca WC od zabiegu schodów (X = +1.02 m, Z od -1.35 do -0.38 m)
    this._buildWall(group, {
      axis: 'Z',
      fixedCoord: 1.02,
      thickness: tPart,
      start: -1.35,
      end: zSouth - tExt,
      yBottom: y0,
      yTop: y1,
      material: this.mats.partitionWall,
      openings: [],
    });

    // Niska ścianka policzkowa / balustrada oddzielająca zejście schodów od wnęki przed WC (X = +1.00 m, Z od -1.92 do -1.35 m)
    const stairCurbWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.96, 0.57),
      this.mats.wainscotingWood
    );
    stairCurbWall.position.set(1.00, y0 + 0.48, -1.635);
    group.add(stairCurbWall);

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

    // Część wschodnia, północna i zachodnia wokół klatki schodowej (z podejściem wyjściowym Z = -1.85 po stronie wschodniej)
    addPineFloor(1.05, xFront, zNorth, zSouth);
    addPineFloor(xRear, 1.05, zNorth, -2.21);
    addPineFloor(0.02, 1.05, -2.21, -1.80);
    addPineFloor(xRear, -0.95, -2.21, zSouth);

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

    const xWest = -0.94;   // Lico wschodnie ściany Salonu / Sypialni Głównej
    const xPivot = 0.02;   // Oś centralnego słupa dębowego (szerokość biegu = 0.96 m)
    const xEast = 0.98;    // Lico zachodnie ściany WC
    // Na parterze bieg dolny zaczyna się przy portalu Salonu (Z = -2.89 m, 7 stopni),
    // natomiast na I piętrze schody strychowe (14×21/21 wg rzutu 1966 r.) mają długość całkowitą 183 cm od ściany płd.,
    // więc ich pierwszy stopień zaczyna się na Z = -2.21 m (4 stopnie dolne), zostawiając 73/84 cm przejścia
    // (Z od -3.05 do -2.21 m) do drzwi Sypialni Głównej (X = -1.00 m)!
    const zStart = isMainFlight ? -2.89 : -2.21;
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
    // 2. BIEG DOLNY PROSTY (7 STOPNI NA PARTERZE / 4 STOPNIE NA I PIĘTRZE W KIERUNKU +Z)
    // ------------------------------------------------------------------------
    const nLower = isMainFlight ? 7 : 4;
    const lowerRun = (zPivot - zStart) / nLower; // ~0.215-0.22 m
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
    const porchWidth = 1.76;
    const xCenter = -0.02; // dokładnie w centralnej osi korytarza i wiatrołapu (1,61 m²)!

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
    // Schody z werandy do ogrodu bezpośrednio przed przeszklonymi drzwiami w ścianie ZACHODNIEJ
    // (X = -8.20 m, oś Z = -4.925 m, Z od -5.48 do -4.37 m), dokładnie jak na fotografii z natury:
    // - górny podest przy progu drzwiowym,
    // - stopnie wyłożone czerwoną terakotą/klinkierem schodzące na zachód (-X) do ogrodu,
    // - obustronne smukłe stalowe poręcze na słupkach.
    const group = new THREE.Group();
    group.name = 'Garden_Veranda_Stairs';

    const steps = 8;
    const landingDepth = 0.52;
    const totalLength = BUILDING_DIMS.GARDEN_STAIRS_LENGTH; // 2.37 m łącznie z podestem
    const runLength = totalLength - landingDepth;
    const stepRun = runLength / steps;
    const stepRise = (yGroundFloor - 0.04) / steps;
    const xWall = BUILDING_DIMS.X_VERANDA_FACE; // -8.20 m
    const zCenter = -4.925; // dokładnie w osi drzwi werandowych (Z od -5.35 do -4.50 m)
    const stairWidth = 1.12;

    // 1. Górny podest przed drzwiami werandy (X od -8.20 do -8.72 m)
    const landingH = yGroundFloor - 0.04;
    const landingMesh = new THREE.Mesh(
      new THREE.BoxGeometry(landingDepth, landingH, stairWidth),
      this.mats.clinkerStairs
    );
    landingMesh.position.set(xWall - landingDepth * 0.5, landingH * 0.5, zCenter);
    landingMesh.castShadow = true;
    landingMesh.receiveShadow = true;
    group.add(landingMesh);

    // 2. Stopnie schodzące na zachód (-X) do ogrodu
    const xStepsStart = xWall - landingDepth;
    for (let i = 0; i < steps; i++) {
      const h = landingH - (i + 1) * stepRise + stepRise;
      const sx = xStepsStart - (i + 0.5) * stepRun;
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(stepRun + 0.02, h, stairWidth),
        this.mats.clinkerStairs
      );
      stepMesh.position.set(sx, h * 0.5, zCenter);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      group.add(stepMesh);
    }

    // 3. Obustronne poręcze stalowe (lewa i prawa, jak na zdjęciu z ogrodu!)
    const slopeAngle = Math.atan2(landingH, runLength);
    const railLen = Math.hypot(runLength + landingDepth * 0.6, landingH);
    for (const side of [-1, 1]) {
      const zRail = zCenter + side * (stairWidth * 0.5 - 0.04);

      const handrail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, railLen, 8),
        this.mats.railingSteel
      );
      handrail.position.set(xWall - totalLength * 0.52, landingH * 0.5 + 0.86, zRail);
      handrail.rotation.z = Math.PI * 0.5 - slopeAngle;
      group.add(handrail);

      // Słupki podtrzymujące poręcz (u góry, w środku i u dołu biegu)
      for (const t of [0.12, 0.55, 0.94]) {
        const px = xWall - t * totalLength;
        const pyBase = Math.max(0, landingH * (1 - Math.max(0, (t * totalLength - landingDepth) / runLength)));
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 0.86, 8),
          this.mats.railingSteel
        );
        post.position.set(px, pyBase + 0.43, zRail);
        group.add(post);
      }
    }

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
    } else if (op.type === 'verandaGardenDoor') {
      // Białe, przeszklone na pełnej wysokości drzwi ogrodowe werandy (jak na zdjęciu z ogrodu):
      // - biała rama ościeżnicy i skrzydła,
      // - poziomy szpros (poprzeczka) na wysokości parapetu sąsiedniego okna (0.80 m od posadzki),
      // - przeszklenie zarówno w dolnej, jak i w górnej kwaterze.
      const frameT = 0.06;
      const depth = 0.09;
      const topBar = new THREE.Mesh(new THREE.BoxGeometry(w, frameT, depth), this.mats.windowFrameWhite);
      topBar.position.y = h * 0.5 - frameT * 0.5;
      const botBar = new THREE.Mesh(new THREE.BoxGeometry(w, frameT * 1.3, depth), this.mats.windowFrameWhite);
      botBar.position.y = -h * 0.5 + frameT * 0.65;
      const leftBar = new THREE.Mesh(new THREE.BoxGeometry(frameT, h, depth), this.mats.windowFrameWhite);
      leftBar.position.x = -w * 0.5 + frameT * 0.5;
      const rightBar = new THREE.Mesh(new THREE.BoxGeometry(frameT, h, depth), this.mats.windowFrameWhite);
      rightBar.position.x = w * 0.5 - frameT * 0.5;

      // Pozioma poprzeczka na wysokości parapetu (0.80 m nad posadzką)
      const midRailY = -h * 0.5 + 0.80;
      const midRail = new THREE.Mesh(new THREE.BoxGeometry(w - frameT * 2, 0.055, depth), this.mats.windowFrameWhite);
      midRail.position.y = midRailY;

      // Szyba górna i dolna
      const glassPane = new THREE.Mesh(
        new THREE.BoxGeometry(w - frameT * 2, h - frameT * 2.3, 0.016),
        this.mats.glassClear
      );
      joinery.add(topBar, botBar, leftBar, rightBar, midRail, glassPane);
    } else if (op.type === 'vestibuleInnerDoor') {
      // Centralne półtoraskrzydłowe przeszklone drzwi wewnętrzne wiatrołapu (120 × 200 cm, jak na zdjęciach 2 i 4!):
      // - skrzydło główne (szer. 84 cm) z dużą taflą szkła ornamentowego mrożonego,
      // - dostawka boczna (szer. 32 cm) z wąskim pionowym paskiem szkła ornamentowego.
      const head = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, thickness + 0.04), this.mats.oakStairs);
      head.position.y = h * 0.5 - 0.025;
      const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, thickness + 0.04), this.mats.oakStairs);
      jambL.position.x = -w * 0.5 + 0.025;
      const jambR = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, thickness + 0.04), this.mats.oakStairs);
      jambR.position.x = w * 0.5 - 0.025;
      joinery.add(head, jambL, jambR);

      // Dostawka wschodnia (lewa patrząc z korytarza na północ: X od +0.24 do +0.56)
      const sideW = 0.32;
      const sideLeaf = new THREE.Mesh(new THREE.BoxGeometry(sideW, h - 0.06, 0.045), this.mats.oakStairs);
      sideLeaf.position.x = w * 0.5 - 0.04 - sideW * 0.5;
      const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.11, h * 0.58, 0.05), this.mats.glassOrnamental);
      sideGlass.position.set(sideLeaf.position.x, 0.12, 0);
      joinery.add(sideLeaf, sideGlass);

      // Skrzydło główne (lekko uchylone do korytarza, z dużą szybą ornamentową jak na zdjęciu nr 2!)
      const mainW = w - sideW - 0.08;
      const mainPivot = new THREE.Group();
      mainPivot.position.set(-w * 0.5 + 0.04, 0, 0);
      const mainLeaf = new THREE.Mesh(new THREE.BoxGeometry(mainW, h - 0.06, 0.045), this.mats.oakStairs);
      mainLeaf.position.x = mainW * 0.5;
      const mainGlass = new THREE.Mesh(new THREE.BoxGeometry(mainW * 0.68, h * 0.60, 0.05), this.mats.glassOrnamental);
      mainGlass.position.set(mainW * 0.5, 0.12, 0);
      mainPivot.add(mainLeaf, mainGlass);
      mainPivot.rotation.y = 0.28; // lekko uchylone do korytarza (jak na zdjęciu nr 2!)
      joinery.add(mainPivot);
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

    // d) Boazeria na ścianie wschodniej korytarza parteru (X = +0.985 m, Z od -5.27 do -2.45 m – bez zasłaniania wnęki "L"!)
    const wainscotHallEast = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 2.08, 2.80),
      this.mats.wainscotingWood
    );
    wainscotHallEast.position.set(0.985, y0 + 1.04, -3.86);
    group.add(wainscotHallEast);

    // Boazeria po obu stronach centralnych drzwi wiatrołapu na ścianie północnej korytarza (Z = -5.20 m, jak na zdjęciu nr 2!)
    for (const [xW, wLen] of [[-0.84, 0.44], [0.80, 0.44]]) {
      const wainscotNorthPier = new THREE.Mesh(
        new THREE.BoxGeometry(wLen, 2.08, 0.02),
        this.mats.wainscotingWood
      );
      wainscotNorthPier.position.set(xW, y0 + 1.04, -5.20);
      group.add(wainscotNorthPier);
    }

    // Drewniana szafka pod telefon po prawej (zachodniej) stronie drzwi wiatrołapu (widoczna na zdjęciu nr 2!)
    const phoneStand = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.74, 0.36),
      this.mats.oakStairs
    );
    phoneStand.position.set(-0.80, y0 + 0.37, -4.98);
    group.add(phoneStand);

    // Żeberkowy grzejnik w korytarzu przy ścianie pokoju frontowego (widoczny w lewym górnym rogu zdjęcia z wnętrza!)
    const hallRadiator = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.62, 0.72),
      this.mats.wainscotingWood
    );
    hallRadiator.position.set(0.92, y0 + 0.42, -2.95);
    group.add(hallRadiator);

    // e) Skrzydła drzwiowe wokół wnęki "L" korytarza (zgodnie z rzutem 1966 r. i zdjęciem z wnętrza):
    // 1. Zamknięte skrzydło drzwi do piwnicy pod schodami (Z = -1.35 m, X = +0.52 m)
    const basementDoorLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 1.98, 0.04),
      this.mats.doorWood
    );
    basementDoorLeaf.position.set(0.52, y0 + 0.99, -1.35);
    group.add(basementDoorLeaf);

    // 2. Zamknięte skrzydło drzwi do WC (0,60 × 2,00 m na Z = -1.35 m, X = +1.45 m – u dołu zdjęcia z wnętrza!)
    const wcDoorLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 1.98, 0.04),
      this.mats.doorWood
    );
    wcDoorLeaf.position.set(1.45, y0 + 0.99, -1.35);
    group.add(wcDoorLeaf);

    // 3. Otwarte przeszklone skrzydło drzwi do Pokoju frontowego (12,52 m²) na Z = -2.45 m (X od +1.10 do +1.90 m)
    //    Uchylone do wnętrza pokoju, z szybą ornamentową (dokładnie jak u góry zdjęcia z wnętrza!)
    const studyDoorPivot = new THREE.Group();
    studyDoorPivot.position.set(1.12, y0 + 1.00, -2.48);
    const studyLeafFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 1.98, 0.04),
      this.mats.oakStairs
    );
    studyLeafFrame.position.x = 0.38;
    const studyLeafGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 1.32, 0.045),
      this.mats.glassOrnamental
    );
    studyLeafGlass.position.set(0.38, 0.14, 0);
    studyDoorPivot.add(studyLeafFrame, studyLeafGlass);
    studyDoorPivot.rotation.y = 1.25; // otwarte do wnętrza pokoju
    group.add(studyDoorPivot);

    // 4. Otwarte przeszklone skrzydło drzwi do Kuchni (5,96 m²) na X = +1.95 m (Z od -2.30 do -1.50 m)
    const kitchenDoorPivot = new THREE.Group();
    kitchenDoorPivot.position.set(1.98, y0 + 1.00, -2.28);
    const kitchenLeafFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 1.98, 0.76),
      this.mats.oakStairs
    );
    kitchenLeafFrame.position.z = 0.38;
    const kitchenLeafGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 1.32, 0.52),
      this.mats.glassOrnamental
    );
    kitchenLeafGlass.position.set(0, 0.14, 0.38);
    kitchenDoorPivot.add(kitchenLeafFrame, kitchenLeafGlass);
    kitchenDoorPivot.rotation.y = 1.15; // otwarte do kuchni
    group.add(kitchenDoorPivot);

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
    // 1. Wanna i umywalka w Łazience (5,06 m², widoczne przez otwarte drzwi na zdjęciu nr 4!)
    const bathTub = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.56, 0.72),
      this.mats.windowFrameWhite
    );
    bathTub.position.set(3.25, y0 + 0.28, -0.82);
    group.add(bathTub);

    // 2. Stolarka drzwiowa i boazeria wokół korytarza I piętra (3,76 m², zgodnie ze zdjęciami 3 i 4):
    // a) Zamknięte białe drzwi do WC I piętra (0,80 m²) z kwadratowym okienkiem z mrożonego szkła (Z = -1.35 m, X = +1.42 m)
    const wc1DoorLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 1.96, 0.04),
      this.mats.windowFrameWhite
    );
    wc1DoorLeaf.position.set(1.42, y0 + 0.98, -1.35);
    const wc1Glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.34, 0.05),
      this.mats.glassOrnamental
    );
    wc1Glass.position.set(1.42, y0 + 1.42, -1.35);
    group.add(wc1DoorLeaf, wc1Glass);

    // b) Uchylone białe przeszklone drzwi do Łazienki (5,06 m²) na X = +1.95 m (Z od -2.20 do -1.45 m, w centrum zdjęcia nr 4!)
    const bathDoorPivot = new THREE.Group();
    bathDoorPivot.position.set(1.94, y0 + 0.98, -2.18);
    const bathLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 1.96, 0.72),
      this.mats.windowFrameWhite
    );
    bathLeaf.position.z = 0.36;
    const bathGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.15, 0.42),
      this.mats.glassOrnamental
    );
    bathGlass.position.set(0, 0.16, 0.36);
    bathDoorPivot.add(bathLeaf, bathGlass);
    bathDoorPivot.rotation.y = -0.38; // lekko uchylone jak na zdjęciu nr 4
    group.add(bathDoorPivot);

    // c) Otwarte drzwi do Sypialni Wschodniej (16,58 m²) na Z = -2.95 m (X od +1.08 do +1.88 m, zgodnie z detalem korytarza!)
    const eastBedDoorPivot = new THREE.Group();
    eastBedDoorPivot.position.set(1.10, y0 + 0.98, -2.98);
    const eastBedLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 1.96, 0.04),
      this.mats.windowFrameWhite
    );
    eastBedLeaf.position.x = 0.38;
    eastBedDoorPivot.add(eastBedLeaf);
    eastBedDoorPivot.rotation.y = 1.25; // otwarte do sypialni wschodniej
    group.add(eastBedDoorPivot);

    // d) Białe drzwi z górnym przeszkleniem do Sypialni Głównej (25,58 m²) na X = -1.00 m (Z od -3.01 do -2.21 m,
    //    na końcu 73 cm przejścia przed schodami strychowymi – dokładnie jak na załączonym rzucie korytarza!)
    const masterDoorPivot = new THREE.Group();
    masterDoorPivot.position.set(-1.02, y0 + 0.98, -2.23);
    const masterLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 1.96, 0.76),
      this.mats.windowFrameWhite
    );
    masterLeaf.position.z = -0.38;
    const masterGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.55, 0.50),
      this.mats.glassOrnamental
    );
    masterGlass.position.set(0, 0.45, -0.38);
    masterDoorPivot.add(masterLeaf, masterGlass);
    masterDoorPivot.rotation.y = -0.85; // uchylone do wnętrza sypialni głównej
    group.add(masterDoorPivot);

    // e) Szafa wnękowa Sypialni Głównej (szer. 63 cm × dł. 282 cm, oznaczona przekątnymi na rzucie 1966 r.:
    //    X od -0.61 do -0.04 m przy ścianie działowej X = +0.02 m, Z od -5.68 do -3.12 m, z 50 cm przejścia obok!)
    const builtInWardrobe = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 2.45, 2.56),
      this.mats.oakStairs
    );
    builtInWardrobe.position.set(-0.33, y0 + 1.225, -4.40);
    builtInWardrobe.castShadow = true;
    builtInWardrobe.receiveShadow = true;
    group.add(builtInWardrobe);

    // f) Ciemna boazeria ścienna na pełnej ścianie północnej korytarza I piętra (Z = -2.96 m, X od -0.95 do +1.02 m)
    //    oraz wzdłuż 30 cm ścianki wschodniej (X = +1.88 m, Z od -2.95 do -2.35 m), dokładnie jak na zdjęciach 3 i 4!
    const f1WainscotCorridor = new THREE.Mesh(
      new THREE.BoxGeometry(1.96, 1.35, 0.02),
      this.mats.wainscotingWood
    );
    f1WainscotCorridor.position.set(0.03, y0 + 0.675, -2.96);
    const f1WainscotAlcove = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 1.15, 0.58),
      this.mats.wainscotingWood
    );
    f1WainscotAlcove.position.set(1.88, y0 + 0.575, -2.65);
    group.add(f1WainscotCorridor, f1WainscotAlcove);

    // 3. Biały żeliwny stolik i krzesła ogrodowe na Tarasie I piętra (wg zdjęcia CAM04971G0-PR0284-STILL021)
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
