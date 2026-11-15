/**
 * src/core/DoorManager.js
 * Interaktywny system otwieranych drzwi i bram (Segment B, Otoczenie i lustrzany Segment A):
 * - Animacja zawiasów wokół osi Y z tłumieniem wykładniczym,
 * - Zachowanie stanu otwarcia/zamknięcia między przebudowami (np. zmiana ery 1955/1966 lub warstw),
 * - Interakcja ręczna [E] (raycast wzroku lub bliskość) oraz opcjonalne automatyczne otwieranie (Auto-drzwi),
 * - Precyzyjna kolizja OBB (Oriented Bounding Box) z kapsułą gracza oraz przesłanianiem kamery TPP,
 *   w pełni odporna na lustrzane odbicie Segmentu A (scale.z = -1).
 */

import * as THREE from 'three';

const _vCenter = new THREE.Vector3();
const _vSize = new THREE.Vector3();
const _ux = new THREE.Vector3();
const _uy = new THREE.Vector3();
const _uz = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _boxTemp = new THREE.Box3();
const _doorCenter = new THREE.Vector3();
const _toDoor = new THREE.Vector3();
const _lookXZ = new THREE.Vector3();

export class DoorManager {
  constructor(soundEngine = null) {
    this.soundEngine = soundEngine;
    this.autoOpen = true;
    this.doors = [];
    this.savedStates = new Map(); // klucz: `${segment}:${groupKey}` -> boolean
    this.raycaster = new THREE.Raycaster();
  }

  setSoundEngine(soundEngine) {
    this.soundEngine = soundEngine;
  }

  setAutoOpen(enabled) {
    this.autoOpen = Boolean(enabled);
    return this.autoOpen;
  }

  toggleAutoOpen() {
    return this.setAutoOpen(!this.autoOpen);
  }

  _getSegmentTag(obj) {
    let cur = obj;
    while (cur) {
      if (
        cur.name === 'SegmentA_TwinMirror' ||
        cur.name === 'Surroundings_TwinSegmentA'
      ) {
        return 'A';
      }
      cur = cur.parent;
    }
    return 'B';
  }

  _isHierarchyVisible(obj, scene) {
    let cur = obj;
    while (cur && cur !== scene) {
      if (!cur.visible) return false;
      cur = cur.parent;
    }
    return true;
  }

  /**
   * Zbiera wszystkie zawiasy drzwi (`userData.doorDef`) z widocznych korzeni sceny.
   */
  collectDoors(roots, scene) {
    this.doors = [];
    const grouped = new Map();

    for (const root of roots) {
      if (!root || !root.visible) continue;
      root.updateMatrixWorld(true);

      root.traverse((obj) => {
        if (!obj.userData || !obj.userData.doorDef) return;
        if (!this._isHierarchyVisible(obj, scene)) return;

        const def = obj.userData.doorDef;
        const segment = this._getSegmentTag(obj);
        const groupKey = `${segment}:${def.pairId || def.id}`;

        const leafMeshes = [];
        obj.traverse((child) => {
          if (child.isMesh && child.geometry) {
            child.userData.isInteractiveDoor = true;
            if (!child.geometry.boundingBox) {
              child.geometry.computeBoundingBox();
            }
            leafMeshes.push(child);
          }
        });
        if (leafMeshes.length === 0) return;

        let entry = grouped.get(groupKey);
        if (!entry) {
          const initialOpen = this.savedStates.has(groupKey)
            ? this.savedStates.get(groupKey)
            : Boolean(def.initialOpen);
          this.savedStates.set(groupKey, initialOpen);

          entry = {
            key: groupKey,
            segment,
            label: def.label || 'Drzwi',
            materialType: def.materialType || 'wood',
            isOpen: initialOpen,
            manualCloseCooldownUntil: 0,
            leaves: [],
            allMeshes: [],
            closedBox: new THREE.Box3(),
            worldCenter: new THREE.Vector3(),
            interactionRadius: 1.5,
          };
          grouped.set(groupKey, entry);
          this.doors.push(entry);
        }

        const closedAngle = def.closedAngle ?? 0;
        const openAngle = def.openAngle ?? 1.45;
        const startAngle = entry.isOpen ? openAngle : closedAngle;

        obj.rotation.y = startAngle;
        obj.updateMatrixWorld(true);

        entry.leaves.push({
          pivot: obj,
          closedAngle,
          openAngle,
          currentAngle: startAngle,
          meshes: leafMeshes,
        });
        entry.allMeshes.push(...leafMeshes);
      });
    }

    // Wyznacz zamknięte bryły odniesienia (closedBox) raz przy zbieraniu — stałe względem zawiasu
    for (const door of this.doors) {
      door.closedBox.makeEmpty();
      for (const leaf of door.leaves) {
        const prevRot = leaf.pivot.rotation.y;
        leaf.pivot.rotation.y = leaf.closedAngle;
        leaf.pivot.updateMatrixWorld(true);
        for (const mesh of leaf.meshes) {
          _boxTemp.setFromObject(mesh);
          door.closedBox.union(_boxTemp);
        }
        leaf.pivot.rotation.y = prevRot;
        leaf.pivot.updateMatrixWorld(true);
      }
      door.closedBox.getCenter(door.worldCenter);
      const size = door.closedBox.getSize(_vSize);
      door.interactionRadius = Math.max(1.15, Math.hypot(size.x, size.z) * 0.65 + 0.72);
    }
  }

