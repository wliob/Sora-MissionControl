/**
 * ChatPanel — command-console chat surface (Phase 4).
 *
 * Wires the shared chatStore: profile selection, thread navigation, message
 * history, draft composer, and send/retry through the bound transport.
 * Replaces the Phase 1 demo state with real store-backed rendering.
 *
 * Visual language is command-console, not consumer-messenger bubbles (per
 * docs/section-contracts.md → Chat module forbidden dependencies).
 *
 * The panel consumes the store; it never touches transport, auth, or the
 * profile roster directly. When the demo mock transport is active a clear
 * DEMO MODE label is shown so demo output is never mistaken for live agent
 * responses.
 */

import { useEffect, useMemo } from 'react';
import type { AgentId } from '@/types';
import { AGENTS } from '@/types';
import { useShellState, shellStore } from '@/state/shellStore';
import { ProfileSelector } from '@/components/common/ProfileSelector';
import { CommandInput } from '@/components/common/CommandInput';
import {
  useChatState,
  selectProfile,
  selectThread,
  createThread,
  setDraft,
  sendMessage,
  retryMessage,
  canSend,
  getActiveThread,
  getThreadIds,
} from '@/modules/chat/chatStore';
import { isDemoMode } from '@/modules/chat/chatBackbone';
import type { ChatMessage } from '@/modules/chat/types';

function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const DELIVERY_LABEL: Record<ChatMessage['delivery'], string> = {
  pending: 'sending',
  sent: 'sent',
  delivered: '',
  failed: 'failed',
};

