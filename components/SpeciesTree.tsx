import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Species, TreeNode } from '../types';
import { Filter, Ban, RotateCcw } from 'lucide-react';

interface Props {
  speciesMap: Map<string, Species>;
}

// Internal type for processing
interface TreeData extends TreeNode {
  children?: TreeData[];
}

const SpeciesTree: React.FC<Props> = ({ speciesMap }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });
  const [showExtinct, setShowExtinct] = useState(false); // Default false to prevent clutter
  
  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // One-time setup for Zoom
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    // Create container group if not exists
    let g = svg.select<SVGGElement>(".zoom-layer");
    if (g.empty()) {
        g = svg.append("g").attr("class", "zoom-layer");
    }

    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);
  }, []); // Run once

  // Helper to reset zoom
  const handleResetZoom = () => {
      if (!svgRef.current) return;
      const svg = d3.select(svgRef.current);
      const zoom: any = d3.zoom().scaleExtent([0.1, 4]).on("zoom", (event) => {
          svg.select(".zoom-layer").attr("transform", event.transform);
      });
      // Reset transform
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(60, dimensions.height / 2).scale(1));
  };

  // Build and Filter Data
  const rootData = useMemo(() => {
      // 1. Convert Map to Hierarchy
      const nodes = new Map<string, TreeData>();
      const roots: TreeData[] = [];

      // Create nodes
      speciesMap.forEach(s => {
          nodes.set(s.id, {
              name: s.name,
              attributes: { count: s.count, extinct: s.extinct, color: s.color },
              children: []
          });
      });

      // Link children
      speciesMap.forEach(s => {
          if (s.parentId) {
              const parent = nodes.get(s.parentId);
              const self = nodes.get(s.id);
              if (parent && self) {
                  parent.children?.push(self);
              }
          } else {
              const root = nodes.get(s.id);
              if (root) roots.push(root);
          }
      });

      if (roots.length === 0) return null;
      // Assume single origin for this simulation
      const fullTree = roots[0];

      // 2. Filter if needed
      if (showExtinct) return fullTree;

      // Pruning Logic: Keep node if it has count > 0 OR has a kept child
      const prune = (node: TreeData): TreeData | null => {
          const isAlive = (node.attributes?.count || 0) > 0;
          
          let keptChildren: TreeData[] = [];
          if (node.children) {
              keptChildren = node.children.map(prune).filter((c): c is TreeData => c !== null);
          }

          if (isAlive || keptChildren.length > 0) {
              return { ...node, children: keptChildren };
          }
          return null;
      };

      return prune(fullTree);

  }, [speciesMap, showExtinct]);


  // Draw Tree
  useEffect(() => {
    if (!svgRef.current || !rootData) return;
    
    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    const g = svg.select(".zoom-layer");
    
    // Clear previous contents of the group
    g.selectAll("*").remove();

    // Layout
    const root = d3.hierarchy<TreeData>(rootData);
    
    // Tree Layout
    // Use a fixed size layout to prevent overlap
    const treeLayout = d3.tree<TreeData>()
        .nodeSize([25, 100]) // Fixed node size: 25px height, 100px width
        .separation((a, b) => (a.parent === b.parent ? 1 : 1.2));
    
    treeLayout(root);

    // Render Links
    g.selectAll(".link")
      .data(root.links())
      .enter().append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#555")
      .attr("stroke-width", 1.5)
      .attr("d", d3.linkHorizontal()
        .x((d: any) => d.y)
        .y((d: any) => d.x) as any
      );

    // Render Nodes
    const node = g.selectAll(".node")
      .data(root.descendants())
      .enter().append("g")
      .attr("class", d => "node" + (d.children ? " node--internal" : " node--leaf"))
      .attr("transform", (d: any) => `translate(${d.y},${d.x})`);

    // Circle
    node.append("circle")
      .attr("r", (d: any) => {
          const count = d.data.attributes?.count || 0;
          return count > 0 ? Math.min(10, 3 + (count / 10)) : 3;
      })
      .attr("fill", (d: any) => d.data.attributes?.extinct ? "#4b5563" : d.data.attributes?.color)
      .attr("stroke", (d: any) => d.data.attributes?.count > 0 ? "#fff" : "none")
      .attr("stroke-width", 1.5);

    // Labels (only if active or has few nodes to reduce clutter)
    node.append("text")
      .attr("dy", 3)
      .attr("x", (d: any) => d.children ? -12 : 12)
      .style("text-anchor", (d: any) => d.children ? "end" : "start")
      .text((d: any) => d.data.name)
      .attr("fill", (d: any) => d.data.attributes?.extinct ? "#6b7280" : "#e5e7eb")
      .style("font-size", "10px")
      .style("font-family", "monospace")
      .style("text-shadow", "0 1px 2px black");

    // Add tooltips via simple title for now
    node.append("title")
        .text((d: any) => `${d.data.name}\nPop: ${d.data.attributes?.count}\nExtinct: ${d.data.attributes?.extinct}`);

  }, [rootData, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full relative group">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="block w-full h-full bg-gray-900/50 cursor-move"></svg>
      
      {/* Controls Overlay */}
      <div className="absolute top-2 right-2 flex flex-col gap-2 bg-gray-800/80 p-2 rounded border border-gray-700 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button 
            onClick={() => setShowExtinct(!showExtinct)}
            className={`p-2 rounded transition flex items-center gap-2 text-xs ${showExtinct ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
            title={showExtinct ? "Hide Extinct Branches" : "Show All History"}
        >
            {showExtinct ? <Filter size={14} /> : <Ban size={14} />}
        </button>
        <button 
            onClick={handleResetZoom}
            className="p-2 rounded bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white transition"
            title="Reset View"
        >
            <RotateCcw size={14} />
        </button>
      </div>

      {!showExtinct && (
          <div className="absolute bottom-2 left-2 text-[10px] text-gray-500 pointer-events-none">
              Filtering extinct branches...
          </div>
      )}
    </div>
  );
};

export default SpeciesTree;