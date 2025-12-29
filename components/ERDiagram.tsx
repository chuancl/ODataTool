import React, { useEffect, useRef } from 'react';
import { Graph, Path } from '@antv/x6';
import { register } from '@antv/x6-react-shape';
import { DagreLayout } from '@antv/layout';
import { Scroller } from '@antv/x6-plugin-scroller';
import '@antv/x6-plugin-scroller/es/index.css';
import { ODataSchema, ODataEntity } from '../types';
import EntityNode from './EntityNode';

// 注册自定义 React 节点
register({
  shape: 'entity-node',
  width: 280, 
  height: 200, 
  effect: ['data'],
  component: EntityNode,
});

// 自定义连线连接器 - 跳线风格
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

// 估算节点高度
const estimateHeight = (entity: ODataEntity) => {
    const HEADER_HEIGHT = 44;
    const ROW_HEIGHT = 28;
    const PK_HEIGHT = 34;
    const FOOTER_PADDING = 10;
    const RELATION_HEADER = 24;

    const pkCount = entity.keys.length;
    const propCount = entity.properties.filter(p => !entity.keys.includes(p.name)).length;
    const navCount = entity.navigationProperties.length;

    const visibleProps = Math.min(propCount, 8); 
    const hiddenMsgHeight = propCount > 8 ? 26 : 0;

    let height = HEADER_HEIGHT;
    height += pkCount * PK_HEIGHT;
    height += visibleProps * ROW_HEIGHT;
    height += hiddenMsgHeight;

    if (navCount > 0) {
        height += RELATION_HEADER;
        height += navCount * ROW_HEIGHT; 
    }
    
    return height + FOOTER_PADDING;
};

const ERDiagram: React.FC<ERDiagramProps> = ({ schema }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  useEffect(() => {
    if (!containerRef.current || !schema) return;

    // 1. 初始化 Graph
    const graph = new Graph({
      container: containerRef.current,
      autoResize: true,
      panning: {
        enabled: true,
        eventTypes: ['leftMouseDown', 'mouseWheel'],
      },
      mousewheel: {
        enabled: true,
        modifiers: ['ctrl', 'meta'],
        factor: 1.1,
        maxScale: 3,
        minScale: 0.2,
      },
      zooming: {
        enabled: true,
      },
      background: {
        color: '#f8fafc',
      },
      grid: {
        visible: true,
        type: 'dot',
        args: [
          { color: '#cbd5e1', thickness: 1 }, 
        ],
      },
      connecting: {
        router: {
            name: 'manhattan', // 曼哈顿直角路由
            args: {
                padding: 15, // 路由避让距离
                step: 5,
            }
        },
        connector: {
          name: 'jumpover', // 跳线
          args: {
            radius: 4,
          },
        },
        anchor: 'center',
        connectionPoint: 'boundary',
        allowBlank: false,
        highlight: true,
      },
      interaction: {
        nodeMovable: true,
        edgeMovable: false,
      }
    });

    graph.use(
        new Scroller({
            enabled: true,
            pannable: true,
            pageVisible: false,
            pageBreak: false,
            className: 'custom-scroller',
        }),
    );

    graphRef.current = graph;

    // 2. 准备数据
    const nodes: any[] = [];
    const edges: any[] = [];
    const entityMap = new Map<string, string>();

    schema.entities.forEach(e => {
        entityMap.set(e.name, e.name);
        if (schema.namespace) {
            entityMap.set(`${schema.namespace}.${e.name}`, e.name);
        }
    });

    // 生成节点
    schema.entities.forEach((entity) => {
        nodes.push({
            id: entity.name,
            shape: 'entity-node',
            width: 280,
            height: estimateHeight(entity),
            data: { entity },
        });
    });

    // 生成连线
    schema.entities.forEach((entity) => {
        entity.navigationProperties.forEach((nav) => {
            let rawTargetType = nav.type;
            const isCollection = rawTargetType.startsWith('Collection(');
            if (isCollection) {
                rawTargetType = rawTargetType.substring(11, rawTargetType.length - 1);
            }

            let targetId = entityMap.get(rawTargetType);
            if (!targetId) {
                const shortName = rawTargetType.split('.').pop();
                if (shortName && entityMap.has(shortName)) targetId = entityMap.get(shortName);
            }

            if (targetId && entityMap.has(targetId)) {
                const edgeColor = '#94a3b8'; // Slate-400
                
                // 确保 ID 唯一
                const sourceSelector = `[id="nav-${entity.name}-${nav.name}"]`;

                edges.push({
                    id: `${entity.name}-${nav.name}-${targetId}`,
                    source: { 
                        cell: entity.name, 
                        selector: sourceSelector, // 连接到具体的行
                        anchor: {
                            name: 'right', // 尝试从右侧出线
                            args: { dy: 0 }
                        },
                        connectionPoint: 'anchor',
                    },
                    target: {
                        cell: targetId,
                        anchor: 'left', // 尝试从左侧入线
                        connectionPoint: 'boundary',
                    },
                    zIndex: 0,
                    attrs: {
                        line: {
                            stroke: edgeColor,
                            strokeWidth: 1.5,
                            targetMarker: {
                                name: isCollection ? 'crow' : 'block',
                                width: 6,
                                height: 6,
                                offset: 0,
                                fill: edgeColor,
                            },
                        },
                    },
                    // Label 配置...
                });
            }
        });
    });

    // 3. 计算布局 (Dagre)
    const dagreLayout = new DagreLayout({
        type: 'dagre',
        rankdir: 'TB', // Top to Bottom
        align: 'UL',
        ranksep: 60,   
        nodesep: 60,
        controlPoints: true,
    });

    const model = dagreLayout.layout({
        nodes: nodes,
        edges: edges.map(e => ({ source: e.source.cell || e.source, target: e.target.cell || e.target, id: e.id })), 
    });

    // 应用布局坐标
    nodes.forEach(node => {
        const layoutNode = model.nodes?.find((n: any) => n.id === node.id);
        if (layoutNode) {
            node.x = layoutNode.x;
            node.y = layoutNode.y;
        }
    });

    // 4. 渲染
    graph.fromJSON({ nodes, edges });
    
    // 5. 自动适配
    setTimeout(() => {
        graph.centerContent();
        graph.zoomToFit({ padding: 40, maxScale: 1.2 });
    }, 100);

    // 6. 事件监听：高亮
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
        
        {/* 控制面板 */}
        <div className="absolute top-6 right-6 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
             <div className="flex gap-1 bg-white p-1 rounded-lg shadow-lg border border-slate-100">
                <button 
                    onClick={() => graphRef.current?.zoomToFit({ padding: 40, maxScale: 1.2 })}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
                    title="Fit to Screen"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                </button>
                <button 
                    onClick={() => graphRef.current?.zoom(0.1)}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
                    title="Zoom In"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                </button>
                <button 
                    onClick={() => graphRef.current?.zoom(-0.1)}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
                    title="Zoom Out"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                </button>
            </div>
        </div>
    </div>
  );
};

export default ERDiagram;