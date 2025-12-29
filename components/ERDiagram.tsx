import React, { useEffect, useRef } from 'react';
import { Graph, Path } from '@antv/x6';
import { register } from '@antv/x6-react-shape';
import { DagreLayout } from '@antv/layout';
import { Scroller } from '@antv/x6-plugin-scroller';
import '@antv/x6-plugin-scroller/es/index.css';
import { ODataSchema, ODataEntity } from '../types';
import EntityNode from './EntityNode';

register({
  shape: 'entity-node',
  width: 240, // 稍微缩窄宽度，更紧凑
  height: 200, 
  effect: ['data'],
  component: EntityNode,
});

Graph.registerConnector(
  'jumpover',
  (sourcePoint, targetPoint, routePoints, options) => {
    const path = new Path();
    path.appendSegment(Path.createSegment('M', sourcePoint));
    if (routePoints && routePoints.length) {
       routePoints.forEach(p => path.appendSegment(Path.createSegment('L', p)));
    }
    path.appendSegment(Path.createSegment('L', targetPoint));
    return path.serialize();
  },
  true,
);

interface ERDiagramProps {
  schema: ODataSchema;
}

// === 高度常量配置 (已更新为无图标紧凑模式) ===
// 必须与 EntityNode.tsx 完全对应
const CONSTANTS = {
    HEADER_HEIGHT: 36,
    ROW_HEIGHT: 26,      // 用于 PK, Props, Nav Rows
    NAV_HEADER_HEIGHT: 24,
    BORDER_WIDTH: 2,
};

// 计算节点布局和端口位置
const calculateNodeLayout = (entity: ODataEntity) => {
    const pkCount = entity.keys.length;
    const otherProps = entity.properties.filter(p => !entity.keys.includes(p.name));
    const propCount = otherProps.length;
    const navCount = entity.navigationProperties.length;

    const visibleProps = Math.min(propCount, 10);
    const hasMoreProps = propCount > 10;

    // 1. 计算总高度
    let height = CONSTANTS.HEADER_HEIGHT;
    height += pkCount * CONSTANTS.ROW_HEIGHT;
    height += visibleProps * CONSTANTS.ROW_HEIGHT;
    if (hasMoreProps) height += CONSTANTS.ROW_HEIGHT; // More row
    
    // 导航栏起始位置
    const navStartY = height + CONSTANTS.NAV_HEADER_HEIGHT;

    if (navCount > 0) {
        height += CONSTANTS.NAV_HEADER_HEIGHT;
        height += navCount * CONSTANTS.ROW_HEIGHT;
    }
    
    height += 2; // 底部边框微调

    // 2. 生成端口
    const ports: any[] = [];
    
    // 入口：左侧中心
    ports.push({
        id: 'in-port',
        group: 'left',
    });

    // 出口：每个导航属性行的右侧
    entity.navigationProperties.forEach((nav, index) => {
        const y = navStartY + (index * CONSTANTS.ROW_HEIGHT) + (CONSTANTS.ROW_HEIGHT / 2);
        
        ports.push({
            id: `out-${nav.name}`,
            group: 'right-absolute',
            args: { y: y },
        });
    });

    return { height, ports };
};

