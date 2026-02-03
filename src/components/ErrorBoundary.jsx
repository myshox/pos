import React from 'react';

// 不使用 useLocale，避免在 context 未就緒時（例如 useLocale 拋錯）錯誤畫面再次拋錯
const ERROR_TITLE = '頁面發生錯誤';

function ErrorFallback({ error }) {
  return (
    <div style={{ padding: 24, fontFamily: 'var(--font-cute)' }}>
      <h1 style={{ color: '#b91c1c' }}>{ERROR_TITLE}</h1>
      <pre style={{ background: '#fef2f2', padding: 16, overflow: 'auto' }}>
        {error?.message || String(error)}
      </pre>
    </div>
  );
}

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
