"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import GovernorNav from "@/app/components/governor-nav";
import {
  ApiError,
  approveTransaction,
  centsToDollars,
  denyTransaction,
  freezeAgent,
  freezeUser,
  getAdminMe,
  getAgentHistory,
  getPolicyForAgent,
  listAgents,
  listPending,
  listTransactions,
  listUsers,
  simulateSpend,
  unfreezeAgent,
  unfreezeUser,
  upsertPolicyForAgent,
} from "@/app/lib/console-api";
import type { Agent, Policy, SpendResponse, Transaction, User } from "@/app/lib/console-types";

const ADMIN_TOKEN_KEY = "governor_admin_token";

function uidv4Like(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const rand = (Math.random() * 16) | 0;
    const value = ch === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function statusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("approved")) return "demo-pill demo-pill-approved";
  if (normalized.includes("pending")) return "demo-pill demo-pill-pending";
  return "demo-pill demo-pill-denied";
}

function isAdminSessionError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 401;
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return message.includes("invalid session") || message.includes("unauthorized");
}

function normalizePolicy(policy: Policy): Policy {
  const dailyLimit = Number.isFinite(policy.daily_limit_cents) ? policy.daily_limit_cents : 0;
  const perTxnLimit = Number.isFinite(policy.per_transaction_limit_cents) && policy.per_transaction_limit_cents > 0
    ? policy.per_transaction_limit_cents
    : dailyLimit;

  return {
    ...policy,
    daily_limit_cents: dailyLimit,
    per_transaction_limit_cents: perTxnLimit,
    allowed_vendors: policy.allowed_vendors || [],
    allowed_mccs: policy.allowed_mccs || [],
    allowed_weekdays_utc: policy.allowed_weekdays_utc || [],
    allowed_hours_utc: policy.allowed_hours_utc || [],
  };
}

