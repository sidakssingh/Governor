import type { ReactNode } from "react";
import Link from "next/link";

type GovernorNavProps = {
  rightSlot?: ReactNode;
};

export default function GovernorNav({ rightSlot }: GovernorNavProps) {
  return (
    <nav className="demo-top-nav container-wide">
      <Link href="/" className="demo-brand-wrap">
        <p className="serif-title demo-wordmark">Governor</p>
        <p className="demo-definition">[a mechanism that automatically regulates a system to keep it within safe bounds]</p>
      </Link>

      <div className="demo-nav-links">
        <Link className="nav-link text-sm text-[var(--text-secondary)]" href="/#product">Product</Link>
        <Link className="nav-link text-sm text-[var(--text-secondary)]" href="/#builders">For builders</Link>
        <Link className="nav-link text-sm text-[var(--text-secondary)]" href="/#security">Security</Link>
        <Link className="nav-link text-sm text-[var(--text-secondary)]" href="/#use-cases">Use cases</Link>
        <Link className="nav-link text-sm text-[var(--text-secondary)]" href="/#builders">Docs</Link>
        <Link href="/#join" className="btn-primary text-sm">Join early access</Link>
        {rightSlot}
      </div>
    </nav>
  );
}
