import React from 'react';
import { useT } from '../hooks/useT';

interface KyvernoSummaryBarProps {
  darkMode: boolean;
  summary: { error: number; fail: number; warn: number; skip: number; pass: number };
  resourceCount: number;
  totalChecks: number;
}

const KyvernoSummaryBar: React.FC<KyvernoSummaryBarProps> = ({ darkMode, summary, resourceCount, totalChecks }) => {
  const { t } = useT();

  const metrics: Array<{ key: string; label: string; value: number; color: string; icon: string }> = [
    { key: 'error', label: t('admin.kyverno_error'), value: summary.error, color: 'text-red-500', icon: '●' },
    { key: 'fail', label: t('admin.kyverno_fail'), value: summary.fail, color: 'text-red-400', icon: '●' },
    { key: 'warn', label: t('admin.kyverno_warn'), value: summary.warn, color: 'text-yellow-500', icon: '▲' },
    { key: 'skip', label: t('admin.kyverno_skip'), value: summary.skip, color: 'text-blue-400', icon: '▶' },
    { key: 'pass', label: t('admin.kyverno_pass'), value: summary.pass, color: 'text-green-500', icon: '✓' },
  ];

  return (
    <div
      className={`rounded-xl border p-4 ${darkMode ? 'border-[#1f1f1f] bg-[#0b0b0b]' : 'border-gray-100 bg-gray-50'}`}
    >
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p
            className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}
          >
            {t('admin.kyverno_resources_checked')}
          </p>
          <p className="text-lg font-black">{resourceCount}</p>
        </div>
        <div>
          <p
            className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}
          >
            {t('admin.kyverno_total_checks')}
          </p>
          <p className="text-lg font-black">{totalChecks}</p>
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-4">
          {metrics.map((m) => (
            <div key={m.key} className="flex items-center gap-1.5">
              <span className={`text-sm ${m.color}`}>{m.icon}</span>
              <span
                className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}
              >
                {m.label}:
              </span>
              <span className={`text-sm font-black ${m.color}`}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KyvernoSummaryBar;
