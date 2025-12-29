import dagre from 'dagre';
import { Node, Edge, Position } from '@xyflow/react';

// =============================================================================
// 布局核心逻辑配置
// =============================================================================
// Dagre 是一个层级布局算法，它不知道 React Flow 的连线具体怎么画（贝塞尔/折线）。
// 它只负责计算“节点（表格）”应该摆在哪里。
// 连线的“乱跑”通常是因为节点之间太挤，导致折线没有空间拐弯。
const CONFIG = {
  NODE_WIDTH: 240,   // 节点的固定宽度，必须与 EntityNode.tsx 的 w-[220px] + padding 匹配
  NODE_HEIGHT: 200,  // 节点的估算高度，用于占位
  
  // *** 关键参数调整 ***
  RANK_SEP: 300,     // [列间距]：层级之间的水平距离。
                     // 设得很大 (300) 是为了给 SourceHandle 出去的线留出足够的“跑道”。
                     // 如果太小，线一出来就得马上急转弯，容易穿过其他节点。
  
  NODE_SEP: 80,      // [行间距]：同层级节点之间的垂直距离。防止表格上下叠在一起。
  
  EDGE_SEP: 50,      // [连线间距]：告诉算法在计算时，尽量让线与线之间留出缝隙。

  RANK_DIR: 'LR',    // [流向]：Left to Right (左到右)，符合 ER 图一般阅读习惯。
};

/**
 * 布局计算主函数
 * @description
 * 1. 接收 React Flow 格式的 Nodes 和 Edges。
 * 2. 转换为 Dagre 图结构。
 * 3. 运行 network-simplex 算法计算坐标。
 * 4. 返回带有 x, y 坐标的新 Nodes。
 */
export const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: CONFIG.RANK_DIR,
    ranksep: CONFIG.RANK_SEP,
    nodesep: CONFIG.NODE_SEP,
    edgesep: CONFIG.EDGE_SEP,
    // 'network-simplex' 算法通常能产生更平衡的层级，减少长边的出现
    ranker: 'network-simplex', 
    marginx: 50,
    marginy: 50
  });

  // 1. 注册节点到算法引擎
  nodes.forEach((node) => {
    // 动态计算高度：为了让布局更紧凑，我们需要告诉算法这个表格到底有多高。
    const data = node.data as any;
    const propCount = data.entity.properties.length;
    const navCount = data.entity.navigationProperties.length;
    
    // 估算公式：Header(40px) + 属性行(26px * 数量) + 导航行(28px * 数量) + Padding
    // 限制 visibleProps 为 8，与 EntityNode.tsx 保持一致
    const visibleProps = Math.min(propCount, 8);
    const estimatedHeight = 40 + (visibleProps * 26) + (navCount > 0 ? 10 : 0) + (navCount * 28) + 20;

    dagreGraph.setNode(node.id, { 
        width: CONFIG.NODE_WIDTH, 
        height: estimatedHeight 
    });
  });

  // 2. 注册连线到算法引擎
  // 算法会尝试缩短这些连线的距离，从而决定节点的位置
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // 3. 执行计算 (这是核心的一步，所有坐标都在这里生成)
  dagre.layout(dagreGraph);

  // 4. 将计算结果回填给 React Flow Node
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    return {
      ...node,
      // Dagre 返回的是中心点坐标，React Flow 需要左上角坐标，所以需要偏移
      position: {
        x: nodeWithPosition.x - CONFIG.NODE_WIDTH / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      },
      // 强制锚点方向，优化连线算法
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    };
  });

  return { nodes: layoutedNodes, edges };
};