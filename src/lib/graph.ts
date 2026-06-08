// ------------------------------------------------------------------
// Microsoft Graph client (app-only / client credentials flow).
// Used for sending email notifications and for OneDrive/SharePoint
// file storage. Returns null when not configured so callers can fall
// back to local drivers.
// ------------------------------------------------------------------

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

type TokenCache = { token: string; expiresAt: number } | null;
let tokenCache: TokenCache = null;

function graphConfig() {
  const tenantId = process.env.GRAPH_TENANT_ID || process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID || process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const clientSecret =
    process.env.GRAPH_CLIENT_SECRET || process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
  if (!tenantId || !clientId || !clientSecret) return null;
  return { tenantId, clientId, clientSecret };
}

export function isGraphConfigured(): boolean {
  return graphConfig() !== null;
}

async function getAppToken(): Promise<string | null> {
  const cfg = graphConfig();
  if (!cfg) return null;
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`,
    { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  if (!res.ok) {
    console.error("Graph token error", await res.text());
    return null;
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

/** Low-level authenticated Graph fetch. Throws if not configured. */
export async function graphFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAppToken();
  if (!token) throw new Error("Microsoft Graph is not configured");
  return fetch(`${GRAPH_ROOT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}
