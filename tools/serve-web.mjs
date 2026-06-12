import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve("apps/web");
const MAX_JSON_BODY_BYTES = 16 * 1024;
let coreModulePromise;
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
    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApiRequest(request, response, requestUrl);
      return;
    }

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

async function handleApiRequest(request, response, requestUrl) {
  if (requestUrl.pathname === "/api/status" && request.method === "GET") {
    writeJson(response, 200, {
      schemaVersion: "theorem.web-status.v0",
      localOnly: true,
      externalCalls: false,
      api: "local-node",
      engine: "@theorem-workbench/core",
      capabilities: ["receipt-create", "trace-render", "activity-log", "agent-runbook", "research-session", "validation-plan"]
    });
    return;
  }

  if (requestUrl.pathname === "/api/receipt" && request.method === "POST") {
    const receivedAt = new Date().toISOString();
    const input = await readJsonBody(request);
    const problem = typeof input.problem === "string" ? input.problem.trim() : "";
    if (!problem) {
      writeJson(response, 400, {
        error: "problem is required"
      });
      return;
    }

    const { createReceipt } = await loadCoreModule();
    const receipt = createReceipt(problem);
    const completedAt = new Date().toISOString();
    writeJson(response, 200, {
      schemaVersion: "theorem.web-receipt-response.v0",
      localOnly: true,
      externalCalls: [],
      receipt,
      activity: [
        {
          actor: "web-ui",
          action: "submitted-local-problem",
          detail: "Browser submitted selected prompt text to the local Theorem Workbench API.",
          at: receivedAt
        },
        {
          actor: "local-api",
          action: "created-receipt",
          detail: "The local API called @theorem-workbench/core createReceipt without a hosted model or external service.",
          at: completedAt
        }
      ]
    });
    return;
  }

  writeJson(response, 404, {
    error: "unknown API route"
  });
}

function loadCoreModule() {
  coreModulePromise ??= import(resolve("packages/core/dist/index.js"));
  return coreModulePromise;
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let byteLength = 0;

    request.on("data", (chunk) => {
      byteLength += chunk.length;
      if (byteLength > MAX_JSON_BODY_BYTES) {
        rejectBody(new HttpError(413));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        rejectBody(new HttpError(400));
      }
    });

    request.on("error", rejectBody);
  });
}

function writeJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store"
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

class HttpError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}
