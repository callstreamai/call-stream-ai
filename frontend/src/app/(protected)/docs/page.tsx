"use client";
import { useState } from "react";

type Method = "GET" | "POST" | "PUT" | "DELETE";

interface Endpoint {
  method: Method;
  path: string;
  description: string;
  auth: "runtime" | "admin" | "none";
  requestBody?: Record<string, { type: string; required: boolean; description: string }>;
  queryParams?: Record<string, { type: string; required: boolean; description: string }>;
  response?: string;
  notes?: string;
}

interface Section {
  title: string;
  description: string;
  baseUrl: string;
  endpoints: Endpoint[];
}

const METHOD_COLORS: Record<Method, string> = {
  GET: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  PUT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
};

const API_SECTIONS: Section[] = [
  {
    title: "Health",
    description: "Service health and status.",
    baseUrl: "",
    endpoints: [
      {
        method: "GET",
        path: "/health",
        description: "Returns service health status and timestamp.",
        auth: "none",
        response: `{ "status": "healthy", "service": "call-stream-ai", "timestamp": "2026-04-17T..." }`,
      },
    ],
  },
  {
    title: "Runtime API",
    description:
      "Endpoints consumed by Brainbase workers at call time. Authenticated via x-api-token header.",
    baseUrl: "/api/runtime",
    endpoints: [
      {
        method: "POST",
        path: "/deployment-resolve",
        description:
          "Primary endpoint — resolves a Brainbase deployment ID to the full client configuration, routing rules, hours, and context needed to handle a call.",
        auth: "runtime",
        requestBody: {
          deploymentId: { type: "string", required: true, description: "Brainbase deployment ID" },
          workerId: { type: "string", required: false, description: "Worker/agent ID" },
          channel: { type: "string", required: false, description: "Channel type: voice | chat | sms | email (default: voice)" },
          intent: { type: "string", required: false, description: "Detected caller intent key" },
          department: { type: "string", required: false, description: "Target department code" },
          timestamp: { type: "string", required: false, description: "ISO 8601 timestamp for hours check" },
        },
        response: `{
  "client": { "id": "...", "name": "...", "slug": "..." },
  "department": { "name": "...", "code": "..." },
  "action": { "type": "info_response|transfer|escalate", "label": "...", "value": "..." },
  "fallback": { "type": "transfer", "value": "operator_transfer" },
  "context": { "isOpen": true, "currentHours": {...}, "directory": [...] },
  "faq": [...],
  "_meta": { "responseTime": 45, "cached": false }
}`,
        notes: "Returns 404 with safeFallback if no deployment binding is found.",
      },
      {
        method: "GET",
        path: "/:clientId/directory",
        description: "Returns the phone/extension directory for a client.",
        auth: "runtime",
        response: `{ "clientId": "...", "directory": [{ "name": "...", "role": "...", "department_code": "...", "phone": "...", "extension": "..." }], "count": 5 }`,
      },
      {
        method: "GET",
        path: "/:clientId/hours",
        description: "Returns hours of operation for all departments.",
        auth: "runtime",
        response: `{ "clientId": "...", "hours": [{ "day_of_week": 0, "open_time": "09:00:00", "close_time": "17:00:00", "is_closed": false, "timezone": "America/New_York" }], "isCurrentlyOpen": true }`,
      },
      {
        method: "GET",
        path: "/:clientId/routing",
        description: "Returns all active routing rules for a client.",
        auth: "runtime",
        response: `{ "clientId": "...", "rules": [{ "department_code": "...", "intent_key": "...", "action_type": "transfer", "action_value": "..." }] }`,
      },
      {
        method: "GET",
        path: "/:clientId/context",
        description: "Returns departments, intents, and routing context in one call.",
        auth: "runtime",
        response: `{ "clientId": "...", "departments": [...], "intents": [...], "routing": [...] }`,
      },
      {
        method: "GET",
        path: "/:clientId/faq",
        description: "Returns knowledge base FAQ items.",
        auth: "runtime",
        response: `{ "clientId": "...", "items": [{ "category": "...", "question": "...", "answer": "...", "department_code": "...", "intent_key": "..." }] }`,
      },
    ],
  },
  {
    title: "Channel API",
    description:
      "Richer resolve and init endpoints for non-voice channels (chat, SMS, email). Authenticated via x-api-token header.",
    baseUrl: "/api/channel",
    endpoints: [
      {
        method: "POST",
        path: "/resolve",
        description:
          "Channel-aware routing resolution with KB context, channel overrides, and prompt hints. Designed for chat widgets and messaging integrations.",
        auth: "runtime",
        requestBody: {
          deploymentId: { type: "string", required: true, description: "Brainbase deployment ID" },
          channel: { type: "string", required: false, description: "chat | sms | email (default: chat)" },
          intent: { type: "string", required: false, description: "Detected intent key" },
          department: { type: "string", required: false, description: "Target department code" },
          sessionId: { type: "string", required: false, description: "Conversation session ID" },
        },
        response: `{
  "clientId": "...",
  "channel": "chat",
  "action": { "type": "info_response", "label": "...", "value": "..." },
  "relatedFaq": [{ "question": "...", "answer": "..." }],
  "channelOverrides": [...],
  "promptHints": { "speakBriefly": false, "useRichFormatting": true, "includeLinks": true, "maxResponseLength": 2000 }
}`,
      },
      {
        method: "GET",
        path: "/:clientId/init",
        description: "Initialize a chat widget — returns departments, intents, and default config.",
        auth: "runtime",
        queryParams: {
          channel: { type: "string", required: false, description: "Channel type (default: chat)" },
        },
        response: `{ "clientId": "...", "channel": "chat", "departments": [...], "intents": [...], "config": { "welcomeMessage": "...", "inputPlaceholder": "..." } }`,
      },
    ],
  },
  {
    title: "Admin API — Clients",
    description: "Client management. All admin endpoints require a Supabase JWT in the Authorization header.",
    baseUrl: "/api/admin",
    endpoints: [
      { method: "GET", path: "/clients", description: "List all clients.", auth: "admin", response: `{ "clients": [{ "id": "...", "name": "...", "slug": "...", "vertical": "...", "status": "draft|published", "timezone": "..." }] }` },
      { method: "POST", path: "/clients", description: "Create a new client and clone vertical template.", auth: "admin", requestBody: { name: { type: "string", required: true, description: "Client name" }, vertical: { type: "string", required: true, description: "Vertical template key" }, slug: { type: "string", required: false, description: "URL slug (auto-generated if omitted)" } } },
      { method: "GET", path: "/clients/:id", description: "Get a single client by ID.", auth: "admin" },
      { method: "PUT", path: "/clients/:id", description: "Update client details (name, timezone, settings, status).", auth: "admin" },
      { method: "DELETE", path: "/clients/:id", description: "Delete a client and all associated data.", auth: "admin" },
      { method: "GET", path: "/verticals", description: "List available vertical templates.", auth: "admin", response: `{ "verticals": [{ "vertical": "hotels_resorts", "name": "Hotels & Resorts", "description": "..." }] }` },
    ],
  },
  {
    title: "Admin API — Departments",
    description: "CRUD for client departments.",
    baseUrl: "/api/admin/clients/:clientId",
    endpoints: [
      { method: "GET", path: "/departments", description: "List all departments for a client.", auth: "admin" },
      { method: "POST", path: "/departments", description: "Create a department.", auth: "admin", requestBody: { name: { type: "string", required: true, description: "Department name" }, code: { type: "string", required: true, description: "Unique code (e.g. front_desk)" }, description: { type: "string", required: false, description: "Description" }, display_order: { type: "number", required: false, description: "Sort order" }, is_default: { type: "boolean", required: false, description: "Default department flag" } } },
      { method: "PUT", path: "/departments/:id", description: "Update a department.", auth: "admin" },
      { method: "DELETE", path: "/departments/:id", description: "Delete a department.", auth: "admin" },
    ],
  },
  {
    title: "Admin API — Directory",
    description: "CRUD for client phone/extension directory.",
    baseUrl: "/api/admin/clients/:clientId",
    endpoints: [
      { method: "GET", path: "/directory", description: "List directory entries.", auth: "admin" },
      { method: "POST", path: "/directory", description: "Create a directory entry.", auth: "admin", requestBody: { name: { type: "string", required: true, description: "Contact name" }, role: { type: "string", required: false, description: "Job title/role" }, department_code: { type: "string", required: false, description: "Department code" }, phone: { type: "string", required: false, description: "Phone number" }, extension: { type: "string", required: false, description: "Extension" }, email: { type: "string", required: false, description: "Email" } } },
      { method: "PUT", path: "/directory/:id", description: "Update a directory entry.", auth: "admin" },
      { method: "DELETE", path: "/directory/:id", description: "Delete a directory entry.", auth: "admin" },
    ],
  },
  {
    title: "Admin API — Hours of Operation",
    description: "CRUD for operating hours per department.",
    baseUrl: "/api/admin/clients/:clientId",
    endpoints: [
      { method: "GET", path: "/hours", description: "List all hours entries.", auth: "admin" },
      { method: "POST", path: "/hours", description: "Upsert hours (array of entries). Replaces existing entries for matching department + day.", auth: "admin", requestBody: { department_id: { type: "string", required: true, description: "Department UUID" }, day_of_week: { type: "number", required: true, description: "0=Sunday through 6=Saturday" }, open_time: { type: "string", required: true, description: "Opening time (HH:MM:SS)" }, close_time: { type: "string", required: true, description: "Closing time (HH:MM:SS)" }, is_closed: { type: "boolean", required: false, description: "Whether closed this day" }, timezone: { type: "string", required: false, description: "IANA timezone (default: America/New_York)" } }, notes: "Accepts an array of entries for batch upsert." },
      { method: "DELETE", path: "/hours/:id", description: "Delete an hours entry.", auth: "admin" },
    ],
  },
  {
    title: "Admin API — Holidays",
    description: "CRUD for holiday exceptions that override normal hours.",
    baseUrl: "/api/admin/clients/:clientId",
    endpoints: [
      { method: "GET", path: "/holidays", description: "List holiday exceptions.", auth: "admin" },
      { method: "POST", path: "/holidays", description: "Create a holiday exception.", auth: "admin", requestBody: { name: { type: "string", required: true, description: "Holiday name" }, date: { type: "string", required: true, description: "Date (YYYY-MM-DD)" }, is_closed: { type: "boolean", required: false, description: "Full closure" }, open_time: { type: "string", required: false, description: "Modified opening time" }, close_time: { type: "string", required: false, description: "Modified closing time" } } },
      { method: "PUT", path: "/holidays/:id", description: "Update a holiday.", auth: "admin" },
      { method: "DELETE", path: "/holidays/:id", description: "Delete a holiday.", auth: "admin" },
    ],
  },
  {
    title: "Admin API — Routing Rules",
    description: "CRUD for intent/department routing rules.",
    baseUrl: "/api/admin/clients/:clientId",
    endpoints: [
      { method: "GET", path: "/routing", description: "List routing rules.", auth: "admin" },
      { method: "POST", path: "/routing", description: "Create a routing rule.", auth: "admin", requestBody: { department_code: { type: "string", required: false, description: "Department code" }, intent_key: { type: "string", required: false, description: "Intent key" }, condition_type: { type: "string", required: true, description: "intent_match | time_based | fallback" }, action_type: { type: "string", required: true, description: "info_response | transfer | escalate | voicemail" }, action_label: { type: "string", required: false, description: "Display label" }, action_value: { type: "string", required: true, description: "Transfer target, response text, etc." }, priority: { type: "number", required: false, description: "Rule priority (higher = checked first)" }, is_fallback: { type: "boolean", required: false, description: "Fallback rule flag" } } },
      { method: "PUT", path: "/routing/:id", description: "Update a routing rule.", auth: "admin" },
      { method: "DELETE", path: "/routing/:id", description: "Delete a routing rule.", auth: "admin" },
    ],
  },
  {
    title: "Admin API — Intents",
    description: "CRUD for recognized caller intents.",
    baseUrl: "/api/admin/clients/:clientId",
    endpoints: [
      { method: "GET", path: "/intents", description: "List intents.", auth: "admin" },
      { method: "POST", path: "/intents", description: "Create an intent.", auth: "admin", requestBody: { intent_key: { type: "string", required: true, description: "Unique intent key" }, label: { type: "string", required: true, description: "Display label" }, description: { type: "string", required: false, description: "Description" }, department_code: { type: "string", required: false, description: "Associated department" }, priority: { type: "number", required: false, description: "Priority weight" } } },
      { method: "PUT", path: "/intents/:id", description: "Update an intent.", auth: "admin" },
      { method: "DELETE", path: "/intents/:id", description: "Delete an intent.", auth: "admin" },
    ],
  },
  {
    title: "Admin API — Knowledge Base",
    description: "CRUD for FAQ/knowledge base items.",
    baseUrl: "/api/admin/clients/:clientId",
    endpoints: [
      { method: "GET", path: "/kb", description: "List KB items.", auth: "admin" },
      { method: "POST", path: "/kb", description: "Create a KB item.", auth: "admin", requestBody: { category: { type: "string", required: true, description: "Category name" }, question: { type: "string", required: true, description: "FAQ question" }, answer: { type: "string", required: true, description: "FAQ answer" }, department_code: { type: "string", required: false, description: "Department code" }, intent_key: { type: "string", required: false, description: "Associated intent" }, tags: { type: "string[]", required: false, description: "Search tags" }, priority: { type: "number", required: false, description: "Display priority" } } },
      { method: "PUT", path: "/kb/:id", description: "Update a KB item.", auth: "admin" },
      { method: "DELETE", path: "/kb/:id", description: "Delete a KB item.", auth: "admin" },
    ],
  },
  {
    title: "Admin API — Deployments",
    description: "CRUD for Brainbase deployment bindings.",
    baseUrl: "/api/admin/clients/:clientId",
    endpoints: [
      { method: "GET", path: "/deployments", description: "List deployment bindings.", auth: "admin" },
      { method: "POST", path: "/deployments", description: "Create a deployment binding.", auth: "admin", requestBody: { brainbase_deployment_id: { type: "string", required: true, description: "Brainbase deployment ID" }, brainbase_worker_id: { type: "string", required: false, description: "Worker ID" }, channel: { type: "string", required: false, description: "Channel type" }, phone_number: { type: "string", required: false, description: "Associated phone number" }, label: { type: "string", required: false, description: "Friendly label" } } },
      { method: "PUT", path: "/deployments/:id", description: "Update a deployment binding.", auth: "admin" },
      { method: "DELETE", path: "/deployments/:id", description: "Delete a deployment binding.", auth: "admin" },
    ],
  },
  {
    title: "Admin API — Import & Publish",
    description: "CSV import, version publishing, and audit log.",
    baseUrl: "/api/admin/clients/:clientId",
    endpoints: [
      { method: "POST", path: "/imports", description: "Upload a CSV for import. Send as JSON with entity type, column mapping, and rows.", auth: "admin" },
      { method: "GET", path: "/imports", description: "List import jobs.", auth: "admin" },
      { method: "GET", path: "/imports/:id", description: "Get import job details.", auth: "admin" },
      { method: "POST", path: "/imports/:id/approve", description: "Approve and execute a pending import.", auth: "admin" },
      { method: "POST", path: "/publish", description: "Publish the current configuration as a new version.", auth: "admin" },
      { method: "GET", path: "/versions", description: "List published versions.", auth: "admin" },
      { method: "GET", path: "/audit", description: "Get audit log entries.", auth: "admin" },
    ],
  },
  {
    title: "Admin API — Preview Simulator",
    description: "Test routing rules without affecting production.",
    baseUrl: "/api/admin",
    endpoints: [
      {
        method: "POST",
        path: "/preview/simulate",
        description: "Simulate a call/message through the routing engine. Returns what action would be taken.",
        auth: "admin",
        requestBody: {
          client_id: { type: "string", required: true, description: "Client UUID" },
          intent: { type: "string", required: false, description: "Intent key to test" },
          department: { type: "string", required: false, description: "Department code" },
          channel: { type: "string", required: false, description: "Channel type" },
          timestamp: { type: "string", required: false, description: "ISO timestamp (for hours check)" },
        },
      },
    ],
  },
  {
    title: "MCP Server (Model Context Protocol)",
    description:
      "AI-native interface for LLMs and AI agents. Connect via SSE (remote) or stdio (local). Compatible with Claude Desktop, Cursor, and any MCP client.",
    baseUrl: "/mcp",
    endpoints: [
      {
        method: "GET",
        path: "",
        description: "Discovery endpoint — returns server info, available tools, resources, and connection details.",
        auth: "none",
        response: `{
  "name": "call-stream-ai",
  "version": "1.0.0",
  "protocol": "MCP",
  "transports": {
    "sse": { "connect": "/mcp/sse", "messages": "/mcp/messages" },
    "stdio": { "command": "node src/mcp/stdio.mjs" }
  },
  "tools": ["list_clients", "get_client", "create_client", ...],
  "resources": ["clients://list"],
  "prompts": ["onboard_client", "diagnose_routing"]
}`,
      },
      {
        method: "GET",
        path: "/sse",
        description: "SSE transport — connect here for the Server-Sent Events stream. Used by remote MCP clients.",
        auth: "none",
        notes: "Returns an SSE stream. Client must POST JSON-RPC messages to /mcp/messages?sessionId=<id>.",
      },
      {
        method: "POST",
        path: "/messages",
        description: "JSON-RPC message endpoint for SSE transport. Send tool calls and receive results.",
        auth: "none",
        queryParams: {
          sessionId: { type: "string", required: true, description: "Session ID from SSE connection" },
        },
        notes: "Body is a JSON-RPC 2.0 request. The MCP SDK handles serialization.",
      },
    ],
  },
  {
    title: "MCP Tools Reference",
    description:
      "Tools available to AI agents via MCP. Each tool can be called through the SSE or stdio transport.",
    baseUrl: "mcp://tool",
    endpoints: [
      { method: "POST", path: "/list_clients", description: "List all clients configured in Call Stream AI.", auth: "none" },
      { method: "POST", path: "/get_client", description: "Get detailed information about a client by UUID or slug.", auth: "none",
        requestBody: { client_id: { type: "string", required: true, description: "Client UUID or slug" } } },
      { method: "POST", path: "/create_client", description: "Create a new client from a vertical template.", auth: "none",
        requestBody: {
          name: { type: "string", required: true, description: "Client name" },
          vertical: { type: "string", required: true, description: "hotels_resorts | food_beverage | entertainment | recreation_wellness | travel" },
          slug: { type: "string", required: false, description: "URL slug" },
          timezone: { type: "string", required: false, description: "IANA timezone" },
        } },
      { method: "POST", path: "/list_departments", description: "List departments for a client.", auth: "none",
        requestBody: { client_id: { type: "string", required: true, description: "Client UUID" } } },
      { method: "POST", path: "/create_department", description: "Create a department.", auth: "none",
        requestBody: {
          client_id: { type: "string", required: true, description: "Client UUID" },
          name: { type: "string", required: true, description: "Department name" },
          code: { type: "string", required: true, description: "Unique code" },
        } },
      { method: "POST", path: "/get_hours", description: "Get hours of operation for a client.", auth: "none",
        requestBody: { client_id: { type: "string", required: true, description: "Client UUID" }, department_code: { type: "string", required: false, description: "Filter by department" } } },
      { method: "POST", path: "/get_routing_rules", description: "Get routing rules.", auth: "none",
        requestBody: { client_id: { type: "string", required: true, description: "Client UUID" } } },
      { method: "POST", path: "/create_routing_rule", description: "Create a routing rule.", auth: "none",
        requestBody: {
          client_id: { type: "string", required: true, description: "Client UUID" },
          action_type: { type: "string", required: true, description: "info_response | transfer | escalate | voicemail" },
          action_value: { type: "string", required: true, description: "Response text or transfer target" },
        } },
      { method: "POST", path: "/list_intents", description: "List recognized intents.", auth: "none",
        requestBody: { client_id: { type: "string", required: true, description: "Client UUID" } } },
      { method: "POST", path: "/search_kb", description: "Search the knowledge base.", auth: "none",
        requestBody: {
          client_id: { type: "string", required: true, description: "Client UUID" },
          query: { type: "string", required: false, description: "Search text" },
          category: { type: "string", required: false, description: "Category filter" },
        } },
      { method: "POST", path: "/add_kb_item", description: "Add a FAQ / knowledge base item.", auth: "none",
        requestBody: {
          client_id: { type: "string", required: true, description: "Client UUID" },
          category: { type: "string", required: true, description: "Category" },
          question: { type: "string", required: true, description: "Question" },
          answer: { type: "string", required: true, description: "Answer" },
        } },
      { method: "POST", path: "/get_directory", description: "Get phone/extension directory.", auth: "none",
        requestBody: { client_id: { type: "string", required: true, description: "Client UUID" } } },
      { method: "POST", path: "/list_deployments", description: "List Brainbase deployment bindings.", auth: "none",
        requestBody: { client_id: { type: "string", required: true, description: "Client UUID" } } },
      { method: "POST", path: "/create_deployment_binding", description: "Bind a Brainbase deployment to a client.", auth: "none",
        requestBody: {
          client_id: { type: "string", required: true, description: "Client UUID" },
          brainbase_deployment_id: { type: "string", required: true, description: "Deployment ID" },
          channel: { type: "string", required: false, description: "voice | chat | sms | email" },
        } },
      { method: "POST", path: "/resolve_deployment", description: "Simulate routing resolution for a deployment.", auth: "none",
        requestBody: {
          deployment_id: { type: "string", required: true, description: "Brainbase deployment ID" },
          channel: { type: "string", required: false, description: "Channel type" },
          intent: { type: "string", required: false, description: "Intent key" },
          department: { type: "string", required: false, description: "Department code" },
        } },
      { method: "POST", path: "/list_verticals", description: "List available vertical templates.", auth: "none" },
      { method: "POST", path: "/get_audit_log", description: "Get recent audit log for a client.", auth: "none",
        requestBody: { client_id: { type: "string", required: true, description: "Client UUID" } } },
    ],
  },
  {
    title: "MCP Connection Guide",
    description:
      "How to connect AI clients to the Call Stream AI MCP server.",
    baseUrl: "",
    endpoints: [
      {
        method: "GET",
        path: "Claude Desktop / Cursor (Remote SSE)",
        description: "Add this to your Claude Desktop or Cursor MCP configuration file to connect via SSE transport.",
        auth: "none",
        response: `{
  "mcpServers": {
    "callstream": {
      "url": "https://call-stream-ai-api.onrender.com/mcp/sse"
    }
  }
}`,
        notes: "Config file location: Claude Desktop → ~/Library/Application Support/Claude/claude_desktop_config.json | Cursor → .cursor/mcp.json",
      },
      {
        method: "GET",
        path: "Claude Desktop (Local Stdio)",
        description: "Run the MCP server locally via stdio transport for lower latency. Clone the repo first, then add this config.",
        auth: "none",
        response: `{
  "mcpServers": {
    "callstream": {
      "command": "node",
      "args": ["src/mcp/stdio.mjs"],
      "cwd": "/path/to/call-stream-ai/backend",
      "env": {
        "SUPABASE_URL": "https://hzlimpuwcujukcexkbse.supabase.co"
      }
    }
  }
}`,
        notes: "Requires Node.js 18+ and npm install in the backend directory. Set SUPABASE_URL to your project.",
      },
      {
        method: "GET",
        path: "Programmatic (Python MCP Client)",
        description: "Connect from a Python application using the MCP client library.",
        auth: "none",
        response: `from mcp import ClientSession
from mcp.client.sse import sse_client

async with sse_client("https://call-stream-ai-api.onrender.com/mcp/sse") as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()
        
        # List available tools
        tools = await session.list_tools()
        
        # Call a tool
        result = await session.call_tool("list_clients", {})
        print(result)`,
        notes: "Install: pip install mcp",
      },
      {
        method: "GET",
        path: "Programmatic (Node.js MCP Client)",
        description: "Connect from a Node.js application.",
        auth: "none",
        response: `import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
  new URL("https://call-stream-ai-api.onrender.com/mcp/sse")
);
const client = new Client({ name: "my-app", version: "1.0" });
await client.connect(transport);

// List tools
const { tools } = await client.listTools();

// Call a tool
const result = await client.callTool("list_clients", {});
console.log(result);`,
        notes: "Install: npm install @modelcontextprotocol/sdk",
      },
    ],
  },
];

