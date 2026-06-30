/** @vitest-environment jsdom */
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { ShellLayout } from './ShellLayout';
import { shellStore } from '@/state/shellStore';
import { boardStore } from '@/state/boardStore';
import { _resetForTest as resetProjectControlStore } from '@/state/projectControlStore';
import { _resetForTest as resetSessionConnectionStore, sessionConnectionStore } from '@/state/sessionConnectionStore';

vi.mock('@/components/shell/OfficePanel', () => ({
  OfficePanel: () => <div data-office-panel="phase-2">office-panel</div>,
}));

vi.mock('@/office/components/OfficeModule', () => ({
  OfficeModule: () => <div data-office-module="phase-2">office-module</div>,
}));

vi.mock('@/office/components/ConductorStation', () => ({
  ConductorStation: () => <div data-conductor-station="phase-2">conductor-station</div>,
}));

vi.mock('@/components/shell/ChatPanel', () => ({
  ChatPanel: () => <div>chat-panel</div>,
}));

vi.mock('@/components/shell/OpsPanel', () => ({
  OpsPanel: () => <div>ops-panel</div>,
}));

vi.mock('@/components/admin/UnifiedAdminSurface', () => ({
  UnifiedAdminSurface: () => <div>admin-surface</div>,
}));

vi.mock('@/components/shell/FloatingChatOverlay', () => ({
  FloatingChatOverlay: () => null,
}));

function renderShell() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ShellLayout />);
  });
  return {
    container,
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function clickButton(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll('button')]
    .find((candidate) => candidate.textContent === label);
  expect(button).toBeDefined();
  act(() => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function headerText(container: HTMLElement): string {
  return container.querySelector('header[role="banner"]')?.textContent ?? '';
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  boardStore._resetForTest();
  resetProjectControlStore();
  resetSessionConnectionStore();
  shellStore.setView('kanban');
  shellStore.setSelectedAgent(null);
  shellStore.setSelectedOwner(null);
  shellStore.setConnection('unknown');
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/kanban');
});

describe('ShellLayout Hermes kanban shell', () => {
  it('renders the Hermes dashboard rail/header contract and embeds the office panel on /kanban', () => {
    const view = renderShell();

    const text = view.container.textContent ?? '';
    expect(text).toContain('HERMES');
    expect(text).toContain('AGENT');
    expect(text).toContain('this dashboard (default)');
    expect(text).not.toContain('Sora Mission Control');

    const navigation = view.container.querySelector('aside[aria-label="Navigation"]');
    expect(navigation).not.toBeNull();

    expect(text).toContain('CHAT');
    expect(text).toContain('SESSIONS');
    expect(text).toContain('FILES');
    expect(text).toContain('MODELS');
    expect(text).toContain('LOGS');
    expect(text).toContain('CRON');
    expect(text).toContain('SKILLS');
    expect(text).toContain('PLUGINS');
    expect(text).toContain('MCP');
    expect(text).toContain('CHANNELS');
    expect(text).toContain('WEBHOOKS');
    expect(text).toContain('PAIRING');
    expect(text).toContain('PROFILES');
    expect(text).toContain('CONFIG');
    expect(text).toContain('KEYS');
    expect(text).toContain('SYSTEM');
    expect(text).toContain('DOCUMENTATION');
    expect(text).toContain('KANBAN');
    expect(text).toContain('ACHIEVEMENTS');

    const header = view.container.querySelector('header[role="banner"]');
    expect(header?.textContent).toContain('Kanban');

    expect(text).toContain('Board');
    expect(text).toContain('Orchestration:');
    expect(text).toContain('SEARCH');
    expect(text).toContain('TENANT');
    expect(text).toContain('ASSIGNEE');
    expect(text).toContain('Refresh');
    expect(text).toContain('Clear filters');

    expect(view.container.querySelector('main [data-office-panel="phase-2"]')).not.toBeNull();
    expect(view.container.querySelector('[data-shell-route="kanban"]')).not.toBeNull();

    view.unmount();
  });

  it('normalizes the root route to /team as the default command surface', () => {
    window.history.replaceState({}, '', '/');
    const view = renderShell();

    expect(window.location.pathname).toBe('/team');
    expect(headerText(view.container)).toContain('Team');
    expect(view.container.querySelector('.team-page')).not.toBeNull();

    view.unmount();
  });

  it('navigates implemented rail routes to real URL paths and visible pages', () => {
    window.history.replaceState({}, '', '/team');
    const view = renderShell();

    clickButton(view.container, 'OFFICE');
    expect(window.location.pathname).toBe('/office');
    expect(headerText(view.container)).toContain('Office');
    expect(view.container.querySelector('[data-office-module="phase-2"]')).not.toBeNull();

    clickButton(view.container, 'CHAT');
    expect(window.location.pathname).toBe('/chat');
    expect(headerText(view.container)).toContain('Chat');
    expect(view.container.textContent).toContain('chat-panel');

    clickButton(view.container, 'CALENDAR');
    expect(window.location.pathname).toBe('/calendar');
    expect(headerText(view.container)).toContain('Calendar');
    expect(view.container.textContent).toContain('Calendar unavailable');

    clickButton(view.container, 'KANBAN');
    expect(window.location.pathname).toBe('/kanban');
    expect(headerText(view.container)).toContain('Kanban');
    expect(view.container.querySelector('[data-shell-route="kanban"]')).not.toBeNull();

    view.unmount();
  });

  it('explains that Locked is a Hermes session problem, not the admin proxy token', () => {
    sessionConnectionStore.updateSourceHealth('kanban-rest', {
      state: 'unauthorized',
      lastOkAt: null,
      lastCheckedAt: new Date('2026-06-29T19:00:00.000Z').toISOString(),
      error: 'no_cookie',
    });

    const view = renderShell();
    const text = view.container.textContent ?? '';

    expect(text).toContain('Gateway Status: Locked');
    expect(text).toContain('Hermes session missing');
    expect(text).toContain('use /login for Kanban data');
    expect(text).toContain('Admin proxy token only unlocks Systems panels');

    view.unmount();
  });
});
