import dagre from '@dagrejs/dagre';
import { KyvernoPolicy } from './api';

// ========================================
// Types
// ========================================

export type CrdLayer = 'domain' | 'ui' | 'provisioning' | 'managed';

export interface CrdReference {
  kind: string;
  apiGroup: string;
  isSource: boolean;
}

export interface GraphNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    kind: string;
    apiGroup: string;
    layer: CrdLayer;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  style: Record<string, any>;
  animated: boolean;
  data?: {
    policy: KyvernoPolicy;
  };
}

// ========================================
// Layer classification
// ========================================

export function classifyLayer(apiGroup: string): CrdLayer {
  if (apiGroup === 'domain.dxfrontier.com') return 'domain';
  if (apiGroup === 'ui.dxfrontier.com') return 'ui';
  if (apiGroup.endsWith('.dxstarter.io')) return 'provisioning';
  return 'managed';
}

// ========================================
// CRD extraction
// ========================================

interface ResourceRule {
  apiGroups?: string[];
  resources?: string[];
}

export function extractSourceCrds(policy: KyvernoPolicy): CrdReference[] {
  const spec = policy.spec as Record<string, any>;
  const crds: CrdReference[] = [];

  // CEL-based format (policies.kyverno.io/v1alpha1): spec.matchConstraints.resourceRules
  const matchConstraints = spec?.matchConstraints as Record<string, any> | undefined;
  const celRules = matchConstraints?.resourceRules as ResourceRule[] | undefined;
  if (celRules && Array.isArray(celRules)) {
    for (const rule of celRules) {
      const apiGroups = rule.apiGroups || [''];
      const resources = rule.resources || [];
      for (const apiGroup of apiGroups) {
        for (const resource of resources) {
          crds.push({ kind: resource, apiGroup: apiGroup || 'core', isSource: true });
        }
      }
    }
    return crds;
  }

  // Classic Kyverno v1 format (kyverno.io/v1 ClusterPolicy): spec.rules[].match.resources.kinds
  const v1Rules = spec?.rules as Array<Record<string, any>> | undefined;
  if (v1Rules && Array.isArray(v1Rules)) {
    const kindSet = new Set<string>();
    for (const rule of v1Rules) {
      const kinds = rule?.match?.resources?.kinds as string[] | undefined;
      if (kinds && Array.isArray(kinds)) {
        for (const kindEntry of kinds) {
          // kinds can be "Pod", "apps/Deployment", or "*/Deployment"
          const slash = kindEntry.indexOf('/');
          if (slash !== -1) {
            const apiGroup = kindEntry.slice(0, slash) === '*' ? '*' : kindEntry.slice(0, slash);
            const kind = kindEntry.slice(slash + 1);
            const key = `${apiGroup}/${kind}`;
            if (!kindSet.has(key)) {
              kindSet.add(key);
              crds.push({ kind, apiGroup: apiGroup || 'core', isSource: true });
            }
          } else {
            const key = `core/${kindEntry}`;
            if (!kindSet.has(key)) {
              kindSet.add(key);
              crds.push({ kind: kindEntry, apiGroup: 'core', isSource: true });
            }
          }
        }
      }
    }
  }

  return crds;
}

export function extractTargetCrds(policy: KyvernoPolicy): CrdReference[] {
  const spec = policy.spec as Record<string, any>;

  // For ValidatingPolicy / ClusterPolicy: target is same as source (self-referential)
  if (policy.kind === 'ValidatingPolicy' || policy.kind === 'ClusterPolicy') {
    return extractSourceCrds(policy).map((crd) => ({ ...crd, isSource: false }));
  }

  // For MutatingPolicy: extract from targetMatchConstraints
  if (policy.kind === 'MutatingPolicy') {
    const targetMatchConstraints = spec?.targetMatchConstraints as Record<string, any> | undefined;
    const rules = targetMatchConstraints?.resourceRules as ResourceRule[] | undefined;

    if (!rules || !Array.isArray(rules)) return [];

    const crds: CrdReference[] = [];

    for (const rule of rules) {
      const apiGroups = rule.apiGroups || [''];
      const resources = rule.resources || [];

      for (const apiGroup of apiGroups) {
        for (const resource of resources) {
          crds.push({
            kind: resource,
            apiGroup: apiGroup || 'core',
            isSource: false,
          });
        }
      }
    }

    return crds;
  }

  // For GeneratingPolicy: extract from variables[].expression
  if (policy.kind === 'GeneratingPolicy') {
    const variables = spec?.variables as Array<{ name: string; expression: string }> | undefined;
    const crds: CrdReference[] = [];

    if (variables && Array.isArray(variables)) {
      for (const variable of variables) {
        const expression = variable?.expression || '';

        // Parse kind from expression: "kind": dyn("XSubaccount")
        const kindMatch = expression.match(/"kind":\s*dyn\("([^"]+)"\)/);
        // Parse apiVersion from expression: "apiVersion": dyn("btp.dxstarter.io/v1alpha1")
        const apiVersionMatch = expression.match(/"apiVersion":\s*dyn\("([^"]+)"\)/);

        if (kindMatch) {
          const kind = kindMatch[1];
          const apiVersion = apiVersionMatch ? apiVersionMatch[1] : '';
          const apiGroup = apiVersion.includes('/') ? apiVersion.split('/')[0] : 'core';

          crds.push({
            kind,
            apiGroup,
            isSource: false,
          });
        }
      }
    }

    return crds;
  }

  return [];
}

