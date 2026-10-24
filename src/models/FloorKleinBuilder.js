/**
 * ============================================================================
 * src/models/FloorKleinBuilder.js
 * Inżynieryjny generator stropów stalowo-ceramicznych typu Kleina:
 * - Dwuteowniki walcowane I NP 24 / I NP 22 / I NP 18 / I NP 14 (z półką górną, dolną i środnikiem),
 * - Wymian stalowy klatki schodowej (trimmer I NP 14) oparty na belkach głównych I NP 24,
 * - Zbrojone płyty ceramiczne Kleina (cegła kl. III + pręty Ø 6 mm / bednarka),
 * - Warstwa zagruzowania (polepa ceglano-wapienna) z wycięciem otworu klatki schodowej.
 * ============================================================================
 */

import * as THREE from 'three';
import { ELEVATIONS, BUILDING_DIMS, KLEIN_SLAB_SPEC } from '../data/houseSpec.js';

export class FloorKleinBuilder {
  constructor(materialsManager) {
    this.mats = materialsManager.materials;
  }

  /**
   * Buduje wszystkie 3 kondygnacje stropów Kleina z podziałem na grupy do Exploded View.
   * @param {Object} options - { includeVeranda1966: boolean }
   */
  build(options = { includeVeranda1966: true }) {
    const kleinGroup = new THREE.Group();
    kleinGroup.name = 'Layer_Klein_Slabs';

    // Podgrupy przypisane do poziomów dla płynnego unoszenia w Exploded View:
    const level0Slab = this._buildSingleKleinSlabLevel({
      levelName: 'Klein_Over_Basement',
      yBottom: ELEVATIONS.BASEMENT_CEILING, // +1.30 m
      yTop: ELEVATIONS.GROUND_FLOOR,        // +1.60 m
      includeVeranda: options.includeVeranda1966,
      hasStairOpening: true,
    });
    level0Slab.userData.explodeLevel = 0.35;

    const level1Slab = this._buildSingleKleinSlabLevel({
      levelName: 'Klein_Over_GroundFloor',
      yBottom: ELEVATIONS.GROUND_CEILING,   // +4.40 m
      yTop: ELEVATIONS.FIRST_FLOOR,         // +4.70 m
      includeVeranda: options.includeVeranda1966, // Płyta tarasu nad werandą
      hasStairOpening: true,
    });
    level1Slab.userData.explodeLevel = 1.15;

    const level2Slab = this._buildSingleKleinSlabLevel({
      levelName: 'Klein_Over_FirstFloor',
      yBottom: ELEVATIONS.FIRST_CEILING,    // +7.28 m
      yTop: ELEVATIONS.ATTIC_FLOOR,         // +7.55 m
      includeVeranda: false,                // Nad tarasem I piętra nie ma stropu
      hasStairOpening: true,
    });
    level2Slab.userData.explodeLevel = 2.15;

    kleinGroup.add(level0Slab, level1Slab, level2Slab);

    return {
      kleinGroup,
      levels: { level0Slab, level1Slab, level2Slab },
    };
  }

