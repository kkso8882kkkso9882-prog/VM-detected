import React, { useState } from 'react';
import { StringPoolEntry } from '../types/analysis';
import { Lock, Unlock, Key, FileText, CheckCircle, BarChart3, Search } from 'lucide-react';

interface StringPoolExplorerProps {
  stringPool: StringPoolEntry[];
}

export const StringPoolExplorer: React.FC<StringPoolExplorerProps> = ({ stringPool }) => {
  const [selectedEntry, setSelectedEntry] = useState<StringPoolEntry | null>(stringPool[0] || null);
  const [search, setSearch] = useState('');

  const filtered = stringPool.filter(
    (e) =>
      e.cleanValue.toLowerCase().includes(search.toLowerCase()) ||
      (e.decodedPlaintext && e.decodedPlaintext.toLowerCase().includes(search.toLowerCase())) ||
      e.alphabet.toLowerCase().includes(search.toLowerCase())
  );

  const getEntropyColor = (entropy: number) => {
    if (entropy > 4.5) return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    if (entropy > 3.5) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Lock className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-sm font-bold font-mono text-white">
              String Pool & Shannon Entropy Analyzer ({stringPool.length})
            </h2>
            <p className="text-xs text-slate-400">
              Analyzes character entropy distributions, custom alphabets, XOR ciphers & static decoders
            </p>
          </div>
        </div>

        <div className="relative w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search string / plaintext..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        
        {/* Left: String Pool List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col h-[520px]">
          <div className="overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 font-mono">
                No strings matching filter
              </div>
            ) : (
              filtered.map((entry, idx) => {
                const isSelected = selectedEntry?.cleanValue === entry.cleanValue;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedEntry(entry)}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-white truncate max-w-[140px]">
                        {entry.cleanValue.replace(/\n/g, '\\n')}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getEntropyColor(
                          entry.entropy
                        )}`}
                      >
                        {entry.entropy} bits
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-500">{entry.alphabet}</span>
                      {entry.decodedPlaintext && entry.decodedPlaintext !== entry.cleanValue ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Unlock className="w-3 h-3" /> Plaintext Recovered
                        </span>
                      ) : entry.isSuspectedEncrypted ? (
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Encrypted Blob
                        </span>
                      ) : (
                        <span className="text-slate-500">Literal String</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Detailed String & Entropy Inspector */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[520px] overflow-y-auto scrollbar-thin">
          {selectedEntry ? (
            <div className="space-y-5">
              
              {/* String Header */}
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[11px] font-mono uppercase text-slate-500">Selected String Entry</span>
                <div className="flex items-center justify-between mt-1">
                  <h3 className="text-lg font-bold font-mono text-white truncate max-w-[400px]">
                    "{selectedEntry.cleanValue}"
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
                    Length: {selectedEntry.cleanValue.length} bytes
                  </span>
                </div>
              </div>

              {/* Entropy & Alphabet Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                
                {/* Shannon Entropy Card */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 uppercase font-bold text-[11px]">Shannon Entropy</span>
                    <span className="text-base font-bold text-cyan-400">{selectedEntry.entropy} / 8.0</span>
                  </div>

                  {/* Meter Bar */}
                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                      style={{ width: `${Math.min(100, (selectedEntry.entropy / 8) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    {selectedEntry.entropy > 4.2
                      ? 'High randomness: Strongly indicative of encrypted/compressed payload'
                      : 'Low/Moderate entropy: Standard language or literal structure'}
                  </p>
                </div>

                {/* Alphabet Classification */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <span className="text-slate-400 uppercase font-bold text-[11px] block mb-1">
                    Alphabet Classification
                  </span>
                  <div className="text-base font-bold text-indigo-300 mb-1">
                    {selectedEntry.alphabet}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {selectedEntry.alphabet === 'BASE64' && 'Standard Base64 (A-Z, a-z, 0-9, +, /)'}
                    {selectedEntry.alphabet === 'HEX' && 'Hexadecimal encoded byte stream'}
                    {selectedEntry.alphabet === 'BINARY_BLOB' && 'Non-printable binary bytes with escape codes'}
                    {selectedEntry.alphabet === 'ASCII_PRINTABLE' && 'Standard readable ASCII printable character range'}
                    {selectedEntry.alphabet === 'CUSTOM' && 'Custom symbol distribution table'}
                  </p>
                </div>
              </div>

              {/* Decoded Plaintext Result */}
              {selectedEntry.decodedPlaintext && (
                <div className="bg-emerald-950/20 border border-emerald-800/50 rounded-lg p-4 font-mono">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Unlock className="w-4 h-4 text-emerald-400" />
                      Recovered Plaintext (Method: {selectedEntry.decodingMethod})
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      DECRYPTED
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded border border-emerald-900/60 text-emerald-200 text-xs break-all font-semibold">
                    {selectedEntry.decodedPlaintext}
                  </div>
                </div>
              )}

              {/* Character Distribution */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono">
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-3 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                  Character Frequency Distribution
                </h4>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(selectedEntry.characterDistribution).map(([char, count]) => (
                    <div
                      key={char}
                      className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 flex items-center gap-2"
                    >
                      <span className="text-cyan-400 font-bold">'{char}'</span>
                      <span className="text-slate-400 font-mono text-[11px]">{count}x</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* References in Code */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs">
                <h4 className="font-bold uppercase text-slate-400 mb-2">Source References</h4>
                <div className="flex flex-wrap gap-2 text-slate-400">
                  {selectedEntry.referencedBy.map((ref, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      {ref}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-xs">
              Select a string from the pool to inspect entropy and decoding
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