  /**
   * Ustawia stan otwarcia/zamknięcia logicznych drzwi.
   */
  setDoorOpen(door, nextOpen, isAuto = false) {
    if (!door || door.isOpen === Boolean(nextOpen)) return;
    door.isOpen = Boolean(nextOpen);
    this.savedStates.set(door.key, door.isOpen);

    if (!door.isOpen && !isAuto) {
      door.manualCloseCooldownUntil = performance.now() + 3500;
    } else if (door.isOpen) {
      door.manualCloseCooldownUntil = 0;
    }

    this.soundEngine?.playDoor(door.isOpen, door.materialType);
  }

  toggleDoor(door) {
    if (!door) return false;
    this.setDoorOpen(door, !door.isOpen, false);
    return door.isOpen;
  }

  /**
   * Aktualizuje animację zawiasów oraz opcjonalne automatyczne otwieranie drzwi przed graczem.
   */
  update(dt, playerPos, walkActive = false) {
    if (this.doors.length === 0) return;

    const now = performance.now();

    if (walkActive && this.autoOpen && playerPos) {
      for (let i = 0; i < this.doors.length; i++) {
        const door = this.doors[i];
        if (door.isOpen) continue;
        if (now < door.manualCloseCooldownUntil) continue;

        // Sprawdź kondygnację i bliskość do zamkniętego otworu drzwiowego
        if (
          playerPos.y + 1.65 < door.closedBox.min.y ||
          playerPos.y > door.closedBox.max.y + 0.25
        ) {
          continue;
        }

        const cx = THREE.MathUtils.clamp(playerPos.x, door.closedBox.min.x, door.closedBox.max.x);
        const cz = THREE.MathUtils.clamp(playerPos.z, door.closedBox.min.z, door.closedBox.max.z);
        const distXZ = Math.hypot(playerPos.x - cx, playerPos.z - cz);
        if (distXZ < 1.18) {
          this.setDoorOpen(door, true, true);
        }
      }
    }

    const alpha = 1 - Math.exp(-10.5 * Math.min(dt, 0.05));
    for (let i = 0; i < this.doors.length; i++) {
      const door = this.doors[i];
      for (let j = 0; j < door.leaves.length; j++) {
        const leaf = door.leaves[j];
        const target = door.isOpen ? leaf.openAngle : leaf.closedAngle;
        const diff = target - leaf.currentAngle;
        if (Math.abs(diff) > 0.0015) {
          leaf.currentAngle += diff * alpha;
          leaf.pivot.rotation.y = leaf.currentAngle;
          leaf.pivot.updateMatrixWorld(true);
        } else if (leaf.currentAngle !== target) {
          leaf.currentAngle = target;
          leaf.pivot.rotation.y = target;
          leaf.pivot.updateMatrixWorld(true);
        }
      }
    }
  }

