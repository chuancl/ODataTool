import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
  ConnectionLineType
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
  dagreGraph.setGraph({ 
    rankdir: 'LR', // 'TB' (Top to Bottom) or 'LR' (Left to Right)
    nodesep: 50,   // 节点间距
    ranksep: 150   // 层级间距
  });

  // 设置节点尺寸供 Dagre 计算 (这里取一个平均估计值，因为此时 DOM 还没渲染)
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 240, height: 300 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    // Dagre 返回中心点，React Flow 需要左上角
    node.position = {
      x: nodeWithPosition.x - 240 / 2,
      y: nodeWithPosition.y - 300 / 2,
    };
  });

  return { nodes, edges };
};

const ERDiagram: React.FC<ERDiagramProps> = ({ schema }) => {
  
  // 1. 数据转换：将 OData Schema 转换为 React Flow 的 Nodes 和 Edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    schema.entities.forEach((entity) => {
      // 创建节点
      nodes.push({
        id: entity.name,
        type: 'entity',
        data: { entity },
        position: { x: 0, y: 0 }, // 初始位置，稍后由 dagre 计算
      });

      // 创建连线 (Edges)
      entity.navigationProperties.forEach((nav) => {
        // 解析目标类型
        let targetName = nav.type;
        const isCollection = targetName.startsWith('Collection(');
        if (isCollection) {
            targetName = targetName.substring(11, targetName.length - 1);
        }
        targetName = targetName.split('.').pop() || targetName;

        // 确保目标实体存在于当前 Schema 中
        const targetExists = schema.entities.some(e => e.name === targetName);
        
        if (targetExists) {
            edges.push({
                id: `${entity.name}-${nav.name}-${targetName}`,
                source: entity.name,
                target: targetName,
                type: 'step', // 正交连线
                label: isCollection ? '1..N' : '1..1', // 简单的基数标记
                labelStyle: { fill: '#0284c7', fontWeight: 700, fontSize: 10 },
                labelBgStyle: { fill: '#f0f9ff' },
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

  return (
    <div className="w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        connectionLineType={ConnectionLineType.Step}
        fitView
        attributionPosition="bottom-right"
        minZoom={0.1}
      >
        <Background color="#cbd5e1" gap={20} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default ERDiagram;
