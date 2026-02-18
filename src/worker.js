const GIMKIT_ORIGIN = "https://www.gimkit.com";
const BUNDLE_SOURCE =
  "https://raw.githubusercontent.com/TheLazySquid/GimkitCheat/main/build/bundle.js";

let bundleCache = null;
let bundleCacheTime = 0;
const BUNDLE_TTL_MS = 5 * 60 * 1000;

async function getBundle() {
  const now = Date.now();
  if (bundleCache && now - bundleCacheTime < BUNDLE_TTL_MS) return bundleCache;

  const resp = await fetch(BUNDLE_SOURCE);
  if (!resp.ok) throw new Error("Failed to fetch bundle.js");
  const text = await resp.text();
  bundleCache = text;
  bundleCacheTime = now;
  return text;
}

function isAsset(pathname) {
  return /\.(png|jpg|jpeg|svg|webm|ico|gif|ttf|otf|atlas|woff|woff2|mp3|mp4|m4a)$/.test(
    pathname
  );
}

function isStaticLike(pathname) {
  return (
    pathname.endsWith(".js") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".json") ||
    pathname.startsWith("/pages/") ||
    pathname.startsWith("/api/")
  );
}

async function proxyRequest(request, url) {
  const headers = new Headers(request.headers);

  headers.set("origin", GIMKIT_ORIGIN);
  headers.set("referer", GIMKIT_ORIGIN + "/");

  const init = {
    method: request.method,
    headers,
    redirect: "manual"
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  return fetch(url, init);
}

function allowIframe(response) {
  const newHeaders = new Headers(response.headers);
  newHeaders.set("X-Frame-Options", "ALLOWALL");
  newHeaders.set("Content-Security-Policy", "frame-ancestors *");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // --- WebSocket passthrough for hosting/joining games ---
    if (request.headers.get("upgrade") === "websocket") {
      const target = GIMKIT_ORIGIN + pathname + url.search;
      // Do NOT touch origin/referer here
      return fetch(target, {
        method: request.method,
        headers: request.headers
      });
    }

    if (isAsset(pathname)) {
      const target = GIMKIT_ORIGIN + pathname + url.search;
      const resp = await proxyRequest(request, target);
      return allowIframe(resp);
    }

    if (isStaticLike(pathname)) {
      const target = GIMKIT_ORIGIN + pathname + url.search;
      const resp = await proxyRequest(request, target);
      return allowIframe(resp);
    }

    if (pathname === "/join") {
      const target = GIMKIT_ORIGIN + "/join" + url.search;
      const resp = await proxyRequest(request, target);
      const contentType = resp.headers.get("content-type") || "";

      if (!contentType.includes("text/html")) {
        return allowIframe(resp);
      }

      let html = await resp.text();
      const bundle = await getBundle();

      html = html.replace(
        "<head>",
        `<head>
    <script>${bundle}</script>`
      );

      html = html.replace(
        `content="https://www.gimkit.com">`,
        `content="https://www.gimkit.com"><script>document.querySelector('meta[property="cdn-map-assets-url"]').content = location.origin</script>`
      );

      const newHeaders = new Headers(resp.headers);
      newHeaders.set("content-type", "text/html; charset=utf-8");

      return allowIframe(
        new Response(html, {
          status: resp.status,
          statusText: resp.statusText,
          headers: newHeaders
        })
      );
    }

    const target = GIMKIT_ORIGIN + pathname + url.search;
    const resp = await proxyRequest(request, target);
    return allowIframe(resp);
  }
};
