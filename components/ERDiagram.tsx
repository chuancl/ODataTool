import React, { useMemo, useEffect } from 'react';
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
// 安全导入 dagre
import * as dagre from 'dagre';
import { ODataSchema } from '../types';
import EntityNode from './EntityNode';

const nodeTypes = {
  entity: EntityNode,
};

interface ERDiagramProps {
  schema: ODataSchema;
}

// 辅助函数：安全获取 Dagre Graph 实例
const getDagreGraph = () => {
    // 兼容不同的打包方式 (CommonJS vs ESM)
    // @ts-ignore
    if (dagre.graphlib) return new dagre.graphlib.Graph();
    // @ts-ignore
    if (dagre.default && dagre.default.graphlib) return new dagre.default.graphlib.Graph();
    // 如果都不行，尝试直接 new dagre
    try {
        // @ts-ignore
        return new dagre.Graph(); 
    } catch(e) {
        console.warn("Cannot instantiate Dagre graph", e);
        return null;
    }
};

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = getDagreGraph();
  
  if (!dagreGraph) {
      console.error("Dagre library not loaded correctly.");
      return { nodes, edges };
  }

  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ 
    rankdir: 'LR', 
    nodesep: 80,   
    ranksep: 280   
  });

  nodes.forEach((node) => {
    // 预估节点大小
    dagreGraph.setNode(node.id, { width: 280, height: 300 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  try {
      dagre.layout(dagreGraph);
  } catch (e) {
      // 兼容 dagre.layout 可能位于 default 属性的情况
      if ((dagre as any).default?.layout) {
          (dagre as any).default.layout(dagreGraph);
      } else {
          console.error("Layout failed", e);
          // 降级布局
          return { 
             nodes: nodes.map((n, i) => ({ ...n, position: { x: (i % 4) * 320, y: Math.floor(i / 4) * 400 } })), 
             edges 
          };
      }
  }

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 140, 
        y: nodeWithPosition.y - 150,
      },
      targetPosition: 'left',
      sourcePosition: 'right',
    };
  });

  return { nodes: layoutedNodes, edges };
};

const ERDiagramInner: React.FC<ERDiagramProps> = ({ schema }) => {
    const { fitView } = useReactFlow();
    
    const { initialNodes, initialEdges } = useMemo(() => {
        if (!schema || !schema.entities || schema.entities.length === 0) {
            return { initialNodes: [], initialEdges: [] };
        }

        const nodes: Node[] = [];
        const edges: Edge[] = [];
        const entityNames = new Set(schema.entities.map(e => e.name));

        schema.entities.forEach((entity) => {
            nodes.push({
                id: entity.name,
                type: 'entity',
                data: { entity },
                position: { x: 0, y: 0 },
                draggable: true,
                connectable: false, 
            });

            entity.navigationProperties.forEach((nav) => {
                let targetName = nav.type;
                const isCollection = targetName.startsWith('Collection(');
                if (isCollection) {
                    targetName = targetName.substring(11, targetName.length - 1);
                }
                
                let actualTarget = '';
                if (entityNames.has(targetName)) {
                    actualTarget = targetName;
                } else {
                    const shortName = targetName.split('.').pop() || '';
                    if (entityNames.has(shortName)) {
                        actualTarget = shortName;
                    }
                }

                if (actualTarget && actualTarget !== entity.name) {
                    const edgeId = `${entity.name}-${nav.name}-${actualTarget}`;
                    edges.push({
                        id: edgeId,
                        source: entity.name,
                        target: actualTarget,
                        type: 'smoothstep', 
                        label: isCollection ? '1..N' : '1..1',
                        labelStyle: { fill: '#0ea5e9', fontWeight: 700, fontSize: 10 },
                        labelBgStyle: { fill: '#f0f9ff', fillOpacity: 0.9, rx: 4, ry: 4 },
                        style: { stroke: '#0ea5e9', strokeWidth: 1.5 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#0ea5e9' },
                    });
                }
            });
        });

        return getLayoutedElements(nodes, edges);
    }, [schema]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes || []);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);

    useEffect(() => {
        if (initialNodes) setNodes(initialNodes);
        if (initialEdges) setEdges(initialEdges);
        
        const t1 = setTimeout(() => {
            fitView({ padding: 0.2 });
        }, 50);
        
        const t2 = setTimeout(() => {
            fitView({ padding: 0.2, duration: 500 });
        }, 500);

        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [initialNodes, initialEdges, fitView, setNodes, setEdges]);

    // 安全检查：确保 schema.entities 存在后再访问 length
    if (!schema || !schema.entities || schema.entities.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
                <p>No entities found in schema.</p>
            </div>
        );
    }

    // 安全检查：确保 nodes 存在
    if (!nodes || nodes.length === 0) {
         return (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
                <p>Preparing diagram...</p>
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
            style={{ width: '100%', height: '100%', background: '#f8fafc' }}
        >
            <Background color="#cbd5e1" gap={25} size={1} />
            <Controls />
            <Panel position="top-right">
                <button 
                    onClick={() => fitView({ padding: 0.2, duration: 500 })}
                    className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-xs font-bold text-slate-600 hover:text-indigo-600 transition"
                >
                    Reset View
                </button>
            </Panel>
        </ReactFlow>
    );
};

const ERDiagram: React.FC<ERDiagramProps> = (props) => {
    return (
        <div className="w-full h-full flex-1 relative bg-slate-50">
            <ReactFlowProvider>
                <ERDiagramInner {...props} />
            </ReactFlowProvider>
        </div>
    );
};

export default ERDiagram;
