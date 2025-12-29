import React, { useEffect, useCallback } from 'react';
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
  ConnectionLineType,
} from '@xyflow/react';
import { ODataSchema } from '../types';
import EntityNode, { getHandleId } from './EntityNode';
import { getLayoutedElements } from '../services/layoutService';

const nodeTypes = {
  entity: EntityNode,
};

interface ERDiagramProps {
  schema: ODataSchema;
}

const ERDiagram: React.FC<ERDiagramProps> = ({ schema }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const processGraph = useCallback(() => {
    if (!schema) return;

    const rawNodes: Node[] = [];
    const rawEdges: Edge[] = [];
    const entityMap = new Map<string, string>();

    // 1. 建立 Entity Name 映射表 (Name -> Name)
    schema.entities.forEach(e => {
        entityMap.set(e.name, e.name);
        // 处理带 Namespace 的情况
        if (schema.namespace) entityMap.set(`${schema.namespace}.${e.name}`, e.name);
    });

    // 2. 生成节点数据
    schema.entities.forEach((entity) => {
      rawNodes.push({
        id: entity.name,
        type: 'entity',
        position: { x: 0, y: 0 },
        data: { entity },
      });
    });

    // 3. 生成连线数据 (逻辑的核心)
    schema.entities.forEach((entity) => {
      entity.navigationProperties.forEach((nav) => {
        // 清洗类型字符串，去除 'Collection(...)'
        let rawTargetType = nav.type;
        const isCollection = rawTargetType.startsWith('Collection(');
        if (isCollection) rawTargetType = rawTargetType.substring(11, rawTargetType.length - 1);

        // 尝试匹配目标 Entity ID
        let targetId = entityMap.get(rawTargetType);
        if (!targetId) {
            const shortName = rawTargetType.split('.').pop();
            if (shortName && entityMap.has(shortName)) targetId = entityMap.get(shortName);
        }

        // 只有找到了目标节点，才创建连线
        if (targetId && entityMap.has(targetId)) {
          const sourceHandleId = getHandleId(nav.name); // 使用与 EntityNode 一致的 ID 生成逻辑
          
          rawEdges.push({
            id: `${entity.name}-${nav.name}-${targetId}`,
            source: entity.name,
            target: targetId,
            sourceHandle: sourceHandleId, // *** 关键：这行决定了线从哪一行出来 ***
            type: 'smoothstep', // 使用平滑阶梯线
            animated: false,
            style: { stroke: '#94a3b8', strokeWidth: 1.5 },
            // pathOptions 优化折线拐角
            pathOptions: { 
                borderRadius: 20,
                offset: 20 // 连线离开节点后的最小直线距离，防止紧贴节点边缘
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
              color: '#94a3b8',
            },
            label: isCollection ? '1..N' : '1..1',
            labelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 500 },
            labelBgPadding: [2, 2],
            labelBgBorderRadius: 4,
            labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.9 },
          } as any);
        }
      });
    });

    // 4. 调用布局服务计算坐标
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rawNodes, rawEdges);

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [schema, setNodes, setEdges]);

  useEffect(() => {
    processGraph();
  }, [processGraph]);

  return (
    <div className="w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.1, maxZoom: 2.0 }}
        minZoom={0.1}
        maxZoom={3}
        defaultEdgeOptions={{ 
            type: 'smoothstep',
        }}
        connectionLineType={ConnectionLineType.SmoothStep}
      >
        <Background color="#cbd5e1" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap 
            nodeColor="#e2e8f0" 
            maskColor="rgba(241, 245, 249, 0.6)"
            style={{ border: '1px solid #e2e8f0' }}
        />
      </ReactFlow>
    </div>
  );
};

export default ERDiagram;