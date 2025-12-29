import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Key, Box, ArrowRightLeft, Table2 } from 'lucide-react';
import { ODataEntity } from '../types';

interface EntityNodeData {
  entity: ODataEntity;
}

const EntityNode = ({ data }: { data: EntityNodeData }) => {
  const { entity } = data;

  const keyProperties = entity.properties.filter(p => entity.keys.includes(p.name));
  const otherProperties = entity.properties.filter(p => !entity.keys.includes(p.name));

  return (
    // 关键修复：移除 overflow-hidden，防止 Handle 被裁剪
    // 增加 group 类以便控制 Handle 的显示（可选）
    <div className="relative group min-w-[220px] max-w-[300px] font-sans text-xs">
      
      {/* 
        为了达到最佳连线效果，我们在左侧和右侧都放置 Source 和 Target Handle。
        React Flow 会自动选择距离最近的 Handle 进行连接。
        样式上我们把它们设为透明，但保留物理尺寸以便捕捉鼠标交互。
      */}
      
      {/* 左侧锚点：既可以是起点也可以是终点 */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="left-target"
        className="!w-2 !h-6 !bg-blue-500 !border-2 !border-white !rounded-full !-left-1.5 top-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-50" 
      />
      <Handle 
        type="source" 
        position={Position.Left} 
        id="left-source"
        className="!w-2 !h-6 !bg-blue-500 !border-2 !border-white !rounded-full !-left-1.5 top-2/3 opacity-0 group-hover:opacity-100 transition-opacity z-50" 
      />

      {/* 右侧锚点：既可以是起点也可以是终点 */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="right-source"
        className="!w-2 !h-6 !bg-blue-500 !border-2 !border-white !rounded-full !-right-1.5 top-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-50" 
      />
      <Handle 
        type="target" 
        position={Position.Right} 
        id="right-target"
        className="!w-2 !h-6 !bg-blue-500 !border-2 !border-white !rounded-full !-right-1.5 top-2/3 opacity-0 group-hover:opacity-100 transition-opacity z-50" 
      />

      {/* 实体卡片容器：阴影和圆角在这里处理 */}
      <div className="bg-white rounded-lg shadow-xl border-2 border-slate-200 overflow-hidden hover:border-blue-400 transition-colors duration-300">
        
        {/* 1. 标题栏 (Header) - 模仿参考图的渐变/深色头 */}
        <div className="bg-slate-700 p-2.5 flex justify-between items-center text-white border-b border-slate-600">
            <div className="flex items-center gap-2 overflow-hidden">
                <Table2 className="w-4 h-4 text-blue-300 flex-shrink-0" />
                <span className="font-bold text-sm truncate" title={entity.name}>
                {entity.name}
                </span>
            </div>
            {/* 可选：显示属性数量 */}
            <span className="text-[10px] bg-slate-600 px-1.5 py-0.5 rounded text-slate-300">
                {entity.properties.length}
            </span>
        </div>

        {/* 2. 主键区 (Keys) - 橙黄色背景 */}
        {keyProperties.length > 0 && (
            <div className="bg-amber-50 border-b border-amber-100">
            {keyProperties.map((prop) => (
                <div key={prop.name} className="flex items-center justify-between px-3 py-1.5">
                    <div className="flex items-center gap-2 overflow-hidden text-amber-900">
                        <Key className="w-3 h-3 flex-shrink-0 text-amber-600" />
                        <span className="font-bold truncate">{prop.name}</span>
                    </div>
                    <span className="text-[10px] text-amber-600/70 font-mono ml-2">PK</span>
                </div>
            ))}
            </div>
        )}

        {/* 3. 普通属性区 (Properties) */}
        <div className="bg-white text-slate-700">
            {otherProperties.slice(0, 6).map((prop) => (
            <div key={prop.name} className="flex items-center justify-between px-3 py-1 border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <span className="truncate mr-2" title={prop.name}>{prop.name}</span>
                <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">{prop.type.split('.').pop()}</span>
            </div>
            ))}
            {otherProperties.length > 6 && (
            <div className="px-3 py-1 text-center text-[10px] text-slate-400 bg-slate-50/50">
                + {otherProperties.length - 6} more columns
            </div>
            )}
        </div>

        {/* 4. 导航属性区 (Navigation) - 蓝色高亮，模仿参考图 */}
        {entity.navigationProperties.length > 0 && (
            <div className="bg-sky-600 text-white border-t border-slate-200">
            <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider bg-sky-700/50 text-sky-100 flex items-center gap-1">
                Navigation
            </div>
            {entity.navigationProperties.map((nav) => {
                const isCollection = nav.type.includes('Collection(');
                const displayType = nav.type.split('.').pop()?.replace(')', '') || nav.type;
                
                return (
                <div key={nav.name} className="flex items-center justify-between px-3 py-1.5 border-b border-sky-500/30 last:border-0 hover:bg-sky-500 transition-colors">
                    <div className="flex items-center gap-2 truncate">
                    <ArrowRightLeft className="w-3 h-3 flex-shrink-0 text-sky-200" />
                    <span className="truncate font-medium text-xs" title={nav.name}>{nav.name}</span>
                    </div>
                    <div className="flex items-center">
                        {isCollection && <span className="text-[9px] bg-sky-800/80 px-1 rounded text-white font-mono mr-1">1:N</span>}
                        {/* <span className="text-[9px] opacity-70">{displayType}</span> */}
                    </div>
                </div>
                );
            })}
            </div>
        )}
      </div>
    </div>
  );
};

export default memo(EntityNode);
