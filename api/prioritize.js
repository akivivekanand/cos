// POST /api/prioritize
// The intelligence layer, in-app. Two modes:
//
//   { mode: "focus" }      (default) rank today's open Notion tasks against
//                          today's capacity. Saves the result to focus_lists
//                          and returns it.
//   { mode: "readback" }   an on-demand reflective readback of the last seven
//                          days: what completed, what stalled, what decisions
//                          were logged. Returned, not stored.
//
// The content law travels with the prompt: work operations only, facts about
// colleagues only, no assessments of people, no compensation or role-change
// material. Input is already filtered to the project allowlist at the query.

'use strict';

const lib = require('./_lib.js');

const MODEL = 'claude-sonnet-4-6';

const CONTENT_LAW =
  'You are the prioritization engine inside COS, a personal work-operations ' +
  'dashboard for one operator at a university career center. Rules that are ' +
  'never broken: (1) Work operations only. (2) Never characterize, assess, ' +
  'or speculate about colleagues or students; people appear only as factual ' +
  'logistics. (3) Never mention compensation, promotion, reclassification, ' +
  'or job-search topics, even if a task title hints at them; skip such items ' +
  'silently. (4) Plain declarative sentences. No em dashes. No emoji. No ' +
  'praise, no filler. (5) Respond with valid JSON only, no markdown fences, ' +
  'no preamble.';

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise(function (resolve, reject) {
    let raw = '';
    req.on('data', function (c) {
      raw += c;
    });
    req.on('end', function () {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body.'));
      }
    });
  });
}

async function callClaude(system, userMsg, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens || 1500,
      system: system,
      messages: [{ role: 'user', content: userMsg }]
    })
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error(
      (data && data.error && data.error.message) || 'Anthropic error'
    );
  }
  const text = (data.content || [])
    .filter(function (b) {
      return b.type === 'text';
    })
    .map(function (b) {
      return b.text;
    })
    .join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

function compactTask(t) {
  return {
    id: t.id,
    title: t.title,
    project: t.project,
    type: t.type,
    due: t.due,
    status: t.status
  };
}

module.exports = async function (req, res) {
  try {
    if (req.method !== 'POST')
      return lib.json(res, 405, { error: 'POST only.' });
    const user = await lib.requireUser(req);
    if (!user) return lib.json(res, 401, { error: 'Sign in required.' });

    const body = await readBody(req);
    const mode = body.mode === 'readback' ? 'readback' : 'focus';
    const todayIso = new Date().toISOString().slice(0, 10);

    const pulled = await lib.pullTasks();
    const tasks = pulled.tasks;

    if (mode === 'focus') {
      const capRows = await lib.sb(
        'capacity_days?select=*&day=eq.' + todayIso + '&limit=1'
      );
      const cap = capRows[0] || { hours: 6, energy: 'medium' };
      const open = tasks.filter(function (t) {
        return !t.done;
      });
      const flags = await lib.sb(
        'flags?select=flag_date,text,needs&resolved_at=is.null&order=flag_date.asc'
      );

      const prompt =
        'Today is ' + todayIso + '. Capacity: ' + cap.hours +
        ' available hours, energy level ' + cap.energy + '.\n\n' +
        'Open tasks (JSON): ' + JSON.stringify(open.map(compactTask)) + '\n\n' +
        'Open flags (JSON): ' + JSON.stringify(flags) + '\n\n' +
        'Rank what deserves focus today. Respect the capacity: at low energy ' +
        'or few hours, pick fewer, lighter items and say so. Weigh due dates, ' +
        'task type (a Decision or Status check is usually faster than a Task), ' +
        'project momentum, and open flags. Respond with JSON exactly in this ' +
        'shape: {"focus":[{"id":"notion page id","title":"...","project":"...",' +
        '"reason":"one sentence","est":"rough time, e.g. 45m"}],' +
        '"defer":[{"id":"...","title":"...","reason":"one short clause"}],' +
        '"landmine":{"title":"...","reason":"..."} or null,' +
        '"note":"one or two plain sentences framing the day"}. ' +
        'Focus holds at most ' + (cap.hours >= 5 ? 4 : cap.hours >= 3 ? 3 : 2) +
        ' items. Every id must come from the input.';

      const result = await callClaude(CONTENT_LAW, prompt, 1500);

      const rows = await lib.sb('focus_lists?on_conflict=day', {
        method: 'POST',
        prefer: 'return=representation,resolution=merge-duplicates',
        body: {
          day: todayIso,
          capacity: { hours: cap.hours, energy: cap.energy },
          result: result
        }
      });
      return lib.json(res, 200, { ok: true, focus: rows[0] });
    }

    // ---------- readback ----------
    const weekAgo = new Date(Date.now() - 7 * 86400000)
      .toISOString()
      .slice(0, 10);
    const doneThisWeek = tasks.filter(function (t) {
      return t.done && t.edited && t.edited.slice(0, 10) >= weekAgo;
    });
    const stillOpen = tasks.filter(function (t) {
      return !t.done;
    });
    const decisions = await lib.sb(
      'decisions?select=decision_date,decision,why&decision_date=gte.' +
        weekAgo + '&order=decision_date.asc'
    );
    const flags = await lib.sb(
      'flags?select=flag_date,text,needs,resolved_at&flag_date=gte.' + weekAgo
    );

    const prompt =
      'Week ending ' + todayIso + '. Write an honest readback.\n\n' +
      'Completed this week: ' + JSON.stringify(doneThisWeek.map(compactTask)) +
      '\nStill open: ' + JSON.stringify(stillOpen.map(compactTask)) +
      '\nDecisions logged: ' + JSON.stringify(decisions) +
      '\nFlags: ' + JSON.stringify(flags) + '\n\n' +
      'Respond with JSON exactly in this shape: {"headline":"one plain ' +
      'sentence","moved":["..."],"stalled":["..."],"decided":["..."],' +
      '"next":"one or two sentences on what next week should open with"}. ' +
      'Honest degradation beats invented continuity: if the data is thin, ' +
      'say so plainly inside the fields.';

    const result = await callClaude(CONTENT_LAW, prompt, 1200);
    return lib.json(res, 200, { ok: true, readback: result });
  } catch (e) {
    return lib.json(res, e.status || 500, { error: e.message });
  }
};
