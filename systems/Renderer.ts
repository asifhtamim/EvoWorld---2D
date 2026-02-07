import { SimulationEngine } from '../services/simulationEngine';
import { WORLD_WIDTH, WORLD_HEIGHT, BIOME_WATER_WIDTH, BIOME_FOREST_WIDTH, GRID_CELL_SIZE, GRID_COLS } from '../constants';
import { Critter } from '../types';

export class Renderer {
  
  static drawFrame(
    ctx: CanvasRenderingContext2D, 
    simulation: SimulationEngine, 
    camera: {x: number, y: number}, 
    zoom: number, 
    viewport: {width: number, height: number}
  ) {
    ctx.clearRect(0, 0, viewport.width, viewport.height);
    
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-camera.x, -camera.y);

    this.drawBackground(ctx, simulation.time);
    this.drawEntities(ctx, simulation, camera, zoom, viewport);

    ctx.restore();
  }

  private static drawBackground(ctx: CanvasRenderingContext2D, time: number) {
    // Ocean
    const oceanGrad = ctx.createLinearGradient(0, 0, BIOME_WATER_WIDTH, 0);
    oceanGrad.addColorStop(0, '#1e3a8a'); 
    oceanGrad.addColorStop(1, '#3b82f6'); 
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, BIOME_WATER_WIDTH, WORLD_HEIGHT);

    // Forest
    const forestStart = BIOME_WATER_WIDTH;
    const forestEnd = forestStart + BIOME_FOREST_WIDTH;
    const forestGrad = ctx.createLinearGradient(forestStart, 0, forestEnd, 0);
    forestGrad.addColorStop(0, '#eab308'); 
    forestGrad.addColorStop(0.1, '#064e3b'); 
    forestGrad.addColorStop(1, '#14532d');
    ctx.fillStyle = forestGrad;
    ctx.fillRect(forestStart, 0, BIOME_FOREST_WIDTH, WORLD_HEIGHT);
    
    // Scrub/Wasteland
    ctx.fillStyle = '#78350f'; 
    ctx.fillRect(forestEnd, 0, WORLD_WIDTH - forestEnd, WORLD_HEIGHT);

    // Shoreline Wave Effect
    ctx.fillStyle = '#ffffff22';
    const waveOffset = Math.sin(time * 0.05) * 20;
    ctx.beginPath();
    ctx.moveTo(BIOME_WATER_WIDTH + waveOffset, 0);
    ctx.lineTo(BIOME_WATER_WIDTH + waveOffset, WORLD_HEIGHT);
    ctx.lineTo(BIOME_WATER_WIDTH - 40 + waveOffset, WORLD_HEIGHT);
    ctx.lineTo(BIOME_WATER_WIDTH - 40 + waveOffset, 0);
    ctx.fill();

    // Biome Labels
    ctx.fillStyle = '#ffffff33';
    ctx.font = '80px sans-serif';
    ctx.fillText("OCEAN", 100, 300);
    ctx.fillText("JUNGLE", BIOME_WATER_WIDTH + 100, 300);
    ctx.fillText("WASTELAND", forestEnd + 100, 300);
  }

  private static drawEntities(
    ctx: CanvasRenderingContext2D, 
    simulation: SimulationEngine, 
    camera: {x: number, y: number}, 
    zoom: number, 
    viewport: {width: number, height: number}
  ) {
    const visibleW = viewport.width / zoom;
    const visibleH = viewport.height / zoom;
    
    const startCol = Math.floor(Math.max(0, camera.x) / GRID_CELL_SIZE);
    const endCol = Math.ceil(Math.min(WORLD_WIDTH, camera.x + visibleW) / GRID_CELL_SIZE);
    const startRow = Math.floor(Math.max(0, camera.y) / GRID_CELL_SIZE);
    const endRow = Math.ceil(Math.min(WORLD_HEIGHT, camera.y + visibleH) / GRID_CELL_SIZE);

    // Render Food
    if (zoom > 0.2) {
        for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
                const idx = c + r * GRID_COLS;
                if (idx < simulation.foodGrid.grid.length) {
                    const cell = simulation.foodGrid.grid[idx];
                    for (let k = 0; k < cell.length; k++) {
                        const f = cell[k];
                        if (f.energyValue <= 0) continue;
                        ctx.fillStyle = f.position.x < BIOME_WATER_WIDTH ? '#22d3ee' : '#4ade80';
                        ctx.fillRect(f.position.x - 2, f.position.y - 2, 4, 4);
                    }
                }
            }
        }
    }

    // Render Critters
    for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
            const idx = c + r * GRID_COLS;
            if (idx < simulation.critterGrid.grid.length) {
                const cell = simulation.critterGrid.grid[idx];
                for (let k = 0; k < cell.length; k++) {
                    this.drawCritter(ctx, cell[k], simulation.time);
                }
            }
        }
    }
  }

  private static drawCritter(ctx: CanvasRenderingContext2D, c: Critter, time: number) {
    ctx.save();
    ctx.translate(c.position.x, c.position.y);
    ctx.rotate(c.heading);

    const size = c.genome.size;
    const limbCount = c.genome.limbCount;
    const limbLen = c.genome.limbLength;
    const isCarnivore = c.genome.diet > 0.5;
    const isAquatic = c.genome.amphibious < 0.4;
    const isAmphibious = c.genome.amphibious >= 0.4 && c.genome.amphibious <= 0.6;
    const defense = c.genome.defense || 0;

    // 1. Draw Limbs / Fins
    ctx.strokeStyle = c.genome.color;
    ctx.fillStyle = c.genome.color;
    ctx.lineWidth = Math.max(1, size * 0.25); 

    for (let i = 0; i < limbCount; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const index = Math.floor(i / 2);
        
        if (isAquatic) {
            const finBaseX = (size * 0.2) - (index * 4);
            const finBaseY = side * (size * 0.5);
            ctx.beginPath();
            ctx.moveTo(finBaseX, finBaseY);
            ctx.lineTo(finBaseX - 5, finBaseY + (side * limbLen));
            ctx.lineTo(finBaseX + 5, finBaseY + (side * limbLen * 0.5));
            ctx.fill();
        } else {
            const offset = (index / limbCount) * Math.PI;
            const speed = Math.sqrt(c.velocity.x**2 + c.velocity.y**2);
            const swing = Math.sin(time * 0.5 + offset) * (speed * 2);
            const legBaseX = (size * 0.5) - (index * (size / (limbCount/2 + 1)));
            const legBaseY = side * (size * 0.5);

            ctx.beginPath();
            ctx.moveTo(legBaseX, legBaseY);
            ctx.lineTo(legBaseX - swing, legBaseY + (side * limbLen));
            ctx.stroke();
            
            if (isAmphibious) {
               ctx.fillStyle = c.genome.color; 
               ctx.beginPath();
               ctx.arc(legBaseX - swing, legBaseY + (side * limbLen), 3, 0, Math.PI * 2);
               ctx.fill();
            }
        }
    }

    // 2. Body & Armor
    ctx.fillStyle = c.genome.color;
    if (defense > 0.2) {
        ctx.beginPath();
        const spikeCount = 6 + Math.floor(defense * 10);
        const spikeHeight = size * (0.3 + defense * 0.5);
        for(let i=0; i<spikeCount; i++) {
            const angle = (i / spikeCount) * Math.PI * 2;
            const x = Math.cos(angle) * (size + spikeHeight);
            const y = Math.sin(angle) * (size + spikeHeight * 0.6); 
            const xBase1 = Math.cos(angle - 0.2) * size;
            const yBase1 = Math.sin(angle - 0.2) * size * 0.8;
            const xBase2 = Math.cos(angle + 0.2) * size;
            const yBase2 = Math.sin(angle + 0.2) * size * 0.8;
            ctx.moveTo(xBase1, yBase1);
            ctx.lineTo(x, y);
            ctx.lineTo(xBase2, yBase2);
        }
        ctx.fill();
        ctx.strokeStyle = '#00000033';
        ctx.stroke();
        ctx.fillStyle = c.genome.color;
    }

    if (isCarnivore) {
        ctx.beginPath();
        ctx.moveTo(size + c.genome.mouthSize, 0); 
        ctx.lineTo(-size, -size * 0.7);
        ctx.lineTo(-size * 0.5, 0); 
        ctx.lineTo(-size, size * 0.7);
        ctx.closePath();
    } else {
        ctx.beginPath();
        if (isAquatic) ctx.ellipse(0, 0, size * 1.2, size * 0.6, 0, 0, Math.PI * 2);
        else ctx.ellipse(0, 0, size, size * 0.8, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    // 3. Mouth
    if (c.genome.mouthSize > 1) {
        ctx.fillStyle = '#000000aa';
        ctx.beginPath();
        if (isCarnivore) {
            ctx.moveTo(size, -2);
            ctx.lineTo(size + c.genome.mouthSize, -4);
            ctx.lineTo(size + c.genome.mouthSize, 4);
            ctx.lineTo(size, 2);
        } else {
            ctx.arc(size * 0.8, 0, c.genome.mouthSize * 0.5, 0, Math.PI * 2);
        }
        ctx.fill();
    }
    
    // Gills
    if (isAquatic) {
        ctx.strokeStyle = '#ffffff55';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(size * 0.2, -size * 0.3);
        ctx.lineTo(size * 0.2, size * 0.3);
        ctx.moveTo(size * 0.0, -size * 0.3);
        ctx.lineTo(size * 0.0, size * 0.3);
        ctx.stroke();
    }

    // State Indicator
    if (c.state === 'hunting' || c.state === 'fleeing') {
        ctx.strokeStyle = c.state === 'hunting' ? '#ef4444' : '#fbbf24';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
  }
}