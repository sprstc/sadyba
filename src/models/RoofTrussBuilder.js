/**
 * src/models/RoofTrussBuilder.js
 * Konstrukcyjny model więźby dachowej (stolcowo-kleszczowej), komina 7-przewodowego
 * oraz pokrycia dachu czterospadowego kopertowego z lukarnami pulpitowymi.
 */

import * as THREE from 'three';
import { ELEVATIONS, ROOF_SPEC } from '../data/houseSpec.js';

export class RoofTrussBuilder {
  constructor(materials) {
    this.materials = materials;
  }

  /**
   * Pomocnicza belka pomiędzy dwoma punktami 3D (np. krokiew, krawężnica, miecz)
   */
  createBeamBetween(p1, p2, width, height, material, name = 'Belka więźby') {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

    const geom = new THREE.BoxGeometry(width, height, len);
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.copy(mid);
    mesh.lookAt(p2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    return mesh;
  }

  /**
   * Buduje kompletną więźbę dachową + trzon kominowy oraz osobno połać dachową z lukarnami
   */
  build() {
    const roofTrussGroup = new THREE.Group();
    roofTrussGroup.name = 'Layer_RoofTruss';
    roofTrussGroup.userData.explodeLevel = 2.8;

    const roofCoverGroup = new THREE.Group();
    roofCoverGroup.name = 'Layer_RoofCover';
    roofCoverGroup.userData.explodeLevel = 3.5;

    const m = this.materials;
    const yEaves = ELEVATIONS.atticFloor; // +7.55 m
    const yRidge = ELEVATIONS.roofRidge;  // +10.25 m
    const hRoof = yRidge - yEaves;        // 2.70 m

    const xEaves = 5.75;   // 5.50 m lico + 0.25 m okap
    const zNorthEaves = -6.33; // -6.08 m lico - 0.25 m okap
    const zRidgeNorth = -2.60; // wierzchołek trójkątnej połaci północnej

    // Funkcja wysokości dachu w zależności od X (dla połaci Wsch./Zach.)
    const roofYAtX = (absX) => yRidge - hRoof * (absX / xEaves);

    // =========================================================================
    // 1. MURŁATY (16x16 cm) I PODWALINY STOLCÓW (12x14 cm)
    // =========================================================================
    // Murłata wschodnia (X = +5.31 m)
    const murlataE = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 5.95),
      m.get('pineTimber')
    );
    murlataE.position.set(5.31, yEaves + 0.08, -2.975);
    murlataE.castShadow = true;
    murlataE.name = 'Murłata wschodnia 16×16 cm';
    roofTrussGroup.add(murlataE);

