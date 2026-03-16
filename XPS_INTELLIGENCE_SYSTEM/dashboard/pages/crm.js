// dashboard/pages/crm.js
// ========================
// XPS Intelligence — Enterprise CRM Dashboard
// Pipeline stages, contact management, outreach tracking, follow-up system

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const API =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099"
    : "http://localhost:3099";

const STAGES = [
  { id: "new", label: "New", color: "#6366f1", icon: "🆕" },
  { id: "contacted", label: "Contacted", color: "#3b82f6", icon: "📞" },
  { id: "interested", label: "Interested", color: "#f59e0b", icon: "⭐" },
  { id: "proposal_sent", label: "Proposal Sent", color: "#8b5cf6", icon: "📋" },
  { id: "negotiating", label: "Negotiating", color: "#f97316", icon: "🤝" },
  { id: "closed_won", label: "Closed Won", color: "#4ade80", icon: "🏆" },
  { id: "closed_lost", label: "Closed Lost", color: "#ef4444", icon: "❌" },
  { id: "nurture", label: "Nurture", color: "#06b6d4", icon: "🌱" },
];

const TIER_COLORS = { HOT: "#ef4444", WARM: "#f97316", COLD: "#3b82f6" };

export default function CRMPage() {
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState("all");
  const [activeTier, setActiveTier] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [outreachChannel, setOutreachChannel] = useState("email");
  const [bulkStage, setBulkStage] = useState("contacted");
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [msg, setMsg] = useState(null);
  const [activeTab, setActiveTab] = useState("pipeline");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const showMsg = (text, type = "ok") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  };

  const loadContacts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, per_page: 50 });
    if (activeStage !== "all") params.set("stage", activeStage);
    if (activeTier !== "all") params.set("tier", activeTier);
    if (search) params.set("search", search);
    try {
      const [cr, sr] = await Promise.all([
        fetch(`${API}/api/v1/crm/?${params}`).then((r) => r.json()),
        fetch(`${API}/api/v1/crm/stats`).then((r) => r.json()),
      ]);
      setContacts(cr.contacts || []);
      setTotalPages(cr.pages || 1);
      setStats(sr);
    } catch (e) {
      // Fall back to static scored_leads data when API is unavailable
      try {
        const staticBase =
          typeof window !== "undefined"
            ? process.env.NEXT_PUBLIC_BASE_PATH || ""
            : "";
        const res = await fetch(`${staticBase}/data/scored_leads.json`);
        if (res.ok) {
          let leads = await res.json();
          // Apply client-side filters
          if (activeStage !== "all")
            leads = leads.filter((l) => (l.status || "new") === activeStage);
          if (activeTier !== "all")
            leads = leads.filter(
              (l) => (l.tier || "").toUpperCase() === activeTier.toUpperCase(),
            );
          if (search) {
            const q = search.toLowerCase();
            leads = leads.filter(
              (l) =>
                (l.company || l.company_name || "").toLowerCase().includes(q) ||
                (l.city || "").toLowerCase().includes(q),
            );
          }
          const pageLeads = leads.slice((page - 1) * 50, page * 50);
          setContacts(
            pageLeads.map((l) => ({
              id: l.id,
              company_name: l.company || l.company_name || "",
              phone: l.phone || "",
              email: l.email || "",
              city: l.city || "",
              state: l.state || "",
              lead_score: l.lead_score ?? l.score ?? 0,
              tier: l.tier || "COLD",
              stage: l.status || "new",
              industry: l.industry || "",
              website: l.website || "",
              notes: [],
              outreach_log: [],
            })),
          );
          setTotalPages(Math.max(1, Math.ceil(leads.length / 50)));
          const tierCounts = leads.reduce((acc, l) => {
            const t = (l.tier || "COLD").toUpperCase();
            acc[t] = (acc[t] || 0) + 1;
            return acc;
          }, {});
          setStats({ total: leads.length, by_tier: tierCounts });
        }
      } catch {
        // ignore
      }
    }
    setLoading(false);
  }, [activeStage, activeTier, search, page]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const updateContact = async (id, update) => {
    await fetch(`${API}/api/v1/crm/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    if (selected?.id === id) {
      const r = await fetch(`${API}/api/v1/crm/${id}`).then((x) => x.json());
      setSelected(r);
    }
    await loadContacts();
    showMsg("✅ Contact updated");
  };

  const addNote = async () => {
    if (!noteText.trim() || !selected) return;
    await fetch(`${API}/api/v1/crm/${selected.id}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: noteText, author: "user" }),
    });
    setNoteText("");
    const r = await fetch(`${API}/api/v1/crm/${selected.id}`).then((x) =>
      x.json(),
    );
    setSelected(r);
    showMsg("✅ Note added");
  };

  const logOutreach = async (contactId) => {
    await fetch(`${API}/api/v1/crm/${contactId}/outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: outreachChannel, outcome: "sent" }),
    });
    await loadContacts();
    showMsg(`✅ ${outreachChannel} outreach logged`);
  };

  const bulkUpdate = async () => {
    if (checkedIds.size === 0) return showMsg("Select contacts first", "err");
    await fetch(`${API}/api/v1/crm/bulk/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_ids: [...checkedIds], stage: bulkStage }),
    });
    setCheckedIds(new Set());
    await loadContacts();
    showMsg(`✅ ${checkedIds.size} contacts moved to ${bulkStage}`);
  };

  const exportCSV = () => {
    window.open(`${API}/api/v1/crm/export/csv`, "_blank");
  };

  const toggleCheck = (id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const stageStats = STAGES.map((s) => ({
    ...s,
    count: stats?.stages?.[s.id] || 0,
  }));

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.logo}>⚡ XPS CRM</span>
          <div style={S.tabs}>
            {["pipeline", "contacts", "outreach"].map((t) => (
              <button
                key={t}
                style={{ ...S.tab, ...(activeTab === t ? S.tabActive : {}) }}
                onClick={() => setActiveTab(t)}
              >
                {t === "pipeline"
                  ? "📊 Pipeline"
                  : t === "contacts"
                    ? "👥 Contacts"
                    : "📬 Outreach"}
              </button>
            ))}
          </div>
        </div>
        <div style={S.headerRight}>
          <Link href="/connectors" style={S.navLink}>
            Connectors
          </Link>
          <Link href="/settings" style={S.navLink}>
            Settings
          </Link>
          <Link href="/" style={S.navLink}>
            Home
          </Link>
          <button style={S.exportBtn} onClick={exportCSV}>
            ⬇️ Export CSV
          </button>
        </div>
      </div>

      {msg && (
        <div
          style={{
            ...S.alert,
            background: msg.type === "ok" ? "#052e16" : "#3b0d0c",
          }}
        >
          {msg.text}
        </div>
      )}

      {/* ── PIPELINE VIEW ── */}
      {activeTab === "pipeline" && (
        <div style={S.content}>
          {/* Stats */}
          <div style={S.statsRow}>
            {[
              { label: "Total", value: stats?.total || 0, color: "#FFD700" },
              {
                label: "🔥 HOT",
                value: stats?.tiers?.HOT || 0,
                color: "#ef4444",
              },
              {
                label: "🌡️ WARM",
                value: stats?.tiers?.WARM || 0,
                color: "#f97316",
              },
              {
                label: "❄️ COLD",
                value: stats?.tiers?.COLD || 0,
                color: "#3b82f6",
              },
              {
                label: "Pending Outreach",
                value: stats?.pending_outreach || 0,
                color: "#f59e0b",
              },
              {
                label: "Follow-ups Due",
                value: stats?.follow_ups_due || 0,
                color: "#8b5cf6",
              },
            ].map((s) => (
              <div key={s.label} style={S.statCard}>
                <div style={{ ...S.statVal, color: s.color }}>{s.value}</div>
                <div style={S.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Kanban Pipeline */}
          <div style={S.kanban}>
            {stageStats.map((stage) => (
              <div key={stage.id} style={S.kanbanCol}>
                <div style={{ ...S.kanbanHeader, borderColor: stage.color }}>
                  <span>
                    {stage.icon} {stage.label}
                  </span>
                  <span style={{ ...S.kanbanCount, background: stage.color }}>
                    {stage.count}
                  </span>
                </div>
                <div style={S.kanbanCards}>
                  {contacts
                    .filter((c) => c.crm_stage === stage.id)
                    .slice(0, 6)
                    .map((c) => (
                      <div
                        key={c.id}
                        style={S.kanbanCard}
                        onClick={() => setSelected(c)}
                      >
                        <div style={S.kanbanName}>{c.company_name}</div>
                        <div style={S.kanbanMeta}>
                          {c.city}, {c.state}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.25rem",
                            marginTop: "0.3rem",
                          }}
                        >
                          <span
                            style={{
                              ...S.tierBadge,
                              background: TIER_COLORS[c.tier] || "#333",
                            }}
                          >
                            {c.tier}
                          </span>
                          <span style={S.scoreBadge}>{c.lead_score}</span>
                        </div>
                      </div>
                    ))}
                  {contacts.filter((c) => c.crm_stage === stage.id).length >
                    6 && (
                    <div style={S.moreCard}>
                      +
                      {contacts.filter((c) => c.crm_stage === stage.id).length -
                        6}{" "}
                      more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CONTACTS VIEW ── */}
      {activeTab === "contacts" && (
        <div style={S.content}>
          {/* Filters */}
          <div style={S.filterBar}>
            <input
              style={S.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, phone, email…"
            />
            <select
              style={S.select}
              value={activeStage}
              onChange={(e) => setActiveStage(e.target.value)}
            >
              <option value="all">All Stages</option>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              style={S.select}
              value={activeTier}
              onChange={(e) => setActiveTier(e.target.value)}
            >
              <option value="all">All Tiers</option>
              <option value="HOT">🔥 HOT</option>
              <option value="WARM">🌡️ WARM</option>
              <option value="COLD">❄️ COLD</option>
            </select>
            <button style={S.filterBtn} onClick={loadContacts}>
              🔍 Search
            </button>
          </div>

          {/* Bulk Actions */}
          {checkedIds.size > 0 && (
            <div style={S.bulkBar}>
              <span style={{ color: "#FFD700" }}>
                {checkedIds.size} selected
              </span>
              <select
                style={S.select}
                value={bulkStage}
                onChange={(e) => setBulkStage(e.target.value)}
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button style={S.bulkBtn} onClick={bulkUpdate}>
                Move to Stage
              </button>
              <button
                style={{ ...S.bulkBtn, background: "#333" }}
                onClick={() => setCheckedIds(new Set())}
              >
                Clear
              </button>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div style={S.loading}>Loading contacts…</div>
          ) : (
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>
                      <input
                        type="checkbox"
                        onChange={(e) =>
                          setCheckedIds(
                            e.target.checked
                              ? new Set(contacts.map((c) => c.id))
                              : new Set(),
                          )
                        }
                      />
                    </th>
                    <th style={S.th}>Company</th>
                    <th style={S.th}>Phone</th>
                    <th style={S.th}>Email</th>
                    <th style={S.th}>Location</th>
                    <th style={S.th}>Rating</th>
                    <th style={S.th}>Tier</th>
                    <th style={S.th}>Score</th>
                    <th style={S.th}>Stage</th>
                    <th style={S.th}>Priority</th>
                    <th style={S.th}>Outreach</th>
                    <th style={S.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id} style={S.tr}>
                      <td style={S.td}>
                        <input
                          type="checkbox"
                          checked={checkedIds.has(c.id)}
                          onChange={() => toggleCheck(c.id)}
                        />
                      </td>
                      <td
                        style={{ ...S.td, cursor: "pointer", color: "#FFD700" }}
                        onClick={() => setSelected(c)}
                      >
                        <strong>{c.company_name}</strong>
                      </td>
                      <td style={S.td}>{c.phone || "—"}</td>
                      <td style={S.td}>{c.email || "—"}</td>
                      <td style={S.td}>
                        {c.city}, {c.state}
                      </td>
                      <td style={S.td}>
                        {c.rating || "—"} ⭐ ({c.reviews || 0})
                      </td>
                      <td style={S.td}>
                        <span
                          style={{
                            ...S.tierBadge,
                            background: TIER_COLORS[c.tier] || "#333",
                          }}
                        >
                          {c.tier}
                        </span>
                      </td>
                      <td
                        style={{ ...S.td, color: "#FFD700", fontWeight: 700 }}
                      >
                        {c.lead_score}
                      </td>
                      <td style={S.td}>
                        <select
                          style={S.inlineSelect}
                          value={c.crm_stage || "new"}
                          onChange={(e) =>
                            updateContact(c.id, { crm_stage: e.target.value })
                          }
                        >
                          {STAGES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td
                        style={{
                          ...S.td,
                          color:
                            c.outreach_priority === "high"
                              ? "#ef4444"
                              : c.outreach_priority === "medium"
                                ? "#f97316"
                                : "#888",
                        }}
                      >
                        {c.outreach_priority || "—"}
                      </td>
                      <td style={S.td}>
                        <span
                          style={{
                            color:
                              c.outreach_status === "pending"
                                ? "#f59e0b"
                                : c.outreach_status === "contacted"
                                  ? "#4ade80"
                                  : "#888",
                          }}
                        >
                          {c.outreach_status || "pending"}
                        </span>
                      </td>
                      <td style={S.td}>
                        <button
                          style={S.actionBtn}
                          onClick={() => {
                            setSelected(c);
                            setActiveTab("outreach");
                          }}
                        >
                          📬
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div style={S.pagination}>
            <button
              style={S.pageBtn}
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </button>
            <span style={{ color: "#666" }}>
              Page {page} / {totalPages}
            </span>
            <button
              style={S.pageBtn}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── OUTREACH VIEW ── */}
      {activeTab === "outreach" && (
        <div style={S.outreachLayout}>
          <div style={S.contactList}>
            <div style={S.listTitle}>Contacts ({contacts.length})</div>
            {contacts.map((c) => (
              <div
                key={c.id}
                style={{
                  ...S.listItem,
                  ...(selected?.id === c.id ? S.listItemActive : {}),
                }}
                onClick={() => setSelected(c)}
              >
                <div style={S.listName}>{c.company_name}</div>
                <div style={S.listMeta}>
                  {c.city} ·{" "}
                  <span style={{ color: TIER_COLORS[c.tier] || "#888" }}>
                    {c.tier}
                  </span>{" "}
                  · {c.lead_score}
                </div>
                <div
                  style={{
                    color:
                      c.outreach_status === "pending" ? "#f59e0b" : "#4ade80",
                    fontSize: "0.7rem",
                  }}
                >
                  {c.outreach_status || "pending"}
                </div>
              </div>
            ))}
          </div>

          {selected ? (
            <div style={S.detailPanel}>
              <div style={S.detailHeader}>
                <div>
                  <div style={S.detailName}>{selected.company_name}</div>
                  <div style={S.detailMeta}>
                    {selected.city}, {selected.state} &nbsp;|&nbsp;
                    <span
                      style={{ color: TIER_COLORS[selected.tier] || "#888" }}
                    >
                      {selected.tier}
                    </span>{" "}
                    &nbsp;|&nbsp; Score:{" "}
                    <strong style={{ color: "#FFD700" }}>
                      {selected.lead_score}
                    </strong>
                  </div>
                </div>
                <select
                  style={S.select}
                  value={selected.crm_stage || "new"}
                  onChange={(e) =>
                    updateContact(selected.id, { crm_stage: e.target.value })
                  }
                >
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact Details */}
              <div style={S.contactGrid}>
                {[
                  ["📞 Phone", selected.phone],
                  ["📧 Email", selected.email],
                  ["🌐 Website", selected.website],
                  ["📍 Address", selected.address],
                  ["🏭 Industry", selected.industry],
                  ["👥 Size", selected.estimated_size],
                  ["📅 Est. Years", selected.estimated_years_in_business],
                  ["👤 Owner Research", selected.owner_research?.status],
                ].map(([label, val]) => (
                  <div key={label} style={S.infoRow}>
                    <span style={S.infoLabel}>{label}</span>
                    <span style={S.infoVal}>{val || "—"}</span>
                  </div>
                ))}
              </div>

              {/* Outreach Actions */}
              <div style={S.section}>
                <div style={S.sectionTitle}>📬 Log Outreach</div>
                <div style={S.outreachBtns}>
                  {[
                    "email",
                    "email_campaign",
                    "sms",
                    "voice_call",
                    "follow_up",
                  ].map((ch) => (
                    <button
                      key={ch}
                      style={{
                        ...S.chBtn,
                        ...(outreachChannel === ch ? S.chBtnActive : {}),
                      }}
                      onClick={() => setOutreachChannel(ch)}
                    >
                      {ch === "email"
                        ? "✉️ Email"
                        : ch === "email_campaign"
                          ? "📣 Campaign"
                          : ch === "sms"
                            ? "💬 SMS"
                            : ch === "voice_call"
                              ? "📞 Voice"
                              : "🔄 Follow-up"}
                    </button>
                  ))}
                </div>
                <button
                  style={S.logBtn}
                  onClick={() => logOutreach(selected.id)}
                >
                  ▶ Log {outreachChannel} Outreach
                </button>
              </div>

              {/* Notes */}
              <div style={S.section}>
                <div style={S.sectionTitle}>
                  📝 Notes ({(selected.notes || []).length})
                </div>
                <div style={S.notesList}>
                  {(selected.notes || []).map((n, i) => (
                    <div key={i} style={S.noteItem}>
                      <div style={S.noteText}>{n.text}</div>
                      <div style={S.noteMeta}>
                        {n.author} · {n.created_at?.slice(0, 10)}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={S.noteForm}>
                  <input
                    style={S.noteInput}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note…"
                    onKeyDown={(e) => e.key === "Enter" && addNote()}
                  />
                  <button style={S.addNoteBtn} onClick={addNote}>
                    Add
                  </button>
                </div>
              </div>

              {/* Activity Log */}
              {(selected.activity_log || []).length > 0 && (
                <div style={S.section}>
                  <div style={S.sectionTitle}>📋 Activity Log</div>
                  {(selected.activity_log || [])
                    .slice(-5)
                    .reverse()
                    .map((a, i) => (
                      <div key={i} style={S.activityItem}>
                        <span style={S.activityIcon}>
                          {a.channel === "email"
                            ? "✉️"
                            : a.channel === "sms"
                              ? "💬"
                              : "📞"}
                        </span>
                        <span style={S.activityText}>
                          {a.channel} — {a.outcome || "sent"}
                        </span>
                        <span style={S.activityTime}>
                          {a.timestamp?.slice(0, 10)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div style={S.noSelection}>
              Select a contact to view outreach options
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const S = {
  page: {
    background: "#000",
    minHeight: "100vh",
    color: "#fff",
    fontFamily: "'Segoe UI',system-ui,sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    background: "#0a0a0a",
    borderBottom: "1px solid #1a1a1a",
    padding: "0.6rem 1.5rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "1.5rem" },
  logo: { color: "#FFD700", fontWeight: 800 },
  tabs: { display: "flex", gap: "0.25rem" },
  tab: {
    background: "transparent",
    border: "none",
    color: "#666",
    padding: "0.4rem 0.8rem",
    cursor: "pointer",
    borderRadius: "6px",
    fontSize: "0.85rem",
  },
  tabActive: { background: "#1a1a1a", color: "#FFD700" },
  headerRight: { display: "flex", gap: "1rem", alignItems: "center" },
  navLink: { color: "#666", textDecoration: "none", fontSize: "0.8rem" },
  exportBtn: {
    background: "#FFD700",
    color: "#000",
    border: "none",
    padding: "0.4rem 0.9rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.8rem",
  },
  alert: { padding: "0.6rem 1.5rem", fontSize: "0.875rem", color: "#fff" },
  content: { flex: 1, padding: "1.25rem 1.5rem", overflow: "auto" },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
    gap: "0.75rem",
    marginBottom: "1.5rem",
  },
  statCard: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
    padding: "0.75rem",
    textAlign: "center",
  },
  statVal: { fontSize: "1.75rem", fontWeight: 800, color: "#FFD700" },
  statLabel: {
    color: "#666",
    fontSize: "0.7rem",
    marginTop: "0.2rem",
    textTransform: "uppercase",
  },
  kanban: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
    gap: "0.75rem",
    overflow: "auto",
  },
  kanbanCol: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
    minHeight: "200px",
    overflow: "hidden",
  },
  kanbanHeader: {
    padding: "0.5rem 0.75rem",
    borderBottom: "2px solid",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  kanbanCount: {
    fontSize: "0.7rem",
    color: "#000",
    padding: "0.1rem 0.4rem",
    borderRadius: "10px",
    fontWeight: 800,
  },
  kanbanCards: {
    padding: "0.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  kanbanCard: {
    background: "#111",
    border: "1px solid #222",
    borderRadius: "6px",
    padding: "0.5rem",
    cursor: "pointer",
  },
  kanbanName: {
    color: "#fff",
    fontSize: "0.75rem",
    fontWeight: 600,
    marginBottom: "0.15rem",
  },
  kanbanMeta: { color: "#666", fontSize: "0.7rem" },
  moreCard: {
    color: "#555",
    fontSize: "0.75rem",
    textAlign: "center",
    padding: "0.25rem",
  },
  tierBadge: {
    color: "#fff",
    padding: "0.1rem 0.4rem",
    borderRadius: "8px",
    fontSize: "0.65rem",
    fontWeight: 700,
  },
  scoreBadge: {
    background: "#111",
    color: "#FFD700",
    padding: "0.1rem 0.4rem",
    borderRadius: "8px",
    fontSize: "0.65rem",
    fontWeight: 700,
  },
  filterBar: {
    display: "flex",
    gap: "0.75rem",
    marginBottom: "0.75rem",
    flexWrap: "wrap",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    background: "#111",
    border: "1px solid #222",
    color: "#fff",
    padding: "0.4rem 0.75rem",
    borderRadius: "6px",
    minWidth: "200px",
  },
  select: {
    background: "#111",
    border: "1px solid #222",
    color: "#fff",
    padding: "0.4rem 0.5rem",
    borderRadius: "6px",
    fontSize: "0.85rem",
  },
  filterBtn: {
    background: "#1a1a1a",
    border: "1px solid #333",
    color: "#aaa",
    padding: "0.4rem 0.9rem",
    borderRadius: "6px",
    cursor: "pointer",
  },
  bulkBar: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
    background: "#111",
    padding: "0.5rem 0.75rem",
    borderRadius: "6px",
    marginBottom: "0.75rem",
  },
  bulkBtn: {
    background: "#FFD700",
    color: "#000",
    border: "none",
    padding: "0.3rem 0.75rem",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.8rem",
  },
  loading: { color: "#555", padding: "2rem", textAlign: "center" },
  tableWrap: { overflow: "auto" },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.8rem",
    minWidth: "900px",
  },
  th: {
    background: "#0a0a0a",
    color: "#555",
    padding: "0.5rem",
    textAlign: "left",
    borderBottom: "1px solid #1a1a1a",
    whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid #111" },
  td: { padding: "0.45rem 0.5rem", color: "#ccc", verticalAlign: "top" },
  inlineSelect: {
    background: "#111",
    border: "1px solid #1a1a1a",
    color: "#aaa",
    padding: "0.2rem 0.3rem",
    borderRadius: "4px",
    fontSize: "0.75rem",
  },
  actionBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
  },
  pagination: {
    display: "flex",
    gap: "1rem",
    alignItems: "center",
    marginTop: "1rem",
    justifyContent: "center",
  },
  pageBtn: {
    background: "#1a1a1a",
    border: "1px solid #222",
    color: "#aaa",
    padding: "0.35rem 0.75rem",
    borderRadius: "5px",
    cursor: "pointer",
  },
  outreachLayout: {
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    flex: 1,
    overflow: "hidden",
  },
  contactList: {
    borderRight: "1px solid #1a1a1a",
    overflow: "auto",
    padding: "0.75rem 0",
  },
  listTitle: {
    color: "#555",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    padding: "0 0.75rem 0.5rem",
  },
  listItem: {
    padding: "0.65rem 0.75rem",
    cursor: "pointer",
    borderBottom: "1px solid #0d0d0d",
  },
  listItemActive: { background: "#111", borderLeft: "2px solid #FFD700" },
  listName: { color: "#fff", fontSize: "0.85rem", fontWeight: 600 },
  listMeta: { color: "#666", fontSize: "0.75rem", marginTop: "0.1rem" },
  detailPanel: { padding: "1.25rem", overflow: "auto" },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1.25rem",
  },
  detailName: { color: "#FFD700", fontWeight: 800, fontSize: "1.25rem" },
  detailMeta: { color: "#888", marginTop: "0.25rem" },
  contactGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.5rem",
    marginBottom: "1.25rem",
  },
  infoRow: {
    background: "#0a0a0a",
    border: "1px solid #111",
    borderRadius: "6px",
    padding: "0.5rem 0.75rem",
  },
  infoLabel: { color: "#555", fontSize: "0.75rem", display: "block" },
  infoVal: { color: "#ccc", fontSize: "0.85rem" },
  section: { marginBottom: "1.25rem" },
  sectionTitle: {
    color: "#555",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "0.6rem",
  },
  outreachBtns: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
    marginBottom: "0.75rem",
  },
  chBtn: {
    background: "#111",
    border: "1px solid #222",
    color: "#888",
    padding: "0.3rem 0.7rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  chBtnActive: {
    background: "#1a1a5c",
    border: "1px solid #6366f1",
    color: "#fff",
  },
  logBtn: {
    background: "#FFD700",
    color: "#000",
    border: "none",
    padding: "0.5rem 1.25rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 700,
  },
  notesList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    marginBottom: "0.75rem",
    maxHeight: "200px",
    overflow: "auto",
  },
  noteItem: {
    background: "#0a0a0a",
    border: "1px solid #111",
    borderRadius: "6px",
    padding: "0.5rem 0.75rem",
  },
  noteText: { color: "#ccc", fontSize: "0.85rem" },
  noteMeta: { color: "#555", fontSize: "0.7rem", marginTop: "0.2rem" },
  noteForm: { display: "flex", gap: "0.5rem" },
  noteInput: {
    flex: 1,
    background: "#111",
    border: "1px solid #222",
    color: "#fff",
    padding: "0.4rem 0.75rem",
    borderRadius: "6px",
    fontSize: "0.85rem",
  },
  addNoteBtn: {
    background: "#1a1a1a",
    border: "1px solid #333",
    color: "#aaa",
    padding: "0.4rem 0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
  },
  activityItem: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
    padding: "0.35rem 0",
    borderBottom: "1px solid #111",
  },
  activityIcon: { fontSize: "0.9rem" },
  activityText: { flex: 1, color: "#888", fontSize: "0.8rem" },
  activityTime: { color: "#444", fontSize: "0.75rem" },
  noSelection: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#333",
    fontSize: "1rem",
  },
};
