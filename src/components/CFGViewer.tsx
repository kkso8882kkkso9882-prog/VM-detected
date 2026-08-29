import React, { useState } from 'react';
import { ControlFlowGraph, BasicBlock } from '../types/analysis';
import { Network, ArrowRight, CornerDownRight, ShieldCheck, Activity, Search } from 'lucide-react';

interface CFGViewerProps {
  cfg: ControlFlowGraph;
}

export const CFGViewer: React.FC<CFGViewerProps> = ({ cfg }) => {
  const [selectedBlockId, setSelectedBlockId] = useState<number>(cfg.entryBlockId || 0);
  const [filterType, setFilterType] = useState<'all' | 'heads' | 'dead'>('all');

  const selectedBlock = cfg.blocks.find((b) => b.id === selectedBlockId);

  const filteredBlocks = cfg.blocks.filter((b) => {
    if (filterType === 'heads') return b.isDispatchHead || b.isEntry;
    if (filterType === 'dead') return b.predecessors.length === 0 && !b.isEntry;
    return true;
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Total Basic Blocks</div>
            <div className="text-base font-bold font-mono text-cyan-400 mt-0.5">
              {cfg.blocks.length} Blocks
            </div>
          </div>
          <Network className="w-5 h-5 text-cyan-500/80" />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Control Flow Edges</div>
            <div className="text-base font-bold font-mono text-indigo-400 mt-0.5">
              {cfg.edges.length} Edges
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-indigo-500/80" />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Cyclomatic Complexity</div>
            <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
              {cfg.cyclomaticComplexity} M
            </div>
          </div>
          <Activity className="w-5 h-5 text-amber-500/80" />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Dead / Unreachable Blocks</div>
            <div className="text-base font-bold font-mono text-rose-400 mt-0.5">
              {cfg.deadBlockCount} Dead
            </div>
          </div>
          <ShieldCheck className="w-5 h-5 text-rose-500/80" />
        </div>
      </div>

      {/* Main Blocks Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        
        {/* Left Column: Basic Block Index */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[520px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold font-mono uppercase text-slate-300">
              Basic Blocks ({filteredBlocks.length})
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                  filterType === 'all' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('heads')}
                className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                  filterType === 'heads' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Heads
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
            {filteredBlocks.map((block) => {
              const isSelected = selectedBlockId === block.id;
              return (
                <button
                  key={block.id}
                  onClick={() => setSelectedBlockId(block.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold">
                      BB_{block.id} [{block.label}]
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    {block.isEntry && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        ENTRY
                      </span>
                    )}
                    {block.isExit && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                        EXIT
                      </span>
                    )}
                    {block.isDispatchHead && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        DISPATCH
                      </span>
                    )}
                    <span className="text-slate-500">
                      {block.statements.length} stmts
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Block Details & Successors */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[520px] overflow-y-auto scrollbar-thin">
          {selectedBlock ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[11px] font-mono uppercase text-slate-500">Selected Basic Block</span>
                  <h2 className="text-xl font-bold font-mono text-white mt-0.5">
                    BB_{selectedBlock.id}: <span className="text-cyan-400">{selectedBlock.label}</span>
                  </h2>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-slate-400">Preds: {selectedBlock.predecessors.length}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">Succs: {selectedBlock.successors.length}</span>
                </div>
              </div>

              {/* Statements inside block */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono">
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">
                  Block Statements ({selectedBlock.statements.length})
                </h4>
                {selectedBlock.statements.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No linear statements (control-flow transfer node)</p>
                ) : (
                  <div className="space-y-1.5 text-xs text-slate-300">
                    {selectedBlock.statements.map((stmt, idx) => (
                      <div key={idx} className="p-2 rounded bg-slate-900/80 border border-slate-800/60 flex items-start gap-2">
                        <span className="text-slate-500 select-none text-[11px] w-6">{idx + 1}.</span>
                        <div className="flex-1 break-all">
                          <span className="text-indigo-300 font-semibold">{stmt.type}</span>
                          {stmt.loc && <span className="text-slate-500 text-[10px] ml-2">Line {stmt.loc.start.line}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Connected CFG Edges */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                
                {/* Predecessors */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <h4 className="font-bold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                    <CornerDownRight className="w-3.5 h-3.5 text-indigo-400 rotate-180" />
                    Predecessors ({selectedBlock.predecessors.length})
                  </h4>
                  <div className="space-y-1.5">
                    {selectedBlock.predecessors.map((pId) => (
                      <button
                        key={pId}
                        onClick={() => setSelectedBlockId(pId)}
                        className="w-full text-left p-2 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500 text-slate-300 hover:text-cyan-300 flex items-center justify-between"
                      >
                        <span>&larr; Jump from BB_{pId}</span>
                        <span className="text-[10px] text-slate-500">inspect</span>
                      </button>
                    ))}
                    {selectedBlock.predecessors.length === 0 && (
                      <span className="text-slate-500 italic">No incoming predecessors</span>
                    )}
                  </div>
                </div>

                {/* Successors & Branch Edges */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <h4 className="font-bold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                    Successors ({selectedBlock.successors.length})
                  </h4>
                  <div className="space-y-1.5">
                    {selectedBlock.successors.map((sId) => {
                      const edge = cfg.edges.find((e) => e.from === selectedBlock.id && e.to === sId);
                      return (
                        <button
                          key={sId}
                          onClick={() => setSelectedBlockId(sId)}
                          className="w-full text-left p-2 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500 text-slate-300 hover:text-cyan-300 flex items-center justify-between"
                        >
                          <div>
                            <span>&rarr; Branch to BB_{sId}</span>
                            {edge?.type && (
                              <span className="ml-2 text-[10px] text-cyan-400 font-semibold uppercase">
                                [{edge.type}]
                              </span>
                            )}
                          </div>
                          {edge?.condition && (
                            <span className="text-[10px] text-amber-300/80 truncate max-w-[120px]">
                              {edge.condition}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {selectedBlock.successors.length === 0 && (
                      <span className="text-slate-500 italic">Terminal exit block</span>
                    )}
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-xs">
              Select a Basic Block to inspect control flow
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
