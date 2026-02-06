import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Species, TreeNode } from '../types';

interface Props {
  speciesMap: Map<string, Species>;
}

const SpeciesTree: React.FC<Props> = ({ speciesMap }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    
    // 1. Build Hierarchy Data
    const buildTree = (): TreeNode | null => {
        // Find roots (no parents)
        const roots: Species[] = [];
        const map = new Map<string, TreeNode>();
        
        // Create nodes
        speciesMap.forEach(s => {
            map.set(s.id, { 
                name: s.name, 
                attributes: { count: s.count, extinct: s.extinct, color: s.color },
                children: [] 
            });
            if (!s.parentId) roots.push(s);
        });

        // Link children
        speciesMap.forEach(s => {
            if (s.parentId) {
                const parent = map.get(s.parentId);
                const self = map.get(s.id);
                if (parent && self) {
                    parent.children?.push(self);
                }
            }
        });

        if (roots.length === 0) return null;
        // Assuming single root for now ("Primus")
        return map.get(roots[0].id) || null;
    };

    const data = buildTree();
    if (!data) return;

    // 2. D3 Render
    const width = 400;
    const height = 300;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const root = d3.hierarchy(data);
    const treeLayout = d3.tree<TreeNode>().size([height - 40, width - 100]);
    treeLayout(root);

    const g = svg.append("g").attr("transform", "translate(40,20)");

    // Links
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

    // Nodes
    const node = g.selectAll(".node")
      .data(root.descendants())
      .enter().append("g")
      .attr("class", d => "node" + (d.children ? " node--internal" : " node--leaf"))
      .attr("transform", (d: any) => `translate(${d.y},${d.x})`);

    node.append("circle")
      .attr("r", (d: any) => d.data.attributes.count > 0 ? 5 + (d.data.attributes.count / 5) : 3)
      .attr("fill", (d: any) => d.data.attributes.extinct ? "#333" : d.data.attributes.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1);

    node.append("text")
      .attr("dy", 3)
      .attr("x", (d: any) => d.children ? -8 : 8)
      .style("text-anchor", (d: any) => d.children ? "end" : "start")
      .text((d: any) => d.data.name)
      .attr("fill", "#ccc")
      .style("font-size", "10px");

  }, [speciesMap]);

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <h3 className="text-gray-400 text-sm font-bold mb-2 uppercase">Evolutionary Tree</h3>
      <svg ref={svgRef} width={400} height={300} className="w-full h-auto"></svg>
    </div>
  );
};

export default SpeciesTree;