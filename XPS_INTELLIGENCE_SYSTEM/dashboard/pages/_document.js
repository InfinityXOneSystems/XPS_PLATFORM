// dashboard/pages/_document.js
// PWA head tags, service worker registration, manifest link

import { Html, Head, Main, NextScript } from "next/document";
import React from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <meta name="application-name" content="XPS Intelligence" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="XPS Intelligence" />
        <meta name="theme-color" content="#FFD700" />
        <link rel="manifest" href={`${BASE_PATH}/manifest.json`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              var _base = '${BASE_PATH}';
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register(_base + '/sw.js').catch(function(err) {
                    console.warn('SW registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #000; color: #fff; }
          a:hover { opacity: 0.85; }
          ::placeholder { color: #555; }
          :focus { outline: 1px solid #FFD700; outline-offset: 2px; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: #000; }
          ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        `}</style>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
