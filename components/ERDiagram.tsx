import React, { useEffect, useRef } from 'react';
import { Graph, Path } from '@antv/x6';
import { register } from '@antv/x6-react-shape';
import { DagreLayout } from '@antv/layout';
import { Scroller } from '@antv/x6-plugin-scroller';
import '@antv/x6-plugin-scroller/es/index.css';
import { ODataSchema, ODataEntity } from '../types';
import EntityNode from './EntityNode';

// 注册自定义节点
register({
  shape: 'entity-node',
  width: 260,
  height: 200, // 初始高度，会被覆盖
  effect: ['data'],
  component: EntityNode,
});

// 跳线连接器
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

// === 高度常量配置 (必须与 EntityNode CSS 完全一致) ===
const CONSTANTS = {
    HEADER_HEIGHT: 42,
    PK_ROW_HEIGHT: 32,
    PROP_ROW_HEIGHT: 28,
    NAV_HEADER_HEIGHT: 28,
    NAV_ROW_HEIGHT: 28,
    BORDER_WIDTH: 2, // 边框微调
};

// 计算节点总高度和端口位置
const calculateNodeLayout = (entity: ODataEntity) => {
    const pkCount = entity.keys.length;
    const otherProps = entity.properties.filter(p => !entity.keys.includes(p.name));
    const propCount = otherProps.length;
    const navCount = entity.navigationProperties.length;

    const visibleProps = Math.min(propCount, 8);
    const hasMoreProps = propCount > 8;

    // 1. 计算总高度
    let height = CONSTANTS.HEADER_HEIGHT;
    height += pkCount * CONSTANTS.PK_ROW_HEIGHT;
    height += visibleProps * CONSTANTS.PROP_ROW_HEIGHT;
    if (hasMoreProps) height += CONSTANTS.PROP_ROW_HEIGHT; // More row
    
    // 记录导航栏开始的 Y 坐标
    const navStartY = height + CONSTANTS.NAV_HEADER_HEIGHT;

    if (navCount > 0) {
        height += CONSTANTS.NAV_HEADER_HEIGHT;
        height += navCount * CONSTANTS.NAV_ROW_HEIGHT;
    }
    
    // 增加底部 Padding 防止溢出
    height += 4; 

    // 2. 生成端口配置
    const ports: any[] = [];
    
    // 添加左侧唯一的“入口”端口 (垂直居中)
    ports.push({
        id: 'in-port',
        group: 'left',
    });

    // 为每个导航属性添加右侧“出口”端口
    entity.navigationProperties.forEach((nav, index) => {
        // 计算端口在节点内的相对 Y 坐标：导航起始 Y + (行索引 * 行高) + (行高 / 2)
        const y = navStartY + (index * CONSTANTS.NAV_ROW_HEIGHT) + (CONSTANTS.NAV_ROW_HEIGHT / 2);
        
        ports.push({
            id: `out-${nav.name}`,
            group: 'right-absolute', // 使用自定义的绝对定位组
            args: {
                y: y, // 关键：绝对 Y 坐标
            },
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
      // 端口布局组定义
      ports: {
          groups: {
              'left': {
                  position: 'left', // 左侧中心
                  attrs: {
                      circle: { r: 3, magnet: true, stroke: '#64748b', strokeWidth: 1, fill: '#fff' },
                  },
              },
              'right-absolute': {
                  position: 'absolute', // 绝对定位，由 args.y 控制
                  attrs: {
                      circle: { r: 3, magnet: true, stroke: '#64748b', strokeWidth: 1, fill: '#fff' },
                  },
                  args: { x: '100%' }, // 固定在右侧边缘
              },
          },
      },
      connecting: {
        router: {
            name: 'manhattan', // 曼哈顿正交路由
            args: {
                padding: 24, // 增加绕行间距
                step: 12,
            }
        },
        connector: {
            name: 'jumpover', // 跳线
            args: { radius: 4 },
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

    // --- 构建数据 ---
    const nodes: any[] = [];
    const edges: any[] = [];
    const entityMap = new Map<string, string>();

    schema.entities.forEach(e => {
        entityMap.set(e.name, e.name);
        if (schema.namespace) entityMap.set(`${schema.namespace}.${e.name}`, e.name);
    });

    // 1. 生成节点
    schema.entities.forEach((entity) => {
        const { height, ports } = calculateNodeLayout(entity);
        
        nodes.push({
            id: entity.name,
            shape: 'entity-node',
            width: 260,
            height: height,
            ports: ports, // 注入端口
            data: { entity },
        });
    });

    // 2. 生成连线
    schema.entities.forEach((entity) => {
        entity.navigationProperties.forEach((nav) => {
            let rawTargetType = nav.type;
            const isCollection = rawTargetType.startsWith('Collection(');
            if (isCollection) rawTargetType = rawTargetType.substring(11, rawTargetType.length - 1);

            let targetId = entityMap.get(rawTargetType);
            // 尝试模糊匹配
            if (!targetId) {
                const shortName = rawTargetType.split('.').pop();
                if (shortName && entityMap.has(shortName)) targetId = entityMap.get(shortName);
            }

            if (targetId && entityMap.has(targetId)) {
                const edgeColor = '#94a3b8'; // Slate-400
                
                edges.push({
                    id: `${entity.name}-${nav.name}-${targetId}`,
                    source: { 
                        cell: entity.name, 
                        port: `out-${nav.name}`, // 从特定的导航属性行端口发出
                    },
                    target: { 
                        cell: targetId,
                        port: 'in-port', // 连接到目标表的左侧中心
                        // 也可以不指定 port，使用 anchor: 'left'
                    },
                    zIndex: 0,
                    attrs: {
                        line: {
                            stroke: edgeColor,
                            strokeWidth: 1.5,
                            targetMarker: {
                                name: isCollection ? 'crow' : 'block', // 1:N 用鸦脚
                                width: 8,
                                height: 8,
                                fill: edgeColor,
                            },
                        },
                    },
                });
            }
        });
    });

    // 3. 布局计算 (Dagre TB)
    const dagreLayout = new DagreLayout({
        type: 'dagre',
        rankdir: 'TB', // 从上到下，这是关键，防止变成长条
        align: undefined, // 居中对齐
        ranksep: 80,   // 层间距 (垂直)
        nodesep: 100,  // 节点间距 (水平)
        controlPoints: true,
        ranker: 'longest-path', // 尝试使层级更紧凑
    });

    const model = dagreLayout.layout({
        nodes: nodes,
        edges: edges.map(e => ({ source: e.source.cell, target: e.target.cell, id: e.id })), 
    });

    // 应用布局
    nodes.forEach(node => {
        const layoutNode = model.nodes?.find((n: any) => n.id === node.id);
        if (layoutNode) {
            node.x = layoutNode.x;
            node.y = layoutNode.y;
        }
    });

    // 4. 渲染
    graph.fromJSON({ nodes, edges });
    
    // 5. 初始视图调整
    setTimeout(() => {
        graph.centerContent();
        graph.zoomToFit({ padding: 60, maxScale: 1.0 });
    }, 100);

    // 交互高亮
    graph.on('node:mouseenter', ({ node }) => {
        const connectedEdges = graph.getConnectedEdges(node);
        connectedEdges.forEach(edge => {
            edge.attr('line/stroke', '#6366f1');
            edge.attr('line/strokeWidth', 2);
            edge.toFront();
        });
    });
    graph.on('node:mouseleave', ({ node }) => {
        const connectedEdges = graph.getConnectedEdges(node);
        connectedEdges.forEach(edge => {
            edge.attr('line/stroke', '#94a3b8');
            edge.attr('line/strokeWidth', 1.5);
        });
    });

    return () => {
      graph.dispose();
    };
  }, [schema]);

  return (
    <div className="w-full h-full relative group">
        <div ref={containerRef} className="w-full h-full" />
        
        {/* 工具栏 */}
        <div className="absolute top-6 right-6 flex flex-col gap-2 bg-white/90 p-1.5 rounded-lg shadow-lg border border-slate-200 backdrop-blur-sm z-10 transition-opacity duration-300">
            <button 
                onClick={() => graphRef.current?.zoomToFit({ padding: 60, maxScale: 1.0 })}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded"
                title="Fit"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            </button>
            <button 
                onClick={() => graphRef.current?.zoom(0.1)}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded"
                title="Zoom In"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <button 
                onClick={() => graphRef.current?.zoom(-0.1)}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded"
                title="Zoom Out"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
        </div>
    </div>
  );
};

export default ERDiagram;