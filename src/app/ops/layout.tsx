import './ops.css';

export const metadata = { title: 'Operations', robots: { index: false, follow: false } };

/** Root of the operations panel (dashboard + login). Scopes the panel's design system to .o-app. */
export default function OpsRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="o-app">{children}</div>;
}