export default function ConsolePage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  const [users, setUsers] = useState<User[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pending, setPending] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [guidelineDraft, setGuidelineDraft] = useState("");
  const [agentHistory, setAgentHistory] = useState<Transaction[]>([]);

  const [spendApiKey, setSpendApiKey] = useState("sk_test_agent_123");
  const [spendVendor, setSpendVendor] = useState("openai.com");
  const [spendMcc, setSpendMcc] = useState("5734");
  const [spendAmount, setSpendAmount] = useState("5.00");
  const [spendResult, setSpendResult] = useState<SpendResponse | null>(null);

  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [savingGuideline, setSavingGuideline] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [busyKillSwitch, setBusyKillSwitch] = useState(false);
  const [busyTransactionId, setBusyTransactionId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [runFlowPulse, setRunFlowPulse] = useState(false);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) || null,
    [agents, selectedAgentId],
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(ADMIN_TOKEN_KEY) || "";
    setToken(stored);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!runFlowPulse) return;
    const timer = window.setTimeout(() => setRunFlowPulse(false), 900);
    return () => window.clearTimeout(timer);
  }, [runFlowPulse]);

  useEffect(() => {
    if (!authReady) return;
    if (!token) router.replace("/sign-in");
  }, [authReady, token, router]);

  const markReauthRequired = useCallback((message: string) => {
    setNeedsReauth(true);
    setStatusMessage("Session expired. Re-authentication required.");
    setErrorMessage(message);
  }, []);

  const handleAdminError = useCallback((err: unknown, fallbackMessage: string) => {
    const message = err instanceof Error ? err.message : fallbackMessage;
    if (isAdminSessionError(err)) {
      markReauthRequired(message);
      return;
    }
    setErrorMessage(message);
  }, [markReauthRequired]);

  const logout = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken("");
    setNeedsReauth(false);
    setAdminEmail("");
    setUsers([]);
    setAgents([]);
    setPending([]);
    setRecentTransactions([]);
    setPolicy(null);
    setGuidelineDraft("");
    setAgentHistory([]);
    router.push("/sign-in");
  };

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const bootstrap = async () => {
      setLoadingDashboard(true);
      setErrorMessage("");
      try {
        const [me, usersRes, agentsRes, pendingRes, txRes] = await Promise.all([
          getAdminMe(token),
          listUsers(token, 20),
          listAgents(token, 30),
          listPending(token, 30),
          listTransactions(token, 30),
        ]);

        if (cancelled) return;
        setAdminEmail(me.admin.email);
        setUsers(usersRes.users);
        setAgents(agentsRes.agents);
        setPending(pendingRes.transactions);
        setRecentTransactions(txRes.transactions);

        const nextAgentId = selectedAgentId || pendingRes.transactions[0]?.agent_id || agentsRes.agents[0]?.id || "";
        setSelectedAgentId(nextAgentId);
      } catch (err) {
        if (cancelled) return;
        handleAdminError(err, "Failed to load dashboard data");
      } finally {
        if (!cancelled) setLoadingDashboard(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || !selectedAgentId) {
      setPolicy(null);
      setGuidelineDraft("");
      setAgentHistory([]);
      return;
    }

    let cancelled = false;
    const loadAgentContext = async () => {
      try {
        const [policyRes, historyRes] = await Promise.all([
          getPolicyForAgent(token, selectedAgentId),
          getAgentHistory(token, selectedAgentId, 10),
        ]);
        if (cancelled) return;
        const normalizedPolicy = normalizePolicy(policyRes.policy);
        setPolicy(normalizedPolicy);
        setGuidelineDraft(normalizedPolicy.purchase_guideline || "");
        setAgentHistory(historyRes.transactions);
      } catch (err) {
        if (cancelled) return;
        handleAdminError(err, "Failed to load agent context");
      }
    };

    loadAgentContext();
    return () => {
      cancelled = true;
    };
  }, [token, selectedAgentId, handleAdminError]);

  const refreshTransactions = async (sessionToken: string) => {
    const [pendingRes, txRes] = await Promise.all([
      listPending(sessionToken, 30),
      listTransactions(sessionToken, 30),
    ]);
    setPending(pendingRes.transactions);
    setRecentTransactions(txRes.transactions);
  };

  const handleReviewAction = async (transactionId: string, action: "approve" | "deny") => {
    if (!token) return;
    setBusyTransactionId(transactionId);
    setErrorMessage("");

    try {
      if (action === "approve") {
        await approveTransaction(token, transactionId);
      } else {
        await denyTransaction(token, transactionId);
      }

      await refreshTransactions(token);
      if (selectedAgentId) {
        const [policyRes, historyRes] = await Promise.all([
          getPolicyForAgent(token, selectedAgentId),
          getAgentHistory(token, selectedAgentId, 10),
        ]);
        const normalizedPolicy = normalizePolicy(policyRes.policy);
        setPolicy(normalizedPolicy);
        setGuidelineDraft(normalizedPolicy.purchase_guideline || "");
        setAgentHistory(historyRes.transactions);
      }

      setStatusMessage(`Transaction ${action}d.`);
    } catch (err) {
      handleAdminError(err, `Failed to ${action} transaction`);
    } finally {
      setBusyTransactionId("");
    }
  };

  const handleSaveGuideline = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !policy) return;
    setSavingGuideline(true);
    setErrorMessage("");
    setStatusMessage("Saving purchase guideline...");

    try {
      await upsertPolicyForAgent(token, {
        agent_id: policy.agent_id,
        daily_limit_cents: policy.daily_limit_cents,
        per_transaction_limit_cents: policy.per_transaction_limit_cents,
        allowed_vendors: policy.allowed_vendors,
        allowed_mccs: policy.allowed_mccs || [],
        allowed_weekdays_utc: policy.allowed_weekdays_utc || [],
        allowed_hours_utc: policy.allowed_hours_utc || [],
        require_approval_above_cents: policy.require_approval_above_cents,
        purchase_guideline: guidelineDraft.trim(),
      });

      const policyRes = await getPolicyForAgent(token, policy.agent_id);
      const normalizedPolicy = normalizePolicy(policyRes.policy);
      setPolicy(normalizedPolicy);
      setGuidelineDraft(normalizedPolicy.purchase_guideline || "");
      setStatusMessage("Purchase guideline saved.");
    } catch (err) {
      handleAdminError(err, "Failed to save purchase guideline");
    } finally {
      setSavingGuideline(false);
    }
  };

  const handleSpendSimulation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("Sending spend request...");
    setRunFlowPulse(true);

    const amountDollars = Number.parseFloat(spendAmount);
    if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
      setErrorMessage("Amount must be a positive dollar value.");
      setStatusMessage("");
      return;
    }
    const amountCents = Math.round(amountDollars * 100);

    try {
      const response = await simulateSpend(spendApiKey, {
        request_id: uidv4Like(),
        amount: amountCents,
        vendor: spendVendor.trim().toLowerCase(),
        meta: {
          source: "governor-next-console",
          initiated_at: new Date().toISOString(),
        },
        mcc: spendMcc.trim(),
      });
      setSpendResult(response);
      setStatusMessage(`Spend decision: ${response.status}.`);
      if (token) {
        try {
          await refreshTransactions(token);
        } catch (err) {
          handleAdminError(err, "Spend processed but dashboard refresh failed");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Spend simulation failed";
      setErrorMessage(message);
      setStatusMessage("");
    }
  };

  const handleAgentKillSwitch = async (action: "freeze" | "unfreeze") => {
    if (!token || !selectedAgentId) return;
    setBusyKillSwitch(true);
    setErrorMessage("");
    setStatusMessage(`${action === "freeze" ? "Freezing" : "Unfreezing"} agent...`);
    try {
      if (action === "freeze") {
        await freezeAgent(token, selectedAgentId);
      } else {
        await unfreezeAgent(token, selectedAgentId);
      }
      const [agentsRes, usersRes] = await Promise.all([listAgents(token, 30), listUsers(token, 20)]);
      setAgents(agentsRes.agents);
      setUsers(usersRes.users);
      await refreshTransactions(token);
      setStatusMessage(`Agent ${action}d.`);
    } catch (err) {
      handleAdminError(err, `Failed to ${action} agent`);
    } finally {
      setBusyKillSwitch(false);
    }
  };

  const handleOrgKillSwitch = async (action: "freeze" | "unfreeze") => {
    if (!token || !selectedAgent) return;
    setBusyKillSwitch(true);
    setErrorMessage("");
    setStatusMessage(`${action === "freeze" ? "Freezing" : "Unfreezing"} organization...`);
    try {
      if (action === "freeze") {
        await freezeUser(token, selectedAgent.user_id);
      } else {
        await unfreezeUser(token, selectedAgent.user_id);
      }
      const [agentsRes, usersRes] = await Promise.all([listAgents(token, 30), listUsers(token, 20)]);
      setAgents(agentsRes.agents);
      setUsers(usersRes.users);
      await refreshTransactions(token);
      setStatusMessage(`Organization ${action}d.`);
    } catch (err) {
      handleAdminError(err, `Failed to ${action} organization`);
    } finally {
      setBusyKillSwitch(false);
    }
  };

  if (!authReady || !token) {
    return (
      <div className="demo-page-shell">
        <div className="hero-grid" />
      </div>
    );
  }

  return (
    <div className="demo-page-shell">
      <div className="hero-grid" />
      <GovernorNav rightSlot={<Link className="demo-console-link" href="/sign-in">Admin sign-in</Link>} />

      <main className="demo-console-main container-wide">
        <section className="demo-console-hero">
          <div>
            <p className="demo-overline">Governor Console</p>
            <h1 className="serif-title">See how Governor evaluates agent spend in real time.</h1>
            <p>
              This is the live sandbox control panel used in demos. Run spend simulations, review flagged
              transactions, and inspect deterministic policy decisions.
            </p>
          </div>
          <div className="demo-console-preview surface-card">
            <p>Live Preview</p>
            <div><span>Pending approvals</span><strong>{pending.length}</strong></div>
            <div><span>Recent decisions</span><strong>{recentTransactions.length}</strong></div>
            <div><span>Focused agent</span><strong>{selectedAgent?.name || "Unselected"}</strong></div>
          </div>
        </section>

        <div className="demo-console-divider">
          <span>Sandbox environment for demo purposes.</span>
        </div>

        <section className={`demo-console-shell ${runFlowPulse ? "is-flowing" : ""}`}>
          <div className="demo-console-shell-head">
            <p>Governor console</p>
            <span>SANDBOX</span>
          </div>

          {needsReauth && (
            <section className="demo-console-card demo-reauth-card">
              <h2>Re-authentication Required</h2>
              <p>Your session expired. Sign in again to continue reviewing and updating policies.</p>
              <button type="button" className="btn-primary" onClick={logout}>Re-authenticate</button>
            </section>
          )}

          <div className={`demo-console-pulse ${runFlowPulse ? "is-active" : ""}`} aria-hidden />

          <div className="demo-console-grid">
            <section className="demo-console-card demo-ops-card">
              <div className="demo-card-head">
                <div>
                  <h2>Operations Snapshot</h2>
                  <p>High level view of agents and recent decisions. Signed in as {adminEmail || "admin"}.</p>
                </div>
                <button type="button" className="demo-btn-muted" onClick={logout}>Sign out</button>
              </div>

              <div className="demo-stats-grid">
                <article><span>Users</span><strong>{users.length}</strong></article>
                <article><span>Agents</span><strong>{agents.length}</strong></article>
                <article><span>Pending</span><strong>{pending.length}</strong></article>
                <article><span>Recent decisions</span><strong>{recentTransactions.length}</strong></article>
              </div>

              <label className="field-wrap">
                <span>Focus Agent</span>
                <select value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)}>
                  <option value="">Select agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.status})
                    </option>
                  ))}
                </select>
              </label>

              {selectedAgent && (
                <div className="demo-kill-row">
                  <button
                    type="button"
                    className="demo-btn-danger"
                    disabled={busyKillSwitch || needsReauth}
                    onClick={() => handleAgentKillSwitch("freeze")}
                  >
                    Freeze Agent
                  </button>
                  <button
                    type="button"
                    className="demo-btn-muted"
                    disabled={busyKillSwitch || needsReauth}
                    onClick={() => handleAgentKillSwitch("unfreeze")}
                  >
                    Unfreeze Agent
                  </button>
                  <button
                    type="button"
                    className="demo-btn-danger"
                    disabled={busyKillSwitch || needsReauth}
                    onClick={() => handleOrgKillSwitch("freeze")}
                  >
                    Freeze Org
                  </button>
                  <button
                    type="button"
                    className="demo-btn-muted"
                    disabled={busyKillSwitch || needsReauth}
                    onClick={() => handleOrgKillSwitch("unfreeze")}
                  >
                    Unfreeze Org
                  </button>
                </div>
              )}
            </section>

            <section className="demo-console-card demo-policy-card">
              <div className="demo-card-head">
                <div>
                  <h2>Live Policy Constraints</h2>
                  <p>The rules Governor enforces for the selected agent.</p>
                </div>
              </div>

              {policy ? (
                <>
                  <dl className="demo-policy-grid">
                    <div><dt>Daily limit</dt><dd>{centsToDollars(policy.daily_limit_cents)}</dd></div>
                    <div><dt>Per transaction</dt><dd>{centsToDollars(policy.per_transaction_limit_cents)}</dd></div>
                    <div><dt>Human approval over</dt><dd>{centsToDollars(policy.require_approval_above_cents)}</dd></div>
                    <div><dt>Allowed vendors</dt><dd>{policy.allowed_vendors.join(", ") || "None"}</dd></div>
                    <div><dt>Allowed MCCs</dt><dd>{(policy.allowed_mccs || []).join(", ") || "Any"}</dd></div>
                    <div><dt>Allowed weekdays</dt><dd>{(policy.allowed_weekdays_utc || []).join(", ") || "Any"}</dd></div>
                  </dl>

                  <form className="demo-form-stack" onSubmit={handleSaveGuideline}>
                    <label className="field-wrap">
                      <span>Purchase Guideline Prompt</span>
                      <textarea
                        rows={2}
                        value={guidelineDraft}
                        onChange={(event) => setGuidelineDraft(event.target.value)}
                        placeholder="Example: AI and engineering tooling subscriptions only"
                      />
                    </label>
                    <button type="submit" className="btn-primary" disabled={savingGuideline || needsReauth}>
                      {savingGuideline ? "Saving..." : "Save Guideline"}
                    </button>
                  </form>
                </>
              ) : (
                <p className="demo-empty-copy">Select an agent to load policy constraints.</p>
              )}
            </section>

            <section className="demo-console-card demo-sim-card">
              <div className="demo-card-head">
                <div>
                  <h2>Spend Simulation</h2>
                  <p>Emulate an agent checkout attempt without exposing secrets.</p>
                </div>
              </div>

              <form className="demo-form-stack" onSubmit={handleSpendSimulation}>
                <label className="field-wrap">
                  <span>Agent API Key</span>
                  <input value={spendApiKey} onChange={(event) => setSpendApiKey(event.target.value)} required />
                </label>
                <label className="field-wrap">
                  <span>Vendor Domain</span>
                  <input value={spendVendor} onChange={(event) => setSpendVendor(event.target.value)} required />
                </label>
                <label className="field-wrap">
                  <span>MCC (optional)</span>
                  <input value={spendMcc} onChange={(event) => setSpendMcc(event.target.value)} />
                </label>
                <label className="field-wrap">
                  <span>Amount (USD)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={spendAmount}
                    onChange={(event) => setSpendAmount(event.target.value)}
                    required
                  />
                </label>
                <button type="submit" className="btn-primary">Run Purchase Decision</button>
              </form>

              {spendResult && (
                <div className="demo-decision-card">
                  <h3>Decision Outcome</h3>
                  <p className={statusClass(spendResult.status)}>{spendResult.status}</p>
                  <p><strong>Reason:</strong> {spendResult.reason}</p>
                  {spendResult.provider_status && <p><strong>Provider:</strong> {spendResult.provider_status}</p>}
                  {spendResult.checkout_url && (
                    <p>
                      <strong>Checkout:</strong>{" "}
                      <a href={spendResult.checkout_url} target="_blank" rel="noreferrer">Open Stripe Checkout</a>
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="demo-console-card demo-pending-card">
              <div className="demo-card-head">
                <div>
                  <h2>Pending Human Review</h2>
                  <p>Transactions above threshold stay queued until approved or denied.</p>
                </div>
              </div>

              <div className="demo-table-wrap">
                <table className="demo-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Amount</th>
                      <th>Reason</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.length === 0 && (
                      <tr>
                        <td colSpan={4} className="demo-empty-row">No pending approvals.</td>
                      </tr>
                    )}
                    {pending.map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          <button
                            type="button"
                            className="demo-link-button"
                            onClick={() => setSelectedAgentId(tx.agent_id)}
                          >
                            {tx.vendor}
                          </button>
                        </td>
                        <td>{centsToDollars(tx.amount_cents)}</td>
                        <td>{tx.reason}</td>
                        <td className="demo-action-cell">
                          <button
                            type="button"
                            className="demo-btn-success"
                            disabled={busyTransactionId === tx.id || needsReauth}
                            onClick={() => handleReviewAction(tx.id, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="demo-btn-danger"
                            disabled={busyTransactionId === tx.id || needsReauth}
                            onClick={() => handleReviewAction(tx.id, "deny")}
                          >
                            Deny
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="demo-console-card demo-history-card">
              <div className="demo-card-head">
                <div>
                  <h2>Selected Agent History (Last 10)</h2>
                  <p>Use this context before deciding flagged payments.</p>
                </div>
              </div>

              <ul className="demo-history-list">
                {agentHistory.length === 0 && <li className="demo-empty-row">Select an agent to view history.</li>}
                {agentHistory.map((tx) => (
                  <li key={tx.id}>
                    <span>{new Date(tx.created_at).toLocaleString()}</span>
                    <span>{tx.vendor}</span>
                    <span>{centsToDollars(tx.amount_cents)}</span>
                    <span className={statusClass(tx.status)}>{tx.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <footer className="demo-console-status">
            {loadingDashboard && <span>Loading dashboard...</span>}
            {!loadingDashboard && statusMessage && <span>{statusMessage}</span>}
            {!loadingDashboard && !statusMessage && !errorMessage && (
              <span>Console ready for sandbox transactions.</span>
            )}
            {errorMessage && <span className="demo-error">{errorMessage}</span>}
          </footer>
        </section>
      </main>
    </div>
  );
}
