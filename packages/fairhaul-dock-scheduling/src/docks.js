// Fairhaul Dock Scheduling: dock appointment plan for a day, and a review of past appointments. Pure functions.
import { str, num, groupBy, isoDate } from 'fairhaul-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const REQUEST_FIELDS = Object.freeze({
  load_id: t(['Load ID', 'PO', 'Shipment ID', 'Reference'], { required: true }),
  carrier: t(['Carrier', 'Carrier Name', 'SCAC']),
  direction: t(['Direction', 'In/Out', 'Type']),
  door_type: t(['Door Type', 'Equipment', 'Trailer Type']),
  pallets: t(['Pallets', 'Pallet Count'], { type: 'number' }),
  floor_loaded: t(['Floor Loaded', 'Floor Load', 'Loose'], { type: 'bool' }),
  window_start: t(['Window Start', 'Earliest', 'Requested Time', 'Requested']),
  window_end: t(['Window End', 'Latest']),
  priority: t(['Priority', 'Hot'], { type: 'number' }),
});
export const HISTORY_FIELDS = Object.freeze({
  load_id: t(['Load ID', 'PO', 'Shipment ID', 'Reference'], { required: true }),
  carrier: t(['Carrier', 'Carrier Name', 'SCAC']),
  load_type: t(['Load Type', 'Type', 'Floor Loaded']),
  pallets: t(['Pallets', 'Pallet Count'], { type: 'number' }),
  appointment_at: t(['Appointment', 'Appointment At', 'Appt'], { type: 'datetime', required: true }),
  arrived_at: t(['Arrived', 'Arrived At', 'Check In', 'Gate In'], { type: 'datetime' }),
  door_at: t(['Door', 'Door At', 'At Door', 'Unload Start'], { type: 'datetime' }),
  departed_at: t(['Departed', 'Departed At', 'Check Out', 'Gate Out'], { type: 'datetime' }),
});
export const DOCK_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['doors'],
  properties: {
    note: { type: 'string' },
    doors: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string' }, types: { type: 'array', items: { type: 'string' } } } } },
    open: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'Dock opens, HH:MM (default 06:00)' },
    close: { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'Last unload must finish by, HH:MM (default 18:00)' },
    crews: { type: 'integer', minimum: 1, description: 'Loads that can be worked at the same time (default: one per door)' },
    setup_minutes: { type: 'number', minimum: 0, description: 'Minutes per appointment for check-in and paperwork (default 15)' },
    minutes_per_pallet: { type: 'number', minimum: 0, description: 'Minutes per palletised pallet (default 2)' },
    minutes_per_floor_pallet: { type: 'number', minimum: 0, description: 'Minutes per pallet-equivalent when floor loaded (default 6)' },
    slot_minutes: { type: 'integer', minimum: 5, maximum: 120, description: 'Start times snap to this grid (default 15)' },
    grace_minutes: { type: 'number', minimum: 0, description: 'Arrival within this many minutes of the appointment counts as on time (default 15)' },
  },
});
// "08:00", "8:00", "2:30 PM", "12:15 am" and the time part of "2026-11-18T14:00" are all read.
const hm = (v) => { const m = /(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?m?\b/i.exec(str(v)); if (!m) return null; let h = +m[1]; if (m[3]) { const pm = /p/i.test(m[3]); if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; } return h * 60 + +m[2]; };
const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const mins = (a, b) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 60000) : null);
const pct = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };

/** Duration in minutes for one request under the dock settings. */
export function duration(r, cfg = {}) {
  const floor = r.floor_loaded === true || /yes|true|floor/i.test(str(r.floor_loaded));
  return Math.ceil((cfg.setup_minutes ?? 15) + (num(r.pallets) || 0) * (floor ? cfg.minutes_per_floor_pallet ?? 6 : cfg.minutes_per_pallet ?? 2));
}

/**
 * Place each request on the earliest door of the right type, within its window and the dock hours,
 * without exceeding crews. Requests with the earliest window end go first; priority breaks ties.
 */
