import type { Metadata } from 'next';
import Link from 'next/link';
import { bn } from '@/lib/data';
import { requireAdmin } from '@/lib/admin/auth';
import { listFeedRuns, brokenCollectors } from '@/lib/admin/feed';
import { RSS_SOURCES, SEARCH_ONLY_SOURCES } from '../../../../../../config/news-sources';
import { AdminPage, Panel, Table, Td, Badge, Empty, Notice, when } from '@/app/admin/ui';
import FeedRunButton from './FeedRunButton';

export const metadata: Metadata = { title: 'সংগ্রহের ইতিহাস' };

const TRIGGER_BN: Record<string, string> = { cron: 'নির্ধারিত সময়ে (Supabase Cron)', github: 'GitHub, ৩০ মিনিট', admin: 'অ্যাডমিন', cli: 'টার্মিনাল', manual: 'হাতে' };
const STATUS_BN: Record<string, string> = { ok: 'সফল', failed: 'ব্যর্থ', aborted: 'থামানো', running: 'চলছে' };

export default async function FeedRuns() {
  await requireAdmin();
  const runs = await listFeedRuns(50);
  const broken = brokenCollectors(runs);
  const latest = runs.find((r) => r.collector === 'rss' && r.detail);
  const quiet = latest?.detail
    ? RSS_SOURCES.filter((s) => !(latest.detail as Record<string, number>)[s.key]).map((s) => s.nameBn)
    : [];

  return (
    <AdminPage
      title="সংগ্রহের ইতিহাস"
      lede={`সংবাদ ও ভিডিও সংগ্রহের প্রতিটি চেষ্টা। ${bn(RSS_SOURCES.length)}টি সংবাদমাধ্যমের ফিড প্রতি ৩০ মিনিটে পড়া হয়; ${bn(SEARCH_ONLY_SOURCES.length)}টির ফিড নেই, সেগুলো সার্চ কালেক্টরের কাজ।`}
      actions={<Link href="/admin/feed" className="hover:underline">সংবাদ ফিড →</Link>}
    >
      {broken.length > 0 && (
        <Notice tone="bad">
          <strong>{broken.join(', ')}</strong> টানা তিনবার ব্যর্থ। সংবাদমাধ্যমের ঠিকানা বদলেছে কিনা দেখে config/news-sources.ts হালনাগাদ করতে হবে।
        </Notice>
      )}
      {quiet.length > 0 && (
        <Notice tone="warn">
          সর্বশেষ সংগ্রহে কিছুই পাওয়া যায়নি: {quiet.join(', ')}।
        </Notice>
      )}

      <Panel title="এখনই সংগ্রহ করুন">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[14px] leading-relaxed text-inksoft max-w-[620px]">
            শিডিউলের বাইরে একবার চালায়। যা নতুন, শুধু তাই যোগ হয়; আগের কোনো সিদ্ধান্ত বদলায় না। ৫০ সেকেন্ডে যতটা হয় ততটা,
            বাকিটা পরের বারে।
          </p>
          <FeedRunButton />
        </div>
      </Panel>

      <Panel title="সর্বশেষ ৫০টি" flush>
        {runs.length === 0 ? (
          <div className="p-5"><Empty>এখনো কোনো সংগ্রহ চলেনি।</Empty></div>
        ) : (
          <Table head={['কখন', 'কে চালাল', 'ফল', 'পাওয়া', 'নতুন', 'যুক্ত', 'যাচাইয়ে', 'কারও নয়', 'কোটা', 'ত্রুটি']} minWidth={940}>
            {runs.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-muted">{when(r.started_at)}</Td>
                <Td className="whitespace-nowrap text-[13px]">{TRIGGER_BN[r.trigger ?? ''] ?? r.trigger ?? 'নেই'}</Td>
                <Td>
                  <Badge tone={r.status === 'ok' ? 'good' : r.status === 'running' ? 'warn' : 'bad'}>{STATUS_BN[r.status] ?? r.status}</Badge>
                  <span className="block text-[12px] text-muted">{r.collector}</span>
                </Td>
                <Td className="tnum">{bn(r.items_found)}</Td>
                <Td className="tnum">{bn(r.items_new)}</Td>
                <Td className="tnum">{bn(r.items_attached)}</Td>
                <Td className="tnum">{bn(r.low_confidence)}</Td>
                <Td className="tnum">{bn(r.unmatched)}</Td>
                <Td className="tnum">{r.quota_used ? bn(r.quota_used) : 'নেই'}</Td>
                <Td className="text-[12.5px] text-muted max-w-[280px] break-words">
                  {(r.errors ?? []).map((e) => `${e.source}: ${e.message}`).join('; ')}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      {latest?.detail && (
        <Panel title="সর্বশেষ সংগ্রহে কোন সংবাদমাধ্যম কতটি">
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13.5px]">
            {Object.entries(latest.detail as Record<string, number>)
              .sort((a, b) => b[1] - a[1])
              .map(([key, n]) => {
                const s = RSS_SOURCES.find((x) => x.key === key);
                return <li key={key} className={n ? '' : 'text-muted'}>{s?.nameBn ?? key} {bn(n)}</li>;
              })}
          </ul>
        </Panel>
      )}
    </AdminPage>
  );
}
