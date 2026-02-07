import React, { useState, useEffect, useRef, useCallback } from 'react';
import WorldCanvas from './components/WorldCanvas';
import StatsPanel from './components/StatsPanel';
import SpeciesTree from './components/SpeciesTree';
import { SimulationEngine } from './services/simulationEngine';
import { Species } from './types';
import { Play, Pause, RefreshCw, FastForward, Activity, Maximize2, Minimize2 } from 'lucide-react';

// --- Card Component ---
interface CardProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  maximizedId: string | null;
  onToggleMaximize: (id: string) => void;
}

const DashboardCard: React.FC<CardProps> = ({ 
  id, title, icon, children, className = "", maximizedId, onToggleMaximize 
}) => {
  const isMaximized = maximizedId === id;
  const containerClasses = `bg-gray-800 rounded-lg shadow-lg border border-gray-700 flex flex-col overflow-hidden relative transition-all duration-300 ${className}`;

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-850 border-b border-gray-700 shrink-0 select-none">
         <div className="flex items-center gap-2 text-gray-300 font-bold text-xs uppercase tracking-wider">
            {icon}
            {title}
         </div>
         <button 
           onClick={() => onToggleMaximize(id)} 
           className="p-1 text-gray-500 hover:text-white transition rounded hover:bg-gray-700"
           title={isMaximized ? "Minimize" : "Maximize"}
         >
           {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
         </button>
      </div>
      <div className="flex-1 overflow-hidden relative w-full h-full">
        {children}
      </div>
    </div>
  );
};

interface LogEntry {
    id: number;
    message: string;
    type?: string;
    color?: string;
}

