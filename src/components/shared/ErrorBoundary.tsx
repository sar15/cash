'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex h-[60vh] flex-col items-center justify-center px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#FECACA] bg-[#FEF2F2]">
            <AlertTriangle className="h-7 w-7 text-[#DC2626]" />
          </div>
          <h2 className="mt-5 text-base font-semibold text-[#0F172A]">Something went wrong</h2>
          <p className="mt-2 max-w-sm text-sm text-[#64748B]">
            {this.state.error?.message ?? 'An unexpected error occurred. Please try refreshing the page.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#475569] transition-colors hover:border-[#CBD5E1]"
          >
            <RefreshCw className="h-4 w-4" />
            Reload page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
