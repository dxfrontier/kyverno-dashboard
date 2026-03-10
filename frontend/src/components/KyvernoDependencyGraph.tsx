import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { KyvernoPolicy } from '../services/api';
import { buildDependencyGraph } from '../services/kyvernoPolicyGraph';
import KyvernoCrdNode from './KyvernoCrdNode';

interface KyvernoDependencyGraphProps {
  policies: KyvernoPolicy[];
  darkMode: boolean;
  onPolicyClick: (policy: KyvernoPolicy) => void;
}

const nodeTypes = { crdNode: KyvernoCrdNode };

const GraphInner: React.FC<KyvernoDependencyGraphProps> = ({ policies, darkMode, onPolicyClick }) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const { fitView } = useReactFlow();
  const hasFittedView = React.useRef(false);
  const policiesKey = React.useMemo(() => JSON.stringify(policies.map((p) => p.metadata.name)), [policies]);

  const { nodes, edges } = useMemo(() => buildDependencyGraph(policies), [policiesKey]);

  useEffect(() => {
    if (nodes.length > 0 && !hasFittedView.current) {
      hasFittedView.current = true;
      const timeoutId = setTimeout(() => fitView({ padding: 0.2 }), 50);
      return () => clearTimeout(timeoutId);
    }
  }, [nodes.length, fitView]);

  const handleHover = useCallback((id: string | null) => {
    setHoveredNode(id);
  }, []);

  // Inject callbacks + darkMode into node data
  const enrichedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          darkMode,
          onHover: handleHover,
          id: node.id,
        },
      })),
    [nodes, darkMode, handleHover],
  );

  // Apply hover highlighting to edges
  const enrichedEdges = useMemo(
    () =>
      edges.map((edge) => {
        const isConnected = hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode);
        return {
          ...edge,
          style: {
            ...edge.style,
            opacity: hoveredNode ? (isConnected ? 1 : 0.3) : 1,
          },
        };
      }),
    [edges, hoveredNode],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      const policy = edge.data?.policy as KyvernoPolicy | undefined;
      if (policy) {
        onPolicyClick(policy);
      }
    },
    [onPolicyClick],
  );

  return (
    <ReactFlow
      nodes={enrichedNodes}
      edges={enrichedEdges}
      nodeTypes={nodeTypes}
      onEdgeClick={handleEdgeClick}
      fitView
      colorMode={darkMode ? 'dark' : 'light'}
      proOptions={{ hideAttribution: true }}
      minZoom={0.1}
      maxZoom={2}
    >
      <Controls className={darkMode ? '!bg-[#1a1a1a] !border-[#333] !text-gray-300' : ''} />
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={darkMode ? '#1a1a1a' : '#e2e8f0'} />
    </ReactFlow>
  );
};

const Legend: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
  const items = [
    { label: 'Validate', color: '#6b7280', type: 'solid' },
    { label: 'Generate', color: '#3b82f6', type: 'solid' },
    { label: 'Mutate', color: '#a855f7', type: 'dashed' },
  ];

  return (
    <div
      className={`flex items-center justify-center gap-6 py-2 text-[10px] ${
        darkMode ? 'text-gray-400' : 'text-slate-500'
      }`}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {item.type === 'dashed' ? (
            <svg width="12" height="2" className="shrink-0">
              <line x1="0" y1="1" x2="12" y2="1" stroke={item.color} strokeWidth="2" strokeDasharray="3 2" />
            </svg>
          ) : (
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          )}
          <span className="font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

const KyvernoDependencyGraph: React.FC<KyvernoDependencyGraphProps> = (props) => {
  const { darkMode } = props;

  return (
    <div className="flex flex-col">
      <div className="relative" style={{ height: '300px' }}>
        <ReactFlowProvider>
          <GraphInner {...props} />
        </ReactFlowProvider>
      </div>
      <Legend darkMode={darkMode} />
    </div>
  );
};

export default KyvernoDependencyGraph;
