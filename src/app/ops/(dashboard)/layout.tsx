import { notificationSummary } from '@/lib/admin/dashboard';
import { requireAdmin } from '@/lib/auth/guards';
import { env } from '@/lib/env';
import { logoutAction } from '../actions';
import { Shell, type Notice } from '../_components/Shell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin('VIEWER');
  let paymentMode: string;
  try {
    paymentMode = env.cashfree.mode;
  } catch {
    paymentMode = 'misconfigured';
  }

  // Notification counts are best-effort: the panel must still render if one of them fails.
  const n = await notificationSummary().catch(() => ({ attention: 0, failedWebhooks: 0, newApplications: 0, deliveryProblems: 0, pendingRefunds: 0 }));
  const notices: Notice[] = [
    { label: 'Orders need attention', detail: 'Mismatch, late webhook or undelivered confirmation', count: n.attention, href: '/ops/orders?status=attention', icon: 'orders' },
    { label: 'Failed webhooks', detail: 'Payment events that could not be processed', count: n.failedWebhooks, href: '/ops/webhooks?status=failed', icon: 'webhooks' },
    { label: 'New mentorship applications', detail: 'Waiting for a decision', count: n.newApplications, href: '/ops/applications?status=new', icon: 'mentorship' },
    { label: 'Refunds in progress', detail: 'Pending or on hold at Cashfree', count: n.pendingRefunds, href: '/ops/refunds', icon: 'refunds' },
    { label: 'Message delivery failures', detail: 'Provider errors in the last 7 days', count: n.deliveryProblems, href: '/ops#delivery', icon: 'alert' },
  ];

  return (
    <Shell
      admin={{ name: admin.name, email: admin.email, role: admin.role }}
      paymentMode={paymentMode}
      notices={notices}
      counts={{ applications: n.newApplications, attention: n.attention }}
      logoutAction={logoutAction}
    >
      {children}
    </Shell>
  );
}