export function ChatPanel() {
  const { selectedAgent } = useShellState();
  const chatState = useChatState();
  const activeAgent: AgentId | null = selectedAgent ?? null;

  // Keep the chat store's selected profile in sync with the shell's
  // selectedAgent. The shell owns the cross-section selected agent; the chat
  // store mirrors it so thread lookups resolve for the right profile.
  useEffect(() => {
    selectProfile(activeAgent);
  }, [activeAgent]);

  const agentMeta = useMemo(
    () => AGENTS.find((a) => a.id === activeAgent) ?? null,
    [activeAgent],
  );

  const activeThread = activeAgent ? getActiveThread() : null;
  const threadIds = activeAgent ? getThreadIds(activeAgent) : [];
  const demo = isDemoMode();
  const sendEnabled = canSend() && activeAgent !== null;

  function handleSelectProfile(id: AgentId) {
    shellStore.setSelectedAgent(id);
    // selectProfile is driven by the effect above; no direct call needed.
  }

  function handleSelectThread(threadId: string) {
    if (!activeAgent) return;
    selectThread(activeAgent, threadId);
  }

  function handleNewThread() {
    if (!activeAgent) return;
    createThread(activeAgent);
  }

  async function handleSend(text: string) {
    if (!activeAgent) return;
    try {
      await sendMessage(activeAgent, text);
    } catch {
      // The store records the failure on the message + lastError; the UI
      // surfaces it via the failed delivery state. No throw to the console.
    }
  }

  function handleDraftChange(text: string) {
    if (activeThread) setDraft(activeThread.id, text);
  }

  async function handleRetry(threadId: string, messageId: string) {
    try {
      await retryMessage(threadId, messageId);
    } catch {
      // Store records the failure; UI shows it.
    }
  }

  const profileActivity = useMemo(() => {
    const out: Partial<Record<AgentId, 'idle' | 'working' | 'blocked'>> = {};
    for (const a of AGENTS) {
      const ctx = chatState.profiles[a.id];
      out[a.id] = ctx?.activity ?? 'idle';
    }
    return out;
  }, [chatState.profiles]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* Profile rail */}
      <ProfileSelector
        selected={activeAgent}
        onSelect={handleSelectProfile}
        activity={profileActivity}
      />

      {/* Agent status header — consistent with office/ops + DEMO MODE label */}
      {agentMeta && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            borderBottom: '1px solid var(--border-faint)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: agentMeta.accent,
              boxShadow: `0 0 6px ${agentMeta.accent}`,
            }}
          />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>
            {agentMeta.name}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {agentMeta.role}
          </span>
          {demo && (
            <span
              className="mono"
              title="Demo mock transport is active — replies are canned, not from a live agent"
              style={{
                marginLeft: 'auto',
                fontSize: 'var(--text-xs)',
                color: 'var(--accent-amber, var(--text-dim))',
                padding: '1px 6px',
                border: '1px solid var(--border-faint)',
                borderRadius: 'var(--radius-sm)',
                letterSpacing: '0.04em',
              }}
            >
              DEMO MODE
            </span>
          )}
        </div>
      )}

      {/* Thread rail — command-console thread navigation, no bubbles */}
      {activeAgent && threadIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: 'var(--space-1) var(--space-3)',
            borderBottom: '1px solid var(--border-faint)',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            flexShrink: 0,
          }}
        >
          {threadIds.map((id) => {
            const t = chatState.threads[id];
            const isActive = activeThread?.id === id;
            return (
              <button
                key={id}
                onClick={() => handleSelectThread(id)}
                title={t?.preview || 'empty thread'}
                style={{
                  padding: '2px 8px',
                  background: isActive ? 'var(--surface-active)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--border-active)' : 'var(--border-faint)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontSize: 'var(--text-xs)',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  maxWidth: '160px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t?.preview || 'new thread'}
              </button>
            );
          })}
          <button
            onClick={handleNewThread}
            title="new thread"
            style={{
              padding: '2px 8px',
              background: 'transparent',
              border: '1px dashed var(--border-faint)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              flexShrink: 0,
              fontSize: 'var(--text-xs)',
              color: 'var(--text-dim)',
            }}
          >
            + new
          </button>
        </div>
      )}

      {/* Message list — command-console style, not consumer bubbles */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 'var(--space-3) var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        {!activeAgent && (
          <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
            Select a profile to begin.
          </div>
        )}
        {activeAgent && !activeThread && (
          <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
            No active thread. Send a message or start a new thread.
          </div>
        )}
        {activeThread && activeThread.messages.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
            Thread is empty. Issue a directive below.
          </div>
        )}
        {activeThread?.messages.map((msg) => {
          const isOut = msg.role === 'user';
          const msgAgent = AGENTS.find((a) => a.id === activeThread.profileId);
          const deliveryLabel = DELIVERY_LABEL[msg.delivery];
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                alignItems: isOut ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-dim)',
                }}
              >
                <span
                  style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: isOut ? 'var(--text-dim)' : msgAgent?.accent ?? 'var(--text-dim)',
                  }}
                />
                <span className="mono">{hhmm(msg.createdAt)}</span>
                {deliveryLabel && (
                  <span
                    className="mono"
                    style={{
                      color: msg.delivery === 'failed' ? 'var(--accent-red, var(--text-dim))' : 'var(--text-dim)',
                    }}
                  >
                    {deliveryLabel}
                  </span>
                )}
              </div>
              <div
                style={{
                  maxWidth: '90%',
                  padding: 'var(--space-2) var(--space-3)',
                  background: isOut ? 'var(--surface-active)' : 'var(--surface-base)',
                  border: `1px solid ${isOut ? 'var(--border-active)' : 'var(--border-faint)'}`,
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-base)',
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}
              >
                {msg.content}
              </div>
              {msg.delivery === 'failed' && msg.role === 'user' && (
                <button
                  onClick={() => handleRetry(activeThread.id, msg.id)}
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--accent-cyan, var(--text-secondary))',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  retry
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Command input — controlled draft so the store preserves it across
          thread/profile switches and rehydrates on thread reselection */}
      <CommandInput
        onSubmit={handleSend}
        disabled={!sendEnabled}
        accent={agentMeta?.accent ?? 'var(--accent-cyan)'}
        value={activeThread?.draft ?? ''}
        onChange={handleDraftChange}
        placeholder={
          activeAgent
            ? `Issue a directive to ${agentMeta?.name ?? activeAgent}…`
            : 'Select a profile first…'
        }
      />
    </div>
  );
}