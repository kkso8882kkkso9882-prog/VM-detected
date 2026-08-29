import React, { useState } from 'react';
import { RobloxAPICall } from '../types/analysis';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Wifi, 
  User, 
  Layers, 
  Box, 
  Zap, 
  Activity,
  AlertTriangle,
  Search
} from 'lucide-react';

interface RobloxTelemetryViewerProps {
  robloxCalls: RobloxAPICall[];
}

export const RobloxTelemetryViewer: React.FC<RobloxTelemetryViewerProps> = ({ robloxCalls }) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const filtered = robloxCalls.filter((c) => {
    const matchesCat = filterCategory === 'ALL' || c.category === filterCategory;
    const matchesSearch =
      c.apiName.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getRiskBadge = (risk: RobloxAPICall['potentialRisk']) => {
    switch (risk) {
      case 'CRITICAL_REMOTE_SPAM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <ShieldAlert className="w-3 h-3 text-rose-400" /> CRITICAL REMOTE
          </span>
        );
      case 'SECURITY_RISK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <AlertTriangle className="w-3 h-3 text-amber-400" /> HIGH RISK
          </span>
        );
      case 'SUSPICIOUS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
            SUSPICIOUS
          </span>
        );
      case 'BENIGN':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <ShieldCheck className="w-3 h-3 text-emerald-400" /> BENIGN
          </span>
        );
    }
  };

  const getCategoryIcon = (cat: RobloxAPICall['category']) => {
    switch (cat) {
      case 'SERVICE': return <Layers className="w-4 h-4 text-cyan-400" />;
      case 'REMOTE': return <Wifi className="w-4 h-4 text-rose-400" />;
      case 'PLAYER': return <User className="w-4 h-4 text-indigo-400" />;
      case 'INSTANCE': return <Box className="w-4 h-4 text-amber-400" />;
      case 'PHYSICS': return <Zap className="w-4 h-4 text-emerald-400" />;
      default: return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const categories = [
    { id: 'ALL', label: 'All Calls' },
    { id: 'REMOTE', label: 'RemoteEvents / Network' },
    { id: 'SERVICE', label: 'Roblox Services' },
    { id: 'PLAYER', label: 'Player & Character' },
    { id: 'INSTANCE', label: 'DataModel / Instances' },
    { id: 'PHYSICS', label: 'Physics / Spatial' }
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          <div>
            <h2 className="text-sm font-bold font-mono text-white">
              Roblox Engine & Remote Telemetry ({robloxCalls.length})
            </h2>
            <p className="text-xs text-slate-400">
              Isolated Roblox DataModel operations, network packet transmissions, and character hooks
            </p>
          </div>
        </div>

        <div className="relative w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter Roblox calls..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const count = cat.id === 'ALL' ? robloxCalls.length : robloxCalls.filter(c => c.category === cat.id).length;
          const isActive = filterCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{cat.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-1 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 font-mono text-xs">
            <ShieldCheck className="w-8 h-8 text-slate-600 mb-2" />
            <span>No Roblox-specific calls detected for the active filter</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
            {filtered.map((call, idx) => (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between gap-3 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                        {getCategoryIcon(call.category)}
                      </div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase">
                        {call.category}
                      </span>
                    </div>
                    {getRiskBadge(call.potentialRisk)}
                  </div>

                  <div className="text-sm font-bold text-white break-all mb-1">
                    {call.apiName}
                  </div>

                  <p className="text-xs text-slate-400 font-sans">
                    {call.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[11px] text-slate-500">
                  {call.line ? <span>Source: Line {call.line}</span> : <span>Virtualized Call</span>}
                  {call.methodName && <span className="text-cyan-400 font-semibold">Method: :{call.methodName}()</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
