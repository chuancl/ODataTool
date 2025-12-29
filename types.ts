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
  type: string; // 关联的实体类型 (e.g., "Collection(NorthwindModel.Order)" or "NorthwindModel.Category")
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

export interface AppSettings {
  enableGlobal: boolean;
  whitelist: string[]; // 存储 URL 包含的关键词或正则
}

export const DEFAULT_SETTINGS: AppSettings = {
  enableGlobal: true,
  whitelist: []
};