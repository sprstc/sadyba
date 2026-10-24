/**
 * src/core/CameraManager.js
 * Zarządzanie kamerą OrbitControls, presetami architektonicznymi, trybem pieszego TPP
 * z fizyką chodu po schodach/kondygnacjach, Noclip oraz Autopilotem wycieczki.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ELEVATIONS, AUTOPILOT_WAYPOINTS } from '../data/houseSpec.js';

export class CameraManager {
  constructor(camera, domElement, humanAvatar, onHudUpdate) {
    this.camera = camera;
    this.domElement = domElement;
    this.avatar = humanAvatar;
    this.onHudUpdate = onHudUpdate;

    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxDistance = 85;
    this.controls.minDistance = 0.8;
    this.controls.maxPolarAngle = Math.PI * 0.54;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 1.15;

    // Domyślny widok izometryczny NE (od ulicy frontowej i wejścia północnego)
    this.camera.position.set(18.5, 11.5, -15.5);
    this.controls.target.set(0.0, 3.8, -3.0);
    this.controls.update();

    this.transition = null;

    // Stan trybu spaceru TPP
    this.walkMode = false;
    this.noclip = false;
    this.autopilot = false;
    this.autopilotIdx = 0;

    this.playerPos = new THREE.Vector3(8.5, 0.0, -6.8);
    this.playerVelY = 0;
    this.isGrounded = true;
    this.yaw = Math.PI * 0.55;
    this.pitch = 0.16;
    this.tppDistance = 2.65;

    this.keys = {};
    this.isDraggingLook = false;

    this.avatar.group.visible = false;
    this.bindEvents();
  }

  toggleAutoRotate(forceState) {
    if (this.walkMode) {
      this.setWalkMode(false);
    }
    const next = typeof forceState === 'boolean' ? forceState : !this.controls.autoRotate;
    this.controls.autoRotate = next;
    return this.controls.autoRotate;
  }

  setOrbitCenterForTwinMode(isTwinMode) {
    if (this.walkMode) return;
    // Dla pojedynczego segmentu B środek obrotu to Z = -3.04 m, dla całego bliźniaka A+B to oś dylatacji Z = 0.00 m
    const targetZ = isTwinMode ? 0.0 : -3.04;
    this.controls.target.set(-0.8, 3.8, targetZ);
    this.controls.update();
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (e.code === 'KeyP') {
        this.toggleAutopilot();
        return;
      }

      if (!this.walkMode) return;

      if (e.code === 'KeyV') {
        this.toggleNoclip();
      } else if (e.code === 'Escape') {
        this.setWalkMode(false);
        if (this.onWalkExitCallback) this.onWalkExitCallback();
      } else if (e.code === 'Digit0') {
        this.teleportToFloor(0);
      } else if (e.code === 'Digit1') {
        this.teleportToFloor(1);
      } else if (e.code === 'Digit2') {
        this.teleportToFloor(2);
      } else if (e.code === 'Digit3') {
        this.teleportToFloor(3);
      } else if (e.code === 'KeyR') {
        this.teleportToFloor(-1);
      } else if (e.code === 'Space' && this.isGrounded && !this.noclip) {
        this.playerVelY = 4.6;
        this.isGrounded = false;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    this.domElement.addEventListener('mousedown', (e) => {
      if (this.walkMode && e.button === 0) {
        this.isDraggingLook = true;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingLook = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.walkMode && (this.isDraggingLook || document.pointerLockElement === this.domElement)) {
        this.yaw -= e.movementX * 0.0045;
        this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * 0.0038, -0.65, 1.15);
      }
    });

    this.domElement.addEventListener(
      'wheel',
      (e) => {
        if (this.walkMode) {
          e.preventDefault();
          this.tppDistance = THREE.MathUtils.clamp(this.tppDistance + e.deltaY * 0.0025, 0.85, 6.2);
        }
      },
      { passive: false }
    );
  }

  setWalkMode(enabled) {
    this.walkMode = Boolean(enabled);
    this.controls.enabled = !this.walkMode;
    this.avatar.group.visible = this.walkMode;

    if (this.walkMode) {
      this.transition = null;
      this.avatar.group.position.copy(this.playerPos);
      this.notifyHud();
    } else {
      this.autopilot = false;
      this.controls.target.set(this.playerPos.x, this.playerPos.y + 1.4, this.playerPos.z);
      this.camera.position.set(this.playerPos.x + 8.5, this.playerPos.y + 6.5, this.playerPos.z - 8.5);
      this.controls.update();
      this.notifyHud();
    }
  }

  toggleNoclip() {
    this.noclip = !this.noclip;
    this.notifyHud();
    return this.noclip;
  }

  toggleAutopilot() {
    if (!this.walkMode) {
      this.setWalkMode(true);
    }
    this.autopilot = !this.autopilot;
    this.notifyHud();
    return this.autopilot;
  }

  teleportToFloor(floorIndex) {
    this.autopilot = false;
    this.playerVelY = 0;
    this.isGrounded = true;

    switch (floorIndex) {
      case 0: // Ulica / Podziemie (-0.92 m)
        this.playerPos.set(2.8, ELEVATIONS.BASEMENT_FLOOR, -4.1);
        this.yaw = Math.PI * 0.5;
        break;
      case 1: // Parter - Salon i Weranda (+1.60 m)
        this.playerPos.set(-3.2, ELEVATIONS.GROUND_FLOOR, -3.0);
        this.yaw = Math.PI * 0.5;
        break;
      case 2: // I Piętro - Sypialnia główna i Taras (+4.70 m)
        this.playerPos.set(-3.1, ELEVATIONS.FIRST_FLOOR, -3.0);
        this.yaw = Math.PI * 0.5;
        break;
      case 3: // Poddasze / Strych (+7.55 m)
        this.playerPos.set(0.3, ELEVATIONS.ATTIC_FLOOR, -2.5);
        this.yaw = Math.PI * 0.5;
        break;
      default: // Przed wejściem głównym od ulicy frontowej (0.00 m)
        this.playerPos.set(8.5, 0.0, -6.8);
        this.yaw = Math.PI * 0.55;
        break;
    }
    this.notifyHud();
  }

  /**
   * Ustawia kamerę na jeden ze zdefiniowanych presetów architektonicznych (data-cam w index.html)
   */
  setPreset(presetName) {
    if (this.walkMode) {
      this.setWalkMode(false);
    }

    const presets = {
      iso: {
        pos: new THREE.Vector3(18.5, 11.5, -15.5),
        target: new THREE.Vector3(0.0, 3.8, -3.0),
      },
      east: {
        pos: new THREE.Vector3(21.5, 5.2, -3.04),
        target: new THREE.Vector3(0.0, 4.2, -3.04),
      },
      west: {
        pos: new THREE.Vector3(-21.5, 5.8, -3.04),
        target: new THREE.Vector3(-2.0, 4.0, -3.04),
      },
      north: {
        pos: new THREE.Vector3(0.0, 4.8, -19.5),
        target: new THREE.Vector3(0.0, 4.0, -3.0),
      },
      top: {
        pos: new THREE.Vector3(0.0, 29.0, -3.05),
        target: new THREE.Vector3(0.0, 2.0, -3.04),
      },
      section: {
        pos: new THREE.Vector3(0.0, 5.2, -16.5),
        target: new THREE.Vector3(-0.8, 4.2, -2.5),
      },
      stairs: {
        pos: new THREE.Vector3(-0.08, 3.05, -4.45),
        target: new THREE.Vector3(-0.12, 2.75, -1.25),
      },
      boiler: {
        pos: new THREE.Vector3(1.5, 0.9, -2.4),
        target: new THREE.Vector3(3.6, 0.1, -1.4),
      },
    };

    const p = presets[presetName] || presets.iso;
    this.transition = {
      startPos: this.camera.position.clone(),
      endPos: p.pos,
      startTarget: this.controls.target.clone(),
      endTarget: p.target,
      progress: 0,
      duration: 0.85,
    };
  }

  /**
   * Płynne ustawienie kamery lub awatara na konkretne pomieszczenie z ROOMS_SPEC
   */
  focusOnRoom(roomSpec) {
    const lookTarget = new THREE.Vector3(
      roomSpec.lookAt.x,
      roomSpec.lookAt.y,
      roomSpec.lookAt.z
    );

    if (this.walkMode) {
      this.playerPos.set(roomSpec.lookAt.x, roomSpec.elevationY, roomSpec.lookAt.z);
      this.notifyHud();
      return;
    }

    const endPos = new THREE.Vector3(
      roomSpec.lookAt.x + roomSpec.camOffset.x,
      roomSpec.lookAt.y + roomSpec.camOffset.y,
      roomSpec.lookAt.z + roomSpec.camOffset.z
    );

    this.transition = {
      startPos: this.camera.position.clone(),
      endPos,
      startTarget: this.controls.target.clone(),
      endTarget: lookTarget,
      progress: 0,
      duration: 0.75,
    };
  }

  getSurfaceElevationAt(x, z, currentY) {
    // 1. Zjazd do garażu (X od 5.50 do 10.50, Z od -5.45 do -2.85)
    if (x >= 5.50 && x <= 10.50 && z >= -5.50 && z <= -2.50 && currentY < 0.8) {
      const t = (10.50 - x) / 5.00;
      return -t * 0.92;
    }

    // 2. Schody zewnętrzne wejściowe na ganek północny
    if (x >= -0.4 && x <= 3.2 && z >= -8.75 && z <= -5.95 && currentY < 2.5) {
      if (z <= -6.95) {
        const t = THREE.MathUtils.clamp((z - -8.65) / 1.70, 0, 1);
        return t * ELEVATIONS.GROUND_FLOOR;
      }
      return ELEVATIONS.GROUND_FLOOR;
    }

    // 3. Schody zewnętrzne ogrodowe z werandy
    if (x >= -10.60 && x <= -8.15 && z >= -4.20 && z <= -1.75 && currentY < 2.4) {
      const t = THREE.MathUtils.clamp((x - -10.57) / 2.37, 0, 1);
      return t * (ELEVATIONS.GROUND_FLOOR - 0.10);
    }

    // 4. Wewnątrz obrysu budynku (X od -8.20 do +5.50, Z od -6.08 do 0.05)
    const inFootprint = x >= -8.20 && x <= 5.50 && z >= -6.08 && z <= 0.05;
    if (inFootprint) {
      // Klatka schodowa zabiegowa (X od -0.95 do +0.98, Z od -2.92 do -0.38)
      const inStairBox = x >= -0.95 && x <= 0.98 && z >= -2.92 && z <= -0.38;
      if (inStairBox && currentY >= ELEVATIONS.GROUND_FLOOR - 0.3) {
        // Wyznaczamy, na którym biegu (Parter->I Piętro czy I Piętro->Strych) znajduje się awatar
        const isUpperStair = currentY >= ELEVATIONS.FIRST_FLOOR - 0.35 &&
          !(x > 0.02 && z < -1.35 && currentY < ELEVATIONS.FIRST_FLOOR + 0.45);
        const yBase = isUpperStair ? ELEVATIONS.FIRST_FLOOR : ELEVATIONS.GROUND_FLOOR;
        const yTargetTop = isUpperStair ? ELEVATIONS.ATTIC_FLOOR : ELEVATIONS.FIRST_FLOOR;
        const flightRise = yTargetTop - yBase;

        // a) Dolny bieg prosty po zachodniej stronie słupa (X <= 0.02, Z od -2.92 do -1.35)
        if (x <= 0.02 && z < -1.35) {
          const tLower = THREE.MathUtils.clamp((z - -2.89) / (1.54), 0, 1);
          return yBase + tLower * (7 / 18) * flightRise;
        }
        // b) Zabieg wachlarzowy 180° przy ścianie południowej (Z >= -1.35)
        if (z >= -1.35) {
          const ang = Math.atan2(Math.max(0, z - -1.35), -(x - 0.02)); // 0 (Zach.) -> PI/2 (Płd.) -> PI (Wsch.)
          const tWinder = THREE.MathUtils.clamp(ang / Math.PI, 0, 1);
          return yBase + ((7 + tWinder * 8) / 18) * flightRise;
        }
        // c) Górny bieg wyjściowy po wschodniej stronie słupa (X > 0.02, Z od -1.35 do -2.05)
        if (x > 0.02 && z >= -2.05 && z < -1.35) {
          const tUpper = THREE.MathUtils.clamp((-1.35 - z) / 0.66, 0, 1);
          return yBase + ((15 + tUpper * 3) / 18) * flightRise;
        }
      }

      if (currentY >= ELEVATIONS.ATTIC_FLOOR - 0.75) return ELEVATIONS.ATTIC_FLOOR;
      if (currentY >= ELEVATIONS.FIRST_FLOOR - 0.85) return ELEVATIONS.FIRST_FLOOR;
      if (currentY >= ELEVATIONS.GROUND_FLOOR - 0.95) return ELEVATIONS.GROUND_FLOOR;
      return ELEVATIONS.BASEMENT_FLOOR;
    }

    return 0.0;
  }

  notifyHud() {
    if (!this.onHudUpdate) return;

    const y = this.playerPos.y;
    let floorName = 'Teren działki (Segment B)';

    if (this.autopilot) {
      const wp = AUTOPILOT_WAYPOINTS[this.autopilotIdx];
      floorName = wp ? `🎬 ${wp.label}` : '🎬 Trasa Autopilota';
    } else if (
      this.playerPos.x >= -8.25 &&
      this.playerPos.x <= 5.55 &&
      this.playerPos.z >= -6.15 &&
      this.playerPos.z <= 0.1
    ) {
      if (y > 6.5) {
        floorName = 'Poddasze / Strych (+5,95 m)';
      } else if (y > 3.5) {
        floorName =
          this.playerPos.x < -5.5
            ? 'Taras ogrodowy I piętra (15,9 m²)'
            : 'I Piętro – Sypialnie (+3,10 m)';
      } else if (y > 0.6) {
        floorName =
          this.playerPos.x < -5.5
            ? 'Weranda ogrodowa z 1966 r. (14,2 m²)'
            : 'Parter – Salon / Hol (±0,00)';
      } else {
        floorName = 'Podziemie – Garaże i Kotłownia (-2,52 m)';
      }
    }

    this.onHudUpdate({
      floorName,
      elevationText: `Y: ${y >= 0 ? '+' : ''}${y.toFixed(2)} m`,
      noclip: this.noclip,
      autopilot: this.autopilot,
      walkMode: this.walkMode,
    });
  }

  update(dt) {
    if (!this.walkMode) {
      if (this.transition) {
        this.transition.progress += dt / this.transition.duration;
        const t = Math.min(1.0, this.transition.progress);
        const smooth = t * t * (3 - 2 * t);

        this.camera.position.lerpVectors(this.transition.startPos, this.transition.endPos, smooth);
        this.controls.target.lerpVectors(this.transition.startTarget, this.transition.endTarget, smooth);

        if (t >= 1.0) this.transition = null;
      }
      this.controls.update();
      return;
    }

    let moveSpeed = 0;

    if (this.autopilot) {
      const targetWp = AUTOPILOT_WAYPOINTS[this.autopilotIdx];
      const targetVec = new THREE.Vector3(targetWp.x, targetWp.y, targetWp.z);
      const diff = new THREE.Vector3().subVectors(targetVec, this.playerPos);
      const dist = diff.length();

      if (dist < 0.32) {
        this.autopilotIdx = (this.autopilotIdx + 1) % AUTOPILOT_WAYPOINTS.length;
        this.notifyHud();
      } else {
        diff.normalize();
        const step = Math.min(dist, 2.4 * dt);
        this.playerPos.addScaledVector(diff, step);
        this.yaw = Math.atan2(-diff.x, -diff.z);
        moveSpeed = 0.72;
      }
    } else {
      const baseSpeed = this.keys['ShiftLeft'] || this.keys['ShiftRight'] ? 5.6 : 2.85;
      const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

      const moveVec = new THREE.Vector3();
      if (this.keys['KeyW'] || this.keys['ArrowUp']) moveVec.add(forward);
      if (this.keys['KeyS'] || this.keys['ArrowDown']) moveVec.sub(forward);
      if (this.keys['KeyD'] || this.keys['ArrowRight']) moveVec.add(right);
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveVec.sub(right);

      if (moveVec.lengthSq() > 0) {
        moveVec.normalize();
        this.playerPos.addScaledVector(moveVec, baseSpeed * dt);
        moveSpeed = baseSpeed / 3.2;
      }

      if (this.noclip) {
        if (this.keys['Space']) this.playerPos.y += baseSpeed * 0.75 * dt;
        if (this.keys['KeyC']) this.playerPos.y -= baseSpeed * 0.75 * dt;
        this.isGrounded = true;
      } else {
        const targetGroundY = this.getSurfaceElevationAt(
          this.playerPos.x,
          this.playerPos.z,
          this.playerPos.y
        );

        if (this.isGrounded) {
          this.playerPos.y = THREE.MathUtils.lerp(this.playerPos.y, targetGroundY, Math.min(1, dt * 14));
        } else {
          this.playerVelY -= 12.5 * dt;
          this.playerPos.y += this.playerVelY * dt;
          if (this.playerPos.y <= targetGroundY) {
            this.playerPos.y = targetGroundY;
            this.playerVelY = 0;
            this.isGrounded = true;
          }
        }
      }
    }

    this.avatar.group.position.copy(this.playerPos);
    this.avatar.group.rotation.y = this.yaw + Math.PI;
    this.avatar.update(dt, moveSpeed, this.isGrounded);

    const shoulderTarget = new THREE.Vector3(
      this.playerPos.x,
      this.playerPos.y + 1.58,
      this.playerPos.z
    );

    const camOffset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch) * this.tppDistance,
      Math.sin(this.pitch) * this.tppDistance,
      Math.cos(this.yaw) * Math.cos(this.pitch) * this.tppDistance
    );

    this.camera.position.copy(shoulderTarget).add(camOffset);
    this.camera.lookAt(shoulderTarget);
    this.notifyHud();
  }
}
