import { Vector2 } from '../types';
import { GRID_CELL_SIZE, GRID_COLS, GRID_ROWS } from '../constants';

export class SpatialHash<T extends { position: Vector2, id: string, gridIndex: number }> {
  grid: T[][] = [];

  constructor() {
    this.clear();
  }

  clear() {
    const total = GRID_COLS * GRID_ROWS;
    this.grid = new Array(total).fill(null).map(() => []);
  }

  getIndex(pos: Vector2): number {
    const col = Math.floor(pos.x / GRID_CELL_SIZE);
    const row = Math.floor(pos.y / GRID_CELL_SIZE);
    const c = Math.max(0, Math.min(GRID_COLS - 1, col));
    const r = Math.max(0, Math.min(GRID_ROWS - 1, row));
    return c + r * GRID_COLS;
  }

  add(item: T) {
    const idx = this.getIndex(item.position);
    item.gridIndex = idx;
    this.grid[idx].push(item);
  }

  remove(item: T) {
    const idx = item.gridIndex;
    if (this.grid[idx]) {
        const i = this.grid[idx].indexOf(item);
        if (i > -1) this.grid[idx].splice(i, 1);
    }
  }

  updateSpatialIndex(item: T) {
    const newIdx = this.getIndex(item.position);
    if (newIdx !== item.gridIndex) {
      this.remove(item);
      item.gridIndex = newIdx;
      this.grid[newIdx].push(item);
    }
  }

  query(centerIdx: number): T[] {
    const results: T[] = [];
    const col = centerIdx % GRID_COLS;
    const row = Math.floor(centerIdx / GRID_COLS);

    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const nc = col + dx;
            const nr = row + dy;
            if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
                const idx = nc + nr * GRID_COLS;
                const cell = this.grid[idx];
                for(let i=0; i<cell.length; i++) {
                    results.push(cell[i]);
                }
            }
        }
    }
    return results;
  }
  
  // Helper to get raw indices for external iterators
  getNeighborIndices(centerIdx: number): number[] {
    const indices = [centerIdx];
    const col = centerIdx % GRID_COLS;
    const row = Math.floor(centerIdx / GRID_COLS);

    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nc = col + dx;
            const nr = row + dy;
            if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
                indices.push(nc + nr * GRID_COLS);
            }
        }
    }
    return indices;
  }
}