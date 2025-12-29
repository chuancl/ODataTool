import React, { useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
  ConnectionLineType,
  useReactFlow,
  ReactFlowProvider,
  Panel
} from 'reactflow';
import * as dagre from 'dagre';
import { ODataSchema } from '../types';
import EntityNode from './EntityNode';

const nodeTypes = {
  entity: EntityNode,
};

interface ERDiagramProps {
  schema: ODataSchema;
}

// 增强的 Dagre 加载逻辑，兼容不同的构建环境
const getDagreGraph = () => {
    try {
        // @ts-ignore
        const dagreLib = dagre.default || dagre;
        if (dagreLib && dagreLib.graphlib) {
            return new dagreLib.graphlib.Graph();
        }
        // @ts-ignore
        if (window.dagre && window.dagre.graphlib) {
            // @ts-ignore
            return new window.dagre.graphlib.Graph();
        }
    } catch(e) {
        console.error("Dagre load failed", e);
    }
    return null;
};

const getSmartLayout = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = getDagreGraph();
  if (!dagreGraph) {
      console.warn("Layout engine not found, falling back to grid.");
      return null;
  }

  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // LR: Left to Right 布局
  // nodesep: 同一层级节点垂直间距 (加大以防止垂直连线重叠)
  // ranksep: 层级水平间距 (加大以给连线留出转弯空间)
  dagreGraph.setGraph({ 
      rankdir: 'LR', 
      nodesep: 80, 
      ranksep: 300,
      marginx: 50,
      marginy: 50
  });

  nodes.forEach((node) => {
    // 这里设置节点的估算大小，必须比实际大一点，避免过于拥挤
    dagreGraph.setNode(node.id, { width: 320, height: 400 }); 
  });

  // 过滤掉不在节点列表中的无效连线
  const nodeIds = new Set(nodes.map(n => n.id));
  const validEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  validEdges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  try {
      // @ts-ignore
      const dagreLib = dagre.default || dagre;
      dagreLib.layout(dagreGraph);
  } catch (e) {
      console.error("Layout calculation failed", e);
      return null;
  }

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;
    return {
      ...node,
      targetPosition: 'left',
      sourcePosition: 'right',
      position: {
        x: nodeWithPosition.x - 160, // 居中校正
        y: nodeWithPosition.y - 200,
      },
    };
  });
};

const getGridLayout = (nodes: Node[]) => {
    const COLUMNS = 4;
    const X_SPACING = 400;
    const Y_SPACING = 500;
    
    return nodes.map((node, index) => ({
        ...node,
        position: {
            x: (index % COLUMNS) * X_SPACING,
            y: Math.floor(index / COLUMNS) * Y_SPACING
        },
    }));
};

