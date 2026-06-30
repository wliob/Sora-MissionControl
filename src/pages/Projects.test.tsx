/** @vitest-environment jsdom */
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

import type { Project, ProjectsStoreState } from '@/types/projects';

const mockUseProjectsState = vi.fn<() => ProjectsStoreState>();

vi.mock('@/state/projectsStore', () => ({
  get useProjectsState() {
    return mockUseProjectsState;
  },
}));

import { ProjectsPage } from './Projects';

function renderProjects() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ProjectsPage />);
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

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '';
});

describe('Projects page', () => {
  it('renders empty state when store has no projects', () => {
    mockUseProjectsState.mockReturnValue({
      projects: [],
      freshness: 'live',
    });

    const view = renderProjects();

    expect(view.container.querySelector('.projects-empty-state')).not.toBeNull();
    expect(view.container.textContent).toContain('No projects tracked');
    expect(view.container.querySelector('.freshness-badge--live')).not.toBeNull();

    view.unmount();
  });

  it('renders unavailable state when freshness is missing', () => {
    mockUseProjectsState.mockReturnValue({
      projects: [],
      freshness: 'missing',
    });

    const view = renderProjects();

    expect(view.container.querySelector('.freshness-badge--unavailable')).not.toBeNull();
    expect(view.container.textContent).toContain('Project data unavailable');
    expect(view.container.textContent).toContain('OFFLINE');

    view.unmount();
  });

  it('renders project cards with status badges', () => {
    const projects: Project[] = [
      {
        id: 'Sora-MissionControl',
        name: 'Sora-MissionControl',
        status: 'active',
        lead: 'biscuit',
        taskCount: 12,
        blockerCount: 1,
        lastActivity: '2026-06-29T14:30:00.000Z',
        freshness: 'live',
      },
      {
        id: 'homer-speak',
        name: 'Homer Speak',
        status: 'paused',
        lead: 'sora',
        taskCount: 5,
        blockerCount: 0,
        lastActivity: null,
        freshness: 'live',
      },
    ];

    mockUseProjectsState.mockReturnValue({
      projects,
      freshness: 'live',
    });

    const view = renderProjects();

    const cards = view.container.querySelectorAll('.project-card');
    expect(cards.length).toBe(2);

    expect(view.container.textContent).toContain('ACTIVE');
    expect(view.container.textContent).toContain('PAUSED');
    expect(view.container.textContent).toContain('Sora-MissionControl');
    expect(view.container.textContent).toContain('Homer Speak');
    expect(view.container.textContent).toContain('Biscuit');
    expect(view.container.textContent).toContain('Sora');
    expect(view.container.textContent).toContain('12 tasks');
    expect(view.container.textContent).toContain('[!] BLOCKERS: 1');

    view.unmount();
  });

  it('renders completed project with correct status badge', () => {
    const projects: Project[] = [
      {
        id: 'watermark-remover',
        name: 'Watermark Remover',
        status: 'completed',
        lead: 'korra',
        taskCount: 3,
        blockerCount: 0,
        lastActivity: '2026-01-01T00:00:00.000Z',
        freshness: 'live',
      },
    ];

    mockUseProjectsState.mockReturnValue({
      projects,
      freshness: 'live',
    });

    const view = renderProjects();

    expect(view.container.querySelector('.project-card')).not.toBeNull();
    expect(view.container.textContent).toContain('COMPLETED');
    expect(view.container.textContent).toContain('Korra');

    view.unmount();
  });

  it('handles unknown freshness gracefully', () => {
    mockUseProjectsState.mockReturnValue({
      projects: [],
      freshness: 'unknown' as 'missing',
    });

    const view = renderProjects();

    expect(view.container.querySelector('.freshness-badge--unknown')).not.toBeNull();

    view.unmount();
  });
});
