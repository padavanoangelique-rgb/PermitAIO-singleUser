import Stripe from "stripe";
import { HttpsProxyAgent } from "https-proxy-agent";

/**
 * Sandbox-only HTTP client used when this app is running inside the
 * Perplexity Computer dev sandbox with a saved custom credential for
 * api.stripe.com attached to a long-running server process (via
 * start_server). That mechanism injects CUSTOM_CRED_API_STRIPE_COM_URL /
 * CUSTOM_CRED_API_STRIPE_COM_TOKEN instead of HTTPS_PROXY, so requests must
 * be re-pointed at the passthrough URL with an x-api-key header rather than
 * sent directly to api.stripe.com. This class never runs in production —
 * those env vars only exist inside the sandbox.
 */
class CustomCredPassthroughHttpClient extends Stripe.HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {
    super();
  }

  getClientName() {
    return "custom-cred-passthrough";
  }

  async makeRequest(
    _host: string,
    _port: string,
    path: string,
    method: string,
    headers: Record<string, string | number | string[]>,
    requestData: string,
    _protocol: string,
    timeout: number,
  ) {
    const url = `${this.baseUrl.replace(/\/$/, "")}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const stringHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      stringHeaders[k] = Array.isArray(v) ? v.join(", ") : String(v);
    }
    try {
      const res = await fetch(url, {
        method,
        headers: { ...stringHeaders, "x-api-key": this.token },
        body: method === "POST" || method === "PUT" || method === "PATCH" ? requestData || "" : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      const statusCode = res.status;
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => (responseHeaders[k] = v));
      return {
        getStatusCode: () => statusCode,
        getHeaders: () => responseHeaders,
        getRawResponse: () => res,
        toStream: (cb: () => void) => {
          cb();
          return res.body as unknown;
        },
        toJSON: async () => JSON.parse(text),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Singleton Stripe server client. STRIPE_SECRET_KEY must be set in the
 * environment (Vercel project settings in production, .env.local in dev).
 * Test-mode keys start with sk_test_, live-mode keys with sk_live_.
 *
 * In the local sandbox, requests to api.stripe.com are routed either through
 * an authenticated HTTPS proxy (HTTPS_PROXY, used by one-shot commands) or
 * through a custom-credential passthrough URL (CUSTOM_CRED_API_STRIPE_COM_URL,
 * used by long-running servers started via start_server) so the real secret
 * key never has to be typed or stored locally — the proxy injects the saved
 * credential. In production (Vercel) neither of these env vars exist and the
 * SDK talks to Stripe directly using the real STRIPE_SECRET_KEY.
 */
function getStripeClient(): Stripe {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  const passthroughUrl = process.env.CUSTOM_CRED_API_STRIPE_COM_URL;
  const passthroughToken = process.env.CUSTOM_CRED_API_STRIPE_COM_TOKEN;
  const sandboxMode = Boolean(proxyUrl || (passthroughUrl && passthroughToken));
  const key = process.env.STRIPE_SECRET_KEY || (sandboxMode ? "sk_test_proxy_injected" : undefined);

  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to your environment to enable billing.",
    );
  }

  if (process.env.STRIPE_SECRET_KEY) {
    // Production / real key path — talk to Stripe directly.
    return new Stripe(key);
  }

  if (passthroughUrl && passthroughToken) {
    return new Stripe(key, {
      httpClient: new CustomCredPassthroughHttpClient(passthroughUrl, passthroughToken),
    });
  }

  // Let the SDK pin its own default API version (matches installed SDK
  // version 22.5.0) rather than hardcoding one that may drift out of sync.
  return new Stripe(key, proxyUrl ? { httpAgent: new HttpsProxyAgent(proxyUrl) } : {});
}

let cached: Stripe | null = null;

export function stripe(): Stripe {
  if (!cached) cached = getStripeClient();
  return cached;
}