const App: React.FC = () => {
  const simulationRef = useRef<SimulationEngine>(new SimulationEngine());
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  
  const [statsHistory, setStatsHistory] = useState<{time: number, population: number, species: number}[]>([]);
  const [speciesSnapshot, setSpeciesSnapshot] = useState<Map<string, Species>>(new Map());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Real-time HUD stats
  const [hudStats, setHudStats] = useState({ time: 0, population: 0, species: 0, extinct: 0 });

  // Fullscreen State
  const [maximizedId, setMaximizedId] = useState<string | null>(null);

  const toggleMaximize = (id: string) => {
    setMaximizedId(prev => prev === id ? null : id);
  };

  const addLog = useCallback((msg: string, type?: string, color?: string) => {
      setLogs(prev => {
          const newLog = { id: Date.now() + Math.random(), message: msg, type, color };
          return [newLog, ...prev].slice(0, 50);
      });
  }, []);

  // Event Subscriptions
  useEffect(() => {
      const sim = simulationRef.current;
      const events = sim.events;

      // Stats Update (Throttled by Engine)
      const unsubStats = events.on('STATS_UPDATE', (data: any) => {
          setHudStats({
              time: data.time,
              population: data.population,
              species: data.speciesCount,
              extinct: data.extinctCount // Note: Currently 0 from engine, we can compute local or fix engine
          });

          setStatsHistory(prev => {
            const newData = [...prev, {
                time: data.time,
                population: data.population,
                species: data.speciesCount
            }];
            if (newData.length > 50) return newData.slice(newData.length - 50);
            return newData;
          });
          
          // Refresh species tree snapshot on stats update (slow)
          setSpeciesSnapshot(new Map(sim.species));
      });

      // Log Events
      const unsubLog = events.on('LOG', (data: any) => {
          addLog(data.message, data.type, data.color);
      });

      return () => {
          unsubStats();
          unsubLog();
      };
  }, [addLog]);

  const handleReset = useCallback(() => {
    simulationRef.current.reset();
    setStatsHistory([]);
    setSpeciesSnapshot(new Map());
    setLogs([]);
    setHudStats({ time: 0, population: 0, species: 0, extinct: 0 });
  }, []);

  // Layout Helper Classes
  const anyMaximized = !!maximizedId;
  const isMaximized = (id: string) => maximizedId === id;
  const mainGridClass = `grid gap-4 flex-1 min-h-0 w-full transition-all duration-300 ${
    anyMaximized ? 'grid-cols-1 p-0' : 'grid-cols-1 lg:grid-cols-3 p-4'
  }`;
  const leftWrapperClass = anyMaximized && !isMaximized('world') 
    ? 'hidden' 
    : `grid gap-4 min-h-0 ${anyMaximized ? 'h-full grid-rows-1' : 'lg:col-span-2 grid-rows-[1fr_auto]'}`;
  const rightWrapperClass = anyMaximized && !['stats', 'tree', 'log'].includes(maximizedId)
    ? 'hidden'
    : `grid gap-4 min-h-0 ${anyMaximized ? 'h-full grid-rows-1' : 'col-span-1 grid-rows-[minmax(200px,1fr)_minmax(300px,2fr)_minmax(150px,1fr)]'}`;
  const getItemClass = (id: string) => anyMaximized ? (isMaximized(id) ? 'h-full w-full' : 'hidden') : 'h-full w-full';

  return (
    <div className="h-screen bg-gray-950 flex flex-col font-sans text-gray-100 overflow-hidden">
      {!anyMaximized && (
        <header className="flex justify-between items-center p-4 pb-2 border-b border-gray-800 shrink-0 bg-gray-950 z-10">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
              EvoWorld 2D
            </h1>
          </div>
          <div className="flex gap-2 bg-gray-900 p-1 rounded-lg border border-gray-800">
              <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`p-2 rounded hover:bg-gray-700 transition ${isPlaying ? 'text-yellow-400' : 'text-green-400'}`}
                  title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                  onClick={() => setSpeed(s => s === 1 ? 2 : s === 2 ? 5 : 1)}
                  className="p-2 rounded hover:bg-gray-700 text-blue-400 transition flex items-center gap-1 font-mono text-xs w-16 justify-center"
              >
                  <FastForward size={18} />
                  <span>{speed}x</span>
              </button>
              <div className="w-px bg-gray-700 mx-1"></div>
              <button onClick={handleReset} className="p-2 rounded hover:bg-red-900/50 text-red-400 transition">
                  <RefreshCw size={18} />
              </button>
          </div>
        </header>
      )}

      <main className={mainGridClass}>
        <div className={leftWrapperClass}>
            <DashboardCard 
              id="world" 
              title="Simulation View" 
              maximizedId={maximizedId} 
              onToggleMaximize={toggleMaximize}
              className={getItemClass('world')}
            >
              <WorldCanvas simulation={simulationRef.current} speedMultiplier={isPlaying ? speed : 0} />
            </DashboardCard>

            {!anyMaximized && (
              <div className="grid grid-cols-4 gap-4 h-24 shrink-0">
                  <div className="bg-gray-800 p-3 rounded border border-gray-700 flex flex-col justify-center">
                      <div className="text-gray-500 text-[10px] uppercase font-bold">Time</div>
                      <div className="text-xl font-mono">{hudStats.time}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border border-gray-700 flex flex-col justify-center">
                      <div className="text-gray-500 text-[10px] uppercase font-bold">Population</div>
                      <div className="text-xl font-mono text-green-400">{hudStats.population}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border border-gray-700 flex flex-col justify-center">
                      <div className="text-gray-500 text-[10px] uppercase font-bold">Species</div>
                      <div className="text-xl font-mono text-blue-400">{hudStats.species}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border border-gray-700 flex flex-col justify-center">
                      <div className="text-gray-500 text-[10px] uppercase font-bold">Extinct</div>
                      <div className="text-xl font-mono text-red-400">
                          {Array.from(simulationRef.current.species.values()).filter(s => s.extinct).length}
                      </div>
                  </div>
              </div>
            )}
        </div>

        <div className={rightWrapperClass}>
            <DashboardCard 
              id="stats" 
              title="Population History" 
              maximizedId={maximizedId} 
              onToggleMaximize={toggleMaximize}
              className={getItemClass('stats')}
            >
               <StatsPanel data={statsHistory} />
            </DashboardCard>

            <DashboardCard 
              id="tree" 
              title="Evolutionary Tree" 
              maximizedId={maximizedId} 
              onToggleMaximize={toggleMaximize}
              className={getItemClass('tree')}
            >
              <SpeciesTree speciesMap={speciesSnapshot} />
            </DashboardCard>
            
            <DashboardCard 
              id="log" 
              title="Simulation Log" 
              icon={<Activity size={14} />}
              maximizedId={maximizedId} 
              onToggleMaximize={toggleMaximize}
              className={getItemClass('log')}
            >
              <div className="h-full p-4 overflow-y-auto font-mono text-xs space-y-1 bg-gray-900 scrollbar-thin scrollbar-thumb-gray-700">
                  {logs.length === 0 && <p className="text-gray-600 italic">Waiting for events...</p>}
                  {logs.map((log) => (
                      <p key={log.id}>
                          {log.color && <span style={{color: log.color}}>● </span>}
                          <span className={log.type === 'extinct' ? 'text-red-400' : log.type === 'system' ? 'text-yellow-500' : 'text-gray-300'}>
                              {log.message}
                          </span>
                      </p>
                  ))}
              </div>
            </DashboardCard>
        </div>
      </main>
    </div>
  );
};

export default App;