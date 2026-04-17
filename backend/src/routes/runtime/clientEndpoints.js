const db = require('../../config/db');
const { cacheService } = require('../../services/cache');
const { isCurrentlyOpen } = require('../../utils/hours');

const SAFE_FALLBACK = { type: 'transfer', value: 'operator_transfer', label: 'General Operator' };

async function getDirectory(req, res) {
  try {
    const { clientId } = req.params;
    const { department } = req.query;

    const cacheKey = cacheService.buildKey(['directory', clientId, department]);
    let data = cacheService.get(cacheKey);

    if (!data) {
      let sql = `
        SELECT de.name, de.phone_number, de.extension, de.email, de.entry_type, de.metadata
        FROM directory_entries de
        WHERE de.client_id = $1 AND de.is_active = true
      `;
      const params = [clientId];

      if (department) {
        sql += ` AND de.department_id = (
          SELECT id FROM departments WHERE client_id = $1 AND code = $2 LIMIT 1
        )`;
        params.push(department);
      }

      data = await db.queryRows(sql, params);
      cacheService.set(cacheKey, data, 120);
    }

    res.json({ clientId, directory: data, count: data.length });
  } catch (err) {
    console.error('[RUNTIME] directory error:', err);
    res.status(500).json({ error: { code: 'DIRECTORY_ERROR', message: 'Failed to fetch directory', safeFallback: SAFE_FALLBACK } });
  }
}

async function getHours(req, res) {
  try {
    const { clientId } = req.params;
    const { department, timestamp } = req.query;

    const cacheKey = cacheService.buildKey(['hours', clientId, department, timestamp]);
    let data = cacheService.get(cacheKey);

    if (!data) {
      let hoursSql = `
        SELECT day_of_week, open_time, close_time, is_closed, timezone
        FROM hours_of_operation
        WHERE client_id = $1
      `;
      const hoursParams = [clientId];

      if (department) {
        hoursSql += ` AND department_id = (
          SELECT id FROM departments WHERE client_id = $1 AND code = $2 LIMIT 1
        )`;
        hoursParams.push(department);
      }

      const [hoursResult, holidaysResult] = await Promise.all([
        db.queryRows(hoursSql, hoursParams),
        db.queryRows(
          `SELECT name, date, is_closed, open_time, close_time
           FROM holiday_exceptions WHERE client_id = $1`,
          [clientId]
        )
      ]);

      const hours = hoursResult || [];
      const holidays = holidaysResult || [];
      const tz = hours[0]?.timezone || 'America/New_York';
      const status = isCurrentlyOpen(hours, holidays, timestamp, tz);

      data = { hours, holidays, currentStatus: status };
      cacheService.set(cacheKey, data, 60);
    }

    res.json({ clientId, ...data });
  } catch (err) {
    console.error('[RUNTIME] hours error:', err);
    res.status(500).json({ error: { code: 'HOURS_ERROR', message: 'Failed to fetch hours', safeFallback: SAFE_FALLBACK } });
  }
}

async function getRouting(req, res) {
  try {
    const { clientId } = req.params;
    const { department, intent } = req.query;

    const cacheKey = cacheService.buildKey(['routing', clientId, department, intent]);
    let data = cacheService.get(cacheKey);

    if (!data) {
      let sql = `
        SELECT department_code, intent_key, condition_type, action_type,
               action_label, action_value, priority, is_fallback
        FROM routing_rules
        WHERE client_id = $1 AND is_active = true
      `;
      const params = [clientId];

      if (department) {
        params.push(department);
        sql += ` AND department_code = $${params.length}`;
      }
      if (intent) {
        params.push(intent);
        sql += ` AND intent_key = $${params.length}`;
      }

      sql += ' ORDER BY priority DESC';

      data = await db.queryRows(sql, params);
      cacheService.set(cacheKey, data, 120);
    }

    res.json({ clientId, rules: data, count: data.length });
  } catch (err) {
    console.error('[RUNTIME] routing error:', err);
    res.status(500).json({ error: { code: 'ROUTING_ERROR', message: 'Failed to fetch routing', safeFallback: SAFE_FALLBACK } });
  }
}

async function getContext(req, res) {
  try {
    const { clientId } = req.params;

    const cacheKey = cacheService.buildKey(['context', clientId]);
    let data = cacheService.get(cacheKey);

    if (!data) {
      const [depts, intents] = await Promise.all([
        db.queryRows(
          `SELECT name, code, is_default FROM departments
           WHERE client_id = $1 AND is_active = true ORDER BY display_order`,
          [clientId]
        ),
        db.queryRows(
          `SELECT intent_key, label, department_code, priority FROM intents
           WHERE client_id = $1 AND is_active = true ORDER BY priority DESC`,
          [clientId]
        )
      ]);

      data = { departments: depts, intents };
      cacheService.set(cacheKey, data, 120);
    }

    res.json({ clientId, ...data });
  } catch (err) {
    console.error('[RUNTIME] context error:', err);
    res.status(500).json({ error: { code: 'CONTEXT_ERROR', message: 'Failed to fetch context', safeFallback: SAFE_FALLBACK } });
  }
}

async function getFaq(req, res) {
  try {
    const { clientId } = req.params;
    const { category, department, intent, q } = req.query;

    const cacheKey = cacheService.buildKey(['faq', clientId, category, department, intent, q]);
    let data = cacheService.get(cacheKey);

    if (!data) {
      let sql = `
        SELECT category, question, answer, department_code, intent_key, tags, priority
        FROM kb_items
        WHERE client_id = $1 AND is_active = true
      `;
      const params = [clientId];

      if (category) {
        params.push(category);
        sql += ` AND category = $${params.length}`;
      }
      if (department) {
        params.push(department);
        sql += ` AND department_code = $${params.length}`;
      }
      if (intent) {
        params.push(intent);
        sql += ` AND intent_key = $${params.length}`;
      }
      if (q) {
        params.push(`%${q}%`);
        sql += ` AND (question ILIKE $${params.length} OR answer ILIKE $${params.length})`;
      }

      sql += ' ORDER BY priority DESC';

      data = await db.queryRows(sql, params);
      cacheService.set(cacheKey, data, 120);
    }

    res.json({ clientId, items: data, count: data.length });
  } catch (err) {
    console.error('[RUNTIME] faq error:', err);
    res.status(500).json({ error: { code: 'FAQ_ERROR', message: 'Failed to fetch FAQ', safeFallback: SAFE_FALLBACK } });
  }
}

module.exports = { getDirectory, getHours, getRouting, getContext, getFaq };
