import React, { useState } from 'react';
import { StateMachineInfo, StateTransition } from '../types/analysis';
import { Cpu, ArrowRight, RefreshCw, AlertOctagon, Layers, Search } from 'lucide-react';

interface StateMachineViewerProps {
  stateMachine: StateMachineInfo;
}

export const StateMachineViewer: React.FC<StateMachineViewerProps> = ({ stateMachine }) => {
  const [selectedState, setSelectedState] = useState<string | number | null>(
    stateMachine.initialState || (stateMachine.states[0] ?? null)
  );
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStates = stateMachine.states.filter((s) =>
    s.toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  const outgoing = stateMachine.transitions.filter((t) => t.fromState === selectedState);
  const incoming = stateMachine.transitions.filter((t) => t.toState === selectedState);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Overview Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Dispatcher Variable</div>
            <div className="text-base font-bold font-mono text-cyan-400 mt-0.5">
              {stateMachine.stateVariableName || 'None Detected'}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Initial State</div>
            <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
              {stateMachine.initialState !== null ? `State ${stateMachine.initialState}` : 'Unknown'}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Total States / Transitions</div>
            <div className="text-base font-bold font-mono text-indigo-300 mt-0.5">
              {stateMachine.states.length} states / {stateMachine.transitions.length} edges
            </div>
          </div>
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <ArrowRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Dispatcher Architecture</div>
            <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
              {stateMachine.dispatcherType}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <RefreshCw className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: State Explorer & Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        
        {/* Left Column: State Nodes List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[520px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold font-mono uppercase text-slate-300 tracking-wider">
              Discovered States ({filteredStates.length})
            </h3>
            <div className="relative w-36">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter state..."
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              />
              <Search className="w-3 h-3 text-slate-500 absolute right-2 top-2 pointer-events-none" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
            {filteredStates.map((state) => {
              const isSelected = selectedState === state;
              const isInitial = stateMachine.initialState === state;
              const isUnreachable = stateMachine.unreachableStates.includes(state);
              const outCount = stateMachine.transitions.filter((t) => t.fromState === state).length;

              return (
                <button
                  key={state.toString()}
                  onClick={() => setSelectedState(state)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="font-mono text-xs font-semibold">State {state}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isInitial && (
                      <span className="text-[10px] px-1.5 py-0.5 font-mono rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        INIT
                      </span>
                    )}
                    {isUnreachable && (
                      <span className="text-[10px] px-1.5 py-0.5 font-mono rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        UNREACHABLE
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-500">
                      {outCount} out
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected State Transition Node Inspector */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[520px] overflow-y-auto scrollbar-thin">
          {selectedState !== null ? (
            <div className="space-y-5">
              {/* Selected Node Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[11px] font-mono uppercase text-slate-500">State Node Details</span>
                  <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2 mt-0.5">
                    State <span className="text-cyan-400">{selectedState}</span>
                  </h2>
                </div>
                {stateMachine.initialState === selectedState && (
                  <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-medium">
                    VM Entry / Initial State
                  </span>
                )}
              </div>

              {/* Transition Mapping Diagram */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Outgoing Transitions */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <h4 className="text-xs font-mono font-bold uppercase text-slate-400 mb-3 flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                    Outgoing Transitions ({outgoing.length})
                  </h4>

                  {outgoing.length === 0 ? (
                    <p className="text-xs text-slate-500 font-mono italic">
                      Terminal / Sink state (no outgoing transitions)
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {outgoing.map((t, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded bg-slate-900 border border-slate-800 flex flex-col gap-1 font-mono text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">State {t.fromState}</span>
                            <span className="text-cyan-400 font-bold">&rarr; State {t.toState}</span>
                          </div>
                          {t.condition && (
                            <div className="text-[11px] text-amber-300/90 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-800/40">
                              Condition: {t.condition}
                            </div>
                          )}
                          {t.line && (
                            <span className="text-[10px] text-slate-500">Source: Line {t.line}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Incoming Transitions */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <h4 className="text-xs font-mono font-bold uppercase text-slate-400 mb-3 flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-400 rotate-180" />
                    Incoming Transitions ({incoming.length})
                  </h4>

                  {incoming.length === 0 ? (
                    <p className="text-xs text-slate-500 font-mono italic">
                      {stateMachine.initialState === selectedState ? 'Entry state (no predecessors)' : 'Unreachable state'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {incoming.map((t, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded bg-slate-900 border border-slate-800 flex flex-col gap-1 font-mono text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-indigo-400 font-bold">State {t.fromState}</span>
                            <span className="text-slate-400">&rarr; State {t.toState}</span>
                          </div>
                          {t.condition && (
                            <div className="text-[11px] text-indigo-300/90 bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-800/40">
                              Condition: {t.condition}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* State Cycles & Diagnostics */}
              {stateMachine.stateCycles.length > 0 && (
                <div className="bg-amber-950/20 border border-amber-800/50 rounded-lg p-4">
                  <h4 className="text-xs font-mono font-bold text-amber-300 mb-2 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                    Detected State Machine Cycles ({stateMachine.stateCycles.length})
                  </h4>
                  <div className="space-y-1.5">
                    {stateMachine.stateCycles.map((cycle, idx) => (
                      <div key={idx} className="font-mono text-xs text-amber-200/80">
                        Cycle {idx + 1}: {cycle.map((s) => `State ${s}`).join(' &rarr; ')} &rarr; State {cycle[0]}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unreachable States Alert */}
              {stateMachine.unreachableStates.length > 0 && (
                <div className="bg-rose-950/20 border border-rose-800/50 rounded-lg p-4">
                  <h4 className="text-xs font-mono font-bold text-rose-300 mb-2 flex items-center gap-2">
                    <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                    Unreachable / Dead States ({stateMachine.unreachableStates.length})
                  </h4>
                  <div className="font-mono text-xs text-rose-200/80">
                    {stateMachine.unreachableStates.map((s) => `State ${s}`).join(', ')}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-xs">
              Select a state to inspect transitions and edges
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
