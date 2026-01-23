// src/worker.js — Cloudflare Worker proxy for Gimkit with /join injection

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Assets (images, fonts, media, etc.)
    if (isAsset(pathname)) {
      const target = GIMKIT_ORIGIN + pathname + url.search;
      return proxyRequest(request, target);
    }

    // Static / API (includes /api/login)
    if (isStaticLike(pathname)) {
      const target = GIMKIT_ORIGIN + pathname + url.search;
      return proxyRequest(request, target);
    }

    // /join — inject bundle.js and rewrite cdn-map-assets-url
    if (pathname === "/join") {
      const target = GIMKIT_ORIGIN + "/join" + url.search;
      const resp = await proxyRequest(request, target);
      const contentType = resp.headers.get("content-type") || "";

      if (!contentType.includes("text/html")) {
        return resp;
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

      return new Response(html, {
        status: resp.status,
        statusText: resp.statusText,
        headers: newHeaders
      });
    }

    // Root and everything else (e.g. /login, /home, etc.) — plain proxy
    const target = GIMKIT_ORIGIN + pathname + url.search;
    return proxyRequest(request, target);
  }
};
