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

// --- 布局算法区域 ---

// 1. 获取 Dagre 实例 (兼容处理)
const getDagreGraph = () => {
    try {
        // @ts-ignore
        if (dagre.graphlib) return new dagre.graphlib.Graph();
        // @ts-ignore
        if (dagre.default && dagre.default.graphlib) return new dagre.default.graphlib.Graph();
        // @ts-ignore
        return new dagre.Graph(); 
    } catch(e) {
        console.warn("Dagre load failed, fallback to grid layout.", e);
        return null;
    }
};

// 2. 智能布局 (Dagre)
const getSmartLayout = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = getDagreGraph();
  if (!dagreGraph) return null; // 失败则返回 null，触发兜底

  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 100, ranksep: 300 });

  // 必须确保所有节点都在 graph 中
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 280, height: 300 }); // 估算节点尺寸
  });

  // 必须过滤掉悬空的 edge (即 source 或 target 不在 nodes 里的)
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
      console.error("Dagre layout calculation failed", e);
      return null;
  }

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    // 如果某个节点被孤立导致没计算位置，保持原位
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
};

// 3. 简易网格布局 (兜底方案)
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
        targetPosition: 'left',
        sourcePosition: 'right',
    }));
};


const ERDiagramInner: React.FC<ERDiagramProps> = ({ schema }) => {
    const { fitView } = useReactFlow();
    
    // 初始化状态 (先为空)
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // 核心数据处理逻辑
    useEffect(() => {
        if (!schema || !schema.entities || schema.entities.length === 0) {
            setNodes([]);
            setEdges([]);
            return;
        }

        const rawNodes: Node[] = [];
        const rawEdges: Edge[] = [];
        
        // 1. 构建节点 ID 映射表，用于处理命名空间 (Namespace.Entity -> Entity)
        const entityMap = new Map<string, string>(); // FullName/ShortName -> ID
        schema.entities.forEach(e => {
            entityMap.set(e.name, e.name); // Order -> Order
            if (schema.namespace) {
                entityMap.set(`${schema.namespace}.${e.name}`, e.name); // Northwind.Order -> Order
            }
        });

        // 2. 生成基础节点
        schema.entities.forEach((entity) => {
            rawNodes.push({
                id: entity.name,
                type: 'entity',
                data: { entity },
                position: { x: 0, y: 0 }, // 初始位置
            });
        });

        // 3. 生成连线
        schema.entities.forEach((entity) => {
            entity.navigationProperties.forEach((nav) => {
                // 解析目标类型：Collection(NorthwindModel.Order) -> NorthwindModel.Order
                let rawTargetType = nav.type;
                const isCollection = rawTargetType.startsWith('Collection(');
                if (isCollection) {
                    rawTargetType = rawTargetType.substring(11, rawTargetType.length - 1);
                }

                // 尝试匹配目标 ID
                let targetId = entityMap.get(rawTargetType);
                
                // 如果没匹配到，尝试去掉命名空间再匹配一次
                if (!targetId) {
                    const shortName = rawTargetType.split('.').pop();
                    if (shortName && entityMap.has(shortName)) {
                        targetId = entityMap.get(shortName);
                    }
                }

                // 只有当目标节点存在，且不是自引用(可选)时，才创建连线
                if (targetId && entityMap.has(targetId)) {
                    const edgeId = `${entity.name}-${nav.name}-${targetId}`;
                    rawEdges.push({
                        id: edgeId,
                        source: entity.name,
                        target: targetId,
                        type: 'smoothstep', // 直角连线更整洁
                        label: isCollection ? '1..N' : '1..1',
                        labelStyle: { fill: '#3b82f6', fontWeight: 700, fontSize: 10 },
                        labelBgStyle: { fill: '#eff6ff', fillOpacity: 0.9 },
                        style: { stroke: '#3b82f6', strokeWidth: 1.5 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
                    });
                }
            });
        });

        // 4. 执行布局计算
        let layoutedNodes = getSmartLayout(rawNodes, rawEdges);
        
        // 5. 如果智能布局失败，使用网格布局
        if (!layoutedNodes) {
            console.warn("Layout fallback triggered");
            layoutedNodes = getGridLayout(rawNodes);
        }

        setNodes(layoutedNodes);
        setEdges(rawEdges);

        // 6. 强制适配视图
        setTimeout(() => {
            window.requestAnimationFrame(() => {
                fitView({ padding: 0.2, duration: 600 });
            });
        }, 100);

    }, [schema, fitView, setNodes, setEdges]);


    // 即使没有节点，也不要显示 Loading 阻塞界面，而是显示空状态或者网格
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
            minZoom={0.05}
            maxZoom={2}
            defaultEdgeOptions={{ type: 'smoothstep' }}
            proOptions={{ hideAttribution: true }}
            className="bg-slate-50"
        >
            <Background color="#cbd5e1" gap={25} size={1} />
            <Controls />
            <Panel position="top-right" className="flex gap-2">
                <button 
                    onClick={() => {
                        // 强制重新布局 (网格)
                        const gridNodes = getGridLayout(nodes);
                        setNodes(gridNodes);
                        setTimeout(() => fitView({ duration: 500 }), 50);
                    }}
                    className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-xs font-bold text-slate-600 hover:text-indigo-600"
                    title="Switch to Grid Layout"
                >
                    Grid Layout
                </button>
                <button 
                    onClick={() => fitView({ padding: 0.2, duration: 500 })}
                    className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-xs font-bold text-slate-600 hover:text-indigo-600"
                >
                    Fit View
                </button>
            </Panel>
        </ReactFlow>
    );
};

const ERDiagram: React.FC<ERDiagramProps> = (props) => {
    return (
        // 确保容器有明确的尺寸，flex-1 和 relative 很重要
        <div className="w-full h-full flex-1 relative min-h-[500px] bg-slate-50">
            <ReactFlowProvider>
                <ERDiagramInner {...props} />
            </ReactFlowProvider>
        </div>
    );
};

export default ERDiagram;
