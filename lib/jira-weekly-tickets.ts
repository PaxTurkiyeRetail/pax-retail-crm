export type JiraWeeklyTicketPivotRow = {
  company: string;
  created: number;
  closed: number;
  ongoing: number;
  developmentWaiting: number;
  customerWaiting: number;
  createdKeys: string[];
  closedKeys: string[];
  ongoingKeys: string[];
  developmentWaitingKeys: string[];
  customerWaitingKeys: string[];
};

export type JiraWeeklyTicketDebugIssue = {
  key: string;
  company: string;
  status: string;
  created: string;
  resolved: string;
  summary: string;
};

export type JiraWeeklyTicketSummary = {
  enabled: boolean;
  from: string;
  to: string;
  totalCreated: number;
  totalClosed: number;
  totalOngoing: number;
  totalDevelopmentWaiting: number;
  totalCustomerWaiting: number;
  total: number;
  rows: JiraWeeklyTicketPivotRow[];
  warning?: string;
  jql?: string;
  debug?: {
    connected: boolean;
    issueCount: number;
    companyFieldId: string;
    queryMode: 'created-updated-range';
    sampleIssues: JiraWeeklyTicketDebugIssue[];
    selectedRangeCount?: number;
    recentProjectCount?: number;
    sampleIssueKey?: string;
    sampleIssueCompany?: string;
    searchEndpoint?: string;
    diagnostics?: string[];
    availableStatuses?: string[];
    candidateCompanyFields?: { id: string; name: string; sampleValue: string }[];
  };
};

