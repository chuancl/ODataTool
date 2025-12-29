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
import EntityNode from './EntityNode';
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

    // 映射表
    schema.entities.forEach(e => {
        entityMap.set(e.name, e.name);
        if (schema.namespace) entityMap.set(`${schema.namespace}.${e.name}`, e.name);
    });

    // 生成节点
    schema.entities.forEach((entity) => {
      rawNodes.push({
        id: entity.name,
        type: 'entity',
        position: { x: 0, y: 0 },
        data: { entity },
      });
    });

    // 生成连线
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
            sourceHandle: `source-${nav.name}`, // 精确连接到行
            // 使用 smoothstep 比 step 更柔和，减少生硬的交叉感
            type: 'smoothstep', 
            animated: false,
            style: { stroke: '#94a3b8', strokeWidth: 1.5 },
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
          });
        }
      });
    });

    // 调用独立的布局服务
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
            pathOptions: { borderRadius: 10 } // 圆角连线
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