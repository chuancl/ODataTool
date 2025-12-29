import ELK from 'elkjs/lib/elk.bundled.js';
import { Node, Edge, Position } from '@xyflow/react';

// 初始化 ELK 实例
const elk = new ELK();

// =============================================================================
// 布局配置
// =============================================================================
const CONFIG = {
  NODE_WIDTH: 240, // 必须与 EntityNode 实际宽度匹配
  // ELK 布局选项参考: https://www.eclipse.org/elk/reference/options.html
  layoutOptions: {
    'elk.algorithm': 'layered', // 分层布局，最适合 ER 图
    'elk.direction': 'RIGHT',   // 从左到右
    
    // 间距设置
    'elk.spacing.nodeNode': '60', // 同层节点垂直间距 (防止太挤)
    'elk.layered.spacing.nodeNodeBetweenLayers': '250', // 层与层之间的水平间距 (留出连线跑道)
    
    // 交叉最小化策略
    'elk.layered.crossingMinimization.strategy': 'INTERACTIVE', // 高质量减少交叉
    
    // 连线路由设置
    'elk.edgeRouting': 'ORTHOGONAL', // 正交路由 (直角折线)，比 SPLINES 更整洁
    
    // 节点对齐
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF', // 这种策略通常能让长线更直
    
    // 允许根据连线调整节点顺序
    'elk.layered.considerModelOrder.strategy': 'NONE', 
  }
};

/**
 * 使用 ELK 计算布局 (异步)
 */
export const getLayoutedElements = async (nodes: Node[], edges: Edge[]) => {
  // 1. 构建 ELK 需要的 Graph 结构
  const elkGraph = {
    id: 'root',
    layoutOptions: CONFIG.layoutOptions,
    children: nodes.map((node) => {
      // 动态计算高度
      const data = node.data as any;
      const propCount = data.entity.properties.length;
      const navCount = data.entity.navigationProperties.length;
      
      // 估算高度: Header(40) + Props(26*N) + Navs(28*N) + Padding
      const visibleProps = Math.min(propCount, 8);
      const estimatedHeight = 40 + (visibleProps * 26) + (navCount > 0 ? 10 : 0) + (navCount * 28) + 20;

      return {
        id: node.id,
        width: CONFIG.NODE_WIDTH,
        height: estimatedHeight,
        // 如果未来需要更精确的端口(Port)布局，可以在这里添加 ports 定义
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  try {
    // 2. 执行布局计算
    const layoutedGraph = await elk.layout(elkGraph);

    // 3. 将结果映射回 React Flow Nodes
    // ELK 返回的是左上角坐标，这与 React Flow 一致，不需要像 Dagre 那样转换中心点
    const layoutedNodes = nodes.map((node) => {
      const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);

      if (!elkNode) return node;

      return {
        ...node,
        position: {
          x: elkNode.x || 0,
          y: elkNode.y || 0,
        },
        // 强制指定 Handle 位置，配合 CSS 布局
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
      };
    });

    return { nodes: layoutedNodes, edges };
  } catch (error) {
    console.error('ELK Layout Error:', error);
    // 如果出错，返回原始节点，避免崩溃
    return { nodes, edges };
  }
};