  /**
   * Buduje pojedynczy poziom stropu Kleina wraz z belkami I NP, wymianem i płytami ceglanymi.
   */
  _buildSingleKleinSlabLevel(cfg) {
    const { levelName, yBottom, yTop, includeVeranda, hasStairOpening } = cfg;
    const group = new THREE.Group();
    group.name = levelName;

    const zSouthWallInner = -0.25;
    const zNorthWallInner = -5.85;
    const zStairTrimmer = KLEIN_SLAB_SPEC.stairTrimmer.zAxis; // -2.35 m

    // 1. Belki stalowe poprzeczne (rozpięte wzdłuż osi Z, rozmieszczone wzdłuż osi X)
    for (const bay of KLEIN_SLAB_SPEC.baysX) {
      if (bay.span === 'veranda' && !includeVeranda) continue;

      const profile = KLEIN_SLAB_SPEC.beamProfiles[bay.profile] || KLEIN_SLAB_SPEC.beamProfiles.INP24;
      let zStart = zNorthWallInner;
      let zEnd = zSouthWallInner;

      // Belki skrócone przy otworze klatki schodowej opierają się na wymianie stalowym (Z = -2.35 m)
      if (hasStairOpening && bay.span === 'trimmed') {
        zEnd = zStairTrimmer;
      }

      const beamMesh = this._createIBeamAlongZ(
        bay.x,
        yBottom,
        zStart,
        zEnd,
        profile,
        this.mats.steelBeamINP
      );
      group.add(beamMesh);
    }

    // 2. Wymian stalowy klatki schodowej (I NP 14 biegnący wzdłuż osi X od X = -1.10 do X = +2.05 m)
    if (hasStairOpening) {
      const trimmerSpec = KLEIN_SLAB_SPEC.stairTrimmer;
      const trimmerProfile = KLEIN_SLAB_SPEC.beamProfiles[trimmerSpec.profile];
      const trimmerMesh = this._createIBeamAlongX(
        trimmerSpec.xStart,
        trimmerSpec.xEnd,
        yBottom + 0.02,
        trimmerSpec.zAxis,
        trimmerProfile,
        this.mats.steelTrimmer
      );
      group.add(trimmerMesh);
    }

    // 3. Płyty ceramiczne Kleina (z cegły na płask zbrojone bednarką Ø 6 mm) między belkami
    // Modelujemy je jako pasma spoczywające na dolnych półkach dwuteowników (wys. 12 cm)
    // z wycięciem otworu na klatkę schodową (X: -1.05 do +2.00 m, Z: -2.35 do -0.38 m)
    const plateH = 0.11;
    const yPlate = yBottom + 0.015 + plateH * 0.5;

    const addCeramicBay = (x1, x2, z1, z2) => {
      const sx = Math.abs(x2 - x1) - 0.06;
      const sz = Math.abs(z2 - z1);
      if (sx <= 0.05 || sz <= 0.05) return;

      // Płyta ceglana Kleina
      const plateGeo = new THREE.BoxGeometry(sx, plateH, sz);
      const plateMesh = new THREE.Mesh(plateGeo, this.mats.kleinBrickPlate);
      plateMesh.position.set((x1 + x2) * 0.5, yPlate, (z1 + z2) * 0.5);
      plateMesh.castShadow = true;
      plateMesh.receiveShadow = true;
      group.add(plateMesh);

      // Warstwa zagruzowania / polepy ceglano-wapiennej (9 cm) ponad płytą ceglaną
      const fillH = Math.max(0.04, (yTop - yBottom) - plateH - 0.06);
      const fillGeo = new THREE.BoxGeometry(sx, fillH, sz);
      const fillMesh = new THREE.Mesh(fillGeo, this.mats.kleinSlagFill);
      fillMesh.position.set((x1 + x2) * 0.5, yBottom + 0.015 + plateH + fillH * 0.5, (z1 + z2) * 0.5);
      group.add(fillMesh);
    };

    // Pasma w traktach pełnych:
    // Trakt wschodni (od ściany frontowej X = +5.12 do klatki X = +2.05)
    addCeramicBay(2.05, 3.15, zNorthWallInner, zSouthWallInner);
    addCeramicBay(3.15, 4.30, zNorthWallInner, zSouthWallInner);
    addCeramicBay(4.30, 5.15, zNorthWallInner, zSouthWallInner);

    // Pasmo środkowe obok klatki schodowej (część północna Z od -5.85 do -2.85 m, z otworem klatki po południu)
    addCeramicBay(-1.10, -0.10, zNorthWallInner, zStairTrimmer);
    addCeramicBay(-0.10, 0.90, zNorthWallInner, zStairTrimmer);
    addCeramicBay(0.90, 2.05, zNorthWallInner, zStairTrimmer);
    // Podest wyjściowy na półpiętrze po wschodniej stronie słupa centralnego (X od +0.02 do +1.05, Z od -2.85 do -2.01)
    addCeramicBay(0.02, 1.05, zStairTrimmer, -2.01);
    // Podest WC przy klatce (X od +1.05 do +2.05, Z od -2.85 do -0.25)
    addCeramicBay(1.05, 2.05, zStairTrimmer, zSouthWallInner);

    // Trakt zachodni (Salon: X od -5.18 do -1.10 m)
    addCeramicBay(-2.35, -1.10, zNorthWallInner, zSouthWallInner);
    addCeramicBay(-3.60, -2.35, zNorthWallInner, zSouthWallInner);
    addCeramicBay(-4.85, -3.60, zNorthWallInner, zSouthWallInner);
    addCeramicBay(-5.25, -4.85, zNorthWallInner, zSouthWallInner);

    // Trakt werandy / tarasu (X od -7.98 do -5.45 m)
    if (includeVeranda) {
      addCeramicBay(-6.35, -5.45, zNorthWallInner, zSouthWallInner);
      addCeramicBay(-7.55, -6.35, zNorthWallInner, zSouthWallInner);
      addCeramicBay(-7.98, -7.55, zNorthWallInner, zSouthWallInner);
    }

    return group;
  }

