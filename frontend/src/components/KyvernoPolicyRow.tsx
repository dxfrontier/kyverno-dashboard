import React, { useState } from 'react';
import { KyvernoPolicy, PolicyReportResult } from '../services/api';
import KyvernoReportDetails from './KyvernoReportDetails';

interface KyvernoPolicyRowProps {
  darkMode: boolean;
  policy: KyvernoPolicy;
  reportResults: PolicyReportResult[];
  onNameClick: (policy: KyvernoPolicy) => void;
}

const severityColor: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-blue-400/20 text-blue-300',
  info: 'bg-gray-400/20 text-gray-400',
};

const KyvernoPolicyRow: React.FC<KyvernoPolicyRowProps> = ({ darkMode, policy, reportResults, onNameClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const passCount = reportResults.filter((r) => r.result === 'pass').length;
  const failCount = reportResults.filter((r) => r.result !== 'pass').length;

  // Extract severity from the first report result or policy annotations
  const severity =
    reportResults[0]?.severity || (policy.metadata.annotations?.['policies.kyverno.io/severity'] as string) || 'info';
  const sevClass = severityColor[severity] || severityColor.info;

  return (
    <>
      <tr
        className={`transition-colors ${
          darkMode ? 'hover:bg-[#111] text-gray-300' : 'hover:bg-gray-50 text-slate-700'
        }`}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`text-[10px] transition-transform ${isExpanded ? 'rotate-90' : ''} ${
                darkMode ? 'text-gray-500' : 'text-slate-400'
              }`}
            >
              ▶
            </button>
            <button
              onClick={() => onNameClick(policy)}
              className="text-[#42C1A6] hover:underline font-semibold text-left"
            >
              {policy.metadata.name}
            </button>
          </div>
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full ${
              darkMode ? 'bg-[#1a1a1a] text-gray-400' : 'bg-gray-100 text-slate-500'
            }`}
          >
            {policy.kind}
          </span>
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full ${sevClass}`}
          >
            {severity}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {passCount > 0 && <span className="text-green-500 font-bold text-xs">✓{passCount}</span>}
            {failCount > 0 && <span className="text-red-400 font-bold text-xs">✗{failCount}</span>}
            {passCount === 0 && failCount === 0 && (
              <span className={`text-xs ${darkMode ? 'text-gray-600' : 'text-slate-300'}`}>-</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {Object.entries(policy.metadata.labels ?? {}).map(([key, value]) => (
              <span
                key={key}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono
                ${
                  key.includes('dxfrontier.com')
                    ? 'bg-[#42C1A6]/10 text-[#42C1A6]'
                    : darkMode
                      ? 'bg-[#1a1a1a] text-gray-400'
                      : 'bg-gray-100 text-slate-500'
                }`}
              >
                {key}=<span className={darkMode ? 'text-gray-300' : 'text-slate-700'}>{value}</span>
              </span>
            ))}
            {(!policy.metadata.labels || Object.keys(policy.metadata.labels).length === 0) && (
              <span className={`text-[10px] ${darkMode ? 'text-gray-600' : 'text-slate-300'}`}>—</span>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={5} className={`p-0 ${darkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50/50'}`}>
            <KyvernoReportDetails darkMode={darkMode} results={reportResults} />
          </td>
        </tr>
      )}
    </>
  );
};

export default KyvernoPolicyRow;
