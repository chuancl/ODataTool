import { ODataSchema, ODataEntity, ODataProperty, ODataNavigationProperty } from '../types';

/**
 * 解析 XML 格式的 OData $metadata 内容
 */
export const parseODataMetadata = (xmlContent: string): ODataSchema => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

  const edmx = xmlDoc.getElementsByTagName("edmx:Edmx")[0] || xmlDoc.getElementsByTagName("Edmx")[0];
  if (!edmx) {
      // 某些情况下 getElementsByTagName 无法处理带命名空间的标签，尝试 querySelector
      const edmxQuery = xmlDoc.querySelector("Edmx");
      if(!edmxQuery) throw new Error("无效的 OData Metadata: 未找到 <edmx:Edmx> 根节点");
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
 */
export const isODataPage = (doc: Document, url: string): { isOData: boolean; type: 'metadata' | 'serviceDoc' | 'data' | 'unknown' } => {
    const contentType = doc.contentType;
    
    // 1. 如果是 XML 文档 (application/xml, text/xml)
    if (contentType.includes('xml')) {
        const rootNodeName = doc.documentElement.nodeName;
        
        // Metadata ($metadata)
        if (rootNodeName.includes('Edmx')) {
            return { isOData: true, type: 'metadata' };
        }
        
        // Service Document (AtomPub, e.g. Northwind.svc/)
        // root node usually <service> with xmlns="http://www.w3.org/2007/app"
        if (rootNodeName === 'service' || rootNodeName.endsWith(':service')) {
            return { isOData: true, type: 'serviceDoc' };
        }

        // Atom Feed (OData v2/v3 data)
        if (rootNodeName === 'feed' || rootNodeName.endsWith(':feed')) {
             // 检查是否有 m:properties 等 OData 特征
             if (doc.documentElement.innerHTML.includes('schemas.microsoft.com/ado')) {
                 return { isOData: true, type: 'data' };
             }
        }
    }

    // 2. 如果是 JSON 文档 (或纯文本显示的 JSON)
    // Chrome 有时会把 application/json 显示为纯文本
    const bodyText = doc.body ? doc.body.innerText : '';
    if (bodyText.startsWith('{') && bodyText.includes('@odata.context')) {
        return { isOData: true, type: bodyText.includes('$metadata') ? 'metadata' : 'data' };
    }
    
    // V2 JSON
    if (bodyText.includes('__metadata') && bodyText.includes('"uri":')) {
        return { isOData: true, type: 'data' };
    }

    // 3. URL 辅助判断
    if (url.includes('$metadata')) return { isOData: true, type: 'metadata' };

    return { isOData: false, type: 'unknown' };
};

/**
 * 尝试从当前 URL 推断 Metadata URL
 */
export const inferMetadataUrl = (url: string): string => {
    if (url.includes('$metadata')) return url;
    
    let cleanUrl = url.split('?')[0].replace(/\/$/, '');
    
    // 针对 .svc 服务的处理 (WCF Data Services)
    if (cleanUrl.endsWith('.svc')) {
        return `${cleanUrl}/$metadata`;
    }
    
    // 默认尝试追加 $metadata
    return `${cleanUrl}/$metadata`;
};