    // Murłata zachodnia (X = -5.31 m)
    const murlataW = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 5.95),
      m.get('pineTimber')
    );
    murlataW.position.set(-5.31, yEaves + 0.08, -2.975);
    murlataW.castShadow = true;
    murlataW.name = 'Murłata zachodnia 16×16 cm';
    roofTrussGroup.add(murlataW);

    // Murłata północna (Z = -5.89 m)
    const murlataN = new THREE.Mesh(
      new THREE.BoxGeometry(10.78, 0.16, 0.16),
      m.get('pineTimber')
    );
    murlataN.position.set(0, yEaves + 0.08, -5.89);
    murlataN.castShadow = true;
    murlataN.name = 'Murłata północna 16×16 cm';
    roofTrussGroup.add(murlataN);

    // =========================================================================
    // 2. ŚCIANKA STOLCOWA DWURZĘDOWA (STOLCE 14x14, PŁATWIE 12x18, MIECZE 8x12)
    // =========================================================================
    const xPurlin = 2.45;
    const yPurlin = roofYAtX(xPurlin) - 0.12; // ~8.98 m
    const postHeight = yPurlin - yEaves;

    for (const side of [-1, 1]) {
      const xPos = side * xPurlin;

      // Podwalina pod stolce (14x12 cm)
      const solePlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.12, 4.40),
        m.get('pineTimber')
      );
      solePlate.position.set(xPos, yEaves + 0.06, -2.20);
      roofTrussGroup.add(solePlate);

      // Płatew pośrednia (12x18 cm)
      const purlin = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.18, 4.50),
        m.get('pineTimber')
      );
      purlin.position.set(xPos, yPurlin, -2.25);
      purlin.castShadow = true;
      purlin.name = 'Płatew pośrednia 12×18 cm';
      roofTrussGroup.add(purlin);

      // Słupy stolcowe (14x14 cm) i miecze (8x12 cm)
      const postZs = [-0.45, -1.75, -3.05, -4.15];
      for (const zPost of postZs) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, postHeight, 0.14),
          m.get('pineTimber')
        );
        post.position.set(xPos, yEaves + postHeight / 2, zPost);
        post.castShadow = true;
        post.name = 'Stolec 14×14 cm';
        roofTrussGroup.add(post);

        // Miecze usztywniające (45 stopni)
        if (zPost > -4.0) {
          const brace = this.createBeamBetween(
            new THREE.Vector3(xPos, yPurlin - 0.55, zPost),
            new THREE.Vector3(xPos, yPurlin, zPost - 0.55),
            0.08,
            0.10,
            m.get('pineTimber'),
            'Miecz ciesielski 8×10 cm'
          );
          roofTrussGroup.add(brace);
        }
      }
    }

    // Płatew poprzeczna północna (wspierająca połać szczytową przy Z = -4.15 m)
    const northPurlin = new THREE.Mesh(
      new THREE.BoxGeometry(xPurlin * 2 + 0.16, 0.18, 0.12),
      m.get('pineTimber')
    );
    northPurlin.position.set(0, yPurlin, -4.15);
    northPurlin.castShadow = true;
    northPurlin.name = 'Płatew poprzeczna północna 12×18 cm';
    roofTrussGroup.add(northPurlin);

    // =========================================================================
    // 3. WIĄZARY KROKWIOWO-KLESZCZOWE (KROKWIE 8x16 CM + KLESZCZE 2x5x14 CM)
    // =========================================================================
    const rafterZs = [-0.25, -1.10, -1.95, -2.60];
    for (const zR of rafterZs) {
      // Krokiew wschodnia
      const rafterE = this.createBeamBetween(
        new THREE.Vector3(xEaves - 0.08, yEaves, zR),
        new THREE.Vector3(0.0, yRidge - 0.06, zR),
        0.08,
        0.16,
        m.get('pineTimber'),
        'Krokiew główna 8×16 cm (Wsch.)'
      );
      roofTrussGroup.add(rafterE);

      // Krokiew zachodnia
      const rafterW = this.createBeamBetween(
        new THREE.Vector3(-(xEaves - 0.08), yEaves, zR),
        new THREE.Vector3(0.0, yRidge - 0.06, zR),
        0.08,
        0.16,
        m.get('pineTimber'),
        'Krokiew główna 8×16 cm (Zach.)'
      );
      roofTrussGroup.add(rafterW);

      // Podwójne kleszcze ciesielskie (2 x 5x14 cm) na poziomie płatwi
      for (const sideOffset of [-0.08, 0.08]) {
        const collar = new THREE.Mesh(
          new THREE.BoxGeometry(xPurlin * 2 + 0.55, 0.14, 0.05),
          m.get('pineTimber')
        );
        collar.position.set(0, yPurlin + 0.08, zR + sideOffset);
        collar.castShadow = true;
        collar.name = 'Kleszcze podwójne 2×(5×14 cm)';
        roofTrussGroup.add(collar);
      }
    }

    // Krawężnice narożne (10x16 cm) z naroży północnych do wierzchołka kalenicy (0, 10.25, -2.60)
    const apexNorth = new THREE.Vector3(0.0, yRidge - 0.06, zRidgeNorth);
    const hipNE = this.createBeamBetween(
      new THREE.Vector3(xEaves - 0.10, yEaves, zNorthEaves + 0.10),
      apexNorth,
      0.10,
      0.16,
      m.get('pineTimber'),
      'Krawężnica narożna NE 10×16 cm'
    );
    const hipNW = this.createBeamBetween(
      new THREE.Vector3(-(xEaves - 0.10), yEaves, zNorthEaves + 0.10),
      apexNorth,
      0.10,
      0.16,
      m.get('pineTimber'),
      'Krawężnica narożna NW 10×16 cm'
    );
    roofTrussGroup.add(hipNE, hipNW);

    // Kulawki na połaciach bocznych (Z < -2.60)
    for (const zJack of [-3.50, -4.40, -5.30]) {
      const t = (zJack - zRidgeNorth) / (zNorthEaves - zRidgeNorth); // 0 w kalenicy -> 1 w narożu
      const xHip = t * (xEaves - 0.10);
      const yHip = yRidge - 0.06 - t * (yRidge - 0.06 - yEaves);

      for (const s of [-1, 1]) {
        const jackSide = this.createBeamBetween(
          new THREE.Vector3(s * (xEaves - 0.08), yEaves, zJack),
          new THREE.Vector3(s * xHip, yHip, zJack),
          0.08,
          0.16,
          m.get('pineTimber'),
          'Kulawka boczna 8×16 cm'
        );
        roofTrussGroup.add(jackSide);
      }
    }

    // Kulawki na połaci północnej (szczytowej)
    for (const xJack of [-4.0, -2.6, -1.3, 0.0, 1.3, 2.6, 4.0]) {
      const t = Math.abs(xJack) / (xEaves - 0.10);
      const zHip = zRidgeNorth + t * (zNorthEaves - zRidgeNorth);
      const yHip = yRidge - 0.06 - t * (yRidge - 0.06 - yEaves);

      const jackNorth = this.createBeamBetween(
        new THREE.Vector3(xJack, yEaves, zNorthEaves + 0.08),
        new THREE.Vector3(xJack, yHip, zHip),
        0.08,
        0.16,
        m.get('pineTimber'),
        'Kulawka północna 8×16 cm'
      );
      roofTrussGroup.add(jackNorth);
    }

    // =========================================================================
    // 4. TRZON KOMINOWY GŁÓWNY (7 PRZEWODÓW WG PROTOKOŁU KOMINIARSKIEGO 1965 R.)
    // =========================================================================
    const chimneyGroup = this.buildMainChimney(yEaves);
    roofTrussGroup.add(chimneyGroup);

    // =========================================================================
    // 5. POKRYCIE DACHU KOPERTOWEGO (DACHÓWKA KARPIÓWKA + GĄSIORY + LUKARNY)
    // =========================================================================
    this.buildRoofCoverPlanes(roofCoverGroup, xEaves, zNorthEaves, zRidgeNorth, yEaves, yRidge);
    this.buildBoxDormers(roofCoverGroup, yEaves, yRidge, xEaves, zNorthEaves, zRidgeNorth);

    return {
      roofTrussGroup,
      roofCoverGroup,
    };
  }

  /**
   * Trzon kominowy główny w ścianie dylatacyjnej (Z = 0) z czapą betonową,
   * 7 wylotami kominowymi (wg protokołu M.B.K. Rejon miejski z 29.XII.1965 r.) i anteną TV
   */
  buildMainChimney(yEaves) {
    const group = new THREE.Group();
    group.name = 'Trzon kominowy 7-przewodowy';
    const m = this.materials;

    const yTop = ELEVATIONS.chimneyTop; // +11.20 m
    const hStack = yTop - yEaves;
    const xCenter = -0.35;
    const zCenter = -0.26;
    const widthX = 1.65;
    const depthZ = 0.52;

    // Korpus komina (tynkowany ponad dachem, ceglany na strychu)
    const stackBody = new THREE.Mesh(
      new THREE.BoxGeometry(widthX, hStack, depthZ),
      m.get('facadePlaster')
    );
    stackBody.position.set(xCenter, yEaves + hStack / 2, zCenter);
    stackBody.castShadow = true;
    stackBody.receiveShadow = true;
    group.add(stackBody);

    // Obróbka blacharska wokół komina
    const flashing = new THREE.Mesh(
      new THREE.BoxGeometry(widthX + 0.14, 0.22, depthZ + 0.14),
      m.get('zincSheet')
    );
    flashing.position.set(xCenter, ELEVATIONS.roofRidge - 0.15, zCenter);
    group.add(flashing);

    // Czapa betonowa komina (+11.20 m)
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(widthX + 0.16, 0.10, depthZ + 0.16),
      m.get('concrete')
    );
    cap.position.set(xCenter, yTop + 0.05, zCenter);
    cap.castShadow = true;
    group.add(cap);

    // 7 przewodów kominowych (dymowe i wentylacyjne)
    for (let i = 0; i < 7; i++) {
      const fx = xCenter - 0.66 + i * 0.22;
      const flue = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.065, 0.22, 12),
        m.get('brickWall')
      );
      flue.position.set(fx, yTop + 0.18, zCenter);
      group.add(flue);
    }

    // Maszt antenowy RTV (widoczny na zdjęciach archiwalnych z ulicy frontowej)
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1.85, 8),
      m.get('steelGalvanized')
    );
    mast.position.set(xCenter - 0.55, yTop + 0.92, zCenter);
    group.add(mast);

    for (let d = 0; d < 4; d++) {
      const dipole = new THREE.Mesh(
        new THREE.BoxGeometry(0.65 - d * 0.10, 0.015, 0.015),
        m.get('steelGalvanized')
      );
      dipole.position.set(xCenter - 0.55, yTop + 1.35 + d * 0.14, zCenter - 0.15 + d * 0.12);
      group.add(dipole);
    }

    // Drugi mniejszy komin wentylacyjny przy pionie kuchenno-łazienkowym (X = +2.35, Z = -2.40)
    const ventStack = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 2.25, 0.42),
      m.get('facadePlaster')
    );
    ventStack.position.set(2.35, yEaves + 1.125, -2.40);
    ventStack.castShadow = true;
    group.add(ventStack);

    const ventCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.08, 0.52),
      m.get('concrete')
    );
    ventCap.position.set(2.35, yEaves + 2.29, -2.40);
    group.add(ventCap);

    return group;
  }

  /**
   * Tworzy 3 połacie dachu czterospadowego kopertowego dla Segmentu B (Wschodnia, Zachodnia, Północna)
   * wraz z gąsiorami kalenicowymi i narożnymi.
   */
  buildRoofCoverPlanes(group, xEaves, zNorthEaves, zRidgeNorth, yEaves, yRidge) {
    const m = this.materials;
    const thickness = 0.09;

    // Pomocniczy kreator czworokątnej/trójkątnej płyty dachowej o zadanej grubości
    const createThickSlope = (pts, uvScaleX, uvScaleY, name) => {
      // pts: [p0, p1, p2, p3] (lub 3 punkty dla trójkąta) w kolejności CCW od zewnątrz
      const v0 = pts[0];
      const v1 = pts[1];
      const v2 = pts[2];
      const e1 = new THREE.Vector3().subVectors(v1, v0);
      const e2 = new THREE.Vector3().subVectors(v2, v0);
      const normal = new THREE.Vector3().crossVectors(e1, e2).normalize();
      if (normal.y < 0) normal.negate();

      const offset = normal.clone().multiplyScalar(thickness);
      const topPts = pts.map((p) => p.clone().add(offset));

      const positions = [];
      const uvs = [];
      const indices = [];

      const pushQuad = (a, b, c, d, uMax, vMax) => {
        const base = positions.length / 3;
        positions.push(
          a.x, a.y, a.z,
          b.x, b.y, b.z,
          c.x, c.y, c.z,
          d.x, d.y, d.z
        );
        uvs.push(
          0, 0,
          uMax, 0,
          uMax, vMax,
          0, vMax
        );
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      };

      if (pts.length === 4) {
        // Górna i dolna powierzchnia
        pushQuad(topPts[0], topPts[1], topPts[2], topPts[3], uvScaleX, uvScaleY);
        pushQuad(pts[3], pts[2], pts[1], pts[0], uvScaleX, uvScaleY);
        // Krawędzie boczne
        for (let i = 0; i < 4; i++) {
          const ni = (i + 1) % 4;
          pushQuad(pts[i], pts[ni], topPts[ni], topPts[i], 1, 0.2);
        }
      } else if (pts.length === 3) {
        const base = positions.length / 3;
        positions.push(
          topPts[0].x, topPts[0].y, topPts[0].z,
          topPts[1].x, topPts[1].y, topPts[1].z,
          topPts[2].x, topPts[2].y, topPts[2].z,
          pts[2].x, pts[2].y, pts[2].z,
          pts[1].x, pts[1].y, pts[1].z,
          pts[0].x, pts[0].y, pts[0].z
        );
        uvs.push(
          0, 0,
          uvScaleX, 0,
          uvScaleX * 0.5, uvScaleY,
          uvScaleX * 0.5, uvScaleY,
          uvScaleX, 0,
          0, 0
        );
        indices.push(base, base + 1, base + 2, base + 3, base + 4, base + 5);
        for (let i = 0; i < 3; i++) {
          const ni = (i + 1) % 3;
          pushQuad(pts[i], pts[ni], topPts[ni], topPts[i], 1, 0.2);
        }
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.setIndex(indices);
      geom.computeVertexNormals();

      const mesh = new THREE.Mesh(geom, m.get('roofTile'));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = name;
      return mesh;
    };

    // 1. Połać wschodnia (frontowa)
    const eastSlope = createThickSlope(
      [
        new THREE.Vector3(xEaves, yEaves, 0.0),
        new THREE.Vector3(xEaves, yEaves, zNorthEaves),
        new THREE.Vector3(0.0, yRidge, zRidgeNorth),
        new THREE.Vector3(0.0, yRidge, 0.0),
      ],
      1.2,
      1.3,
      'Połać dachowa wschodnia (karpiówka)'
    );
    group.add(eastSlope);

    // 2. Połać zachodnia (ogrodowa)
    const westSlope = createThickSlope(
      [
        new THREE.Vector3(-xEaves, yEaves, zNorthEaves),
        new THREE.Vector3(-xEaves, yEaves, 0.0),
        new THREE.Vector3(0.0, yRidge, 0.0),
        new THREE.Vector3(0.0, yRidge, zRidgeNorth),
      ],
      1.2,
      1.3,
      'Połać dachowa zachodnia (karpiówka)'
    );
    group.add(westSlope);

    // 3. Połać północna (szczytowa kopertowa)
    const northSlope = createThickSlope(
      [
        new THREE.Vector3(xEaves, yEaves, zNorthEaves),
        new THREE.Vector3(-xEaves, yEaves, zNorthEaves),
        new THREE.Vector3(0.0, yRidge, zRidgeNorth),
      ],
      2.2,
      1.1,
      'Połać dachowa północna (kopertowa)'
    );
    group.add(northSlope);

    // Gąsiory kalenicy głównej i naroży
    const ridgeCapMain = this.createBeamBetween(
      new THREE.Vector3(0, yRidge + 0.09, 0.0),
      new THREE.Vector3(0, yRidge + 0.09, zRidgeNorth),
      0.18,
      0.12,
      m.get('roofRidgeTile'),
      'Gąsiory kalenicy głównej'
    );
    const hipCapNE = this.createBeamBetween(
      new THREE.Vector3(xEaves, yEaves + 0.09, zNorthEaves),
      new THREE.Vector3(0, yRidge + 0.09, zRidgeNorth),
      0.16,
      0.11,
      m.get('roofRidgeTile'),
      'Gąsiory narożne NE'
    );
    const hipCapNW = this.createBeamBetween(
      new THREE.Vector3(-xEaves, yEaves + 0.09, zNorthEaves),
      new THREE.Vector3(0, yRidge + 0.09, zRidgeNorth),
      0.16,
      0.11,
      m.get('roofRidgeTile'),
      'Gąsiory narożne NW'
    );
    group.add(ridgeCapMain, hipCapNE, hipCapNW);
  }

  /**
   * Lukarny pulpitowe (skrzynkowe) obite blachą cynkową z oknami doświetlającymi strych:
   * 1. Wschodnia (frontowa), 2. Zachodnia (ogrodowa), 3. Północna (szczytowa)
   */
  buildBoxDormers(group, yEaves, yRidge, xEaves, zNorthEaves, zRidgeNorth) {
    const m = this.materials;

    const createDormer = (width, height, depth) => {
      const dGroup = new THREE.Group();

      // Obudowa skrzynkowa z blachy cynkowej
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(depth, height, width),
        m.get('zincSheet')
      );
      box.position.set(0, height / 2, 0);
      box.castShadow = true;
      dGroup.add(box);

      // Daszek pulpitowy z okapem
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(depth + 0.22, 0.08, width + 0.22),
        m.get('zincSheet')
      );
      roof.position.set(0.05, height + 0.06, 0);
      roof.rotation.z = -0.14;
      roof.castShadow = true;
      dGroup.add(roof);

      // Rama okienna biała + szyba
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, height - 0.22, width - 0.24),
        m.get('windowFrame')
      );
      frame.position.set(depth / 2 + 0.01, height / 2, 0);
      dGroup.add(frame);

      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, height - 0.34, width - 0.36),
        m.get('windowGlass')
      );
      glass.position.set(depth / 2 + 0.01, height / 2, 0);
      dGroup.add(glass);

      // Szpros pionowy
      const mullion = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, height - 0.26, 0.04),
        m.get('windowFrame')
      );
      mullion.position.set(depth / 2 + 0.01, height / 2, 0);
      dGroup.add(mullion);

      return dGroup;
    };

    // 1. Lukarna wschodnia (frontowa) przy Z = -2.10 m
    const dormerE = createDormer(1.35, 1.05, 1.55);
    dormerE.position.set(2.55, yEaves + 0.85, -2.10);
    dormerE.name = 'Lukarna pulpitowa wschodnia';
    group.add(dormerE);

    // 2. Lukarna zachodnia (ogrodowa) przy Z = -2.10 m
    const dormerW = createDormer(1.35, 1.05, 1.55);
    dormerW.rotation.y = Math.PI;
    dormerW.position.set(-2.55, yEaves + 0.85, -2.10);
    dormerW.name = 'Lukarna pulpitowa zachodnia';
    group.add(dormerW);

    // 3. Lukarna północna (szczytowa) przy X = 0.00 m
    const dormerN = createDormer(1.25, 0.98, 1.45);
    dormerN.rotation.y = Math.PI / 2;
    dormerN.position.set(0.0, yEaves + 0.82, -4.25);
    dormerN.name = 'Lukarna pulpitowa północna';
    group.add(dormerN);
  }
}
