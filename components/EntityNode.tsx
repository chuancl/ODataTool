import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ODataEntity } from '../types';

interface EntityNodeProps {
  data: {
    entity: ODataEntity;
  };
}

// 辅助函数：生成安全的 Handle ID
export const getHandleId = (prefix: string, name: string) => `${prefix}-${name.replace(/[^a-zA-Z0-9]/g, '_')}`;

const EntityNode = memo(({ data }: EntityNodeProps) => {
  const { entity } = data;
  if (!entity) return null;

  const keyProperties = entity.properties.filter(p => entity.keys.includes(p.name));
  const otherProperties = entity.properties.filter(p => !entity.keys.includes(p.name));
  
  const MAX_VISIBLE_PROPS = 8;
  const visibleProps = otherProperties.slice(0, MAX_VISIBLE_PROPS);
  const hiddenCount = otherProperties.length - MAX_VISIBLE_PROPS;

  // Handle 样式：虽然透明，但要有尺寸以便鼠标能感知，位置要精确
  const handleStyle = { width: 4, height: 4, background: '#94a3b8', border: 'none', opacity: 0.5 };

  return (
    <div className="w-[240px] bg-white border border-slate-300 shadow-md rounded-md overflow-hidden text-[11px] font-sans hover:shadow-xl transition-shadow duration-200 hover:border-indigo-400">
      
      {/* Header: 备用 Target (如果连线没法指到具体 Key) */}
      <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center justify-between relative">
        <Handle 
            type="target" 
            position={Position.Left} 
            id="target-header"
            style={{...handleStyle, left: -2, top: '50%'}}
        />
        <span className="font-bold text-slate-800 truncate text-xs" title={entity.name}>
          {entity.name}
        </span>
      </div>

      {/* Properties Container */}
      <div className="flex flex-col">
        
        {/* Primary Keys (Target Zone) - 琥珀色区块 */}
        {keyProperties.map((prop) => (
          <div 
            key={prop.name} 
            className="flex items-center justify-between px-3 py-1.5 border-b border-amber-100 bg-amber-50/60 relative group"
          >
             {/* Target Handle: 放在主键左侧，作为连线的终点 */}
             <Handle 
                type="target" 
                position={Position.Left} 
                id={getHandleId('target', prop.name)}
                style={{...handleStyle, left: -2, top: '50%', background: '#d97706'}} // amber-600
             />

             <div className="flex items-center gap-2 overflow-hidden mr-1">
                <span className="text-[9px] font-bold text-amber-700 shrink-0 border border-amber-200 px-1 rounded-[3px] bg-white shadow-sm">PK</span>
                <span className="font-bold text-slate-800 truncate" title="Primary Key">{prop.name}</span>
             </div>
             <span className="text-[10px] text-slate-400 truncate max-w-[60px]">{prop.type.split('.').pop()}</span>
          </div>
        ))}

        {/* Regular Properties */}
        {visibleProps.map((prop) => (
          <div key={prop.name} className="flex items-center justify-between px-3 py-1.5 border-b border-slate-50 last:border-0 relative bg-white">
            <span className="truncate text-slate-600 mr-2 pl-1">{prop.name}</span>
            <span className="text-[10px] text-slate-300 truncate max-w-[60px]">
              {prop.type.split('.').pop()}
            </span>
          </div>
        ))}

        {hiddenCount > 0 && (
           <div className="px-3 py-1 text-center bg-slate-50 border-b border-slate-100">
             <span className="text-[9px] text-slate-400 italic">... {hiddenCount} more</span>
           </div>
        )}

        {/* Navigation Properties (Source Zone) - 靛蓝色区块 */}
        {entity.navigationProperties.length > 0 && (
          <div className="border-t border-slate-200 mt-[-1px]">
            {entity.navigationProperties.map((nav) => {
              const handleId = getHandleId('source', nav.name);
              
              return (
                <div 
                  key={nav.name} 
                  className="relative flex items-center justify-between px-3 py-1.5 border-b border-indigo-100 last:border-0 bg-indigo-50/40 hover:bg-indigo-100/60 transition-colors"
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    <span className="text-[9px] font-bold text-indigo-400 shrink-0">FK</span>
                    <span className="truncate font-medium text-indigo-900 mr-2" title={nav.name}>
                        {nav.name}
                    </span>
                  </div>
                  
                  {/* Source Handle: 放在右侧，作为连线的起点 */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={handleId}
                    style={{...handleStyle, right: -2, top: '50%', background: '#4f46e5'}} // indigo-600
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