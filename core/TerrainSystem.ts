import { BiomeType } from '../types';
import * as Constants from '../constants';

export class TerrainSystem {
  private static perm: number[] = [];
  private static grad3: number[][] = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
  ];
  public static backgroundCanvas: OffscreenCanvas | HTMLCanvasElement;
  private static initialized = false;

  static init() {
    this.seed(Math.random());
    // CRITICAL FIX: Set initialized to true BEFORE generating the map,
    // because generateTerrainMap calls getBiomeAt, which checks this flag.
    // If we don't set it first, we get infinite recursion.
    this.initialized = true;
    this.backgroundCanvas = this.generateTerrainMap();
  }

  // --- Perlin Noise Implementation ---
  private static seed(seed: number) {
      this.perm = new Array(512);
      const p = new Array(256).fill(0).map((_, i) => i);
      
      // Shuffle
      for (let i = 255; i > 0; i--) {
          const r = Math.floor((seed * (i + 1) * 123.456) % (i + 1));
          [p[i], p[r]] = [p[r], p[i]];
      }
      
      for (let i = 0; i < 512; i++) {
          this.perm[i] = p[i & 255];
      }
  }

  private static dot(g: number[], x: number, y: number) {
      return g[0] * x + g[1] * y;
  }

  private static mix(a: number, b: number, t: number) {
      return (1 - t) * a + t * b;
  }

  private static fade(t: number) {
      return t * t * t * (t * (t * 6 - 15) + 10);
  }

  // 2D Perlin Noise
  static noise(x: number, y: number): number {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;

      x -= Math.floor(x);
      y -= Math.floor(y);

      const u = this.fade(x);
      const v = this.fade(y);

      const A = this.perm[X] + Y;
      const B = this.perm[X + 1] + Y;

      return this.mix(
          this.mix(this.dot(this.grad3[this.perm[A] % 12], x, y), this.dot(this.grad3[this.perm[B] % 12], x - 1, y), u),
          this.mix(this.dot(this.grad3[this.perm[A + 1] % 12], x, y - 1), this.dot(this.grad3[this.perm[B + 1] % 12], x - 1, y - 1), u),
          v
      );
  }

  // --- Biome Logic ---
  
  static getElevation(x: number, y: number): number {
     const nx = x * Constants.TERRAIN_SCALE;
     const ny = y * Constants.TERRAIN_SCALE;
     
     // Octave 1
     let e = (this.noise(nx, ny) + 1) / 2;
     // Octave 2
     e += 0.5 * ((this.noise(nx * 2, ny * 2) + 1) / 2);
     // Octave 3
     e += 0.25 * ((this.noise(nx * 4, ny * 4) + 1) / 2);
     
     return e / 1.75;
  }
  
  static getMoisture(x: number, y: number): number {
      const nx = (x + 5000) * Constants.TERRAIN_SCALE;
      const ny = (y + 5000) * Constants.TERRAIN_SCALE;
      return (this.noise(nx * 0.5, ny * 0.5) + 1) / 2;
  }

  static getBiomeAt(x: number, y: number): BiomeType {
      if (!this.initialized) this.init();
      
      const e = this.getElevation(x, y);
      const m = this.getMoisture(x, y);
      
      if (e < Constants.BIOME_THRESHOLDS.DEEP_OCEAN) return BiomeType.DEEP_OCEAN;
      if (e < Constants.BIOME_THRESHOLDS.OCEAN) return BiomeType.OCEAN;
      if (e < Constants.BIOME_THRESHOLDS.BEACH) return BiomeType.BEACH;
      
      if (e > Constants.BIOME_THRESHOLDS.MOUNTAIN) return BiomeType.MOUNTAIN;
      
      // Land Biomes based on Moisture
      if (m > 0.6) return BiomeType.JUNGLE;
      if (m > 0.4) return BiomeType.FOREST;
      return BiomeType.PLAINS;
  }

  // --- Rendering ---

  static generateTerrainMap(): OffscreenCanvas | HTMLCanvasElement {
      // Create a lower resolution canvas for the background to save memory/time
      // Upscale during render. 1000x1000 is good enough for 4000x4000 world (1px = 4 world units)
      const w = 1000;
      const h = 1000;
      
      // Check for OffscreenCanvas support, fallback to document.createElement
      let canvas: OffscreenCanvas | HTMLCanvasElement;
      let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;

      if (typeof OffscreenCanvas !== 'undefined') {
          canvas = new OffscreenCanvas(w, h);
          ctx = canvas.getContext('2d');
      } else {
          canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          ctx = (canvas as HTMLCanvasElement).getContext('2d');
      }

      if (!ctx) {
        console.error("Could not create canvas context for terrain generation");
        // return a dummy canvas to avoid crashes
        return canvas;
      }

      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;

      const scaleX = Constants.WORLD_WIDTH / w;
      const scaleY = Constants.WORLD_HEIGHT / h;

      for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
              const wx = x * scaleX;
              const wy = y * scaleY;
              // This call was causing recursion if initialized wasn't true yet
              const biome = this.getBiomeAt(wx, wy);
              const idx = (x + y * w) * 4;
              
              let r=0, g=0, b=0;

              // Base Colors
              switch(biome) {
                  case BiomeType.DEEP_OCEAN: r=15; g=23; b=66; break;
                  case BiomeType.OCEAN: r=30; g=64; b=175; break;
                  case BiomeType.BEACH: r=240; g=210; b=150; break;
                  case BiomeType.PLAINS: r=163; g=186; b=80; break;
                  case BiomeType.FOREST: r=22; g=101; b=52; break;
                  case BiomeType.JUNGLE: r=6; g=78; b=59; break;
                  case BiomeType.MOUNTAIN: r=87; g=83; b=78; break;
              }

              // Add some noise texture to the pixels
              const noise = Math.random() * 10 - 5;
              data[idx] = Math.max(0, Math.min(255, r + noise));
              data[idx+1] = Math.max(0, Math.min(255, g + noise));
              data[idx+2] = Math.max(0, Math.min(255, b + noise));
              data[idx+3] = 255;
          }
      }

      ctx.putImageData(imgData, 0, 0);
      return canvas;
  }
}