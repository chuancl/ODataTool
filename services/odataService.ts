import { ODataSchema, ODataEntity, ODataProperty, ODataNavigationProperty } from '../types';

/**
 * 解析 XML 格式的 OData $metadata 内容
 */
export const parseODataMetadata = (xmlContent: string): ODataSchema => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

  const edmx = xmlDoc.getElementsByTagName("edmx:Edmx")[0] || xmlDoc.getElementsByTagName("Edmx")[0];
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
      // Type 可能是 "Namespace.Type" 或 "Collection(Namespace.Type)"
      let type = np.getAttribute("Type") || "";
      
      // 简单处理关联约束（如果有）
      // OData V4 通常在这里，V2 可能在 Association 中，这里简化针对 V4
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
 * 判断内容是否看起来像 OData Metadata XML
 */
export const isODataMetadata = (content: string): boolean => {
  return content.includes("<edmx:Edmx") || (content.includes("<Schema") && content.includes('xmlns="http://schemas.microsoft.com/ado'));
};

/**
 * 判断内容是否像 OData JSON 响应
 */
export const isODataJson = (content: string): boolean => {
  return content.includes("@odata.context") || content.includes("__metadata");
};
