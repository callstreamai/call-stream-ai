import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from "./server.mjs";

const sessions = new Map();

function checkAuth(req, res) {
  const token = process.env.MCP_API_TOKEN || process.env.RUNTIME_API_TOKEN;
  
  // If no token configured, allow all (dev mode)
  if (!token) return true;

  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;
  const headerToken = req.headers["x-api-token"];

  const provided = authHeader?.replace("Bearer ", "") || queryToken || headerToken;

  if (!provided || provided !== token) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or missing API token. Use Authorization: Bearer <token>" } });
    return false;
  }
  return true;
}

export function mountMcp(app) {
  // SSE endpoint — auth checked once at connection
  app.get("/mcp/sse", (req, res) => {
    if (!checkAuth(req, res)) return;

    console.log("[MCP] Authenticated SSE connection from", req.ip);
    const transport = new SSEServerTransport("/mcp/messages", res);
    const { server } = createMcpServer();
    sessions.set(transport.sessionId, { transport, server });
    res.on("close", () => { sessions.delete(transport.sessionId); });
    server.connect(transport).catch(err => console.error("[MCP] Error:", err));
  });

  // Message endpoint — session already authenticated via SSE handshake
  app.post("/mcp/messages", (req, res) => {
    const sessionId = req.query.sessionId;
    const session = sessions.get(sessionId);
    if (!session) return res.status(400).json({ error: "Unknown session. Connect to /mcp/sse first." });
    session.transport.handlePostMessage(req, res);
  });

  // Discovery endpoint — public (describes the server, no data exposed)
  app.get("/mcp", (req, res) => {
    res.json({
      name: "call-stream-ai", version: "1.0.0",
      protocol: "MCP (Model Context Protocol)",
      auth: {
        type: "bearer",
        description: "Pass token via Authorization: Bearer <token>, x-api-token header, or ?token= query param on the /mcp/sse endpoint",
        required: !!process.env.MCP_API_TOKEN || !!process.env.RUNTIME_API_TOKEN
      },
      transports: {
        sse: { connect: "/mcp/sse", messages: "/mcp/messages" },
        stdio: { command: "node src/mcp/stdio.mjs" }
      },
      tools: ["list_clients","get_client","create_client","list_departments","create_department",
        "get_hours","get_routing_rules","create_routing_rule","list_intents","search_kb",
        "add_kb_item","get_directory","list_deployments","create_deployment_binding",
        "resolve_deployment","list_verticals","get_audit_log"],
      resources: ["clients://list"],
      prompts: ["onboard_client","diagnose_routing"],
      docs: "https://modelcontextprotocol.io"
    });
  });

  console.log("[MCP] Mounted at /mcp (auth:", !!process.env.MCP_API_TOKEN || !!process.env.RUNTIME_API_TOKEN ? "enabled" : "dev-mode", ")");
}
