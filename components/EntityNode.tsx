import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ODataEntity } from '../types';

interface EntityNodeProps {
  data: {
    entity: ODataEntity;
  };
}

// 辅助函数：生成安全的 Handle ID
export const getHandleId = (navName: string) => `source-${navName.replace(/[^a-zA-Z0-9]/g, '_')}`;

const EntityNode = memo(({ data }: EntityNodeProps) => {
  const { entity } = data;
  if (!entity) return null;

  const keyProperties = entity.properties.filter(p => entity.keys.includes(p.name));
  const otherProperties = entity.properties.filter(p => !entity.keys.includes(p.name));
  
  const MAX_VISIBLE_PROPS = 8;
  const visibleProps = otherProperties.slice(0, MAX_VISIBLE_PROPS);
  const hiddenCount = otherProperties.length - MAX_VISIBLE_PROPS;

  // Handle 样式：完全透明，作为逻辑锚点
  const handleStyle = { width: 1, height: 1, minWidth: 0, minHeight: 0, opacity: 0, border: 0 };

  return (
    <div className="w-[220px] bg-white border border-slate-800 shadow-[4px_4px_0px_rgba(0,0,0,0.1)] text-[11px] font-sans">
      
      {/* Target Handle: 统一在左侧接收连线 */}
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{...handleStyle, left: -2, top: '50%'}}
      />

      {/* Header */}
      <div className="bg-slate-100 border-b border-slate-800 px-2 py-2 flex items-center justify-between">
        <span className="font-bold text-slate-900 truncate text-xs" title={entity.name}>
          {entity.name}
        </span>
      </div>

      {/* Properties */}
      <div className="flex flex-col">
        {keyProperties.map((prop) => (
          <div key={prop.name} className="flex items-center justify-between px-2 py-1.5 border-b border-slate-200 bg-amber-50/30 relative">
             <div className="flex items-center gap-1 overflow-hidden mr-1">
                <span className="text-[9px] font-bold text-slate-800 shrink-0 border border-slate-800 px-0.5 rounded-[2px] leading-none h-3 flex items-center bg-white">PK</span>
                <span className="font-bold text-slate-900 truncate">{prop.name}</span>
             </div>
             <span className="text-[10px] text-slate-500 truncate max-w-[60px]">{prop.type.split('.').pop()}</span>
          </div>
        ))}

        {visibleProps.map((prop) => (
          <div key={prop.name} className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 last:border-0 relative">
            <span className="truncate text-slate-700 mr-2">{prop.name}</span>
            <span className="text-[10px] text-slate-400 truncate max-w-[60px]">
              {prop.type.split('.').pop()}
            </span>
          </div>
        ))}

        {hiddenCount > 0 && (
           <div className="px-2 py-1 text-center bg-slate-50 border-b border-slate-100">
             <span className="text-[9px] text-slate-400 italic">... {hiddenCount} more</span>
           </div>
        )}

        {/* Navigation Properties (Sources) */}
        {entity.navigationProperties.length > 0 && (
          <div className="border-t border-slate-800 mt-[-1px]">
            {entity.navigationProperties.map((nav) => {
              // 使用统一的安全 ID 生成逻辑
              const handleId = getHandleId(nav.name);
              
              return (
                <div 
                  key={nav.name} 
                  className="relative flex items-center justify-between px-2 py-1.5 border-b border-slate-200 last:border-0 bg-slate-50/50 group hover:bg-indigo-50 transition-colors"
                >
                  <span className="truncate font-medium text-slate-800 mr-2" title={nav.name}>
                    {nav.name}
                  </span>
                  
                  {/* Source Handle: 绑定到具体行，位于右侧 */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={handleId}
                    style={{...handleStyle, right: -2, top: '50%'}}
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