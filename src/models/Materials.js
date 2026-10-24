/**
 * ============================================================================
 * src/models/Materials.js
 * Centralny Menedżer Materiałów PBR i Tekstur Proceduralnych HTML5 <canvas>.
 * Wszystkie tekstury generowane są w locie w pamięci (100% odporności na 404/CORS),
 * z mapami chropowatości/bump i powtarzaniem (RepeatWrapping).
 * ============================================================================
 */

import * as THREE from 'three';

export class MaterialsManager {
  constructor() {
    this.textures = {};
    this.materials = {};
    this.xrayActive = false;
    this._initTextures();
    this._initMaterials();
  }

  /**
   * Pomocnicza funkcja tworząca powtarzalną teksturę CanvasTexture.
   */
  _createCanvasTexture(width, height, drawFn, repeatX = 1, repeatY = 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, width, height);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  _initTextures() {
    // 1. Dachówka karpiówka w koronkę (z naturalną patyną ogrodu)
    this.textures.karpiowka = this._createCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#5c261a';
      ctx.fillRect(0, 0, w, h);
      const rows = 10;
      const cols = 8;
      const rowH = h / rows;
      const colW = w / cols;

      for (let r = rows; r >= -1; r--) {
        const y = r * rowH;
        const offsetX = (r % 2) * (colW * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * colW + offsetX;
          const hueShift = ((r * 17 + c * 31) % 24) - 12;
          const baseR = 138 + hueShift;
          const baseG = 58 + Math.floor(hueShift * 0.4);
          const baseB = 40 + Math.floor(hueShift * 0.3);

          // Cień pod noskiem dachówki
          ctx.fillStyle = 'rgba(15, 6, 4, 0.55)';
          ctx.beginPath();
          ctx.moveTo(x + 2, y);
          ctx.lineTo(x + colW - 2, y);
          ctx.lineTo(x + colW - 2, y + rowH * 0.85);
          ctx.quadraticCurveTo(x + colW * 0.5, y + rowH * 1.38, x + 2, y + rowH * 0.85);
          ctx.closePath();
          ctx.fill();

          // Korpus dachówki karpiówki
          const grad = ctx.createLinearGradient(x, y, x, y + rowH * 1.15);
          grad.addColorStop(0, `rgb(${baseR - 18}, ${baseG - 10}, ${baseB - 8})`);
          grad.addColorStop(0.6, `rgb(${baseR}, ${baseG}, ${baseB})`);
          grad.addColorStop(1, `rgb(${baseR + 12}, ${baseG + 6}, ${baseB + 4})`);
          ctx.fillStyle = grad;

          ctx.beginPath();
          ctx.moveTo(x + 3, y);
          ctx.lineTo(x + colW - 3, y);
          ctx.lineTo(x + colW - 3, y + rowH * 0.78);
          ctx.quadraticCurveTo(x + colW * 0.5, y + rowH * 1.28, x + 3, y + rowH * 0.78);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = 'rgba(30, 12, 8, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }, 6, 5);

    // 2. Klepka dębowa w klasyczną jodełkę (Herringbone Oak Parquet)
    this.textures.parquet = this._createCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#b68349';
      ctx.fillRect(0, 0, w, h);

      const step = 64;
      for (let y = -step; y < h + step; y += step) {
        for (let x = -step; x < w + step; x += step) {
          const shade1 = 175 + ((x + y) % 25);
          const shade2 = 158 + ((x * 3 + y) % 22);

          // Klepka lewa-skos
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = `rgb(${shade1}, ${Math.floor(shade1 * 0.71)}, ${Math.floor(shade1 * 0.41)})`;
          ctx.fillRect(0, 0, step * 0.96, step * 0.32);
          ctx.strokeStyle = 'rgba(65, 40, 18, 0.35)';
          ctx.strokeRect(0, 0, step * 0.96, step * 0.32);
          ctx.restore();

          // Klepka prawa-skos
          ctx.save();
          ctx.translate(x + step * 0.5, y);
          ctx.rotate(-Math.PI / 4);
          ctx.fillStyle = `rgb(${shade2}, ${Math.floor(shade2 * 0.7)}, ${Math.floor(shade2 * 0.39)})`;
          ctx.fillRect(0, 0, step * 0.96, step * 0.32);
          ctx.strokeStyle = 'rgba(65, 40, 18, 0.35)';
          ctx.strokeRect(0, 0, step * 0.96, step * 0.32);
          ctx.restore();
        }
      }
    }, 4, 4);

    // 3. Wątek ceglany pełny / płyta Kleina
    this.textures.brick = this._createCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#c8c2b4'; // spoiny wapienne
      ctx.fillRect(0, 0, w, h);
      const rows = 12;
      const cols = 6;
      const rH = h / rows;
      const cW = w / cols;

      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (cW * 0.5);
        for (let c = -1; c <= cols; c++) {
          const v = ((r * 19 + c * 29) % 30) - 15;
          ctx.fillStyle = `rgb(${168 + v}, ${76 + Math.floor(v * 0.5)}, ${54 + Math.floor(v * 0.4)})`;
          ctx.fillRect(c * cW + off + 3, r * rH + 3, cW - 6, rH - 6);
        }
      }
    }, 3, 3);

    // 4. Tynk szlachetny elewacji (jasny szaro-kremowy z fakturą)
    this.textures.plaster = this._createCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#dcd9d0';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 4500; i++) {
        const x = (i * 73) % w;
        const y = (i * 137) % h;
        const alpha = (i % 5) * 0.015;
        ctx.fillStyle = i % 2 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(60,58,52,${alpha})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }, 5, 5);

    // 5. Boazeria drewniana pionowa (korytarz i klatka schodowa)
    this.textures.wainscoting = this._createCanvasTexture(256, 256, (ctx, w, h) => {
      const slats = 12;
      const sW = w / slats;
      for (let i = 0; i < slats; i++) {
        const delta = ((i * 13) % 16) - 8;
        ctx.fillStyle = `rgb(${146 + delta}, ${94 + delta}, ${48 + Math.floor(delta * 0.5)})`;
        ctx.fillRect(i * sW, 0, sW - 2, h);
        ctx.fillStyle = '#4a2c14';
        ctx.fillRect((i + 1) * sW - 2, 0, 2, h);
      }
    }, 3, 1);

    // 6. Mozaika ceramiczna werandy i łazienki (wzorzysta krata z fotografii)
    this.textures.mosaic = this._createCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#8b8378';
      ctx.fillRect(0, 0, w, h);
      const n = 16;
      const cell = w / n;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const isBorder = r % 4 === 0 || c % 4 === 0;
          const isCenter = r % 4 === 2 && c % 4 === 2;
          if (isBorder) {
            ctx.fillStyle = '#5e646e'; // grafitowo-niebieski pas
          } else if (isCenter) {
            ctx.fillStyle = '#c87d4b'; // terakotowy akcent
          } else {
            ctx.fillStyle = '#d8be98'; // ciepły beż
          }
          ctx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
        }
      }
    }, 5, 5);

    // 7. Lastriko (stopnie wejściowe i parapety)
    this.textures.terrazzo = this._createCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#9ea3a8';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        const x = (i * 53) % w;
        const y = (i * 97) % h;
        const sz = 2 + (i % 4);
        ctx.fillStyle = i % 3 === 0 ? '#eef2f6' : i % 3 === 1 ? '#475569' : '#cbd5e1';
        ctx.fillRect(x, y, sz, sz);
      }
    }, 2, 2);

    // 8. Płytki tarasowe i schody ogrodowe klinkierowe
    this.textures.terraceTile = this._createCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#645f58';
      ctx.fillRect(0, 0, w, h);
      const grid = 4;
      const sz = w / grid;
      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          const d = ((r + c) % 2) * 6;
          ctx.fillStyle = `rgb(${204 + d}, ${198 + d}, ${186 + d})`;
          ctx.fillRect(c * sz + 3, r * sz + 3, sz - 6, sz - 6);
        }
      }
    }, 4, 4);

    // 9. Blacha cynkowa patynowana (lukarny, obróbki, rynny)
    this.textures.zinc = this._createCanvasTexture(256, 256, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#7c858e');
      grad.addColorStop(0.5, '#949ea8');
      grad.addColorStop(1, '#6c757e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      // Rąbki stojące blachy
      ctx.fillStyle = 'rgba(30, 41, 59, 0.35)';
      for (let x = 0; x < w; x += 64) {
        ctx.fillRect(x, 0, 3, h);
      }
    }, 2, 2);
  }

  _initMaterials() {
    this.materials = {
      // Mury i tynki zewnętrzne
      facadePlaster: new THREE.MeshStandardMaterial({
        name: 'Tynk szlachetny elewacji (1955/1966)',
        map: this.textures.plaster,
        color: 0xe2dfd7,
        roughness: 0.86,
        metalness: 0.02,
      }),
      facadeTwin: new THREE.MeshStandardMaterial({
        name: 'Tynk segmentu bliźniaczego A (południowego)',
        map: this.textures.plaster,
        color: 0xd8d3c8,
        roughness: 0.88,
        metalness: 0.02,
      }),
      plinthPlaster: new THREE.MeshStandardMaterial({
        name: 'Cokół podziemia (tynk bordowo-brunatny)',
        map: this.textures.plaster,
        color: 0x613b38,
        roughness: 0.9,
        metalness: 0.04,
      }),
      foundationConcrete: new THREE.MeshStandardMaterial({
        name: 'Ławy fundamentowe betonowe Rw=110',
        color: 0x646a70,
        roughness: 0.95,
        metalness: 0.05,
      }),
      basementWall: new THREE.MeshStandardMaterial({
        name: 'Mur piwniczny 51 cm (cegła pełna na zaprawie 1:4)',
        map: this.textures.brick,
        color: 0xcbc6bc,
        roughness: 0.88,
      }),
      interiorWall: new THREE.MeshStandardMaterial({
        name: 'Tynk wewnętrzny wapienny malowany klejowo',
        color: 0xf4f1ea,
        roughness: 0.82,
        metalness: 0.01,
      }),
      partitionWall: new THREE.MeshStandardMaterial({
        name: 'Ścianka działowa 12 cm z cegły dziurawki',
        color: 0xede8dd,
        roughness: 0.84,
      }),
      corniceWhite: new THREE.MeshStandardMaterial({
        name: 'Gzyms podokapowy ciągniony',
        color: 0xf8f6f0,
        roughness: 0.72,
      }),

      // Stropy Kleina i stal konstrukcyjna
      steelBeamINP: new THREE.MeshStandardMaterial({
        name: 'Belka stalowa walcowana I NP 24 / 22 (z rozbiórki, miniowana)',
        color: 0x7f2f24,
        roughness: 0.42,
        metalness: 0.78,
      }),
      steelTrimmer: new THREE.MeshStandardMaterial({
        name: 'Wymian stalowy klatki schodowej I NP 14',
        color: 0xb45309,
        roughness: 0.36,
        metalness: 0.82,
      }),
      kleinBrickPlate: new THREE.MeshStandardMaterial({
        name: 'Płyta ceramiczna Kleina zbrojona bednarką / Ø 6 mm',
        map: this.textures.brick,
        color: 0xc26d53,
        roughness: 0.85,
      }),
      kleinSlagFill: new THREE.MeshStandardMaterial({
        name: 'Zagruzowanie stropu Kleina (polepa ceglano-wapienna 9 cm)',
        color: 0x8c7a6b,
        roughness: 0.94,
      }),

      // Posadzki
      oakParquet: new THREE.MeshStandardMaterial({
        name: 'Klepka dębowa w jodełkę',
        map: this.textures.parquet,
        roughness: 0.36,
        metalness: 0.05,
      }),
      verandaMosaic: new THREE.MeshStandardMaterial({
        name: 'Posadzka mozaikowa werandy i łazienki',
        map: this.textures.mosaic,
        roughness: 0.45,
        metalness: 0.05,
      }),
      terrazzo: new THREE.MeshStandardMaterial({
        name: 'Lastriko (schody wejściowe, parapety, kuchnia)',
        map: this.textures.terrazzo,
        roughness: 0.48,
        metalness: 0.06,
      }),
      terraceTiles: new THREE.MeshStandardMaterial({
        name: 'Płytki tarasu I piętra (15,9 m²)',
        map: this.textures.terraceTile,
        roughness: 0.65,
      }),
      clinkerStairs: new THREE.MeshStandardMaterial({
        name: 'Stopnie ogrodowe z terakoty klinkierowej',
        color: 0x9e4b3b,
        roughness: 0.58,
      }),
      basementFloor: new THREE.MeshStandardMaterial({
        name: 'Posadzka betonowa podziemia i garaży',
        color: 0x6e7378,
        roughness: 0.88,
      }),
      atticPineFloor: new THREE.MeshStandardMaterial({
        name: 'Deski sosnowe poddasza',
        color: 0xba8c56,
        roughness: 0.68,
      }),

      // Drewno konstrukcyjne, schody i stolarka
      oakStairs: new THREE.MeshStandardMaterial({
        name: 'Dębowe schody zabiegowe polerowane',
        color: 0x8f5b2d,
        roughness: 0.34,
        metalness: 0.06,
      }),
      wainscotingWood: new THREE.MeshStandardMaterial({
        name: 'Boazeria drewniana korytarza',
        map: this.textures.wainscoting,
        roughness: 0.46,
      }),
      roofTimber: new THREE.MeshStandardMaterial({
        name: 'Drewno sosnowe więźby dachowej stolcowo-kleszczowej',
        color: 0xa67442,
        roughness: 0.76,
      }),
      windowFrameWhite: new THREE.MeshStandardMaterial({
        name: 'Stolarka okienna drewniana skrzynkowa/zespolona biała',
        color: 0xf8fafc,
        roughness: 0.35,
      }),
      doorWood: new THREE.MeshStandardMaterial({
        name: 'Stolarka drzwiowa drewniana płycinowa',
        color: 0x7c4d25,
        roughness: 0.42,
      }),
      garageDoorMat: new THREE.MeshStandardMaterial({
        name: 'Brama garażowa dwuskrzydłowa stalowo-drewniana',
        color: 0x334155,
        roughness: 0.55,
        metalness: 0.35,
      }),

      // Dach, blacharka i szkło
      roofTileKarpiowka: new THREE.MeshStandardMaterial({
        name: 'Dachówka ceramiczna karpiówka podwójnie w koronkę',
        map: this.textures.karpiowka,
        roughness: 0.74,
        metalness: 0.04,
        side: THREE.DoubleSide,
      }),
      ridgeTileMat: new THREE.MeshStandardMaterial({
        name: 'Gąsiory grzbietowe i kalenicowe ceramiczne',
        color: 0x7c2d1e,
        roughness: 0.68,
      }),
      zincFlashing: new THREE.MeshStandardMaterial({
        name: 'Blacha cynkowa (lukarny pulpitowe, obróbki, rynny)',
        map: this.textures.zinc,
        color: 0x94a3b8,
        roughness: 0.42,
        metalness: 0.68,
      }),
      glassClear: new THREE.MeshPhysicalMaterial({
        name: 'Szkło okienne przezierne',
        color: 0xdbeafe,
        transparent: true,
        opacity: 0.34,
        roughness: 0.08,
        metalness: 0.1,
        reflectivity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      glassOrnamental: new THREE.MeshPhysicalMaterial({
        name: 'Szkło ornamentowe drzwi salonu',
        color: 0xfef3c7,
        transparent: true,
        opacity: 0.52,
        roughness: 0.35,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),

      // Zieleń, winorośl i otoczenie
      grapevineLeaf: new THREE.MeshStandardMaterial({
        name: 'Winorośl ogrodowa na werandzie i tarasie',
        color: 0x3f7d28,
        roughness: 0.72,
        side: THREE.DoubleSide,
      }),
      grapevineStem: new THREE.MeshStandardMaterial({
        name: 'Pędy zdrewniałe winorośli',
        color: 0x4a3525,
        roughness: 0.88,
      }),
      railingSteel: new THREE.MeshStandardMaterial({
        name: 'Balustrada stalowa kuta / spawana',
        color: 0x27272a,
        roughness: 0.45,
        metalness: 0.75,
      }),
      castIronWhite: new THREE.MeshStandardMaterial({
        name: 'Żeliwne meble ogrodowe na tarasie (białe)',
        color: 0xf1f5f9,
        roughness: 0.35,
        metalness: 0.4,
      }),
      castIronBoiler: new THREE.MeshStandardMaterial({
        name: 'Historyczny kocioł żeliwny C.O.',
        color: 0x3b2f2a,
        roughness: 0.6,
        metalness: 0.65,
      }),
      vaillantWhite: new THREE.MeshStandardMaterial({
        name: 'Kocioł kondensacyjny Vaillant ecoTEC',
        color: 0xf8fafc,
        roughness: 0.25,
        metalness: 0.2,
      }),
      expansionVesselRed: new THREE.MeshStandardMaterial({
        name: 'Naczynie wzbiorcze przeponowe C.O.',
        color: 0xb91c1c,
        roughness: 0.3,
        metalness: 0.4,
      }),
      grass: new THREE.MeshStandardMaterial({
        name: 'Trawnik ogrodowy ogrodu',
        color: 0x365b31,
        roughness: 0.94,
      }),
      asphalt: new THREE.MeshStandardMaterial({
        name: 'Nawierzchnia asfaltowa ulicy frontowej i zjazdu',
        color: 0x2b3038,
        roughness: 0.9,
      }),
      roomHighlight: new THREE.MeshBasicMaterial({
        name: 'Podświetlenie inspekcji pomieszczenia',
        color: 0xd4af37,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    };

    // Aliasy dla kompatybilności wywołań .get(name)
    this.aliases = {
      pineTimber: 'roofTimber',
      brickWall: 'basementWall',
      zincSheet: 'zincFlashing',
      concrete: 'foundationConcrete',
      steelGalvanized: 'zincFlashing',
      roofTile: 'roofTileKarpiowka',
      roofRidgeTile: 'ridgeTileMat',
      windowFrame: 'windowFrameWhite',
      windowGlass: 'glassClear',
      steelBeam: 'steelBeamINP',
      steelRailing: 'railingSteel',
      oakWood: 'oakStairs',
      foliage: 'grapevineLeaf',
    };
  }

  get(key) {
    const targetKey = this.aliases[key] || key;
    return this.materials[targetKey] || this.materials.facadePlaster;
  }

  /**
   * Przełącznik trybu „Rentgen Kleina” (X-Ray):
   * Czyni ściany i dachy półprzezroczystymi, eksponując stalowe belki Kleina I NP 24,
   * wymiany klatki schodowej i więźbę stolcowo-kleszczową.
   */
  setXRayMode(enabled) {
    this.xrayActive = enabled;
    const wallMats = [
      this.materials.facadePlaster,
      this.materials.facadeTwin,
      this.materials.plinthPlaster,
      this.materials.basementWall,
      this.materials.interiorWall,
      this.materials.partitionWall,
      this.materials.oakParquet,
      this.materials.verandaMosaic,
      this.materials.roofTileKarpiowka,
    ];

    for (const mat of wallMats) {
      mat.transparent = enabled;
      mat.opacity = enabled ? 0.18 : 1.0;
      mat.depthWrite = !enabled;
      mat.needsUpdate = true;
    }
  }
}
