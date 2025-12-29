import React, { useEffect, useRef } from 'react';
import { Graph, Path } from '@antv/x6';
import { register } from '@antv/x6-react-shape';
import { DagreLayout } from '@antv/layout';
import { Scroller } from '@antv/x6-plugin-scroller';
import '@antv/x6-plugin-scroller/es/index.css'; // 引入 Scroller 样式
import { ODataSchema, ODataEntity } from '../types';
import EntityNode from './EntityNode';

// 注册自定义 React 节点
register({
  shape: 'entity-node',
  width: 240, 
  height: 300, // 初始高度，后续会根据内容动态调整
  effect: ['data'],
  component: EntityNode,
});

// 自定义连线连接器 - 跳线风格（可选，暂时用 rounded）
Graph.registerConnector(
  'rounded',
  (sourcePoint, targetPoint, routePoints, options) => {
    const path = new Path();
    path.appendSegment(Path.createSegment('M', sourcePoint));
    if (routePoints && routePoints.length) {
      routePoints.forEach((p) => {
        path.appendSegment(Path.createSegment('L', p));
      });
    }
    path.appendSegment(Path.createSegment('L', targetPoint));
    return path.serialize();
  },
  true,
);

interface ERDiagramProps {
  schema: ODataSchema;
}

const estimateHeight = (entity: ODataEntity) => {
    // Header 40
    // PKs * 30
    // Props * 28 (max 10) + footer
    // Navs * 28
    const pkH = entity.keys.length * 30;
    const otherProps = entity.properties.filter(p => !entity.keys.includes(p.name));
    const propH = Math.min(otherProps.length, 10) * 28 + (otherProps.length > 10 ? 20 : 0);
    const navH = entity.navigationProperties.length * 28;
    return 40 + pkH + propH + navH + 20 + 20; // + padding
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
        minScale: 0.1,
      },
      zooming: {
        enabled: true,
      },
      background: {
        color: '#f8fafc', // slate-50
      },
      grid: {
        visible: true,
        type: 'doubleMesh',
        args: [
          { color: '#e2e8f0', thickness: 1 }, // secondary
          { color: '#cbd5e1', thickness: 1, factor: 4 }, // primary
        ],
      },
      connecting: {
        router: {
            name: 'manhattan', // 曼哈顿直角路由
            args: {
                offset: 'center',
                padding: 20, // 避让距离
            }
        },
        connector: {
          name: 'rounded',
          args: {
            radius: 8,
          },
        },
        anchor: 'center',
        connectionPoint: 'boundary', // 连接到包围盒边界
        allowBlank: false,
      },
      interaction: {
        nodeMovable: true,
      }
    });

    graph.use(
        new Scroller({
            enabled: true,
            pannable: true,
            pageVisible: false,
            pageBreak: false,
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
            width: 260,
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
                const edgeColor = isCollection ? '#3b82f6' : '#10b981'; // 蓝 / 绿
                
                edges.push({
                    id: `${entity.name}-${nav.name}-${targetId}`,
                    source: { 
                        cell: entity.name, 
                        // 关键：尝试连接到具体的导航属性行
                        selector: `[id="nav-${nav.name}"]`
                    },
                    target: targetId,
                    zIndex: isCollection ? 10 : 1,
                    attrs: {
                        line: {
                            stroke: edgeColor,
                            strokeWidth: isCollection ? 2 : 1.5,
                            targetMarker: {
                                name: 'block',
                                width: 8,
                                height: 8,
                                offset: 0, 
                            },
                        },
                    },
                    labels: [
                        {
                            attrs: {
                                label: {
                                    text: isCollection ? '1..N' : '1..1',
                                    fill: edgeColor,
                                    fontSize: 10,
                                    fontWeight: 'bold',
                                },
                                body: {
                                    fill: '#ffffff',
                                    stroke: edgeColor,
                                    strokeWidth: 1,
                                    rx: 4,
                                    ry: 4,
                                    refWidth: '140%',
                                    refHeight: '130%',
                                    refX: '-20%',
                                    refY: '-15%',
                                }
                            },
                            position: 0.5, // 标签在中间
                        }
                    ]
                });
            }
        });
    });

    // 3. 计算布局 (Dagre)
    const dagreLayout = new DagreLayout({
        type: 'dagre',
        rankdir: 'LR',
        align: 'UL',
        ranksep: 100, // 层级间距
        nodesep: 60,  // 节点垂直间距
        controlPoints: true,
    });

    const model = dagreLayout.layout({
        nodes: nodes,
        edges: edges.map(e => ({ source: e.source.cell || e.source, target: e.target, id: e.id })), 
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
        graph.zoomToFit({ padding: 40, maxScale: 1.5 });
    }, 100);

    return () => {
      graph.dispose();
    };
  }, [schema]);

  return (
    <div className="w-full h-full relative">
        <div ref={containerRef} className="w-full h-full" />
        
        {/* 控制面板 */}
        <div className="absolute top-4 right-4 flex gap-2 bg-white/90 p-1.5 rounded-lg shadow-md border border-slate-200 backdrop-blur-sm z-10">
            <button 
                onClick={() => graphRef.current?.zoomToFit({ padding: 40, maxScale: 1.5 })}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition"
            >
                Fit
            </button>
            <button 
                onClick={() => graphRef.current?.zoom(0.1)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition"
            >
                +
            </button>
            <button 
                onClick={() => graphRef.current?.zoom(-0.1)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition"
            >
                -
            </button>
        </div>
    </div>
  );
};

export default ERDiagram;