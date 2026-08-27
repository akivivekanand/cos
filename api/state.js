// GET /api/state
// The single read the dashboard makes on load and refresh.
// Returns: allowlisted Notion tasks (the record of work), plus COS-native
// state from Supabase (inbox, capacity, focus list, decisions, open flags).

'use strict';

const lib = require('./_lib.js');

module.exports = async function (req, res) {
  try {
    const user = await lib.requireUser(req);
    if (!user) return lib.json(res, 401, { error: 'Sign in required.' });

    const todayIso = new Date().toISOString().slice(0, 10);

    const results = await Promise.allSettled([
      lib.pullTasks(),
      lib.sb('inbox_items?select=*&status=eq.open&order=created_at.desc'),
      lib.sb('capacity_days?select=*&day=eq.' + todayIso + '&limit=1'),
      lib.sb('focus_lists?select=*&day=eq.' + todayIso + '&order=created_at.desc&limit=1'),
      lib.sb('decisions?select=*&order=decision_date.desc&limit=40'),
      lib.sb('flags?select=*&resolved_at=is.null&order=flag_date.asc')
    ]);

    const out = { today: todayIso, errors: [] };

    if (results[0].status === 'fulfilled') {
      out.tasks = results[0].value.tasks;
      out.notionSchema = results[0].value.schema;
      out.notionOk = true;
    } else {
      // Honest degradation: a Notion failure never blocks the rest.
      out.tasks = [];
      out.notionOk = false;
      out.errors.push('Notion: ' + results[0].reason.message);
    }

    out.inbox =
      results[1].status === 'fulfilled' ? results[1].value : [];
    out.capacity =
      results[2].status === 'fulfilled' && results[2].value.length
        ? results[2].value[0]
        : null;
    out.focus =
      results[3].status === 'fulfilled' && results[3].value.length
        ? results[3].value[0]
        : null;
    out.decisions =
      results[4].status === 'fulfilled' ? results[4].value : [];
    out.flags =
      results[5].status === 'fulfilled' ? results[5].value : [];

    for (let i = 1; i <= 5; i++) {
      if (results[i].status === 'rejected') {
        out.errors.push('Supabase: ' + results[i].reason.message);
      }
    }

    return lib.json(res, 200, out);
  } catch (e) {
    return lib.json(res, 500, { error: e.message });
  }
};
