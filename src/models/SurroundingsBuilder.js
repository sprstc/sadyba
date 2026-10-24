/**
 * src/models/SurroundingsBuilder.js
 * Otoczenie działki przy działki budowlanej (10.52 × 30.13 m), zjazd do garażu (5.00 m),
 * ogrodzenie frontowe, ulica frontowa z latarnią "grzybkiem", zieleń ogrodowa,
 * słup energetyczny ŻN (do demontażu) oraz architektoniczne linie wymiarowe 3D.
 */

import * as THREE from 'three';
import { ELEVATIONS, PLOT_SPEC, BUILDING_DIMS } from '../data/houseSpec.js';

export class SurroundingsBuilder {
  constructor(materials) {
    this.materials = materials;
    this.labelAnchors = [];
  }

  build() {
    const surroundingsGroup = new THREE.Group();
    surroundingsGroup.name = 'Layer_Surroundings';

    const utilityPoleGroup = new THREE.Group();
    utilityPoleGroup.name = 'Layer_UtilityPole';

    const dimensionsGroup = new THREE.Group();
    dimensionsGroup.name = 'Layer_Dimensions';

    // Budujemy otoczenie Segmentu B (północnego) oraz grupę bliźniaczą Segmentu A (południowego)
    const segBSurroundings = this.buildPlotHalf(false);
    surroundingsGroup.add(segBSurroundings);

    const segASurroundings = this.buildPlotHalf(true);
    segASurroundings.name = 'Surroundings_TwinSegmentA';
    surroundingsGroup.add(segASurroundings);

    // Ulica frontowa (wspólna wzdłuż frontu wschodniego X = +10.50 .. +19.50 m)
    const streetGroup = this.buildFrontowaStreet();
    surroundingsGroup.add(streetGroup);

    // Słup energetyczny ŻN do demontażu (ze zdjęć w folderze ./słup do demontażu/)
    this.buildUtilityPole(utilityPoleGroup);

    // Linie wymiarowe 3D i koty wysokościowe
    this.buildArchitecturalDimensions(dimensionsGroup);

    return {
      surroundingsGroup,
      segASurroundings,
      utilityPoleGroup,
      dimensionsGroup,
      labelAnchors: this.labelAnchors,
    };
  }

  /**
   * Buduje działkę jednego segmentu (false = Segment B północny Z in [-10.52, 0],
   * true = Segment A południowy odbity lustrzanie Z in [0, +10.52]).
   */
  buildPlotHalf(isSouthTwin = false) {
    const group = new THREE.Group();
    const m = this.materials;
    const signZ = isSouthTwin ? -1 : 1;

    // 1. Trawnik ogrodowy z wycięciem pod budynek i zjazd garażowy
    // Część zachodnia (ogród tylny: X od -19.63 do -5.50, Z od 0 do -10.52)
    const backLawn = new THREE.Mesh(
      new THREE.BoxGeometry(14.13, 0.16, 10.52),
      m.get('grass')
    );
    backLawn.position.set(-12.565, -0.08, signZ * -5.26);
    backLawn.receiveShadow = true;
    group.add(backLawn);

    // Pas boczny północny (X od -5.50 do +10.50, Z od -6.08 do -10.52 -> szer. 4.44 m)
    const sideLawn = new THREE.Mesh(
      new THREE.BoxGeometry(16.00, 0.16, 4.44),
      m.get('grass')
    );
    sideLawn.position.set(2.50, -0.08, signZ * -8.30);
    sideLawn.receiveShadow = true;
    group.add(sideLawn);

    // Przedogródek północny (obok zjazdu garażowego: X od +5.50 do +10.50, Z od -3.25 do -6.08)
    const frontLawn = new THREE.Mesh(
      new THREE.BoxGeometry(5.00, 0.16, 2.83),
      m.get('grass')
    );
    frontLawn.position.set(8.00, -0.08, signZ * -4.665);
    frontLawn.receiveShadow = true;
    group.add(frontLawn);

    // Wąski pas przy osi dylatacji (X od +5.50 do +10.50, Z od 0 do -0.35)
    const centerStrip = new THREE.Mesh(
      new THREE.BoxGeometry(5.00, 0.16, 0.35),
      m.get('grass')
    );
    centerStrip.position.set(8.00, -0.08, signZ * -0.175);
    centerStrip.receiveShadow = true;
    group.add(centerStrip);

    // 2. ZJAZD DO GARAŻU (X od +10.50 na Y=0.00 w dół do X=+5.50 na Y=-0.92, Z in [-3.25, -0.35])
    const rampLength = Math.hypot(5.00, 0.92);
    const rampAngle = Math.atan2(0.92, 5.00); // nachylenie ok. 10.4°
    const rampMesh = new THREE.Mesh(
      new THREE.BoxGeometry(rampLength, 0.14, 2.90),
      m.get('asphalt')
    );
    rampMesh.position.set(8.00, -0.46 - 0.05, signZ * -1.80);
    rampMesh.rotation.z = rampAngle;
    rampMesh.receiveShadow = true;
    rampMesh.name = 'Zjazd do garażu (5.00 m)';
    group.add(rampMesh);

    // Mury oporowe boczne zjazdu do garażu
    for (const zWall of [-0.35, -3.25]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(5.00, 1.15, 0.22),
        m.get('concrete')
      );
      wall.position.set(8.00, -0.42, signZ * zWall);
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);

