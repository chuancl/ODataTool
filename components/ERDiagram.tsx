import React, { useMemo, useEffect, useCallback } from 'react';
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

// --- 布局算法区域 ---

// 1. 获取 Dagre 实例 (兼容处理)
const getDagreGraph = () => {
    try {
        // @ts-ignore
        if (dagre.graphlib) return new dagre.graphlib.Graph();
        // @ts-ignore
        if (dagre.default && dagre.default.graphlib) return new dagre.default.graphlib.Graph();
        // @ts-ignore
        return new dagre.Graph(); 
    } catch(e) {
        console.warn("Dagre load failed, fallback to grid layout.", e);
        return null;
    }
};

// 2. 智能布局 (Dagre)
const getSmartLayout = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = getDagreGraph();
  if (!dagreGraph) return null;

  dagreGraph.setDefaultEdgeLabel(() => ({}));
  // 增加节点间距，避免连线穿过节点
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 150, ranksep: 350 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 300, height: 400 }); 
  });

  const nodeIds = new Set(nodes.map(n => n.id));
  const validEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  validEdges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  try {
      // @ts-ignore
      if (dagre.layout) {
          // @ts-ignore
          dagre.layout(dagreGraph);
      } else if ((dagre as any).default?.layout) {
          (dagre as any).default.layout(dagreGraph);
      } else {
          return null;
      }
  } catch (e) {
      console.error("Dagre layout calculation failed", e);
      return null;
  }

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 150,
        y: nodeWithPosition.y - 200,
      },
      targetPosition: 'left',
      sourcePosition: 'right',
    };
  });
};

// 3. 简易网格布局 (兜底方案)
const getGridLayout = (nodes: Node[]) => {
    const COLUMNS = 4;
    const X_SPACING = 350;
    const Y_SPACING = 450;
    
    return nodes.map((node, index) => ({
        ...node,
        position: {
            x: (index % COLUMNS) * X_SPACING,
            y: Math.floor(index / COLUMNS) * Y_SPACING
        },
        targetPosition: 'left',
        sourcePosition: 'right',
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
                    rawEdges.push({
                        id: edgeId,
                        source: entity.name,
                        target: targetId,
                        type: 'smoothstep', // 使用直角折线，比默认的 bezier 更适合 ER 图
                        animated: false,
                        zIndex: 1000, // 确保连线在顶层
                        label: isCollection ? '1..N' : '1..1',
                        labelStyle: { fill: '#0ea5e9', fontWeight: 800, fontSize: 11 },
                        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.85, rx: 4, ry: 4 },
                        style: { stroke: '#0ea5e9', strokeWidth: 2 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#0ea5e9' },
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
                fitView({ padding: 0.2, duration: 600 });
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
            minZoom={0.05}
            maxZoom={2}
            defaultEdgeOptions={{ type: 'smoothstep' }}
            proOptions={{ hideAttribution: true }}
            className="bg-slate-50"
        >
            <Background color="#cbd5e1" gap={25} size={1} />
            <Controls />
            <Panel position="top-right" className="flex gap-2">
                <button 
                    onClick={() => {
                        const gridNodes = getGridLayout(nodes);
                        setNodes(gridNodes);
                        setTimeout(() => fitView({ duration: 500 }), 50);
                    }}
                    className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-xs font-bold text-slate-600 hover:text-indigo-600"
                >
                    Grid Layout
                </button>
                <button 
                    onClick={() => fitView({ padding: 0.2, duration: 500 })}
                    className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-xs font-bold text-slate-600 hover:text-indigo-600"
                >
                    Fit View
                </button>
            </Panel>
        </ReactFlow>
    );
};

const ERDiagram: React.FC<ERDiagramProps> = (props) => {
    return (
        <div className="w-full h-full flex-1 relative min-h-[500px] bg-slate-50">
            <ReactFlowProvider>
                <ERDiagramInner {...props} />
            </ReactFlowProvider>
        </div>
    );
};

export default ERDiagram;
