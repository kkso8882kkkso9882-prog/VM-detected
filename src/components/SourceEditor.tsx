import React, { useRef } from 'react';
import { Upload, Copy, Check, Trash2, Code2, Unlock, Play } from 'lucide-react';

interface SourceEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  onClear: () => void;
  onDeobfuscate?: () => void;
  isAnalyzing?: boolean;
}

export const SourceEditor: React.FC<SourceEditorProps> = ({
  code,
  onChange,
  onClear,
  onDeobfuscate,
  isAnalyzing
}) => {
  const [copied, setCopied] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lines = code.split('\n');
  const lineCount = lines.length;
  const charCount = code.length;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onChange(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold font-mono text-slate-300">
            Target Luau Source Input
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            ({lineCount} lines, {(charCount / 1024).toFixed(1)} KB)
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".lua,.luau,.txt"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload .luau</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={onClear}
            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-md transition-colors"
            title="Clear code"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {onDeobfuscate && (
            <button
              onClick={onDeobfuscate}
              disabled={isAnalyzing || !code.trim()}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors shadow-sm disabled:opacity-50 cursor-pointer ml-1"
            >
              <Unlock className="w-3.5 h-3.5 text-slate-950 fill-current" />
              <span>ถอดรหัสโค้ดนี้ (Deobfuscate)</span>
            </button>
          )}
        </div>
      </div>

      {/* Editor Body with Line Numbers */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Line Numbers */}
        <div className="w-12 bg-slate-900/50 border-r border-slate-800/80 py-3 text-right pr-3 font-mono text-[11px] text-slate-600 select-none overflow-hidden">
          {lines.map((_, i) => (
            <div key={i} className="leading-5">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code Textarea */}
        <textarea
          value={code}
          onChange={(e) => onChange(e.target.value)}
          placeholder="วางโค้ด Roblox Luau ที่ต้องการถอดรหัสที่นี่ แล้วกดปุ่ม 'ถอดรหัส (Deobfuscate)'..."
          spellCheck={false}
          className="flex-1 w-full bg-slate-950 text-slate-200 font-mono text-[12px] leading-5 p-3 resize-none focus:outline-none scrollbar-thin selection:bg-cyan-500/30 selection:text-cyan-200"
        />
      </div>
    </div>
  );
};
