# Sora Inbox Webhook Status and Fix

## Problem

Attempts to ping Sora's inbox using `sora_inbox_ping.py` now reach the route but consistently return `401 Unauthorized` with the message "Invalid signature".

This indicates one of two possibilities:
1. The webhook subscription secret and the receiver's expected HMAC secret do not match.
2. There's an underlying issue with the Sora inbox service or its HMAC validation.

`hermes webhook list` now shows `sora-inbox` as a registered webhook. Secret values are intentionally not recorded in this project file.

Test attempts produce:
```
status=401
{"error": "Invalid signature"}
```

## Action Taken

1. Verified `hermes webhook list` initially showed no subscriptions.
2. Subscribed `sora-inbox` webhook with the provided URL `http://localhost:8644/webhooks/sora-inbox` using a secret value, which must remain redacted.
3. Attempted to ping using `python3 /home/wliob/.hermes/scripts/sora_inbox_ping.py`.
4. Encountered consistent 401 "Invalid signature" errors.
5. Attempted to verify the stored secret but was denied access due to security restrictions.

## Resolution

Sora diagnosed the remaining `401 Invalid signature` as an active-gateway ownership mismatch:
- Port `8644` is currently owned by the Cloud profile gateway process.
- The helper originally signed with the default profile's `~/.hermes/webhook_subscriptions.json` secret.
- The active receiver expected the Cloud profile subscription secret.

Fix applied:
1. `/home/wliob/.hermes/scripts/sora_inbox_ping.py` now detects the process listening on the target webhook port and loads that profile's `webhook_subscriptions.json` secret, without printing the secret.
2. The Cloud profile `sora-inbox` subscription prompt/metadata was synced to the default Sora inbox template while preserving Cloud's existing secret.
3. The helper was syntax-checked with `python3 -m py_compile`.

Verification:
```text
python3 /home/wliob/.hermes/scripts/sora_inbox_ping.py --lead cloud --task-summary "sora inbox route repaired diagnostic" ...
status=202
```

Current status: route accepts signed pings again. After a stale Cloud final output accidentally echoed a webhook secret, Sora rotated both the default and Cloud profile `sora-inbox` secrets without recording the new values; verification still returns `status=202` through the shared helper. Longer-term cleanup should give the default/Sora gateway ownership of port `8644` or assign unique webhook ports per profile to avoid future confusion.
