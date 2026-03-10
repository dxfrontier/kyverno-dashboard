import React, { useCallback, useState } from 'react';
import { useT } from '../hooks/useT';
import { KyvernoPolicy } from '../services/api';

interface KyvernoYamlDrawerProps {
  darkMode: boolean;
  policy: KyvernoPolicy | null;
  onClose: () => void;
}

function toYaml(obj: unknown, indent = 0): string {
  const prefix = '  '.repeat(indent);
  if (obj === null || obj === undefined) return `${prefix}null`;
  if (typeof obj === 'string') {
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#')) {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          const inner = toYaml(item, indent + 1);
          const lines = inner.split('\n');
          return `${prefix}- ${lines[0].trim()}\n${lines.slice(1).join('\n')}`;
        }
        return `${prefix}- ${toYaml(item, 0)}`;
      })
      .join('\n');
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return entries
      .map(([key, val]) => {
        if (typeof val === 'object' && val !== null && !Array.isArray(val) && Object.keys(val).length > 0) {
          return `${prefix}${key}:\n${toYaml(val, indent + 1)}`;
        }
        if (Array.isArray(val) && val.length > 0) {
          return `${prefix}${key}:\n${toYaml(val, indent + 1)}`;
        }
        return `${prefix}${key}: ${toYaml(val, 0)}`;
      })
      .join('\n');
  }
  return String(obj);
}

const KyvernoYamlDrawer: React.FC<KyvernoYamlDrawerProps> = ({ darkMode, policy, onClose }) => {
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  const yamlContent = policy ? toYaml(policy) : '';

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(yamlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [yamlContent]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${policy?.metadata.name || 'policy'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [yamlContent, policy]);

  if (!policy) return null;

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div
        className={`w-[50vw] max-w-3xl h-full flex flex-col shadow-2xl ${
          darkMode ? 'bg-[#0f0f0f] border-l border-[#1a1a1a]' : 'bg-white border-l border-gray-200'
        }`}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'}`}>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>
              YAML
            </p>
            <p className="text-sm font-black tracking-tight">{policy.metadata.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg border transition-all ${
                copied
                  ? 'border-green-500 text-green-500'
                  : darkMode
                    ? 'border-[#222] text-gray-400 hover:text-white hover:border-[#42C1A6]'
                    : 'border-gray-200 text-slate-500 hover:text-slate-900 hover:border-[#42C1A6]'
              }`}
            >
              {copied ? t('admin.kyverno_copied') : t('admin.kyverno_copy')}
            </button>
            <button
              onClick={handleDownload}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg border transition-all ${
                darkMode
                  ? 'border-[#222] text-gray-400 hover:text-white hover:border-[#42C1A6]'
                  : 'border-gray-200 text-slate-500 hover:text-slate-900 hover:border-[#42C1A6]'
              }`}
            >
              {t('admin.kyverno_download')}
            </button>
            <button
              onClick={onClose}
              className={`px-2 py-1.5 text-sm font-bold rounded-lg border transition-all ${
                darkMode
                  ? 'border-[#222] text-gray-400 hover:text-white hover:border-red-400'
                  : 'border-gray-200 text-slate-500 hover:text-slate-900 hover:border-red-400'
              }`}
            >
              ✕
            </button>
          </div>
        </div>

        {/* YAML Content */}
        <div className="flex-1 overflow-auto p-6">
          <pre
            className={`text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words ${
              darkMode ? 'text-gray-300' : 'text-slate-700'
            }`}
          >
            {yamlContent}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default KyvernoYamlDrawer;
