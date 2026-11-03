/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Camera/mic are intentionally NOT blocked here: in-app
          // WebRTC calls need them, gated by browser permission.
          { key: "Permissions-Policy", value: "payment=(), usb=()" },
          // F13 — Content-Security-Policy. Camera/mic are NOT a CSP
          // matter: getUserMedia is governed by Permissions-Policy
          // (above, camera/mic left allowed) and browser permission,
          // so this CSP does not block WebRTC. Honest limitation:
          // script/style keep 'unsafe-inline' because Next.js emits
          // inline bootstrap scripts and the app uses inline style
          // attributes extensively; a nonce-based CSP is the
          // follow-up that would let those be removed. Even with
          // that, this policy still blocks external scripts,
          // objects, frames and off-origin media/connect/font/img.
          // HSTS is NOT set here on purpose: it is a host-level
          // setting. The deployment host / reverse proxy must send
          // Strict-Transport-Security (e.g. max-age=31536000,
          // includeSubDomains) — see SECURITY.md. Setting it in
          // the app as well would be harmless but is not a
          // substitute for the host setting it on every response.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "media-src 'self' blob:",
              "connect-src 'self' ws: wss:",
              "font-src 'self'",
              "worker-src 'self'",
              "manifest-src 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
