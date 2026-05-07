'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary: ${this.props.label ?? 'unknown'}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="material-symbols-outlined text-3xl text-outline">broken_image</span>
          <p className="text-sm font-black text-on-surface">
            {this.props.label ?? 'This section'} failed to load
          </p>
          <p className="text-[10px] text-outline font-semibold max-w-xs leading-relaxed">
            {this.state.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="mt-1 px-4 h-8 rounded-lg text-[9px] font-black uppercase tracking-widest bg-surface-container-highest/40 text-outline hover:text-on-surface transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
