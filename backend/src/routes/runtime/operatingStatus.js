const { getPool } = require('../../config/db');

/**
 * GET /api/runtime/:clientId/now
 * 
 * Real-time operating status for a client location.
 * Computes current local time, day-of-week, business hours status,
 * and holiday/closure exceptions.
 * 
 * Query params:
 *   ?department=<code>  — filter to a specific department
 *   ?check_all=true     — return status for ALL departments
 */
async function getOperatingStatus(req, res) {
  const { clientId } = req.params;
  const departmentFilter = req.query.department || null;
  const checkAll = req.query.check_all === 'true';

  const pool = getPool();

  try {
    // 1. Look up client and timezone
    const clientResult = await pool.query(
      'SELECT id, name, slug, timezone, status FROM clients WHERE id = $1',
      [clientId]
    );

    if (!clientResult.rows[0]) {
      return res.status(404).json({
        error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' }
      });
    }

    const client = clientResult.rows[0];
    const tz = client.timezone || 'America/New_York';

    // 2. Calculate current local time in client's timezone
    const nowUtc = new Date();
    const localStr = nowUtc.toLocaleString('en-US', { timeZone: tz });
    const localDate = new Date(localStr);

    const localTime = nowUtc.toLocaleTimeString('en-US', { timeZone: tz, hour12: true }); // h:MM:SS AM/PM
    const localTimeShort = nowUtc.toLocaleTimeString('en-US', { timeZone: tz, hour12: true, hour: 'numeric', minute: '2-digit' }); // h:MM AM/PM
    const localDateStr = nowUtc.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
    const dayOfWeek = localDate.getDay(); // 0=Sun, 6=Sat
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];

    // 3. Check for holiday exceptions today
    const holidayResult = await pool.query(
      `SELECT h.name, h.is_closed, h.open_time, h.close_time, d.name as department_name, d.code as department_code
       FROM holiday_exceptions h
       LEFT JOIN departments d ON h.department_id = d.id
       WHERE h.client_id = $1 AND h.date = $2::date`,
      [clientId, localDateStr]
    );

    const holidays = holidayResult.rows;
    const isHoliday = holidays.length > 0;

    // 4. Get today's operating hours
    let hoursQuery = `
      SELECT h.day_of_week, h.open_time, h.close_time, h.is_closed, h.timezone,
             d.name as department_name, d.code as department_code, d.is_default
      FROM hours_of_operation h
      LEFT JOIN departments d ON h.department_id = d.id
      WHERE h.client_id = $1 AND h.day_of_week = $2`;
    const hoursParams = [clientId, dayOfWeek];

    if (departmentFilter && !checkAll) {
      hoursParams.push(departmentFilter);
      hoursQuery += ` AND d.code = $${hoursParams.length}`;
    }

    hoursQuery += ' ORDER BY d.is_default DESC, d.display_order';

    const hoursResult = await pool.query(hoursQuery, hoursParams);

    // 5. Compute operating status for each department
    const departments = [];
    const currentMinutes = localDate.getHours() * 60 + localDate.getMinutes();

    for (const row of hoursResult.rows) {
      // Check if there's a holiday override for this department
      const deptHoliday = holidays.find(
        hol => !hol.department_code || hol.department_code === row.department_code
      );

      let isOpen = false;
      let statusReason = '';
      let effectiveOpen = null;
      let effectiveClose = null;

      if (deptHoliday) {
        if (deptHoliday.is_closed) {
          isOpen = false;
          statusReason = `Closed for ${deptHoliday.name}`;
        } else if (deptHoliday.open_time && deptHoliday.close_time) {
          // Holiday with modified hours
          effectiveOpen = deptHoliday.open_time.substring(0, 5);
          effectiveClose = deptHoliday.close_time.substring(0, 5);
          const [oh, om] = effectiveOpen.split(':').map(Number);
          const [ch, cm] = effectiveClose.split(':').map(Number);
          const openMin = oh * 60 + om;
          const closeMin = ch * 60 + cm;
          isOpen = currentMinutes >= openMin && currentMinutes < closeMin;
          statusReason = `Holiday hours for ${deptHoliday.name}`;
        }
      } else if (row.is_closed) {
        isOpen = false;
        statusReason = `Closed on ${dayName}`;
      } else {
        effectiveOpen = row.open_time.substring(0, 5);
        effectiveClose = row.close_time.substring(0, 5);
        const [oh, om] = effectiveOpen.split(':').map(Number);
        const [ch, cm] = effectiveClose.split(':').map(Number);
        const openMin = oh * 60 + om;
        const closeMin = ch * 60 + cm;

        // Handle overnight hours (close < open means crosses midnight)
        if (closeMin <= openMin) {
          isOpen = currentMinutes >= openMin || currentMinutes < closeMin;
        } else {
          isOpen = currentMinutes >= openMin && currentMinutes < closeMin;
        }
        statusReason = isOpen ? 'Within operating hours' : 'Outside operating hours';
      }

      // Calculate time until next transition
      let minutesUntilChange = null;
      if (effectiveOpen && effectiveClose) {
        const [oh, om] = effectiveOpen.split(':').map(Number);
        const [ch, cm] = effectiveClose.split(':').map(Number);
        const openMin = oh * 60 + om;
        const closeMin = ch * 60 + cm;

        if (isOpen) {
          // Minutes until closing
          if (closeMin > currentMinutes) {
            minutesUntilChange = closeMin - currentMinutes;
          } else {
            minutesUntilChange = (1440 - currentMinutes) + closeMin;
          }
        } else {
          // Minutes until opening
          if (openMin > currentMinutes) {
            minutesUntilChange = openMin - currentMinutes;
          } else {
            // Opens tomorrow
            minutesUntilChange = (1440 - currentMinutes) + openMin;
          }
        }
      }

      departments.push({
        department: row.department_name || 'Default',
        department_code: row.department_code || 'default',
        is_default: row.is_default || false,
        is_open: isOpen,
        status: isOpen ? 'open' : 'closed',
        reason: statusReason,
        hours_today: effectiveOpen && effectiveClose
          ? { open: effectiveOpen, close: effectiveClose }
          : (row.is_closed ? null : { open: '00:00', close: '23:59' }),
        minutes_until_change: minutesUntilChange,
        time_until_change: minutesUntilChange
          ? `${Math.floor(minutesUntilChange / 60)}h ${minutesUntilChange % 60}m`
          : null,
      });
    }

    // 6. Compute overall status (default department, or first department)
    const defaultDept = departments.find(d => d.is_default) || departments[0];
    const overallOpen = defaultDept ? defaultDept.is_open : false;

    // 7. Build response
    const response = {
      client_id: client.id,
      client_name: client.name,
      client_slug: client.slug,
      timezone: tz,

      // Current local time
      local: {
        date: localDateStr,
        time: localTime,
        time_short: localTimeShort,
        day_of_week: dayOfWeek,
        day_name: dayName,
        is_weekend: dayOfWeek === 0 || dayOfWeek === 6,
      },

      // UTC reference
      utc: {
        timestamp: nowUtc.toISOString(),
        offset: getUtcOffset(nowUtc, tz),
      },

      // Operating status
      status: {
        is_open: overallOpen,
        summary: overallOpen ? 'Open' : 'Closed',
        reason: defaultDept ? defaultDept.reason : 'No hours configured',
        is_holiday: isHoliday,
        holiday_name: isHoliday ? holidays[0].name : null,
      },

      // Per-department breakdown
      departments: checkAll || departmentFilter ? departments : (defaultDept ? [defaultDept] : []),

      // Computed at
      computed_at: nowUtc.toISOString(),
    };

    res.json(response);

  } catch (err) {
    console.error('[Runtime] Operating status error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to compute operating status' }
    });
  }
}

/**
 * Calculate UTC offset string for a timezone (e.g., "-04:00")
 */
function getUtcOffset(date, tz) {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const localStr = date.toLocaleString('en-US', { timeZone: tz });
  const diff = (new Date(localStr) - new Date(utcStr)) / 60000; // minutes
  const hours = Math.floor(Math.abs(diff) / 60);
  const minutes = Math.abs(diff) % 60;
  const sign = diff >= 0 ? '+' : '-';
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

module.exports = { getOperatingStatus };
