"use client";

import Link from "next/link";
import { logout, useUser } from "@/lib/useAuth";

export default function AccountButton() {
  const user = useUser();
  if (!user) {
    return (
      <Link href="/login" className="nav-account">
        登入
      </Link>
    );
  }
  return (
    <span className="nav-account-wrap">
      <span className="nav-email" title={user.email}>
        🦊 {user.email}
      </span>
      <button className="nav-logout" onClick={() => logout()}>
        登出
      </button>
    </span>
  );
}
