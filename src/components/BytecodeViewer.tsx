import React, { useState } from 'react';
import { ReconstructedInstruction, VMArchitecture } from '../types/analysis';
import { Binary, Cpu, Search, CheckCircle, AlertTriangle } from 'lucide-react';

interface BytecodeViewerProps {
  instructions: ReconstructedInstruction[];
  architecture: VMArchitecture;
}

export const BytecodeViewer: React.FC<BytecodeViewerProps> = ({ instructions, architecture }) => {
  const [search, setSearch] = useState('');

  const filtered = instructions.filter(
    (inst) =>
      inst.pseudoCode.toLowerCase().includes(search.toLowerCase()) ||
      inst.opcodeName.toLowerCase().includes(search.toLowerCase()) ||
      inst.rawHex?.toLowerCase().includes(search.toLowerCase()) ||
      inst.semantic.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Info Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">VM Architecture</div>
            <div className="text-base font-bold font-mono text-cyan-400 mt-0.5">
              {architecture.vmType}
            </div>
          </div>
          <Cpu className="w-5 h-5 text-cyan-500/80" />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Virtualization Engine</div>
            <div className="text-base font-bold font-mono text-indigo-400 mt-0.5">
              {architecture.virtualizationEngine}
            </div>
          </div>
          <Binary className="w-5 h-5 text-indigo-500/80" />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Total Instructions</div>
            <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
              {instructions.length} Opcodes
            </div>
          </div>
          <CheckCircle className="w-5 h-5 text-emerald-500/80" />
        </div>
      </div>

      {/* Main Instruction Stream Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col flex-1 overflow-hidden">
        
        {/* Table Toolbar */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Binary className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider">
              Disassembled Virtual Bytecode Stream
            </h3>
          </div>

          <div className="relative w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search instructions..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2 pointer-events-none" />
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead className="bg-slate-950 sticky top-0 border-b border-slate-800 text-slate-400 select-none">
              <tr>
                <th className="py-2.5 px-3 w-16 text-slate-500">PC</th>
                <th className="py-2.5 px-3 w-28 text-slate-400">HEX</th>
                <th className="py-2.5 px-3 w-36 text-cyan-400">OPCODE</th>
                <th className="py-2.5 px-3 w-28 text-indigo-400">CONFIDENCE</th>
                <th className="py-2.5 px-3 text-white">RECONSTRUCTED PSEUDO-CODE</th>
                <th className="py-2.5 px-3 text-slate-400">DESCRIPTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                    No bytecode instructions found
                  </td>
                </tr>
              ) : (
                filtered.map((inst, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 text-slate-500 select-none font-bold">
                      {inst.pc.toString().padStart(4, '0')}
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      {inst.rawHex || '---'}
                    </td>
                    <td className="py-2 px-3 font-semibold text-cyan-300">
                      {inst.opcodeName}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        inst.confidence === 'CERTAIN' 
                          ? 'bg-emerald-500/20 text-emerald-300' 
                          : inst.confidence === 'LIKELY'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {inst.confidence}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-white font-semibold break-all">
                      {inst.pseudoCode}
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-[11px]">
                      {inst.comment}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};
