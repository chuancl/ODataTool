import { ODataSchema, ODataEntity, ODataProperty, ODataNavigationProperty } from '../types';

/**
 * 解析 XML 格式的 OData $metadata 内容
 */
export const parseODataMetadata = (xmlContent: string): ODataSchema => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

  const edmx = xmlDoc.getElementsByTagName("edmx:Edmx")[0] || xmlDoc.getElementsByTagName("Edmx")[0];
  if (!edmx) {
      // 尝试处理含命名空间的标签，如 <edmx:Edmx> 在某些浏览器下可能需要带命名空间查找，或者不带
      // 这里简化处理，如果找不到 Edmx，可能不是 Metadata
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
 * 判断内容是否看起来像 OData
 */
export const isODataContent = (content: string, url: string): { isOData: boolean; type: 'metadata' | 'serviceDoc' | 'data' | 'unknown' } => {
    // 1. Check URL patterns
    const isMetadataUrl = url.includes('$metadata');
    
    // 2. Check Content Patterns
    
    // Metadata (XML)
    if (content.includes('<edmx:Edmx') || (content.includes('<Schema') && content.includes('http://schemas.microsoft.com/ado'))) {
        return { isOData: true, type: 'metadata' };
    }

    // Service Document (XML AtomPub) - e.g. Northwind.svc/
    if (content.includes('<service') && content.includes('http://www.w3.org/2007/app') && content.includes('<workspace>')) {
        return { isOData: true, type: 'serviceDoc' };
    }

    // JSON Responses
    if (content.includes('@odata.context')) {
        // V4 JSON
        return { isOData: true, type: content.includes('$metadata') ? 'metadata' : 'data' };
    }
    
    // V2/V3 JSON often has "d": { ... } or __metadata
    if (content.includes('__metadata') && content.includes('"uri":')) {
        return { isOData: true, type: 'data' };
    }

    // Fallback URL check
    if (isMetadataUrl) return { isOData: true, type: 'metadata' };

    return { isOData: false, type: 'unknown' };
};

/**
 * 尝试从当前 URL 推断 Metadata URL
 */
export const inferMetadataUrl = (url: string): string => {
    if (url.includes('$metadata')) return url;
    
    // 如果以 / 结尾，去掉
    let cleanUrl = url.replace(/\/$/, ''); // Remove trailing slash
    
    // 简单的启发式：如果是 Service Root，直接加 $metadata
    // 如果是 EntitySet (e.g. /Products)，通常 Metadata 在 Root/$metadata
    // 这里我们简单粗暴处理：尝试在末尾加 $metadata，或者如果包含 .svc，则在 .svc 后加 $metadata
    
    if (cleanUrl.includes('.svc')) {
        const parts = cleanUrl.split('.svc');
        return `${parts[0]}.svc/$metadata`;
    }
    
    // 如果是纯 Rest 风格 (e.g. /api/odata/People)，我们假设同级或父级
    // 对于通用情况，直接 append 往往是错的 (e.g. /People -> /People/$metadata is wrong, should be /$metadata)
    // 此时最安全的做法是让用户确认，或者我们在 Viewer 里尝试 fetch
    // 这里为了 Demo，先直接 append，Viewer 里失败了用户可以改
    return `${cleanUrl}/$metadata`;
};