function cleanText(value: unknown, fallback = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function normalizeText(value: unknown) {
  return cleanText(value).toLocaleLowerCase('tr');
}

function parseDateOnly(value: string) {
  const raw = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  return raw;
}

function nextDate(value: string) {
  const raw = parseDateOnly(value);
  if (!raw) return '';
  const date = new Date(`${raw}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function encodeBasicAuth(email: string, token: string) {
  return Buffer.from(`${email}:${token}`).toString('base64');
}

function fieldValueToCompany(value: any): string {
  if (Array.isArray(value)) {
    const first = value.map(fieldValueToCompany).find(Boolean);
    return first || '';
  }
  if (value && typeof value === 'object') {
    return cleanText(
      value.value
        ?? value.name
        ?? value.displayName
        ?? value.organizationName
        ?? value.key
        ?? value.label
        ?? '',
      '',
    );
  }
  return cleanText(value, '');
}

function configuredCompanyFieldIds() {
  const envField = cleanText(process.env.JIRA_COMPANY_FIELD_ID, '');
  const organizationField = cleanText(process.env.JIRA_ORGANIZATION_FIELD_ID, '');
  // Jira Service Management kuruluş/firma alanı çoğu projede customfield_10002.
  // Paxturkey RS örneğinde firma burada geliyor: customfield_10002[0].name.
  return Array.from(new Set([
    envField,
    organizationField,
    'customfield_10002',
    'organizations',
  ].filter(Boolean)));
}

function inferCompanyFromIssue(issue: any) {
  const fields = issue?.fields ?? {};
  for (const fieldId of configuredCompanyFieldIds()) {
    const value = fieldValueToCompany(fields[fieldId]);
    if (value) return value;
  }

  const summary = cleanText(fields.summary, 'Bilinmeyen Firma');
  const match = summary.match(/^([^:|\-–—]{2,60})\s*[:|\-–—]/);
  return cleanText(match?.[1], 'Bilinmeyen Firma');
}

function statusName(issue: any) {
  return cleanText(issue?.fields?.status?.name, '');
}

function isDoneStatus(issue: any) {
  const fields = issue?.fields ?? {};
  const status = normalizeText(fields?.status?.name);
  const categoryKey = normalizeText(fields?.status?.statusCategory?.key);
  return status.includes('çözüldü')
    || status.includes('cozuldu')
    || status.includes('kapatılmış')
    || status.includes('kapatilmis')
    || status.includes('iptal')
    || status.includes('cancel')
    || status.includes('closed')
    || status.includes('resolved')
    || categoryKey === 'done'
    || Boolean(fields?.resolutiondate);
}

function isDevelopmentWaitingStatus(issue: any) {
  const status = normalizeText(issue?.fields?.status?.name);
  return status.includes('geliştirme bekliyor')
    || status.includes('gelistirme bekliyor')
    || status.includes('waiting for development');
}

function isCustomerWaitingStatus(issue: any) {
  const status = normalizeText(issue?.fields?.status?.name);
  return status.includes('müşteri bekleniyor')
    || status.includes('musteri bekleniyor')
    || status.includes('waiting for customer');
}

function isOngoingStatus(issue: any) {
  const status = normalizeText(issue?.fields?.status?.name);
  return status.includes('devam ediyor')
    || status.includes('in progress')
    || status.includes('destek bekleniyor')
    || status.includes('waiting for support');
}

function buildCreatedUpdatedRangeJql(from: string, to: string) {
  const projectKey = cleanText(process.env.JIRA_PROJECT_KEY, 'RS');
  const baseFilter = cleanText(process.env.JIRA_RETAIL_SUPPORT_JQL, '');
  const fromDate = parseDateOnly(from);
  const toDateExclusive = nextDate(to);
  const scope = baseFilter || `project = ${projectKey}`;
  return `${scope} AND ((created >= "${fromDate}" AND created < "${toDateExclusive}") OR (updated >= "${fromDate}" AND updated < "${toDateExclusive}")) ORDER BY updated ASC, key ASC`;
}

function isDateInRange(value: unknown, from: string, toExclusive: string) {
  const date = cleanText(value).slice(0, 10);
  return Boolean(date && date >= from && date < toExclusive);
}

async function jiraFetchJson(path: string, init: RequestInit = {}) {
  const baseUrl = cleanText(process.env.JIRA_BASE_URL, '').replace(/\/+$/, '');
  const email = cleanText(process.env.JIRA_EMAIL, '');
  const token = cleanText(process.env.JIRA_API_TOKEN, '');

  if (!baseUrl || !email || !token) {
    return { ok: false, status: 0, json: null as any, text: 'Jira env eksik: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN girilmedi.' };
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${encodeBasicAuth(email, token)}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  const text = await response.text().catch(() => '');
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { ok: response.ok, status: response.status, json, text };
}

function extractIssues(json: any): any[] {
  return Array.isArray(json?.issues) ? json.issues : [];
}

async function fetchJiraIssues(jql: string, fields: string[]) {
  const diagnostics: string[] = [];
  const fieldsParam = fields.join(',');
  const maxPages = 25;

  async function fetchSearchJqlPages() {
    const pageIssues: any[] = [];
    let nextPageToken = '';
    let page = 1;
    while (page <= maxPages) {
      const body: any = { jql, maxResults: 100, fields, expand: 'names' };
      if (nextPageToken) body.nextPageToken = nextPageToken;
      const result = await jiraFetchJson('/rest/api/3/search/jql', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const currentIssues = extractIssues(result.json);
      diagnostics.push(`POST /rest/api/3/search/jql page=${page}: HTTP ${result.status}, issues=${currentIssues.length}${result.ok ? '' : `, body=${cleanText(result.text).slice(0, 180)}`}`);
      if (!result.ok) return { ok: false, issues: pageIssues, status: result.status, text: result.text };
      pageIssues.push(...currentIssues);
      nextPageToken = cleanText(result.json?.nextPageToken, '');
      if (!nextPageToken || currentIssues.length === 0) break;
      page += 1;
    }
    return { ok: true, issues: pageIssues, status: 200, text: '' };
  }

  async function fetchLegacySearchPages() {
    const pageIssues: any[] = [];
    let startAt = 0;
    let page = 1;
    while (page <= maxPages) {
      const result = await jiraFetchJson('/rest/api/3/search', {
        method: 'POST',
        body: JSON.stringify({ jql, startAt, maxResults: 100, fields, expand: ['names'] }),
      });
      const currentIssues = extractIssues(result.json);
      diagnostics.push(`POST /rest/api/3/search page=${page}: HTTP ${result.status}, issues=${currentIssues.length}${result.ok ? '' : `, body=${cleanText(result.text).slice(0, 180)}`}`);
      if (!result.ok) return { ok: false, issues: pageIssues, status: result.status, text: result.text };
      pageIssues.push(...currentIssues);
      const total = Number(result.json?.total ?? 0);
      startAt += currentIssues.length;
      if (!currentIssues.length || (total && startAt >= total)) break;
      page += 1;
    }
    return { ok: true, issues: pageIssues, status: 200, text: '' };
  }

  const primary = await fetchSearchJqlPages();
  if (primary.ok) return { issues: primary.issues, warning: '', diagnostics, searchEndpoint: 'POST /rest/api/3/search/jql' };

  const legacy = await fetchLegacySearchPages();
  if (legacy.ok) return { issues: legacy.issues, warning: '', diagnostics, searchEndpoint: 'POST /rest/api/3/search' };

  const getResult = await jiraFetchJson(`/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=100&fields=${encodeURIComponent(fieldsParam)}&expand=names`);
  const getIssues = extractIssues(getResult.json);
  diagnostics.push(`GET /rest/api/3/search/jql: HTTP ${getResult.status}, issues=${getIssues.length}${getResult.ok ? '' : `, body=${cleanText(getResult.text).slice(0, 180)}`}`);
  if (getResult.ok) return { issues: getIssues, warning: '', diagnostics, searchEndpoint: 'GET /rest/api/3/search/jql' };

  return {
    issues: [] as any[],
    warning: `Jira sorgusu başarısız: ${getResult.status} ${cleanText(getResult.text || primary.text || legacy.text).slice(0, 240)}`,
    diagnostics,
    searchEndpoint: '',
  };
}

async function fetchJiraDiagnostics(fields: string[]) {
  const projectKey = cleanText(process.env.JIRA_PROJECT_KEY, 'RS');
  const diagnostics: string[] = [];
  const recentJql = `project = ${projectKey} ORDER BY created DESC, key DESC`;
  const recent = await fetchJiraIssues(recentJql, fields);
  diagnostics.push(...recent.diagnostics.map((line) => `RECENT ${line}`));

  const statusesResult = await jiraFetchJson(`/rest/api/3/project/${encodeURIComponent(projectKey)}/statuses`);
  diagnostics.push(`GET /rest/api/3/project/${projectKey}/statuses: HTTP ${statusesResult.status}`);
  const availableStatuses = Array.isArray(statusesResult.json)
    ? Array.from(new Set(statusesResult.json.flatMap((issueType: any) => (issueType?.statuses ?? []).map((st: any) => cleanText(st?.name))).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'))
    : [];

  const sampleIssue = recent.issues[0];
  const candidateCompanyFields: { id: string; name: string; sampleValue: string }[] = [];
  if (sampleIssue?.key) {
    const fieldList = await jiraFetchJson('/rest/api/3/field');
    diagnostics.push(`GET /rest/api/3/field: HTTP ${fieldList.status}`);
    const fieldsMeta = Array.isArray(fieldList.json) ? fieldList.json : [];
    const sampleFields = sampleIssue?.fields ?? {};
    for (const meta of fieldsMeta) {
      const id = cleanText(meta?.id);
      if (!id || !(id in sampleFields)) continue;
      const value = fieldValueToCompany(sampleFields[id]);
      const name = cleanText(meta?.name);
      if (!value) continue;
      const haystack = normalizeText(`${id} ${name} ${value}`);
      if (
        configuredCompanyFieldIds().includes(id)
        || haystack.includes('organization')
        || haystack.includes('firma')
        || haystack.includes('müşteri')
        || haystack.includes('musteri')
        || haystack.includes('customer')
        || haystack.includes('company')
      ) {
        candidateCompanyFields.push({ id, name, sampleValue: value });
      }
    }
  }

  return {
    recentIssues: recent.issues,
    recentProjectCount: recent.issues.length,
    diagnostics,
    availableStatuses,
    candidateCompanyFields,
  };
}

function emptyRow(company: string): JiraWeeklyTicketPivotRow {
  return {
    company,
    created: 0,
    closed: 0,
    ongoing: 0,
    developmentWaiting: 0,
    customerWaiting: 0,
    createdKeys: [],
    closedKeys: [],
    ongoingKeys: [],
    developmentWaitingKeys: [],
    customerWaitingKeys: [],
  };
}

export async function buildJiraWeeklyTicketSummary(from: string, to: string): Promise<JiraWeeklyTicketSummary> {
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  const companyFieldIds = configuredCompanyFieldIds();
  const fields = Array.from(new Set([
    'summary',
    'status',
    'created',
    'resolutiondate',
    'updated',
    ...companyFieldIds,
  ]));

  if (!fromDate || !toDate) {
    return {
      enabled: false,
      from,
      to,
      totalCreated: 0,
      totalClosed: 0,
      totalOngoing: 0,
      totalDevelopmentWaiting: 0,
      totalCustomerWaiting: 0,
      total: 0,
      rows: [],
      warning: 'Jira tarih aralığı geçersiz. Format YYYY-MM-DD olmalı.',
      debug: { connected: false, issueCount: 0, companyFieldId: companyFieldIds[0] ?? '', queryMode: 'created-updated-range', sampleIssues: [], diagnostics: [] },
    };
  }

  const jql = buildCreatedUpdatedRangeJql(fromDate, toDate);
  const { issues, warning, diagnostics, searchEndpoint } = await fetchJiraIssues(jql, fields);
  const extraDiagnostics = await fetchJiraDiagnostics(fields);

  const toDateExclusive = nextDate(toDate);
  const pivot = new Map<string, JiraWeeklyTicketPivotRow>();
  const selectedIssues = issues.filter((issue) => (
    isDateInRange(issue?.fields?.created, fromDate, toDateExclusive)
    || isDateInRange(issue?.fields?.updated, fromDate, toDateExclusive)
  ));

  for (const issue of selectedIssues) {
    const key = cleanText(issue?.key, '');
    const company = inferCompanyFromIssue(issue).toLocaleUpperCase('tr');
    const row = pivot.get(company) ?? emptyRow(company);
    const createdInRange = isDateInRange(issue?.fields?.created, fromDate, toDateExclusive);

    if (createdInRange) {
      row.created += 1;
      if (key) row.createdKeys.push(key);
    }

    if (isDoneStatus(issue)) {
      row.closed += 1;
      if (key) row.closedKeys.push(key);
    } else if (isDevelopmentWaitingStatus(issue)) {
      row.developmentWaiting += 1;
      if (key) row.developmentWaitingKeys.push(key);
    } else if (isCustomerWaitingStatus(issue)) {
      row.customerWaiting += 1;
      if (key) row.customerWaitingKeys.push(key);
    } else if (isOngoingStatus(issue)) {
      row.ongoing += 1;
      if (key) row.ongoingKeys.push(key);
    }

    if (row.created || row.closed || row.ongoing || row.developmentWaiting || row.customerWaiting) {
      pivot.set(company, row);
    }
  }

  const rows = Array.from(pivot.values())
    .sort((a, b) => (
      (b.created + b.closed + b.ongoing + b.developmentWaiting + b.customerWaiting)
      - (a.created + a.closed + a.ongoing + a.developmentWaiting + a.customerWaiting)
    ) || a.company.localeCompare(b.company, 'tr'));

  const totalCreated = rows.reduce((sum, row) => sum + row.created, 0);
  const totalClosed = rows.reduce((sum, row) => sum + row.closed, 0);
  const totalOngoing = rows.reduce((sum, row) => sum + row.ongoing, 0);
  const totalDevelopmentWaiting = rows.reduce((sum, row) => sum + row.developmentWaiting, 0);
  const totalCustomerWaiting = rows.reduce((sum, row) => sum + row.customerWaiting, 0);

  return {
    enabled: !warning || issues.length > 0,
    from,
    to,
    totalCreated,
    totalClosed,
    totalOngoing,
    totalDevelopmentWaiting,
    totalCustomerWaiting,
    total: totalCreated,
    rows,
    warning: warning || undefined,
    jql,
    debug: {
      connected: !warning,
      issueCount: selectedIssues.length,
      selectedRangeCount: selectedIssues.length,
      recentProjectCount: extraDiagnostics.recentProjectCount,
      companyFieldId: companyFieldIds[0] ?? '',
      queryMode: 'created-updated-range',
      sampleIssueKey: cleanText(extraDiagnostics.recentIssues?.[0]?.key, ''),
      sampleIssueCompany: extraDiagnostics.recentIssues?.[0] ? inferCompanyFromIssue(extraDiagnostics.recentIssues[0]).toLocaleUpperCase('tr') : '',
      searchEndpoint,
      diagnostics: [...diagnostics, ...extraDiagnostics.diagnostics],
      availableStatuses: extraDiagnostics.availableStatuses,
      candidateCompanyFields: extraDiagnostics.candidateCompanyFields,
      sampleIssues: (selectedIssues.length ? selectedIssues : extraDiagnostics.recentIssues).slice(0, 10).map((issue) => ({
        key: cleanText(issue?.key, ''),
        company: inferCompanyFromIssue(issue).toLocaleUpperCase('tr'),
        status: statusName(issue),
        created: cleanText(issue?.fields?.created, '').slice(0, 10),
        resolved: cleanText(issue?.fields?.resolutiondate, '').slice(0, 10),
        summary: cleanText(issue?.fields?.summary, ''),
      })),
    },
  };
}
