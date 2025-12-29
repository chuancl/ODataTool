import { ODataSchema, ODataEntity, ODataProperty, ODataNavigationProperty } from '../types';

/**
 * 验证字符串内容是否为有效的 OData Metadata XML
 */
export const isValidODataMetadata = (content: string): boolean => {
    if (!content || typeof content !== 'string') return false;
    // 检查是否包含关键的 Edmx 标签 (忽略大小写)
    const lower = content.toLowerCase();
    return (lower.includes('<edmx:edmx') || lower.includes('<edmx')) && 
           (lower.includes('version="1.0"') || lower.includes('version="4.0"'));
};

/**
 * 辅助函数：根据 localName 获取 XML 元素列表 (忽略 namespace 前缀)
 */
const getElementsByLocalName = (parent: Document | Element, localName: string): Element[] => {
    // 优先尝试 getElementsByTagName (性能好)
    let elements = Array.from(parent.getElementsByTagName(localName));
    if (elements.length > 0) return elements;

    // 尝试带常见前缀的
    elements = Array.from(parent.getElementsByTagName("edmx:" + localName));
    if (elements.length > 0) return elements;

    // 兜底：遍历所有子元素匹配 localName (性能较差，但兼容性最强)
    // 注意：getElementsByTagName('*') 返回的是 HTMLCollection，需要转数组
    const all = parent.getElementsByTagName("*");
    const result: Element[] = [];
    for (let i = 0; i < all.length; i++) {
        const el = all[i];
        // 兼容处理：有些环境 localName 可能不准确，使用 nodeName 拆分
        const currentLocalName = el.localName || el.nodeName.split(':').pop();
        if (currentLocalName === localName) {
            result.push(el);
        }
    }
    return result;
};

/**
 * 解析 XML 格式的 OData $metadata 内容
 */
export const parseODataMetadata = (xmlContent: string): ODataSchema => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

  const edmxList = getElementsByLocalName(xmlDoc, "Edmx");
  if (edmxList.length === 0) {
      throw new Error("无效的 OData Metadata: 未找到 <Edmx> 根节点");
  }
  const edmx = edmxList[0];
  const version = edmx.getAttribute("Version") || "Unknown";

  const schemas = getElementsByLocalName(xmlDoc, "Schema");
  if (schemas.length === 0) {
    throw new Error("无效的 OData Metadata: 未找到 <Schema> 定义");
  }

  // 简化处理：通常取第一个主 Schema，或者包含 EntityType 的那个
  let schemaNode = schemas[0];
  // 尝试找到包含 EntityType 的 Schema (有些 metadata 有多个 schema，比如包含系统定义的)
  for (const s of schemas) {
      if (getElementsByLocalName(s, "EntityType").length > 0) {
          schemaNode = s;
          break;
      }
  }

  const namespace = schemaNode.getAttribute("Namespace") || "";

  const entities: ODataEntity[] = [];
  const entityTypes = getElementsByLocalName(schemaNode, "EntityType");

  for (const et of entityTypes) {
    const name = et.getAttribute("Name") || "Unknown";
    
    // 解析主键
    const keys: string[] = [];
    const keyNodes = getElementsByLocalName(et, "Key");
    if (keyNodes.length > 0) {
      const propRefs = getElementsByLocalName(keyNodes[0], "PropertyRef");
      for (const pr of propRefs) {
        keys.push(pr.getAttribute("Name") || "");
      }
    }

    // 解析属性
    const properties: ODataProperty[] = [];
    const props = getElementsByLocalName(et, "Property");
    for (const p of props) {
      properties.push({
        name: p.getAttribute("Name") || "",
        type: p.getAttribute("Type") || "",
        nullable: p.getAttribute("Nullable") !== "false"
      });
    }

    // 解析导航属性
    const navProperties: ODataNavigationProperty[] = [];
    const navProps = getElementsByLocalName(et, "NavigationProperty");
    for (const np of navProps) {
      let type = np.getAttribute("Type") || "";
      // V2/V3 有时使用 Relationship 属性，这里暂主要支持 V4 风格或通过 Type 属性
      // 如果没有 Type，尝试从 Association 解析 (V2)，这里暂时略过复杂 V2 Association 解析，
      // 只要有 Name 就加上
      navProperties.push({
        name: np.getAttribute("Name") || "",
        type: type
      });
    }

    entities.push({
      name,
      keys,
      properties,
      navigationProperties: navProperties
    });
  }

  // 解析 EntitySets (容器)
  const entitySets: { name: string; entityType: string }[] = [];
  const entityContainers = getElementsByLocalName(schemaNode, "EntityContainer");
  
  // 有些 V2 版本 EntityContainer 在 Schema 下直接有，或者在其他 Schema 中
  // 这里简单处理：查找当前 Schema 或 全局搜索
  const container = entityContainers.length > 0 ? entityContainers[0] : getElementsByLocalName(xmlDoc, "EntityContainer")[0];
  
  if (container) {
    const sets = getElementsByLocalName(container, "EntitySet");
    for (const set of sets) {
      entitySets.push({
        name: set.getAttribute("Name") || "",
        entityType: set.getAttribute("EntityType") || ""
      });
    }
  }

  return {
    namespace,
    version,
    entities,
    entitySets
  };
};

/**
 * 判断当前页面/内容是否是 OData 服务 (被动检测)
 */
export const isODataPage = (doc: Document, url: string, force: boolean = false): { isOData: boolean; type: 'metadata' | 'serviceDoc' | 'data' | 'unknown' } => {
    // ... 保持原有逻辑不变，只修改了上面的 parseODataMetadata ...
    const contentType = doc.contentType;
    if (force) {
        if (contentType.includes('xml') || contentType.includes('json') || url.includes('$metadata')) {
             if (url.includes('$metadata')) return { isOData: true, type: 'metadata' };
             return { isOData: true, type: 'unknown' };
        }
    }

    if (contentType.includes('xml')) {
        const rootNodeName = doc.documentElement.nodeName;
        if (rootNodeName.includes('Edmx') || doc.documentElement.localName === 'Edmx') {
            return { isOData: true, type: 'metadata' };
        }
        if (rootNodeName === 'service' || rootNodeName.endsWith(':service')) {
            return { isOData: true, type: 'serviceDoc' };
        }
        if (rootNodeName === 'feed' || rootNodeName.endsWith(':feed')) {
             if (doc.documentElement.innerHTML.includes('schemas.microsoft.com/ado')) {
                 return { isOData: true, type: 'data' };
             }
        }
    }

    const bodyText = doc.body ? doc.body.innerText : '';
    if (bodyText.trim().startsWith('{')) {
        if (bodyText.includes('@odata.context')) {
             return { isOData: true, type: bodyText.includes('$metadata') ? 'metadata' : 'data' };
        }
        if (bodyText.includes('__metadata') && bodyText.includes('"uri":')) {
            return { isOData: true, type: 'data' };
        }
    }

    if (url.includes('$metadata') && (contentType.includes('xml') || bodyText.includes('xml'))) {
        return { isOData: true, type: 'metadata' };
    }

    return { isOData: false, type: 'unknown' };
};

export const inferMetadataUrl = (url: string): string => {
    if (url.toLowerCase().endsWith('$metadata')) return url;
    let baseUrl = url.split('?')[0];
    if (baseUrl.includes('.svc')) {
        const parts = baseUrl.split('.svc');
        return `${parts[0]}.svc/$metadata`;
    }
    baseUrl = baseUrl.replace(/\/$/, '');
    return `${baseUrl}/$metadata`;
};
