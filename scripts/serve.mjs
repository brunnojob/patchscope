import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const args = process.argv.slice(2),
  root = process.cwd(),
  port = Number(args[args.indexOf("--port") + 1]) || 4173;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".md": "text/plain; charset=utf-8",
};
http
  .createServer(async (req, res) => {
    try {
      const path = resolve(
        root,
        "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
      );
      if (!path.startsWith(root + sep) && path !== root) {
        res.writeHead(403);
        res.end();
        return;
      }
      const target =
        path === root || req.url.endsWith("/")
          ? resolve(path, "index.html")
          : path;
      const content = await readFile(target);
      res.writeHead(200, {
        "content-type": types[extname(target)] || "text/plain",
        "cache-control": "no-store",
      });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, "0.0.0.0", () => console.log(`PatchScope ready on ${port}`));
