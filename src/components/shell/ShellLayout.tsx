/**
 * ShellLayout — responsive root frame for the first-screen trio.
 *
 * Desktop / wide (≥1200px):
 *   Office center (dominant), chat left, ops right.
 *
 * Tablet / medium (768–1199px):
 *   Office primary, chat docked left, ops as compressed strip.
 *
 * Mobile / narrow (<768px):
 *   Segmented nav: one panel at a time. Mission bar always shows
 *   connection + highest-risk state.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { PrimaryView } from '@/types';
import { useShellState, shellStore } from '@/state/shellStore';
import { MissionBar } from '@/components/shell/MissionBar';
import { OfficePanel } from '@/components/shell/OfficePanel';
import { ChatPanel } from '@/components/shell/ChatPanel';
import { OpsPanel } from '@/components/shell/OpsPanel';
import { UnifiedAdminSurface } from '@/components/admin/UnifiedAdminSurface';
import { ProjectControlSurface } from '@/components/kanban/ProjectControlSurface';
import { FloatingChatOverlay } from '@/components/shell/FloatingChatOverlay';

type Breakpoint = 'wide' | 'medium' | 'narrow';

function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(getBp());

  useEffect(() => {
    const mqWide = window.matchMedia('(min-width: 1200px)');
    const mqMed = window.matchMedia('(min-width: 768px)');

    function update() {
      setBp(getBp());
    }

    mqWide.addEventListener('change', update);
    mqMed.addEventListener('change', update);
    return () => {
      mqWide.removeEventListener('change', update);
      mqMed.removeEventListener('change', update);
    };
  }, []);

  return bp;
}

function getBp(): Breakpoint {
  if (typeof window === 'undefined') return 'wide';
  const w = window.innerWidth;
  if (w >= 1200) return 'wide';
  if (w >= 768) return 'medium';
  return 'narrow';
}

export function ShellLayout() {
  const { view } = useShellState();
  const bp = useBreakpoint();

  return (
    <div className="shell-root">
      <MissionBar />
      <main className="shell-main">
        {bp === 'wide' && <WideLayout view={view} />}
        {bp === 'medium' && <MediumLayout view={view} />}
        {bp === 'narrow' && <NarrowLayout view={view} />}
      </main>
      {/* Floating chat bubble overlay — one mount, available across all views
          except the docked chat view (avoids duplicate surfaces). Ported from
          the Hermes dashboard TUI plugin; reuses the shared ChatPanel. */}
      <FloatingChatOverlay />
    </div>
  );
}

/* ── Wide: office center (~50%), chat left (~26%), ops right (~24%) ── */
function WideLayout({ view }: { view: PrimaryView }) {
  if (view === 'admin') {
    return (
      <PanelFrame label="Admin" active accent="var(--accent-violet)" enter="fade-in">
        <UnifiedAdminSurface />
      </PanelFrame>
    );
  }

  if (view === 'kanban') {
    return (
      <PanelFrame label="Project Control" active accent="var(--accent-amber)" enter="fade-in">
        <ProjectControlSurface />
      </PanelFrame>
    );
  }

  return (
    <div
      className="shell-grid shell-grid-wide"
    >
      <PanelFrame label="Chat" enter="slide-in-left">
        <ChatPanel />
      </PanelFrame>
      <Divider />
      <PanelFrame label="Office" active accent="var(--accent-cyan)" enter="fade-in">
        <OfficePanel />
      </PanelFrame>
      <Divider />
      <PanelFrame label="Telemetry" enter="slide-in-right">
        <OpsPanel />
      </PanelFrame>
    </div>
  );
}

/* ── Medium: office primary, chat docked, ops compressed ── */
function MediumLayout({ view }: { view: PrimaryView }) {
  if (view === 'admin') {
    return (
      <PanelFrame label="Admin" active accent="var(--accent-violet)" enter="fade-in">
        <UnifiedAdminSurface />
      </PanelFrame>
    );
  }

  if (view === 'kanban') {
    return (
      <PanelFrame label="Project Control" active accent="var(--accent-amber)" enter="fade-in">
        <ProjectControlSurface />
      </PanelFrame>
    );
  }

  return (
    <div
      className="shell-grid shell-grid-medium"
    >
      <PanelFrame label="Chat" enter="slide-in-left">
        <ChatPanel />
      </PanelFrame>
      <Divider />
      <PanelFrame label="Office" active accent="var(--accent-cyan)" enter="fade-in">
        <OfficePanel />
        {/* Ops compressed strip at the bottom */}
        <div className="shell-ops-dock">
          <OpsPanel />
        </div>
      </PanelFrame>
    </div>
  );
}

/* ── Narrow: one panel at a time via segmented nav ── */
function NarrowLayout({ view }: { view: PrimaryView }) {
  return (
    <div className="shell-narrow">
      <SegmentedNav view={view} />
      <div className="shell-narrow-stage">
        {view === 'office' && (
          <PanelFrame label="Office" active accent="var(--accent-cyan)" enter="fade-in">
            <OfficePanel />
          </PanelFrame>
        )}
        {view === 'chat' && (
          <PanelFrame label="Chat" enter="slide-in-left">
            <ChatPanel />
          </PanelFrame>
        )}
        {view === 'ops' && (
          <PanelFrame label="Telemetry" enter="slide-in-right">
            <OpsPanel />
          </PanelFrame>
        )}
        {view === 'admin' && (
          <PanelFrame label="Admin" active accent="var(--accent-violet)" enter="fade-in">
            <UnifiedAdminSurface />
          </PanelFrame>
        )}
        {view === 'kanban' && (
          <PanelFrame label="Project Control" active accent="var(--accent-amber)" enter="fade-in">
            <ProjectControlSurface />
          </PanelFrame>
        )}
      </div>
    </div>
  );
}

function SegmentedNav({ view }: { view: PrimaryView }) {
  const items: { id: PrimaryView; label: string }[] = [
    { id: 'office', label: 'Office' },
    { id: 'chat', label: 'Chat' },
    { id: 'ops', label: 'Telemetry' },
    { id: 'admin', label: 'Control' },
    { id: 'kanban', label: 'Kanban' },
  ];
  return (
    <div className="shell-segmented-nav">
      {items.map((item) => {
        const active = view === item.id;
        return (
          <button
            key={item.id}
            onClick={() => shellStore.setView(item.id)}
            className={`nav-tab${active ? ' nav-tab-active' : ''}`}
            data-active={active ? 'true' : 'false'}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Shared panel frame wrapper ── */
function PanelFrame({
  children,
  label,
  active = false,
  accent,
  enter,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  accent?: string;
  /** One-shot entrance animation class. Runs once on mount; compositor-only
   *  (opacity + transform) so it never triggers layout or paint on siblings. */
  enter?: 'fade-in' | 'slide-in-left' | 'slide-in-right';
}) {
  const enterClass =
    enter === 'fade-in'
      ? 'animate-fade-in'
      : enter === 'slide-in-left'
        ? 'animate-slide-in-left'
        : enter === 'slide-in-right'
          ? 'animate-slide-in-right'
          : '';
  return (
    <div
      aria-label={label}
      data-active={active ? 'true' : 'false'}
      className={`shell-panel ${enterClass}`}
      style={
        {
          '--panel-accent': accent ?? 'var(--border-active)',
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div className="shell-divider" />;
}