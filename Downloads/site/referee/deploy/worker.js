/* Garsoore on Cloudflare Workers (static assets + API).
   buurwen.com / www.buurwen.com  -> consumer site (site root)
   business.buurwen.com           -> the business/ folder, with shared /assets/ served from the root
   /api/*  on either host          -> the shared API (api.js, D1) — one login, one set of orders for both sites
   Old folder-style links (/business/...) on the consumer host redirect to the business hostname.
   On localhost (wrangler dev) the business site stays a folder, like the static dev server. */
import { handleApi } from "./api.js";

/* Exact-path asset serving (html_handling: "none"): "/" -> index.html, "/x" -> "/x.html". Keeps the business/ prefix out of visible URLs. */
const norm = p => (p.endsWith("/") ? p + "index.html" : /\.[a-z0-9]+$/i.test(p) ? p : p + ".html");

export default {
  async fetch(req, env) {
    const url = new URL(req.url), host = url.hostname, p = url.pathname;
    if (p.startsWith("/api/")) return handleApi(req, env, url);

    const local = /^(localhost|127\.0\.0\.1)$/.test(host);
    const biz = host.startsWith("business.");
    const apex = host.replace(/^(www|business)\./, "");

    if (host.startsWith("www.")) return Response.redirect(`https://${apex}${p}${url.search}`, 301);

    if (!local && !biz && (p === "/business" || p.startsWith("/business/"))) {
      const rest = p.slice("/business".length) || "/";
      return Response.redirect(`https://business.${apex}${rest}${url.search}`, 301);
    }
    if (biz && !p.startsWith("/assets/")) {
      url.pathname = "/business" + norm(p);
      return env.ASSETS.fetch(new Request(url.toString(), req));
    }
    url.pathname = norm(p);
    return env.ASSETS.fetch(new Request(url.toString(), req));
  }
};
