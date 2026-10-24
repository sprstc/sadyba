/**
 * src/core/SectionManager.js
 * Zarządzanie dynamicznymi płaszczyznami przekrojowymi (Clipping Planes X, Y, Z)
 * umożliwiającymi wgląd w przekrój A-A (Wschód-Zachód), B-B (Północ-Południe) oraz rzuty kondygnacji.
 */

import * as THREE from 'three';

export class SectionManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.renderer.localClippingEnabled = true;

    // Płaszczyzny tnące skierowane do wnętrza bryły
    this.planeX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 12.0);
    this.planeY = new THREE.Plane(new THREE.Vector3(0, -1, 0), 12.5);
    this.planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 10.5);

    this.limits = {
      xMax: 11.9,
      yMax: 12.4,
      zMin: -10.4,
    };

    this.state = {
      x: 12.0,
      y: 12.5,
      z: -10.5,
    };

    this.updateRendererPlanes();
  }

  setClipX(val) {
    this.state.x = parseFloat(val);
    this.planeX.constant = this.state.x;
    this.updateRendererPlanes();
  }

  setClipY(val) {
    this.state.y = parseFloat(val);
    this.planeY.constant = this.state.y;
    this.updateRendererPlanes();
  }

  setClipZ(val) {
    this.state.z = parseFloat(val);
    // Dla osi Z: przycinamy od północy (-Z) w kierunku południa (+Z), więc normalna = (0, 0, 1), równanie z + c >= 0 -> z >= -c -> c = -z
    this.planeZ.constant = -this.state.z;
    this.updateRendererPlanes();
  }

  resetAll() {
    this.state.x = 12.0;
    this.state.y = 12.5;
    this.state.z = -10.5;
    this.planeX.constant = 12.0;
    this.planeY.constant = 12.5;
    this.planeZ.constant = 10.5;
    this.updateRendererPlanes();
  }

  updateRendererPlanes() {
    const activePlanes = [];
    if (this.state.x < this.limits.xMax) activePlanes.push(this.planeX);
    if (this.state.y < this.limits.yMax) activePlanes.push(this.planeY);
    if (this.state.z > this.limits.zMin) activePlanes.push(this.planeZ);

    this.renderer.clippingPlanes = activePlanes;
  }
}