  /**
   * Wyszukuje najbliższe lub celowane wzrokiem drzwi do interakcji klawiszem [E].
   */
  findInteractableDoor(playerPos, eyePos, lookDir) {
    if (this.doors.length === 0 || !playerPos) return null;

    // 1. Priorytet: celownik patrzy wprost na skrzydło drzwi (< 2.4 m)
    if (eyePos && lookDir) {
      const allMeshes = [];
      for (let i = 0; i < this.doors.length; i++) {
        const door = this.doors[i];
        if (door.worldCenter.distanceToSquared(eyePos) > 12.0) continue;
        for (let m = 0; m < door.allMeshes.length; m++) {
          allMeshes.push(door.allMeshes[m]);
        }
      }

      if (allMeshes.length > 0) {
        this.raycaster.set(eyePos, lookDir);
        this.raycaster.near = 0.05;
        this.raycaster.far = 2.45;
        const hits = this.raycaster.intersectObjects(allMeshes, false);
        if (hits.length > 0) {
          const hitMesh = hits[0].object;
          for (let i = 0; i < this.doors.length; i++) {
            if (this.doors[i].allMeshes.includes(hitMesh)) {
              const door = this.doors[i];
              const verb = door.isOpen ? 'Zamknij' : 'Otwórz';
              return { door, prompt: `[E] ${verb}: ${door.label}` };
            }
          }
        }
      }
    }

    // 2. Fallback: najbliższe drzwi w zasięgu ręki z przodu/boku gracza
    _lookXZ.set(lookDir ? lookDir.x : 0, 0, lookDir ? lookDir.z : -1);
    if (_lookXZ.lengthSq() > 1e-6) _lookXZ.normalize();

    let bestDoor = null;
    let bestScore = Infinity;

    for (let i = 0; i < this.doors.length; i++) {
      const door = this.doors[i];
      if (
        playerPos.y + 1.65 < door.closedBox.min.y ||
        playerPos.y > door.closedBox.max.y + 0.35
      ) {
        continue;
      }

      _doorCenter.copy(door.worldCenter);
      const dx = _doorCenter.x - playerPos.x;
      const dz = _doorCenter.z - playerPos.z;
      const distXZ = Math.hypot(dx, dz);
      if (distXZ > door.interactionRadius) continue;

      _toDoor.set(dx, 0, dz);
      if (_toDoor.lengthSq() > 1e-6) _toDoor.normalize();
      const align = _toDoor.dot(_lookXZ);
      if (align < -0.25 && distXZ > 0.75) continue;

      const score = distXZ - align * 0.35;
      if (score < bestScore) {
        bestScore = score;
        bestDoor = door;
      }
    }

    if (!bestDoor) return null;
    const verb = bestDoor.isOpen ? 'Zamknij' : 'Otwórz';
    return { door: bestDoor, prompt: `[E] ${verb}: ${bestDoor.label}` };
  }

  /**
   * Wyznacza światowy środek, ortogonalne osie bazowe i półwymiary OBB siatki skrzydła drzwi.
   */
  _extractMeshOBB(mesh) {
    const geomBox = mesh.geometry.boundingBox;
    if (!geomBox) return null;

    geomBox.getCenter(_vCenter).applyMatrix4(mesh.matrixWorld);
    geomBox.getSize(_vSize);

    const e = mesh.matrixWorld.elements;
    _ux.set(e[0], e[1], e[2]);
    _uy.set(e[4], e[5], e[6]);
    _uz.set(e[8], e[9], e[10]);

    const sx = _ux.length();
    const sy = _uy.length();
    const sz = _uz.length();
    if (sx < 1e-6 || sy < 1e-6 || sz < 1e-6) return null;

    _ux.divideScalar(sx);
    _uy.divideScalar(sy);
    _uz.divideScalar(sz);

    return {
      hx: _vSize.x * sx * 0.5,
      hy: _vSize.y * sy * 0.5,
      hz: _vSize.z * sz * 0.5,
    };
  }

