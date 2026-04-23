import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Pool } = require("pg");

function createPool() {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  const ref = match ? match[1] : "";
  const pw = process.env.DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD || "CsAi2026$ecure!Pwd";
  const connStr = `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-1-us-east-1.pooler.supabase.com:5432/postgres`;
  return new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false }, max: 5 });
}

export function createMcpServer() {
  const pool = createPool();
  
  const server = new McpServer({
    name: "call-stream-ai",
    version: "1.0.0",
  });

  // ──────────────────── TOOLS ────────────────────

  // ── Client Management ──
  
  server.tool(
    "list_clients",
    "List all clients configured in Call Stream AI",
    {},
    async () => {
      const { rows } = await pool.query(
        "SELECT id, name, slug, vertical, status, timezone, created_at FROM clients ORDER BY name"
      );
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.tool(
    "get_client",
    "Get detailed information about a specific client",
    { client_id: z.string().describe("Client UUID or slug") },
    async ({ client_id }) => {
      const isUUID = /^[0-9a-f-]{36}$/.test(client_id);
      const { rows } = await pool.query(
        isUUID
          ? "SELECT * FROM clients WHERE id = $1"
          : "SELECT * FROM clients WHERE slug = $1",
        [client_id]
      );
      if (!rows[0]) return { content: [{ type: "text", text: "Client not found" }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(rows[0], null, 2) }] };
    }
  );

  server.tool(
    "create_client",
    "Create a new client from a vertical template",
    {
      name: z.string().describe("Client name (e.g. The Grand Hotel)"),
      vertical: z.string().describe("Vertical template: hotels_resorts, food_beverage, entertainment, recreation_wellness, or travel"),
      slug: z.string().optional().describe("URL slug (auto-generated from name if omitted)"),
      timezone: z.string().optional().describe("IANA timezone (default: America/New_York)"),
    },
    async ({ name, vertical, slug, timezone }) => {
      const clientSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const tz = timezone || "America/New_York";
      const { rows } = await pool.query(
        `INSERT INTO clients (name, slug, vertical, timezone, status) VALUES ($1, $2, $3, $4, 'draft') RETURNING *`,
        [name, clientSlug, vertical, tz]
      );
      // Clone template data
      const clientId = rows[0].id;
      await pool.query(
        `INSERT INTO departments (client_id, name, code, description, display_order, is_default)
         SELECT $1, name, code, description, display_order, is_default
         FROM vertical_template_departments WHERE vertical = $2`,
        [clientId, vertical]
      );
      await pool.query(
        `INSERT INTO intents (client_id, intent_key, label, description, department_code, priority)
         SELECT $1, intent_key, label, description, department_code, priority
         FROM vertical_template_intents WHERE vertical = $2`,
        [clientId, vertical]
      );
      return { content: [{ type: "text", text: `Created client "${name}" (${clientSlug})\nID: ${clientId}\nVertical: ${vertical}` }] };
    }
  );

  // ── Departments ──

  server.tool(
    "list_departments",
    "List all departments for a client",
    { client_id: z.string().describe("Client UUID") },
    async ({ client_id }) => {
      const { rows } = await pool.query(
        "SELECT id, name, code, description, is_default, display_order FROM departments WHERE client_id = $1 AND is_active = true ORDER BY display_order",
        [client_id]
      );
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.tool(
    "create_department",
    "Create a new department for a client",
    {
      client_id: z.string().describe("Client UUID"),
      name: z.string().describe("Department name"),
      code: z.string().describe("Unique department code (e.g. front_desk)"),
      description: z.string().optional().describe("Description"),
      is_default: z.boolean().optional().describe("Set as default department"),
    },
    async ({ client_id, name, code, description, is_default }) => {
      const { rows } = await pool.query(
        `INSERT INTO departments (client_id, name, code, description, is_default) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [client_id, name, code, description || null, is_default || false]
      );
      return { content: [{ type: "text", text: `Created department "${name}" (${code})` }] };
    }
  );

  // ── Hours of Operation ──

  server.tool(
    "get_hours",
    "Get hours of operation for a client, optionally filtered by department",
    {
      client_id: z.string().describe("Client UUID"),
      department_code: z.string().optional().describe("Filter by department code"),
    },
    async ({ client_id, department_code }) => {
      let sql = `SELECT h.day_of_week, h.open_time, h.close_time, h.is_closed, h.timezone, d.name as department_name, d.code as department_code
                 FROM hours_of_operation h
                 LEFT JOIN departments d ON h.department_id = d.id
                 WHERE h.client_id = $1`;
      const params = [client_id];
      if (department_code) {
        params.push(department_code);
        sql += ` AND d.code = $${params.length}`;
      }
      sql += " ORDER BY d.display_order, h.day_of_week";
      const { rows } = await pool.query(sql, params);
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const formatted = rows.map(r => ({
        ...r,
        day_name: days[r.day_of_week],
        open_time: r.open_time?.substring(0, 5),
        close_time: r.close_time?.substring(0, 5),
      }));
      return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
    }
  );

  // ── Routing Rules ──

  server.tool(
    "get_routing_rules",
    "Get routing rules for a client",
    {
      client_id: z.string().describe("Client UUID"),
      department_code: z.string().optional().describe("Filter by department"),
      intent_key: z.string().optional().describe("Filter by intent"),
    },
    async ({ client_id, department_code, intent_key }) => {
      let sql = `SELECT department_code, intent_key, condition_type, action_type, action_label, action_value, priority, is_fallback
                 FROM routing_rules WHERE client_id = $1 AND is_active = true`;
      const params = [client_id];
      if (department_code) { params.push(department_code); sql += ` AND department_code = $${params.length}`; }
      if (intent_key) { params.push(intent_key); sql += ` AND intent_key = $${params.length}`; }
      sql += " ORDER BY priority DESC";
      const { rows } = await pool.query(sql, params);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.tool(
    "create_routing_rule",
    "Create a routing rule that determines how calls/messages are handled",
    {
      client_id: z.string().describe("Client UUID"),
      action_type: z.enum(["info_response", "transfer", "escalate", "voicemail"]).describe("Action to take"),
      action_value: z.string().describe("Response text, transfer target, or voicemail box"),
      department_code: z.string().optional().describe("Department code to match"),
      intent_key: z.string().optional().describe("Intent key to match"),
      action_label: z.string().optional().describe("Friendly label for this rule"),
      priority: z.number().optional().describe("Priority (higher = checked first)"),
      is_fallback: z.boolean().optional().describe("Is this a fallback rule?"),
    },
    async ({ client_id, action_type, action_value, department_code, intent_key, action_label, priority, is_fallback }) => {
      const { rows } = await pool.query(
        `INSERT INTO routing_rules (client_id, department_code, intent_key, condition_type, action_type, action_label, action_value, priority, is_fallback)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [client_id, department_code || null, intent_key || null, intent_key ? "intent_match" : "fallback",
         action_type, action_label || null, action_value, priority || 0, is_fallback || false]
      );
      return { content: [{ type: "text", text: `Created routing rule (${action_type}: ${action_value})\nID: ${rows[0].id}` }] };
    }
  );

  // ── Intents ──

  server.tool(
    "list_intents",
    "List intents recognized by a client's AI agent",
    { client_id: z.string().describe("Client UUID") },
    async ({ client_id }) => {
      const { rows } = await pool.query(
        "SELECT intent_key, label, description, department_code, priority FROM intents WHERE client_id = $1 AND is_active = true ORDER BY priority DESC",
        [client_id]
      );
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  // ── Knowledge Base ──

  server.tool(
    "search_kb",
    "Search the knowledge base for FAQ items",
    {
      client_id: z.string().describe("Client UUID"),
      query: z.string().optional().describe("Search query (matches question and answer text)"),
      category: z.string().optional().describe("Filter by category"),
      department_code: z.string().optional().describe("Filter by department"),
    },
    async ({ client_id, query, category, department_code }) => {
      let sql = `SELECT category, question, answer, department_code, intent_key, tags, priority
                 FROM kb_items WHERE client_id = $1 AND is_active = true`;
      const params = [client_id];
      if (query) { params.push(`%${query}%`); sql += ` AND (question ILIKE $${params.length} OR answer ILIKE $${params.length})`; }
      if (category) { params.push(category); sql += ` AND category = $${params.length}`; }
      if (department_code) { params.push(department_code); sql += ` AND department_code = $${params.length}`; }
      sql += " ORDER BY priority DESC LIMIT 20";
      const { rows } = await pool.query(sql, params);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.tool(
    "add_kb_item",
    "Add a knowledge base / FAQ item",
    {
      client_id: z.string().describe("Client UUID"),
      category: z.string().describe("Category (e.g. Check-In/Out, Amenities, Policies)"),
      question: z.string().describe("The question"),
      answer: z.string().describe("The answer"),
      department_code: z.string().optional().describe("Associated department code"),
      intent_key: z.string().optional().describe("Associated intent key"),
    },
    async ({ client_id, category, question, answer, department_code, intent_key }) => {
      await pool.query(
        `INSERT INTO kb_items (client_id, category, question, answer, department_code, intent_key) VALUES ($1, $2, $3, $4, $5, $6)`,
        [client_id, category, question, answer, department_code || null, intent_key || null]
      );
      return { content: [{ type: "text", text: `Added KB item: "${question}" → "${answer.substring(0, 60)}..."` }] };
    }
  );

  // ── Directory ──

  server.tool(
    "get_directory",
    "Get the phone/extension directory for a client",
    { client_id: z.string().describe("Client UUID") },
    async ({ client_id }) => {
      const { rows } = await pool.query(
        "SELECT name, phone_number, extension, email, entry_type, metadata FROM directory_entries WHERE client_id = $1 AND is_active = true",
        [client_id]
      );
      return { content: [{ type: "text", text: rows.length ? JSON.stringify(rows, null, 2) : "No directory entries found" }] };
    }
  );

  // ── Deployment Bindings ──

  server.tool(
    "list_deployments",
    "List Brainbase deployment bindings for a client",
    { client_id: z.string().describe("Client UUID") },
    async ({ client_id }) => {
      const { rows } = await pool.query(
        "SELECT id, brainbase_deployment_id, brainbase_worker_id, channel, phone_number, label, is_active FROM deployment_bindings WHERE client_id = $1",
        [client_id]
      );
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.tool(
    "create_deployment_binding",
    "Bind a Brainbase deployment to a client",
    {
      client_id: z.string().describe("Client UUID"),
      brainbase_deployment_id: z.string().describe("Brainbase deployment ID"),
      channel: z.enum(["voice", "chat", "sms", "email"]).optional().describe("Channel type (default: voice)"),
      phone_number: z.string().optional().describe("Associated phone number"),
      label: z.string().optional().describe("Friendly label"),
    },
    async ({ client_id, brainbase_deployment_id, channel, phone_number, label }) => {
      const { rows } = await pool.query(
        `INSERT INTO deployment_bindings (client_id, brainbase_deployment_id, channel, phone_number, label) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [client_id, brainbase_deployment_id, channel || "voice", phone_number || null, label || null]
      );
      return { content: [{ type: "text", text: `Created deployment binding\nID: ${rows[0].id}\nDeployment: ${brainbase_deployment_id}` }] };
    }
  );

  // ── Runtime Resolution ──

  server.tool(
    "resolve_deployment",
    "Simulate what happens when a call/message comes in for a specific deployment — shows the routing action, hours status, and FAQ context",
    {
      deployment_id: z.string().describe("Brainbase deployment ID"),
      channel: z.enum(["voice", "chat", "sms", "email"]).optional().describe("Channel (default: voice)"),
      intent: z.string().optional().describe("Caller intent"),
      department: z.string().optional().describe("Target department code"),
    },
    async ({ deployment_id, channel, intent, department }) => {
      const ch = channel || "voice";
      const binding = (await pool.query(
        "SELECT * FROM deployment_bindings WHERE brainbase_deployment_id = $1 AND is_active = true LIMIT 1",
        [deployment_id]
      )).rows[0];
      if (!binding) return { content: [{ type: "text", text: "No binding found for this deployment ID" }], isError: true };

      const cid = binding.client_id;
      const [client, rules, hours, kb] = await Promise.all([
        pool.query("SELECT name, slug, timezone FROM clients WHERE id = $1", [cid]),
        pool.query("SELECT * FROM routing_rules WHERE client_id = $1 AND is_active = true ORDER BY priority DESC", [cid]),
        pool.query("SELECT day_of_week, open_time, close_time, is_closed, timezone FROM hours_of_operation WHERE client_id = $1", [cid]),
        pool.query("SELECT question, answer, category FROM kb_items WHERE client_id = $1 AND is_active = true ORDER BY priority DESC LIMIT 5", [cid]),
      ]);

      let matched = null;
      const r = rules.rows;
      if (department && intent) matched = r.find(x => x.department_code === department && x.intent_key === intent && !x.is_fallback);
      if (!matched && department) matched = r.find(x => x.department_code === department && !x.intent_key && !x.is_fallback);
      if (!matched && intent) matched = r.find(x => x.intent_key === intent && !x.department_code && !x.is_fallback);
      if (!matched) matched = r.find(x => x.is_fallback);

      const result = {
        client: client.rows[0],
        channel: ch,
        matched_rule: matched ? { action_type: matched.action_type, action_label: matched.action_label, action_value: matched.action_value } : null,
        total_rules: rules.rows.length,
        hours_entries: hours.rows.length,
        top_faq: kb.rows,
      };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── Verticals ──


  server.tool(
    "check_operating_status",
    "Get the current local time, day of week, and real-time open/closed status for a client location. Use this when you need to know if a business is currently open, what time it is locally, or whether today is a holiday.",
    {
      client_id: z.string().describe("Client UUID"),
      department_code: z.string().optional().describe("Specific department to check (default: checks the default department)"),
      check_all: z.boolean().optional().describe("Return status for ALL departments"),
    },
    async ({ client_id, department_code, check_all }) => {
      // 1. Get client timezone
      const clientRes = await pool.query(
        "SELECT id, name, slug, timezone, status FROM clients WHERE id = $1", [client_id]
      );
      if (!clientRes.rows[0]) return { content: [{ type: "text", text: "Client not found" }], isError: true };

      const client = clientRes.rows[0];
      const tz = client.timezone || "America/New_York";

      // 2. Compute local time
      const nowUtc = new Date();
      const localStr = nowUtc.toLocaleString("en-US", { timeZone: tz });
      const localDate = new Date(localStr);
      const localTime = nowUtc.toLocaleTimeString("en-US", { timeZone: tz, hour12: true });
      const localTimeShort = nowUtc.toLocaleTimeString("en-US", { timeZone: tz, hour12: true, hour: "numeric", minute: "2-digit" });
      const localDateStr = nowUtc.toLocaleDateString("en-CA", { timeZone: tz });
      const dow = localDate.getDay();
      const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

      // 3. Check holidays
      const holidays = (await pool.query(
        "SELECT h.name, h.is_closed, h.open_time, h.close_time, d.code as dept FROM holiday_exceptions h LEFT JOIN departments d ON h.department_id = d.id WHERE h.client_id = $1 AND h.date = $2::date",
        [client_id, localDateStr]
      )).rows;

      // 4. Get hours for today
      let hoursQ = "SELECT h.open_time, h.close_time, h.is_closed, d.name as dept_name, d.code as dept_code, d.is_default FROM hours_of_operation h LEFT JOIN departments d ON h.department_id = d.id WHERE h.client_id = $1 AND h.day_of_week = $2";
      const params = [client_id, dow];
      if (department_code && !check_all) { params.push(department_code); hoursQ += " AND d.code = $" + params.length; }
      hoursQ += " ORDER BY d.is_default DESC, d.display_order";

      const hours = (await pool.query(hoursQ, params)).rows;
      const currentMin = localDate.getHours() * 60 + localDate.getMinutes();

      const depts = hours.map(row => {
        const hol = holidays.find(h => !h.dept || h.dept === row.dept_code);
        let isOpen = false, reason = "";
        if (hol) {
          if (hol.is_closed) { isOpen = false; reason = "Closed for " + hol.name; }
          else if (hol.open_time && hol.close_time) {
            const [oh,om] = hol.open_time.substring(0,5).split(":").map(Number);
            const [ch,cm] = hol.close_time.substring(0,5).split(":").map(Number);
            isOpen = currentMin >= oh*60+om && currentMin < ch*60+cm;
            reason = "Holiday hours (" + hol.name + ")";
          }
        } else if (row.is_closed) {
          isOpen = false; reason = "Closed on " + days[dow];
        } else {
          const [oh,om] = row.open_time.substring(0,5).split(":").map(Number);
          const [ch,cm] = row.close_time.substring(0,5).split(":").map(Number);
          const openMin = oh*60+om, closeMin = ch*60+cm;
          isOpen = closeMin <= openMin
            ? (currentMin >= openMin || currentMin < closeMin)
            : (currentMin >= openMin && currentMin < closeMin);
          reason = isOpen ? "Within operating hours" : "Outside operating hours";
        }
        return {
          department: row.dept_name || "Default",
          code: row.dept_code || "default",
          is_open: isOpen,
          status: isOpen ? "OPEN" : "CLOSED",
          reason: reason,
          hours: row.is_closed ? "Closed today" : row.open_time.substring(0,5) + " - " + row.close_time.substring(0,5),
        };
      });

      const primary = depts.find(d => d.code === (department_code || null)) || depts[0];

      const result = {
        client: client.name,
        timezone: tz,
        local_time: localTimeShort,
        local_date: localDateStr,
        day_of_week: days[dow],
        is_weekend: dow === 0 || dow === 6,
        is_holiday: holidays.length > 0,
        holiday_name: holidays.length > 0 ? holidays[0].name : null,
        status: primary ? primary.status : "UNKNOWN",
        is_open: primary ? primary.is_open : false,
        reason: primary ? primary.reason : "No hours configured",
        departments: check_all ? depts : undefined,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "list_verticals",
    "List available vertical templates for creating new clients",
    {},
    async () => {
      const { rows } = await pool.query(
        "SELECT DISTINCT vertical, COUNT(*) as department_count FROM vertical_template_departments GROUP BY vertical ORDER BY vertical"
      );
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  // ── Audit Log ──

  server.tool(
    "get_audit_log",
    "Get recent audit log entries for a client",
    {
      client_id: z.string().describe("Client UUID"),
      limit: z.number().optional().describe("Max entries to return (default: 20)"),
    },
    async ({ client_id, limit }) => {
      const { rows } = await pool.query(
        "SELECT entity_type, action, changes, user_email, created_at FROM audit_log WHERE client_id = $1 ORDER BY created_at DESC LIMIT $2",
        [client_id, limit || 20]
      );
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  // ──────────────────── RESOURCES ────────────────────

  server.resource(
    "client_list",
    "clients://list",
    async (uri) => {
      const { rows } = await pool.query("SELECT id, name, slug, vertical, status FROM clients ORDER BY name");
      return { contents: [{ uri: uri.href, text: JSON.stringify(rows, null, 2), mimeType: "application/json" }] };
    }
  );

  // ──────────────────── PROMPTS ────────────────────

  server.prompt(
    "onboard_client",
    "Generate a step-by-step plan to onboard a new client onto Call Stream AI",
    { client_name: z.string().describe("The client business name"), vertical: z.string().describe("Business type") },
    ({ client_name, vertical }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Create a detailed onboarding plan for "${client_name}" (${vertical} vertical) on Call Stream AI. Include:\n1. Client creation with appropriate vertical template\n2. Department customization\n3. Hours of operation setup\n4. Routing rules configuration\n5. Knowledge base population\n6. Deployment binding\n7. Testing checklist`
        }
      }]
    })
  );

  server.prompt(
    "diagnose_routing",
    "Analyze routing configuration for potential issues",
    { client_id: z.string().describe("Client UUID") },
    ({ client_id }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Analyze the routing configuration for client ${client_id}. Use the get_routing_rules, list_departments, and list_intents tools to:\n1. Check for missing fallback rules\n2. Find intents without routing rules\n3. Identify departments with no routing coverage\n4. Check for conflicting priority levels\n5. Verify all action_values are valid`
        }
      }]
    })
  );

  return { server, pool };
}
