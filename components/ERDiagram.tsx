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
  ReactFlowProvider
} from 'reactflow';
import dagre from 'dagre';
import { ODataSchema } from '../types';
import EntityNode from './EntityNode';

// 注册自定义节点类型
const nodeTypes = {
  entity: EntityNode,
};

interface ERDiagramProps {
  schema: ODataSchema;
}

// 布局计算函数
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // 设置布局方向和间距
  // rankdir: 'LR' (从左到右) 或 'TB' (从上到下)
  // ranksep: 层级之间的距离
  // nodesep: 同一层级节点之间的距离
  dagreGraph.setGraph({ 
    rankdir: 'LR', 
    nodesep: 80,   
    ranksep: 200   
  });

  // 设置节点尺寸供 Dagre 计算
  // 这里估算一个尺寸，虽然 React 渲染后实际尺寸可能不同，但对大致布局足够
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 280, height: 300 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 140, // 减去宽度的一半 (280/2)
        y: nodeWithPosition.y - 150, // 减去高度的一半 (300/2)
      },
      targetPosition: 'left',
      sourcePosition: 'right',
    };
  });

  return { nodes: layoutedNodes, edges };
};

const ERDiagramInner: React.FC<ERDiagramProps> = ({ schema }) => {
    const { fitView } = useReactFlow();
    
    // 1. 数据转换：将 OData Schema 转换为 React Flow 的 Nodes 和 Edges
    const { initialNodes, initialEdges } = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // 建立实体名称到索引的映射，确保引用正确
        const entityNames = new Set(schema.entities.map(e => e.name));

        schema.entities.forEach((entity) => {
            // 创建节点
            nodes.push({
                id: entity.name,
                type: 'entity',
                data: { entity },
                position: { x: 0, y: 0 }, // 初始位置
            });

            // 创建连线 (Edges)
            entity.navigationProperties.forEach((nav) => {
                // 解析目标类型
                let targetName = nav.type;
                
                // 处理 Collection(...)
                const isCollection = targetName.startsWith('Collection(');
                if (isCollection) {
                    targetName = targetName.substring(11, targetName.length - 1);
                }
                
                // 移除 Namespace 前缀 (例如 Microsoft.OData.SampleService.Models.TripPin.Person -> Person)
                // 简单的做法是取最后一部分。严谨的做法应该匹配 Namespace。
                // 这里我们尝试两种匹配：全名匹配 或 短名匹配
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
                        // 使用 smoothstep 或 step 使得线条更像电路图/ER图
                        type: 'smoothstep', 
                        label: isCollection ? '1..N' : '1..1',
                        labelStyle: { fill: '#0ea5e9', fontWeight: 700, fontSize: 10 },
                        labelBgStyle: { fill: '#f0f9ff', fillOpacity: 0.8 },
                        style: { stroke: '#0ea5e9', strokeWidth: 1.5 },
                        markerEnd: {
                            type: MarkerType.ArrowClosed,
                            color: '#0ea5e9',
                        },
                        animated: false,
                    });
                }
            });
        });

        return getLayoutedElements(nodes, edges);
    }, [schema]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // 当布局变化时，自动适应视图
    useEffect(() => {
        // 使用 timeout 确保节点渲染后再 fitView
        const timer = setTimeout(() => {
            fitView({ padding: 0.2, duration: 800 });
        }, 100);
        return () => clearTimeout(timer);
    }, [nodes, fitView]);

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            connectionLineType={ConnectionLineType.SmoothStep}
            fitView
            attributionPosition="bottom-right"
            minZoom={0.1}
            defaultEdgeOptions={{ type: 'smoothstep' }}
        >
            <Background color="#cbd5e1" gap={20} size={1} />
            <Controls />
        </ReactFlow>
    );
};

// 包装组件以提供 ReactFlowProvider 上下文
const ERDiagram: React.FC<ERDiagramProps> = (props) => {
    return (
        <div className="w-full h-full bg-slate-50">
            <ReactFlowProvider>
                <ERDiagramInner {...props} />
            </ReactFlowProvider>
        </div>
    );
};

export default ERDiagram;
