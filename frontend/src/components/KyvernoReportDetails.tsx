import React from 'react';
import { useT } from '../hooks/useT';
import { PolicyReportResult } from '../services/api';

interface KyvernoReportDetailsProps {
  darkMode: boolean;
  results: PolicyReportResult[];
}

const resultIcon: Record<string, { icon: string; color: string }> = {
  pass: { icon: '✓', color: 'text-green-500' },
  fail: { icon: '✗', color: 'text-red-400' },
  warn: { icon: '▲', color: 'text-yellow-500' },
  error: { icon: '●', color: 'text-red-500' },
  skip: { icon: '▶', color: 'text-blue-400' },
};

const KyvernoReportDetails: React.FC<KyvernoReportDetailsProps> = ({ darkMode, results }) => {
  const { t } = useT();

  if (results.length === 0) {
    return (
      <div className={`px-4 py-3 text-xs ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>
        {t('admin.kyverno_no_reports')}
      </div>
    );
  }

  return (
    <div className={`border-t ${darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'}`}>
      <table className="w-full text-left text-xs">
        <thead className={darkMode ? 'bg-[#111] text-gray-500' : 'bg-gray-50 text-slate-400'}>
          <tr>
            <th className="px-4 py-2 font-bold uppercase tracking-widest text-[10px]">{t('admin.kyverno_resource')}</th>
            <th className="px-4 py-2 font-bold uppercase tracking-widest text-[10px]">{t('admin.kyverno_result')}</th>
            <th className="px-4 py-2 font-bold uppercase tracking-widest text-[10px]">{t('admin.kyverno_message')}</th>
            <th className="px-4 py-2 font-bold uppercase tracking-widest text-[10px]">{t('admin.kyverno_timestamp')}</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result, idx) => {
            const ri = resultIcon[result.result] || { icon: '?', color: 'text-gray-400' };
            const resourceLabel = result.resources?.map((r) => `${r.kind}/${r.name}`).join(', ') || '-';
            const ts = result.timestamp?.seconds
              ? new Date(result.timestamp.seconds * 1000).toLocaleString()
              : '-';

            return (
              <tr
                key={idx}
                className={darkMode ? 'border-t border-[#1a1a1a] text-gray-300' : 'border-t border-gray-50 text-slate-700'}
              >
                <td className="px-4 py-2 font-mono text-[11px]">{resourceLabel}</td>
                <td className="px-4 py-2">
                  <span className={`font-bold ${ri.color}`}>
                    {ri.icon} {result.result}
                  </span>
                </td>
                <td className="px-4 py-2 max-w-xs truncate" title={result.message}>
                  {result.message}
                </td>
                <td className="px-4 py-2">{ts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default KyvernoReportDetails;
