import { ODataSchema, ODataEntity, ODataProperty, ODataNavigationProperty } from '../types';

/**
 * 验证字符串内容是否为有效的 OData Metadata XML
 */
export const isValidODataMetadata = (content: string): boolean => {
    if (!content || typeof content !== 'string') return false;
    // 检查是否包含关键的 Edmx 标签
    return (content.includes('<edmx:Edmx') || content.includes('<Edmx')) && 
           (content.includes('Version="1.0"') || content.includes('Version="4.0"'));
};

/**
 * 解析 XML 格式的 OData $metadata 内容
 */
export const parseODataMetadata = (xmlContent: string): ODataSchema => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

  const edmx = xmlDoc.getElementsByTagName("edmx:Edmx")[0] || xmlDoc.getElementsByTagName("Edmx")[0] || xmlDoc.querySelector("Edmx");
  if (!edmx) {
      throw new Error("无效的 OData Metadata: 未找到 <edmx:Edmx> 根节点");
  }
  const version = edmx?.getAttribute("Version") || "Unknown";

  const schemas = xmlDoc.getElementsByTagName("Schema");
  if (schemas.length === 0) {
    throw new Error("无效的 OData Metadata: 未找到 Schema 定义");
  }

  // 简化处理：取第一个 Schema
  const schemaNode = schemas[0];
  const namespace = schemaNode.getAttribute("Namespace") || "";

  const entities: ODataEntity[] = [];
  const entityTypes = schemaNode.getElementsByTagName("EntityType");

  for (let i = 0; i < entityTypes.length; i++) {
    const et = entityTypes[i];
    const name = et.getAttribute("Name") || "Unknown";
    
    // 解析主键
    const keys: string[] = [];
    const keyNode = et.getElementsByTagName("Key")[0];
    if (keyNode) {
      const propRefs = keyNode.getElementsByTagName("PropertyRef");
      for (let j = 0; j < propRefs.length; j++) {
        keys.push(propRefs[j].getAttribute("Name") || "");
      }
    }

    // 解析属性
    const properties: ODataProperty[] = [];
    const props = et.getElementsByTagName("Property");
    for (let j = 0; j < props.length; j++) {
      const p = props[j];
      properties.push({
        name: p.getAttribute("Name") || "",
        type: p.getAttribute("Type") || "",
        nullable: p.getAttribute("Nullable") !== "false"
      });
    }

    // 解析导航属性
    const navProperties: ODataNavigationProperty[] = [];
    const navProps = et.getElementsByTagName("NavigationProperty");
    for (let j = 0; j < navProps.length; j++) {
      const np = navProps[j];
      let type = np.getAttribute("Type") || "";
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
  const entityContainers = schemaNode.getElementsByTagName("EntityContainer");
  if (entityContainers.length > 0) {
    const sets = entityContainers[0].getElementsByTagName("EntitySet");
    for (let i = 0; i < sets.length; i++) {
      const set = sets[i];
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
 * @param force 如果为 true (白名单)，则只要有一点像就认为是
 */
export const isODataPage = (doc: Document, url: string, force: boolean = false): { isOData: boolean; type: 'metadata' | 'serviceDoc' | 'data' | 'unknown' } => {
    
    // 0. 强制模式：如果是 XML 或 JSON 且在白名单，直接通过
    const contentType = doc.contentType;
    if (force) {
        if (contentType.includes('xml') || contentType.includes('json') || url.includes('$metadata')) {
             if (url.includes('$metadata')) return { isOData: true, type: 'metadata' };
             return { isOData: true, type: 'unknown' };
        }
    }

    // 1. 如果是 XML 文档
    if (contentType.includes('xml')) {
        const rootNodeName = doc.documentElement.nodeName;
        
        // Metadata ($metadata)
        if (rootNodeName.includes('Edmx')) {
            return { isOData: true, type: 'metadata' };
        }
        
        // Service Document
        if (rootNodeName === 'service' || rootNodeName.endsWith(':service')) {
            return { isOData: true, type: 'serviceDoc' };
        }

        // Atom Feed
        if (rootNodeName === 'feed' || rootNodeName.endsWith(':feed')) {
             if (doc.documentElement.innerHTML.includes('schemas.microsoft.com/ado')) {
                 return { isOData: true, type: 'data' };
             }
        }
    }

    // 2. 如果是 JSON 文档
    const bodyText = doc.body ? doc.body.innerText : '';
    if (bodyText.trim().startsWith('{')) {
        if (bodyText.includes('@odata.context')) {
             return { isOData: true, type: bodyText.includes('$metadata') ? 'metadata' : 'data' };
        }
        // V2 JSON
        if (bodyText.includes('__metadata') && bodyText.includes('"uri":')) {
            return { isOData: true, type: 'data' };
        }
    }

    // 3. URL 辅助判断
    if (url.includes('$metadata') && (contentType.includes('xml') || bodyText.includes('xml'))) {
        return { isOData: true, type: 'metadata' };
    }

    return { isOData: false, type: 'unknown' };
};

/**
 * 推断 Metadata URL
 * 例如: 
 * - http://host/service.svc/Customers -> http://host/service.svc/$metadata
 * - http://host/service.svc -> http://host/service.svc/$metadata
 */
export const inferMetadataUrl = (url: string): string => {
    if (url.toLowerCase().endsWith('$metadata')) return url;
    
    // 移除查询参数
    let baseUrl = url.split('?')[0];
    
    // 如果包含 .svc，通常 Metadata 在 .svc/$metadata
    if (baseUrl.includes('.svc')) {
        const parts = baseUrl.split('.svc');
        return `${parts[0]}.svc/$metadata`;
    }
    
    // 如果没有 .svc，尝试直接在末尾添加 (处理 V4 RESTful 风格)
    // 移除末尾斜杠
    baseUrl = baseUrl.replace(/\/$/, '');
    
    // 简单的启发式：如果是 /EntitySet 结尾，去掉一级再加 $metadata
    // 但最通用的做法是直接拼，或者让 Viewer 去试错。
    // 这里我们尝试直接追加，因为对于 probe 来说，我们通常是在 service root 或 entity set 上
    return `${baseUrl}/$metadata`;
};
