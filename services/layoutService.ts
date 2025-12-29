import ELK from 'elkjs/lib/elk.bundled.js';
import { Node, Edge, Position } from '@xyflow/react';

const elk = new ELK();

const CONFIG = {
  NODE_WIDTH: 240, 
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    
    // 垂直间距：适当增加，避免节点上下太挤
    'elk.spacing.nodeNode': '60', 
    
    // 水平间距：大大增加，因为现在是字段对字段的连线，中间需要足够的空间给折线
    'elk.layered.spacing.nodeNodeBetweenLayers': '280', 
    
    // 交叉最小化：使用更高级的策略
    'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
    
    // 路由：正交（直角），这对于表格连线最清晰
    'elk.edgeRouting': 'ORTHOGONAL',
    
    // 节点放置策略：Brandes Koepf 通常能产生最直的长线
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    
    // 尝试平衡节点位置，减少“狗腿”弯折
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    
    // 端口约束：虽然我们没有显式定义 port 对象，但这个选项有时能帮助 ELK 理解我们希望侧面连接 
    'elk.layered.spacing.edgeNodeBetweenLayers': '50',
  }
};

export const getLayoutedElements = async (nodes: Node[], edges: Edge[]) => {
  const elkGraph = {
    id: 'root',
    layoutOptions: CONFIG.layoutOptions,
    children: nodes.map((node) => {
      const data = node.data as any;
      const propCount = data.entity.properties.length;
      const navCount = data.entity.navigationProperties.length;
      
      // 重新估算高度，与 EntityNode 的新 CSS 匹配
      // Header(34) + PKs(28*N) + Props(26*N) + Navs(28*N) + Padding
      const visibleProps = Math.min(propCount, 8);
      const keyCount = data.entity.keys.length;
      
      // 注意：EntityNode 现在的结构有所变化，PK 也是独立的行
      // Header ~35px
      // PK Rows ~30px each
      // Prop Rows ~26px each
      // Nav Rows ~30px each
      
      const contentHeight = 
          35 + 
          (keyCount * 30) + 
          (visibleProps * 26) + 
          (navCount > 0 ? 10 : 0) + (navCount * 30) + 
          20;

      return {
        id: node.id,
        width: CONFIG.NODE_WIDTH,
        height: contentHeight,
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  try {
    const layoutedGraph = await elk.layout(elkGraph);

    const layoutedNodes = nodes.map((node) => {
      const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
      if (!elkNode) return node;

      return {
        ...node,
        position: {
          x: elkNode.x || 0,
          y: elkNode.y || 0,
        },
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
      };
    });

    return { nodes: layoutedNodes, edges };
  } catch (error) {
    console.error('ELK Layout Error:', error);
    return { nodes, edges };
  }
};