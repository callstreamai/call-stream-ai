import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from "./server.mjs";

const sessions = new Map();

export function mountMcp(app) {
  app.get("/mcp/sse", (req, res) => {
    console.log("[MCP] SSE connection from", req.ip);
    const transport = new SSEServerTransport("/mcp/messages", res);
    const { server } = createMcpServer();
    sessions.set(transport.sessionId, { transport, server });
    res.on("close", () => { sessions.delete(transport.sessionId); });
    server.connect(transport).catch(err => console.error("[MCP] Error:", err));
  });

  app.post("/mcp/messages", (req, res) => {
    const sessionId = req.query.sessionId;
    const session = sessions.get(sessionId);
    if (!session) return res.status(400).json({ error: "Unknown session" });
    session.transport.handlePostMessage(req, res);
  });

  app.get("/mcp", (req, res) => {
    res.json({
      name: "call-stream-ai", version: "1.0.0",
      protocol: "MCP (Model Context Protocol)",
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

  console.log("[MCP] Mounted at /mcp");
}
