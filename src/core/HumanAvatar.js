/**
 * src/core/HumanAvatar.js
 * Realistyczny awatar ludzki 3D (Szkielet ReadyPlayerMe GLB + animacje mocap):
 * - Ładuje lokalny model `./src/assets/avatar/avatar.glb` oraz 11 klipów ruchu (Idle, Walk,
 *   WalkBack, Jog, Strafe L/R, Crouch Walk/Back/Strafe L/R, Fall Idle),
 * - Oczyszcza ścieżki Hips.position z przesunięcia sceny mocap (+3.28 m w osi Z)
 *   oraz skaluje wysokość do rzeczywistego wzrostu 1.76 m,
 * - Płynnie miesza animacje (AnimationMixer.crossFadeFrom) oraz dostosowuje tempo kroków do prędkości,
 * - W widoku FPP chowa siatkę postaci; w widoku TPP płynnie rozjaśnia awatara przy zbliżeniu kamery (< 0.65 m).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const AVATAR_ASSET_DIR = './src/assets/avatar';

const ANIM_FILES = {
  idle: 'idle.glb',
  walk: 'walk.glb',
  walk_back: 'walk_back.glb',
  jog: 'jog.glb',
  strafe_left: 'strafe_left.glb',
  strafe_right: 'strafe_right.glb',
  crouch_walk: 'crouch_walk.glb',
  crouch_walk_back: 'crouch_walk_back.glb',
  crouch_strafe_left: 'crouch_strafe_left.glb',
  crouch_strafe_right: 'crouch_strafe_right.glb',
  fall_idle: 'fall_idle.glb',
};

export class HumanAvatar {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'WalkHumanAvatar';

    this.modelRoot = null;
    this.mixer = null;
    this.actions = {};
    this.currentActionName = null;
    this.currentOpacity = 1.0;
    this.airTime = 0;
    this.ready = false;

    this._clonedMaterials = [];
    this._hipsRestPos = new THREE.Vector3(0, 1.019, 0.01);

    // Dyskretna sylwetka zastępcza wyświetlana tylko podczas kilkudziesięciomilisekundowego ładowania GLB
    this.placeholderGroup = this._buildMinimalPlaceholder();
    this.group.add(this.placeholderGroup);

    this._loadPromise = this._loadModelAndAnimations();
  }

  _buildMinimalPlaceholder() {
    const g = new THREE.Group();
    g.name = 'WalkAvatarLoadingSilhouette';
    const mat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.72,
      metalness: 0.08,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.08, 6, 12), mat);
    body.position.y = 0.78;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), mat);
    head.position.y = 1.62;
    head.castShadow = true;
    g.add(body, head);
    return g;
  }

  async _loadModelAndAnimations() {
    const loader = new GLTFLoader();
    const loadGltf = (url, retries = 2) =>
      new Promise((resolve, reject) => {
        const attempt = (remaining) => {
          loader.load(
            url,
            resolve,
            undefined,
            (err) => {
              if (remaining > 0) {
                setTimeout(() => attempt(remaining - 1), 120);
              } else {
                reject(err);
              }
            }
          );
        };
        attempt(retries);
      });

    try {
      const animEntries = Object.entries(ANIM_FILES);
      const [avatarGltf, ...animGltfs] = await Promise.all([
        loadGltf(`${AVATAR_ASSET_DIR}/avatar.glb`),
        ...animEntries.map(([, file]) => loadGltf(`${AVATAR_ASSET_DIR}/${file}`).catch(() => null)),
      ]);

      const model = avatarGltf.scene;
      model.name = 'RealisticHumanGLB';

      // Włącz cienie, wyłącz przedwczesny frustum culling kości i sklonuj materiały pod płynne zanikanie TPP
      const matCache = new Map();
      model.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;

        if (child.material) {
          const cloneOne = (m) => {
            if (matCache.has(m)) return matCache.get(m);
            const c = m.clone();
            c.userData.baseTransparent = Boolean(m.transparent);
            c.userData.baseOpacity = typeof m.opacity === 'number' ? m.opacity : 1.0;
            c.userData.baseDepthWrite = m.depthWrite !== false;
            matCache.set(m, c);
            this._clonedMaterials.push(c);
            return c;
          };
          child.material = Array.isArray(child.material)
            ? child.material.map(cloneOne)
            : cloneOne(child.material);
        }
      });

      // Przeskaluj model dokładnie do wzrostu 1.76 m i postaw podeszwy na Y = 0.000
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      if (size.y > 0.2) {
        const targetHeight = 1.76;
        const scale = targetHeight / size.y;
        model.scale.setScalar(scale);
        model.updateMatrixWorld(true);
        const scaledBox = new THREE.Box3().setFromObject(model);
        model.position.y -= scaledBox.min.y;
      }

      const hipsBone = model.getObjectByName('Hips');
      if (hipsBone) {
        this._hipsRestPos.copy(hipsBone.position);
      }

      // Wyznacz referencyjną wysokość Hips z klatki 0 animacji Idle, aby bezbłędnie przeliczyć kucanie
      let refStandHipsY = 1.0026;
      const idleIdx = animEntries.findIndex(([k]) => k === 'idle');
      const idleGltf = animGltfs[idleIdx];
      if (idleGltf?.animations?.[0]) {
        const hipsTrack = idleGltf.animations[0].tracks.find((t) => t.name.endsWith('Hips.position'));
        if (hipsTrack && hipsTrack.values.length >= 3) {
          refStandHipsY = hipsTrack.values[1] || refStandHipsY;
        }
      }

      this.mixer = new THREE.AnimationMixer(model);

      animEntries.forEach(([key], idx) => {
        const gltf = animGltfs[idx];
        const rawClip = gltf?.animations?.[0];
        if (!rawClip) return;
        const cleanClip = this._sanitizeClip(rawClip.clone(), key, refStandHipsY);
        const action = this.mixer.clipAction(cleanClip);
        action.enabled = true;
        this.actions[key] = action;
      });

      this.modelRoot = model;
      this.group.add(model);

      // Ukryj i zwolnij tymczasową sylwetkę ładowania
      this.placeholderGroup.visible = false;
      this.group.remove(this.placeholderGroup);
      this.placeholderGroup.traverse((c) => {
        if (c.isMesh) {
          c.geometry?.dispose();
          c.material?.dispose();
        }
      });

      if (this.actions.idle) {
        this.actions.idle.play();
        this.currentActionName = 'idle';
      }

      this.ready = true;
    } catch (err) {
      console.warn('Nie udało się załadować modelu awatara GLB, pozostaje sylwetka zastępcza:', err);
    }
  }

  /**
   * Usuwa przesunięcie sceny mocap z kości Hips (+3.28 m w osi Z) oraz zachowuje pionową pracę miednicy (chodzenie / kucanie).
   */
  _sanitizeClip(clip, key, refStandHipsY) {
    clip.name = key;
    const yScale = refStandHipsY > 0.1 ? this._hipsRestPos.y / refStandHipsY : 1.0;

    clip.tracks = clip.tracks.filter((track) => {
      if (track.name.endsWith('.scale')) return false;
      if (track.name.endsWith('Hips.position')) {
        const vals = track.values;
        const x0 = vals.length >= 3 ? vals[0] : 0;
        for (let i = 0; i < vals.length; i += 3) {
          vals[i] = this._hipsRestPos.x + (vals[i] - x0) * 0.18;
          vals[i + 1] = vals[i + 1] * yScale;
          vals[i + 2] = this._hipsRestPos.z;
        }
      }
      return true;
    });

    return clip;
  }

  _switchAction(targetName, fadeDuration = 0.18) {
    if (!this.actions[targetName]) return null;
    if (this.currentActionName === targetName) {
      return this.actions[targetName];
    }

    const prevAction = this.currentActionName ? this.actions[this.currentActionName] : null;
    const nextAction = this.actions[targetName];

    nextAction.enabled = true;
    nextAction.reset();
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);
    nextAction.play();

    if (prevAction && prevAction !== nextAction) {
      prevAction.crossFadeTo(nextAction, fadeDuration, false);
    }

    this.currentActionName = targetName;
    return nextAction;
  }

  _setVisualOpacity(opacity) {
    if (Math.abs(opacity - this.currentOpacity) < 0.01) return;
    this.currentOpacity = opacity;

    const isOpaque = opacity >= 0.99;
    for (let i = 0; i < this._clonedMaterials.length; i++) {
      const m = this._clonedMaterials[i];
      if (isOpaque) {
        m.opacity = m.userData.baseOpacity;
        m.transparent = m.userData.baseTransparent;
        m.depthWrite = m.userData.baseDepthWrite;
      } else {
        m.transparent = true;
        m.depthWrite = false;
        m.opacity = m.userData.baseOpacity * opacity;
      }
    }
  }

  /**
   * Aktualizuje widoczność FPP/TPP, maszynę stanów animacji oraz płynne miksowanie kroków.
   * @param {number} dt
   * @param {Object} state - { speed, forwardSpeed, strafeSpeed, isGrounded, isSprinting, isCrouching, firstPerson, cameraDist }
   */
  update(dt, state = {}) {
    const {
      speed = 0,
      forwardSpeed = 0,
      strafeSpeed = 0,
      isGrounded = true,
      isSprinting = false,
      isCrouching = false,
      firstPerson = false,
      cameraDist = 2.5,
    } = state;

    const visibleInWorld = this.group.visible && !firstPerson;
    if (this.modelRoot) {
      this.modelRoot.visible = visibleInWorld;
    } else {
      this.placeholderGroup.visible = visibleInWorld;
      if (visibleInWorld) {
        this.placeholderGroup.scale.y = isCrouching ? 0.65 : 1.0;
      }
    }

    if (!this.ready || !this.mixer) return;

    // Wygaszenie postaci przy bardzo bliskiej kamerze TPP (np. w ciasnej kabinie WC)
    if (visibleInWorld) {
      const targetOpacity =
        cameraDist < 0.65 ? THREE.MathUtils.clamp((cameraDist - 0.24) / 0.41, 0.0, 1.0) : 1.0;
      this._setVisualOpacity(targetOpacity);
    }

    if (isGrounded) {
      this.airTime = 0;
    } else {
      this.airTime += dt;
    }

    let nextClip = 'idle';
    let targetTimeScale = 1.0;

    if (!isGrounded && this.airTime > 0.14 && this.actions.fall_idle) {
      nextClip = 'fall_idle';
      targetTimeScale = 1.0;
    } else if (isCrouching) {
      if (speed < 0.14) {
        nextClip = 'crouch_walk';
        targetTimeScale = 0.0;
      } else if (forwardSpeed < -0.22 && Math.abs(forwardSpeed) >= Math.abs(strafeSpeed) * 0.85) {
        nextClip = 'crouch_walk_back';
        targetTimeScale = THREE.MathUtils.clamp(speed / 1.45, 0.5, 1.35);
      } else if (Math.abs(strafeSpeed) > Math.abs(forwardSpeed) * 1.15) {
        nextClip = strafeSpeed < 0 ? 'crouch_strafe_left' : 'crouch_strafe_right';
        targetTimeScale = THREE.MathUtils.clamp(speed / 1.45, 0.5, 1.35);
      } else {
        nextClip = 'crouch_walk';
        targetTimeScale = THREE.MathUtils.clamp(speed / 1.45, 0.5, 1.35);
      }
    } else if (speed < 0.12) {
      nextClip = 'idle';
      targetTimeScale = 1.0;
    } else if (forwardSpeed < -0.25 && Math.abs(forwardSpeed) >= Math.abs(strafeSpeed) * 0.85) {
      nextClip = 'walk_back';
      targetTimeScale = THREE.MathUtils.clamp(speed / 2.25, 0.55, 1.45);
    } else if (Math.abs(strafeSpeed) > Math.abs(forwardSpeed) * 1.15) {
      nextClip = strafeSpeed < 0 ? 'strafe_left' : 'strafe_right';
      targetTimeScale = THREE.MathUtils.clamp(speed / 2.35, 0.55, 1.45);
    } else if (isSprinting && speed > 3.35) {
      nextClip = 'jog';
      targetTimeScale = THREE.MathUtils.clamp(speed / 4.45, 0.75, 1.30);
    } else {
      nextClip = 'walk';
      targetTimeScale = THREE.MathUtils.clamp(speed / 2.55, 0.50, 1.40);
    }

    const fadeDur = isSprinting ? 0.14 : 0.20;
    const activeAction = this._switchAction(nextClip, fadeDur);
    if (activeAction) {
      activeAction.setEffectiveTimeScale(targetTimeScale);
    }

    this.mixer.update(Math.min(dt, 0.05));
  }
}
