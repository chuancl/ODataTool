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
  // LR: Left to Right 布局
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 100, ranksep: 250 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 280, height: 300 }); 
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
        x: nodeWithPosition.x - 140,
        y: nodeWithPosition.y - 150,
      },
    };
  });
};

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
                    
                    // 连线配置
                    rawEdges.push({
                        id: edgeId,
                        source: entity.name,
                        target: targetId,
                        
                        // 核心修改：指定 Source Handle ID 为属性名，Target Handle ID 为 'target-input'
                        sourceHandle: nav.name, 
                        targetHandle: 'target-input', 

                        type: 'smoothstep',  // 使用直角连线，风格更像 OData 图表
                        animated: false,
                        zIndex: 10, 
                        label: isCollection ? '1..N' : '1..1',
                        labelStyle: { fill: '#4f46e5', fontWeight: 700, fontSize: 11 }, // Indigo 600
                        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95, rx: 4, ry: 4 },
                        style: { stroke: '#4f46e5', strokeWidth: 2 }, // Indigo 600
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5' },
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
            <Background color="#94a3b8" gap={24} size={1} />
            <Controls />
            <Panel position="top-right" className="flex gap-2">
                <button 
                    onClick={() => {
                        const gridNodes = getGridLayout(nodes);
                        setNodes(gridNodes);
                        setTimeout(() => fitView({ duration: 500 }), 50);
                    }}
                    className="bg-white/90 px-3 py-1.5 rounded-lg shadow-sm border border-slate-300 text-xs font-bold text-slate-700 hover:text-indigo-600 backdrop-blur-sm transition"
                >
                    Free Layout
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
