import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PipelineTimeline } from './components/PipelineTimeline';
import { SourceEditor } from './components/SourceEditor';
import { StateMachineViewer } from './components/StateMachineViewer';
import { CFGViewer } from './components/CFGViewer';
import { HandlerExplorer } from './components/HandlerExplorer';
import { StringPoolExplorer } from './components/StringPoolExplorer';
import { RobloxTelemetryViewer } from './components/RobloxTelemetryViewer';
import { BytecodeViewer } from './components/BytecodeViewer';
import { CodeOutputViewer } from './components/CodeOutputViewer';
import { ReportViewer } from './components/ReportViewer';
import { LuauAnalysisPipeline } from './engine/pipeline';
import { PipelineAnalysisResult } from './types/analysis';
import { SAMPLE_SCRIPTS, SampleScript } from './data/samples';
import { Play, Sparkles, Terminal, FileCode } from 'lucide-react';

export function App() {
  const [selectedSampleId, setSelectedSampleId] = useState<string>(SAMPLE_SCRIPTS[0].id);
  const [sourceCode, setSourceCode] = useState<string>(SAMPLE_SCRIPTS[0].code);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [results, setResults] = useState<PipelineAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>('source');
  const [sourceSubTab, setSourceSubTab] = useState<'original' | 'normalized' | 'simplified'>('original');

  // Run initial analysis automatically on mount
  useEffect(() => {
    handleRunAnalysis();
  }, []);

  const handleRunAnalysis = (targetTab?: string) => {
    setIsAnalyzing(true);
    // Slight timeout to allow UI update & visual pipeline feedback
    setTimeout(() => {
      try {
        const pipeline = new LuauAnalysisPipeline();
        const res = pipeline.run(sourceCode);
        setResults(res);
        if (targetTab) {
          setActiveTab(targetTab);
        }
      } catch (err) {
        console.error('Analysis failed:', err);
      } finally {
        setIsAnalyzing(false);
      }
    }, 150);
  };

  const handleDeobfuscateAndShow = () => {
    handleRunAnalysis('decompiled');
  };

  const handleSelectSample = (sample: SampleScript) => {
    setSelectedSampleId(sample.id);
    setSourceCode(sample.code);
    setIsAnalyzing(true);
    setTimeout(() => {
      try {
        const pipeline = new LuauAnalysisPipeline();
        const res = pipeline.run(sample.code);
        setResults(res);
      } catch (err) {
        console.error('Sample analysis failed:', err);
      } finally {
        setIsAnalyzing(false);
      }
    }, 150);
  };

  const handleReset = () => {
    setSourceCode('');
    setResults(null);
    setSelectedSampleId('');
    setActiveTab('source');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header */}
      <Header
        onAnalyze={() => handleRunAnalysis()}
        onDeobfuscateAndShow={handleDeobfuscateAndShow}
        onReset={handleReset}
        onSelectSample={handleSelectSample}
        isAnalyzing={isAnalyzing}
        results={results}
        selectedSampleId={selectedSampleId}
      />

      {/* Pipeline Navigation Bar */}
      <PipelineTimeline
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hasResults={results !== null}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col min-h-0">
        {/* TAB 1: SOURCE & AST */}
        {activeTab === 'source' && (
          <div className="flex-1 flex flex-col space-y-3 min-h-0">
            {/* Sub Tabs */}
            {results && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSourceSubTab('original')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                    sourceSubTab === 'original'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Original Obfuscated Source
                </button>
                <button
                  onClick={() => setSourceSubTab('normalized')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                    sourceSubTab === 'normalized'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Normalized AST Form
                </button>
                <button
                  onClick={() => setSourceSubTab('simplified')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                    sourceSubTab === 'simplified'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Simplified (Folded & Pruned)
                </button>
              </div>
            )}

            <div className="flex-1 min-h-[560px]">
              {sourceSubTab === 'original' || !results ? (
                <SourceEditor
                  code={sourceCode}
                  onChange={(newCode) => setSourceCode(newCode)}
                  onClear={() => setSourceCode('')}
                  onDeobfuscate={handleDeobfuscateAndShow}
                  isAnalyzing={isAnalyzing}
                />
              ) : sourceSubTab === 'normalized' ? (
                <CodeOutputViewer
                  title="Normalized Luau AST Representation"
                  badge="Normalized"
                  description="Standardized syntax tree reconstructed without obfuscation quirks"
                  code={results.normalizedSource}
                  filename="normalized.luau"
                />
              ) : (
                <CodeOutputViewer
                  title="Symbolically Simplified Luau Source"
                  badge="Pruned"
                  description="Constant folded expressions and dead branches removed via opaque predicate elimination"
                  code={results.simplifiedSource}
                  filename="simplified.luau"
                />
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CFG & DFG */}
        {activeTab === 'cfg' && results && (
          <CFGViewer cfg={results.cfg} />
        )}

        {/* TAB 3: STATE MACHINE */}
        {activeTab === 'statemachine' && results && (
          <StateMachineViewer stateMachine={results.stateMachine} />
        )}

        {/* TAB 4: STRING POOL & ENTROPY */}
        {activeTab === 'stringpool' && results && (
          <StringPoolExplorer stringPool={results.stringPool} />
        )}

        {/* TAB 5: VM HANDLERS */}
        {activeTab === 'handlers' && results && (
          <HandlerExplorer handlers={results.handlers} />
        )}

        {/* TAB 6: BYTECODE STREAM */}
        {activeTab === 'bytecode' && results && (
          <BytecodeViewer instructions={results.instructions} architecture={results.vmArchitecture} />
        )}

        {/* TAB 7: PSEUDO-LUAU IR */}
        {activeTab === 'pseudoluau' && results && (
          <div className="flex-1 min-h-[560px]">
            <CodeOutputViewer
              title="Low-Level Pseudo-Luau Intermediate Representation (IR)"
              badge="Virtual Registers & 3-Address Code"
              description="Bytecode handlers mapped into linear virtual register statements & state transitions"
              code={results.pseudoLuau}
              filename="pseudo_ir.luau"
            />
          </div>
        )}

        {/* TAB 8: DECOMPILED LUAU */}
        {activeTab === 'decompiled' && results && (
          <div className="flex-1 min-h-[560px]">
            <CodeOutputViewer
              title="Reconstructed & Decompiled High-Level Luau Script"
              badge="High-Level Luau"
              description="Fully recovered script with restored Roblox services, decrypted strings, and network triggers"
              code={results.decompiledLuau}
              filename="decompiled.luau"
            />
          </div>
        )}

        {/* TAB 9: ROBLOX TELEMETRY */}
        {activeTab === 'roblox' && results && (
          <RobloxTelemetryViewer robloxCalls={results.robloxCalls} />
        )}

        {/* TAB 10: ANALYSIS REPORT */}
        {activeTab === 'report' && results && (
          <ReportViewer report={results.report} />
        )}

        {/* Empty state when no analysis performed and on a results tab */}
        {activeTab !== 'source' && !results && (
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl p-12 text-center">
            <Terminal className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-base font-bold font-mono text-slate-300">
              No Analysis Results Available
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              Click the "Execute Analysis" button to run the Luau VM static analysis and intermediate representation pipeline.
            </p>
            <button
              onClick={handleRunAnalysis}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold font-mono"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Pipeline</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