const ERDiagram: React.FC<ERDiagramProps> = ({ schema }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  useEffect(() => {
    if (!containerRef.current || !schema) return;

    const graph = new Graph({
      container: containerRef.current,
      autoResize: true,
      panning: true,
      mousewheel: {
        enabled: true,
        modifiers: ['ctrl', 'meta'],
        maxScale: 3,
        minScale: 0.2,
      },
      background: { color: '#f8fafc' },
      grid: {
        visible: true,
        type: 'dot',
        args: [{ color: '#cbd5e1', thickness: 1 }],
      },
      ports: {
          groups: {
              'left': {
                  position: 'left',
                  attrs: {
                      circle: { r: 3, magnet: true, stroke: '#64748b', strokeWidth: 1, fill: '#fff' },
                  },
              },
              'right-absolute': {
                  position: 'absolute',
                  attrs: {
                      circle: { r: 3, magnet: true, stroke: '#64748b', strokeWidth: 1, fill: '#fff' },
                  },
                  args: { x: '100%' },
              },
          },
      },
      connecting: {
        router: {
            name: 'manhattan',
            args: {
                padding: 20,
                step: 10,
            }
        },
        connector: {
            name: 'jumpover',
            args: { radius: 0 }, // 直角，更像经典 ER 图
        },
        anchor: 'center',
        connectionPoint: 'boundary',
      },
      interaction: {
        nodeMovable: true,
        edgeMovable: false,
      }
    });

    graph.use(new Scroller({ enabled: true, pannable: true }));
    graphRef.current = graph;

    const nodes: any[] = [];
    const edges: any[] = [];
    const entityMap = new Map<string, string>();

    schema.entities.forEach(e => {
        entityMap.set(e.name, e.name);
        if (schema.namespace) entityMap.set(`${schema.namespace}.${e.name}`, e.name);
    });

    // 生成节点
    schema.entities.forEach((entity) => {
        const { height, ports } = calculateNodeLayout(entity);
        nodes.push({
            id: entity.name,
            shape: 'entity-node',
            width: 240,
            height: height,
            ports: ports,
            data: { entity },
        });
    });

    // 生成连线
    schema.entities.forEach((entity) => {
        entity.navigationProperties.forEach((nav) => {
            let rawTargetType = nav.type;
            const isCollection = rawTargetType.startsWith('Collection(');
            if (isCollection) rawTargetType = rawTargetType.substring(11, rawTargetType.length - 1);

            let targetId = entityMap.get(rawTargetType);
            if (!targetId) {
                const shortName = rawTargetType.split('.').pop();
                if (shortName && entityMap.has(shortName)) targetId = entityMap.get(shortName);
            }

            if (targetId && entityMap.has(targetId)) {
                // 经典灰黑色连线
                const edgeColor = '#64748b'; 
                
                edges.push({
                    id: `${entity.name}-${nav.name}-${targetId}`,
                    source: { 
                        cell: entity.name, 
                        port: `out-${nav.name}`, 
                    },
                    target: { 
                        cell: targetId,
                        port: 'in-port',
                    },
                    zIndex: 0,
                    attrs: {
                        line: {
                            stroke: edgeColor,
                            strokeWidth: 1, // 细线
                            targetMarker: {
                                name: isCollection ? 'crow' : 'block', // 经典鸦脚
                                width: 8,
                                height: 6,
                                fill: edgeColor,
                            },
                        },
                    },
                });
            }
        });
    });

    // 布局计算
    const dagreLayout = new DagreLayout({
        type: 'dagre',
        rankdir: 'TB', 
        ranksep: 60,
        nodesep: 50,
        controlPoints: true,
    });

    const model = dagreLayout.layout({
        nodes: nodes,
        edges: edges.map(e => ({ source: e.source.cell, target: e.target.cell, id: e.id })), 
    });

    nodes.forEach(node => {
        const layoutNode = model.nodes?.find((n: any) => n.id === node.id);
        if (layoutNode) {
            node.x = layoutNode.x;
            node.y = layoutNode.y;
        }
    });

    graph.fromJSON({ nodes, edges });
    
    setTimeout(() => {
        graph.centerContent();
        graph.zoomToFit({ padding: 40, maxScale: 1.0 });
    }, 100);

    // 简单的高亮效果
    graph.on('node:mouseenter', ({ node }) => {
        const connectedEdges = graph.getConnectedEdges(node);
        connectedEdges.forEach(edge => {
            edge.attr('line/stroke', '#2563eb'); // blue-600
            edge.attr('line/strokeWidth', 2);
            edge.toFront();
        });
    });
    graph.on('node:mouseleave', ({ node }) => {
        const connectedEdges = graph.getConnectedEdges(node);
        connectedEdges.forEach(edge => {
            edge.attr('line/stroke', '#64748b');
            edge.attr('line/strokeWidth', 1);
        });
    });

    return () => {
      graph.dispose();
    };
  }, [schema]);

  return (
    <div className="w-full h-full relative group bg-slate-50">
        <div ref={containerRef} className="w-full h-full" />
        {/* 保留简单的缩放控制 */}
        <div className="absolute top-4 right-4 flex flex-col gap-1 bg-white border border-slate-300 rounded shadow p-1 z-10">
            <button onClick={() => graphRef.current?.zoom(0.1)} className="p-1 hover:bg-slate-100 text-slate-600 font-bold">+</button>
            <button onClick={() => graphRef.current?.zoom(-0.1)} className="p-1 hover:bg-slate-100 text-slate-600 font-bold">-</button>
            <button onClick={() => graphRef.current?.zoomToFit({ padding: 40 })} className="p-1 hover:bg-slate-100 text-slate-600 text-xs">Fit</button>
        </div>
    </div>
  );
};

export default ERDiagram;