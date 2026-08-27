// POST /api/act
// Every write in the system goes through here. Body: { type, ...payload }.
//
//   inbox.add       { text, project? }        quick capture into Supabase staging
//   inbox.edit      { id, text?, project? }   refine a staged item before pushing
//   inbox.dismiss   { id }                    mark handled without pushing (kept, status=handled)
//   inbox.push      { id, taskType? }         create the Notion task, mark item synced
//   task.toggle     { pageId, done }          write-through status change on a synced Notion task
//   capacity.set    { hours, energy }         today's capacity check-in
//   decision.add    { decision, why }         decision log entry
//   flag.add        { text, needs? }          raise a flag
//   flag.resolve    { id }                    close a flag by setting resolved_at
//
// Notion writes are limited to the Tasks database, and only for allowlisted
// projects. A push with a non-allowlisted project is refused.

'use strict';

const lib = require('./_lib.js');

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

module.exports = async function (req, res) {
  try {
    if (req.method !== 'POST')
      return lib.json(res, 405, { error: 'POST only.' });
    const user = await lib.requireUser(req);
    if (!user) return lib.json(res, 401, { error: 'Sign in required.' });

    const body = await readBody(req);
    const type = body.type;
    const todayIso = new Date().toISOString().slice(0, 10);

    // ---------- inbox ----------
    if (type === 'inbox.add') {
      const text = String(body.text || '').trim();
      if (!text) return lib.json(res, 400, { error: 'Empty capture.' });
      const project =
        body.project && lib.PROJECT_ALLOWLIST.indexOf(body.project) >= 0
          ? body.project
          : null;
      const rows = await lib.sb('inbox_items', {
        method: 'POST',
        body: { text: text.slice(0, 500), project: project, status: 'open' }
      });
      return lib.json(res, 200, { ok: true, item: rows[0] });
    }

    if (type === 'inbox.edit') {
      const patch = {};
      if (body.text != null) patch.text = String(body.text).slice(0, 500);
      if (body.project !== undefined) {
        patch.project =
          body.project && lib.PROJECT_ALLOWLIST.indexOf(body.project) >= 0
            ? body.project
            : null;
      }
      const rows = await lib.sb('inbox_items?id=eq.' + body.id, {
        method: 'PATCH',
        body: patch
      });
      return lib.json(res, 200, { ok: true, item: rows[0] });
    }

    if (type === 'inbox.dismiss') {
      await lib.sb('inbox_items?id=eq.' + body.id, {
        method: 'PATCH',
        body: { status: 'handled', resolved_at: new Date().toISOString() }
      });
      return lib.json(res, 200, { ok: true });
    }

    if (type === 'inbox.push') {
      const rows = await lib.sb(
        'inbox_items?select=*&id=eq.' + body.id + '&limit=1'
      );
      const item = rows[0];
      if (!item) return lib.json(res, 404, { error: 'Item not found.' });
      if (!item.project || lib.PROJECT_ALLOWLIST.indexOf(item.project) < 0) {
        return lib.json(res, 400, {
          error:
            'Tag the item to an allowlisted project before pushing to Notion.'
        });
      }
      const schema = await lib.tasksSchema();
      const props = {};
      props[schema.title] = {
        title: [{ text: { content: item.text.slice(0, 200) } }]
      };
      props[schema.project] = { select: { name: item.project } };
      if (schema.type) {
        props[schema.type] = {
          select: { name: body.taskType || 'Task' }
        };
      }
      const page = await lib.notion('pages', {
        method: 'POST',
        body: {
          parent: { type: 'data_source_id', data_source_id: lib.TASKS_DS },
          properties: props
        }
      });
      await lib.sb('inbox_items?id=eq.' + item.id, {
        method: 'PATCH',
        body: {
          status: 'synced',
          notion_page_id: page.id,
          resolved_at: new Date().toISOString()
        }
      });
      return lib.json(res, 200, { ok: true, url: page.url });
    }

    // ---------- write-through task toggle ----------
    if (type === 'task.toggle') {
      const schema = await lib.tasksSchema();
      if (!schema.status)
        return lib.json(res, 400, {
          error: 'No status property found on the Tasks database.'
        });
      const target = body.done
        ? schema.doneOption || 'Done'
        : schema.todoOption || 'Not started';
      const props = {};
      props[schema.status] = { status: { name: target } };
      await lib.notion('pages/' + body.pageId, {
        method: 'PATCH',
        body: { properties: props }
      });
      return lib.json(res, 200, { ok: true, status: target });
    }

    // ---------- capacity ----------
    if (type === 'capacity.set') {
      const hours = Math.max(0, Math.min(12, Number(body.hours) || 0));
      const energy = ['low', 'medium', 'high'].indexOf(body.energy) >= 0
        ? body.energy
        : 'medium';
      const rows = await lib.sb(
        'capacity_days?on_conflict=day',
        {
          method: 'POST',
          prefer: 'return=representation,resolution=merge-duplicates',
          body: { day: todayIso, hours: hours, energy: energy }
        }
      );
      return lib.json(res, 200, { ok: true, capacity: rows[0] });
    }

    // ---------- decisions and flags ----------
    if (type === 'decision.add') {
      const rows = await lib.sb('decisions', {
        method: 'POST',
        body: {
          decision_date: todayIso,
          source: 'direct',
          decision: String(body.decision || '').slice(0, 400),
          why: String(body.why || '').slice(0, 600)
        }
      });
      return lib.json(res, 200, { ok: true, decision: rows[0] });
    }

    if (type === 'flag.add') {
      const rows = await lib.sb('flags', {
        method: 'POST',
        body: {
          flag_date: todayIso,
          text: String(body.text || '').slice(0, 400),
          needs: String(body.needs || '').slice(0, 400)
        }
      });
      return lib.json(res, 200, { ok: true, flag: rows[0] });
    }

    if (type === 'flag.resolve') {
      await lib.sb('flags?id=eq.' + body.id, {
        method: 'PATCH',
        body: { resolved_at: new Date().toISOString() }
      });
      return lib.json(res, 200, { ok: true });
    }

    return lib.json(res, 400, { error: 'Unknown action: ' + type });
  } catch (e) {
    return lib.json(res, e.status || 500, { error: e.message });
  }
};
