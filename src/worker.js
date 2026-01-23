const BUNDLE_SOURCE =
  'https://raw.githubusercontent.com/TheLazySquid/GimkitCheat/main/build/bundle.js';

let bundleCache = null;
let bundleCacheTime = 0;
const BUNDLE_TTL_MS = 5 * 60 * 1000;

async function getBundle() {
  const now = Date.now();
  if (bundleCache && now - bundleCacheTime < BUNDLE_TTL_MS) return bundleCache;

  const resp = await fetch(BUNDLE_SOURCE);
  if (!resp.ok) throw new Error('Failed to fetch bundle.js');
  const text = await resp.text();
  bundleCache = text;
  bundleCacheTime = now;
  return text;
}

function pickRoute(pathname) {
  const routes = [
    { match: /(.*?)\.(png|jpg|jpeg|svg|webm|ico|gif|ttf|otf|atlas)/, handler: handleContent },
    { match: /(.*?)\.(mp3|mp4|m4a)/, handler: handleAudio },
    { match: /(.*?)\.(js|json|css)(.*?)/, handler: handleStatic },
    { match: /(pages|api)\/(.*?)/, handler: handleStatic },
    { match: /\/\$login(.*?)/, handler: handleLogin },
    { match: /(\/|)/, handler: handlePage }
  ];

  for (const route of routes) {
    if (typeof route.match === 'string') {
      if (pathname === route.match) return route.handler;
    } else if (route.match.test(pathname)) {
      return route.handler;
    }
  }
  return null;
}

async function handleContent(_request, pathname) {
  const target = `https://gimkit.com${pathname}`;
  const resp = await fetch(target, { redirect: 'manual' });
  const headers = new Headers();
  ['content-type', 'set-cookie'].forEach((h) => {
    if (resp.headers.has(h)) headers.set(h, resp.headers.get(h));
  });
  const buf = await resp.arrayBuffer();
  return new Response(buf, { status: resp.status, headers });
}

async function handleAudio(_request, pathname) {
  const target = `https://gimkit.com${pathname}`;
  const resp = await fetch(target, { redirect: 'manual' });
  const headers = new Headers();
  ['content-type', 'set-cookie'].forEach((h) => {
    if (resp.headers.has(h)) headers.set(h, resp.headers.get(h));
  });
  return new Response(resp.body, { status: resp.status, headers });
}

async function handleStatic(request, pathname) {
  const url = new URL(request.url);
  const search = url.search || '';
  const target = `https://www.gimkit.com${pathname}${search}`;

  const resp = await fetch(target, {
    method: request.method,
    headers: {
      accept: '*/*',
      'accept-encoding': 'deflate',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      pragma: 'no-cache',
      referer: 'https://www.gimkit.com/',
      'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="134", "Google Chrome";v="134"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'upgrade-insecure-requests': '1',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      cookie: request.headers.get('cookie') || ''
    },
    body:
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.text(),
    redirect: 'manual'
  });

  const headers = new Headers();
  ['content-type', 'set-cookie'].forEach((h) => {
    if (resp.headers.has(h)) headers.set(h, resp.headers.get(h));
  });

  const text = await resp.text();
  return new Response(text, { status: resp.status, headers });
}

async function handleLogin(request, pathname) {
  const url = new URL(request.url);

  if (pathname.endsWith('/post')) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'method not allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' }
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'invalid json' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    const email = body.email;
    const password = body.password;

    const checkEmailResponse = await fetch(
      'https://www.gimkit.com/api/users/register/email-info',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      }
    );
    const checkEmail = await checkEmailResponse.json();

    if (!checkEmail.accountExists) {
      return new Response(JSON.stringify({ error: 'email does not exist' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
    if (checkEmail.noPassword) {
      return new Response(
        JSON.stringify({
          error:
            'you cannot sign in with a google-based email - add a password from the gimkit settings (gimkit.com/settings)'
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    const loginResponse = await fetch('https://www.gimkit.com/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        googleToken: ''
      })
    });

    const loginJson = await loginResponse.json();

    if (loginJson.message) {
      return new Response(
        JSON.stringify({ error: loginJson.message.text || 'login failed' }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    if (!loginJson.user || !loginJson.user._id) {
      console.log('could not login', loginJson);
      return new Response(JSON.stringify({ error: 'unknown error' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }

    const headers = new Headers({ 'content-type': 'application/json' });
    const setCookie = loginResponse.headers.get('set-cookie');
    if (setCookie) headers.set('set-cookie', setCookie);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers
    });
  }

  const html = `<!DOCTYPE html>
<html>
  <head>
    <title>gimmick $ login</title>
    <meta charset="utf-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&display=swap"
      rel="stylesheet">
    <style>
      * {
        font-family: 'Nunito';
        color: white;
        text-align: center;
        user-select: none;
        -moz-user-select: none;
        -webkit-user-select: none;
        -ms-user-select: none;
      }
      body {
        background-color: black;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
      }
      h1 {
        margin-top: 10vh;
      }
      div {
        margin-top: 15vh;
        display: flex;
        gap: 3vw;
      }
      input {
        background-color: black;
        border: none;
        border-bottom: 1px solid white;
        color: white;
        font-size: 3vh;
        outline: none;
        width: 20vw;
        padding: 0.5rem 0.5rem 0.5rem 0;
      }
      button {
        background-color: black;
        border: none;
        border-bottom: 1px solid oklch(70.7% 0.165 254.624);
        color: oklch(70.7% 0.165 254.624);
        font-size: 3vh;
        width: 20vw;
        padding: 0.5rem 0.5rem 0.5rem 0;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <h2>gimmick $ login</h2>
    <div>
      <input placeholder="gimkit username" id="username" type="text" />
      <input placeholder="gimkit password" id="password" type="text" />
      <button id="gimkitLogin">login with gimkit</button>
    </div>
    <script>
      document.querySelector('#gimkitLogin').addEventListener('click', () => {
        const email = document.querySelector('#username').value;
        const password = document.querySelector('#password').value;

        if (email && password) {
          fetch('/$login/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          }).then(res => res.json()).then(data => {
            if (data.error) alert('error: ' + data.error);
            else if (data.success) alert('success!');
          });
        } else {
          alert('please enter an email and password. if you use a google-based login, go to gimkit.com/settings and add a password.');
        }
      });
    </script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

async function handlePage(request, pathname) {
  const url = new URL(request.url);

  if (pathname !== '/join') {
    return Response.redirect(`${url.origin}/join`, 302);
  }

  const target = 'https://www.gimkit.com/join';
  const resp = await fetch(target, { redirect: 'manual' });
  let html = await resp.text();

  const headers = new Headers();
  ['content-type', 'set-cookie'].forEach((h) => {
    if (resp.headers.has(h)) headers.set(h, resp.headers.get(h));
  });

  const bundle = await getBundle();

  html = html.replace(
    '<head>',
    `<head>
    <script>${bundle}</script>`
  );

  html = html.replace(
    `content="https://www.gimkit.com">`,
    `content="https://www.gimkit.com"><script>document.querySelector('meta[property="cdn-map-assets-url"]').content = location.origin</script>`
  );

  return new Response(html, { status: resp.status, headers });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname.split('?')[0];

    const handler = pickRoute(pathname);
    if (!handler) {
      console.log(`Unknown file for path "${pathname}"`);
      return new Response('Not found', { status: 404 });
    }

    try {
      return await handler(request, pathname);
    } catch (e) {
      console.error('Error handling request', pathname, e);
      return new Response('Internal error', { status: 500 });
    }
  }
};