function EndpointCard({ ep, baseUrl }: { ep: Endpoint; baseUrl: string }) {
  const [open, setOpen] = useState(false);
  const fullPath = baseUrl + ep.path;

  return (
    <div className="border border-border rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#111] transition-colors"
      >
        <span
          className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${METHOD_COLORS[ep.method]}`}
        >
          {ep.method}
        </span>
        <code className="text-sm text-white/90 flex-1 font-mono">
          {fullPath}
        </code>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            ep.auth === "runtime"
              ? "bg-purple-500/20 text-purple-300"
              : ep.auth === "admin"
              ? "bg-cyan-500/20 text-cyan-300"
              : "bg-[#333] text-[#888]"
          }`}
        >
          {ep.auth === "runtime"
            ? "x-api-token"
            : ep.auth === "admin"
            ? "Bearer JWT"
            : "public"}
        </span>
        <svg
          className={`w-4 h-4 text-[#555] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-border bg-[#0a0a0a]">
          <p className="text-sm text-[#999] mb-3">{ep.description}</p>

          {ep.queryParams && (
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-[#666] uppercase tracking-wide mb-2">
                Query Parameters
              </h4>
              <div className="space-y-1">
                {Object.entries(ep.queryParams).map(([key, val]) => (
                  <div key={key} className="flex items-start gap-2 text-sm">
                    <code className="text-cyan-400 font-mono text-xs bg-cyan-500/10 px-1.5 py-0.5 rounded">
                      {key}
                    </code>
                    <span className="text-[#555] text-xs">{val.type}</span>
                    {val.required && (
                      <span className="text-red-400 text-xs">required</span>
                    )}
                    <span className="text-[#777] text-xs">{val.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ep.requestBody && (
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-[#666] uppercase tracking-wide mb-2">
                Request Body
              </h4>
              <div className="space-y-1">
                {Object.entries(ep.requestBody).map(([key, val]) => (
                  <div key={key} className="flex items-start gap-2 text-sm">
                    <code className="text-cyan-400 font-mono text-xs bg-cyan-500/10 px-1.5 py-0.5 rounded">
                      {key}
                    </code>
                    <span className="text-[#555] text-xs">{val.type}</span>
                    {val.required && (
                      <span className="text-red-400 text-xs">required</span>
                    )}
                    <span className="text-[#777] text-xs">{val.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ep.response && (
            <div className="mb-2">
              <h4 className="text-xs font-semibold text-[#666] uppercase tracking-wide mb-2">
                Response
              </h4>
              <pre className="bg-[#111] border border-[#222] rounded-lg p-3 text-xs text-[#ccc] font-mono overflow-x-auto whitespace-pre-wrap">
                {ep.response}
              </pre>
            </div>
          )}

          {ep.notes && (
            <p className="text-xs text-[#666] mt-2 italic">{ep.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DocsPage() {
  const [filter, setFilter] = useState("");

  const filtered = API_SECTIONS.map((s) => ({
    ...s,
    endpoints: s.endpoints.filter(
      (ep) =>
        !filter ||
        ep.path.toLowerCase().includes(filter.toLowerCase()) ||
        ep.description.toLowerCase().includes(filter.toLowerCase()) ||
        ep.method.toLowerCase().includes(filter.toLowerCase())
    ),
  })).filter((s) => s.endpoints.length > 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">API Documentation</h1>
        <p className="text-[#888] text-sm mt-1">
          Complete reference for the Call Stream AI REST API.
        </p>
      </div>

      {/* Connection info */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-[#666] mb-1">Base URL</p>
            <code className="text-sm text-cyan-400 font-mono">
              https://call-stream-ai-api.onrender.com
            </code>
          </div>
          <div>
            <p className="text-xs text-[#666] mb-1">Runtime Auth</p>
            <code className="text-xs text-purple-300 font-mono">
              x-api-token: {"<RUNTIME_API_TOKEN>"}
            </code>
          </div>
          <div>
            <p className="text-xs text-[#666] mb-1">Admin Auth</p>
            <code className="text-xs text-cyan-300 font-mono">
              Authorization: Bearer {"<supabase_jwt>"}
            </code>
          </div>
          <div>
            <p className="text-xs text-[#666] mb-1">MCP Transport</p>
            <code className="text-xs text-emerald-300 font-mono">
              SSE: /mcp/sse
            </code>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Filter endpoints..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full max-w-md"
        />
      </div>

      {/* Sections */}
      {filtered.map((section) => (
        <div key={section.title} className="mb-8">
          <h2 className="text-lg font-semibold mb-1">{section.title}</h2>
          <p className="text-sm text-[#777] mb-3">{section.description}</p>
          {section.endpoints.map((ep, i) => (
            <EndpointCard key={i} ep={ep} baseUrl={section.baseUrl} />
          ))}
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center text-[#555] py-12">
          No endpoints match your filter.
        </div>
      )}
    </div>
  );
}
