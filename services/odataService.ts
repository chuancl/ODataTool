import { ODataSchema, ODataEntity, ODataProperty, ODataNavigationProperty } from '../types';

/**
 * 验证字符串内容是否为有效的 OData Metadata XML
 */
export const isValidODataMetadata = (content: string): boolean => {
    if (!content || typeof content !== 'string') return false;
    const lower = content.toLowerCase();
    return (lower.includes('<edmx:edmx') || lower.includes('<edmx')) && 
           (lower.includes('version="1.0"') || lower.includes('version="2.0"') || lower.includes('version="3.0"') || lower.includes('version="4.0"'));
};

/**
 * 辅助函数：根据 localName 获取 XML 元素列表
 */
const getElementsByLocalName = (parent: Document | Element, localName: string): Element[] => {
    let elements = Array.from(parent.getElementsByTagName(localName));
    if (elements.length > 0) return elements;

    elements = Array.from(parent.getElementsByTagName("edmx:" + localName));
    if (elements.length > 0) return elements;

    // V2/V3 often use 'edm' prefix inside Schema
    elements = Array.from(parent.getElementsByTagName("edm:" + localName));
    if (elements.length > 0) return elements;

    const all = parent.getElementsByTagName("*");
    const result: Element[] = [];
    for (let i = 0; i < all.length; i++) {
        const el = all[i];
        const currentLocalName = el.localName || el.nodeName.split(':').pop();
        if (currentLocalName === localName) {
            result.push(el);
        }
    }
    return result;
};

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

  // 1. 预处理 Associations (V2/V3)
  // 映射关系: Association FullName -> Map<RoleName, TypeName>
  const associationMap = new Map<string, Map<string, string>>();

  schemas.forEach(schema => {
      const namespace = schema.getAttribute("Namespace") || "";
      const associations = getElementsByLocalName(schema, "Association");
      
      for (const assoc of associations) {
          const name = assoc.getAttribute("Name");
          if (!name) continue;

          const fullName = namespace + "." + name;
          const roleMap = new Map<string, string>();
          
          const ends = getElementsByLocalName(assoc, "End");
          for (const end of ends) {
              const role = end.getAttribute("Role");
              const type = end.getAttribute("Type");
              const multiplicity = end.getAttribute("Multiplicity");
              
              if (role && type) {
                  let finalType = type;
                  if (multiplicity === '*') {
                      finalType = `Collection(${type})`;
                  }
                  roleMap.set(role, finalType);
              }
          }
          associationMap.set(fullName, roleMap);
          // 同时也存一个不带命名空间的 key，以防 Relationship 属性未写全名
          if (!associationMap.has(name)) {
              associationMap.set(name, roleMap);
          }
      }
  });

  const entities: ODataEntity[] = [];
  let mainNamespace = "";

  // 2. 解析 Entities
  schemas.forEach(schema => {
      const namespace = schema.getAttribute("Namespace") || "";
      if (!mainNamespace) mainNamespace = namespace;

      const entityTypes = getElementsByLocalName(schema, "EntityType");

      for (const et of entityTypes) {
        const name = et.getAttribute("Name") || "Unknown";
        
        const keys: string[] = [];
        const keyNodes = getElementsByLocalName(et, "Key");
        if (keyNodes.length > 0) {
          const propRefs = getElementsByLocalName(keyNodes[0], "PropertyRef");
          for (const pr of propRefs) {
            keys.push(pr.getAttribute("Name") || "");
          }
        }

        const properties: ODataProperty[] = [];
        const props = getElementsByLocalName(et, "Property");
        for (const p of props) {
          properties.push({
            name: p.getAttribute("Name") || "",
            type: p.getAttribute("Type") || "",
            nullable: p.getAttribute("Nullable") !== "false"
          });
        }

        const navProperties: ODataNavigationProperty[] = [];
        const navProps = getElementsByLocalName(et, "NavigationProperty");
        
        for (const np of navProps) {
          const npName = np.getAttribute("Name") || "";
          let npType = np.getAttribute("Type");

          // V2/V3 兼容逻辑：如果没有 Type，尝试通过 Relationship 解析
          if (!npType) {
              const relationship = np.getAttribute("Relationship");
              const toRole = np.getAttribute("ToRole");
              
              if (relationship && toRole) {
                  // Relationship 可能是 "NorthwindModel.FK_Order_Customer"
                  const roles = associationMap.get(relationship);
                  if (roles) {
                      npType = roles.get(toRole) || null;
                  } else {
                      // 尝试去掉命名空间查找
                      const shortName = relationship.split('.').pop();
                      if (shortName) {
                          const rolesShort = associationMap.get(shortName);
                          if (rolesShort) {
                              npType = rolesShort.get(toRole) || null;
                          }
                      }
                  }
              }
          }

          if (npName && npType) {
            navProperties.push({
                name: npName,
                type: npType
            });
          }
        }

        entities.push({
          name,
          keys,
          properties,
          navigationProperties: navProperties
        });
      }
  });

  const entitySets: { name: string; entityType: string }[] = [];
  // 查找 EntityContainer
  // 遍历所有 Schema 查找 EntityContainer
  for (const schema of schemas) {
      const containers = getElementsByLocalName(schema, "EntityContainer");
      for (const container of containers) {
          const sets = getElementsByLocalName(container, "EntitySet");
          for (const set of sets) {
              entitySets.push({
                  name: set.getAttribute("Name") || "",
                  entityType: set.getAttribute("EntityType") || ""
              });
          }
      }
  }

  return {
    namespace: mainNamespace,
    version,
    entities,
    entitySets
  };
};

export const isODataPage = (doc: Document, url: string, force: boolean = false): { isOData: boolean; type: 'metadata' | 'serviceDoc' | 'data' | 'unknown' } => {
    const contentType = doc.contentType;
    if (force) {
        if (contentType.includes('xml') || contentType.includes('json') || url.includes('$metadata')) {
             if (url.includes('$metadata')) return { isOData: true, type: 'metadata' };
             return { isOData: true, type: 'unknown' };
        }
    }

    if (contentType.includes('xml')) {
        const rootNodeName = doc.documentElement.nodeName;
        // 兼容 V2/V3/V4
        if (rootNodeName.toLowerCase().includes('edmx')) {
            return { isOData: true, type: 'metadata' };
        }
        if (rootNodeName === 'service' || rootNodeName.endsWith(':service')) {
            return { isOData: true, type: 'serviceDoc' };
        }
        if (rootNodeName === 'feed' || rootNodeName.endsWith(':feed')) {
             return { isOData: true, type: 'data' };
        }
    }

    const bodyText = doc.body ? doc.body.innerText : '';
    if (bodyText.trim().startsWith('{')) {
        if (bodyText.includes('@odata.context') || bodyText.includes('__metadata')) {
             return { isOData: true, type: bodyText.includes('$metadata') ? 'metadata' : 'data' };
        }
    }

    if (url.includes('$metadata') && (contentType.includes('xml') || bodyText.includes('xml'))) {
        return { isOData: true, type: 'metadata' };
    }

    return { isOData: false, type: 'unknown' };
};

export const inferMetadataUrl = (url: string): string => {
    if (url.toLowerCase().endsWith('$metadata')) return url;
    // Handle hash fragments
    let baseUrl = url.split('#')[0]; 
    baseUrl = baseUrl.split('?')[0];
    
    if (baseUrl.includes('.svc')) {
        const parts = baseUrl.split('.svc');
        return `${parts[0]}.svc/$metadata`;
    }
    baseUrl = baseUrl.replace(/\/$/, '');
    return `${baseUrl}/$metadata`;
};
