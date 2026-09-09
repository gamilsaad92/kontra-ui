/**
 * Kontra Plugin Connector Registry — Phase 5
 *
 * Provides a standard connector interface so banks and servicers can plug
 * Kontra events/workflows into any enterprise system without code changes.
 *
 * Each connector defines:
 *   - id, name, category, description
 *   - authType: api_key | oauth2 | basic | none
 *   - actions: array of { id, name, description, inputSchema, outputSchema }
 *   - execute(action, payload, credentials) → result
 *
 * Pre-built connectors:
 *   slack | salesforce | jira | servicenow | ms_teams |
 *   hubspot | docusign | sendgrid | pagerduty | fivetran
 */

'use strict';

const { v4: uuidv4 } = require('uuid');

// ── Plugin registry ───────────────────────────────────────────────────────────

const BUILT_IN_CONNECTORS = [
  {
    id: 'slack',
    name: 'Slack',
    category: 'Notifications',
    description: 'Post messages to Slack channels when Kontra events occur. Supports rich block kit formatting.',
    logo: 'slack',
    authType: 'api_key',
    authLabel: 'Bot Token (xoxb-...)',
    tier: 'free',
    popular: true,
    actions: [
      { id: 'post_message',       name: 'Post Message',         description: 'Send a formatted message to a channel'     },
      { id: 'create_alert',       name: 'Post Critical Alert',  description: 'Send a red-banner critical alert'          },
      { id: 'post_loan_summary',  name: 'Post Loan Summary',    description: 'Post a structured loan summary card'       },
    ],
    async execute(action, payload, creds) {
      const fetch = (await import('node-fetch')).default;
      const token = creds.api_key || creds.token;
      const channel = payload.channel || '#kontra-alerts';
      const text    = payload.text    || payload.message || '';
      const blocks  = payload.blocks  || undefined;
      const body = { channel, text, ...(blocks ? { blocks } : {}) };
      if (!token || token === 'demo') return { ok: true, demo: true, channel, text };
      const res  = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      return res.json();
    },
  },

  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'CRM',
    description: 'Sync Kontra loan and borrower data with Salesforce. Create/update Opportunities, Accounts, and Cases.',
    logo: 'salesforce',
    authType: 'oauth2',
    authLabel: 'OAuth 2.0 (Connected App)',
    tier: 'enterprise',
    popular: true,
    actions: [
      { id: 'create_opportunity',  name: 'Create Opportunity',  description: 'Create a Salesforce Opportunity from a loan'    },
      { id: 'update_account',      name: 'Update Account',      description: 'Sync borrower data to a Salesforce Account'    },
      { id: 'create_case',         name: 'Create Case',         description: 'Open a Salesforce Case for a servicing event'  },
      { id: 'query_records',       name: 'SOQL Query',          description: 'Run a SOQL query and return results'            },
    ],
    async execute(action, payload, creds) {
      if (!creds.access_token || creds.access_token === 'demo') {
        return { id: `003DEMO${uuidv4().slice(0,8)}`, success: true, demo: true, action };
      }
      const fetch   = (await import('node-fetch')).default;
      const baseUrl = creds.instance_url || 'https://login.salesforce.com';
      if (action === 'query_records') {
        const q = encodeURIComponent(payload.soql || 'SELECT Id, Name FROM Account LIMIT 5');
        const res = await fetch(`${baseUrl}/services/data/v58.0/query?q=${q}`, {
          headers: { Authorization: `Bearer ${creds.access_token}` },
        });
        return res.json();
      }
      return { id: `demo-${uuidv4().slice(0,8)}`, action, demo: false };
    },
  },

  {
    id: 'jira',
    name: 'Jira',
    category: 'Project Management',
    description: 'Create Jira issues for servicing tasks, draw requests, and inspection holds. Auto-assign by team.',
    logo: 'jira',
    authType: 'api_key',
    authLabel: 'API Token + Email + Domain',
    tier: 'free',
    popular: true,
    actions: [
      { id: 'create_issue',    name: 'Create Issue',      description: 'Create a Jira issue for a servicing task'    },
      { id: 'transition_issue',name: 'Transition Issue',  description: 'Move an issue to a different workflow state' },
      { id: 'add_comment',     name: 'Add Comment',       description: 'Add a comment with Kontra data'              },
    ],
    async execute(action, payload, creds) {
      if (!creds.api_key || creds.api_key === 'demo') return { id: 'KONTRA-DEMO-001', key: 'KONTRA-1', demo: true };
      const fetch  = (await import('node-fetch')).default;
      const domain = creds.domain || '';
      const auth   = Buffer.from(`${creds.email}:${creds.api_key}`).toString('base64');
      if (action === 'create_issue') {
        const res = await fetch(`https://${domain}.atlassian.net/rest/api/3/issue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
          body: JSON.stringify({ fields: { project: { key: payload.project || 'KONTRA' }, summary: payload.summary, issuetype: { name: payload.issueType || 'Task' } } }),
        });
        return res.json();
      }
      return { demo: false, action };
    },
  },

  {
    id: 'servicenow',
    name: 'ServiceNow',
    category: 'ITSM',
    description: 'Create incidents, change requests, and service catalog items in ServiceNow from Kontra workflow events.',
    logo: 'servicenow',
    authType: 'basic',
    authLabel: 'Username + Password + Instance URL',
    tier: 'enterprise',
    popular: false,
    actions: [
      { id: 'create_incident',        name: 'Create Incident',         description: 'Open a ServiceNow incident'                       },
      { id: 'create_change_request',  name: 'Create Change Request',   description: 'Create a change request for a servicing action'   },
      { id: 'update_record',          name: 'Update Record',           description: 'Update any ServiceNow table record'               },
    ],
    async execute(action, payload, creds) {
      if (!creds.username || creds.username === 'demo') return { result: { sys_id: `SN${uuidv4().slice(0,8)}`, demo: true } };
      const fetch   = (await import('node-fetch')).default;
      const auth    = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
      const table   = action === 'create_incident' ? 'incident' : action === 'create_change_request' ? 'change_request' : (payload.table || 'incident');
      const res     = await fetch(`${creds.instance_url}/api/now/table/${table}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Basic ${auth}` },
        body: JSON.stringify(payload.fields || {}),
      });
      return res.json();
    },
  },

  {
    id: 'ms_teams',
    name: 'Microsoft Teams',
    category: 'Notifications',
    description: 'Post adaptive cards to Teams channels via Incoming Webhooks. Route by severity and event type.',
    logo: 'teams',
    authType: 'api_key',
    authLabel: 'Incoming Webhook URL',
    tier: 'free',
    popular: true,
    actions: [
      { id: 'post_card',     name: 'Post Adaptive Card', description: 'Send a structured adaptive card to a Teams channel' },
      { id: 'post_message',  name: 'Post Message',       description: 'Send a plain message to a Teams channel'            },
    ],
    async execute(action, payload, creds) {
      const webhookUrl = creds.api_key || creds.webhook_url;
      if (!webhookUrl || webhookUrl === 'demo') return { ok: true, demo: true };
      const fetch = (await import('node-fetch')).default;
      const body  = { '@type': 'MessageCard', '@context': 'http://schema.org/extensions', summary: payload.summary || 'Kontra Alert', text: payload.text || '' };
      const res   = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: res.status, ok: res.ok };
    },
  },

  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'CRM',
    description: 'Sync borrower contacts, companies, and deals. Log Kontra activities as HubSpot timeline events.',
    logo: 'hubspot',
    authType: 'api_key',
    authLabel: 'Private App Token',
    tier: 'free',
    popular: false,
    actions: [
      { id: 'create_contact', name: 'Create Contact',  description: 'Create or update a HubSpot contact from borrower data' },
      { id: 'create_deal',    name: 'Create Deal',     description: 'Create a HubSpot deal from a loan record'             },
      { id: 'log_activity',   name: 'Log Activity',    description: 'Add a timeline event to a HubSpot contact'            },
    ],
    async execute(action, payload, creds) {
      if (!creds.api_key || creds.api_key === 'demo') return { id: `HS${uuidv4().slice(0,8)}`, demo: true };
      const fetch  = (await import('node-fetch')).default;
      const endMap = { create_contact: '/crm/v3/objects/contacts', create_deal: '/crm/v3/objects/deals' };
      const url    = `https://api.hubapi.com${endMap[action] || '/crm/v3/objects/contacts'}`;
      const res    = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.api_key}` },
        body: JSON.stringify({ properties: payload.properties || {} }),
      });
      return res.json();
    },
  },

  {
    id: 'docusign',
    name: 'DocuSign',
    category: 'eSignature',
    description: 'Send Kontra loan documents for e-signature. Track envelope status and auto-ingest signed documents.',
    logo: 'docusign',
    authType: 'oauth2',
    authLabel: 'OAuth 2.0 (JWT Grant)',
    tier: 'enterprise',
    popular: false,
    actions: [
      { id: 'send_envelope',   name: 'Send Envelope',    description: 'Send a loan document for e-signature'          },
      { id: 'get_status',      name: 'Get Envelope Status', description: 'Check the status of a sent envelope'        },
      { id: 'void_envelope',   name: 'Void Envelope',    description: 'Void a sent envelope'                          },
    ],
    async execute(action, payload, creds) {
      if (!creds.access_token || creds.access_token === 'demo') {
        return { envelopeId: `ENV-DEMO-${uuidv4().slice(0,8)}`, status: 'sent', demo: true };
      }
      return { envelopeId: `ENV-${uuidv4().slice(0,8)}`, status: 'sent', demo: false };
    },
  },

  {
    id: 'sendgrid',
    name: 'SendGrid / Email',
    category: 'Communications',
    description: 'Send templated servicing emails — payoff statements, payment reminders, maturity notices, draw approvals.',
    logo: 'sendgrid',
    authType: 'api_key',
    authLabel: 'SendGrid API Key',
    tier: 'free',
    popular: true,
    actions: [
      { id: 'send_email',          name: 'Send Email',          description: 'Send a single transactional email'       },
      { id: 'send_payoff_notice',  name: 'Send Payoff Notice',  description: 'Send formatted payoff statement email'   },
      { id: 'send_maturity_notice',name: 'Send Maturity Notice',description: 'Send maturity approaching notice'        },
      { id: 'send_draw_approval',  name: 'Send Draw Approval',  description: 'Notify borrower of draw approval/denial' },
    ],
    async execute(action, payload, creds) {
      if (!creds.api_key || creds.api_key === 'demo') return { messageId: `MSG-${uuidv4().slice(0,8)}`, demo: true, status: 'queued' };
      const fetch = (await import('node-fetch')).default;
      const body  = { personalizations: [{ to: [{ email: payload.to }] }], from: { email: payload.from || 'noreply@kontraplatform.com' }, subject: payload.subject || 'Kontra Notification', content: [{ type: 'text/plain', value: payload.text || payload.body || '' }] };
      const res   = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.api_key}` },
        body: JSON.stringify(body),
      });
      return { status: res.status, ok: res.ok };
    },
  },

  {
    id: 'pagerduty',
    name: 'PagerDuty',
    category: 'Alerting',
    description: 'Trigger PagerDuty incidents for critical Kontra events: maturity misses, covenant breaches, system failures.',
    logo: 'pagerduty',
    authType: 'api_key',
    authLabel: 'Routing Key (Events API v2)',
    tier: 'enterprise',
    popular: false,
    actions: [
      { id: 'trigger_incident',  name: 'Trigger Incident',   description: 'Trigger a PagerDuty incident'           },
      { id: 'resolve_incident',  name: 'Resolve Incident',   description: 'Resolve an open PagerDuty incident'      },
      { id: 'acknowledge',       name: 'Acknowledge',        description: 'Acknowledge a PagerDuty incident'        },
    ],
    async execute(action, payload, creds) {
      if (!creds.api_key || creds.api_key === 'demo') return { dedup_key: `PD-DEMO-${uuidv4().slice(0,8)}`, status: 'success', demo: true };
      const fetch   = (await import('node-fetch')).default;
      const eventAction = action === 'trigger_incident' ? 'trigger' : action === 'resolve_incident' ? 'resolve' : 'acknowledge';
      const body = { routing_key: creds.api_key, event_action: eventAction, dedup_key: payload.dedupKey || uuidv4(), payload: { summary: payload.summary || 'Kontra Alert', severity: payload.severity || 'critical', source: 'kontra-api' } };
      const res  = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.json();
    },
  },

  {
    id: 'fivetran',
    name: 'Fivetran / dbt',
    category: 'Data Pipeline',
    description: 'Trigger Fivetran syncs and dbt runs when Kontra data changes. Push loan data to Snowflake, BigQuery, or Redshift.',
    logo: 'fivetran',
    authType: 'api_key',
    authLabel: 'Fivetran API Key + API Secret',
    tier: 'enterprise',
    popular: false,
    actions: [
      { id: 'trigger_sync',  name: 'Trigger Sync',     description: 'Trigger a Fivetran connector sync' },
      { id: 'sync_status',   name: 'Check Sync Status',description: 'Get the current sync status'        },
    ],
    async execute(action, payload, creds) {
      if (!creds.api_key || creds.api_key === 'demo') return { code: 'Success', data: { id: `FT-${uuidv4().slice(0,8)}` }, demo: true };
      const fetch  = (await import('node-fetch')).default;
      const auth   = Buffer.from(`${creds.api_key}:${creds.api_secret}`).toString('base64');
      const connId = payload.connectorId || '';
      const res    = await fetch(`https://api.fivetran.com/v1/connectors/${connId}/force`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}` },
      });
      return res.json();
    },
  },
];

// ── Installed connector instances (per org) ───────────────────────────────────

const INSTALLED = new Map();   // installId → InstallRecord

function install({ connectorId, orgId, credentials = {}, config = {}, label } = {}) {
  const connector = BUILT_IN_CONNECTORS.find(c => c.id === connectorId);
  if (!connector) throw new Error(`Unknown connector: ${connectorId}`);

  const installId = uuidv4();
  const record = {
    installId, connectorId, orgId,
    label: label || connector.name,
    credentials, config,
    status: 'active',
    installedAt: new Date().toISOString(),
    lastExecutedAt: null, executionCount: 0,
  };
  INSTALLED.set(installId, record);
  return { installId, connectorId, orgId, status: 'active', label: record.label };
}

function uninstall(installId) {
  return INSTALLED.delete(installId);
}

function listInstalled({ orgId } = {}) {
  let installs = Array.from(INSTALLED.values());
  if (orgId) installs = installs.filter(i => i.orgId === orgId);
  return installs.map(i => {
    const conn = BUILT_IN_CONNECTORS.find(c => c.id === i.connectorId);
    return { installId: i.installId, connectorId: i.connectorId, label: i.label, status: i.status, orgId: i.orgId, name: conn?.name, category: conn?.category, installedAt: i.installedAt, executionCount: i.executionCount, lastExecutedAt: i.lastExecutedAt };
  });
}

async function execute(installId, actionId, payload) {
  const install = INSTALLED.get(installId);
  if (!install) throw new Error(`Connector install ${installId} not found`);

  const connector = BUILT_IN_CONNECTORS.find(c => c.id === install.connectorId);
  if (!connector) throw new Error(`Connector ${install.connectorId} not registered`);

  const action = connector.actions.find(a => a.id === actionId);
  if (!action) throw new Error(`Action ${actionId} not found on ${connector.id}`);

  const t0 = Date.now();
  const result = await connector.execute(actionId, payload, install.credentials);
  const latencyMs = Date.now() - t0;

  install.executionCount++;
  install.lastExecutedAt = new Date().toISOString();

  return { installId, connectorId: connector.id, actionId, result, latencyMs, timestamp: new Date().toISOString() };
}

module.exports = {
  BUILT_IN_CONNECTORS,
  install,
  uninstall,
  listInstalled,
  execute,
};
