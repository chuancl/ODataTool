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
  // 直角连线 (Step) 需要更大的间距来避免重叠
  // ranksep: 层与层之间的水平距离 -> 设大一点，给连线转折留空间
  // nodesep: 同层节点之间的垂直距离 -> 设大一点，防止线穿过节点
  dagreGraph.setGraph({ 
      rankdir: 'LR', 
      nodesep: 150, 
      ranksep: 350,
      marginx: 50,
      marginy: 50
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 320, height: 400 }); 
  });

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
        x: nodeWithPosition.x - 160, 
        y: nodeWithPosition.y - 200,
      },
    };
  });
};

const getGridLayout = (nodes: Node[]) => {
    const COLUMNS = 4;
    const X_SPACING = 450;
    const Y_SPACING = 550;
    
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
                const isCollection = rawTargetType.startsWith('Collection(');
                if (isCollection) {
                    rawTargetType = rawTargetType.substring(11, rawTargetType.length - 1);
                }

                let targetId = entityMap.get(rawTargetType);
                if (!targetId) {
                    const shortName = rawTargetType.split('.').pop();
                    if (shortName && entityMap.has(shortName)) {
                        targetId = entityMap.get(shortName);
                    }
                }

                if (targetId && entityMap.has(targetId)) {
                    const edgeId = `${entity.name}-${nav.name}-${targetId}`;
                    
                    // --- 核心样式逻辑 ---
                    // Collection (1:N): 蓝色 (#3b82f6), 粗线条
                    // Single (1:1): 绿色 (#10b981), 细线条, 虚线可选(这里暂用实线区分粗细)
                    const edgeColor = isCollection ? '#3b82f6' : '#10b981';
                    const edgeWidth = isCollection ? 2 : 1.5;
                    
                    rawEdges.push({
                        id: edgeId,
                        source: entity.name,
                        target: targetId,
                        sourceHandle: nav.name, 
                        targetHandle: 'target-input', 
                        
                        // 关键修改：使用 'step' 直角连线
                        type: 'step', 
                        
                        animated: false,
                        zIndex: isCollection ? 5 : 1, // 重要的线在上面
                        label: isCollection ? '1..N' : '1..1',
                        
                        // 标签样式跟随线条颜色
                        labelStyle: { fill: edgeColor, fontWeight: 700, fontSize: 10 }, 
                        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95, stroke: edgeColor, strokeWidth: 0.5, rx: 2, ry: 2 },
                        
                        style: { 
                            stroke: edgeColor, 
                            strokeWidth: edgeWidth,
                        },
                        
                        // 箭头颜色一致
                        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
                    });
                }
            });
        });

        let layoutedNodes = getSmartLayout(rawNodes, rawEdges);
        if (!layoutedNodes) {
            layoutedNodes = getGridLayout(rawNodes);
        }

        setNodes(layoutedNodes);
        setEdges(rawEdges);

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
            // 默认连接线也设为直角
            connectionLineType={ConnectionLineType.Step}
            fitView
            minZoom={0.1}
            maxZoom={4}
            defaultEdgeOptions={{ type: 'step' }} 
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
