/**
 * src/core/HumanAvatar.js
 * Proceduralnie animowany model 3D człowieka (1.80 m wysokości) do trybu spaceru TPP
 * oraz porównania skali architektonicznej (wysokości stropów, parapetów, biegów schodowych).
 */

import * as THREE from 'three';

export class HumanAvatar {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'HumanAvatar_180cm';
    this.walkPhase = 0;

    this.buildAvatarMesh();
  }

  buildAvatarMesh() {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe6b89c, roughness: 0.65 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x2c221e, roughness: 0.8 });
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.75 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.5 });
    const badgeMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.6, roughness: 0.3 });

    // Korpus / tułów (wysokość bioder Y = 0.94 m)
    this.pelvis = new THREE.Group();
    this.pelvis.position.set(0, 0.94, 0);
    this.group.add(this.pelvis);

    const hipsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.22), pantsMat);
    hipsMesh.castShadow = true;
    this.pelvis.add(hipsMesh);

    // Klatka piersiowa i marynarka
    this.torso = new THREE.Group();
    this.torso.position.set(0, 0.07, 0);
    this.pelvis.add(this.torso);

    const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.22), jacketMat);
    chestMesh.position.set(0, 0.26, 0);
    chestMesh.castShadow = true;
    this.torso.add(chestMesh);

    // Koszula pod marynarką
    const shirtV = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.28, 0.23), shirtMat);
    shirtV.position.set(0, 0.36, 0.005);
    this.torso.add(shirtV);

    // Złoty identyfikator inspektora nadzoru budowlanego
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.01), badgeMat);
    badge.position.set(0.10, 0.40, 0.115);
    this.torso.add(badge);

    // Głowa i szyja (całkowita wysokość 1.80 m)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.54, 0);
    this.torso.add(this.headGroup);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.09, 10), skinMat);
    neck.position.set(0, 0.04, 0);
    this.headGroup.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.22, 0.20), skinMat);
    head.position.set(0, 0.18, 0);
    head.castShadow = true;
    this.headGroup.add(head);

    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.07, 0.21), hairMat);
    hair.position.set(0, 0.27, -0.005);
    this.headGroup.add(hair);

    // Ramiona (lewe i prawe)
    this.leftArm = this.createArm(jacketMat, skinMat, 1);
    this.rightArm = this.createArm(jacketMat, skinMat, -1);
    this.torso.add(this.leftArm.shoulder, this.rightArm.shoulder);

    // Nogi (lewa i prawa)
    this.leftLeg = this.createLeg(pantsMat, shoeMat, 1);
    this.rightLeg = this.createLeg(pantsMat, shoeMat, -1);
    this.pelvis.add(this.leftLeg.hip, this.rightLeg.hip);

    // Dysk kierunkowy pod stopami (mieści się w cylindrze kolizji r = 0.25 m)
    const ringGeom = new THREE.RingGeometry(0.20, 0.245, 24);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd4af37,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    this.footRing = new THREE.Mesh(ringGeom, ringMat);
    this.footRing.position.y = 0.015;
    this.group.add(this.footRing);
  }

  createArm(jacketMat, skinMat, side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.205, 0.48, 0);

    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.28, 0.09), jacketMat);
    upperArm.position.set(0, -0.13, 0);
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.27, 0);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.25, 0.085), jacketMat);
    forearm.position.set(0, -0.12, 0);
    forearm.castShadow = true;
    elbow.add(forearm);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.08), skinMat);
    hand.position.set(0, -0.27, 0);
    elbow.add(hand);

    return { shoulder, elbow };
  }

  createLeg(pantsMat, shoeMat, side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.10, -0.04, 0);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.14), pantsMat);
    thigh.position.set(0, -0.22, 0);
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.44, 0);
    hip.add(knee);

    const calf = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.40, 0.12), pantsMat);
    calf.position.set(0, -0.20, 0);
    calf.castShadow = true;
    knee.add(calf);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.24), shoeMat);
    shoe.position.set(0, -0.42, 0.04);
    shoe.castShadow = true;
    knee.add(shoe);

    return { hip, knee };
  }

  /**
   * Aktualizuje animację szkieletową chodu / biegu / oddechu
   */
  update(dt, speedNormalized = 0, isGrounded = true) {
    if (speedNormalized > 0.02) {
      const freq = 6.5 + speedNormalized * 5.0;
      this.walkPhase += dt * freq;
      const amp = Math.min(1.0, speedNormalized) * 0.65;

      const s = Math.sin(this.walkPhase);
      const c = Math.cos(this.walkPhase);

      this.leftLeg.hip.rotation.x = s * amp;
      this.rightLeg.hip.rotation.x = -s * amp;

      this.leftLeg.knee.rotation.x = Math.max(0, -c * amp * 0.85);
      this.rightLeg.knee.rotation.x = Math.max(0, c * amp * 0.85);

      this.leftArm.shoulder.rotation.x = -s * amp * 0.75;
      this.rightArm.shoulder.rotation.x = s * amp * 0.75;
      this.leftArm.elbow.rotation.x = -0.25 - Math.max(0, s * 0.35);
      this.rightArm.elbow.rotation.x = -0.25 - Math.max(0, -s * 0.35);

      // Delikatne unoszenie miednicy podczas kroku
      this.pelvis.position.y = 0.94 + Math.abs(s) * 0.035;
      this.torso.rotation.y = s * 0.08;
    } else {
      // Płynny powrót do pozycji spoczynkowej (idle breathing)
      this.walkPhase += dt * 1.8;
      const breath = Math.sin(this.walkPhase) * 0.015;

      this.leftLeg.hip.rotation.x *= 0.85;
      this.rightLeg.hip.rotation.x *= 0.85;
      this.leftLeg.knee.rotation.x *= 0.85;
      this.rightLeg.knee.rotation.x *= 0.85;

      this.leftArm.shoulder.rotation.x = breath;
      this.rightArm.shoulder.rotation.x = -breath;
      this.leftArm.elbow.rotation.x = -0.12;
      this.rightArm.elbow.rotation.x = -0.12;

      this.pelvis.position.y = 0.94 + breath * 0.3;
      this.torso.rotation.y *= 0.85;
    }

    if (!isGrounded) {
      this.leftLeg.hip.rotation.x = -0.35;
      this.rightLeg.hip.rotation.x = 0.25;
      this.leftLeg.knee.rotation.x = 0.45;
      this.rightLeg.knee.rotation.x = 0.35;
    }
  }
}
