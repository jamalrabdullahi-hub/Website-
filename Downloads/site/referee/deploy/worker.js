/* Garsoore on Cloudflare Workers (static assets + API).
   buurwen.com / www.buurwen.com  -> consumer site (site root)
   business.buurwen.com           -> the business/ folder, with shared /assets/ served from the root
   /api/*  on either host          -> the shared API (api.js, D1) — one login, one set of orders for both sites
   Old folder-style links (/business/...) on the consumer host redirect to the business hostname.
   On localhost (wrangler dev) the business site stays a folder, like the static dev server. */
import { handleApi } from "./api.js";
import { CATALOG } from "./catalog.gen.js";

/* A link shared on WhatsApp should show the item, not the site name. Product pages are rendered in the browser, so the
   Worker injects the real title, price and photo into <head> for whoever is fetching it (crawler or person). */
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function ogFor(url) {
  const sku = url.searchParams.get("sku");
  const p = sku && CATALOG[sku];
  if (!p) return null;
  const v = p.variants[0] || {};
  const price = v.total != null ? "$" + v.total : null;
  return {
    title: p.title + (price ? " — " + price : "") + " · Garsoore",
    desc: (p.china ? "Laga keenay Shiinaha · " : "Diyaar maanta · ") + (price ? price + " — qiimaha oo dhan, rar iyo canshuur ku jira." : "Qiimo la sugayo.")
      + " Lacagtaadu way xajisan tahay ilaa aad hesho.",
    image: p.image || ""
  };
}
class Head {
  constructor(og, url) { this.og = og; this.url = url; }
  element(el) {
    const { title, desc, image } = this.og;
    el.append(
      `<meta property="og:type" content="product">` +
      `<meta property="og:site_name" content="Garsoore">` +
      `<meta property="og:title" content="${esc(title)}">` +
      `<meta property="og:description" content="${esc(desc)}">` +
      `<meta property="og:url" content="${esc(this.url)}">` +
      (image ? `<meta property="og:image" content="${esc(image)}">` : "") +
      `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">` +
      `<meta name="description" content="${esc(desc)}">`, { html: true });
  }
}
class Title {
  constructor(og) { this.og = og; }
  element(el) { el.setInnerContent(this.og.title); }
}

/* Exact-path asset serving (html_handling: "none"): "/" -> index.html, "/x" -> "/x.html". Keeps the business/ prefix out of visible URLs. */
const norm = p => (p.endsWith("/") ? p + "index.html" : /\.[a-z0-9]+$/i.test(p) ? p : p + ".html");

export default {
  async fetch(req, env) {
    const url = new URL(req.url), host = url.hostname, p = url.pathname;
    if (p.startsWith("/api/")) return handleApi(req, env, url);

    const local = /^(localhost|127\.0\.0\.1)$/.test(host);
    const biz = host.startsWith("business.");
    const isAdmin = host.startsWith("admin.") || (local && p.startsWith("/admin/"));
    const apex = host.replace(/^(www|business|admin)\./, "");

    if (host.startsWith("www.")) return Response.redirect(`https://${apex}${p}${url.search}`, 301);

    /* admin.<domain> serves only the console (its own folder). Shared /assets/ still come from the root. */
    if (isAdmin && !p.startsWith("/assets/")) {
      url.pathname = local ? norm(p) : "/admin" + norm(p === "/" ? "/index.html" : p);
      const res = await env.ASSETS.fetch(new Request(url.toString(), req));
      return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), "X-Robots-Tag": "noindex, nofollow" } });
    }
    /* the console moved off the business site */
    if (biz && (p === "/admin" || p === "/admin.html")) return Response.redirect(`https://admin.${apex}/`, 301);

    if (!local && !biz && (p === "/business" || p.startsWith("/business/"))) {
      const rest = p.slice("/business".length) || "/";
      return Response.redirect(`https://business.${apex}${rest}${url.search}`, 301);
    }
    if (biz && !p.startsWith("/assets/")) {
      url.pathname = "/business" + norm(p);
      return env.ASSETS.fetch(new Request(url.toString(), req));
    }
    url.pathname = norm(p);
    const res = await env.ASSETS.fetch(new Request(url.toString(), req));
    if (url.pathname === "/product.html") {
      const og = ogFor(new URL(req.url));
      if (og) return new HTMLRewriter().on("head", new Head(og, req.url)).on("title", new Title(og)).transform(res);
    }
    return res;
  }
};
