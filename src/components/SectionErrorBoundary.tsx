"use client"

import { Component } from "react"

interface Props {
  children: React.ReactNode
  label?: string
}

interface State {
  error: Error | null
}

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="border border-danger/30 bg-surface rounded-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-danger/60 uppercase">
              ERRO
            </span>
            {this.props.label && (
              <span className="text-[9px] font-mono text-on-surface/30">{this.props.label}</span>
            )}
          </div>
          <pre className="text-[10px] font-mono text-danger/70 whitespace-pre-wrap break-all">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-2 h-6 px-3 text-[9px] font-mono font-semibold tracking-wider border border-teal text-teal rounded-sm hover:bg-teal/10 transition-colors"
          >
            TENTAR NOVAMENTE
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
