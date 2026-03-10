import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { CrdLayer } from '../services/kyvernoPolicyGraph';

const LAYER_COLORS: Record<string, string> = {
  ui: '#22c55e',
  domain: '#3b82f6',
  provisioning: '#f97316',
  managed: '#6b7280',
};

interface KyvernoCrdNodeData {
  kind: string;
  apiGroup: string;
  layer: CrdLayer;
  darkMode?: boolean;
  onHover?: (id: string | null) => void;
  id?: string;
}

const KyvernoCrdNode: React.FC<{ data: KyvernoCrdNodeData }> = ({ data }) => {
  const { kind, apiGroup, layer, darkMode = false, onHover, id } = data;

  const layerColor = LAYER_COLORS[layer] ?? LAYER_COLORS.managed;

  return (
    <div
      className={`w-[160px] h-[56px] rounded-lg border px-3 py-2 flex flex-col justify-center relative transition-all duration-200 ${
        darkMode
          ? 'bg-[#0f0f0f] border-[#1a1a1a] text-gray-200 hover:border-gray-600'
          : 'bg-white border-gray-200 text-slate-800 hover:border-gray-400'
      }`}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: layerColor,
      }}
      onMouseEnter={() => onHover?.(id || '')}
      onMouseLeave={() => onHover?.(null)}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-gray-400" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-400" />

      <div className="flex flex-col min-w-0">
        <span className="text-xs font-bold truncate capitalize">{kind}</span>
        <span className={`text-[10px] truncate ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>{apiGroup}</span>
      </div>
    </div>
  );
};

export default memo(KyvernoCrdNode);