export function planDay(requests, cfg) {
  const open = hm(cfg.open || '06:00'), close = hm(cfg.close || '18:00'), grid = cfg.slot_minutes || 15;
  const crews = cfg.crews || cfg.doors.length;
  const doors = cfg.doors.map((d) => ({ name: d.name, types: (d.types || []).map((x) => x.toLowerCase()), busy: [] }));
  const all = []; const free = (d, s, e) => d.busy.every(([a, b]) => e <= a || s >= b);
  const crewOk = (s, e) => { for (let m = s; m < e; m += 5) if (all.filter(([a, b]) => m >= a && m < b).length >= crews) return false; return true; };
  const reqs = requests.map((r, i) => ({ r, i, dur: duration(r, cfg), ws: hm(r.window_start) ?? open, we: hm(r.window_end) ?? close, type: str(r.door_type).toLowerCase() }));
  reqs.sort((a, b) => a.we - b.we || (num(b.r.priority) || 0) - (num(a.r.priority) || 0) || a.ws - b.ws);
  const out = [];
  for (const q of reqs) {
    const fits = doors.filter((d) => !q.type || !d.types.length || d.types.includes(q.type));
    let placed = null;
    if (fits.length) for (let s = Math.max(open, Math.ceil(q.ws / grid) * grid); s <= q.we && s + q.dur <= close && !placed; s += grid) {
      if (!crewOk(s, s + q.dur)) continue;
      const d = fits.find((x) => free(x, s, s + q.dur)); if (d) placed = { d, s };
    }
    const base = { load_id: str(q.r.load_id), carrier: str(q.r.carrier), direction: str(q.r.direction) || 'inbound', door_type: q.type || 'any', pallets: num(q.r.pallets), minutes: q.dur, window: `${fmt(q.ws)}-${fmt(q.we)}` };
    if (placed) { placed.d.busy.push([placed.s, placed.s + q.dur]); all.push([placed.s, placed.s + q.dur]); out.push({ ...base, door: placed.d.name, start: fmt(placed.s), end: fmt(placed.s + q.dur), status: 'scheduled', reason: '' }); }
    else out.push({ ...base, door: '', start: '', end: '', status: 'no_slot', reason: !fits.length ? `no door takes ${q.type}` : q.dur > close - open ? 'longer than the dock day' : Math.max(open, q.ws) + q.dur > close ? `needs ${q.dur} minutes; the dock closes before it could finish` : 'every fitting door or crew is busy in the window; offer another window' });
  }
  out.sort((a, b) => (a.start || '99').localeCompare(b.start || '99') || a.door.localeCompare(b.door));
  const day = close - open;
  const doorUse = doors.map((d) => { const used = d.busy.reduce((a, [s, e]) => a + e - s, 0); return { door: d.name, types: d.types.join(' ') || 'any', appointments: d.busy.length, minutes_used: used, utilisation_pct: Math.round((used / day) * 100) }; });
  const hours = []; for (let h = Math.floor(open / 60); h < Math.ceil(close / 60); h++) { const s = h * 60, e = s + 60; hours.push({ hour: fmt(s), working: all.filter(([a, b]) => a < e && b > s).length, crews }); }
  return { requests: requests.length, scheduled: out.filter((x) => x.status === 'scheduled').length, no_slot: out.filter((x) => x.status === 'no_slot').length, dock_hours: `${fmt(open)}-${fmt(close)}`, doors: doors.length, crews, utilisation_pct: Math.round((doorUse.reduce((a, d) => a + d.minutes_used, 0) / (day * doors.length)) * 100), schedule: out, by_door: doorUse, by_hour: hours };
}

