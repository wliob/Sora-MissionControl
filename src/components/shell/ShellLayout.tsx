/**
 * ShellLayout — Hermes dashboard shell rebuild for the accepted /kanban slice.
 *
 * The left rail owns IA/navigation, the header only carries page context, and
 * the kanban route embeds the office panel instead of making it the dominant
 * stage. Unknown routes are normalized back to /kanban for this reset card.
 */

import { useEffect, useMemo, useState } from 'react';
import { FloatingChatOverlay } from '@/components/shell/FloatingChatOverlay';
import { MissionBar } from '@/components/shell/MissionBar';
import { ChatPanel } from '@/components/shell/ChatPanel';
import { OpsPanel } from '@/components/shell/OpsPanel';
import { AttentionWidget } from '@/components/shell/AttentionWidget';
import { HermesKanbanPage } from '@/components/kanban/HermesKanbanPage';
import { TeamPage } from '@/pages/Team';
import { OfficePage } from '@/pages/Office';
import { ActivityPage } from '@/pages/Activity';
import { ProjectsPage } from '@/pages/Projects';
import { DecisionsPage } from '@/pages/Decisions';
import { CalendarPage } from '@/pages/Calendar';
import { shellStore, useShellState } from '@/state/shellStore';
import { useAuthSessionState, useConnectionStateValue } from '@/state/sessionConnectionStore';

const PROFILE_ITEMS = [
  'this dashboard (default)',
  'biscuit',
  'cloud',
  'korra',
  'lelouch',
  'rain',
  'tifa',
] as const;

const CORE_ROUTES = [
  { id: 'team', label: 'TEAM', path: '/team', view: 'team' as const, title: 'Team' },
  { id: 'office', label: 'OFFICE', path: '/office', view: 'office' as const, title: 'Office' },
  { id: 'activity', label: 'ACTIVITY', path: '/activity', view: 'ops' as const, title: 'Activity' },
  { id: 'projects', label: 'PROJECTS', path: '/projects', view: 'ops' as const, title: 'Projects' },
  { id: 'decisions', label: 'DECISIONS', path: '/decisions', view: 'ops' as const, title: 'Decisions' },
  { id: 'calendar', label: 'CALENDAR', path: '/calendar', view: 'ops' as const, title: 'Calendar' },
  { id: 'chat', label: 'CHAT', path: '/chat', view: 'chat' as const, title: 'Chat' },
  { id: 'sessions', label: 'SESSIONS', path: '/sessions', view: 'admin' as const, title: 'Sessions' },
  { id: 'files', label: 'FILES', path: '/files', view: 'admin' as const, title: 'Files' },
  { id: 'models', label: 'MODELS', path: '/models', view: 'admin' as const, title: 'Models' },
  { id: 'logs', label: 'LOGS', path: '/logs', view: 'admin' as const, title: 'Logs' },
  { id: 'cron', label: 'CRON', path: '/cron', view: 'admin' as const, title: 'Cron' },
  { id: 'skills', label: 'SKILLS', path: '/skills', view: 'admin' as const, title: 'Skills' },
  { id: 'plugins', label: 'PLUGINS', path: '/plugins', view: 'admin' as const, title: 'Plugins' },
  { id: 'mcp', label: 'MCP', path: '/mcp', view: 'admin' as const, title: 'MCP' },
  { id: 'channels', label: 'CHANNELS', path: '/channels', view: 'admin' as const, title: 'Channels' },
  { id: 'webhooks', label: 'WEBHOOKS', path: '/webhooks', view: 'admin' as const, title: 'Webhooks' },
  { id: 'pairing', label: 'PAIRING', path: '/pairing', view: 'admin' as const, title: 'Pairing' },
  { id: 'profiles', label: 'PROFILES', path: '/profiles', view: 'admin' as const, title: 'Profiles' },
  { id: 'config', label: 'CONFIG', path: '/config', view: 'admin' as const, title: 'Config' },
  { id: 'keys', label: 'KEYS', path: '/keys', view: 'admin' as const, title: 'Keys' },
  { id: 'system', label: 'SYSTEM', path: '/system', view: 'admin' as const, title: 'System' },
  { id: 'documentation', label: 'DOCUMENTATION', path: '/documentation', view: 'admin' as const, title: 'Documentation' },
] as const;

const PLUGIN_ROUTES = [
  { id: 'kanban', label: 'KANBAN', path: '/kanban', view: 'kanban' as const, title: 'Kanban' },
  { id: 'achievements', label: 'ACHIEVEMENTS', path: '/achievements', view: 'ops' as const, title: 'Achievements' },
] as const;

const ALL_ROUTES = [...CORE_ROUTES, ...PLUGIN_ROUTES];
type DashboardRoute = (typeof ALL_ROUTES)[number];
type AcceptedPath = DashboardRoute['path'];
const ACCEPTED_PATHS = new Set<string>(ALL_ROUTES.map((route) => route.path));

function normalizeRoutePath(pathname: string): AcceptedPath {
  if (pathname === '/' || !ACCEPTED_PATHS.has(pathname)) return '/team';
  return pathname as AcceptedPath;
}

function routeForPath(pathname: string): DashboardRoute {
  return ALL_ROUTES.find((route) => route.path === normalizeRoutePath(pathname)) ?? CORE_ROUTES[0];
}

function navigateTo(path: string, replace = false) {
  if (typeof window === 'undefined') return;
  const target = normalizeRoutePath(path);
  const nextUrl = `${target}${window.location.search}${window.location.hash}`;
  if (replace) window.history.replaceState({}, '', nextUrl);
  else window.history.pushState({}, '', nextUrl);
}

