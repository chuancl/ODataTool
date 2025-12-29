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
import { ODataSchema, ODataEntity } from '../types';
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
  
  const isLayoutCalculated = useRef(false);

  const processGraph = useCallback(async () => {
    if (!schema) return;

    const rawNodes: Node[] = [];
    const rawEdges: Edge[] = [];
    const entityMap = new Map<string, ODataEntity>();

    // 1. 建立 Entity 映射表 (Name -> EntityObj)
    schema.entities.forEach(e => {
        entityMap.set(e.name, e);
        if (schema.namespace) entityMap.set(`${schema.namespace}.${e.name}`, e);
    });

    // 2. 生成节点
    schema.entities.forEach((entity) => {
      rawNodes.push({
        id: entity.name,
        type: 'entity',
        position: { x: 0, y: 0 },
        data: { entity },
      });
    });

    // 3. 生成连线 (纯粹的 Field-to-Field，不回退到 Header)
    schema.entities.forEach((entity) => {
      entity.navigationProperties.forEach((nav) => {
        let rawTargetType = nav.type;
        const isCollection = rawTargetType.startsWith('Collection(');
        if (isCollection) rawTargetType = rawTargetType.substring(11, rawTargetType.length - 1);

        // 查找目标实体对象
        let targetEntity: ODataEntity | undefined = entityMap.get(rawTargetType);
        if (!targetEntity) {
            const shortName = rawTargetType.split('.').pop();
            if (shortName) targetEntity = entityMap.get(shortName);
        }

        if (targetEntity) {
          // 起点：当前的 Navigation Property 行
          const sourceHandleId = getHandleId('source', nav.name);
          
          // 终点：严格指向目标实体的第一个主键 (PK)
          // 只有当目标实体有主键时，才画这条线
          if (targetEntity.keys && targetEntity.keys.length > 0) {
              const targetHandleId = getHandleId('target', targetEntity.keys[0]);

              rawEdges.push({
                id: `${entity.name}-${nav.name}-${targetEntity.name}`,
                source: entity.name,
                target: targetEntity.name,
                sourceHandle: sourceHandleId, // 从属性出
                targetHandle: targetHandleId, // 到主键入
                type: 'smoothstep', 
                animated: false,
                style: { stroke: '#94a3b8', strokeWidth: 1.5 },
                pathOptions: { 
                    borderRadius: 10,
                    offset: 20 
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 14,
                  height: 14,
                  color: '#94a3b8',
                },
                label: isCollection ? '1..N' : '1..1',
                labelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 500 },
                labelBgPadding: [2, 2],
                labelBgBorderRadius: 4,
                labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.9 },
              } as any);
          }
        }
      });
    });

    try {
        const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(rawNodes, rawEdges);
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        isLayoutCalculated.current = true;
        
        setTimeout(() => {
            const fitViewBtn = document.querySelector('.react-flow__controls-fitview');
            if(fitViewBtn) (fitViewBtn as HTMLElement).click();
        }, 100);

    } catch (e) {
        console.error("Layout calculation failed", e);
        setNodes(rawNodes);
        setEdges(rawEdges);
    }

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