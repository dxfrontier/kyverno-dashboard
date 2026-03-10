import React from 'react';
import { useT } from '../hooks/useT';
import { KyvernoPolicy, PolicyReport } from '../services/api';
import KyvernoPolicyRow from './KyvernoPolicyRow';

interface KyvernoPolicyTableProps {
  darkMode: boolean;
  policies: KyvernoPolicy[];
  reports: PolicyReport[];
  onPolicyClick: (policy: KyvernoPolicy) => void;
}

const KyvernoPolicyTable: React.FC<KyvernoPolicyTableProps> = ({ darkMode, policies, reports, onPolicyClick }) => {
  const { t } = useT();

  // Flatten all report results for matching
  const allResults = reports.flatMap((r) => r.results || []);

  return (
    <table className="w-full text-left text-xs">
      <thead className={darkMode ? 'bg-[#111] text-gray-500' : 'bg-gray-50 text-slate-400'}>
        <tr>
          <th className="px-4 py-2 font-bold uppercase tracking-widest text-[10px]">{t('admin.kyverno_policy_name')}</th>
          <th className="px-4 py-2 font-bold uppercase tracking-widest text-[10px]">{t('admin.kyverno_type')}</th>
          <th className="px-4 py-2 font-bold uppercase tracking-widest text-[10px]">{t('admin.kyverno_severity')}</th>
          <th className="px-4 py-2 font-bold uppercase tracking-widest text-[10px]">{t('admin.kyverno_status')}</th>
          <th className="px-4 py-2 font-bold uppercase tracking-widest text-[10px]">{t('admin.kyverno_labels')}</th>
        </tr>
      </thead>
      <tbody>
        {policies.map((policy) => {
          const matchingResults = allResults.filter((r) => r.policy === policy.metadata.name);
          return (
            <KyvernoPolicyRow
              key={policy.metadata.name}
              darkMode={darkMode}
              policy={policy}
              reportResults={matchingResults}
              onNameClick={onPolicyClick}
            />
          );
        })}
      </tbody>
    </table>
  );
};

export default KyvernoPolicyTable;
