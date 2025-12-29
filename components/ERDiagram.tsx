import React, { useEffect, useCallback } from 'react';
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
// 引入 ELK 的 bundled 版本以避免 Worker 加载问题
import ELK from 'elkjs/lib/elk.bundled.js';
import { ODataSchema, ODataEntity } from '../types';
import EntityNode from './EntityNode';

const nodeTypes = {
  entity: EntityNode,
};

// 初始化 ELK 实例
const elk = new ELK();

interface ERDiagramProps {
  schema: ODataSchema;
}

/**
 * 估算实体节点的高度，用于布局引擎计算
 * 需要与 EntityNode 组件的渲染逻辑保持一致
 */
const estimateNodeHeight = (entity: ODataEntity) => {
    // 标题栏 + padding
    const headerHeight = 50; 
    
    // 主键区域 (每行约 30px)
    const pkHeight = entity.keys.length * 30;
    
    // 普通属性区域 (每行约 28px)，最大高度限制为 160px (css中设置)
    const otherProps = entity.properties.filter(p => !entity.keys.includes(p.name));
    const propsHeight = Math.min(otherProps.length * 28, 160);
    
    // 导航属性区域 (每行约 28px) + 顶部border
    const navHeight = entity.navigationProperties.length > 0 
        ? (entity.navigationProperties.length * 28) + 10 
        : 0;

    // 底部 padding
    return headerHeight + pkHeight + propsHeight + navHeight + 20;
};

const getElkLayout = async (nodes: Node[], edges: Edge[]) => {
    const layoutOptions = {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '60', // 垂直方向节点间距
        'elk.layered.spacing.nodeNodeBetweenLayers': '220', // 水平方向层级间距，留足空间给连线
        'elk.edgeRouting': 'ORTHOGONAL', // 正交路由（直角线）
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF', // 这种策略通常能产生更平衡的布局
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.padding': '[top=50,left=50,bottom=50,right=50]',
    };

    const graph: any = {
        id: 'root',
        layoutOptions: layoutOptions,
        children: nodes.map((node) => ({
            id: node.id,
            width: 280, // 节点固定宽度 (与 CSS 对应)
            height: node.data.height || 300,
        })),
        edges: edges.map((edge) => ({
            id: edge.id,
            sources: [edge.source],
            targets: [edge.target],
        })),
    };

    try {
        const layoutedGraph = await elk.layout(graph);
        
        const layoutedNodes = nodes.map((node) => {
            // @ts-ignore
            const nodeData = layoutedGraph.children?.find((n) => n.id === node.id);
            if (!nodeData) return node;

            return {
                ...node,
                position: {
                    x: nodeData.x || 0,
                    y: nodeData.y || 0,
                },
                // ELK 可能会微调宽高，但我们主要用它的坐标
            };
        });
        
        return layoutedNodes;
    } catch (e) {
        console.error("ELK Layout failed:", e);
        return nodes; // 失败时返回原节点，避免崩溃
    }
};


const getGridLayout = (nodes: Node[]) => {
    const COLUMNS = 4;
    const X_SPACING = 400;
    const Y_SPACING = 500;
    
    return nodes.map((node, index) => ({
        ...node,
        position: {
            x: (index % COLUMNS) * X_SPACING,
            y: Math.floor(index / COLUMNS) * Y_SPACING
        },
    }));
};

