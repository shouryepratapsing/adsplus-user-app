import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("dist");
const port = Number(process.env.PORT || 4173);
const host = "0.0.0.0";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end("Method not allowed");
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400);
    return res.end("Bad request");
  }

  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    if (path.extname(pathname)) {
      res.writeHead(404);
      return res.end("Not found");
    }
    file = path.join(root, "index.html");
  }

  const ext = path.extname(file).toLowerCase();
  const headers = {
    "Content-Type": mime[ext] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": path.basename(file) === "index.html" ? "no-cache" : "public, max-age=3600"
  };

  res.writeHead(200, headers);
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Ads+ user app listening on ${host}:${port}`);
});
