import React, { useEffect, useRef } from 'react';
import { SimulationEngine } from '../services/simulationEngine';
import { WORLD_WIDTH, WORLD_HEIGHT, BIOME_WATER_WIDTH } from '../constants';

interface Props {
  simulation: SimulationEngine;
  speedMultiplier: number;
}

const WorldCanvas: React.FC<Props> = ({ simulation, speedMultiplier }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);

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

    // Thicker legs for bigger/land creatures
    ctx.lineWidth = Math.max(1, size * 0.25); 

    for (let i = 0; i < limbCount; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const index = Math.floor(i / 2);
        
        if (isAquatic) {
            // Draw FINS
            const finBaseX = (size * 0.2) - (index * 4);
            const finBaseY = side * (size * 0.5);
            ctx.beginPath();
            ctx.moveTo(finBaseX, finBaseY);
            ctx.lineTo(finBaseX - 5, finBaseY + (side * limbLen));
            ctx.lineTo(finBaseX + 5, finBaseY + (side * limbLen * 0.5));
            ctx.fill();
        } else {
            // Draw LEGS
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
               ctx.strokeStyle = '#ffffff55';
               ctx.lineWidth = 1;
               ctx.beginPath();
               ctx.moveTo(legBaseX - swing - 2, legBaseY + (side * limbLen));
               ctx.lineTo(legBaseX - swing + 2, legBaseY + (side * limbLen));
               ctx.stroke();
               ctx.lineWidth = Math.max(1, size * 0.25);
               ctx.strokeStyle = c.genome.color;
            }
        }
    }

    // 2. Draw Body
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
        if (isAquatic) {
             ctx.ellipse(0, 0, size * 1.2, size * 0.6, 0, 0, Math.PI * 2);
        } else {
             ctx.ellipse(0, 0, size, size * 0.8, 0, 0, Math.PI * 2);
        }
    }
    ctx.fill();

    // 3. Draw Mouth/Mandibles
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
    
    // Gills indicator
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

    // 4. Status Rings
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

    for(let i=0; i<speedMultiplier; i++) simulation.update();

    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    
    // --- Draw Biomes ---
    const oceanGrad = ctx.createLinearGradient(0, 0, BIOME_WATER_WIDTH, 0);
    oceanGrad.addColorStop(0, '#1e3a8a'); 
    oceanGrad.addColorStop(1, '#3b82f6'); 
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, BIOME_WATER_WIDTH, WORLD_HEIGHT);

    const forestEnd = BIOME_WATER_WIDTH + 300;
    const forestGrad = ctx.createLinearGradient(BIOME_WATER_WIDTH, 0, forestEnd, 0);
    forestGrad.addColorStop(0, '#eab308'); 
    forestGrad.addColorStop(0.1, '#064e3b'); 
    forestGrad.addColorStop(1, '#14532d');
    ctx.fillStyle = forestGrad;
    ctx.fillRect(BIOME_WATER_WIDTH, 0, 300, WORLD_HEIGHT);
    
    ctx.fillStyle = '#78350f'; 
    ctx.fillRect(forestEnd, 0, WORLD_WIDTH - forestEnd, WORLD_HEIGHT);

    ctx.fillStyle = '#ffffff22';
    const waveOffset = Math.sin(simulation.time * 0.05) * 5;
    ctx.beginPath();
    ctx.moveTo(BIOME_WATER_WIDTH + waveOffset, 0);
    ctx.lineTo(BIOME_WATER_WIDTH + waveOffset, WORLD_HEIGHT);
    ctx.lineTo(BIOME_WATER_WIDTH - 10 + waveOffset, WORLD_HEIGHT);
    ctx.lineTo(BIOME_WATER_WIDTH - 10 + waveOffset, 0);
    ctx.fill();

    ctx.fillStyle = '#ffffff33';
    ctx.font = '20px sans-serif';
    ctx.fillText("OCEAN", 20, 30);
    ctx.fillText("JUNGLE", BIOME_WATER_WIDTH + 20, 30);
    ctx.fillText("WASTELAND", forestEnd + 20, 30);

    simulation.food.forEach(f => {
      ctx.beginPath();
      const r = 2 + (Math.sin(f.position.x * 0.1 + simulation.time * 0.01) + 1);
      ctx.arc(f.position.x, f.position.y, r, 0, Math.PI * 2);
      ctx.fillStyle = f.position.x < BIOME_WATER_WIDTH ? '#22d3ee' : '#4ade80';
      ctx.fill();
    });

    simulation.critters.forEach(c => drawCritter(ctx, c, simulation.time));

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [speedMultiplier]);

  // Use a wrapper div for aspect ratio management, but canvas fills it
  return (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center overflow-hidden relative">
        <canvas
            ref={canvasRef}
            width={WORLD_WIDTH}
            height={WORLD_HEIGHT}
            className="block"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded pointer-events-none">
           Entities: {simulation.critters.length} | Food: {simulation.food.length}
        </div>
    </div>
  );
};

export default WorldCanvas;