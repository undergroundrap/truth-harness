import { createServer, request } from "node:http";

const listenHost = process.env.TRUTH_HARNESS_GATEWAY_HOST ?? "0.0.0.0";
const listenPort = Number(process.env.TRUTH_HARNESS_GATEWAY_PORT ?? "4180");
const upstreamHost = process.env.TRUTH_HARNESS_WEB_HOST ?? "web";
const upstreamPort = Number(process.env.TRUTH_HARNESS_WEB_PORT ?? "4180");

const server = createServer((incoming, outgoing) => {
  const upstream = request(
    {
      hostname: upstreamHost,
      port: upstreamPort,
      method: incoming.method,
      path: incoming.url,
      headers: incoming.headers
    },
    (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    }
  );

  upstream.on("error", () => {
    if (!outgoing.headersSent) {
      outgoing.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    }
    outgoing.end("Truth Harness web service is unavailable.");
  });

  incoming.pipe(upstream);
});

server.listen(listenPort, listenHost, () => {
  console.log(`Truth Harness local gateway: http://${listenHost}:${listenPort} -> http://${upstreamHost}:${upstreamPort}`);
});
