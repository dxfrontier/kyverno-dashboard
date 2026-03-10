// ========================================
// Types
// ========================================

export interface KyvernoPolicyMetadata {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface KyvernoPolicy {
  apiVersion: string;
  kind: 'ValidatingPolicy' | 'GeneratingPolicy' | 'MutatingPolicy' | 'ClusterPolicy';
  metadata: KyvernoPolicyMetadata;
  spec: Record<string, unknown>;
}

export interface PolicyReportResource {
  apiVersion: string;
  kind: string;
  namespace: string;
  name: string;
  uid?: string;
}

export interface PolicyReportResult {
  policy: string;
  rule?: string;
  result: 'pass' | 'fail' | 'warn' | 'error' | 'skip';
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message?: string;
  resources?: PolicyReportResource[];
  timestamp?: { seconds: number; nanos?: number };
}

export interface PolicyReportSummary {
  pass: number;
  fail: number;
  warn: number;
  error: number;
  skip: number;
}

export interface PolicyReport {
  metadata: KyvernoPolicyMetadata;
  scope?: PolicyReportResource;
  summary: PolicyReportSummary;
  results?: PolicyReportResult[];
}

export type ChainCategory =
  | 'chain-validation'
  | 'domain-to-provisioning'
  | 'status-backflow'
  | 'ui-companion'
  | 'domain-ref-sync'
  | 'unknown';

export interface ListResponse<T> {
  items: T[];
  total: number;
}

export interface KyvernoPolicyListResponse {
  validating: ListResponse<KyvernoPolicy>;
  generating: ListResponse<KyvernoPolicy>;
  mutating: ListResponse<KyvernoPolicy>;
  cluster: ListResponse<KyvernoPolicy>;
}

export interface PolicyReportListResponse {
  namespaced: ListResponse<PolicyReport>;
  cluster: ListResponse<PolicyReport>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ========================================
// API Client
// ========================================

const API_BASE = '/api';
const USE_MOCK = false; // Set to true for development without backend

async function fetchJson<T>(url: string): Promise<T> {
  if (USE_MOCK) {
    return getMockData(url) as T;
  }

  const response = await fetch(`${API_BASE}${url}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = (await response.json()) as ApiResponse<T>;
  if (!data.success) {
    throw new Error(data.error || 'API error');
  }
  return data.data as T;
}

// ========================================
// Mock Data
// ========================================

function getMockData(url: string): unknown {
  if (url === '/policies') {
    return {
      validating: {
        items: [
          {
            apiVersion: 'policies.kyverno.io/v1alpha1',
            kind: 'ValidatingPolicy',
            metadata: {
              name: 'check-labels',
              labels: { 'model.dxfrontier.com/chain': 'chain-validation' },
              annotations: { 'policies.kyverno.io/severity': 'medium' },
            },
            spec: {
              matchConstraints: {
                resourceRules: [{ apiGroups: ['domain.dxfrontier.com'], resources: ['runtimestack'] }],
              },
            },
          },
          {
            apiVersion: 'policies.kyverno.io/v1alpha1',
            kind: 'ValidatingPolicy',
            metadata: {
              name: 'require-namespace',
              labels: { 'model.dxfrontier.com/chain': 'chain-validation' },
              annotations: { 'policies.kyverno.io/severity': 'high' },
            },
            spec: {},
          },
        ],
        total: 2,
      },
      generating: {
        items: [
          {
            apiVersion: 'policies.kyverno.io/v1alpha1',
            kind: 'GeneratingPolicy',
            metadata: {
              name: 'runtimestack-to-xsubaccount',
              labels: { 'model.dxfrontier.com/chain': 'domain-to-provisioning' },
              annotations: { 'policies.kyverno.io/severity': 'critical' },
            },
            spec: {
              matchConstraints: {
                resourceRules: [{ apiGroups: ['domain.dxfrontier.com'], resources: ['runtimestack'] }],
              },
              variables: [
                { name: 'target', expression: '{"kind": dyn("XSubaccount"), "apiVersion": dyn("btp.dxstarter.io/v1alpha1")}' },
              ],
            },
          },
          {
            apiVersion: 'policies.kyverno.io/v1alpha1',
            kind: 'GeneratingPolicy',
            metadata: {
              name: 'solution-to-profile',
              labels: { 'model.dxfrontier.com/chain': 'ui-companion' },
              annotations: { 'policies.kyverno.io/severity': 'medium' },
            },
            spec: {
              matchConstraints: {
                resourceRules: [{ apiGroups: ['ui.dxfrontier.com'], resources: ['solution'] }],
              },
            },
          },
        ],
        total: 2,
      },
      mutating: {
        items: [
          {
            apiVersion: 'policies.kyverno.io/v1alpha1',
            kind: 'MutatingPolicy',
            metadata: {
              name: 'mutate-user-label',
              labels: { 'model.dxfrontier.com/chain': 'ui-companion' },
              annotations: { 'policies.kyverno.io/severity': 'low' },
            },
            spec: {
              matchConstraints: {
                resourceRules: [{ apiGroups: ['ui.dxfrontier.com'], resources: ['solutionprofile'] }],
              },
              targetMatchConstraints: {
                resourceRules: [{ apiGroups: ['ui.dxfrontier.com'], resources: ['solutionprofile'] }],
              },
            },
          },
        ],
        total: 1,
      },
      cluster: {
        items: [
          {
            apiVersion: 'kyverno.io/v1',
            kind: 'ClusterPolicy',
            metadata: {
              name: 'require-labels',
              labels: {},
              annotations: { 'policies.kyverno.io/severity': 'high' },
            },
            spec: {},
          },
        ],
        total: 1,
      },
    };
  }

  if (url === '/reports') {
    return {
      namespaced: {
        items: [
          {
            metadata: { name: 'polr-ns-default' },
            summary: { pass: 12, fail: 2, warn: 1, skip: 0, error: 0 },
            results: [
              { policy: 'check-labels', result: 'pass', severity: 'medium', message: 'All labels present' },
              { policy: 'require-namespace', result: 'fail', severity: 'high', message: 'Missing required namespace label' },
            ],
          },
        ],
        total: 1,
      },
      cluster: {
        items: [
          {
            metadata: { name: 'ccpolr' },
            summary: { pass: 45, fail: 3, warn: 2, skip: 1, error: 0 },
            results: [
              { policy: 'require-labels', result: 'pass', severity: 'high', message: 'Labels validated' },
            ],
          },
        ],
        total: 1,
      },
    };
  }

  return {};
}

// ========================================
// API Functions
// ========================================

export async function listKyvernoPolicies(): Promise<KyvernoPolicyListResponse> {
  return fetchJson<KyvernoPolicyListResponse>('/policies');
}

export async function listAllPolicyReports(): Promise<PolicyReportListResponse> {
  return fetchJson<PolicyReportListResponse>('/reports');
}
