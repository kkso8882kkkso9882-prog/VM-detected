import React from 'react';
import { AlertOctagon, RefreshCw, Terminal } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Uncaught error in Luau VM Static Analyzer:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleReset = (): void => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="max-w-2xl w-full bg-slate-900 border border-rose-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-rose-950/50">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                <AlertOctagon className="w-8 h-8 text-rose-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-mono tracking-tight text-white">
                  Luau VM Static Analyzer
                </h1>
                <p className="text-xs text-rose-400 font-mono font-medium">
                  Runtime Exception Caught by ErrorBoundary
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-6 font-mono text-xs text-rose-300 overflow-x-auto">
              <p className="font-semibold text-rose-400 mb-1">
                {this.state.error?.name || 'Error'}: {this.state.error?.message || 'An unexpected error occurred.'}
              </p>
              {this.state.error?.stack && (
                <pre className="text-[11px] text-slate-400 leading-relaxed mt-2 whitespace-pre-wrap">
                  {this.state.error.stack}
                </pre>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Base Path: /VM-detected/</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={this.handleReset}
                  className="px-4 py-2 text-xs font-semibold font-mono text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                >
                  Clear Cache & Reset
                </button>
                <button
                  onClick={this.handleReload}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold font-mono text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-lg shadow-cyan-950 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reload Application</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