function statusLabel(overall: string): string {
  if (overall === 'connected') return 'Running';
  if (overall === 'degraded') return 'Degraded';
  if (overall === 'offline') return 'Offline';
  if (overall === 'unauthorized') return 'Locked';
  return 'Unknown';
}

function authGuidanceLabel(overall: string): string | null {
  if (overall !== 'unauthorized') return null;
  return 'Hermes session missing — use /login for Kanban data. Admin proxy token only unlocks Systems panels.';
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="dashboard-placeholder-card">
      <div className="dashboard-placeholder-eyebrow mono">HERMES SURFACE</div>
      <h2>{title}</h2>
      <p>
        This reset slice only accepts the Hermes /kanban shell rebuild. The surrounding information architecture is now faithful,
        but this page remains a truthful placeholder until its feature pass lands.
      </p>
    </section>
  );
}

export function ShellLayout() {
  const shell = useShellState();
  const authSession = useAuthSessionState();
  const connectionState = useConnectionStateValue();
  const [pathname, setPathname] = useState(() =>
    typeof window === 'undefined' ? '/team' : normalizeRoutePath(window.location.pathname),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const normalized = normalizeRoutePath(window.location.pathname);
    if (normalized !== window.location.pathname) {
      navigateTo(normalized, true);
    }
    setPathname(normalized);

    const onPopstate = () => {
      const nextPath = normalizeRoutePath(window.location.pathname);
      if (nextPath !== window.location.pathname) {
        navigateTo(nextPath, true);
      }
      setPathname(nextPath);
    };

    window.addEventListener('popstate', onPopstate);
    return () => window.removeEventListener('popstate', onPopstate);
  }, []);

  const activeRoute = useMemo(() => routeForPath(pathname), [pathname]);

  useEffect(() => {
    shellStore.setView(activeRoute.view);
  }, [activeRoute.view]);

  const activeProfile = shell.selectedOwner ?? PROFILE_ITEMS[0];
  const gatewayState = statusLabel(connectionState.value?.overall ?? 'unknown');
  const authGuidance = authGuidanceLabel(connectionState.value?.overall ?? 'unknown');
  const activeSessionsLabel = authSession.value?.status === 'authenticated' ? '1' : 'unknown';

  function handleRouteChange(path: string) {
    navigateTo(path);
    setPathname(normalizeRoutePath(path));
  }

  return (
    <div className="shell-root dashboard-shell-root" data-shell-view={shell.view}>
      <aside className="dashboard-rail" aria-label="Navigation">
        <div className="dashboard-brand-lockup">
          <div className="dashboard-brand-wordmark">HERMES</div>
          <div className="dashboard-brand-wordmark dashboard-brand-submark">AGENT</div>
        </div>

        <div className="dashboard-profile-block">
          {PROFILE_ITEMS.map((profile) => {
            const active = profile === activeProfile;
            return (
              <button
                key={profile}
                type="button"
                className="dashboard-profile-button"
                data-active={active}
                onClick={() => shellStore.setSelectedOwner(profile)}
              >
                {profile}
              </button>
            );
          })}
        </div>

        <nav className="dashboard-nav-group" aria-label="Core Hermes navigation">
          {CORE_ROUTES.map((route) => {
            const active = route.path === activeRoute.path;
            return (
              <button
                key={route.id}
                type="button"
                className="dashboard-nav-button"
                data-active={active}
                onClick={() => handleRouteChange(route.path)}
              >
                {route.label}
              </button>
            );
          })}
        </nav>

        <nav className="dashboard-nav-group dashboard-nav-group-plugins" aria-label="Plugin Hermes navigation">
          {PLUGIN_ROUTES.map((route) => {
            const active = route.path === activeRoute.path;
            return (
              <button
                key={route.id}
                type="button"
                className="dashboard-nav-button"
                data-active={active}
                onClick={() => handleRouteChange(route.path)}
              >
                {route.label}
              </button>
            );
          })}
        </nav>

        <div className="dashboard-footer-block mono">
          <div>Gateway Status: {gatewayState}</div>
          <div>Active Sessions: {activeSessionsLabel}</div>
          {authGuidance && <div className="dashboard-footer-auth-hint">{authGuidance}</div>}
          <div className="dashboard-footer-actions">
            <button type="button" className="dashboard-footer-button">Theme Switch</button>
            <button type="button" className="dashboard-footer-button">Language Switch</button>
          </div>
        </div>
      </aside>

      <section className="dashboard-stage">
        <MissionBar title={activeRoute.title} />
        <main className="dashboard-main-frame">
          <AttentionWidget />
          {activeRoute.id === 'team' ? (
            <TeamPage />
          ) : activeRoute.id === 'office' ? (
            <OfficePage />
          ) : activeRoute.id === 'kanban' ? (
            <HermesKanbanPage />
          ) : activeRoute.id === 'chat' ? (
            <ChatPanel />
          ) : activeRoute.id === 'activity' ? (
            <ActivityPage />
          ) : activeRoute.id === 'projects' ? (
            <ProjectsPage />
          ) : activeRoute.id === 'decisions' ? (
            <DecisionsPage />
          ) : activeRoute.id === 'calendar' ? (
            <CalendarPage />
          ) : activeRoute.id === 'achievements' ? (
            <OpsPanel />
          ) : (
            <PlaceholderPage title={activeRoute.title} />
          )}
        </main>
      </section>

      <FloatingChatOverlay />
    </div>
  );
}