  /**
   * Rozwiązuje kolizję kapsuły gracza z zamkniętymi/domykającymi się skrzydłami drzwi.
   */
  resolveCapsuleCollision(capsule) {
    if (this.doors.length === 0) return null;

    let hitNormal = null;
    const capMinY = Math.min(capsule.start.y, capsule.end.y) - capsule.radius;
    const capMaxY = Math.max(capsule.start.y, capsule.end.y) + capsule.radius;
    const r = capsule.radius;

    for (let i = 0; i < this.doors.length; i++) {
      const door = this.doors[i];
      for (let j = 0; j < door.leaves.length; j++) {
        const leaf = door.leaves[j];
        const span = Math.max(0.1, Math.abs(leaf.openAngle - leaf.closedAngle));
        const openRatio = Math.abs(leaf.currentAngle - leaf.closedAngle) / span;

        // Otwarte lub aktywnie otwierające się skrzydło nie blokuje przejścia
        if ((door.isOpen && openRatio > 0.35) || openRatio > 0.80) {
          continue;
        }

        for (let m = 0; m < leaf.meshes.length; m++) {
          const mesh = leaf.meshes[m];
          const ext = this._extractMeshOBB(mesh);
          if (!ext) continue;

          if (capMaxY <= _vCenter.y - ext.hy + 0.02 || capMinY >= _vCenter.y + ext.hy - 0.02) {
            continue;
          }

          // Sprawdź obrys 2D OBB w płaszczyźnie XZ (skrzydła obracają się wyłącznie wokół osi Y)
          const dx = capsule.start.x - _vCenter.x;
          const dz = capsule.start.z - _vCenter.z;

          const uxLen = Math.hypot(_ux.x, _ux.z) || 1;
          const uxx = _ux.x / uxLen;
          const uxz = _ux.z / uxLen;
          const uzLen = Math.hypot(_uz.x, _uz.z) || 1;
          const uzx = _uz.x / uzLen;
          const uzz = _uz.z / uzLen;

          const lx = dx * uxx + dz * uxz;
          const lz = dx * uzx + dz * uzz;

          const cx = THREE.MathUtils.clamp(lx, -ext.hx, ext.hx);
          const cz = THREE.MathUtils.clamp(lz, -ext.hz, ext.hz);

          const vx = lx - cx;
          const vz = lz - cz;
          const distSq = vx * vx + vz * vz;

          if (distSq >= r * r) continue;

          let pushLx = 0;
          let pushLz = 0;
          if (distSq > 1e-8) {
            const dist = Math.sqrt(distSq);
            const pen = r - dist;
            pushLx = (vx / dist) * pen;
            pushLz = (vz / dist) * pen;
          } else {
            const penX = ext.hx + r - Math.abs(lx);
            const penZ = ext.hz + r - Math.abs(lz);
            if (penX < penZ) {
              pushLx = (lx >= 0 ? 1 : -1) * penX;
            } else {
              pushLz = (lz >= 0 ? 1 : -1) * penZ;
            }
          }

          const pushX = pushLx * uxx + pushLz * uzx;
          const pushZ = pushLx * uxz + pushLz * uzz;
          const pushLen = Math.hypot(pushX, pushZ);
          if (pushLen > 1e-6) {
            capsule.translate(_closest.set(pushX, 0, pushZ));
            if (!hitNormal) hitNormal = new THREE.Vector3();
            hitNormal.set(pushX / pushLen, 0, pushZ / pushLen);
          }
        }
      }
    }

    return hitNormal;
  }

  /**
   * Test przecięcia promienia kamery TPP z pełnymi zamkniętymi skrzydłami drzwi (Slabs OBB test).
   */
  raycastOcclusion(ray, maxDist) {
    if (this.doors.length === 0) return null;
    let minHit = null;

    for (let i = 0; i < this.doors.length; i++) {
      const door = this.doors[i];
      if (door.materialType === 'glass') continue;

      for (let j = 0; j < door.leaves.length; j++) {
        const leaf = door.leaves[j];
        const span = Math.max(0.1, Math.abs(leaf.openAngle - leaf.closedAngle));
        const openRatio = Math.abs(leaf.currentAngle - leaf.closedAngle) / span;
        if (openRatio > 0.78) continue;

        for (let m = 0; m < leaf.meshes.length; m++) {
          const ext = this._extractMeshOBB(leaf.meshes[m]);
          if (!ext) continue;

          _rayOrigin.subVectors(ray.origin, _vCenter);

          let tMin = 0;
          let tMax = maxDist;
          const axes = [_ux, _uy, _uz];
          const halfs = [ext.hx, ext.hy, ext.hz];
          let missed = false;

          for (let a = 0; a < 3; a++) {
            const p = _rayOrigin.dot(axes[a]);
            const d = ray.direction.dot(axes[a]);
            const h = halfs[a];
            if (Math.abs(d) < 1e-7) {
              if (p < -h || p > h) {
                missed = true;
                break;
              }
            } else {
              let t1 = (-h - p) / d;
              let t2 = (h - p) / d;
              if (t1 > t2) {
                const tmp = t1;
                t1 = t2;
                t2 = tmp;
              }
              tMin = Math.max(tMin, t1);
              tMax = Math.min(tMax, t2);
              if (tMin > tMax) {
                missed = true;
                break;
              }
            }
          }

          if (!missed && tMin > 0.02 && tMin < maxDist) {
            if (minHit === null || tMin < minHit) {
              minHit = tMin;
            }
          }
        }
      }
    }

    return minHit;
  }
}
