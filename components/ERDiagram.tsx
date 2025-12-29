import React, { useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
  Position,
} from '@xyflow/react';
import dagre from 'dagre';
import { ODataSchema } from '../types';
import EntityNode from './EntityNode';

// 定义自定义节点类型
const nodeTypes = {
  entity: EntityNode,
};

interface ERDiagramProps {
  schema: ODataSchema;
}

// 布局配置
const NODE_WIDTH = 260; // 估算宽度
const NODE_HEIGHT = 200; // 估算平均高度（用于布局计算，实际渲染高度自适应）
const RANK_SEP = 80; // 层级间距 (水平)
const NODE_SEP = 50; // 节点间距 (垂直)

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // 设置布局方向：LR (Left to Right) 适合 ER 图的外键流向
  dagreGraph.setGraph({ rankdir: 'LR', ranksep: RANK_SEP, nodesep: NODE_SEP });

  nodes.forEach((node) => {
    // 动态计算大致高度，让 dagre 布局更精准
    const data = node.data as any;
    const propCount = data.entity.properties.length;
    const navCount = data.entity.navigationProperties.length;
    // 简单估算：Header 40 + Props * 24 + Navs * 28
    const estimatedHeight = 40 + (Math.min(propCount, 8) * 24) + (navCount * 28) + 40;
    
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: estimatedHeight });
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
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - (nodeWithPosition.height / 2),
      },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    };
  });

  return { nodes: layoutedNodes, edges };
};

const ERDiagram: React.FC<ERDiagramProps> = ({ schema }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // 将 Schema 转换为 React Flow 数据结构
  useEffect(() => {
    if (!schema) return;

    const rawNodes: Node[] = [];
    const rawEdges: Edge[] = [];
    const entityMap = new Map<string, string>();

    // 建立名称映射表
    schema.entities.forEach(e => {
        entityMap.set(e.name, e.name);
        if (schema.namespace) entityMap.set(`${schema.namespace}.${e.name}`, e.name);
    });

    // 1. 生成节点
    schema.entities.forEach((entity) => {
      rawNodes.push({
        id: entity.name,
        type: 'entity',
        position: { x: 0, y: 0 }, // 初始位置，会被布局覆盖
        data: { entity },
      });
    });

    // 2. 生成连线
    schema.entities.forEach((entity) => {
      entity.navigationProperties.forEach((nav) => {
        let rawTargetType = nav.type;
        const isCollection = rawTargetType.startsWith('Collection(');
        if (isCollection) rawTargetType = rawTargetType.substring(11, rawTargetType.length - 1);

        let targetId = entityMap.get(rawTargetType);
        if (!targetId) {
            const shortName = rawTargetType.split('.').pop();
            if (shortName && entityMap.has(shortName)) targetId = entityMap.get(shortName);
        }

        if (targetId && entityMap.has(targetId)) {
          rawEdges.push({
            id: `${entity.name}-${nav.name}-${targetId}`,
            source: entity.name,
            target: targetId,
            sourceHandle: `source-${nav.name}`, // *** 关键：连接到具体的导航属性行 ***
            type: 'step', // 直角连线，类似电路板/ER图风格
            animated: false,
            style: { stroke: '#64748b', strokeWidth: 1.5 },
            markerEnd: {
              type: MarkerType.ArrowClosed, // 默认箭头
              width: 20,
              height: 20,
              color: '#64748b',
            },
            // 如果是 1:N，可以加 label 或不同样式
            label: isCollection ? '1..N' : '1..1',
            labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 500 },
            labelBgPadding: [2, 2],
            labelBgBorderRadius: 4,
            labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.8 },
          });
        }
      });
    });

    // 3. 计算布局
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rawNodes, rawEdges);

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

  }, [schema, setNodes, setEdges]);

  return (
    <div className="w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'step' }} // 默认直角线
      >
        <Background color="#cbd5e1" gap={20} size={1} />
        <Controls />
        <MiniMap 
            nodeColor={() => '#e2e8f0'} 
            maskColor="rgba(240, 242, 245, 0.7)"
            style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0' }}
        />
      </ReactFlow>
    </div>
  );
};

export default ERDiagram;