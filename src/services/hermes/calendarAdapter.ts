/**
 * Calendar data adapter — fetches calendar events from the Hermes admin proxy.
 *
 * Uses the same session-only token pattern as adminProxyAdapter.ts.
 * Follows existing adapter conventions from dashboardClient.ts and
 * projectControlAdapter.ts.
 */

import type { CalendarEvent } from '@/types/calendar';
import { pushCalendarEvent, pushCalendarWarning, setCalendarFreshness } from '@/state/calendarStore';
import { getActiveAdminProxyToken, resolveAdminProxyBaseUrl } from '@/services/hermes/adminProxyAdapter';
import type { Freshness } from '@/types';

interface CalendarApiResponse {
  events: CalendarEvent[];
  warnings: string[];
  freshness: string;
  source: string;
}

function defaultProxyUrl(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3187';
  return resolveAdminProxyBaseUrl(window.location, window.__SORA_ADMIN_PROXY_URL__);
}

/**
 * Fetch calendar events from the admin proxy and push them into the
 * calendarStore. Handles partial/failed responses with honest freshness.
 */
export async function refreshCalendarFromProxy(
  baseUrl?: string,
  token?: string | null,
): Promise<void> {
  const resolvedBaseUrl = (baseUrl ?? defaultProxyUrl()).replace(/\/+$/, '');
  const resolvedToken = token ?? getActiveAdminProxyToken();

  try {
    const headers = new Headers({ Accept: 'application/json' });
    if (resolvedToken) {
      headers.set('X-Mission-Control-Key', resolvedToken);
    }

    const response = await fetch(`${resolvedBaseUrl}/admin/calendar/events`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      setCalendarFreshness('missing');
      pushCalendarWarning('Calendar data source unreachable');
      return;
    }

    const data: CalendarApiResponse = await response.json();

    // Push each event
    for (const event of data.events) {
      pushCalendarEvent(event);
    }

    // Push each warning
    for (const warning of data.warnings) {
      pushCalendarWarning(warning);
    }

    setCalendarFreshness(data.freshness as Freshness);
  } catch (error) {
    setCalendarFreshness('missing');
    const message = error instanceof Error ? error.message : String(error);
    pushCalendarWarning(`Calendar refresh failed: ${message}`);
  }
}
