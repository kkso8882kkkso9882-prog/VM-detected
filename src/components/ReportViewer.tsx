import React from 'react';
import { AnalysisReport } from '../types/analysis';
import { ShieldCheck, ShieldAlert, CheckCircle, Cpu, AlertTriangle, FileCode, Check } from 'lucide-react';

interface ReportViewerProps {
  report: AnalysisReport;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ report }) => {
  return (
    <div className="flex flex-col h-full space-y-5 overflow-y-auto pr-1 scrollbar-thin">
      
      {/* Top Banner: Obfuscation Score & Confidence */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Score Gauge */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase text-slate-400">Obfuscation Complexity Index</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold font-mono text-cyan-400">
                {report.obfuscationScore}
              </span>
              <span className="text-sm font-mono text-slate-500">/ 100</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                style={{ width: `${report.obfuscationScore}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-500 font-mono mt-1.5 block">
              {report.obfuscationScore > 70
                ? 'Heavily Virtualized VM with Control Flow Flattening'
                : 'Moderate / Light Obfuscation'}
            </span>
          </div>
        </div>

        {/* Deobfuscation Confidence */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase text-slate-400">Reconstruction Confidence</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
              {report.deobfuscationConfidence}
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-3 font-sans">
            Static register propagation and handler semantics verified against instruction patterns.
          </p>
        </div>

        {/* Fast Metrics */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 font-mono text-xs space-y-2">
          <span className="text-[11px] uppercase text-slate-400 block mb-1">Deobfuscation Metrics</span>
          <div className="flex justify-between text-slate-300">
            <span>Opaque Predicates Removed:</span>
            <span className="text-cyan-400 font-bold">{report.totalOpaquePredicatesRemoved}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Constants Folded/Propagated:</span>
            <span className="text-indigo-400 font-bold">{report.totalConstantsPropagated}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Strings Decrypted:</span>
            <span className="text-emerald-400 font-bold">{report.totalStringsDecoded}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Opcodes Reconstructed:</span>
            <span className="text-amber-400 font-bold">{report.totalInstructionsReconstructed}</span>
          </div>
        </div>

      </div>

      {/* Security Alerts (if any) */}
      {report.robloxSecurityAlerts.length > 0 && (
        <div className="bg-rose-950/20 border border-rose-800/60 rounded-xl p-5 font-mono">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-bold text-rose-300 uppercase tracking-wider">
              Roblox Security & Remote Telemetry Alerts
            </h3>
          </div>
          <div className="space-y-2">
            {report.robloxSecurityAlerts.map((alert, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-slate-950/80 border border-rose-900/50 text-xs text-rose-200"
              >
                {alert}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis Findings Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold font-mono text-white mb-3">
          Detailed Analysis Findings ({report.findings.length})
        </h3>
        <div className="space-y-3 font-mono">
          {report.findings.map((f, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                    {f.category}
                  </span>
                  <span className="text-xs font-bold text-white">{f.title}</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    f.severity === 'HIGH'
                      ? 'bg-rose-500/20 text-rose-300'
                      : f.severity === 'MEDIUM'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {f.severity}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">{f.detail}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
