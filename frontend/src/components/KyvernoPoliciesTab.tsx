import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../hooks/useT';
import { ChainCategory, KyvernoPolicy, listAllPolicyReports, listKyvernoPolicies, PolicyReport } from '../services/api';
import KyvernoChainGroup from './KyvernoChainGroup';
import KyvernoSummaryBar from './KyvernoSummaryBar';
import KyvernoYamlDrawer from './KyvernoYamlDrawer';

interface KyvernoPoliciesTabProps {
  darkMode: boolean;
}

const CHAIN_LABEL = 'model.dxfrontier.com/chain';

function getChainCategory(policy: KyvernoPolicy): ChainCategory {
  const chain = policy.metadata.labels?.[CHAIN_LABEL];
  if (
    chain &&
    ['chain-validation', 'domain-to-provisioning', 'status-backflow', 'ui-companion', 'domain-ref-sync'].includes(chain)
  ) {
    return chain as ChainCategory;
  }
  return 'unknown';
}

const KyvernoPoliciesTab: React.FC<KyvernoPoliciesTabProps> = ({ darkMode }) => {
  const { t } = useT();
  const [policies, setPolicies] = useState<KyvernoPolicy[]>([]);
  const [reports, setReports] = useState<PolicyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerPolicy, setDrawerPolicy] = useState<KyvernoPolicy | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [policyData, reportData] = await Promise.all([listKyvernoPolicies(), listAllPolicyReports()]);

      const allPolicies = [
        ...policyData.validating.items,
        ...policyData.generating.items,
        ...policyData.mutating.items,
        ...policyData.cluster.items,
      ];
      const allReports = [...reportData.namespaced.items, ...reportData.cluster.items];

      setPolicies(allPolicies);
      setReports(allReports);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.kyverno_error_loading'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const groupedPolicies = useMemo(() => {
    const groups = new Map<ChainCategory, KyvernoPolicy[]>();
    for (const policy of policies) {
      const chain = getChainCategory(policy);
      if (!groups.has(chain)) groups.set(chain, []);
      groups.get(chain)!.push(policy);
    }
    return groups;
  }, [policies]);

  const summary = useMemo(() => {
    const s = { error: 0, fail: 0, warn: 0, skip: 0, pass: 0 };
    for (const report of reports) {
      s.error += report.summary.error;
      s.fail += report.summary.fail;
      s.warn += report.summary.warn;
      s.skip += report.summary.skip;
      s.pass += report.summary.pass;
    }
    return s;
  }, [reports]);

  const totalChecks = summary.error + summary.fail + summary.warn + summary.skip + summary.pass;

  // Count unique resources across all reports.
  // wgpolicyk8s.io/v1alpha2 reports carry the resource in report.scope, not per-result.
  const resourceCount = useMemo(() => {
    const seen = new Set<string>();
    for (const report of reports) {
      if (report.scope) {
        seen.add(`${report.scope.kind}/${report.scope.namespace || ''}/${report.scope.name}`);
      } else {
        for (const result of report.results || []) {
          for (const resource of result.resources || []) {
            seen.add(`${resource.kind}/${resource.namespace || ''}/${resource.name}`);
          }
        }
      }
    }
    return seen.size;
  }, [reports]);

  const handlePolicyClick = useCallback((policy: KyvernoPolicy) => {
    setDrawerPolicy(policy);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div
            className={`animate-spin rounded-full h-6 w-6 border-2 border-t-transparent ${
              darkMode ? 'border-gray-400' : 'border-gray-500'
            }`}
          />
          <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>{t('admin.kyverno_loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 md:px-10 py-6">
        <div className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{error}</div>
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div className="px-6 md:px-10 py-6">
        <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>{t('admin.kyverno_no_policies')}</p>
      </div>
    );
  }

  // Ordered chain names
  const chainOrder: ChainCategory[] = [
    'chain-validation',
    'domain-to-provisioning',
    'status-backflow',
    'ui-companion',
    'domain-ref-sync',
    'unknown',
  ];

  return (
    <div className="flex-1 overflow-auto px-6 md:px-10 py-6">
      <div className="space-y-4">
        <KyvernoSummaryBar
          darkMode={darkMode}
          summary={summary}
          resourceCount={resourceCount}
          totalChecks={totalChecks}
        />

        {chainOrder
          .filter((chain) => groupedPolicies.has(chain))
          .map((chain) => (
            <KyvernoChainGroup
              key={chain}
              darkMode={darkMode}
              chainName={chain}
              policies={groupedPolicies.get(chain)!}
              reports={reports}
              onPolicyClick={handlePolicyClick}
            />
          ))}
      </div>

      <KyvernoYamlDrawer darkMode={darkMode} policy={drawerPolicy} onClose={() => setDrawerPolicy(null)} />
    </div>
  );
};

export default KyvernoPoliciesTab;
