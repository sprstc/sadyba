/**
 * src/core/HumanAvatar.js
 * Zaokrąglony, ekspresyjny model 3D „Inspektora Renowacji” (wysokość 1.82 m, szerokość w barkach 0.60 m)
 * z kaskiem budowlanym, pasem narzędziowym, proceduralną animacją chodu (waddle, bobbing, sprint lean)
 * oraz dynamiczną reakcją na przestronność / ciasnotę pomieszczeń (Raycasting 8-kierunkowy).
 */

import * as THREE from 'three';

export class HumanAvatar {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'HumanAvatar_Inspector_182cm';

    this.walkPhase = 0;
    this.idlePhase = 0;
    this.jitterPhase = 0;

    // Stan komfortu przestrzennego ('spacious' | 'normal' | 'cramped')
    this.comfortState = 'normal';
    this.squeezeTarget = 0;
    this.squeezeCurrent = 0;
    this.happyTarget = 0;
    this.happyCurrent = 0;
    this.clearanceCm = 150;
    this.spaciousBannerTimer = 0;
    this._lastBadgeKey = '';

    this.buildAvatarMesh();
    this.buildOverheadBadge();
  }

  buildAvatarMesh() {
    // Materiały PBR postaci Inspektora
    this.skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c29d, roughness: 0.55 });
    this.cheekMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      roughness: 0.6,
      transparent: true,
      opacity: 0.45,
    });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3b2820, roughness: 0.75 });
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.62 });
    const vestHiVisMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.4,
      emissive: 0x422006,
      emissiveIntensity: 0.15,
    });
    const reflectiveMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.65,
      roughness: 0.25,
    });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.48 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.72 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.55 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.85 });
    const hardHatMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.22,
      metalness: 0.08,
    });
    const beltLeatherMat = new THREE.MeshStandardMaterial({ color: 0x5c2d0c, roughness: 0.65 });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.75,
      roughness: 0.25,
    });
    const steelToolMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.8,
      roughness: 0.25,
    });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15 });
    const mouthDarkMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.5 });

    // =========================================================================
    // 1. MIEDNICA I PAS NARZĘDZIOWY (Y = 0.93 m)
    // =========================================================================
    this.pelvis = new THREE.Group();
    this.pelvis.position.set(0, 0.93, 0);
    this.group.add(this.pelvis);

    const hipsGeo = new THREE.CapsuleGeometry(0.125, 0.10, 10, 18);
    hipsGeo.rotateZ(Math.PI * 0.5);
    const hipsMesh = new THREE.Mesh(hipsGeo, pantsMat);
    hipsMesh.scale.set(1.0, 0.95, 0.82);
    hipsMesh.castShadow = true;
    this.pelvis.add(hipsMesh);

    this.buildToolBelt(beltLeatherMat, brassMat, hardHatMat, steelToolMat);

    // =========================================================================
    // 2. ZAOKRĄGLONY TUŁÓW + KAMIZELKA INSPEKTORA (Y = 0.93 .. 1.50 m)
    // =========================================================================
    this.torso = new THREE.Group();
    this.torso.position.set(0, 0.04, 0);
    this.pelvis.add(this.torso);

    // Zaokrąglony korpus (CapsuleGeometry)
    const chestGeo = new THREE.CapsuleGeometry(0.152, 0.25, 14, 24);
    const chestMesh = new THREE.Mesh(chestGeo, jacketMat);
    chestMesh.position.set(0, 0.25, 0);
    chestMesh.scale.set(1.12, 1.0, 0.82);
    chestMesh.castShadow = true;
    this.torso.add(chestMesh);

    // Kamizelka ostrzegawcza Inspektora (żółte panele + srebrne pasy odblaskowe)
    const vestGeo = new THREE.CylinderGeometry(0.166, 0.156, 0.30, 20);
    const vestMesh = new THREE.Mesh(vestGeo, vestHiVisMat);
    vestMesh.position.set(0, 0.22, 0);
    vestMesh.scale.set(1.08, 1.0, 0.80);
    this.torso.add(vestMesh);

    for (const stripY of [0.14, 0.26]) {
      const bandGeo = new THREE.CylinderGeometry(0.169, 0.166, 0.028, 20);
      const band = new THREE.Mesh(bandGeo, reflectiveMat);
      band.position.set(0, stripY, 0);
      band.scale.set(1.08, 1.0, 0.81);
      this.torso.add(band);
    }

    // Wycięcie koszuli pod szyją + złoty identyfikator Inspektora
    const collarShirt = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.068, 0.10, 8, 12),
      shirtMat
    );
    collarShirt.position.set(0, 0.38, 0.055);
    collarShirt.scale.set(1.0, 1.0, 0.65);
    this.torso.add(collarShirt);

    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.036, 0.015),
      brassMat
    );
    badge.position.set(0.085, 0.34, 0.125);
    badge.rotation.y = 0.22;
    this.torso.add(badge);

    // =========================================================================
    // 3. GŁOWA, TWARZ EKSPRESYJNA I ŻÓŁTY KASK BUDOWLANY (wys. całk. = 1.82 m)
    // =========================================================================
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.51, 0); // 0.93 + 0.04 + 0.51 = 1.48 m u podstawy szyi
    this.torso.add(this.headGroup);

    this.buildHeadAndFace(
      hairMat,
      hardHatMat,
      brassMat,
      eyeWhiteMat,
      pupilMat,
      mouthDarkMat,
      shirtMat
    );

    // =========================================================================
    // 4. RAMIONA ZAOKRĄGLONE (szerokość w barkach 0.60 m = ±0.30 m w stanie swobodnym)
    // =========================================================================
    this.leftArm = this.createArm(jacketMat, this.skinMat, vestHiVisMat, 1);
    this.rightArm = this.createArm(jacketMat, this.skinMat, vestHiVisMat, -1);
    this.torso.add(this.leftArm.shoulder, this.rightArm.shoulder);

    // =========================================================================
    // 5. NOGI ZAOKRĄGLONE I BUTY ROBOCZE
    // =========================================================================
    this.leftLeg = this.createLeg(pantsMat, bootMat, soleMat, 1);
    this.rightLeg = this.createLeg(pantsMat, bootMat, soleMat, -1);
    this.pelvis.add(this.leftLeg.hip, this.rightLeg.hip);

    // =========================================================================
    // 6. DYSK ERGONOMICZNY POD STOPAMI (średnica 0.60 m = szerokość barków)
    // =========================================================================
    const ringGeom = new THREE.RingGeometry(0.24, 0.30, 32);
    ringGeom.rotateX(-Math.PI / 2);
    this.footRingMat = new THREE.MeshBasicMaterial({
      color: 0xd4af37,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
    });
    this.footRing = new THREE.Mesh(ringGeom, this.footRingMat);
    this.footRing.position.y = 0.015;
    this.group.add(this.footRing);
  }

  buildToolBelt(beltLeatherMat, brassMat, hardHatMat, steelToolMat) {
    this.toolBelt = new THREE.Group();
    this.toolBelt.position.set(0, 0.03, 0);
    this.pelvis.add(this.toolBelt);

    // Skórzany pas główny
    const beltRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.162, 0.162, 0.055, 24),
      beltLeatherMat
    );
    beltRing.scale.set(1.08, 1.0, 0.82);
    this.toolBelt.add(beltRing);

    // Mosiężna klamra z przodu (+Z)
    const buckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.068, 0.065, 0.022),
      brassMat
    );
    buckle.position.set(0, 0, 0.132);
    this.toolBelt.add(buckle);

    // Kieszeń skórzana (kabura inspektorska) na prawym biodrze (-X)
    const pouchR = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.042, 0.055, 8, 12),
      beltLeatherMat
    );
    pouchR.position.set(-0.175, -0.03, 0.02);
    pouchR.rotation.z = 0.15;
    this.toolBelt.add(pouchR);

    // Kieszeń z tyłu po lewej stronie
    const pouchBack = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.038, 0.045, 8, 12),
      beltLeatherMat
    );
    pouchBack.position.set(0.11, -0.025, -0.115);
    this.toolBelt.add(pouchBack);

    // Żółta miarka zwijana 5m przypięta do pasa
    const tapeMeasure = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.032, 16),
      hardHatMat
    );
    tapeMeasure.rotation.z = Math.PI * 0.5;
    tapeMeasure.position.set(-0.155, 0.01, 0.085);
    this.toolBelt.add(tapeMeasure);

    // Młotek ciesielski / inspektorski w uchwycie na lewym biodrze (+X)
    this.hammerGroup = new THREE.Group();
    this.hammerGroup.position.set(0.178, -0.01, 0.01);
    const handle = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.013, 0.16, 6, 10),
      beltLeatherMat
    );
    handle.position.y = -0.07;
    const hammerHead = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.018, 0.065, 8, 10),
      steelToolMat
    );
    hammerHead.rotation.x = Math.PI * 0.5;
    hammerHead.position.y = 0.01;
    this.hammerGroup.add(handle, hammerHead);
    this.toolBelt.add(this.hammerGroup);
  }

  buildHeadAndFace(hairMat, hardHatMat, brassMat, eyeWhiteMat, pupilMat, mouthDarkMat, teethMat) {
    // Zaokrąglona szyja
    const neck = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.05, 0.055, 10, 14),
      this.skinMat
    );
    neck.position.set(0, 0.04, 0);
    this.headGroup.add(neck);

    // Zaokrąglona głowa (SphereGeometry)
    const headSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.118, 24, 20),
      this.skinMat
    );
    headSphere.position.set(0, 0.175, 0);
    headSphere.scale.set(0.98, 1.04, 0.96);
    headSphere.castShadow = true;
    this.headGroup.add(headSphere);

    // Zaokrąglone uszy
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(
        new THREE.SphereGeometry(0.027, 10, 10),
        this.skinMat
      );
      ear.position.set(side * 0.114, 0.172, -0.005);
      ear.scale.set(0.55, 1.1, 0.85);
      this.headGroup.add(ear);
    }

    // Włosy widoczne spod kasku z tyłu i po bokach
    const hairBack = new THREE.Mesh(
      new THREE.SphereGeometry(0.116, 18, 14, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.55),
      hairMat
    );
    hairBack.position.set(0, 0.185, -0.012);
    this.headGroup.add(hairBack);

    // Zaokrąglony nos z przodu (+Z)
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.023, 12, 12),
      this.skinMat
    );
    nose.position.set(0, 0.168, 0.115);
    nose.scale.set(0.95, 0.88, 1.15);
    this.headGroup.add(nose);

    // Rumieńce na policzkach
    this.leftCheek = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), this.cheekMat);
    this.leftCheek.position.set(0.066, 0.152, 0.092);
    this.leftCheek.scale.set(1.1, 0.75, 0.5);

    this.rightCheek = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), this.cheekMat);
    this.rightCheek.position.set(-0.066, 0.152, 0.092);
    this.rightCheek.scale.set(1.1, 0.75, 0.5);
    this.headGroup.add(this.leftCheek, this.rightCheek);

    // Oczy 3D (białka, źrenice, błysk w oku) + ekspresyjne brwi
    this.leftEyeGroup = this.createEye(eyeWhiteMat, pupilMat);
    this.leftEyeGroup.position.set(0.044, 0.188, 0.102);

    this.rightEyeGroup = this.createEye(eyeWhiteMat, pupilMat);
    this.rightEyeGroup.position.set(-0.044, 0.188, 0.102);
    this.headGroup.add(this.leftEyeGroup, this.rightEyeGroup);

    const browGeo = new THREE.CapsuleGeometry(0.0085, 0.032, 6, 10);
    browGeo.rotateZ(Math.PI * 0.5);
    this.leftBrow = new THREE.Mesh(browGeo, hairMat);
    this.leftBrow.position.set(0.045, 0.222, 0.108);

    this.rightBrow = new THREE.Mesh(browGeo, hairMat);
    this.rightBrow.position.set(-0.045, 0.222, 0.108);
    this.headGroup.add(this.leftBrow, this.rightBrow);

    // Usta 3D (3 ekspresje: szeroki uśmiech 😄, neutralny uśmiech, skwaszony grymas 😣)
    this.mouthGroup = new THREE.Group();
    this.mouthGroup.position.set(0, 0.132, 0.108);
    this.headGroup.add(this.mouthGroup);

    // 1. Szeroki radosny uśmiech (Spacious > 1.2m)
    this.mouthHappy = new THREE.Group();
    const happyArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.032, 0.0085, 10, 20, Math.PI),
      mouthDarkMat
    );
    happyArc.rotation.z = Math.PI; // wygięty w górę w kształt U
    happyArc.position.y = 0.008;
    const happyTeeth = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.007, 0.036, 6, 10),
      teethMat
    );
    happyTeeth.rotation.z = Math.PI * 0.5;
    happyTeeth.position.set(0, 0.002, -0.002);
    this.mouthHappy.add(happyArc, happyTeeth);
    this.mouthHappy.visible = false;

    // 2. Neutralny przyjazny uśmiech
    this.mouthNeutral = new THREE.Mesh(
      new THREE.TorusGeometry(0.022, 0.0065, 8, 16, Math.PI * 0.85),
      mouthDarkMat
    );
    this.mouthNeutral.rotation.z = Math.PI * 1.075;
    this.mouthNeutral.position.y = 0.006;

    // 3. Skwaszony / ściśnięty grymas niezadowolenia (Cramped < 0.65m)
    this.mouthCramped = new THREE.Group();
    const frownArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.028, 0.008, 10, 20, Math.PI),
      mouthDarkMat
    );
    frownArc.position.y = -0.016; // wygięty w dół 😣
    this.mouthCramped.add(frownArc);
    this.mouthCramped.visible = false;

    this.mouthGroup.add(this.mouthHappy, this.mouthNeutral, this.mouthCramped);

    // =========================================================================
    // ŻÓŁTY KASK BUDOWLANY INSPEKTORA (szczyt kasku na Y = 1.82 m)
    // =========================================================================
    this.hardHat = new THREE.Group();
    this.hardHat.position.set(0, 0.215, 0); // 1.48 + 0.215 = 1.695 m podstawa kasku
    this.headGroup.add(this.hardHat);

    // Czasza kasku
    const domeGeo = new THREE.SphereGeometry(0.128, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const dome = new THREE.Mesh(domeGeo, hardHatMat);
    dome.scale.set(1.0, 0.92, 1.06);
    dome.castShadow = true;
    this.hardHat.add(dome);

    // Grzebień wzmacniający na szczycie kasku (sięga do Y = 1.82 m)
    const crestGeo = new THREE.CapsuleGeometry(0.022, 0.16, 8, 12);
    crestGeo.rotateX(Math.PI * 0.5);
    const crest = new THREE.Mesh(crestGeo, hardHatMat);
    crest.position.set(0, 0.105, 0.005);
    crest.castShadow = true;
    this.hardHat.add(crest);

    // Rondo / daszek kasku z przodu (+Z)
    const brimGeo = new THREE.CylinderGeometry(0.134, 0.142, 0.014, 24);
    const brim = new THREE.Mesh(brimGeo, hardHatMat);
    brim.position.set(0, 0.005, 0.022);
    brim.scale.set(1.02, 1.0, 1.18);
    brim.rotation.x = 0.08;
    brim.castShadow = true;
    this.hardHat.add(brim);

    // Latarka / znaczek inspektorski na czole kasku
    const badgeLamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.02, 16),
      brassMat
    );
    badgeLamp.rotation.x = Math.PI * 0.5;
    badgeLamp.position.set(0, 0.045, 0.132);
    this.hardHat.add(badgeLamp);
  }

  createEye(eyeWhiteMat, pupilMat) {
    const eyeGroup = new THREE.Group();
    const sclera = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 14, 12),
      eyeWhiteMat
    );
    sclera.scale.set(1.0, 1.12, 0.55);

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.013, 12, 10),
      pupilMat
    );
    pupil.position.set(0, 0, 0.011);
    pupil.scale.set(1.0, 1.1, 0.6);

    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.0045, 8, 8),
      eyeWhiteMat
    );
    glint.position.set(0.004, 0.005, 0.017);

    eyeGroup.add(sclera, pupil, glint);
    return eyeGroup;
  }

  createArm(jacketMat, skinMat, cuffMat, side) {
    // W stanie swobodnym: środek barku na X = ±0.228 m + promień ramienia i lekki odwód = dokładnie ±0.30 m (0.60 m szerokości!)
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.228, 0.44, 0);

    const shoulderCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 14, 12),
      jacketMat
    );
    shoulderCap.castShadow = true;
    shoulder.add(shoulderCap);

    const upperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.17, 10, 16),
      jacketMat
    );
    upperArm.position.set(0, -0.12, 0);
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.24, 0);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.042, 0.16, 10, 16),
      jacketMat
    );
    forearm.position.set(0, -0.11, 0);
    forearm.castShadow = true;
    elbow.add(forearm);

    // Zaokrąglona dłoń (SphereGeometry) + kciuk
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.046, 14, 12),
      skinMat
    );
    hand.position.set(0, -0.24, 0.01);
    hand.scale.set(0.92, 1.08, 0.85);
    hand.castShadow = true;

    const thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.014, 0.022, 6, 8),
      skinMat
    );
    thumb.position.set(-side * 0.032, -0.225, 0.032);
    thumb.rotation.z = side * 0.5;
    elbow.add(hand, thumb);

    return { shoulder, elbow, side };
  }

  createLeg(pantsMat, bootMat, soleMat, side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.105, -0.04, 0);

    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.065, 0.28, 10, 16),
      pantsMat
    );
    thigh.position.set(0, -0.20, 0);
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.42, 0);
    hip.add(knee);

    const calf = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.054, 0.26, 10, 16),
      pantsMat
    );
    calf.position.set(0, -0.19, 0);
    calf.castShadow = true;
    knee.add(calf);

    // Zaokrąglony but roboczy Inspektora
    const bootGroup = new THREE.Group();
    bootGroup.position.set(0, -0.41, 0.038);

    const bootUpperGeo = new THREE.CapsuleGeometry(0.058, 0.11, 10, 16);
    bootUpperGeo.rotateX(Math.PI * 0.5);
    const bootUpper = new THREE.Mesh(bootUpperGeo, bootMat);
    bootUpper.scale.set(1.02, 0.78, 1.0);
    bootUpper.castShadow = true;

    const bootSole = new THREE.Mesh(
      new THREE.BoxGeometry(0.118, 0.028, 0.22),
      soleMat
    );
    bootSole.position.set(0, -0.042, 0);
    bootGroup.add(bootUpper, bootSole);
    knee.add(bootGroup);

    return { hip, knee };
  }

  // ===========================================================================
  // PŁYWAJĄCY ZNACZNIK KOMFORTU PRZESTRZENNEGO NAD KASKIEM (DataTexture Sprite)
  // ===========================================================================
  buildOverheadBadge() {
    this.badgeWidth = 256;
    this.badgeHeight = 96;
    this.badgeBuffer = new Uint8Array(this.badgeWidth * this.badgeHeight * 4);

    this.badgeTexture = new THREE.DataTexture(
      this.badgeBuffer,
      this.badgeWidth,
      this.badgeHeight,
      THREE.RGBAFormat
    );
    this.badgeTexture.colorSpace = THREE.SRGBColorSpace;
    this.badgeTexture.flipY = true;
    this.badgeTexture.needsUpdate = true;

    this.badgeMat = new THREE.SpriteMaterial({
      map: this.badgeTexture,
      transparent: true,
      opacity: 0.0,
      depthTest: false,
    });

    this.badgeSprite = new THREE.Sprite(this.badgeMat);
    this.badgeSprite.position.set(0, 2.04, 0);
    this.badgeSprite.scale.set(0.88, 0.33, 1);
    this.badgeSprite.renderOrder = 999;
    this.group.add(this.badgeSprite);
  }

  _updateBadgeTexture(state, clearanceCm) {
    const roundedCm = Math.max(40, Math.round(clearanceCm));
    const badgeKey = state === 'cramped' ? `cramped_${roundedCm}` : state;
    if (this._lastBadgeKey === badgeKey) return;
    this._lastBadgeKey = badgeKey;

    const w = this.badgeWidth;
    const h = this.badgeHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      ctx.clearRect(0, 0, w, h);

      const isCramped = state === 'cramped';
      const bgFill = isCramped ? 'rgba(127, 29, 29, 0.92)' : 'rgba(20, 83, 45, 0.90)';
      const borderStroke = isCramped ? '#f87171' : '#4ade80';
      const badgeTitle = isCramped ? `😣 ŚCISK: ${roundedCm} cm` : '😄 PRZESTRONNIE';
      const badgeSub = isCramped ? 'Wąskie przejście (<65 cm)' : `Luz wokół > 120 cm`;

      // Zaokrąglona kapsuła tła
      const pad = 8;
      const r = 28;
      ctx.beginPath();
      ctx.moveTo(pad + r, pad);
      ctx.lineTo(w - pad - r, pad);
      ctx.quadraticCurveTo(w - pad, pad, w - pad, pad + r);
      ctx.lineTo(w - pad, h - pad - r);
      ctx.quadraticCurveTo(w - pad, h - pad, w - pad - r, h - pad);
      ctx.lineTo(pad + r, h - pad);
      ctx.quadraticCurveTo(pad, h - pad, pad, h - pad - r);
      ctx.lineTo(pad, pad + r);
      ctx.quadraticCurveTo(pad, pad, pad + r, pad);
      ctx.closePath();

      ctx.fillStyle = bgFill;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = borderStroke;
      ctx.stroke();

      // Tekst główny
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 24px Inter, system-ui, sans-serif';
      ctx.fillText(badgeTitle, w * 0.5, h * 0.40);

      // Podpis pomocniczy
      ctx.fillStyle = isCramped ? '#fecaca' : '#bbf7d0';
      ctx.font = '600 15px Inter, system-ui, sans-serif';
      ctx.fillText(badgeSub, w * 0.5, h * 0.72);

      const imgData = ctx.getImageData(0, 0, w, h);
      this.badgeBuffer.set(imgData.data);
      this.badgeTexture.needsUpdate = true;
    }

    // Natychmiast zwolnij tymczasowy kontekst 2D Canvas (ochrona pamięci GPU na Androidzie)
    canvas.width = 0;
    canvas.height = 0;
  }

  /**
   * Ustawia stan komfortu przestrzennego wyznaczony przez 8-kierunkowy Raycasting w CameraManager
   * @param {'spacious' | 'normal' | 'cramped'} state
   * @param {number} clearanceCm - zmierzona szerokość przejścia / luzu w cm
   * @param {number} squeezeIntensity - 0..1 intensywność ścisku
   */
  setSpaceComfort(state, clearanceCm = 150, squeezeIntensity = 0) {
    if (state === 'spacious' && this.comfortState !== 'spacious') {
      // Pokaż pływający wskaźnik radości 😄 po wejściu w otwartą przestrzeń
      this.spaciousBannerTimer = 4.0;
    }
    this.comfortState = state;
    this.clearanceCm = clearanceCm;
    this.squeezeTarget = state === 'cramped' ? Math.max(0.45, squeezeIntensity) : 0.0;
    this.happyTarget = state === 'spacious' ? 1.0 : 0.0;

    if (state === 'cramped' || state === 'spacious') {
      this._updateBadgeTexture(state, clearanceCm);
    }
  }

  /**
   * Aktualizuje proceduralną animację chodu (zabawny chód „waddle”, podskakiwanie głowy,
   * zamaszyste machanie rękami, pochylenie w sprincie) oraz reakcję na ciasnotę/przestronność.
   */
  update(dt, speedNormalized = 0, isGrounded = true, isSprinting = false) {
    // Płynna interpolacja stanów emocjonalnych i przestrzennych
    this.squeezeCurrent = THREE.MathUtils.lerp(
      this.squeezeCurrent,
      this.squeezeTarget,
      Math.min(1.0, dt * 10.0)
    );
    this.happyCurrent = THREE.MathUtils.lerp(
      this.happyCurrent,
      this.happyTarget,
      Math.min(1.0, dt * 8.0)
    );

    const sq = this.squeezeCurrent;
    const hp = this.happyCurrent;

    // 1. Aktualizacja wyrazu twarzy 3D i koloru dysku pod stopami
    this.mouthHappy.visible = hp > 0.45 && sq < 0.25;
    this.mouthCramped.visible = sq >= 0.25;
    this.mouthNeutral.visible = !this.mouthHappy.visible && !this.mouthCramped.visible;

    // Brwi i zmrużenie oczu
    const browAngle = sq * 0.38 - hp * 0.16;
    this.leftBrow.rotation.z = browAngle;
    this.rightBrow.rotation.z = -browAngle;
    this.leftBrow.position.y = 0.222 + hp * 0.009 - sq * 0.008;
    this.rightBrow.position.y = 0.222 + hp * 0.009 - sq * 0.008;

    const eyeScaleY = 1.0 - sq * 0.38 + hp * 0.12;
    this.leftEyeGroup.scale.y = eyeScaleY;
    this.rightEyeGroup.scale.y = eyeScaleY;

    // Kolor dysku ergonomicznego 0.60 m pod stopami (Zielony = przestronnie, Złoty = norma, Czerwony = ścisk)
    if (sq > 0.25) {
      this.footRingMat.color.setHex(0xef4444);
    } else if (hp > 0.45) {
      this.footRingMat.color.setHex(0x22c55e);
    } else {
      this.footRingMat.color.setHex(0xd4af37);
    }

    // 2. Pływający znacznik nad głową (😣 ŚCISK: XX cm / 😄 PRZESTRONNIE)
    this.idlePhase += dt * 2.6;
    if (this.spaciousBannerTimer > 0) {
      this.spaciousBannerTimer = Math.max(0, this.spaciousBannerTimer - dt);
    }

    let targetBadgeOpacity = 0.0;
    if (this.comfortState === 'cramped') {
      targetBadgeOpacity = 0.96;
    } else if (this.comfortState === 'spacious' && (this.spaciousBannerTimer > 0 || speedNormalized < 0.05)) {
      targetBadgeOpacity = 0.88;
    }
    this.badgeMat.opacity = THREE.MathUtils.lerp(
      this.badgeMat.opacity,
      targetBadgeOpacity,
      Math.min(1.0, dt * 8.0)
    );
    this.badgeSprite.position.y = 2.03 + Math.sin(this.idlePhase * 1.4) * 0.025;

    // 3. Nerwowe drżenie (jitter) w bardzo ciasnych miejscach (< 65 cm)
    let jitterX = 0;
    let jitterZ = 0;
    if (sq > 0.15) {
      this.jitterPhase += dt * 42.0;
      jitterX = Math.sin(this.jitterPhase * 1.3) * 0.007 * sq;
      jitterZ = Math.cos(this.jitterPhase * 1.7) * 0.007 * sq;
      this.mouthCramped.position.x = Math.sin(this.jitterPhase * 2.0) * 0.004 * sq;
    } else {
      this.mouthCramped.position.x = 0;
    }

    // 4. Szerokość barków i ułożenie ramion (0.60 m w stanie swobodnym vs przyciśnięte w stanie „squeezed”)
    const shoulderSpreadX = 0.228 - sq * 0.052 + hp * 0.008;
    const shoulderHunchY = 0.44 + sq * 0.042 - hp * 0.006;
    this.leftArm.shoulder.position.set(shoulderSpreadX, shoulderHunchY, 0);
    this.rightArm.shoulder.position.set(-shoulderSpreadX, shoulderHunchY, 0);

    // 5. Proceduralna animacja chodu („Goofy Waddle”, „Bouncy Head Bob”, „Sprint Lean”)
    if (speedNormalized > 0.02) {
      const sprintBoost = isSprinting ? 1.35 : 1.0;
      const freq = (6.8 + speedNormalized * 5.2) * sprintBoost;
      this.walkPhase += dt * freq;

      const amp = Math.min(1.15, speedNormalized) * (isSprinting ? 0.88 : 0.72) * (1.0 - sq * 0.35);
      const s = Math.sin(this.walkPhase);
      const c = Math.cos(this.walkPhase);
      const s2 = Math.sin(this.walkPhase * 2.0);

      // Praca nóg z wyraźnym ugięciem kolan
      this.leftLeg.hip.rotation.x = s * amp;
      this.rightLeg.hip.rotation.x = -s * amp;
      this.leftLeg.knee.rotation.x = Math.max(0, -c * amp * 1.05 + 0.12);
      this.rightLeg.knee.rotation.x = Math.max(0, c * amp * 1.05 + 0.12);

      // Zabawny kołyszący chód na boki („funny side-to-side waddle”)
      const waddleAngle = s * (isSprinting ? 0.14 : 0.11) * (1.0 - sq * 0.4);
      this.pelvis.rotation.z = waddleAngle;
      this.pelvis.position.x = -s * 0.028 * (1.0 - sq * 0.5) + jitterX;
      this.pelvis.position.y = 0.93 + Math.abs(s) * (isSprinting ? 0.055 : 0.042);

      // Komiczne pochylenie tułowia do przodu podczas sprintu (Shift)
      const targetLeanX = isSprinting ? 0.36 : 0.06 + sq * 0.10;
      this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, targetLeanX, Math.min(1, dt * 10));
      this.torso.rotation.y = s * 0.14 * (1.0 - sq * 0.5) + jitterZ;
      this.torso.rotation.z = -waddleAngle * 0.65;

      // Sprężyste podskakiwanie i kiwanie głowy („bouncy head bobbing”)
      this.headGroup.position.y = 0.51 - sq * 0.028 + Math.max(0, s2) * 0.028;
      this.headGroup.rotation.x = -this.torso.rotation.x * 0.65 + s2 * 0.06;
      this.headGroup.rotation.z = s * 0.08;
      this.headGroup.rotation.y = -s * 0.06;

      // Zamaszyste machanie rękami podczas chodu (lub przyciśnięte łokcie w wąskim przejściu)
      const armSwing = s * amp * (isSprinting ? 1.25 : 1.05) * (1.0 - sq * 0.75);
      this.leftArm.shoulder.rotation.x = -armSwing - sq * 0.35;
      this.rightArm.shoulder.rotation.x = armSwing - sq * 0.35;

      // Odwiedzenie ramion (szeroko i luźno w przestronnych miejscach, ciasno przy żebrach w ścisku)
      const armOutward = -0.11 * (1.0 - sq) + sq * 0.24 - hp * 0.05;
      this.leftArm.shoulder.rotation.z = armOutward;
      this.rightArm.shoulder.rotation.z = -armOutward;

      const baseElbow = isSprinting ? -0.85 : -0.32;
      this.leftArm.elbow.rotation.x = THREE.MathUtils.lerp(
        baseElbow - Math.max(0, s * 0.45),
        -1.15,
        sq
      );
      this.rightArm.elbow.rotation.x = THREE.MathUtils.lerp(
        baseElbow - Math.max(0, -s * 0.45),
        -1.15,
        sq
      );

      // Kołysanie młotka przy pasie narzędziowym
      if (this.hammerGroup) {
        this.hammerGroup.rotation.x = s * 0.25;
        this.hammerGroup.rotation.z = Math.abs(c) * 0.12;
      }
    } else {
      // Pozycja spoczynkowa: radosny podskok („cheerful idle bounce”) w przestronnych wnętrzach
      // lub skulona/spięta postawa z lekkim drżeniem w ciasnych przejściach
      const bounceFreq = hp > 0.3 ? 4.2 : 2.2;
      this.walkPhase += dt * bounceFreq;
      const breath = Math.sin(this.walkPhase);
      const happyBounce = Math.abs(Math.sin(this.walkPhase * 0.85)) * 0.032 * hp;

      this.leftLeg.hip.rotation.x *= 0.82;
      this.rightLeg.hip.rotation.x *= 0.82;
      this.leftLeg.knee.rotation.x = happyBounce * 2.2;
      this.rightLeg.knee.rotation.x = happyBounce * 2.2;

      this.pelvis.rotation.z = Math.sin(this.walkPhase * 0.5) * 0.03 * hp;
      this.pelvis.position.x = jitterX;
      this.pelvis.position.y = 0.93 + breath * 0.008 + happyBounce - sq * 0.025;

      this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, sq * 0.12, Math.min(1, dt * 8));
      this.torso.rotation.y = Math.sin(this.walkPhase * 0.4) * 0.05 * hp + jitterZ;
      this.torso.rotation.z = jitterX * 2.0;

      this.headGroup.position.y = 0.51 - sq * 0.032 + happyBounce * 0.4;
      this.headGroup.rotation.x = breath * 0.025 - sq * 0.08;
      this.headGroup.rotation.z = Math.sin(this.walkPhase * 0.5) * 0.045 * hp + jitterX * 3.0;
      this.headGroup.rotation.y = Math.sin(this.idlePhase * 0.45) * 0.12 * (1.0 - sq * 0.5);

      // Ułożenie ramion w spoczynku (szerokie zrelaksowane vs ciasno przyciśnięte do tułowia)
      const idleOutward = -0.12 * (1.0 - sq) - hp * 0.06 + sq * 0.25;
      this.leftArm.shoulder.rotation.z = idleOutward;
      this.rightArm.shoulder.rotation.z = -idleOutward;
      this.leftArm.shoulder.rotation.x = breath * 0.03 * (1.0 - sq) - sq * 0.38;
      this.rightArm.shoulder.rotation.x = -breath * 0.03 * (1.0 - sq) - sq * 0.38;

      this.leftArm.elbow.rotation.x = THREE.MathUtils.lerp(-0.16, -1.18, sq);
      this.rightArm.elbow.rotation.x = THREE.MathUtils.lerp(-0.16, -1.18, sq);

      if (this.hammerGroup) {
        this.hammerGroup.rotation.x *= 0.85;
        this.hammerGroup.rotation.z *= 0.85;
      }
    }

    if (!isGrounded) {
      this.leftLeg.hip.rotation.x = -0.42;
      this.rightLeg.hip.rotation.x = 0.28;
      this.leftLeg.knee.rotation.x = 0.55;
      this.rightLeg.knee.rotation.x = 0.45;
      this.leftArm.shoulder.rotation.z = -0.45;
      this.rightArm.shoulder.rotation.z = 0.45;
    }
  }
}
