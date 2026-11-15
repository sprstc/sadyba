/**
 * src/core/CameraManager.js
 * Zarządzanie kamerą OrbitControls, presetami architektonicznymi oraz trybem spaceru 3D:
 * - Kolizje trójkątnej siatki Octree + Kapsuła gracza (r = 0.21 m, płynne ślizganie po ścianach),
 * - Auto-Step-Up (0.27 m) i płynne schodzenie w dół po schodach zabiegowych (0.28 m),
 * - Domyślny widok pierwszoosobowy (FPP) + płynne przełączanie [C] / kółko myszy do TPP za ramię,
 * - Pointer Lock (1:1 celowanie myszą po kliknięciu w scenę) + zapasowy obrót przeciąganiem/dotykiem,
 * - Kucanie [Ctrl] / [X] (1.72 m -> 1.12 m) z detekcją sufitu/skosu poddasza przed wstaniem,
 * - Interaktywne drzwi [E] / Auto-drzwi (DoorManager) oraz kroki audio (WalkSoundEngine).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { ELEVATIONS, AUTOPILOT_WAYPOINTS } from '../data/houseSpec.js';
import { WalkSoundEngine } from './WalkSoundEngine.js';

const CAPSULE_RADIUS = 0.21;
const STAND_HEIGHT = 1.72;
const CROUCH_HEIGHT = 1.12;
const STAND_EYE = 1.62;
const CROUCH_EYE = 1.02;
const STEP_HEIGHT = 0.27;
const DOWN_SNAP = 0.28;
const GRAVITY = 18.0;
const JUMP_VEL = 4.65;

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _normalTmp = new THREE.Vector3();
const _horizPush = new THREE.Vector3();
const _rayHit = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);

export class CameraManager {
  constructor(camera, domElement, humanAvatar, onHudUpdate) {
    this.camera = camera;
    this.domElement = domElement;
    this.avatar = humanAvatar;
    this.onHudUpdate = onHudUpdate;

    this.soundEngine = new WalkSoundEngine();
    this.doorManager = null;

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

    // Stan trybu spaceru (FPP domyślnie + TPP na [C] / scroll)
    this.walkMode = false;
    this.firstPerson = true;
    this.noclip = false;
    this.autopilot = false;
    this.autopilotIdx = 0;

    this.playerPos = new THREE.Vector3(8.5, 0.0, -6.8);
    this.playerVelY = 0;
    this.isGrounded = true;
    this.isCrouching = false;
    this.crouchToggled = false;
    this.currentEyeHeight = STAND_EYE;
    this.stepSmoothOffsetY = 0;
    this.walkBobPhase = 0;

    this.yaw = Math.PI * 0.55;
    this.avatarYaw = this.yaw + Math.PI;
    this.pitch = 0.0;
    this.tppDistance = 1.85;
    this.currentTppDist = 1.85;
    this.avatarRadius = CAPSULE_RADIUS;

    // Drzewo kolizji Octree oraz stan audio/drzwi
    this.worldOctree = null;
    this.isTwinMode = false;
    this.currentDoorPrompt = '';
    this.interactableDoor = null;
    this.currentSurface = 'concrete';
    this.stepDistAccum = 0;
    this.lastAirPeakVelY = 0;

    // Kapsuły i wektory robocze bez alokacji w pętli 60 Hz
    this._capsule = new Capsule(
      new THREE.Vector3(8.5, CAPSULE_RADIUS, -6.8),
      new THREE.Vector3(8.5, STAND_HEIGHT - CAPSULE_RADIUS, -6.8),
      CAPSULE_RADIUS
    );
    this._stepCap = new Capsule();
    this._snapCap = new Capsule();
    this._standCap = new Capsule();

    this._ray = new THREE.Ray();
    this._rayTris = [];
    this._lookDir = new THREE.Vector3();
    this._forwardXZ = new THREE.Vector3();
    this._rightXZ = new THREE.Vector3();
    this._moveDir = new THREE.Vector3();
    this._boomDir = new THREE.Vector3();
    this._eyePos = new THREE.Vector3();
    this._shoulderPivot = new THREE.Vector3();
    this._camTarget = new THREE.Vector3();

    this.keys = {};
    this.isDraggingLook = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.pointerLocked = false;
    this._lastHudEmit = 0;
    this._lastHudSig = '';

    this.avatar.group.visible = false;
    this.bindEvents();
  }

  setDoorManager(doorManager) {
    this.doorManager = doorManager;
    if (this.doorManager) {
      this.doorManager.setSoundEngine(this.soundEngine);
    }
  }

  /**
   * Ustawia trójkątne drzewo kolizji Octree całej sceny
   */
  setColliders({ worldOctree = null, isTwinMode = false } = {}) {
    this.worldOctree = worldOctree;
    this.isTwinMode = Boolean(isTwinMode);

    if (this.walkMode && !this.noclip && this.worldOctree) {
      this._syncCapsuleToPlayer();
      this._resolveCapsuleWorld(this._capsule, true);
      this._syncPlayerToCapsule();
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
    this.isTwinMode = Boolean(isTwinMode);
    if (this.walkMode) return;
    const targetZ = isTwinMode ? 0.0 : -3.04;
    this.controls.target.set(-0.8, 3.8, targetZ);
    this.controls.update();
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const archiveDialog = document.getElementById('archive-modal');
      if (archiveDialog && archiveDialog.open) return;

      this.keys[e.code] = true;

      if (e.code === 'KeyP' && !e.repeat) {
        this.toggleAutopilot();
        return;
      }

      if (!this.walkMode) return;

      if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      if (e.code === 'KeyV' && !e.repeat) {
        this.toggleNoclip();
      } else if (e.code === 'KeyC' && !e.repeat) {
        this.togglePerspective();
      } else if (e.code === 'KeyX' && !e.repeat) {
        this.toggleCrouch();
      } else if (e.code === 'KeyE' && !e.repeat) {
        this.interactWithDoor();
      } else if (e.code === 'KeyM' && !e.repeat) {
        this.toggleAudioMute();
      } else if (e.code === 'Escape' && !e.repeat) {
        this.setWalkMode(false);
        if (this.onWalkExitCallback) this.onWalkExitCallback();
      } else if (e.code === 'Digit0' && !e.repeat) {
        this.teleportToFloor(0);
      } else if (e.code === 'Digit1' && !e.repeat) {
        this.teleportToFloor(1);
      } else if (e.code === 'Digit2' && !e.repeat) {
        this.teleportToFloor(2);
      } else if (e.code === 'Digit3' && !e.repeat) {
        this.teleportToFloor(3);
      } else if (e.code === 'KeyR' && !e.repeat) {
        this.teleportToFloor(-1);
      } else if (e.code === 'Space' && this.isGrounded && !this.noclip) {
        this.soundEngine.unlock();
        this.playerVelY = JUMP_VEL;
        this.isGrounded = false;
        this.lastAirPeakVelY = 0;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('blur', () => {
      this.keys = {};
      this.isDraggingLook = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.domElement;
      this.notifyHud(true);
    });

    this.domElement.addEventListener('pointerdown', (e) => {
      if (!this.walkMode) return;
      this.soundEngine.unlock();

      if (e.button === 0 && e.pointerType === 'mouse' && document.pointerLockElement !== this.domElement) {
        try {
          const p = this.domElement.requestPointerLock?.();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (_) {
          // Zapasowe sterowanie przez przeciąganie pozostaje aktywne
        }
      }

      if (e.button === 0 || e.pointerType === 'touch') {
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
      const sensX = 0.0024;
      const sensY = 0.0022;

      if (document.pointerLockElement === this.domElement) {
        this.yaw -= e.movementX * sensX;
        this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * sensY, -1.22, 1.22);
      } else if (this.isDraggingLook) {
        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        this.yaw -= dx * 0.0036;
        this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0032, -1.22, 1.22);
      }
    });

    this.domElement.addEventListener(
      'wheel',
      (e) => {
        if (!this.walkMode) return;
        e.preventDefault();

        if (this.firstPerson) {
          if (e.deltaY > 0) {
            this.firstPerson = false;
            this.tppDistance = 1.05;
            this.currentTppDist = 0.72;
            this.notifyHud(true);
          }
        } else {
          const nextDist = this.tppDistance + e.deltaY * 0.0022;
          if (nextDist < 0.72) {
            this.firstPerson = true;
            this.notifyHud(true);
          } else {
            this.tppDistance = THREE.MathUtils.clamp(nextDist, 0.72, 4.50);
          }
        }
      },
      { passive: false }
    );
  }

  setWalkMode(enabled) {
    const next = Boolean(enabled);
    const wasWalk = this.walkMode;
    this.walkMode = next;
    this.controls.enabled = !next;
    this.avatar.group.visible = next;

    if (next) {
      this.transition = null;
      this.soundEngine.unlock();
      if (!wasWalk) {
        // Domyślnie uruchamiamy widok pierwszoosobowy FPP (przełączany [C] -> TPP)
        this.firstPerson = true;
        this.pitch = 0.0;
        this.isCrouching = false;
        this.crouchToggled = false;
        this.currentEyeHeight = STAND_EYE;
        this.stepSmoothOffsetY = 0;
        this.playerVelY = 0;
      }
      this.camera.near = 0.06;
      this.camera.updateProjectionMatrix();

      if (!this.noclip && this.worldOctree) {
        this._syncCapsuleToPlayer();
        this._resolveCapsuleWorld(this._capsule, true);
        this._syncPlayerToCapsule();
        this._snapToFloorBelow(0.60);
      }

      this.avatarYaw = this.yaw + Math.PI;
      this.avatar.group.position.copy(this.playerPos);
      this.notifyHud(true);
    } else {
      this.autopilot = false;
      this.isDraggingLook = false;
      this.currentDoorPrompt = '';
      this.interactableDoor = null;

      if (document.pointerLockElement === this.domElement) {
        try {
          document.exitPointerLock?.();
        } catch (_) {
          // ignore
        }
      }

      this.camera.near = 0.06;
      this.camera.updateProjectionMatrix();
      this.controls.target.set(this.playerPos.x, this.playerPos.y + 1.4, this.playerPos.z);
      this.camera.position.set(this.playerPos.x + 8.5, this.playerPos.y + 6.5, this.playerPos.z - 8.5);
      this.controls.update();
      this.notifyHud(true);
    }
  }

  togglePerspective() {
    return this.setFirstPerson(!this.firstPerson);
  }

  setFirstPerson(enabled) {
    this.firstPerson = Boolean(enabled);
    if (!this.firstPerson) {
      this.tppDistance = THREE.MathUtils.clamp(this.tppDistance, 0.95, 4.5);
      this.currentTppDist = Math.min(this.currentTppDist, this.tppDistance);
    }
    this.notifyHud(true);
    return this.firstPerson;
  }

  toggleCrouch() {
    if (this.noclip) return false;
    if (this.isCrouching || this.crouchToggled) {
      if (this._canStandUp()) {
        this.crouchToggled = false;
        this.isCrouching = false;
      }
    } else {
      this.crouchToggled = true;
      this.isCrouching = true;
    }
    this.notifyHud(true);
    return this.isCrouching;
  }

  toggleAutoDoors() {
    if (!this.doorManager) return false;
    const next = this.doorManager.toggleAutoOpen();
    this.notifyHud(true);
    return next;
  }

  toggleAudioMute() {
    const muted = this.soundEngine.toggleMuted();
    this.notifyHud(true);
    return muted;
  }

  interactWithDoor() {
    if (!this.walkMode || this.noclip || !this.doorManager) return false;
    if (this.interactableDoor) {
      this.soundEngine.unlock();
      this.doorManager.toggleDoor(this.interactableDoor);
      this.notifyHud(true);
      return true;
    }
    return false;
  }

  toggleNoclip() {
    this.noclip = !this.noclip;
    if (!this.noclip && this.worldOctree) {
      this._syncCapsuleToPlayer();
      this._resolveCapsuleWorld(this._capsule, true);
      this._syncPlayerToCapsule();
    } else if (this.noclip) {
      this.isCrouching = false;
      this.crouchToggled = false;
    }
    this.notifyHud(true);
    return this.noclip;
  }

  toggleAutopilot() {
    if (!this.walkMode) {
      this.setWalkMode(true);
    }
    this.autopilot = !this.autopilot;
    this.notifyHud(true);
    return this.autopilot;
  }

  teleportToFloor(floorIndex) {
    this.autopilot = false;
    this.playerVelY = 0;
    this.isGrounded = true;
    this.stepSmoothOffsetY = 0;

    switch (floorIndex) {
      case 0: // Podziemie / Kotłownia (-0.92 m)
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

    this.pitch = 0.0;
    this.avatarYaw = this.yaw + Math.PI;
    if (!this.noclip && this.worldOctree) {
      this._syncCapsuleToPlayer();
      this._resolveCapsuleWorld(this._capsule, true);
      this._syncPlayerToCapsule();
    }
    this.notifyHud(true);
  }

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

  focusOnRoom(roomSpec) {
    const lookTarget = new THREE.Vector3(
      roomSpec.lookAt.x,
      roomSpec.lookAt.y,
      roomSpec.lookAt.z
    );

    if (this.walkMode) {
      this.autopilot = false;
      this.playerVelY = 0;
      this.isGrounded = true;
      this.stepSmoothOffsetY = 0;
      this.playerPos.set(roomSpec.lookAt.x, roomSpec.elevationY, roomSpec.lookAt.z);
      if (!this.noclip && this.worldOctree) {
        this._syncCapsuleToPlayer();
        this._resolveCapsuleWorld(this._capsule, true);
        this._syncPlayerToCapsule();
      }
      this.notifyHud(true);
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

  _activeCapsuleHeight() {
    return this.isCrouching ? CROUCH_HEIGHT : STAND_HEIGHT;
  }

  _syncCapsuleToPlayer(cap = this._capsule, height = this._activeCapsuleHeight()) {
    cap.radius = CAPSULE_RADIUS;
    cap.start.set(this.playerPos.x, this.playerPos.y + CAPSULE_RADIUS, this.playerPos.z);
    cap.end.set(this.playerPos.x, this.playerPos.y + height - CAPSULE_RADIUS, this.playerPos.z);
  }

  _syncPlayerToCapsule(cap = this._capsule) {
    this.playerPos.x = THREE.MathUtils.clamp(cap.start.x, -24.0, 24.0);
    this.playerPos.y = Math.max(-2.0, cap.start.y - CAPSULE_RADIUS);
    this.playerPos.z = THREE.MathUtils.clamp(cap.start.z, -14.0, 14.0);
  }

  _canStandUp() {
    if (!this.worldOctree) return true;
    this._standCap.radius = CAPSULE_RADIUS;
    this._standCap.start.set(this.playerPos.x, this.playerPos.y + CAPSULE_RADIUS + 0.02, this.playerPos.z);
    this._standCap.end.set(this.playerPos.x, this.playerPos.y + STAND_HEIGHT - CAPSULE_RADIUS, this.playerPos.z);

    const hit = this.worldOctree.capsuleIntersect(this._standCap);
    if (!hit || hit.depth < 0.015) return true;
    // Blokuj wstanie tylko jeśli przeszkoda ciśnie od góry (sufit / skos poddasza / jętka / nadproże)
    if (hit.normal.y < -0.22) return false;

    // Dla bocznej ściany skosu dachowego sprawdź czy po odsunięciu nadal brakuje prześwitu w górze
    _v1.copy(hit.normal).multiplyScalar(hit.depth);
    this._standCap.translate(_v1);
    const hit2 = this.worldOctree.capsuleIntersect(this._standCap);
    return !hit2 || hit2.depth < 0.015 || hit2.normal.y >= -0.22;
  }

  /**
   * Rozwiązuje kolizje kapsuły ze drzwiami oraz trójkątami Octree.
   * Zwraca flagę napotkania pionowej ściany lub kontaktu z sufitem/podłożem.
   */
  _resolveCapsuleWorld(cap, allowVerticalFloorPush = true, iterations = 3) {
    let hitWall = false;
    let hitFloor = false;
    let hitCeiling = false;

    for (let it = 0; it < iterations; it++) {
      let moved = false;

      if (this.doorManager) {
        const doorNormal = this.doorManager.resolveCapsuleCollision(cap);
        if (doorNormal) {
          hitWall = true;
          moved = true;
        }
      }

      if (this.worldOctree) {
        const hit = this.worldOctree.capsuleIntersect(cap);
        if (hit && hit.depth > 1e-6) {
          _normalTmp.copy(hit.normal);
          if (_normalTmp.y >= 0.56) {
            if (allowVerticalFloorPush) {
              cap.translate(_v1.copy(_normalTmp).multiplyScalar(hit.depth));
            }
            hitFloor = true;
          } else if (_normalTmp.y <= -0.35) {
            // Skos dachu / sufit: pchnięcie wzdłuż normalnej wypycha głowę spod skosu bez zacinek
            cap.translate(_v1.copy(_normalTmp).multiplyScalar(hit.depth));
            hitCeiling = true;
            if (Math.hypot(_normalTmp.x, _normalTmp.z) > 0.35) {
              hitWall = true;
            }
          } else {
            // Pionowa ściana / futryna / stopień: wyłącznie płaski ślizg w XZ
            _horizPush.set(_normalTmp.x, 0, _normalTmp.z);
            const hLen = _horizPush.length();
            if (hLen > 1e-6) {
              _horizPush.multiplyScalar(hit.depth / hLen);
              cap.translate(_horizPush);
              hitWall = true;
            }
          }
          moved = true;
        }
      }

      if (!moved) break;
    }

    return { hitWall, hitFloor, hitCeiling };
  }

  /**
   * Próbuje płynnie wejść po stopniu (do 0.27 m) gdy ruch poziomy na ziemi został zablokowany przez podstopnicę.
   */
  _tryStepUp(baseCap, dx, dz, normalMovedSq) {
    if (!this.worldOctree) return false;

    const oldY = baseCap.start.y - CAPSULE_RADIUS;
    const stepCap = this._stepCap;
    stepCap.copy(baseCap);

    // 1. Podnieś testową kapsułę o STEP_HEIGHT z poszanowaniem prześwitu sufitu / skosu
    stepCap.translate(_v1.set(0, STEP_HEIGHT, 0));
    const ceilCheck = this.worldOctree.capsuleIntersect(stepCap);
    if (ceilCheck && ceilCheck.depth > 1e-5) {
      if (ceilCheck.normal.y < -0.25) {
        stepCap.translate(_v1.copy(ceilCheck.normal).multiplyScalar(ceilCheck.depth));
      }
    }

    const liftedY = stepCap.start.y - baseCap.start.y;
    if (liftedY < 0.08) return false;

    // 2. Przesuń w poziomie na nowej wysokości i usuń ewentualne kolizje ze ścianami/drzwiami
    stepCap.translate(_v1.set(dx, 0, dz));
    const res = this._resolveCapsuleWorld(stepCap, true, 3);

    const stepMovedSq =
      (stepCap.start.x - baseCap.start.x) ** 2 +
      (stepCap.start.z - baseCap.start.z) ** 2;

    // Musi dać zauważalnie większy postęp poziomy niż zwykłe pchnięcie po ziemi
    if (stepMovedSq <= normalMovedSq * 1.15 + 1e-6) {
      return false;
    }

    // 3. Opuść kapsułę w dół w poszukiwaniu stopnia/podestu pod stopami
    const maxDrop = liftedY + 0.02;
    const slices = 8;
    const dySlice = maxDrop / slices;
    let landed = false;

    for (let s = 0; s < slices; s++) {
      stepCap.translate(_v1.set(0, -dySlice, 0));
      const hit = this.worldOctree.capsuleIntersect(stepCap);
      if (hit && hit.depth > 1e-6) {
        _normalTmp.copy(hit.normal);
        stepCap.translate(_v1.copy(_normalTmp).multiplyScalar(hit.depth));
        if (_normalTmp.y >= 0.56) {
          landed = true;
          break;
        }
      }
    }

    if (!landed) return false;

    const newY = stepCap.start.y - CAPSULE_RADIUS;
    const climbY = newY - oldY;
    if (climbY < 0.015 || climbY > STEP_HEIGHT + 0.025) return false;

    // 4. Bezpieczna weryfikacja prześwitu głowy po wylądowaniu na stopniu (unikaj wciśnięcia w skos)
    const verify = this.worldOctree.capsuleIntersect(stepCap);
    if (verify && verify.depth > 0.015 && verify.normal.y < -0.25 && res.hitCeiling) {
      return false;
    }

    this._capsule.copy(stepCap);
    this.stepSmoothOffsetY = THREE.MathUtils.clamp(
      this.stepSmoothOffsetY + (oldY - newY),
      -0.35,
      0.35
    );
    return true;
  }

  /**
   * Przyciąga postać w dół do kolejnego stopnia podczas schodzenia ze schodów (bez mikrolotów).
   */
  _snapToFloorBelow(maxSnapDist = DOWN_SNAP) {
    if (!this.worldOctree) return false;

    const oldY = this._capsule.start.y - CAPSULE_RADIUS;
    const snapCap = this._snapCap;
    snapCap.copy(this._capsule);

    const slices = 8;
    const slice = maxSnapDist / slices;
    for (let s = 0; s < slices; s++) {
      snapCap.translate(_v1.set(0, -slice, 0));
      const hit = this.worldOctree.capsuleIntersect(snapCap);
      if (hit && hit.depth > 1e-6) {
        _normalTmp.copy(hit.normal);
        if (_normalTmp.y >= 0.56) {
          snapCap.translate(_v1.copy(_normalTmp).multiplyScalar(hit.depth));
          const newY = snapCap.start.y - CAPSULE_RADIUS;
          this._capsule.copy(snapCap);
          this.isGrounded = true;
          this.playerVelY = 0;
          this.stepSmoothOffsetY = THREE.MathUtils.clamp(
            this.stepSmoothOffsetY + (oldY - newY),
            -0.35,
            0.35
          );
          return true;
        }
        return false;
      }
    }

    return false;
  }

  _stepPhysics(dt, moveDirXZ, speedMag) {
    this._syncCapsuleToPlayer();

    if (this.noclip) {
      const vertSpeed = this.keys['Space'] ? speedMag * 0.75 : (this.keys['ControlLeft'] || this.keys['ControlRight'] || this.keys['KeyQ'] ? -speedMag * 0.75 : 0);
      this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x + moveDirXZ.x * speedMag * dt, -28, 28);
      this.playerPos.y = THREE.MathUtils.clamp(this.playerPos.y + vertSpeed * dt, -4, 24);
      this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z + moveDirXZ.z * speedMag * dt, -18, 18);
      this.isGrounded = true;
      this.playerVelY = 0;
      this.stepSmoothOffsetY = 0;
      return;
    }

    const numSubsteps = Math.max(1, Math.min(6, Math.ceil(dt / (1 / 90))));
    const subDt = dt / numSubsteps;

    for (let step = 0; step < numSubsteps; step++) {
      const wasGrounded = this.isGrounded;
      const dx = moveDirXZ.x * speedMag * subDt;
      const dz = moveDirXZ.z * speedMag * subDt;
      const desiredDistSq = dx * dx + dz * dz;

      // 1. Przejście poziome z Auto-Step-Up
      if (desiredDistSq > 1e-12) {
        const beforeCap = this._snapCap;
        beforeCap.copy(this._capsule);

        this._capsule.translate(_v1.set(dx, 0, dz));
        const resH = this._resolveCapsuleWorld(this._capsule, true, 3);

        const actualDistSq =
          (this._capsule.start.x - beforeCap.start.x) ** 2 +
          (this._capsule.start.z - beforeCap.start.z) ** 2;

        if (wasGrounded && (resH.hitWall || actualDistSq < desiredDistSq * 0.80)) {
          this._tryStepUp(beforeCap, dx, dz, actualDistSq);
        }
      } else {
        this._resolveCapsuleWorld(this._capsule, true, 2);
      }

      // 2. Przejście pionowe (grawitacja / test kontaktu z podłożem)
      if (!wasGrounded || this.playerVelY > 0.01) {
        this.playerVelY -= GRAVITY * subDt;
        if (this.playerVelY < 0) {
          this.lastAirPeakVelY = Math.max(this.lastAirPeakVelY, -this.playerVelY);
        }
      } else {
        this.playerVelY = -0.35;
      }

      const dy = this.playerVelY * subDt;
      this._capsule.translate(_v1.set(0, dy, 0));

      let groundedThisSubstep = false;
      if (this.worldOctree) {
        for (let k = 0; k < 2; k++) {
          const vHit = this.worldOctree.capsuleIntersect(this._capsule);
          if (!vHit || vHit.depth <= 1e-6) break;

          _normalTmp.copy(vHit.normal);
          if (_normalTmp.y >= 0.56) {
            this._capsule.translate(_v1.copy(_normalTmp).multiplyScalar(vHit.depth));
            groundedThisSubstep = true;
            this.playerVelY = 0;
          } else if (_normalTmp.y <= -0.35) {
            this._capsule.translate(_v1.copy(_normalTmp).multiplyScalar(vHit.depth));
            if (this.playerVelY > 0) this.playerVelY = 0;
          } else {
            _horizPush.set(_normalTmp.x, 0, _normalTmp.z);
            const hl = _horizPush.length();
            if (hl > 1e-6) {
              this._capsule.translate(_horizPush.multiplyScalar(vHit.depth / hl));
            }
          }
        }
      }

      this.isGrounded = groundedThisSubstep;

      // 3. Downhill Stair Snap przy schodzeniu po stopniach w dół
      if (!this.isGrounded && wasGrounded && this.playerVelY <= 0) {
        this._snapToFloorBelow(DOWN_SNAP);
      }

      // 4. Siatka awaryjna poniżej rzędnej podziemia
      if (this._capsule.start.y - CAPSULE_RADIUS < -2.0) {
        this._capsule.translate(_v1.set(0, -2.0 - (this._capsule.start.y - CAPSULE_RADIUS), 0));
        this.isGrounded = true;
        this.playerVelY = 0;
      }

      // Dźwięk lądowania z wysoka
      if (this.isGrounded && !wasGrounded && this.lastAirPeakVelY > 2.2) {
        this._detectSurfaceUnderFoot();
        this.soundEngine.playLand(this.currentSurface, this.lastAirPeakVelY);
        this.lastAirPeakVelY = 0;
      } else if (this.isGrounded) {
        this.lastAirPeakVelY = 0;
      }
    }

    this._syncPlayerToCapsule();
  }

  _detectSurfaceUnderFoot() {
    if (!this.worldOctree) return;

    this._ray.origin.set(this.playerPos.x, this.playerPos.y + 0.35, this.playerPos.z);
    this._ray.direction.set(0, -1, 0);

    this._rayTris.length = 0;
    this.worldOctree.getRayTriangles(this._ray, this._rayTris);

    let bestDist = 0.85;
    let surface = this.currentSurface;

    for (let i = 0; i < this._rayTris.length; i++) {
      const tri = this._rayTris[i];
      if (tri.isInvisibleCollider) continue;
      const res = this._ray.intersectTriangle(tri.a, tri.b, tri.c, true, _rayHit);
      if (res) {
        const d = this._ray.origin.y - res.y;
        if (d >= -0.05 && d < bestDist) {
          bestDist = d;
          surface = tri.surfaceType || 'concrete';
        }
      }
    }
    this._rayTris.length = 0;
    this.currentSurface = surface;
  }

  _raycastCameraOcclusion(origin, dir, maxDist, ignoreGlass = true, ignoreInvisible = true) {
    let minDist = maxDist;

    if (this.worldOctree) {
      this._ray.origin.copy(origin);
      this._ray.direction.copy(dir);
      this._rayTris.length = 0;
      this.worldOctree.getRayTriangles(this._ray, this._rayTris);

      for (let i = 0; i < this._rayTris.length; i++) {
        const tri = this._rayTris[i];
        if (ignoreInvisible && tri.isInvisibleCollider) continue;
        if (ignoreGlass && tri.isWindowGlass) continue;

        const res = this._ray.intersectTriangle(tri.a, tri.b, tri.c, false, _rayHit);
        if (res) {
          const d = origin.distanceTo(res);
          if (d > 0.025 && d < minDist) {
            minDist = d;
          }
        }
      }
      this._rayTris.length = 0;
    }

    if (this.doorManager) {
      this._ray.origin.copy(origin);
      this._ray.direction.copy(dir);
      const doorDist = this.doorManager.raycastOcclusion(this._ray, minDist);
      if (doorDist !== null && doorDist < minDist) {
        minDist = doorDist;
      }
    }

    return minDist;
  }

  _updateLookVectors() {
    const cosPitch = Math.cos(this.pitch);
    this._lookDir.set(
      -Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cosPitch
    ).normalize();

    this._forwardXZ.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._rightXZ.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  _updateWalkCamera(dt, horizSpeed) {
    this._updateLookVectors();

    // Płynny bob chodu wyłącznie w FPP na ziemi
    let bobY = 0;
    let bobX = 0;
    if (this.firstPerson && this.isGrounded && !this.noclip && horizSpeed > 0.25) {
      const bobFreq = horizSpeed > 3.2 ? 12.0 : 8.5;
      this.walkBobPhase += dt * bobFreq;
      const amp = this.isCrouching ? 0.012 : 0.022;
      bobY = Math.sin(this.walkBobPhase) * amp;
      bobX = Math.cos(this.walkBobPhase * 0.5) * amp * 0.45;
    }

    const baseEyeY = this.playerPos.y + this.stepSmoothOffsetY + this.currentEyeHeight + bobY;
    this._eyePos.set(
      this.playerPos.x + this._rightXZ.x * bobX,
      baseEyeY,
      this.playerPos.z + this._rightXZ.z * bobX
    );

    if (this.firstPerson) {
      this.currentTppDist = 0;
      this.camera.position.copy(this._eyePos);
      this._camTarget.copy(this._eyePos).addScaledVector(this._lookDir, 8.0);
      this.camera.lookAt(this._camTarget);
      return;
    }

    // Over-the-shoulder TPP: najpierw bezpiecznie wysuń punkt barku w prawo (blokowany przez ściany)
    const desiredShoulderOffset = this.tppDistance > 1.0 ? 0.24 : 0.16;
    const rightHitDist = this.noclip
      ? desiredShoulderOffset
      : this._raycastCameraOcclusion(
          this._eyePos,
          this._rightXZ,
          desiredShoulderOffset + 0.14,
          true,
          true
        ) - 0.14;
    const safeShoulder = Math.max(0, Math.min(desiredShoulderOffset, rightHitDist));

    this._shoulderPivot
      .set(this.playerPos.x, this.playerPos.y + this.stepSmoothOffsetY + this.currentEyeHeight - 0.08, this.playerPos.z)
      .addScaledVector(this._rightXZ, safeShoulder);

    this._boomDir.copy(this._lookDir).negate();

    let maxAllowedDist = this.tppDistance;
    if (!this.noclip) {
      const occDist = this._raycastCameraOcclusion(
        this._shoulderPivot,
        this._boomDir,
        this.tppDistance + 0.18,
        true,
        true
      );
      if (occDist < this.tppDistance + 0.16) {
        maxAllowedDist = Math.max(0.22, occDist - 0.15);
      }
    }

    if (maxAllowedDist <= this.currentTppDist) {
      this.currentTppDist = maxAllowedDist;
    } else {
      this.currentTppDist = THREE.MathUtils.lerp(
        this.currentTppDist,
        maxAllowedDist,
        Math.min(1.0, dt * 11.0)
      );
    }

    this.camera.position.copy(this._shoulderPivot).addScaledVector(this._boomDir, this.currentTppDist);
    this._camTarget.copy(this._shoulderPivot).addScaledVector(this._lookDir, 8.0);
    this.camera.lookAt(this._camTarget);
  }

  notifyHud(force = false) {
    if (!this.onHudUpdate) return;

    const now = performance.now();
    const y = this.playerPos.y;
    const px = this.playerPos.x;
    const pz = this.playerPos.z;

    let floorName = 'Teren działki';
    if (this.autopilot) {
      const wp = AUTOPILOT_WAYPOINTS[this.autopilotIdx];
      floorName = wp ? `🎬 ${wp.label}` : '🎬 Trasa Autopilota';
    } else {
      const inB = px >= -8.25 && px <= 5.55 && pz >= -6.15 && pz <= 0.02;
      const inA = this.isTwinMode && px >= -8.25 && px <= 5.55 && pz > 0.02 && pz <= 6.15;

      if (inB || inA) {
        const segTag = inA ? ' · Seg. A' : '';
        if (y > 6.5) {
          floorName = `Poddasze / Strych (+5,95 m)${segTag}`;
        } else if (y > 3.5) {
          floorName =
            px < -5.5
              ? `Taras ogrodowy I piętra${segTag}`
              : `I Piętro – Sypialnie (+3,10 m)${segTag}`;
        } else if (y > 0.6) {
          floorName =
            px < -5.5
              ? `Weranda ogrodowa z 1966 r.${segTag}`
              : `Parter – Salon / Hol (±0,00)${segTag}`;
        } else {
          floorName = `Podziemie – Garaże i Kotłownia${segTag}`;
        }
      }
    }

    const autoDoors = this.doorManager ? this.doorManager.autoOpen : false;
    const audioMuted = this.soundEngine.muted;
    const elevText = `Y: ${y >= 0 ? '+' : ''}${y.toFixed(2)} m`;
    const sig = `${floorName}|${elevText}|${this.noclip}|${this.autopilot}|${this.walkMode}|${this.firstPerson}|${this.isCrouching}|${autoDoors}|${audioMuted}|${this.currentDoorPrompt}|${this.pointerLocked}`;

    if (!force && sig === this._lastHudSig && now - this._lastHudEmit < 120) {
      return;
    }

    this._lastHudSig = sig;
    this._lastHudEmit = now;

    this.onHudUpdate({
      floorName,
      elevationText: elevText,
      playerY: y,
      noclip: this.noclip,
      autopilot: this.autopilot,
      walkMode: this.walkMode,
      firstPerson: this.firstPerson,
      isCrouching: this.isCrouching,
      autoDoors,
      audioMuted,
      doorPrompt: this.currentDoorPrompt,
      pointerLocked: this.pointerLocked,
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

    // Aktualizacja stanu kucania (hold [Ctrl] lub toggle [X]) z ochroną przed kolizją z niskim stropem
    const wantsCrouch =
      !this.noclip &&
      (this.crouchToggled || Boolean(this.keys['ControlLeft'] || this.keys['ControlRight']));

    if (wantsCrouch && !this.isCrouching) {
      this.isCrouching = true;
    } else if (!wantsCrouch && this.isCrouching) {
      if (this._canStandUp()) {
        this.isCrouching = false;
      }
    }

    const targetEye = this.isCrouching ? CROUCH_EYE : STAND_EYE;
    this.currentEyeHeight = THREE.MathUtils.lerp(
      this.currentEyeHeight,
      targetEye,
      1 - Math.exp(-14 * dt)
    );

    // Wygaszenie pionowego przesunięcia kamery przy wchodzeniu/schodzeniu po stopniach
    this.stepSmoothOffsetY *= Math.exp(-18 * dt);
    if (Math.abs(this.stepSmoothOffsetY) < 0.0008) this.stepSmoothOffsetY = 0;

    let horizSpeed = 0;
    let forwardSpeed = 0;
    let strafeSpeed = 0;
    let isSprinting = false;

    this._updateLookVectors();

    if (this.autopilot) {
      const targetWp = AUTOPILOT_WAYPOINTS[this.autopilotIdx];
      const targetVec = new THREE.Vector3(targetWp.x, targetWp.y, targetWp.z);
      const diff = targetVec.sub(this.playerPos);
      const dist = diff.length();

      if (dist < 0.32) {
        this.autopilotIdx = (this.autopilotIdx + 1) % AUTOPILOT_WAYPOINTS.length;
      } else {
        diff.normalize();
        const step = Math.min(dist, 2.35 * dt);
        this.playerPos.addScaledVector(diff, step);
        this.yaw = Math.atan2(-diff.x, -diff.z);
        this.avatarYaw = this.yaw + Math.PI;
        horizSpeed = 2.35;
        forwardSpeed = 2.35;
        this.isGrounded = true;
      }
    } else {
      const wantsSprint = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
      isSprinting = wantsSprint && !this.isCrouching;
      const moveSpeedTarget = this.isCrouching ? 1.55 : isSprinting ? 4.65 : 2.65;

      this._moveDir.set(0, 0, 0);
      if (this.keys['KeyW'] || this.keys['ArrowUp']) this._moveDir.add(this._forwardXZ);
      if (this.keys['KeyS'] || this.keys['ArrowDown']) this._moveDir.sub(this._forwardXZ);
      if (this.keys['KeyD'] || this.keys['ArrowRight']) this._moveDir.add(this._rightXZ);
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) this._moveDir.sub(this._rightXZ);

      const hasInput = this._moveDir.lengthSq() > 1e-6;
      if (hasInput) {
        this._moveDir.normalize();
      }

      const prevX = this.playerPos.x;
      const prevZ = this.playerPos.z;

      this._stepPhysics(dt, this._moveDir, hasInput ? moveSpeedTarget : 0);

      const realVx = (this.playerPos.x - prevX) / Math.max(dt, 1e-4);
      const realVz = (this.playerPos.z - prevZ) / Math.max(dt, 1e-4);
      horizSpeed = Math.hypot(realVx, realVz);

      this._updateLookVectors();
      forwardSpeed = realVx * this._forwardXZ.x + realVz * this._forwardXZ.z;
      strafeSpeed = realVx * this._rightXZ.x + realVz * this._rightXZ.z;

      // Wyrównanie tułowia awatara z kamerą nad ramieniem
      const targetAvatarYaw = this.yaw + Math.PI;
      let angleDiff = targetAvatarYaw - this.avatarYaw;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.avatarYaw += angleDiff * Math.min(1.0, dt * 16.0);

      // Odgłosy kroków oparte o przebyty dystans i materiał podłoża
      if (!this.noclip && this.isGrounded && horizSpeed > 0.25) {
        const strideLength = this.isCrouching ? 0.56 : isSprinting ? 1.05 : 0.72;
        this.stepDistAccum += horizSpeed * dt;
        if (this.stepDistAccum >= strideLength) {
          this.stepDistAccum -= strideLength;
          this._detectSurfaceUnderFoot();
          const intensity = this.isCrouching ? 0.42 : isSprinting ? 1.0 : 0.72;
          this.soundEngine.playFootstep(this.currentSurface, intensity);
        }
      } else {
        this.stepDistAccum = 0;
      }
    }

    // Aktualizacja awatara GLB przed obliczeniem kamery
    this.avatar.group.position.set(
      this.playerPos.x,
      this.playerPos.y + this.stepSmoothOffsetY,
      this.playerPos.z
    );
    this.avatar.group.rotation.y = this.avatarYaw;

    this._updateWalkCamera(dt, horizSpeed);

    // Wykryj interaktywne drzwi przed graczem [E]
    if (!this.noclip && this.doorManager) {
      this._updateLookVectors();
      const hit = this.doorManager.findInteractableDoor(
        this.playerPos,
        this._eyePos,
        this._lookDir
      );
      this.interactableDoor = hit ? hit.door : null;
      this.currentDoorPrompt = hit ? hit.prompt : '';
    } else {
      this.interactableDoor = null;
      this.currentDoorPrompt = '';
    }

    this.avatar.update(dt, {
      speed: horizSpeed,
      forwardSpeed,
      strafeSpeed,
      isGrounded: this.isGrounded,
      isSprinting,
      isCrouching: this.isCrouching,
      firstPerson: this.firstPerson,
      cameraDist: this.currentTppDist,
    });

    this.notifyHud(false);
  }
}
