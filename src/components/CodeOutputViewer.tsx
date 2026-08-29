import React, { useState } from 'react';
import { Copy, Check, Download, Search, FileCode2 } from 'lucide-react';

interface CodeOutputViewerProps {
  title: string;
  badge: string;
  description: string;
  code: string;
  filename: string;
}

export const CodeOutputViewer: React.FC<CodeOutputViewerProps> = ({
  title,
  badge,
  description,
  code,
  filename
}) => {
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');

  const lines = code.split('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <FileCode2 className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono text-white">{title}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {badge}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative w-48 hidden md:block">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find in code..."
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            <Search className="w-3 h-3 text-slate-500 absolute right-2 top-2 pointer-events-none" />
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Code Display */}
      <div className="flex-1 flex overflow-hidden font-mono text-[12px] leading-5">
        {/* Line Numbers */}
        <div className="w-12 bg-slate-900/50 border-r border-slate-800/80 py-3 text-right pr-3 text-slate-600 select-none overflow-hidden">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Code Content */}
        <div className="flex-1 p-3 overflow-y-auto overflow-x-auto text-slate-200 scrollbar-thin selection:bg-cyan-500/30 selection:text-cyan-200 whitespace-pre">
          {lines.map((line, idx) => {
            const isMatch = search.trim() !== '' && line.toLowerCase().includes(search.toLowerCase());
            return (
              <div
                key={idx}
                className={isMatch ? 'bg-cyan-500/20 text-cyan-200 font-semibold' : ''}
              >
                {line || ' '}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
