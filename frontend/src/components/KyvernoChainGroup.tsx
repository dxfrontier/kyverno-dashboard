import React, { useState } from 'react';
import { KyvernoPolicy, PolicyReport } from '../services/api';
import KyvernoPolicyTable from './KyvernoPolicyTable';
import KyvernoDependencyGraph from './KyvernoDependencyGraph';

interface KyvernoChainGroupProps {
  darkMode: boolean;
  chainName: string;
  policies: KyvernoPolicy[];
  reports: PolicyReport[];
  onPolicyClick: (policy: KyvernoPolicy) => void;
}

const KyvernoChainGroup: React.FC<KyvernoChainGroupProps> = ({
  darkMode,
  chainName,
  policies,
  reports,
  onPolicyClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        darkMode ? 'border-[#1f1f1f] bg-[#0b0b0b]' : 'border-gray-100 bg-white'
      }`}
    >
      <div
        className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${
          darkMode ? 'hover:bg-[#111]' : 'hover:bg-gray-50'
        }`}
      >
        <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-3 flex-1 text-left">
          <span className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
          <span className="text-sm font-black tracking-tight">{chainName}</span>
          <span
            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full ${
              darkMode ? 'bg-[#1a1a1a] text-gray-400' : 'bg-gray-100 text-slate-500'
            }`}
          >
            {policies.length}
          </span>
        </button>
        {isExpanded && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                viewMode === 'table'
                  ? darkMode
                    ? 'bg-[#333] text-white'
                    : 'bg-gray-200 text-slate-700'
                  : darkMode
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                viewMode === 'graph'
                  ? darkMode
                    ? 'bg-[#333] text-white'
                    : 'bg-gray-200 text-slate-700'
                  : darkMode
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Graph
            </button>
          </div>
        )}
      </div>
      {isExpanded && (
        <div className={`border-t ${darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'}`}>
          {viewMode === 'table' ? (
            <KyvernoPolicyTable
              darkMode={darkMode}
              policies={policies}
              reports={reports}
              onPolicyClick={onPolicyClick}
            />
          ) : (
            <KyvernoDependencyGraph darkMode={darkMode} policies={policies} onPolicyClick={onPolicyClick} />
          )}
        </div>
      )}
    </div>
  );
};

export default KyvernoChainGroup;
