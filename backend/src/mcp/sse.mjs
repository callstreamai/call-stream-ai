import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from "./server.mjs";

const sessions = new Map();

export function mountMcp(app) {
  // SSE endpoint — client connects here for the event stream
  app.get("/mcp/sse", (req, res) => {
    console.log("[MCP] SSE connection from", req.ip);

    const transport = new SSEServerTransport("/mcp/messages", res);
    const { server } = createMcpServer();

    sessions.set(transport.sessionId, { transport, server });

    res.on("close", () => {
      console.log("[MCP] SSE disconnected:", transport.sessionId);
      sessions.delete(transport.sessionId);
    });

    server.connect(transport).catch(err => {
      console.error("[MCP] Connection error:", err);
    });
  });

  // Message endpoint — client POSTs JSON-RPC messages here
  app.post("/mcp/messages", (req, res) => {
    const sessionId = req.query.sessionId;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(400).json({ error: "Unknown session. Connect to /mcp/sse first." });
    }

    session.transport.handlePostMessage(req, res);
  });

  // Discovery endpoint — human-readable info about the MCP server
  app.get("/mcp", (req, res) => {
    res.json({
      name: "call-stream-ai",
      version: "1.0.0",
      protocol: "MCP (Model Context Protocol)",
      transports: {
        sse: {
          connect: "/mcp/sse",
          messages: "/mcp/messages",
          description: "Server-Sent Events transport for web/remote clients"
        },
        stdio: {
          command: "node src/mcp/stdio.mjs",
          description: "Standard I/O transport for local clients (Claude Desktop, Cursor)"
        }
      },
      tools: [
        "list_clients", "get_client", "create_client",
        "list_departments", "create_department",
        "get_hours", "get_routing_rules", "create_routing_rule",
        "list_intents", "search_kb", "add_kb_item",
        "get_directory", "list_deployments", "create_deployment_binding",
        "resolve_deployment", "list_verticals", "get_audit_log"
      ],
      resources: ["clients://list"],
      prompts: ["onboard_client", "diagnose_routing"],
      docs: "https://modelcontextprotocol.io"
    });
  });

  console.log("[MCP] Mounted at /mcp/sse (SSE) and /mcp/messages (POST)");
}
