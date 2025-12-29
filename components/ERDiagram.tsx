import React, { useEffect, useCallback, useRef } from 'react';
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
  useReactFlow,
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
  
  // 使用 ref 避免 useEffect 闭包陷阱，确保只计算一次
  const isLayoutCalculated = useRef(false);

  const processGraph = useCallback(async () => {
    if (!schema) return;

    const rawNodes: Node[] = [];
    const rawEdges: Edge[] = [];
    const entityMap = new Map<string, string>();

    // 1. 映射表
    schema.entities.forEach(e => {
        entityMap.set(e.name, e.name);
        if (schema.namespace) entityMap.set(`${schema.namespace}.${e.name}`, e.name);
    });

    // 2. 生成节点
    schema.entities.forEach((entity) => {
      rawNodes.push({
        id: entity.name,
        type: 'entity',
        position: { x: 0, y: 0 }, // 初始位置设为 0，等待 ELK 计算
        data: { entity },
      });
    });

    // 3. 生成连线
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
          const sourceHandleId = getHandleId(nav.name);
          
          rawEdges.push({
            id: `${entity.name}-${nav.name}-${targetId}`,
            source: entity.name,
            target: targetId,
            sourceHandle: sourceHandleId,
            type: 'smoothstep', 
            animated: false,
            style: { stroke: '#94a3b8', strokeWidth: 1.5 },
            pathOptions: { 
                borderRadius: 15,
                offset: 25 // 稍微加大一点 offset，让线出来更直一点
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

    // 4. 调用 ELK 异步布局
    try {
        const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(rawNodes, rawEdges);
        
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        
        // 布局完成后标记
        isLayoutCalculated.current = true;
        
        // 可选：适应视图，稍微延迟以确保渲染完成
        setTimeout(() => {
            const fitViewBtn = document.querySelector('.react-flow__controls-fitview');
            if(fitViewBtn) (fitViewBtn as HTMLElement).click();
        }, 100);

    } catch (e) {
        console.error("Layout calculation failed", e);
        // 降级处理：即使布局失败也显示节点
        setNodes(rawNodes);
        setEdges(rawEdges);
    }

  }, [schema, setNodes, setEdges]);

  useEffect(() => {
    // 只有当 schema 变化且未计算过布局时才执行
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