/** Review past appointments: arrival against appointment, waits, no-shows, and how long each kind of load took. */
export function reviewHistory(rows, { graceMinutes = 15, asOf = null } = {}) {
  const cut = asOf ? Date.parse(isoDate(asOf) + 'T23:59:59Z') : Infinity;
  const items = rows.filter((r) => Date.parse(r.appointment_at) <= cut).map((r) => {
    const late = mins(r.appointment_at, r.arrived_at); const wait = mins(r.arrived_at, r.door_at); const work = mins(r.door_at, r.departed_at); const turn = mins(r.arrived_at, r.departed_at);
    const floor = /floor|loose|yes|true/i.test(str(r.load_type));
    const status = !r.arrived_at ? 'no_show' : late > graceMinutes ? 'late' : late < -60 ? 'early' : 'on_time';
    return { load_id: str(r.load_id), carrier: str(r.carrier) || '(none)', load_type: floor ? 'floor' : 'palletised', pallets: num(r.pallets), appointment_at: str(r.appointment_at), hour: str(r.appointment_at).slice(11, 13) + ':00', status, minutes_late: late, wait_minutes: wait, work_minutes: work, turn_minutes: turn };
  });
  const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const byCarrier = [...groupBy(items, (x) => x.carrier)].map(([c, l]) => ({ carrier: c, appointments: l.length, on_time: l.filter((x) => x.status === 'on_time' || x.status === 'early').length, late: l.filter((x) => x.status === 'late').length, no_show: l.filter((x) => x.status === 'no_show').length, on_time_pct: Math.round((l.filter((x) => x.status === 'on_time' || x.status === 'early').length / l.length) * 100), avg_minutes_late: avg(l.filter((x) => x.minutes_late > graceMinutes).map((x) => x.minutes_late)) })).sort((a, b) => a.on_time_pct - b.on_time_pct || b.no_show - a.no_show || (a.carrier < b.carrier ? -1 : a.carrier > b.carrier ? 1 : 0));
  const byHour = [...groupBy(items.filter((x) => x.wait_minutes !== null), (x) => x.hour)].map(([h, l]) => ({ hour: h, appointments: l.length, avg_wait: avg(l.map((x) => x.wait_minutes)), max_wait: Math.max(...l.map((x) => x.wait_minutes)) })).sort((a, b) => a.hour.localeCompare(b.hour));
  const byType = [...groupBy(items.filter((x) => x.work_minutes !== null), (x) => x.load_type)].map(([k, l]) => { const per = l.filter((x) => x.pallets).map((x) => x.work_minutes / x.pallets); return { load_type: k, loads: l.length, avg_work_minutes: avg(l.map((x) => x.work_minutes)), p80_work_minutes: pct(l.map((x) => x.work_minutes), 0.8), minutes_per_pallet: per.length ? Math.round((per.reduce((a, b) => a + b, 0) / per.length) * 10) / 10 : null }; }).sort((a, b) => (a.load_type < b.load_type ? -1 : a.load_type > b.load_type ? 1 : 0));
  const n = (s) => items.filter((x) => x.status === s).length;
  return { appointments: items.length, on_time: n('on_time') + n('early'), late: n('late'), no_show: n('no_show'), on_time_pct: items.length ? Math.round(((n('on_time') + n('early')) / items.length) * 100) : null, avg_wait: avg(items.filter((x) => x.wait_minutes !== null).map((x) => x.wait_minutes)), worst_hour: byHour.slice().sort((a, b) => b.avg_wait - a.avg_wait || (a.hour < b.hour ? -1 : 1))[0] || null, by_carrier: byCarrier, by_hour: byHour, by_load_type: byType, items };
}

/** Markdown for the day's appointment confirmations, one line per carrier appointment. */
export function scheduleText(p, a = {}) {
  const L = [`# Dock appointments${a.date ? `, ${a.date}` : ''}`, '', `**To:** ${a.to || '[TO CONFIRM: carriers on this list]'}`, `**From:** ${a.from || '[YOUR NAME]'}`, '', `Dock hours ${p.dock_hours}. Please arrive at the time shown; arrivals more than ${a.grace ?? 15} minutes late may be moved to the next open slot.`, '', '| Load | Carrier | Door | Time | Window asked |', '|---|---|---|---|---|'];
  for (const x of p.schedule.filter((s) => s.status === 'scheduled')) L.push(`| ${x.load_id} | ${x.carrier} | ${x.door} | ${x.start} | ${x.window} |`);
  const ns = p.schedule.filter((s) => s.status === 'no_slot');
  if (ns.length) { L.push('', 'Could not be placed in the window asked; please propose another time:', ''); for (const x of ns) L.push(`- ${x.load_id} (${x.carrier}), asked ${x.window}: ${x.reason}`); }
  return L.join('\n');
}
