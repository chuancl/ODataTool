import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ODataEntity } from '../types';

interface EntityNodeProps {
  data: {
    entity: ODataEntity;
  };
}

const EntityNode = memo(({ data }: EntityNodeProps) => {
  const { entity } = data;
  if (!entity) return null;

  const keyProperties = entity.properties.filter(p => entity.keys.includes(p.name));
  const otherProperties = entity.properties.filter(p => !entity.keys.includes(p.name));
  
  const MAX_VISIBLE_PROPS = 8;
  const visibleProps = otherProperties.slice(0, MAX_VISIBLE_PROPS);
  const hiddenCount = otherProperties.length - MAX_VISIBLE_PROPS;

  // Handle 样式：完全透明或微小，只用于连接逻辑，视觉上依赖连线指向行
  const handleStyle = { width: 1, height: 1, minWidth: 0, minHeight: 0, opacity: 0, border: 0 };

  return (
    <div className="w-[220px] bg-white border border-slate-800 shadow-[2px_2px_0px_rgba(0,0,0,0.1)] text-[11px] font-sans">
      
      {/* 
          Target Handle: 放在整个实体的左侧中心
          接收进入的连线
      */}
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{...handleStyle, left: -2}}
      />

      {/* Header: 类似数据库管理工具的深色标题 */}
      <div className="bg-slate-100 border-b border-slate-800 px-2 py-1.5 flex items-center justify-between">
        <span className="font-bold text-slate-900 truncate" title={entity.name}>
          {entity.name}
        </span>
      </div>

      {/* 内容区域 */}
      <div className="flex flex-col">
        
        {/* PK Rows */}
        {keyProperties.map((prop) => (
          <div key={prop.name} className="flex items-center justify-between px-2 py-1 border-b border-slate-200 bg-white relative">
             <div className="flex items-center gap-1 overflow-hidden mr-1">
                {/* 简单的 PK 标识 */}
                <span className="text-[9px] font-bold text-slate-800 shrink-0 border border-slate-400 px-0.5 rounded-[2px] leading-none h-3 flex items-center">PK</span>
                <span className="font-bold text-slate-900 truncate">{prop.name}</span>
             </div>
             <span className="text-[10px] text-slate-500 truncate max-w-[60px]">{prop.type.split('.').pop()}</span>
          </div>
        ))}

        {/* Property Rows */}
        {visibleProps.map((prop, index) => (
          <div 
            key={prop.name} 
            className="flex items-center justify-between px-2 py-1 border-b border-slate-100 last:border-0 relative"
          >
            <span className="truncate text-slate-700 mr-2">{prop.name}</span>
            <span className="text-[10px] text-slate-400 truncate max-w-[60px]">
              {prop.type.split('.').pop()}
            </span>
          </div>
        ))}

        {hiddenCount > 0 && (
           <div className="px-2 py-0.5 text-center bg-slate-50 border-b border-slate-100">
             <span className="text-[9px] text-slate-400 italic">... {hiddenCount} more</span>
           </div>
        )}

        {/* Navigation / FK Rows */}
        {entity.navigationProperties.length > 0 && (
          <div className="border-t border-slate-800 mt-[-1px]"> {/* 重叠边框以加黑分隔线 */}
            {entity.navigationProperties.map((nav) => {
              const handleId = `source-${nav.name}`;
              return (
                <div 
                  key={nav.name} 
                  className="relative flex items-center justify-between px-2 py-1 border-b border-slate-200 last:border-0 bg-slate-50/30 group hover:bg-blue-50 transition-colors"
                >
                  <span className="truncate font-medium text-slate-800 mr-2" title={nav.name}>
                    {nav.name}
                  </span>
                  
                  {/* Source Handle: 绑定到具体行，位于右侧 */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={handleId}
                    style={{...handleStyle, right: -2}}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

export default EntityNode;