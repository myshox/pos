import React from 'react';
import { useLocale } from '../context/LocaleContext';

function ErrorFallback({ error }) {
  const { t } = useLocale();
  return (
    <div style={{ padding: 24, fontFamily: 'var(--font-cute)' }}>
      <h1 style={{ color: '#b91c1c' }}>{t('errorTitle')}</h1>
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