  /**
   * Tworzy realistyczny dwuteownik stalowy I NP (półka dolna, górna i środnik) wzdłuż osi Z.
   */
  _createIBeamAlongZ(xPos, yBottom, zStart, zEnd, profile, material) {
    const beamGroup = new THREE.Group();
    const length = Math.abs(zEnd - zStart);
    const zMid = (zStart + zEnd) * 0.5;
    const { height, flangeWidth, webThickness, flangeThickness } = profile;

    // Półka dolna
    const botFlange = new THREE.Mesh(
      new THREE.BoxGeometry(flangeWidth, flangeThickness, length),
      material
    );
    botFlange.position.set(xPos, yBottom + flangeThickness * 0.5, zMid);

    // Środnik pionowy
    const webH = height - 2 * flangeThickness;
    const web = new THREE.Mesh(
      new THREE.BoxGeometry(webThickness, webH, length),
      material
    );
    web.position.set(xPos, yBottom + height * 0.5, zMid);

    // Półka górna
    const topFlange = new THREE.Mesh(
      new THREE.BoxGeometry(flangeWidth, flangeThickness, length),
      material
    );
    topFlange.position.set(xPos, yBottom + height - flangeThickness * 0.5, zMid);

    beamGroup.add(botFlange, web, topFlange);
    return beamGroup;
  }

  /**
   * Tworzy realistyczny dwuteownik stalowy I NP (wymian) wzdłuż osi X.
   */
  _createIBeamAlongX(xStart, xEnd, yBottom, zPos, profile, material) {
    const beamGroup = new THREE.Group();
    const length = Math.abs(xEnd - xStart);
    const xMid = (xStart + xEnd) * 0.5;
    const { height, flangeWidth, webThickness, flangeThickness } = profile;

    const botFlange = new THREE.Mesh(
      new THREE.BoxGeometry(length, flangeThickness, flangeWidth),
      material
    );
    botFlange.position.set(xMid, yBottom + flangeThickness * 0.5, zPos);

    const webH = height - 2 * flangeThickness;
    const web = new THREE.Mesh(
      new THREE.BoxGeometry(length, webH, webThickness),
      material
    );
    web.position.set(xMid, yBottom + height * 0.5, zPos);

    const topFlange = new THREE.Mesh(
      new THREE.BoxGeometry(length, flangeThickness, flangeWidth),
      material
    );
    topFlange.position.set(xMid, yBottom + height - flangeThickness * 0.5, zPos);

    beamGroup.add(botFlange, web, topFlange);
    return beamGroup;
  }
}
