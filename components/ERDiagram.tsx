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
import dagre from 'dagre';
import { ODataSchema } from '../types';
import EntityNode from './EntityNode';

// 注册自定义节点类型
// 必须在组件外部定义，或者使用 useMemo，否则会导致无限重渲染
const nodeTypes = {
  entity: EntityNode,
};

interface ERDiagramProps {
  schema: ODataSchema;
}

// 布局计算函数
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  try {
      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));

      // 设置布局方向和间距
      dagreGraph.setGraph({ 
        rankdir: 'LR', 
        nodesep: 80,   
        ranksep: 250   
      });

      // 设置节点尺寸供 Dagre 计算
      nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: 260, height: 300 });
      });

      edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
      });

      dagre.layout(dagreGraph);

      const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        // 如果 dagre 计算失败，使用默认位置
        if (!nodeWithPosition) return node;

        return {
          ...node,
          position: {
            x: nodeWithPosition.x - 130, // center offset
            y: nodeWithPosition.y - 150,
          },
          targetPosition: 'left',
          sourcePosition: 'right',
        };
      });

      return { nodes: layoutedNodes, edges };
  } catch (err) {
      console.error("Dagre Layout Error:", err);
      // 降级：如果布局失败，简单的网格排列或直接返回
      return { 
          nodes: nodes.map((n, i) => ({ ...n, position: { x: (i % 5) * 300, y: Math.floor(i / 5) * 350 } })), 
          edges 
      };
  }
};

const ERDiagramInner: React.FC<ERDiagramProps> = ({ schema }) => {
    const { fitView } = useReactFlow();
    
    // 1. 数据转换：将 OData Schema 转换为 React Flow 的 Nodes 和 Edges
    const { initialNodes, initialEdges } = useMemo(() => {
        if (!schema || !schema.entities) return { initialNodes: [], initialEdges: [] };

        const nodes: Node[] = [];
        const edges: Edge[] = [];
        const entityNames = new Set(schema.entities.map(e => e.name));

        schema.entities.forEach((entity) => {
            nodes.push({
                id: entity.name,
                type: 'entity',
                data: { entity },
                position: { x: 0, y: 0 },
                // 确保节点可拖拽但不可连接（由我们控制连线）
                draggable: true,
                connectable: false, 
            });

            entity.navigationProperties.forEach((nav) => {
                let targetName = nav.type;
                const isCollection = targetName.startsWith('Collection(');
                if (isCollection) {
                    targetName = targetName.substring(11, targetName.length - 1);
                }
                
                // 简单的名称匹配逻辑
                let actualTarget = '';
                if (entityNames.has(targetName)) {
                    actualTarget = targetName;
                } else {
                    const shortName = targetName.split('.').pop() || '';
                    if (entityNames.has(shortName)) {
                        actualTarget = shortName;
                    }
                }

                if (actualTarget) {
                    const edgeId = `${entity.name}-${nav.name}-${actualTarget}`;
                    edges.push({
                        id: edgeId,
                        source: entity.name,
                        target: actualTarget,
                        type: 'smoothstep', 
                        label: isCollection ? '1..N' : '1..1',
                        labelStyle: { fill: '#0ea5e9', fontWeight: 700, fontSize: 10 },
                        labelBgStyle: { fill: '#f0f9ff', fillOpacity: 0.8, rx: 4, ry: 4 },
                        style: { stroke: '#0ea5e9', strokeWidth: 1.5 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#0ea5e9' },
                        animated: false,
                    });
                }
            });
        });

        return getLayoutedElements(nodes, edges);
    }, [schema]);

    // 使用 useNodesState 管理状态，但必须手动同步 schema 变化
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // 当 schema (initialNodes) 变化时，更新 React Flow 状态
    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
        
        // 延迟 fitView 确保节点已渲染
        setTimeout(() => {
            window.requestAnimationFrame(() => {
                fitView({ padding: 0.2, duration: 800 });
            });
        }, 100);
    }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

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
            className="w-full h-full bg-slate-50"
            style={{ width: '100%', height: '100%' }}
        >
            <Background color="#cbd5e1" gap={25} size={1} />
            <Controls />
            <Panel position="top-right">
                <button 
                    onClick={() => fitView({ padding: 0.2, duration: 500 })}
                    className="bg-white p-2 rounded shadow text-xs font-bold text-slate-600 hover:text-indigo-600"
                >
                    Reset View
                </button>
            </Panel>
        </ReactFlow>
    );
};

const ERDiagram: React.FC<ERDiagramProps> = (props) => {
    return (
        <div className="w-full h-full bg-slate-50 flex-1 relative" style={{ minHeight: '400px' }}>
            <ReactFlowProvider>
                <ERDiagramInner {...props} />
            </ReactFlowProvider>
        </div>
    );
};

export default ERDiagram;
