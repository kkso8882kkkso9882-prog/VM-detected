import React, { useState } from 'react';
import { VMHandler, ConfidenceLevel } from '../types/analysis';
import { Binary, CheckCircle, AlertTriangle, HelpCircle, Code, Search } from 'lucide-react';

interface HandlerExplorerProps {
  handlers: VMHandler[];
}

export const HandlerExplorer: React.FC<HandlerExplorerProps> = ({ handlers }) => {
  const [selectedHandler, setSelectedHandler] = useState<VMHandler | null>(handlers[0] || null);
  const [search, setSearch] = useState('');

  const filtered = handlers.filter(
    (h) =>
      h.handlerId.toString().toLowerCase().includes(search.toLowerCase()) ||
      h.semantic.toLowerCase().includes(search.toLowerCase()) ||
      h.description.toLowerCase().includes(search.toLowerCase())
  );

  const getConfidenceBadge = (conf: ConfidenceLevel) => {
    switch (conf) {
      case 'CERTAIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <CheckCircle className="w-3 h-3" /> CERTAIN
          </span>
        );
      case 'LIKELY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            LIKELY
          </span>
        );
      case 'POSSIBLE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <AlertTriangle className="w-3 h-3" /> POSSIBLE
          </span>
        );
      case 'UNKNOWN':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-700 text-slate-300 border border-slate-600">
            <HelpCircle className="w-3 h-3" /> UNKNOWN
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Binary className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-sm font-bold font-mono text-white">
              Semantic VM Opcode Handlers ({handlers.length})
            </h2>
            <p className="text-xs text-slate-400">
              Statically identified bytecode handlers categorized by register effects & data flow
            </p>
          </div>
        </div>

        <div className="relative w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search opcode / semantic..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Main Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        
        {/* Left: Handlers Table List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col h-[520px]">
          <div className="overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 font-mono">
                No opcode handlers matching filter
              </div>
            ) : (
              filtered.map((h) => {
                const isSelected = selectedHandler?.handlerId === h.handlerId;
                return (
                  <button
                    key={h.handlerId.toString()}
                    onClick={() => setSelectedHandler(h)}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">
                          {h.opcodeHex || h.handlerId}
                        </span>
                        <span className="font-mono text-[11px] text-cyan-400 font-semibold px-1.5 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/30">
                          {h.semantic}
                        </span>
                      </div>
                      {getConfidenceBadge(h.confidence)}
                    </div>

                    <p className="text-[11px] text-slate-400 truncate">
                      {h.description}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Detailed Opcode Inspector */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[520px] overflow-y-auto scrollbar-thin">
          {selectedHandler ? (
            <div className="space-y-5">
              
              {/* Opcode Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold font-mono text-white">
                      OP_{selectedHandler.semantic}
                    </h2>
                    <span className="text-xs font-mono text-slate-400">
                      ({selectedHandler.opcodeHex || selectedHandler.handlerId})
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    {selectedHandler.description}
                  </p>
                </div>
                {getConfidenceBadge(selectedHandler.confidence)}
              </div>

              {/* Operand Bitfield Layout */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono">
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-3">
                  Decoded Operand Layout
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {selectedHandler.operands.length === 0 ? (
                    <span className="text-xs text-slate-500 italic">No operands required</span>
                  ) : (
                    selectedHandler.operands.map((op, idx) => (
                      <div key={idx} className="p-2.5 rounded bg-slate-900 border border-slate-800">
                        <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
                          <span>Operand {op.name}</span>
                          <span className="text-[10px] text-indigo-400 font-semibold px-1 rounded bg-indigo-950/40">
                            {op.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">{op.meaning}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Registers Written & Read */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
                  <span className="text-slate-400 font-bold uppercase text-[11px] block mb-2">
                    Destination / Written Registers
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedHandler.targetRegisters.length === 0 ? (
                      <span className="text-slate-500 italic">None</span>
                    ) : (
                      selectedHandler.targetRegisters.map((reg, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                          {reg}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
                  <span className="text-slate-400 font-bold uppercase text-[11px] block mb-2">
                    Source / Read Registers & Tables
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedHandler.readRegisters.length === 0 ? (
                      <span className="text-slate-500 italic">None</span>
                    ) : (
                      selectedHandler.readRegisters.map((reg, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-800/40">
                          {reg}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Associated Luau Statements */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono">
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-cyan-400" />
                  Handler Implementation Statements ({selectedHandler.associatedStatements.length})
                </h4>
                <div className="space-y-1 text-xs text-slate-300 bg-slate-900/80 p-3 rounded border border-slate-800/80">
                  {selectedHandler.associatedStatements.map((stmt, idx) => (
                    <div key={idx} className="leading-5">
                      <span className="text-slate-600 select-none mr-2">{idx + 1}</span>
                      <span>{stmt}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-xs">
              Select an opcode handler to inspect semantic behavior
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
