/**
 * App root — Hermes Dashboard.
 * Phase 3 boots the shared Cloud backbone; section UI remains shell-owned.
 */

import { useEffect } from 'react';
import { ShellLayout } from '@/components/shell/ShellLayout';
import { shellStore } from '@/state/shellStore';
import { startBrowserBackbone, stopBrowserBackbone } from '@/state/backbone';
import { useConnectionStateValue } from '@/state/sessionConnectionStore';

export function App() {
  const connectionState = useConnectionStateValue();
  const overall = connectionState.value?.overall ?? 'unknown';

  useEffect(() => {
    startBrowserBackbone();
    return () => stopBrowserBackbone();
  }, []);

  useEffect(() => {
    shellStore.setConnection(overall);
  }, [overall]);

  return <ShellLayout />;
}
