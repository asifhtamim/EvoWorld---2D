import React, { useEffect, useRef, useState } from 'react';
import { SimulationEngine } from '../services/simulationEngine';
import { Renderer } from '../systems/Renderer';
import { WORLD_WIDTH, WORLD_HEIGHT, GRID_CELL_SIZE } from '../constants';
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

    // 3. Render using the new Render System
    Renderer.drawFrame(ctx, simulation, cam, zoom, viewport);

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