import React, { useEffect, useRef, useState } from 'react';
import { SimulationEngine } from '../services/simulationEngine';
import { WORLD_WIDTH, WORLD_HEIGHT, BIOME_WATER_WIDTH, BIOME_FOREST_WIDTH, GRID_CELL_SIZE, GRID_COLS, GRID_ROWS } from '../constants';
import { Gamepad2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ZoomIn, ZoomOut } from 'lucide-react';

interface Props {
  simulation: SimulationEngine;
  speedMultiplier: number;
}

const WorldCanvas: React.FC<Props> = ({ simulation, speedMultiplier }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  
  // Camera State
  const camera = useRef({ x: 0, y: 0 });
  const keysPressed = useRef<Set<string>>(new Set());
  
  const [viewport, setViewport] = useState({ width: 800, height: 600 });
  const [showControls, setShowControls] = useState(false);
  const [zoom, setZoom] = useState(0.6); 

  // Resize Observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setViewport({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Keyboard Listeners
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => keysPressed.current.add(e.code);
    const handleUp = (e: KeyboardEvent) => keysPressed.current.delete(e.code);
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
        window.removeEventListener('keydown', handleDown);
        window.removeEventListener('keyup', handleUp);
    }
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      setZoom(z => Math.max(0.1, Math.min(2.0, z + delta)));
  };

  const drawCritter = (ctx: CanvasRenderingContext2D, c: any, time: number) => {
    ctx.save();
    ctx.translate(c.position.x, c.position.y);
    ctx.rotate(c.heading);

    const size = c.genome.size;
    const limbCount = c.genome.limbCount;
    const limbLen = c.genome.limbLength;
    const isCarnivore = c.genome.diet > 0.5;
    const isAquatic = c.genome.amphibious < 0.4;
    const isAmphibious = c.genome.amphibious >= 0.4 && c.genome.amphibious <= 0.6;

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

    // 2. Body
    ctx.fillStyle = c.genome.color;
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

    if (c.state === 'hunting' || c.state === 'fleeing') {
        ctx.strokeStyle = c.state === 'hunting' ? '#ef4444' : '#fbbf24';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
  };

  const animate = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // 1. Simulation Steps
    for(let i=0; i<speedMultiplier; i++) simulation.update();

    // 2. Camera Update
    const SCROLL_SPEED = 20 / zoom; 
    const cam = camera.current;
    if (keysPressed.current.has('ArrowRight') || keysPressed.current.has('KeyD')) cam.x += SCROLL_SPEED;
    if (keysPressed.current.has('ArrowLeft') || keysPressed.current.has('KeyA')) cam.x -= SCROLL_SPEED;
    if (keysPressed.current.has('ArrowDown') || keysPressed.current.has('KeyS')) cam.y += SCROLL_SPEED;
    if (keysPressed.current.has('ArrowUp') || keysPressed.current.has('KeyW')) cam.y -= SCROLL_SPEED;

    const visibleW = viewport.width / zoom;
    const visibleH = viewport.height / zoom;

    const maxScrollX = Math.max(0, WORLD_WIDTH - visibleW);
    const maxScrollY = Math.max(0, WORLD_HEIGHT - visibleH);
    cam.x = Math.max(0, Math.min(cam.x, maxScrollX));
    cam.y = Math.max(0, Math.min(cam.y, maxScrollY));

    // 3. Render
    ctx.clearRect(0, 0, viewport.width, viewport.height);
    
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-cam.x, -cam.y);

    // Background
    const oceanGrad = ctx.createLinearGradient(0, 0, BIOME_WATER_WIDTH, 0);
    oceanGrad.addColorStop(0, '#1e3a8a'); 
    oceanGrad.addColorStop(1, '#3b82f6'); 
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, BIOME_WATER_WIDTH, WORLD_HEIGHT);

    const forestStart = BIOME_WATER_WIDTH;
    const forestEnd = forestStart + BIOME_FOREST_WIDTH;
    const forestGrad = ctx.createLinearGradient(forestStart, 0, forestEnd, 0);
    forestGrad.addColorStop(0, '#eab308'); 
    forestGrad.addColorStop(0.1, '#064e3b'); 
    forestGrad.addColorStop(1, '#14532d');
    ctx.fillStyle = forestGrad;
    ctx.fillRect(forestStart, 0, BIOME_FOREST_WIDTH, WORLD_HEIGHT);
    
    ctx.fillStyle = '#78350f'; 
    ctx.fillRect(forestEnd, 0, WORLD_WIDTH - forestEnd, WORLD_HEIGHT);

    ctx.fillStyle = '#ffffff22';
    const waveOffset = Math.sin(simulation.time * 0.05) * 20;
    ctx.beginPath();
    ctx.moveTo(BIOME_WATER_WIDTH + waveOffset, 0);
    ctx.lineTo(BIOME_WATER_WIDTH + waveOffset, WORLD_HEIGHT);
    ctx.lineTo(BIOME_WATER_WIDTH - 40 + waveOffset, WORLD_HEIGHT);
    ctx.lineTo(BIOME_WATER_WIDTH - 40 + waveOffset, 0);
    ctx.fill();

    ctx.fillStyle = '#ffffff33';
    ctx.font = '80px sans-serif';
    ctx.fillText("OCEAN", 100, 300);
    ctx.fillText("JUNGLE", BIOME_WATER_WIDTH + 100, 300);
    ctx.fillText("WASTELAND", forestEnd + 100, 300);

    // 4. Optimized Entity Rendering
    // Determine visible grid cells
    const startCol = Math.floor(Math.max(0, cam.x) / GRID_CELL_SIZE);
    const endCol = Math.ceil(Math.min(WORLD_WIDTH, cam.x + visibleW) / GRID_CELL_SIZE);
    const startRow = Math.floor(Math.max(0, cam.y) / GRID_CELL_SIZE);
    const endRow = Math.ceil(Math.min(WORLD_HEIGHT, cam.y + visibleH) / GRID_CELL_SIZE);

    // Render Food (Use simple rectangles for speed with 35k items)
    // Only render food if zoom is close enough or use simplified render
    if (zoom > 0.2) {
        for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
                const idx = c + r * GRID_COLS;
                if (idx < simulation.foodGrid.length) {
                    const cell = simulation.foodGrid[idx];
                    for (let k = 0; k < cell.length; k++) {
                        const f = cell[k];
                        // Skip if already eaten (zero energy) but not yet cleaned up
                        if (f.energyValue <= 0) continue;
                        
                        ctx.fillStyle = f.position.x < BIOME_WATER_WIDTH ? '#22d3ee' : '#4ade80';
                        // Using fillRect is faster than arc for thousands of items
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
            if (idx < simulation.critterGrid.length) {
                const cell = simulation.critterGrid[idx];
                for (let k = 0; k < cell.length; k++) {
                    drawCritter(ctx, cell[k], simulation.time);
                }
            }
        }
    }

    ctx.restore();

    // HUD
    ctx.fillStyle = '#00000088';
    ctx.fillRect(10, 10, 160, 60);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`Pos: ${Math.round(cam.x)}, ${Math.round(cam.y)}`, 20, 30);
    ctx.fillText(`Zoom: ${zoom.toFixed(2)}x`, 20, 45);
    ctx.fillText(`Grid Visible: ${(endCol-startCol) * (endRow-startRow)}`, 20, 60);

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [speedMultiplier, viewport, zoom]);

  return (
    <div ref={containerRef} className="w-full h-full bg-gray-900 relative overflow-hidden group">
        <canvas
            ref={canvasRef}
            width={viewport.width}
            height={viewport.height}
            className="block cursor-crosshair active:cursor-grabbing"
            onWheel={handleWheel}
        />
        
        {/* Toggle Controls Button */}
        <button 
            onClick={() => setShowControls(!showControls)}
            className={`absolute bottom-4 right-4 p-3 rounded-full shadow-lg border border-gray-600 transition-all ${showControls ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            title="Toggle On-Screen Controls"
        >
            <Gamepad2 size={24} />
        </button>

        {/* On-Screen Controls Overlay */}
        {showControls && (
            <div className="absolute bottom-16 right-4 flex flex-col items-center gap-4 p-4 bg-gray-800/80 backdrop-blur rounded-xl border border-gray-700 shadow-2xl">
                
                {/* Zoom Controls */}
                <div className="flex gap-2 mb-2 border-b border-gray-600 pb-2 w-full justify-center">
                   <button 
                       onClick={() => setZoom(z => Math.min(2.0, z + 0.1))}
                       className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 active:bg-gray-500 transition"
                       title="Zoom In"
                   >
                       <ZoomIn size={20} />
                   </button>
                   <button 
                       onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}
                       className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 active:bg-gray-500 transition"
                       title="Zoom Out"
                   >
                       <ZoomOut size={20} />
                   </button>
                </div>

                {/* D-Pad */}
                <button 
                    onMouseDown={(e) => { keysPressed.current.add('ArrowUp'); }}
                    onMouseUp={(e) => { keysPressed.current.delete('ArrowUp'); }}
                    onMouseLeave={(e) => { keysPressed.current.delete('ArrowUp'); }}
                    className="p-4 bg-gray-700 rounded-lg hover:bg-blue-600 active:bg-blue-700 transition"
                >
                    <ArrowUp size={24} />
                </button>
                <div className="flex gap-2">
                    <button 
                        onMouseDown={(e) => { keysPressed.current.add('ArrowLeft'); }}
                        onMouseUp={(e) => { keysPressed.current.delete('ArrowLeft'); }}
                        onMouseLeave={(e) => { keysPressed.current.delete('ArrowLeft'); }}
                        className="p-4 bg-gray-700 rounded-lg hover:bg-blue-600 active:bg-blue-700 transition"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <button 
                         onMouseDown={(e) => { keysPressed.current.add('ArrowDown'); }}
                         onMouseUp={(e) => { keysPressed.current.delete('ArrowDown'); }}
                         onMouseLeave={(e) => { keysPressed.current.delete('ArrowDown'); }}
                        className="p-4 bg-gray-700 rounded-lg hover:bg-blue-600 active:bg-blue-700 transition"
                    >
                        <ArrowDown size={24} />
                    </button>
                    <button 
                        onMouseDown={(e) => { keysPressed.current.add('ArrowRight'); }}
                        onMouseUp={(e) => { keysPressed.current.delete('ArrowRight'); }}
                        onMouseLeave={(e) => { keysPressed.current.delete('ArrowRight'); }}
                        className="p-4 bg-gray-700 rounded-lg hover:bg-blue-600 active:bg-blue-700 transition"
                    >
                        <ArrowRight size={24} />
                    </button>
                </div>
                <div className="text-[10px] text-gray-400 font-mono mt-1 text-center">
                    Scroll to Zoom<br/>Arrows to Move
                </div>
            </div>
        )}
    </div>
  );
};

export default WorldCanvas;