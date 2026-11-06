import Link from 'next/link';
import { Icon } from '../_components/icons';

export default function DashboardNotFound() {
  return (
    <div className="o-card">
      <div className="o-empty">
        <span className="o-empty-icon">
          <Icon name="search" size={20} />
        </span>
        <h3>Record not found</h3>
        <p>It may have been removed, or the link is incorrect.</p>
        <Link href="/ops" className="o-btn o-btn--secondary">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
