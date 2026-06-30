declare module '*missionControlProxy.js' {
  export function resolveProxyAuthConfig(options?: {
    authMode?: string;
    apiKey?: string;
  }): { required: boolean; token: string | null };

  export function isAdminProxyRequestAuthorized(args: {
    path: string;
    providedToken?: string | null;
    auth: { required: boolean; token: string | null };
  }): boolean;

  export function parseAuthList(text: string): Array<{
    id: string;
    provider: string;
    maskedSecret: string;
    active: boolean;
    note?: string;
  }>;

  export function parseCorsOriginList(value: string): string[];

  export function resolveCorsOrigin(args: {
    requestOrigin?: string | null;
    requestHost?: string;
    configuredOrigins?: string[];
  }): string | null;

  export function shouldTreatWebhookListAsUnavailable(text: string): boolean;

  export function planKeyMcpAction(action: Record<string, unknown>): {
    unsupported?: string;
    args?: string[];
  };

  export function planCwsAction(action: Record<string, unknown>): {
    unsupported?: string;
    args?: string[];
  };
}
