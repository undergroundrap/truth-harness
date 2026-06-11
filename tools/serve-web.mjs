import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve("apps/web");
const args = new Map(
  process.argv.slice(2).flatMap((arg, index, values) => {
    if (!arg.startsWith("--")) {
      return [];
    }
    const next = values[index + 1];
    return [[arg.slice(2), next && !next.startsWith("--") ? next : "true"]];
  })
);
const host = args.get("host") ?? "127.0.0.1";
const port = Number(args.get("port") ?? "4173");

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
    const filePath = await resolveRequestPath(requestUrl.pathname);
    response.setHeader("Content-Type", mimeTypes.get(extname(filePath)) ?? "application/octet-stream");
    response.setHeader("X-Content-Type-Options", "nosniff");
    createReadStream(filePath).pipe(response);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(status === 404 ? "Not found" : "Server error");
  }
});

server.listen(port, host, () => {
  console.log(`Theorem Workbench web: http://${host}:${port}`);
});

async function resolveRequestPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = normalize(decoded.replace(/^\/+/, "")) || "index.html";
  let candidate = resolve(root, relative);
  if (candidate === root || decoded.endsWith("/")) {
    candidate = join(candidate, "index.html");
  }

  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (candidate !== root && !candidate.startsWith(rootWithSep)) {
    throw new HttpError(404);
  }

  const info = await stat(candidate);
  if (info.isDirectory()) {
    return join(candidate, "index.html");
  }
  if (!info.isFile()) {
    throw new HttpError(404);
  }
  return candidate;
}

class HttpError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}
