// COS shared serverless library.
// Every request is authenticated against Supabase Auth before anything runs.
// All keys live server-side in Vercel env vars. The browser holds none.
//
// Env vars required on Vercel:
//   SUPABASE_URL            e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY    service role key (server only, never shipped to client)
//   NOTION_TOKEN            internal integration token, shared with the Tasks database
//   ANTHROPIC_API_KEY       for the prioritization engine
//   NOTION_TASKS_DATA_SOURCE_ID   optional override; defaults to the known Tasks collection

'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_VERSION = '2025-09-03';
const TASKS_DS =
  process.env.NOTION_TASKS_DATA_SOURCE_ID ||
  '98602265-fc95-4065-876a-6fdc0a4aefc8';

// The content law, enforced at the query. Only these Project values are ever
// fetched from Notion. Role Change & Stipend and anything not listed here
// never enters COS state, never reaches the prioritizer, never renders.
const PROJECT_ALLOWLIST = [
  'Groundwork',
  'FDS',
  'Career Plan',
  'Handshake Data & API',
  'Career Labs',
  'Guides',
  'Grad Fellow',
  'INTO Partnership',
  'Coordination'
];

// ---------- auth ----------

async function requireUser(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SERVICE_KEY, Authorization: auth }
  });
  if (!r.ok) return null;
  const user = await r.json();
  return user && user.id ? user : null;
}

// ---------- supabase rest ----------

async function sb(path, opts) {
  const o = opts || {};
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    method: o.method || 'GET',
    headers: Object.assign(
      {
        apikey: SERVICE_KEY,
        Authorization: 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: o.prefer || 'return=representation'
      },
      o.headers || {}
    ),
    body: o.body ? JSON.stringify(o.body) : undefined
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }
  if (!r.ok) {
    const msg =
      data && data.message ? data.message : 'Supabase error ' + r.status;
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return data;
}

// ---------- notion ----------

async function notion(path, opts) {
  const o = opts || {};
  const r = await fetch('https://api.notion.com/v1/' + path, {
    method: o.method || 'GET',
    headers: {
      Authorization: 'Bearer ' + NOTION_TOKEN,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    body: o.body ? JSON.stringify(o.body) : undefined
  });
  const data = await r.json();
  if (!r.ok) {
    const err = new Error(
      (data && data.message) || 'Notion error ' + r.status
    );
    err.status = r.status;
    err.notion = data;
    throw err;
  }
  return data;
}

// Retrieve the Tasks data source schema. Used to find the real names of the
// title, status, project, type and due properties, and the status option that
// belongs to the Complete group, so nothing is hardcoded to a schema that
// might get renamed in Notion.
let _schemaCache = { at: 0, value: null };

async function tasksSchema() {
  const now = Date.now();
  if (_schemaCache.value && now - _schemaCache.at < 5 * 60 * 1000) {
    return _schemaCache.value;
  }
  const ds = await notion('data_sources/' + TASKS_DS);
  const props = ds.properties || {};
  const out = {
    title: null,
    status: null,
    doneOption: null,
    inProgressOption: null,
    todoOption: null,
    project: null,
    type: null,
    due: null
  };
  for (const name of Object.keys(props)) {
    const p = props[name];
    if (p.type === 'title' && !out.title) out.title = name;
    if (p.type === 'status' && !out.status) {
      out.status = name;
      const groups = (p.status && p.status.groups) || [];
      const options = (p.status && p.status.options) || [];
      const byId = {};
      options.forEach(function (op) {
        byId[op.id] = op.name;
      });
      groups.forEach(function (g) {
        const first = (g.option_ids || [])[0];
        if (g.name === 'Complete' && first) out.doneOption = byId[first];
        if (g.name === 'In progress' && first)
          out.inProgressOption = byId[first];
        if (g.name === 'To-do' && first) out.todoOption = byId[first];
      });
    }
    if (p.type === 'select' && /^project$/i.test(name)) out.project = name;
    if (p.type === 'select' && /^type$/i.test(name)) out.type = name;
    if (p.type === 'date' && !out.due && /due|deadline|date/i.test(name))
      out.due = name;
  }
  // Fallbacks if the select naming ever drifts.
  if (!out.project) {
    for (const name of Object.keys(props)) {
      if (props[name].type === 'select') {
        out.project = name;
        break;
      }
    }
  }
  _schemaCache = { at: now, value: out };
  return out;
}

function plain(rich) {
  return (rich || [])
    .map(function (t) {
      return t.plain_text || '';
    })
    .join('');
}

function extractTask(page, schema) {
  const props = page.properties || {};
  const t = {};
  t.id = page.id;
  t.url = page.url;
  t.edited = page.last_edited_time;
  t.title = schema.title ? plain((props[schema.title] || {}).title) : '';
  const st = schema.status ? props[schema.status] : null;
  t.status = st && st.status ? st.status.name : null;
  t.statusGroup = null;
  const pr = schema.project ? props[schema.project] : null;
  t.project = pr && pr.select ? pr.select.name : null;
  const ty = schema.type ? props[schema.type] : null;
  t.type = ty && ty.select ? ty.select.name : 'Task';
  const du = schema.due ? props[schema.due] : null;
  t.due = du && du.date ? du.date.start : null;
  return t;
}

// Pull allowlisted tasks. The allowlist filter is applied AT THE QUERY, so
// excluded projects are never transmitted.
async function pullTasks() {
  const schema = await tasksSchema();
  const filter = {
    or: PROJECT_ALLOWLIST.map(function (p) {
      return { property: schema.project, select: { equals: p } };
    })
  };
  const tasks = [];
  let cursor = undefined;
  let guard = 0;
  do {
    const body = { filter: filter, page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const r = await notion('data_sources/' + TASKS_DS + '/query', {
      method: 'POST',
      body: body
    });
    (r.results || []).forEach(function (pg) {
      tasks.push(extractTask(pg, schema));
    });
    cursor = r.has_more ? r.next_cursor : undefined;
    guard++;
  } while (cursor && guard < 5);

  // Classify open vs done using the schema's Complete-group option name,
  // falling back to common names.
  const doneNames = [schema.doneOption, 'Done', 'Complete', 'Completed']
    .filter(Boolean)
    .map(function (s) {
      return s.toLowerCase();
    });
  tasks.forEach(function (t) {
    t.done = !!(t.status && doneNames.indexOf(t.status.toLowerCase()) >= 0);
  });
  return { tasks: tasks, schema: schema };
}

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.json(body);
}

module.exports = {
  PROJECT_ALLOWLIST: PROJECT_ALLOWLIST,
  TASKS_DS: TASKS_DS,
  requireUser: requireUser,
  sb: sb,
  notion: notion,
  tasksSchema: tasksSchema,
  pullTasks: pullTasks,
  json: json
};