export function extractCrdReferences(policy: KyvernoPolicy): CrdReference[] {
  const sources = extractSourceCrds(policy);
  const targets = extractTargetCrds(policy);
  return [...sources, ...targets];
}

// ========================================
// Graph building
// ========================================

interface CrdNode {
  id: string;
  kind: string;
  apiGroup: string;
  layer: CrdLayer;
}

interface PolicyEdge {
  id: string;
  source: string;
  target: string;
  policy: KyvernoPolicy;
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 56;

function createCrdId(apiGroup: string, kind: string): string {
  return `${apiGroup}/${kind}`;
}

function getLayerRank(layer: CrdLayer): number {
  switch (layer) {
    case 'domain':
      return 0;
    case 'ui':
      return 1;
    case 'provisioning':
      return 2;
    case 'managed':
    default:
      return 3;
  }
}

export function buildDependencyGraph(policies: KyvernoPolicy[]): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  if (!policies || policies.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Deduplicate CRDs
  const crdMap = new Map<string, CrdNode>();

  // Build policy edges
  const policyEdges: PolicyEdge[] = [];

  for (const policy of policies) {
    const sourceCrds = extractSourceCrds(policy);
    const targetCrds = extractTargetCrds(policy);

    // Add all CRDs to the map
    for (const crd of [...sourceCrds, ...targetCrds]) {
      const id = createCrdId(crd.apiGroup, crd.kind);
      if (!crdMap.has(id)) {
        crdMap.set(id, {
          id,
          kind: crd.kind,
          apiGroup: crd.apiGroup,
          layer: classifyLayer(crd.apiGroup),
        });
      }
    }

    // Create edges from source CRDs to target CRDs (skip self-loops)
    for (const source of sourceCrds) {
      for (const target of targetCrds) {
        const sourceId = createCrdId(source.apiGroup, source.kind);
        const targetId = createCrdId(target.apiGroup, target.kind);

        if (sourceId === targetId) continue;

        policyEdges.push({
          id: `${sourceId}--${policy.metadata.name}-->${targetId}`,
          source: sourceId,
          target: targetId,
          policy,
        });
      }
    }
  }

  // Build dagre graph
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',
    ranksep: 140,
    nodesep: 50,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes
  for (const [id, crd] of crdMap) {
    g.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    // Set rank based on layer for column ordering
    g.node(id).rank = getLayerRank(crd.layer);
  }

  // Add edges (use policy edges)
  for (const edge of policyEdges) {
    g.setEdge(edge.source, edge.target);
  }

  // Run layout
  dagre.layout(g);

  // Create graph nodes
  const graphNodes: GraphNode[] = [];
  for (const [id, crd] of crdMap) {
    const pos = g.node(id);
    graphNodes.push({
      id,
      type: 'crdNode',
      position: {
        x: (pos?.x ?? 0) - NODE_WIDTH / 2,
        y: (pos?.y ?? 0) - NODE_HEIGHT / 2,
      },
      data: {
        kind: crd.kind,
        apiGroup: crd.apiGroup,
        layer: crd.layer,
      },
    });
  }

  // Create graph edges with styles based on policy type
  const graphEdges: GraphEdge[] = policyEdges.map((edge) => {
    const policyKind = edge.policy.kind;

    let style: Record<string, any> = {};
    let animated = false;

    switch (policyKind) {
      case 'ValidatingPolicy':
        style = {
          stroke: '#6b7280', // gray-500
          strokeWidth: 1.5,
        };
        break;
      case 'GeneratingPolicy':
        style = {
          stroke: '#3b82f6', // blue-500
          strokeWidth: 2,
        };
        animated = true;
        break;
      case 'MutatingPolicy':
        style = {
          stroke: '#a855f7', // purple-500
          strokeWidth: 2,
          strokeDasharray: '5 5',
        };
        break;
      default:
        style = {
          stroke: '#6b7280',
          strokeWidth: 1.5,
        };
    }

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      style,
      animated,
      data: {
        policy: edge.policy,
      },
    };
  });

  return { nodes: graphNodes, edges: graphEdges };
}
