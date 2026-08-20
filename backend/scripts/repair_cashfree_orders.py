#!/usr/bin/env python3
"""Repair Cashfree orders stuck in 'created' but PAID on Cashfree → enroll + invoice."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app import create_app
from app.cashfree_sync import sync_all_pending_cashfree_orders


def main() -> int:
    app = create_app()
    with app.app_context():
        r = sync_all_pending_cashfree_orders(limit=300)
        print("Checked:", r.get("checked"))
        print("Finalized (enrolled + invoiced):", r.get("finalized"))
        print("Still pending on Cashfree:", r.get("stillPendingOnCashfree"))
        print("Errors:", r.get("errors"))
        for item in r.get("items") or []:
            if item.get("ok") and not item.get("alreadySuccess"):
                print("  OK", item.get("merchantOrderId"), item.get("invoiceNumber"))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
