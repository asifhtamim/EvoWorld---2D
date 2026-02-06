import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Species, TreeNode } from '../types';

interface Props {
  speciesMap: Map<string, Species>;
}

const SpeciesTree: React.FC<Props> = ({ speciesMap }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });

  // Handle Resize using ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize) {
          // Firefox implements `contentBoxSize` as a single content rect, rather than an array
          const contentBoxSize = Array.isArray(entry.contentBoxSize) ? entry.contentBoxSize[0] : entry.contentBoxSize;
          setDimensions({
            width: contentBoxSize.inlineSize,
            height: contentBoxSize.blockSize,
          });
        } else {
            setDimensions({
                width: entry.contentRect.width,
                height: entry.contentRect.height,
            });
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Handle Draw
  useEffect(() => {
    if (!svgRef.current || speciesMap.size === 0) return;
    
    // 1. Build Hierarchy Data
    const buildTree = (): TreeNode | null => {
        const roots: Species[] = [];
        const map = new Map<string, TreeNode>();
        
        speciesMap.forEach(s => {
            map.set(s.id, { 
                name: s.name, 
                attributes: { count: s.count, extinct: s.extinct, color: s.color },
                children: [] 
            });
            if (!s.parentId) roots.push(s);
        });

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
        return map.get(roots[0].id) || null;
    };

    const data = buildTree();
    if (!data) return;

    // 2. D3 Render
    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (width === 0 || height === 0) return;

    const root = d3.hierarchy(data);
    
    // Adjust layout size 
    const treeLayout = d3.tree<TreeNode>().size([height - 60, width - 120]);
    treeLayout(root);

    const g = svg.append("g").attr("transform", "translate(60,30)");

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
      .attr("r", (d: any) => d.data.attributes.count > 0 ? 5 + (d.data.attributes.count / 3) : 3)
      .attr("fill", (d: any) => d.data.attributes.extinct ? "#333" : d.data.attributes.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1);

    node.append("text")
      .attr("dy", 3)
      .attr("x", (d: any) => d.children ? -10 : 10)
      .style("text-anchor", (d: any) => d.children ? "end" : "start")
      .text((d: any) => d.data.name)
      .attr("fill", "#ccc")
      .style("font-size", "11px")
      .style("font-weight", "bold");

  }, [speciesMap, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[300px] overflow-hidden">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="block"></svg>
    </div>
  );
};

export default SpeciesTree;