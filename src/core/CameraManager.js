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

    // Domyślny widok izometryczny NE (dopasowany do proporcji ekranu mobilnego i desktopowego)
    const aspect = window.innerWidth / (window.innerHeight || 1);
    if (aspect < 1.0) {
      this.camera.fov = 56;
      this.camera.position.set(24.0, 15.0, -20.0);
      this.controls.target.set(0.0, 3.5, -3.0);
    } else {
      this.camera.fov = 46;
      this.camera.position.set(18.5, 11.5, -15.5);
      this.controls.target.set(0.0, 3.8, -3.0);
    }
    this.camera.updateProjectionMatrix();
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
    this.avatarYaw = this.yaw + Math.PI;
    this.pitch = 0.16;
    this.tppDistance = 2.15;
    this.currentTppDist = 2.15;
    this.avatarRadius = 0.255;

    // Dane kolizyjne sceny dla awatara i kamery TPP
    this.avatarBoxes = [];
    this.wallBoxes = [];
    this.cameraMeshes = [];
    this.doorMeshes = [];
    this.camRaycaster = new THREE.Raycaster();
    this._tempRay = new THREE.Ray();
    this._tempBox = new THREE.Box3();
    this._tempHit = new THREE.Vector3();

    this.keys = {};
    this.isDraggingLook = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;

    this.avatar.group.visible = false;
    this.bindEvents();
  }

  /**
   * Ustawia bryły kolizyjne AABB ścian i przeszkód oraz siatki dla Raycastera kamery TPP
   */
  setColliders({ avatarBoxes = [], wallBoxes = [], cameraMeshes = [], doorMeshes = [] } = {}) {
    this.avatarBoxes = avatarBoxes;
    this.wallBoxes = wallBoxes;
    this.cameraMeshes = cameraMeshes;
    this.doorMeshes = doorMeshes;

    if (this.walkMode && !this.noclip) {
      this.resolveAvatarCollisions(this.playerPos);
    }
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

    this.domElement.addEventListener('pointerdown', (e) => {
      if (this.walkMode && (e.button === 0 || e.pointerType === 'touch')) {
        this.isDraggingLook = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      }
    });

    window.addEventListener('pointerup', () => {
      this.isDraggingLook = false;
    });

    window.addEventListener('pointercancel', () => {
      this.isDraggingLook = false;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.walkMode) return;
      if (document.pointerLockElement === this.domElement) {
        this.yaw -= e.movementX * 0.0045;
        this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * 0.0038, -0.58, 1.10);
      } else if (this.isDraggingLook) {
        const dx = typeof e.movementX === 'number' && e.pointerType === 'mouse'
          ? e.movementX
          : e.clientX - this.lastPointerX;
        const dy = typeof e.movementY === 'number' && e.pointerType === 'mouse'
          ? e.movementY
          : e.clientY - this.lastPointerY;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        this.yaw -= dx * 0.0045;
        this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.0038, -0.58, 1.10);
      }
    });

    this.domElement.addEventListener(
      'wheel',
      (e) => {
        if (this.walkMode) {
          e.preventDefault();
          this.tppDistance = THREE.MathUtils.clamp(this.tppDistance + e.deltaY * 0.0025, 0.60, 5.5);
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
      this.camera.near = 0.05;
      this.camera.updateProjectionMatrix();
      if (!this.noclip) {
        this.resolveAvatarCollisions(this.playerPos);
        this.playerPos.y = this.getSurfaceElevationAt(
          this.playerPos.x,
          this.playerPos.z,
          this.playerPos.y
        );
      }
      this.avatarYaw = this.yaw + Math.PI;
      this.avatar.group.position.copy(this.playerPos);
      this.notifyHud();
    } else {
      this.autopilot = false;
      this.camera.near = 0.1;
      this.camera.updateProjectionMatrix();
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
    this.avatarYaw = this.yaw + Math.PI;
    if (!this.noclip) {
      this.resolveAvatarCollisions(this.playerPos);
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
      if (!this.noclip) {
        this.resolveAvatarCollisions(this.playerPos);
      }
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
    // 1. Zjazd do garażu (X od 5.50 do 10.50, Z od -5.60 do -2.70)
    if (x >= 5.50 && x <= 10.50 && z >= -5.60 && z <= -2.70 && currentY < 0.8) {
      const t = THREE.MathUtils.clamp((10.50 - x) / 5.00, 0, 1);
      return -t * 0.92;
    }

    // 2. Schody zewnętrzne wejściowe i podest ganku północnego (Y = 0.00 -> +1.60 m)
    //    Stopnie biegną wzdłuż osi X (od X = +3.47 na dole do X = +0.86 przy podeście), Z od -7.45 do -5.27 m
    if (x >= -0.92 && x <= 3.55 && z >= -7.45 && z <= -5.27 && currentY < 2.6) {
      if (x <= 0.86) {
        return ELEVATIONS.GROUND_FLOOR;
      }
      const t = THREE.MathUtils.clamp((3.47 - x) / (3.47 - 0.86), 0, 1);
      return t * ELEVATIONS.GROUND_FLOOR;
    }

    // 3. Schody zewnętrzne ogrodowe z werandy (w osi drzwi zachodnich Z = -4.925 m: Z od -5.52 do -4.33 m)
    if (x >= -10.65 && x <= -8.15 && z >= -5.52 && z <= -4.33 && currentY < 2.5) {
      if (x >= -8.72) {
        return ELEVATIONS.GROUND_FLOOR - 0.04;
      }
      const t = THREE.MathUtils.clamp((x - -10.57) / (-8.72 - -10.57), 0, 1);
      return t * (ELEVATIONS.GROUND_FLOOR - 0.04);
    }

    // 4. Wewnątrz obrysu budynku (X od -8.20 do +5.50, Z od -6.22 do 0.05)
    const inFootprint = x >= -8.20 && x <= 5.50 && z >= -6.22 && z <= 0.05;
    if (inFootprint) {
      // Klatka schodowa (X od -0.95 do +0.98, Z od -2.92 do -0.38)
      const inStairBox = x >= -0.95 && x <= 0.98 && z >= -2.92 && z <= -0.38;

      if (inStairBox) {
        // A) Schody na Poddasze (I Piętro +4.70 m -> Strych +7.55 m, 14 stopni, bieg dolny od Z = -2.21 m)
        const onAtticStairs =
          currentY >= ELEVATIONS.FIRST_FLOOR - 0.35 &&
          !(x <= 0.02 && z < -2.21 && currentY < ELEVATIONS.FIRST_FLOOR + 0.55) &&
          !(x > 0.02 && z < -1.35 && currentY < ELEVATIONS.FIRST_FLOOR + 0.45);

        if (onAtticStairs) {
          const yBase = ELEVATIONS.FIRST_FLOOR;
          const flightRise = ELEVATIONS.ATTIC_FLOOR - yBase;

          // a) Bieg dolny (4 stopnie: X <= 0.02, Z od -2.21 do -1.35 m)
          if (x <= 0.02 && z >= -2.21 && z < -1.35) {
            const tLower = THREE.MathUtils.clamp((z - -2.21) / (-1.35 - -2.21), 0, 1);
            return yBase + tLower * (4 / 14) * flightRise;
          }
          // b) Zabieg wachlarzowy 180° (8 stopni: Z >= -1.35 m)
          if (z >= -1.35) {
            const ang = Math.atan2(Math.max(0, z - -1.35), -(x - 0.02));
            const tWinder = THREE.MathUtils.clamp(ang / Math.PI, 0, 1);
            return yBase + ((4 + tWinder * 8) / 14) * flightRise;
          }
          // c) Bieg górny wyjściowy (2 stopnie: X > 0.02, Z od -1.35 do -1.85 m)
          if (x > 0.02 && z >= -1.85 && z < -1.35) {
            const tUpper = THREE.MathUtils.clamp((-1.35 - z) / 0.44, 0, 1);
            return yBase + ((12 + tUpper * 2) / 14) * flightRise;
          }
        }

        // B) Schody główne dębowe zabiegowe (Parter +1.60 m -> I Piętro +4.70 m, 18 stopni)
        const onMainStairs =
          currentY >= ELEVATIONS.GROUND_FLOOR - 0.25 &&
          currentY < ELEVATIONS.FIRST_FLOOR + 0.45 &&
          !(x > 0.02 && z >= -1.35 && currentY < ELEVATIONS.GROUND_FLOOR + 0.35);

        if (onMainStairs) {
          const yBase = ELEVATIONS.GROUND_FLOOR;
          const flightRise = ELEVATIONS.FIRST_FLOOR - yBase;

          if (x <= 0.02 && z < -1.35) {
            const tLower = THREE.MathUtils.clamp((z - -2.89) / 1.54, 0, 1);
            return yBase + tLower * (7 / 18) * flightRise;
          }
          if (z >= -1.35) {
            const ang = Math.atan2(Math.max(0, z - -1.35), -(x - 0.02));
            const tWinder = THREE.MathUtils.clamp(ang / Math.PI, 0, 1);
            return yBase + ((7 + tWinder * 8) / 18) * flightRise;
          }
          if (x > 0.02 && z >= -2.05 && z < -1.35) {
            const tUpper = THREE.MathUtils.clamp((-1.35 - z) / 0.66, 0, 1);
            return yBase + ((15 + tUpper * 3) / 18) * flightRise;
          }
        }

        // C) Żelbetowe schody piwniczne (Podziemie -0.92 m <-> Parter +1.60 m, 14 stopni)
        if (currentY < ELEVATIONS.GROUND_FLOOR + 0.35) {
          const yBot = ELEVATIONS.BASEMENT_FLOOR;
          const totalRise = ELEVATIONS.GROUND_FLOOR - yBot; // 2.52 m

          // Prosty bieg północ-południe po stronie zachodniej (X <= 0.02, Z od -2.55 do -1.08 m)
          if (x <= 0.02 && z >= -2.62 && z < -1.08 && currentY < 1.35) {
            const tStraight = THREE.MathUtils.clamp((z - -2.52) / (-1.08 - -2.52), 0, 1);
            return yBot + tStraight * (10 / 14) * totalRise;
          }
          // Górne 4 stopnie zabiegowe pod zabiegiem dębowym (Z >= -1.35 m)
          if (z >= -1.35 && currentY < 2.05) {
            const ang = Math.atan2(Math.max(0, z - -1.35), -(x - 0.02)); // 0 (Zach.) -> PI (Wsch. przy drzwiach)
            const tUpper = THREE.MathUtils.clamp(ang / Math.PI, 0, 1);
            return yBot + ((10 + tUpper * 4) / 14) * totalRise;
          }
        }
      }

      if (currentY >= ELEVATIONS.ATTIC_FLOOR - 0.75) return ELEVATIONS.ATTIC_FLOOR;
      if (currentY >= ELEVATIONS.FIRST_FLOOR - 0.85) return ELEVATIONS.FIRST_FLOOR;
      if (currentY >= ELEVATIONS.GROUND_FLOOR - 0.95) return ELEVATIONS.GROUND_FLOOR;
      return ELEVATIONS.BASEMENT_FLOOR;
    }

    return 0.0;
  }

  /**
   * Zwraca rzędną sufitu nad aktualną kondygnacją (do ograniczenia skoku oraz kamery TPP)
   */
  getCeilingElevationAt(x, z, y) {
    const inMainBuilding = x >= -5.50 && x <= 5.50 && z >= -6.08 && z <= 0.05;
    const inVeranda = x >= -8.20 && x < -5.50 && z >= -6.08 && z <= 0.05;

    if (!inMainBuilding && !inVeranda) return 50.0;

    // Na tarasie I piętra nad werandą przestrzeń jest otwarta do nieba
    if (inVeranda && y >= ELEVATIONS.FIRST_FLOOR - 0.3) return 50.0;

    // W otwartym świetle klatki schodowej sufit jest na poziomie dachu/poddasza
    const inStairwell = x >= -0.95 && x <= 0.98 && z >= -2.35 && z <= -0.38;
    if (inStairwell && y >= ELEVATIONS.GROUND_FLOOR - 0.2) {
      return ELEVATIONS.ROOF_RIDGE - 0.35;
    }

    if (y < ELEVATIONS.GROUND_FLOOR - 0.35) return ELEVATIONS.BASEMENT_CEILING;
    if (y < ELEVATIONS.FIRST_FLOOR - 0.35) return ELEVATIONS.GROUND_CEILING;
    if (y < ELEVATIONS.ATTIC_FLOOR - 0.35) return ELEVATIONS.FIRST_CEILING;
    return ELEVATIONS.ROOF_RIDGE - 0.25;
  }

  /**
   * Kolizja cylindra postaci (wysokość ~1.82 m, szerokość w barkach 0.60 m -> promień bazowy r = 0.295 m,
   * adaptujący się do r = 0.255 m przy ściągnięciu ramion w wąskich przejściach) z bryłami AABB ścian i przeszkód.
   */
  resolveAvatarCollisions(pos) {
    const squeeze = this.avatar && typeof this.avatar.squeezeCurrent === 'number' ? this.avatar.squeezeCurrent : 0;
    const r = 0.295 - squeeze * 0.04;
    const yMin = pos.y + 0.42;
    const yMax = pos.y + 1.78;

    // Ograniczenie do granic działki
    pos.x = THREE.MathUtils.clamp(pos.x, -19.25, 19.0);
    pos.z = THREE.MathUtils.clamp(pos.z, -10.22, 10.22);

    if (!this.avatarBoxes || this.avatarBoxes.length === 0) return;

    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < this.avatarBoxes.length; i++) {
        const box = this.avatarBoxes[i];
        if (box.max.y <= yMin || box.min.y >= yMax) continue;

        const cx = Math.max(box.min.x, Math.min(pos.x, box.max.x));
        const cz = Math.max(box.min.z, Math.min(pos.z, box.max.z));
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const distSq = dx * dx + dz * dz;

        if (distSq < r * r) {
          if (distSq > 1e-8) {
            const dist = Math.sqrt(distSq);
            const pen = r - dist;
            pos.x += (dx / dist) * pen;
            pos.z += (dz / dist) * pen;
          } else {
            // Środek cylindra znalazł się wewnątrz obrysu AABB -> wypchnij przez najbliższą ściankę
            const dMinX = pos.x - box.min.x;
            const dMaxX = box.max.x - pos.x;
            const dMinZ = pos.z - box.min.z;
            const dMaxZ = box.max.z - pos.z;
            const minD = Math.min(dMinX, dMaxX, dMinZ, dMaxZ);

            if (minD === dMinX) pos.x = box.min.x - r;
            else if (minD === dMaxX) pos.x = box.max.x + r;
            else if (minD === dMinZ) pos.z = box.min.z - r;
            else pos.z = box.max.z + r;
          }
        }
      }
    }
  }

  /**
   * Przemieszcza postać w podkrokach (max 4 cm na podkrok), uniemożliwiając przebicie nawet cienkich ścianek działowych (12 cm)
   */
  moveAvatarWithCollisions(moveDelta) {
    if (this.noclip) {
      this.playerPos.add(moveDelta);
      return;
    }

    const totalLen = moveDelta.length();
    if (totalLen <= 1e-6) {
      this.resolveAvatarCollisions(this.playerPos);
      return;
    }

    const maxSubStep = 0.04;
    const subSteps = Math.max(1, Math.ceil(totalLen / maxSubStep));
    const stepX = moveDelta.x / subSteps;
    const stepZ = moveDelta.z / subSteps;

    for (let s = 0; s < subSteps; s++) {
      this.playerPos.x += stepX;
      this.playerPos.z += stepZ;
      this.resolveAvatarCollisions(this.playerPos);
    }
  }

  /**
   * 8-kierunkowy poziomy Raycasting wokół pasa i klatki piersiowej postaci (Y = pos.y + 1.05 m)
   * mierzący odstęp do otaczających ścian i przeszkód:
   * - Przestronnie (Clearance > 1.20 m): szeroki uśmiech 😄, rozluźnione barki i zielony wskaźnik komfortu,
   * - Ciasno / Ścisk (Clearance < 0.65 m z wielu stron): ściągnięte ramiona, skulone barki, grymas 😣,
   *   lekkie drżenie siatki i pływający ostrzegawczy znacznik z dokładną szerokością przejścia w cm.
   */
  evaluateSpaceComfort() {
    if (!this.avatar || typeof this.avatar.setSpaceComfort !== 'function') return;

    if (this.noclip || !this.avatarBoxes || this.avatarBoxes.length === 0) {
      this.avatar.setSpaceComfort('spacious', 200, 0);
      return;
    }

    const originY = this.playerPos.y + 1.05;
    const origin = new THREE.Vector3(this.playerPos.x, originY, this.playerPos.z);
    const maxRange = 3.0;
    const dists = new Array(8).fill(maxRange);

    for (let dirIdx = 0; dirIdx < 8; dirIdx++) {
      const angle = this.avatarYaw + (dirIdx * Math.PI) / 4;
      const dx = Math.sin(angle);
      const dz = Math.cos(angle);

      this._tempRay.origin.copy(origin);
      this._tempRay.direction.set(dx, 0, dz);

      let minHit = maxRange;
      for (let i = 0; i < this.avatarBoxes.length; i++) {
        const box = this.avatarBoxes[i];
        if (box.max.y < this.playerPos.y + 0.55 || box.min.y > this.playerPos.y + 1.72) continue;

        if (box.containsPoint(origin)) {
          minHit = 0.25;
          break;
        }

        const hitPt = this._tempRay.intersectBox(box, this._tempHit);
        if (hitPt) {
          const d = origin.distanceTo(hitPt);
          if (d < minHit) {
            minHit = d;
          }
        }
      }
      dists[dirIdx] = minHit;
    }

    // Analiza 8 promieni: liczba ciasnych kierunków (< 0.65 m) oraz 4 średnice przejścia (przeciwległe pary)
    let tightCount = 0;
    let spaciousCount = 0;
    let minRayDist = maxRange;

    for (let i = 0; i < 8; i++) {
      const d = dists[i];
      if (d < minRayDist) minRayDist = d;
      if (d < 0.65) tightCount++;
      if (d > 1.20) spaciousCount++;
    }

    const pairWidths = [
      dists[0] + dists[4], // Przód - Tył
      dists[1] + dists[5], // Skos 1
      dists[2] + dists[6], // Lewo - Prawo (szerokość korytarza względem barków)
      dists[3] + dists[7], // Skos 2
    ];
    const minPairWidth = Math.min(...pairWidths);

    if (tightCount >= 2 || minPairWidth < 1.18) {
      // Tryb „Squeezed” (Ciasna przestrzeń / wąskie przejście < 65 cm z wielu stron)
      const effectiveWidthMeters = minPairWidth < 1.35 ? minPairWidth : minRayDist * 2.0;
      const clearanceCm = Math.max(45, Math.round(effectiveWidthMeters * 100));
      const squeezeIntensity = THREE.MathUtils.clamp((0.65 - minRayDist) / 0.32, 0.45, 1.0);
      this.avatar.setSpaceComfort('cramped', clearanceCm, squeezeIntensity);
    } else if (minRayDist > 1.20 || (tightCount === 0 && spaciousCount >= 6 && minRayDist > 0.85)) {
      // Tryb „Spacious” (Przestronna / komfortowa przestrzeń > 1.20 m)
      const clearanceCm = Math.round(Math.min(300, minRayDist * 100));
      this.avatar.setSpaceComfort('spacious', clearanceCm, 0);
    } else {
      // Tryb pośredni („Normal”)
      const clearanceCm = Math.round(minPairWidth * 100);
      this.avatar.setSpaceComfort('normal', clearanceCm, 0);
    }
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
      playerY: y,
      noclip: this.noclip,
      autopilot: this.autopilot,
      walkMode: this.walkMode,
    });
  }

  /**
   * Wyznacza bezkolizyjną pozycję kamery trzecioosobowej (Spring-Arm / Anti-Wall-Clip),
   * tak aby kamera nigdy nie wchodziła w ściany ani nie chowała postaci za ścianą.
   */
  updateTppCamera(dt) {
    const pivot = new THREE.Vector3(
      this.playerPos.x,
      this.playerPos.y + 1.50,
      this.playerPos.z
    );

    const camDir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();

    if (this.noclip) {
      this.currentTppDist = this.tppDistance;
      this.camera.position.copy(pivot).addScaledVector(camDir, this.currentTppDist);
      this.camera.lookAt(pivot);
      return;
    }

    let maxAllowedDist = this.tppDistance;
    const minSafeDist = 0.17;
    const camSphereRadius = 0.145;

    // 1. Ciągły Sphere-Cast (Ray vs Expanded AABB) względem wszystkich ścian i okien budynku
    this._tempRay.origin.copy(pivot);
    this._tempRay.direction.copy(camDir);

    for (let i = 0; i < this.wallBoxes.length; i++) {
      const wBox = this.wallBoxes[i];
      if (wBox.max.y < this.playerPos.y + 0.15 || wBox.min.y > this.playerPos.y + 3.2) continue;

      this._tempBox.copy(wBox).expandByScalar(camSphereRadius);

      // Jeśli punkt pivot znalazł się minimalnie w strefie rozszerzonej AABB, nie blokuj promienia wychodzącego na zewnątrz
      if (this._tempBox.containsPoint(pivot)) {
        const shrinkBox = this._tempBox.clone().expandByScalar(-0.08);
        if (shrinkBox.containsPoint(pivot)) {
          maxAllowedDist = Math.min(maxAllowedDist, minSafeDist);
          continue;
        }
      }

      const hitPt = this._tempRay.intersectBox(this._tempBox, this._tempHit);
      if (hitPt) {
        const hitDist = pivot.distanceTo(hitPt);
        if (hitDist < maxAllowedDist) {
          maxAllowedDist = Math.max(minSafeDist, hitDist - 0.02);
        }
      }
    }

    // 2. Ograniczenie od sufitu i podłogi bieżącej kondygnacji (aby kamera przy pochyleniu nie wchodziła w strop Kleina)
    const ceilY = this.getCeilingElevationAt(this.playerPos.x, this.playerPos.z, this.playerPos.y);
    const floorY = this.playerPos.y;
    if (camDir.y > 0.001) {
      const dCeil = (ceilY - 0.16 - pivot.y) / camDir.y;
      if (dCeil >= 0 && dCeil < maxAllowedDist) {
        maxAllowedDist = Math.max(minSafeDist, dCeil);
      }
    } else if (camDir.y < -0.001) {
      const dFloor = (floorY + 0.20 - pivot.y) / camDir.y;
      if (dFloor >= 0 && dFloor < maxAllowedDist) {
        maxAllowedDist = Math.max(minSafeDist, dFloor);
      }
    }

    // 3. Wielopromieniowy Raycast 3D względem widocznych siatek (dachy, spody schodów, stropy)
    if (this.cameraMeshes && this.cameraMeshes.length > 0) {
      const rightVec = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const upVec = new THREE.Vector3().crossVectors(camDir, rightVec).normalize();

      const offsets = [
        [0, 0],
        [-0.10, 0],
        [0.10, 0],
        [0, 0.09],
        [0, -0.09],
      ];

      for (let k = 0; k < offsets.length; k++) {
        const [ox, oy] = offsets[k];
        const rayOrigin = pivot.clone();
        if (ox !== 0 || oy !== 0) {
          rayOrigin.addScaledVector(rightVec, ox).addScaledVector(upVec, oy);
          // Sprawdź, czy przesunięty punkt startowy nie wszedł za ścianę
          let originBlocked = false;
          for (let b = 0; b < this.wallBoxes.length; b++) {
            if (this.wallBoxes[b].containsPoint(rayOrigin)) {
              originBlocked = true;
              break;
            }
          }
          if (originBlocked) continue;
        }

        this.camRaycaster.set(rayOrigin, camDir);
        this.camRaycaster.near = 0.02;
        this.camRaycaster.far = maxAllowedDist + 0.18;

        const hits = this.camRaycaster.intersectObjects(this.cameraMeshes, false);
        if (hits.length > 0) {
          const d = hits[0].distance - 0.16;
          if (d < maxAllowedDist) {
            maxAllowedDist = Math.max(minSafeDist, d);
          }
        }
      }
    }

    // 4. Natychmiastowe przyciągnięcie kamery przy kontakcie ze ścianą i płynne oddalanie na otwartej przestrzeni
    if (maxAllowedDist <= this.currentTppDist) {
      this.currentTppDist = maxAllowedDist;
    } else {
      this.currentTppDist = THREE.MathUtils.lerp(
        this.currentTppDist,
        maxAllowedDist,
        Math.min(1.0, dt * 9.5)
      );
    }

    const camPos = pivot.clone().addScaledVector(camDir, this.currentTppDist);

    // 5. Dodatkowe wypchnięcie sfery kamery (r = 0.14 m) ze ścian bocznych
    const rCam = 0.14;
    for (let i = 0; i < this.wallBoxes.length; i++) {
      const box = this.wallBoxes[i];
      if (camPos.y + rCam <= box.min.y || camPos.y - rCam >= box.max.y) continue;

      const cx = Math.max(box.min.x, Math.min(camPos.x, box.max.x));
      const cz = Math.max(box.min.z, Math.min(camPos.z, box.max.z));
      const dx = camPos.x - cx;
      const dz = camPos.z - cz;
      const distSq = dx * dx + dz * dz;

      if (distSq < rCam * rCam && distSq > 1e-8) {
        const dist = Math.sqrt(distSq);
        const pen = rCam - dist;
        camPos.x += (dx / dist) * pen;
        camPos.z += (dz / dist) * pen;
      }
    }

    // 6. Gdy kamera jest bardzo blisko postaci (np. postać stoi tyłem przy samej ścianie w wąskim korytarzu),
    //    lekko unieś kamerę ponad głowę i skieruj wzrok w dół na barki, aby postać była zawsze widoczna i nieprzesłonięta
    const closeFactor = THREE.MathUtils.clamp((0.68 - this.currentTppDist) / 0.50, 0, 1);
    camPos.y = Math.min(ceilY - 0.12, Math.max(floorY + 0.22, camPos.y + closeFactor * 0.18));

    const lookTarget = new THREE.Vector3(
      this.playerPos.x,
      this.playerPos.y + 1.50 - closeFactor * 0.24,
      this.playerPos.z
    );

    this.camera.position.copy(camPos);
    this.camera.lookAt(lookTarget);
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
        const step = Math.min(dist, 2.35 * dt);
        this.playerPos.addScaledVector(diff, step);
        this.yaw = Math.atan2(-diff.x, -diff.z);
        this.avatarYaw = this.yaw + Math.PI;
        moveSpeed = 0.72;
      }
    } else {
      const baseSpeed = this.keys['ShiftLeft'] || this.keys['ShiftRight'] ? 5.2 : 2.75;
      const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

      const moveVec = new THREE.Vector3();
      if (this.keys['KeyW'] || this.keys['ArrowUp']) moveVec.add(forward);
      if (this.keys['KeyS'] || this.keys['ArrowDown']) moveVec.sub(forward);
      if (this.keys['KeyD'] || this.keys['ArrowRight']) moveVec.add(right);
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveVec.sub(right);

      if (moveVec.lengthSq() > 0) {
        moveVec.normalize();
        const moveDelta = moveVec.clone().multiplyScalar(baseSpeed * dt);
        this.moveAvatarWithCollisions(moveDelta);
        moveSpeed = baseSpeed / 3.2;

        // Płynny obrót postaci w kierunku ruchu
        const targetAvatarYaw = Math.atan2(moveVec.x, moveVec.z);
        let angleDiff = targetAvatarYaw - this.avatarYaw;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.avatarYaw += angleDiff * Math.min(1.0, dt * 14.0);
      } else if (!this.noclip) {
        this.resolveAvatarCollisions(this.playerPos);
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
        const ceilingY = this.getCeilingElevationAt(
          this.playerPos.x,
          this.playerPos.z,
          this.playerPos.y
        );

        if (this.isGrounded) {
          this.playerPos.y = THREE.MathUtils.lerp(this.playerPos.y, targetGroundY, Math.min(1, dt * 14));
        } else {
          this.playerVelY -= 12.5 * dt;
          this.playerPos.y += this.playerVelY * dt;
          // Ograniczenie skoku od stropu nad głową postaci (wys. postaci z kaskiem 1.82 m)
          if (this.playerPos.y + 1.82 > ceilingY) {
            this.playerPos.y = Math.max(targetGroundY, ceilingY - 1.82);
            this.playerVelY = Math.min(0, this.playerVelY);
          }
          if (this.playerPos.y <= targetGroundY) {
            this.playerPos.y = targetGroundY;
            this.playerVelY = 0;
            this.isGrounded = true;
          }
        }
      }
    }

    const isSprinting = Boolean(
      !this.autopilot && (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && moveSpeed > 0.02
    );

    this.evaluateSpaceComfort();

    this.avatar.group.position.copy(this.playerPos);
    this.avatar.group.rotation.y = this.avatarYaw;
    this.avatar.update(dt, moveSpeed, this.isGrounded, isSprinting);

    this.updateTppCamera(dt);
    this.notifyHud();
  }
}