      // Czapka muru oporowego
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(5.04, 0.06, 0.28),
        m.get('plinthPlaster')
      );
      cap.position.set(8.00, 0.18, signZ * zWall);
      group.add(cap);
    }

    // Kratka ściekowa liniowa przed bramą garażową (X = +5.68, Y = -0.91)
    const drain = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.03, 2.60),
      m.get('steelBeam')
    );
    drain.position.set(5.68, -0.91, signZ * -1.80);
    group.add(drain);

    // 3. Chodnik wejściowy od furtki (X = +10.50, Z = -7.35) do schodów ganku północnego
    const pathFront = new THREE.Mesh(
      new THREE.BoxGeometry(8.80, 0.04, 1.25),
      m.get('terrazzo')
    );
    pathFront.position.set(6.10, 0.02, signZ * -7.35);
    pathFront.receiveShadow = true;
    group.add(pathFront);

    // 4. Historyczne 3 kręgi szamba ("SZAMBO OOO" z planu sytuacyjnego 1966 r.) w przedogródku
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.08, 18),
        m.get('concrete')
      );
      ring.position.set(7.20 + i * 0.95, 0.03, signZ * -4.75);
      ring.receiveShadow = true;
      ring.name = 'Krąg betonowy (SZAMBO 1966)';
      group.add(ring);
    }

    // 5. Ogrodzenie frontowe wzdłuż ulicy frontowej (X = +10.50 m) oraz ogrodzenia boczne
    this.buildFences(group, signZ);

    // 6. Drzewa i krzewy w ogrodzie (Osiedle ogrodowe słynie ze starego drzewostanu)
    this.buildGardenVegetation(group, signZ);

    return group;
  }

  /**
   * Ogrodzenie frontowe (cokół betonowy + przęsła z siatki stalowej, brama wjazdowa i furtka)
   */
  buildFences(group, signZ) {
    const m = this.materials;
    const xFence = 10.50;

    // Cokół pod przęsłami (poza bramą wjazdową i furtką)
    const plinthSegments = [
      { z1: -3.35, z2: -6.70 },
      { z1: -8.00, z2: -10.52 },
    ];

    for (const seg of plinthSegments) {
      const len = Math.abs(seg.z2 - seg.z1);
      const midZ = (seg.z1 + seg.z2) / 2;

      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.35, len),
        m.get('concrete')
      );
      plinth.position.set(xFence, 0.175, signZ * midZ);
      plinth.castShadow = true;
      group.add(plinth);

      // Przęsło ogrodzeniowe
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 1.15, len - 0.12),
        m.get('steelRailing')
      );
      panel.position.set(xFence, 0.92, signZ * midZ);
      group.add(panel);
    }

    // Słupki ogrodzeniowe
    const postZs = [-0.35, -3.35, -5.00, -6.70, -8.00, -10.50];
    for (const zp of postZs) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.60, 10),
        m.get('steelRailing')
      );
      post.position.set(xFence, 0.80, signZ * zp);
      post.castShadow = true;
      group.add(post);
    }

    // Dwuskrzydłowa brama wjazdowa nad zjazdem (Z od -0.35 do -3.35)
    for (const gateZ of [-1.10, -2.60]) {
      const gateFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 1.35, 1.42),
        m.get('steelRailing')
      );
      gateFrame.position.set(xFence, 0.72, signZ * gateZ);
      group.add(gateFrame);
    }

    // Furtka wejściowa (Z od -6.70 do -8.00)
    const wicket = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.40, 1.22),
      m.get('steelRailing')
    );
    wicket.position.set(xFence, 0.75, signZ * -7.35);
    group.add(wicket);

    // Ogrodzenie boczne i tylne ogrodu
    const northFence = new THREE.Mesh(
      new THREE.BoxGeometry(30.13, 1.50, 0.05),
      m.get('steelRailing')
    );
    northFence.position.set(-4.565, 0.75, signZ * -10.52);
    group.add(northFence);

    const westFence = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.50, 10.52),
      m.get('steelRailing')
    );
    westFence.position.set(-19.63, 0.75, signZ * -5.26);
    group.add(westFence);
  }

  /**
   * Drzewa liściaste, krzewy i tuje w ogrodzie
   */
  buildGardenVegetation(group, signZ) {
    const m = this.materials;

    const createTree = (x, z, height = 6.5, crownRadius = 2.4) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.24, height * 0.48, 10),
        m.get('oakWood')
      );
      trunk.position.y = (height * 0.48) / 2;
      trunk.castShadow = true;
      tree.add(trunk);

      const crown1 = new THREE.Mesh(
        new THREE.DodecahedronGeometry(crownRadius, 1),
        m.get('foliage')
      );
      crown1.position.y = height * 0.65;
      crown1.castShadow = true;
      crown1.receiveShadow = true;
      tree.add(crown1);

      const crown2 = new THREE.Mesh(
        new THREE.DodecahedronGeometry(crownRadius * 0.75, 1),
        m.get('foliage')
      );
      crown2.position.set(crownRadius * 0.45, height * 0.55, crownRadius * 0.3);
      crown2.castShadow = true;
      tree.add(crown2);

      tree.position.set(x, 0, signZ * z);
      return tree;
    };

    // Drzewa w ogrodzie zachodnim i przy ulicy
    group.add(createTree(-14.2, -3.5, 7.2, 2.5));
    group.add(createTree(-16.8, -7.8, 6.0, 2.1));
    group.add(createTree(8.4, -9.1, 5.8, 1.9));

    // Szpaler tui przy północnej granicy działki
    for (let xT = -17.0; xT <= -6.0; xT += 1.6) {
      const thuja = new THREE.Mesh(
        new THREE.ConeGeometry(0.48, 2.6, 8),
        m.get('foliage')
      );
      thuja.position.set(xT, 1.3, signZ * -9.85);
      thuja.castShadow = true;
      group.add(thuja);
    }
  }

  /**
   * Ulica frontowa: chodnik z płyt betonowych, krawężnik, jezdnia asfaltowa i latarnia "grzybek"
   */
  buildFrontowaStreet() {
    const group = new THREE.Group();
    group.name = 'Ulica frontowa';
    const m = this.materials;

    // Chodnik zachodni przy ogrodzeniu (X od +10.50 do +12.50)
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(2.00, 0.14, 26.0),
      m.get('concrete')
    );
    sidewalk.position.set(11.50, -0.05, 0);
    sidewalk.receiveShadow = true;
    group.add(sidewalk);

    // Krawężnik granitowy (X = +12.55)
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.20, 26.0),
      m.get('terrazzo')
    );
    curb.position.set(12.55, -0.04, 0);
    group.add(curb);

    // Jezdnia asfaltowa ulicy frontowej (X od +12.60 do +18.60)
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(6.00, 0.14, 26.0),
      m.get('asphalt')
    );
    road.position.set(15.60, -0.14, 0);
    road.receiveShadow = true;
    group.add(road);

    // Kultowa warszawska latarnia uliczna OŻk "grzybek" (widoczna na zdjęciu frontowym)
    const lampGroup = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.11, 4.6, 12),
      m.get('concrete')
    );
    pole.position.y = 2.3;
    pole.castShadow = true;
    lampGroup.add(pole);

    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 0.24, 16),
      m.get('zincSheet')
    );
    cap.position.y = 4.72;
    lampGroup.add(cap);

    const bulb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.14, 0.18, 12),
      new THREE.MeshStandardMaterial({
        color: 0xfff3cc,
        emissive: 0xffd27d,
        emissiveIntensity: 0.7,
      })
    );
    bulb.position.y = 4.55;
    lampGroup.add(bulb);

    lampGroup.position.set(12.20, 0, -6.40);
    lampGroup.name = 'Latarnia uliczna OŻk (ulica frontowa)';
    group.add(lampGroup);

    return group;
  }

  /**
   * Betonowy słup energetyczny ŻN z przyłączem napowietrznym (udokumentowany w ./słup do demontażu/)
   */
  buildUtilityPole(group) {
    const m = this.materials;
    const xPole = 10.35;
    const zPole = -3.65;
    const hPole = 8.80;

    // Ażurowy słup żelbetowy ŻN
    const mainLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, hPole, 0.16),
      m.get('concrete')
    );
    mainLeg.position.set(xPole, hPole / 2, zPole);
    mainLeg.castShadow = true;
    mainLeg.name = 'Słup energetyczny ŻN (do demontażu)';
    group.add(mainLeg);

    // Szczudło betonowe przyziemne
    const baseStump = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 1.80, 0.24),
      m.get('concrete')
    );
    baseStump.position.set(xPole, 0.90, zPole + 0.12);
    group.add(baseStump);

    // Żółta opaska ostrzegawcza
    const warningBand = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.35, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 })
    );
    warningBand.position.set(xPole, 1.65, zPole);
    group.add(warningBand);

    // Poprzecznik stalowy z izolatorami ceramicznymi na szczycie
    const crossArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 1.40),
      m.get('steelGalvanized')
    );
    crossArm.position.set(xPole, hPole - 0.35, zPole);
    group.add(crossArm);

    for (const iz of [-0.55, -0.18, 0.18, 0.55]) {
      const insulator = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 0.16, 10),
        m.get('windowFrame')
      );
      insulator.position.set(xPole, hPole - 0.24, zPole + iz);
      group.add(insulator);
    }

    // Przewód przyłącza napowietrznego (ze słupa do stojaka dachowego/elewacji budynku)
    const pStart = new THREE.Vector3(xPole, hPole - 0.20, zPole);
    const pEnd = new THREE.Vector3(5.35, ELEVATIONS.atticFloor + 0.45, -3.65);
    const cableDir = new THREE.Vector3().subVectors(pEnd, pStart);
    const cableLen = cableDir.length();
    const cableMid = new THREE.Vector3().addVectors(pStart, pEnd).multiplyScalar(0.5);

    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, cableLen, 6),
      m.get('steelRailing')
    );
    cable.position.copy(cableMid);
    cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), cableDir.clone().normalize());
    group.add(cable);
  }

  /**
   * Buduje linie wymiarowe 3D oraz rejestruje koty do projekcji HTML 2D w Viewer.js
   */
  buildArchitecturalDimensions(group) {
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xd4af37,
      transparent: true,
      opacity: 0.85,
    });

    const addDimensionLine = (p1, p2, labelText, category = 'dim') => {
      const pts = [p1, p2];
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geom, lineMat);
      group.add(line);

      // Krótkie kreski ograniczające (tick marks)
      const tickH = new THREE.Vector3(0, 0.25, 0);
      for (const p of [p1, p2]) {
        const tGeom = new THREE.BufferGeometry().setFromPoints([
          p.clone().sub(tickH),
          p.clone().add(tickH),
        ]);
        group.add(new THREE.Line(tGeom, lineMat));
      }

      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      this.labelAnchors.push({
        position: mid,
        text: labelText,
        category,
      });
    };

    // 1. Głębokość bryły głównej: 11.00 m (X od -5.50 do +5.50 przy Z = -6.65)
    addDimensionLine(
      new THREE.Vector3(-5.50, 0.15, -6.65),
      new THREE.Vector3(5.50, 0.15, -6.65),
      '11.00 m (Bryła główna)'
    );

    // 2. Głębokość werandy ogrodowej: 2.70 m (X od -8.20 do -5.50 przy Z = -6.65)
    addDimensionLine(
      new THREE.Vector3(-8.20, 0.15, -6.65),
      new THREE.Vector3(-5.50, 0.15, -6.65),
      '2.70 m (Weranda 1966)'
    );

    // 3. Łączna głębokość zabudowy: 13.70 m (X od -8.20 do +5.50 przy Z = -7.30)
    addDimensionLine(
      new THREE.Vector3(-8.20, 0.15, -7.30),
      new THREE.Vector3(5.50, 0.15, -7.30),
      '13.70 m (Całkowita głęb. zabudowy)'
    );

    // 4. Przedogródek / Zjazd do garażu: 5.00 m (X od +5.50 do +10.50 przy Z = -6.65)
    addDimensionLine(
      new THREE.Vector3(5.50, 0.15, -6.65),
      new THREE.Vector3(10.50, 0.15, -6.65),
      '5.00 m (Przedogródek / Zjazd)'
    );

    // 5. Szerokość jednego segmentu: 6.08 m (Z od 0.00 do -6.08 przy X = +6.10)
    addDimensionLine(
      new THREE.Vector3(6.10, 0.15, 0.00),
      new THREE.Vector3(6.10, 0.15, -6.08),
      '6.08 m (Szer. segmentu B)'
    );

    // 6. Szerokość działki: 10.52 m (Z od 0.00 do -10.52 przy X = +10.85)
    addDimensionLine(
      new THREE.Vector3(10.85, 0.15, 0.00),
      new THREE.Vector3(10.85, 0.15, -10.52),
      '10.52 m (Front działki)'
    );

    // 7. Pionowa oś rzędnych wysokościowych przy narożniku NE (X = +5.95, Z = -6.35)
    addDimensionLine(
      new THREE.Vector3(5.95, ELEVATIONS.basementFloor, -6.35),
      new THREE.Vector3(5.95, ELEVATIONS.roofRidge, -6.35),
      'H = 10.25 m (Kalenica)',
      'elev'
    );

    const elevMarkers = [
      { y: ELEVATIONS.basementFloor, label: '-0.92 m Piwnica / Garaż' },
      { y: ELEVATIONS.groundFloor, label: '±0.00 (+1.60 m) Parter' },
      { y: ELEVATIONS.firstFloor, label: '+4.70 m I Piętro (Strop Kleina)' },
      { y: ELEVATIONS.atticFloor, label: '+7.55 m Strych / Gzyms' },
    ];

    for (const em of elevMarkers) {
      this.labelAnchors.push({
        position: new THREE.Vector3(6.15, em.y, -6.35),
        text: em.label,
        category: 'elev',
      });
    }
  }
}
