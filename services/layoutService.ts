import dagre from 'dagre';
import { Node, Edge, Position } from '@xyflow/react';

// 布局常量配置
const CONFIG = {
  NODE_WIDTH: 240,   // 节点宽度 (需与 CSS 匹配)
  NODE_HEIGHT: 200,  // 估算高度
  RANK_SEP: 180,     // 层级间距 (列距)：越大，连线横向跑道越宽，交叉越不明显
  NODE_SEP: 60,      // 节点间距 (行距)：越大，表格上下分得越开
  RANK_DIR: 'LR',    // 布局方向：从左到右 (Left-Right)
};

/**
 * 计算自动布局
 * @param nodes 原始节点
 * @param edges 原始连线
 * @returns 带有位置信息的节点和连线
 */
export const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: CONFIG.RANK_DIR,
    ranksep: CONFIG.RANK_SEP,
    nodesep: CONFIG.NODE_SEP,
    // network-simplex 通常比 tight-tree 能产生更好的平衡布局，减少长边
    ranker: 'network-simplex', 
    marginx: 50,
    marginy: 50
  });

  // 1. 设置节点
  nodes.forEach((node) => {
    // 动态计算高度，帮助 dagre 更准确地判断“中心点”
    // 如果不传高度，dagre 可能会误判重叠
    const data = node.data as any;
    const propCount = data.entity.properties.length;
    const navCount = data.entity.navigationProperties.length;
    
    // 估算高度公式: Header(36) + Props(26*N) + NavHeader(24) + Navs(26*N) + Padding
    // 这里只计算显示的属性 (max 8)
    const visibleProps = Math.min(propCount, 8);
    const estimatedHeight = 36 + (visibleProps * 26) + (navCount > 0 ? 24 : 0) + (navCount * 26) + 10;

    dagreGraph.setNode(node.id, { 
        width: CONFIG.NODE_WIDTH, 
        height: estimatedHeight 
    });
  });

  // 2. 设置连线
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // 3. 执行布局计算
  dagre.layout(dagreGraph);

  // 4. 应用位置
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    return {
      ...node,
      // React Flow 的 position 是左上角，Dagre 返回的是中心点
      position: {
        x: nodeWithPosition.x - CONFIG.NODE_WIDTH / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      },
      // 强制指定锚点方向，确保连线从左入、从右出
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    };
  });

  return { nodes: layoutedNodes, edges };
};
