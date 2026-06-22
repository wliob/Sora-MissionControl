# Sora-MissionControl Phase 6 Secret Handling Note

Date: 2026-06-21
Owner: Sora / Central Command

A stale Cloud completion output echoed a `sora-inbox` HMAC secret while reporting the earlier webhook mismatch. The route had already been repaired by profile-aware signing, but the echoed value is now treated as exposed.

Actions taken:
- Rotated the `sora-inbox` secret in `/home/wliob/.hermes/webhook_subscriptions.json`.
- Rotated the `sora-inbox` secret in `/home/wliob/.hermes/profiles/cloud/webhook_subscriptions.json`.
- Did not write the new secret values to any project file or chat output.
- Re-tested `/home/wliob/.hermes/scripts/sora_inbox_ping.py`; result `status=202`.

Operational rule:
- Leads must use `/home/wliob/.hermes/scripts/sora_inbox_ping.py` and must not paste or print webhook secrets in reports.
