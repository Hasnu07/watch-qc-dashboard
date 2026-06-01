'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 py-16 text-center">
          <p className="text-lg font-semibold text-ink mb-2">
            {this.props.fallbackTitle ?? 'Something went wrong loading this page'}
          </p>
          <p className="text-sm text-muted max-w-md mb-6">
            Try refreshing. If it keeps happening, sign out and back in.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { this.setState({ error: null }) }}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
