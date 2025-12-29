import { ODataSchema, ODataEntity, ODataProperty, ODataNavigationProperty } from '../types';

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
 * 判断当前页面/内容是否是 OData 服务
 * @param force 如果为 true (白名单)，则只要有一点像就认为是
 */
export const isODataPage = (doc: Document, url: string, force: boolean = false): { isOData: boolean; type: 'metadata' | 'serviceDoc' | 'data' | 'unknown' } => {
    
    // 0. 强制模式：如果是 XML 或 JSON 且在白名单，直接通过
    const contentType = doc.contentType;
    if (force) {
        if (contentType.includes('xml') || contentType.includes('json') || url.includes('$metadata')) {
             // 简单的类型推断
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

    // 3. URL 辅助判断 (必须配合内容验证，除非是 force 模式)
    if (url.includes('$metadata') && (contentType.includes('xml') || bodyText.includes('xml'))) {
        return { isOData: true, type: 'metadata' };
    }

    return { isOData: false, type: 'unknown' };
};

export const inferMetadataUrl = (url: string): string => {
    if (url.includes('$metadata')) return url;
    let cleanUrl = url.split('?')[0].replace(/\/$/, '');
    if (cleanUrl.endsWith('.svc')) {
        return `${cleanUrl}/$metadata`;
    }
    return `${cleanUrl}/$metadata`;
};
