import { describe, expect, it } from 'vitest';
import { dueSlots, jobEnv, rebuildRequest, type Slot } from './scheduler';

const at = (iso: string) => new Date(iso);
const names = (slots: Slot[]) => slots.map((s) => s.name);
const paths = (slots: Slot[]) => slots.flatMap((s) => s.steps.map((step) => (step.kind === 'call' ? step.path : `job:${step.job}`)));

describe('worker schedule', () => {
  it('runs the parliament chain at 02:00 Dhaka and always rebuilds after it', () => {
    const slots = dueSlots(at('2026-10-08T20:00:00Z'), false);
    expect(names(slots)).toEqual(['parliament nightly', 'news']);
    expect(paths([slots[0]!])).toEqual(['job:parliament', 'job:parliament:photos', 'job:parliament:report']);
    expect(slots[0]!.rebuild).toBe('always');
    // 20 is not a third hour, so this news run does not rebuild a second time.
    expect(slots[1]!.rebuild).toBeUndefined();
  });

  it('collects news every half hour and rebuilds on the hour every third hour when it worked', () => {
    expect(names(dueSlots(at('2026-10-08T10:30:00Z'), false))).toEqual(['news']);
    expect(dueSlots(at('2026-10-08T10:30:00Z'), false)[0]!.rebuild).toBeUndefined();
    expect(dueSlots(at('2026-10-08T09:00:00Z'), false)[0]!.rebuild).toBe('on-success');
    expect(dueSlots(at('2026-10-08T10:00:00Z'), false)[0]!.rebuild).toBeUndefined();
    expect(dueSlots(at('2026-10-08T09:30:00Z'), false)[0]!.rebuild).toBeUndefined();
    expect(dueSlots(at('2026-10-08T10:17:00Z'), false)).toEqual([]);
  });

  it('calls none of the site routes while site jobs are off', () => {
    for (const minute of ['00', '15', '40', '45']) {
      expect(dueSlots(at(`2026-10-05T04:${minute}:00Z`), false).every((s) => s.lane === 'sangsad')).toBe(true);
    }
  });

  it('alternates feeds and sitemaps each quarter hour, with YouTube once an hour', () => {
    expect(paths(dueSlots(at('2026-10-08T10:00:00Z'), true).filter((s) => s.name === 'feed'))).toEqual([
      '/api/cron/feed?collector=rss',
      '/api/cron/feed?collector=thumbs',
    ]);
    expect(paths(dueSlots(at('2026-10-08T10:15:00Z'), true).filter((s) => s.name === 'feed'))).toEqual([
      '/api/cron/feed?collector=sitemap',
      '/api/cron/feed?collector=youtube',
    ]);
    expect(paths(dueSlots(at('2026-10-08T10:45:00Z'), true).filter((s) => s.name === 'feed'))).toEqual(['/api/cron/feed?collector=sitemap']);
    const youtubePerDay = Array.from({ length: 96 }, (_, q) => dueSlots(new Date(Date.UTC(2026, 9, 8, 0, q * 15)), true))
      .flatMap(paths)
      .filter((p) => p.endsWith('collector=youtube')).length;
    expect(youtubePerDay).toBe(24);
  });

  it('keeps the search, posts, press, learn and probe beats', () => {
    expect(names(dueSlots(at('2026-10-08T07:45:00Z'), true))).toEqual(['feed', 'search']);
    expect(names(dueSlots(at('2026-10-08T06:40:00Z'), true))).toEqual(['posts sync']);
    expect(names(dueSlots(at('2026-10-08T07:40:00Z'), true))).toEqual([]);
    expect(names(dueSlots(at('2026-10-08T03:40:00Z'), true))).toEqual(['press']);
    // 5 October 2026 is a Monday.
    expect(names(dueSlots(at('2026-10-05T04:00:00Z'), true))).toContain('learn');
    expect(names(dueSlots(at('2026-10-06T04:00:00Z'), true))).not.toContain('learn');
    expect(names(dueSlots(at('2026-10-08T12:00:00Z'), true))).toContain('probe');
    expect(names(dueSlots(at('2026-10-08T13:00:00Z'), true))).not.toContain('probe');
  });

  it('gives every site call a lane of its own, apart from the সংসদ jobs', () => {
    const slots = dueSlots(at('2026-10-08T00:00:00Z'), true);
    expect(slots.filter((s) => s.lane === 'sangsad').map((s) => s.name)).toEqual(['news']);
    expect(slots.filter((s) => s.lane === 'site').map((s) => s.name)).toEqual(['feed', 'probe']);
  });
});

describe('job environment', () => {
  it('passes through env vars with defaults', () => {
    const env = jobEnv({
      DATABASE_URL: 'postgresql://TEST_db',
      NEXT_PUBLIC_SUPABASE_URL: 'https://TEST.example',
      SUPABASE_SERVICE_ROLE_KEY: 'TEST_key',
    });
    expect(env.DATABASE_URL).toBe('postgresql://TEST_db');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://TEST.example');
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('TEST_key');
    expect(env.DATABASE_SSL).toBe('disable');
    expect(env.DATABASE_SCHEMA).toBe('sangsad');
    expect(env.APP_ENV).toBe('production');
  });

  it('respects overrides', () => {
    const env = jobEnv({ DATABASE_URL: 'postgresql://TEST', DATABASE_SSL: 'require', APP_ENV: 'staging' });
    expect(env.DATABASE_SSL).toBe('require');
    expect(env.APP_ENV).toBe('staging');
  });
});

describe('rebuild request', () => {
  it('is skipped without a token', () => {
    expect(rebuildRequest({}, 'TEST')).toBeNull();
    expect(rebuildRequest({ MYMP_DEPLOY_TOKEN: ' ' }, 'TEST')).toBeNull();
  });

  it('sends the rebuild dispatch to the repository the deploy runs from', () => {
    const r = rebuildRequest({ MYMP_DEPLOY_TOKEN: 'TEST_token', DEPLOY_REPOSITORY: 'TEST-owner/TEST-repo' }, 'worker:news')!;
    expect(r.url).toBe('https://api.github.com/repos/TEST-owner/TEST-repo/dispatches');
    expect((r.init.headers as Record<string, string>).authorization).toBe('Bearer TEST_token');
    expect(JSON.parse(r.init.body as string)).toEqual({ event_type: 'rebuild', client_payload: { source: 'worker:news' } });
    expect(rebuildRequest({ MYMP_DEPLOY_TOKEN: 'TEST_token' }, 'x')!.url).toContain('/repos/touristvisadomain-cloud/mymp/');
  });

  it("prefers the hosting platform's deploy webhook when one is set", () => {
    const post = rebuildRequest({ DEPLOY_HOOK_URL: 'https://TEST.example/api/deploy/TEST', MYMP_DEPLOY_TOKEN: 'TEST_token' }, 'x')!;
    expect(post.url).toBe('https://TEST.example/api/deploy/TEST');
    expect(post.init.method).toBe('POST');
    expect(post.init.headers).toEqual({});
    const get = rebuildRequest({ DEPLOY_HOOK_URL: 'https://TEST.example/deploy?uuid=TEST', DEPLOY_HOOK_METHOD: 'get', DEPLOY_HOOK_TOKEN: 'TEST_hook' }, 'x')!;
    expect(get.init.method).toBe('GET');
    expect((get.init.headers as Record<string, string>).authorization).toBe('Bearer TEST_hook');
  });
});