const ERDiagramInner: React.FC<ERDiagramProps> = ({ schema }) => {
    const { fitView } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // 核心布局逻辑
    const computeLayout = useCallback(async (currentNodes: Node[], currentEdges: Edge[], useElk = true) => {
        if (useElk) {
            const layouted = await getElkLayout(currentNodes, currentEdges);
            setNodes(layouted);
        } else {
            const gridLayout = getGridLayout(currentNodes);
            setNodes(gridLayout);
        }
        
        // 布局完成后适应视图
        setTimeout(() => {
            window.requestAnimationFrame(() => {
                fitView({ padding: 0.1, duration: 800 });
            });
        }, 50);
    }, [fitView, setNodes]);

    useEffect(() => {
        if (!schema || !schema.entities || schema.entities.length === 0) {
            setNodes([]);
            setEdges([]);
            return;
        }

        const rawNodes: Node[] = [];
        const rawEdges: Edge[] = [];
        const entityMap = new Map<string, string>(); 
        
        schema.entities.forEach(e => {
            entityMap.set(e.name, e.name);
            if (schema.namespace) {
                entityMap.set(`${schema.namespace}.${e.name}`, e.name);
            }
        });

        // 1. 构建节点
        schema.entities.forEach((entity) => {
            const estimatedH = estimateNodeHeight(entity);
            rawNodes.push({
                id: entity.name,
                type: 'entity',
                data: { entity, height: estimatedH }, // 传入估算高度供 ELK 使用
                position: { x: 0, y: 0 }, 
                draggable: true,
            });
        });

        // 2. 构建连线
        schema.entities.forEach((entity) => {
            entity.navigationProperties.forEach((nav) => {
                let rawTargetType = nav.type;
                const isCollection = rawTargetType.startsWith('Collection(');
                if (isCollection) {
                    rawTargetType = rawTargetType.substring(11, rawTargetType.length - 1);
                }

                let targetId = entityMap.get(rawTargetType);
                if (!targetId) {
                    const shortName = rawTargetType.split('.').pop();
                    if (shortName && entityMap.has(shortName)) {
                        targetId = entityMap.get(shortName);
                    }
                }

                if (targetId && entityMap.has(targetId)) {
                    // 避免自引用导致的布局混乱（可选，但通常 ER 图可以有自引用，ELK 处理得很好）
                    
                    const edgeId = `${entity.name}-${nav.name}-${targetId}`;
                    const edgeColor = isCollection ? '#3b82f6' : '#10b981';
                    const edgeWidth = isCollection ? 2 : 1.5;
                    
                    rawEdges.push({
                        id: edgeId,
                        source: entity.name,
                        target: targetId,
                        sourceHandle: nav.name, 
                        targetHandle: 'target-input', 
                        type: 'step', // 坚持使用 step 直角线
                        animated: false,
                        zIndex: isCollection ? 10 : 1, 
                        label: isCollection ? '1..N' : '1..1',
                        labelStyle: { fill: edgeColor, fontWeight: 700, fontSize: 10 }, 
                        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95, stroke: edgeColor, strokeWidth: 0.5, rx: 2, ry: 2 },
                        style: { 
                            stroke: edgeColor, 
                            strokeWidth: edgeWidth,
                        },
                        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
                    });
                }
            });
        });

        setEdges(rawEdges);
        // 初始计算布局
        computeLayout(rawNodes, rawEdges, true);

    }, [schema, computeLayout, setEdges]); // 注意依赖项

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
            connectionLineType={ConnectionLineType.Step}
            minZoom={0.05}
            maxZoom={2}
            defaultEdgeOptions={{ type: 'step' }} 
            proOptions={{ hideAttribution: true }}
            className="bg-slate-50"
        >
            <Background color="#cbd5e1" gap={24} size={1} />
            <Controls className="bg-white shadow-md border border-slate-200 rounded-lg overflow-hidden" />
            <Panel position="top-right" className="flex gap-2">
                <button 
                    onClick={() => computeLayout(nodes, edges, false)}
                    className="bg-white/90 px-3 py-1.5 rounded-lg shadow-sm border border-slate-300 text-xs font-bold text-slate-700 hover:text-indigo-600 backdrop-blur-sm transition"
                >
                    Grid Layout
                </button>
                <button 
                    onClick={() => computeLayout(nodes, edges, true)}
                    className="bg-white/90 px-3 py-1.5 rounded-lg shadow-sm border border-slate-300 text-xs font-bold text-slate-700 hover:text-indigo-600 backdrop-blur-sm transition"
                >
                    ELK Layout (Auto)
                </button>
                <button 
                    onClick={() => fitView({ padding: 0.2, duration: 500 })}
                    className="bg-white/90 px-3 py-1.5 rounded-lg shadow-sm border border-slate-300 text-xs font-bold text-slate-700 hover:text-indigo-600 backdrop-blur-sm transition"
                >
                    Fit View
                </button>
            </Panel>
        </ReactFlow>
    );
};

const ERDiagram: React.FC<ERDiagramProps> = (props) => {
    return (
        <div className="w-full h-full flex-1 relative min-h-[500px] bg-slate-100">
            <ReactFlowProvider>
                <ERDiagramInner {...props} />
            </ReactFlowProvider>
        </div>
    );
};

export default ERDiagram;
