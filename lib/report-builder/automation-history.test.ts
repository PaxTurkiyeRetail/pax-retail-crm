import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportUser } from './access';

const mocks = vi.hoisted(() => ({ query: vi.fn(), page: vi.fn(), run: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: { query: mocks.query } }));
vi.mock('@/lib/report-builder/pages-repo', () => ({ getPage: mocks.page, loadLetterheadAsset: vi.fn() }));
vi.mock('@/lib/report-builder/page-runner', () => ({ runPage: mocks.run }));
vi.mock('@/lib/report-builder/pdf', () => ({ loadPdfFonts: vi.fn(), renderPagePdf: vi.fn() }));
vi.mock('@/lib/mail', () => ({ sendMail: vi.fn(), isMailConfigured: () => false }));
vi.mock('@/lib/authz', () => ({ resolveRolePermissionsFromDb: vi.fn() }));
import { listAutomations } from './automation';

const ceiling = ['report.read.all', 'quote.read', 'forecast.read'] as const;
const user: ReportUser = { id: 'owner', email: 'owner@example.test', full_name: 'Owner', permissions: ceiling };
const observation = { observed: 12345, condition: true, permissionCeiling: [...ceiling] };
let historyResult: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  historyResult = structuredClone(observation);
  mocks.page.mockResolvedValue({ owner_user_id: user.id, page: { widgets: [] } });
  mocks.run.mockResolvedValue({});
  mocks.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes('report_page_automation_runs')
      ? [{ id: 'run', status: 'sent', result: historyResult }]
      : [],
  }));
});

describe('automation observation history permissions', () => {
  it.each(['quote.read', 'forecast.read'] as const)('redacts observations after %s is revoked', async (revoked) => {
    const current = { ...user, permissions: ceiling.filter(permission => permission !== revoked) };
    const result = await listAutomations(current, 'page');
    expect(result.runs[0].result).toEqual({});
    expect(result.runs[0].result).not.toHaveProperty('observed');
    expect(result.runs[0].result).not.toHaveProperty('condition');
    expect(result.runs[0].status).toBe('sent');
  });

  it('preserves observations while every captured permission remains granted', async () => {
    const result = await listAutomations(user, 'page');
    expect(result.runs[0].result).toEqual(observation);
  });

  it('redacts legacy observations without a permission ceiling', async () => {
    historyResult = { observed: 12345, condition: true };
    const result = await listAutomations(user, 'page');
    expect(result.runs[0].result).toEqual({});
  });
});
