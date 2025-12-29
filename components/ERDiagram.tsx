import React, { useMemo, useState } from 'react';
import { ODataEntity, ODataSchema } from '../types';

interface ERDiagramProps {
  schema: ODataSchema;
}

// 简单的 SVG ER 图组件
const ERDiagram: React.FC<ERDiagramProps> = ({ schema }) => {
  const [zoom, setZoom] = useState(1);
  
  // 1. 计算布局 (圆形布局算法)
  const { nodes, links, width, height } = useMemo(() => {
    const entities = schema.entities;
    const count = entities.length;
    // 动态调整画布大小
    const radius = Math.max(300, count * 35); 
    const cx = radius + 200;
    const cy = radius + 100;
    const w = cx * 2;
    const h = cy * 2;

    const nodePositions = entities.map((entity, i) => {
      const angle = (i / count) * 2 * Math.PI;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      return { entity, x, y, id: entity.name };
    });

    const links: any[] = [];
    nodePositions.forEach(sourceNode => {
      sourceNode.entity.navigationProperties.forEach(nav => {
        // 解析目标类型，例如 "Collection(NorthwindModel.Product)" -> "Product"
        // 或者 "NorthwindModel.Category" -> "Category"
        let targetName = nav.type;
        if (targetName.startsWith('Collection(')) {
            targetName = targetName.substring(11, targetName.length - 1);
        }
        targetName = targetName.split('.').pop() || targetName;

        const targetNode = nodePositions.find(n => n.entity.name === targetName);
        
        if (targetNode) {
          links.push({
            source: sourceNode,
            target: targetNode,
            name: nav.name
          });
        }
      });
    });

    return { nodes: nodePositions, links, width: w, height: h };
  }, [schema]);

  return (
    <div className="w-full h-full overflow-auto bg-slate-50 relative cursor-grab active:cursor-grabbing">
      <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="bg-white border border-slate-300 p-2 rounded shadow text-slate-600 hover:bg-slate-50">-</button>
          <span className="bg-white border border-slate-300 px-3 py-2 rounded shadow text-slate-600 min-w-[3rem] text-center">{(zoom * 100).toFixed(0)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="bg-white border border-slate-300 p-2 rounded shadow text-slate-600 hover:bg-slate-50">+</button>
      </div>

      <div style={{ width: width * zoom, height: height * zoom, transformOrigin: '0 0', transform: `scale(${zoom})` }}>
      <svg width={width} height={height} className="block">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
          </marker>
        </defs>

        {/* 连线 */}
        {links.map((link, i) => {
            // 计算简单的贝塞尔曲线
            const dx = link.target.x - link.source.x;
            const dy = link.target.y - link.source.y;
            const midX = (link.source.x + link.target.x) / 2;
            const midY = (link.source.y + link.target.y) / 2;
            // 稍微弯曲
            const offset = 50; 
            
            return (
                <g key={i}>
                    <path 
                        // 这里为了简单，使用直线，优化可以使用 Q 指令做曲线
                        d={`M${link.source.x},${link.source.y} L${link.target.x},${link.target.y}`}
                        stroke="#cbd5e1" 
                        strokeWidth="1.5"
                        fill="none"
                        markerEnd="url(#arrowhead)"
                    />
                     {/* 关系名 */}
                     <text x={midX} y={midY} textAnchor="middle" fill="#94a3b8" fontSize="10" className="bg-white">{link.name}</text>
                </g>
            );
        })}

        {/* 节点 (实体) */}
        {nodes.map((node, i) => (
          <g key={i} transform={`translate(${node.x},${node.y})`}>
            {/* 阴影 */}
            <rect x="-80" y="-30" width="160" height="60" rx="8" fill="#000" fillOpacity="0.05" transform="translate(4,4)" />
            {/* 卡片背景 */}
            <rect x="-80" y="-30" width="160" height="60" rx="8" fill="white" stroke={node.entity.keys.length > 0 ? '#6366f1' : '#cbd5e1'} strokeWidth="2" />
            
            {/* 实体名 */}
            <text x="0" y="-5" textAnchor="middle" fontWeight="bold" fill="#334155" fontSize="14" style={{ pointerEvents: 'none' }}>
                {node.entity.name}
            </text>
            {/* 属性计数 */}
            <text x="0" y="15" textAnchor="middle" fill="#64748b" fontSize="10" style={{ pointerEvents: 'none' }}>
                {node.entity.properties.length} Props · {node.entity.navigationProperties.length} Rels
            </text>
          </g>
        ))}
      </svg>
      </div>
    </div>
  );
};

export default ERDiagram;