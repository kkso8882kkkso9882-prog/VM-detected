import React from 'react';
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Terminal, 
  Network, 
  Binary, 
  Lock, 
  Cpu, 
  FileCheck, 
  ShieldCheck 
} from 'lucide-react';

interface PipelineTimelineProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  hasResults: boolean;
}

export const PipelineTimeline: React.FC<PipelineTimelineProps> = ({
  activeTab,
  onSelectTab,
  hasResults
}) => {
  const stages = [
    { id: 'source', label: '1. Source & AST', icon: Terminal },
    { id: 'cfg', label: '2. CFG & DFG', icon: Network },
    { id: 'statemachine', label: '3. State Machine', icon: Cpu },
    { id: 'stringpool', label: '4. String Pool & Entropy', icon: Lock },
    { id: 'handlers', label: '5. VM Handlers', icon: Binary },
    { id: 'bytecode', label: '6. Bytecode Stream', icon: Binary },
    { id: 'pseudoluau', label: '7. Pseudo-Luau IR', icon: FileCheck },
    { id: 'decompiled', label: '8. Decompiled Luau', icon: FileCheck },
    { id: 'roblox', label: '9. Roblox Telemetry', icon: ShieldCheck },
    { id: 'report', label: '10. Analysis Report', icon: CheckCircle2 }
  ];

  return (
    <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-2.5 overflow-x-auto scrollbar-thin">
      <div className="max-w-7xl mx-auto flex items-center gap-1.5 min-w-max">
        <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mr-2 flex items-center gap-1 font-semibold">
          Pipeline:
        </span>
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const isActive = activeTab === stage.id;
          return (
            <React.Fragment key={stage.id}>
              <button
                onClick={() => onSelectTab(stage.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-950 font-medium'
                    : hasResults
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    : 'text-slate-600 hover:text-slate-400'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{stage.label}</span>
                {hasResults && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 ml-0.5" />
                )}
              </button>
              {idx < stages.length - 1 && (
                <ArrowRight className="w-3 h-3 text-slate-700 mx-0.5 shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
