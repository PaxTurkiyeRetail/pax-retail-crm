'use client';

import type React from 'react';
import AppRuntimeBoundary from '@/components/AppRuntimeBoundary';
import AppToaster from '@/components/AppToaster';
import AppRouteProgress from '@/components/AppRouteProgress';

export default function AppRuntimeShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppRouteProgress />
      <AppRuntimeBoundary>{children}</AppRuntimeBoundary>
      <AppToaster />
    </>
  );
}
