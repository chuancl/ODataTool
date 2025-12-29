// OData 模型定义

export interface ODataEntity {
  name: string;
  keys: string[];
  properties: ODataProperty[];
  navigationProperties: ODataNavigationProperty[];
}

export interface ODataProperty {
  name: string;
  type: string;
  nullable?: boolean;
}

export interface ODataNavigationProperty {
  name: string;
  type: string; // 关联的实体类型
  referentialConstraint?: {
    property: string;
    referencedProperty: string;
  };
}

export interface ODataSchema {
  namespace: string;
  entities: ODataEntity[];
  entitySets: { name: string; entityType: string }[];
  version: string;
}

export interface ViewerState {
  sourceType: 'url' | 'file' | 'raw';
  url?: string;
  content?: string;
  isLoading: boolean;
  error?: string;
  schema?: ODataSchema;
}
