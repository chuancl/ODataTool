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

const getDagreGraph = () => {
    try {
        // @ts-ignore
        if (dagre.graphlib) return new dagre.graphlib.Graph();
        // @ts-ignore
        if (dagre.default && dagre.default.graphlib) return new dagre.default.graphlib.Graph();
        // @ts-ignore
        return new dagre.Graph(); 
    } catch(e) {
        return null;
    }
};

const getSmartLayout = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = getDagreGraph();
  if (!dagreGraph) return null;

  dagreGraph.setDefaultEdgeLabel(() => ({}));
  // 调整 rankdir 为 LR (从左到右)，减少间距让布局更紧凑自然
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 200 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 250, height: 300 }); 
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
      return null;
  }

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 125,
        y: nodeWithPosition.y - 150,
      },
    };
  });
};

const getGridLayout = (nodes: Node[]) => {
    // 增加一点随机性，避免过于死板的网格
    const COLUMNS = 5;
    const X_SPACING = 320;
    const Y_SPACING = 400;
    
    return nodes.map((node, index) => ({
        ...node,
        position: {
            x: (index % COLUMNS) * X_SPACING + Math.random() * 50,
            y: Math.floor(index / COLUMNS) * Y_SPACING + Math.random() * 50
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
                    // 确保不指定 sourceHandle 和 targetHandle，让 React Flow 使用 EntityNode 中的默认 Handle
                    rawEdges.push({
                        id: edgeId,
                        source: entity.name,
                        target: targetId,
                        type: 'smoothstep', 
                        animated: false,
                        zIndex: 10, 
                        label: isCollection ? '1..N' : '1..1',
                        labelStyle: { fill: '#3b82f6', fontWeight: 700, fontSize: 10 },
                        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
                        style: { stroke: '#3b82f6', strokeWidth: 2 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
                    });
                }
            });
        });

        let layoutedNodes = getSmartLayout(rawNodes, rawEdges);
        // 如果 Dagre 布局失败（极少情况），使用带随机性的网格布局
        if (!layoutedNodes) {
            layoutedNodes = getGridLayout(rawNodes);
        }

        setNodes(layoutedNodes);
        setEdges(rawEdges);

        setTimeout(() => {
            window.requestAnimationFrame(() => {
                fitView({ padding: 0.1, duration: 800 });
            });
        }, 50);

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
            <Background color="#94a3b8" gap={30} size={1} />
            <Controls />
            <Panel position="top-right" className="flex gap-2">
                <button 
                    onClick={() => {
                        const gridNodes = getGridLayout(nodes);
                        setNodes(gridNodes);
                        setTimeout(() => fitView({ duration: 500 }), 50);
                    }}
                    className="bg-white/90 px-3 py-1.5 rounded-lg shadow-sm border border-slate-300 text-xs font-bold text-slate-700 hover:text-blue-600 backdrop-blur-sm"
                >
                    Free Layout
                </button>
                <button 
                    onClick={() => fitView({ padding: 0.2, duration: 500 })}
                    className="bg-white/90 px-3 py-1.5 rounded-lg shadow-sm border border-slate-300 text-xs font-bold text-slate-700 hover:text-blue-600 backdrop-blur-sm"
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
