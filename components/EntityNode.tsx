import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ODataEntity } from '../types';

interface EntityNodeProps {
  data: {
    entity: ODataEntity;
  };
}

// 使用 memo 优化渲染性能
const EntityNode = memo(({ data }: EntityNodeProps) => {
  const { entity } = data;
  if (!entity) return null;

  const keyProperties = entity.properties.filter(p => entity.keys.includes(p.name));
  const otherProperties = entity.properties.filter(p => !entity.keys.includes(p.name));
  
  // 限制显示数量
  const MAX_VISIBLE_PROPS = 8;
  const visibleProps = otherProperties.slice(0, MAX_VISIBLE_PROPS);
  const hiddenCount = otherProperties.length - MAX_VISIBLE_PROPS;

  return (
    <div className="w-[240px] font-sans text-xs bg-white rounded-md shadow-lg border border-slate-400 overflow-hidden group hover:border-indigo-500 hover:shadow-xl transition-all duration-200">
      
      {/* 
         全局输入锚点 (Left)
         用于接收来自其他表的连接
      */}
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-2 !h-2 !bg-slate-400 group-hover:!bg-indigo-500 transition-colors"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      />

      {/* 标题栏 */}
      <div className="bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 px-3 py-2 flex items-center justify-between">
        <span className="font-bold text-slate-800 truncate text-[13px]" title={entity.name}>
          {entity.name}
        </span>
        {entity.navigationProperties.length > 0 && (
          <span className="text-[10px] bg-white px-1.5 py-0.5 rounded-full border border-slate-300 text-slate-500 font-mono">
            {entity.navigationProperties.length}
          </span>
        )}
      </div>

      {/* 内容区域 */}
      <div className="bg-white flex flex-col">
        
        {/* 主键 */}
        {keyProperties.map((prop) => (
          <div key={prop.name} className="flex items-center justify-between px-3 py-1.5 bg-amber-50/60 border-b border-amber-100/50">
            <div className="flex items-center gap-2 overflow-hidden mr-2">
                <span className="text-amber-500 font-bold text-[10px]">PK</span>
                <span className="font-bold text-slate-800 truncate" title={prop.name}>{prop.name}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono shrink-0">{prop.type.split('.').pop()}</span>
          </div>
        ))}

        {/* 普通属性 */}
        {visibleProps.map((prop, index) => (
          <div 
            key={prop.name} 
            className={`flex items-center justify-between px-3 py-1.5 border-b border-slate-50 ${index % 2 === 1 ? 'bg-slate-50/50' : ''}`}
          >
            <span className="truncate text-slate-700 mr-2" title={prop.name}>{prop.name}</span>
            <span className="text-[10px] text-slate-400 font-mono shrink-0 max-w-[80px] truncate" title={prop.type}>
              {prop.type.split('.').pop()}
            </span>
          </div>
        ))}

        {hiddenCount > 0 && (
           <div className="px-3 py-1 text-center bg-slate-50 border-b border-slate-100">
             <span className="text-[10px] text-slate-400 italic">... {hiddenCount} more</span>
           </div>
        )}

        {/* 导航属性 (外键) */}
        {entity.navigationProperties.length > 0 && (
          <div className="border-t border-slate-200">
            <div className="bg-slate-50 px-3 py-1 border-b border-slate-200">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Relations</span>
            </div>
            {entity.navigationProperties.map((nav) => {
              const isCollection = nav.type.includes('Collection(');
              // Handle ID 必须唯一且确定: source-{navName}
              const handleId = `source-${nav.name}`;
              
              return (
                <div 
                  key={nav.name} 
                  className="relative flex items-center justify-between px-3 py-1.5 hover:bg-indigo-50 group/nav transition-colors"
                >
                  <span className="truncate font-medium text-indigo-700 mr-2 text-[11px]" title={nav.name}>
                    {nav.name}
                  </span>
                  <span className={`text-[9px] px-1 rounded border font-mono ${
                      isCollection 
                      ? 'bg-blue-50 text-blue-600 border-blue-100' 
                      : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  }`}>
                      {isCollection ? '1:N' : '1:1'}
                  </span>

                  {/* 
                     每一行专属的输出锚点 (Right)
                     ID = source-{属性名}
                     这样连线就知道是从哪一行发出的
                  */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={handleId}
                    className="!w-2 !h-2 !bg-slate-300 group-hover/nav:!bg-indigo-500 transition-colors"
                    style={{ right: '-5px' }} // 微调位置到边框上
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