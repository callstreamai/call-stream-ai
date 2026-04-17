function isCurrentlyOpen(hours, holidays, timestamp, timezone = 'America/New_York') {
  const now = timestamp ? new Date(timestamp) : new Date();

  // Convert to target timezone
  const options = { timeZone: timezone };
  const localStr = now.toLocaleString('en-US', options);
  const localDate = new Date(localStr);

  const dateStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD

  // Check holidays first
  if (holidays && holidays.length > 0) {
    const holiday = holidays.find(h => h.date === dateStr);
    if (holiday) {
      if (holiday.is_closed) return { isOpen: false, reason: 'holiday', holiday: holiday.name };
      if (holiday.open_time && holiday.close_time) {
        const currentMinutes = localDate.getHours() * 60 + localDate.getMinutes();
        const [oh, om] = holiday.open_time.split(':').map(Number);
        const [ch, cm] = holiday.close_time.split(':').map(Number);
        const openMin = oh * 60 + om;
        const closeMin = ch * 60 + cm;
        const isOpen = currentMinutes >= openMin && currentMinutes < closeMin;
        return { isOpen, reason: isOpen ? 'holiday_hours' : 'holiday_closed', holiday: holiday.name };
      }
    }
  }

  // Check regular hours
  const dayOfWeek = localDate.getDay();
  const dayHours = hours.filter(h => h.day_of_week === dayOfWeek);

  if (!dayHours.length) {
    return { isOpen: false, reason: 'no_hours_defined' };
  }

  const closedEntry = dayHours.find(h => h.is_closed);
  if (closedEntry) {
    return { isOpen: false, reason: 'closed_today' };
  }

  const currentMinutes = localDate.getHours() * 60 + localDate.getMinutes();

  for (const h of dayHours) {
    const [oh, om] = h.open_time.split(':').map(Number);
    const [ch, cm] = h.close_time.split(':').map(Number);
    const openMin = oh * 60 + om;
    const closeMin = ch * 60 + cm;

    if (currentMinutes >= openMin && currentMinutes < closeMin) {
      return { isOpen: true, reason: 'within_hours', openTime: h.open_time, closeTime: h.close_time };
    }
  }

  return { isOpen: false, reason: 'outside_hours' };
}

module.exports = { isCurrentlyOpen };
