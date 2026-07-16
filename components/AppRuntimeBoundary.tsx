'use client';

import React from 'react';
import { appToast } from '@/lib/app-toast';

type State = {
  hasError: boolean;
  message: string;
};

export default class AppRuntimeBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Beklenmeyen bir sayfa hatası oluştu.',
    };
  }

  componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : 'Beklenmeyen bir sayfa hatası oluştu.';
    appToast.error('Sayfa hatası', message, 9000);
  }

  reset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="app-runtime-error" role="alert">
        <section className="app-runtime-error-card">
          <div className="app-runtime-error-badge">!</div>
          <div>
            <h1>Sayfa yüklenirken hata oluştu</h1>
            <p>{this.state.message || 'İşlem tamamlanamadı. Sayfayı yenileyip tekrar deneyebilirsin.'}</p>
          </div>
          <div className="app-runtime-error-actions">
            <button type="button" onClick={this.reset}>Tekrar dene</button>
            <button type="button" onClick={() => window.location.reload()}>Sayfayı yenile</button>
          </div>
        </section>
      </main>
    );
  }
}
