# Chat Module — State Model

Phase 4/5 chat thread and history state for Sora-MissionControl.

This module owns the chat surface's state: selected profile, threads, message
history, drafts, and the message delivery lifecycle. It does NOT own transport,
auth, or the profile roster — those come from Cloud's shared backbone.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | All chat types: `ChatMessage`, `ChatThread`, `ChatRole`, `DeliveryState`, `ChatTransport`, `ChatState`, `ChatProfileContext`. |
| `chatStore.ts` | The store: per-profile thread isolation, message lifecycle, draft preservation, transport binding, React hook. |
| `chatStore.test.ts` | 23 determinism tests covering all edge cases. Run with `pnpm test`. |

## Data model

### Threads

A `ChatThread` belongs to exactly one profile (`profileId`) and never migrates.
A profile may have many threads; exactly one is "active" per profile at a time.

```
ChatThread {
  id           — stable, unique within a session (th_<n>)
  profileId    — owning AgentId
  sessionId    — Hermes session id (null until transport assigns one)
  messages[]   — ordered history, oldest first (may be empty)
  createdAt    — epoch ms, stable
  updatedAt    — epoch ms of last insertion/transition
  preview      — truncated last-message text (max 80 chars + ellipsis)
  draft        — per-thread composer draft (preserved across switches)
}
```

### Messages

```
ChatMessage {
  id          — stable, unique within a thread (msg_<n>)
  role        — 'user' | 'agent' | 'system'
  content     — verbatim, never mutated after insertion
  delivery    — 'pending' | 'sent' | 'delivered' | 'failed'
  createdAt   — epoch ms, stable
  updatedAt   — epoch ms of last delivery transition (null until first)
  sessionId   — transport session id (null until transport confirms)
  error       — error text when delivery === 'failed', null otherwise
}
```

### Delivery state machine

```
  user message:
    pending ──(transport ack, no sync reply)──► sent
    pending ──(transport ack + sync reply)────► delivered
    pending ──(transport error)──────────────► failed
    failed  ──(retryMessage)──────────────────► pending ──► sent/delivered/failed

  agent message:
    inserted directly as 'delivered' (from sync reply or async agent.reply event)

  system message:
    inserted as 'delivered' or 'failed' (never enters pending)
```

## Profile switching behaviour

Switching profiles preserves every profile's threads and restores the profile's
last-active thread (or `null` if the profile had none):

1. `selectProfile(profile)` — switches the selected profile. Each profile's
   `activeThreadIdByProfile[profile]` is preserved, so returning to a profile
   reopens its last-active thread.
2. `selectThread(profile, threadId)` — selects a thread as active for its
   owning profile. If the thread belongs to a different profile than the
   currently selected one, the selected profile is also switched.
3. Drafts are per-thread, not per-profile. Switching threads or profiles never
   loses composer text — the draft is stored on the thread and rehydrated
   when the thread is reselected.

## Edge cases

| Case | Behaviour |
|------|----------|
| New thread | Empty messages, empty preview, empty draft. Becomes the profile's active thread. |
| Empty history | Thread appears in the list with an empty-state placeholder (UI renders this). |
| First send with no active thread | `sendMessage` auto-creates a thread. |
| Profile with no threads | `getThreadIds(profile)` returns `[]`, `getActiveThreadId(profile)` returns `null`. |
| Delete active thread | Active pointer for that profile becomes `null`; other threads untouched. |
| Delete non-active thread | Active thread stays selected; deleted thread removed from list. |
| Transport failure | User message → `failed` with error text; `lastError` set at top level. |
| Retry a failed message | Original message transitions in place: `failed → pending → sent/delivered` (or back to `failed`). No duplicate message inserted. |
| Async agent reply | Appended as a new `delivered` agent message via `ChatEvent.agent.reply`. |
| Event for a deleted thread | Dropped silently (no crash, no orphaned state). |
| No transport bound | `sendMessage` rejects; `lastError` set. `canSend()` returns false. |

## Persistence assumptions

**Phase 4: in-memory only.** The store is a module singleton; state is lost on
page reload. The shape is designed so a future `persist()` could serialise
`state` to `localStorage`/IndexedDB by dropping `lastError` — everything else is
plain JSON data. Transport session ids (`thread.sessionId`) are Hermes-side
session handles; the backbone owns their durability, not this store.

## Transport boundary

The store depends only on the `ChatTransport` interface (defined in `types.ts`).
Cloud owns the concrete implementation. A verified transport and a
clearly-labelled demo/mock transport are interchangeable via `setTransport()`.

```
ChatTransport {
  listProfiles(): Promise<ProfileSummary[]>
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>
  subscribe?(handler: (event: ChatEvent) => void): () => void
}
```

The store subscribes to transport events on `setTransport()` and unsubscribes
on replacement or `setTransport(null)`.

## Contract compliance

Per `docs/section-contracts.md` → Chat module:

- **Owned state:** selected profile/thread, draft, local grouping. ✓
- **No CLI spawning from browser UI.** ✓ (transport is injected)
- **No direct secret/provider access.** ✓
- **No independent profile roster.** Consumes `profileStore` via `setProfiles()`. ✓
- **No consumer-messenger bubble style.** State model is styling-agnostic; visual language is command-console (Korra's contract). ✓

## Running the tests

```bash
pnpm test              # all tests
pnpm test src/modules/chat   # chat only
pnpm lint              # tsc --noEmit
```