const ERDiagramInner: React.FC<ERDiagramProps> = ({ schema }) => {
    const { fitView } = useReactFlow();
    
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        if (!schema || !schema.entities || schema.entities.length === 0) {
            setNodes([]);
            setEdges([]);
            return;
        }

        const rawNodes: Node[] = [];
        const rawEdges: Edge[] = [];
        
        // 建立实体映射表，处理命名空间
        const entityMap = new Map<string, string>(); 
        schema.entities.forEach(e => {
            entityMap.set(e.name, e.name);
            if (schema.namespace) {
                entityMap.set(`${schema.namespace}.${e.name}`, e.name);
            }
        });

        schema.entities.forEach((entity) => {
            rawNodes.push({
                id: entity.name,
                type: 'entity',
                data: { entity },
                position: { x: 0, y: 0 }, 
                draggable: true,
            });
        });

        schema.entities.forEach((entity) => {
            entity.navigationProperties.forEach((nav) => {
                let rawTargetType = nav.type;
                // 处理 Collection(Type)
                const isCollection = rawTargetType.startsWith('Collection(');
                if (isCollection) {
                    rawTargetType = rawTargetType.substring(11, rawTargetType.length - 1);
                }

                // 尝试解析目标ID
                let targetId = entityMap.get(rawTargetType);
                if (!targetId) {
                    const shortName = rawTargetType.split('.').pop();
                    if (shortName && entityMap.has(shortName)) {
                        targetId = entityMap.get(shortName);
                    }
                }

                if (targetId && entityMap.has(targetId)) {
                    const edgeId = `${entity.name}-${nav.name}-${targetId}`;
                    
                    rawEdges.push({
                        id: edgeId,
                        source: entity.name,
                        target: targetId,
                        sourceHandle: nav.name, 
                        targetHandle: 'target-input', 
                        type: 'smoothstep', // 使用平滑阶梯线
                        animated: false,
                        zIndex: 1, // 降低连线层级，防止遮挡节点
                        label: isCollection ? '1..N' : '1..1',
                        labelStyle: { fill: '#64748b', fontWeight: 600, fontSize: 10 }, 
                        labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.9, rx: 4, ry: 4 },
                        style: { 
                            stroke: '#94a3b8', // Slate 400 - 稍微深一点的灰色，既清晰又不刺眼
                            strokeWidth: 2 
                        },
                        pathOptions: {
                            borderRadius: 15, // 较小的圆角，看起来更硬朗整洁
                            offset: 20 // 连线离开节点的一段距离
                        },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
                    });
                }
            });
        });

        // 优先尝试智能布局
        let layoutedNodes = getSmartLayout(rawNodes, rawEdges);
        // 如果失败，回退到网格布局
        if (!layoutedNodes) {
            layoutedNodes = getGridLayout(rawNodes);
        }

        setNodes(layoutedNodes);
        setEdges(rawEdges);

        // 延迟执行 fitView 确保渲染完成
        setTimeout(() => {
            window.requestAnimationFrame(() => {
                fitView({ padding: 0.2, duration: 800 });
            });
        }, 100);

    }, [schema, fitView, setNodes, setEdges]);


    if (!schema || !schema.entities || schema.entities.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-slate-400">
                No entities to display.
            </div>
        );
    }

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            connectionLineType={ConnectionLineType.SmoothStep}
            fitView
            minZoom={0.1}
            maxZoom={4}
            defaultEdgeOptions={{ type: 'smoothstep' }}
            proOptions={{ hideAttribution: true }}
            className="bg-slate-50"
        >
            <Background color="#cbd5e1" gap={24} size={1} />
            <Controls className="bg-white shadow-md border border-slate-200 rounded-lg overflow-hidden" />
            <Panel position="top-right" className="flex gap-2">
                <button 
                    onClick={() => {
                        const gridNodes = getGridLayout(nodes);
                        setNodes(gridNodes);
                        setTimeout(() => fitView({ duration: 500 }), 50);
                    }}
                    className="bg-white/90 px-3 py-1.5 rounded-lg shadow-sm border border-slate-300 text-xs font-bold text-slate-700 hover:text-indigo-600 backdrop-blur-sm transition"
                >
                    Grid Layout
                </button>
                <button 
                    onClick={() => {
                         const smartNodes = getSmartLayout(nodes, edges);
                         if(smartNodes) {
                             setNodes(smartNodes);
                             setTimeout(() => fitView({ duration: 800 }), 50);
                         }
                    }}
                    className="bg-white/90 px-3 py-1.5 rounded-lg shadow-sm border border-slate-300 text-xs font-bold text-slate-700 hover:text-indigo-600 backdrop-blur-sm transition"
                >
                    Smart Layout
                </button>
                <button 
                    onClick={() => fitView({ padding: 0.2, duration: 500 })}
                    className="bg-white/90 px-3 py-1.5 rounded-lg shadow-sm border border-slate-300 text-xs font-bold text-slate-700 hover:text-indigo-600 backdrop-blur-sm transition"
                >
                    Fit View
                </button>
            </Panel>
        </ReactFlow>
    );
};

const ERDiagram: React.FC<ERDiagramProps> = (props) => {
    return (
        <div className="w-full h-full flex-1 relative min-h-[500px] bg-slate-100">
            <ReactFlowProvider>
                <ERDiagramInner {...props} />
            </ReactFlowProvider>
        </div>
    );
};

export default ERDiagram;
