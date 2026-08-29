import React from 'react';
import { 
  RotateCcw, 
  FileCode, 
  Download, 
  Layers, 
  Cpu,
  Sparkles,
  ChevronDown,
  Unlock,
  Play
} from 'lucide-react';
import { SAMPLE_SCRIPTS, SampleScript } from '../data/samples';
import { PipelineAnalysisResult } from '../types/analysis';

interface HeaderProps {
  onAnalyze: () => void;
  onDeobfuscateAndShow: () => void;
  onReset: () => void;
  onSelectSample: (sample: SampleScript) => void;
  isAnalyzing: boolean;
  results: PipelineAnalysisResult | null;
  selectedSampleId: string;
}

export const Header: React.FC<HeaderProps> = ({
  onAnalyze,
  onDeobfuscateAndShow,
  onReset,
  onSelectSample,
  isAnalyzing,
  results,
  selectedSampleId
}) => {
  const [exportOpen, setExportOpen] = React.useState(false);

  const handleExportJSON = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luau-vm-analysis-${Date.now()}.json`;
    a.click();
    setExportOpen(false);
  };

  const handleExportMarkdown = () => {
    if (!results) return;
    const md = `# Roblox Luau VM Static Analysis Report
Generated: ${new Date(results.timestamp).toLocaleString()}

## Executive Summary
${results.report.summary}

- **Obfuscation Score**: ${results.report.obfuscationScore}/100
- **Deobfuscation Confidence**: ${results.report.deobfuscationConfidence}
- **VM Type**: ${results.vmArchitecture.vmType} (${results.vmArchitecture.virtualizationEngine})
- **Opaque Predicates Removed**: ${results.report.totalOpaquePredicatesRemoved}
- **VM Handlers Mapped**: ${results.report.totalHandlersMapped}
- **Roblox API Calls Detected**: ${results.robloxCalls.length}

## Reconstructed Decompiled Luau
\`\`\`lua
${results.decompiledLuau}
\`\`\`

## Pseudo-Luau Intermediate Representation
\`\`\`lua
${results.pseudoLuau}
\`\`\`
`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luau-vm-report-${Date.now()}.md`;
    a.click();
    setExportOpen(false);
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-md shadow-cyan-900/30 border border-cyan-400/20">
            <Cpu className="w-5 h-5 text-cyan-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white font-mono">
                LUAU<span className="text-cyan-400">VM</span>.DEOBFUSCATOR
              </h1>
              <span className="px-1.5 py-0.5 text-[10px] font-mono tracking-wider font-semibold rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                v2.5 IR
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              เครื่องมือถอดรหัส Luau VM & Static Reverse Engineering
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sample selector */}
          <div className="relative">
            <select
              value={selectedSampleId}
              onChange={(e) => {
                const sample = SAMPLE_SCRIPTS.find(s => s.id === e.target.value);
                if (sample) onSelectSample(sample);
              }}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-cyan-500 appearance-none font-mono cursor-pointer"
            >
              <option value="" disabled>เลือกตัวอย่างสคริปต์ (Sample)...</option>
              {SAMPLE_SCRIPTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
          </div>

          {/* Reset */}
          <button
            onClick={onReset}
            title="ล้างข้อมูล (Reset)"
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Export Dropdown */}
          {results && (
            <div className="relative">
              <button
                onClick={() => setExportOpen(!exportOpen)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-medium border border-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {exportOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
                  <button
                    onClick={handleExportMarkdown}
                    className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
                  >
                    <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                    Export Markdown Report
                  </button>
                  <button
                    onClick={handleExportJSON}
                    className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    Export Full AST/CFG JSON
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Primary Deobfuscate & Reconstruct Button */}
          <button
            id="btn-deobfuscate-main"
            onClick={onDeobfuscateAndShow}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/60 transition-all disabled:opacity-50 cursor-pointer border border-emerald-300/30"
          >
            {isAnalyzing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                <span>กำลังถอดรหัส...</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4 text-slate-950 fill-slate-950/20" />
                <span>ถอดรหัส (Deobfuscate)</span>
              </>
            )}
          </button>

        </div>
      </div>
    </header>
  );
};
