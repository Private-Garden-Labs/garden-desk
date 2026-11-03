import { spawnSync } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { text } from "node:stream/consumers";
import { unstable_startWorker } from "wrangler";

const config = "site/worker/wrangler.jsonc";
const sitePort = 4174;
const adminPort = 4175;
const team = `http://127.0.0.1:${adminPort}`;

const algorithm = {
  name: "RSASSA-PKCS1-v1_5",
  hash: "SHA-256",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
};
const keys = await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"]);
const jwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: "local" };
const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const unsigned = `${encode({ alg: "RS256", kid: "local" })}.${encode({ aud: "local", iss: team, exp: Date.now() / 1000 + 86_400 })}`;
const signature = await crypto.subtle.sign(
  algorithm,
  keys.privateKey,
  new TextEncoder().encode(unsigned),
);
const token = `${unsigned}.${Buffer.from(signature).toString("base64url")}`;

spawnSync(
  "pnpm",
  ["exec", "wrangler", "d1", "migrations", "apply", "garden-desk-stats", "--local", "-c", config],
  { stdio: "inherit", env: { ...process.env, CI: "true" } },
);

await unstable_startWorker({
  config,
  bindings: {
    ACCESS_TEAM_DOMAIN: { type: "plain_text", value: team },
    ACCESS_AUD: { type: "plain_text", value: "local" },
  },
  dev: {
    server: { hostname: "127.0.0.1", port: sitePort },
    inspector: false,
    inferOriginFromRoutes: false,
    watch: true,
  },
});

createServer((request, response) => {
  if (request.url === "/cdn-cgi/access/certs") {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ keys: [jwk] }));
    return;
  }
  const headers = {
    ...request.headers,
    host: "admin.gardendesk.ai",
    "accept-encoding": "identity",
    "cf-access-jwt-assertion": token,
    ...(request.headers.origin === undefined ? {} : { origin: "http://admin.gardendesk.ai" }),
  };
  const forward = httpRequest(
    { host: "127.0.0.1", port: sitePort, path: request.url, method: request.method, headers },
    async (reply) => {
      if (!/html|json|javascript/u.test(reply.headers["content-type"] ?? "")) {
        response.writeHead(reply.statusCode ?? 502, reply.headers);
        reply.pipe(response);
        return;
      }
      const content = (await text(reply)).replaceAll(
        "https://gardendesk.ai",
        `http://127.0.0.1:${sitePort}`,
      );
      delete reply.headers["content-length"];
      response.writeHead(reply.statusCode ?? 502, reply.headers);
      response.end(content);
    },
  );
  request.pipe(forward);
}).listen(adminPort, "127.0.0.1", () => {
  console.log(
    `\nAdmin: http://127.0.0.1:${adminPort}/blog/\nWebsite: http://127.0.0.1:${sitePort}/blog/\n`,
  );
});
