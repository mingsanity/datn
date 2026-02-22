// src/pages/AdminPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, buildQuery } from "../api";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Shield,
  Search,
  User,
  Mail,
  Phone,
  Globe,
  StickyNote,
  ChevronLeft,
  BookOpen,
} from "lucide-react";

const PIE_COLORS = ["#22c55e", "#ef4444"]; // green known, red unknown

function UserRow({ u, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition ${
        active
          ? "border-blue-400 bg-blue-50"
          : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <div className="font-semibold text-gray-900">{u.fullName || "(No name)"}</div>
      <div className="text-sm text-gray-600">{u.email}</div>
      <div className="text-xs text-gray-500 mt-1">Role: {u.role || "USER"}</div>
    </button>
  );
}

function InfoLine({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-gray-500">{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-medium text-gray-900">{value || "-"}</div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow border border-blue-100 p-4 md:p-6">
      <div className="font-semibold text-gray-900 mb-3">{title}</div>
      <div className="h-64 md:h-72">{children}</div>
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <div className="text-indigo-600">{icon}</div>
        <div>
          <div className="text-lg font-bold text-gray-900">{title}</div>
          {subtitle ? <div className="text-sm text-gray-600">{subtitle}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [detail, setDetail] = useState(null);

  // ✅ vocab summary (existing)
  const [summary, setSummary] = useState(null);

  // ✅ grammar summary (new)
  const [grammarSummary, setGrammarSummary] = useState(null);

  const [err, setErr] = useState("");

  const selectedUser = useMemo(
    () => users.find((x) => String(x.id) === String(selectedId)) || null,
    [users, selectedId]
  );

  // ---------- Vocabulary charts ----------
  const knownPie = useMemo(() => {
    const total = summary?.totalWords ?? 0;
    const known = summary?.knownCount ?? 0;
    const unknown = Math.max(0, total - known);
    return [
      { name: "Known", value: known },
      { name: "Unknown", value: unknown },
    ];
  }, [summary]);

  const cefrBars = useMemo(() => {
    const arr = Array.isArray(summary?.byCefr) ? summary.byCefr : [];
    return arr.map((x) => ({
      level: x.key,
      known: x.known ?? 0,
      unknown: Math.max(0, (x.total ?? 0) - (x.known ?? 0)),
    }));
  }, [summary]);

  // ---------- Grammar charts ----------
  const grammarKnownPie = useMemo(() => {
    const total = grammarSummary?.totalGrammar ?? 0;
    const known = grammarSummary?.knownCount ?? 0;
    const unknown = Math.max(0, total - known);
    return [
      { name: "Known", value: known },
      { name: "Unknown", value: unknown },
    ];
  }, [grammarSummary]);

  const grammarLevelBars = useMemo(() => {
    const arr = Array.isArray(grammarSummary?.byLevel) ? grammarSummary.byLevel : [];
    return arr.map((x) => ({
      level: x.key,
      known: x.known ?? 0,
      unknown: Math.max(0, (x.total ?? 0) - (x.known ?? 0)),
    }));
  }, [grammarSummary]);

  // Load users list
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingUsers(true);
      setErr("");
      try {
        const data = await apiFetch(`/api/admin/users${buildQuery({ q })}`);
        if (!mounted) return;
        setUsers(Array.isArray(data) ? data : []);
        if (!selectedId && Array.isArray(data) && data.length) {
          setSelectedId(data[0].id);
        }
      } catch (e) {
        if (!mounted) return;
        setErr(e?.message || "Failed to load users");
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load selected user detail + vocab summary + grammar summary
  useEffect(() => {
    if (!selectedId) return;
    let mounted = true;

    (async () => {
      setErr("");
      try {
        const [d, s, gs] = await Promise.all([
          apiFetch(`/api/admin/users/${selectedId}`),
          apiFetch(`/api/admin/users/${selectedId}/summary`), // vocab summary (existing)
          apiFetch(`/api/admin/users/${selectedId}/grammar-summary`), // ✅ new
        ]);
        if (!mounted) return;
        setDetail(d);
        setSummary(s);
        setGrammarSummary(gs);
      } catch (e) {
        if (!mounted) return;
        setErr(e?.message || "Failed to load user detail/summary");
        setDetail(null);
        setSummary(null);
        setGrammarSummary(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="bg-white/80 backdrop-blur shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center text-gray-500 hover:text-indigo-600 font-medium transition-colors"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              <span className="hidden sm:inline">Trang chủ</span>
            </button>

            <div className="h-6 w-px bg-gray-200" />

            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-600" />
              <div className="text-xl font-bold text-gray-900">Admin Dashboard</div>
            </div>
          </div>

          <div className="relative w-80 max-w-full hidden md:block">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search users by email..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 focus:border-indigo-400 outline-none bg-white"
            />
          </div>
        </div>

        {/* Mobile search */}
        <div className="md:hidden px-4 pb-3">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 focus:border-indigo-400 outline-none bg-white"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {err && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
            {err}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: user list */}
          <div className="bg-white rounded-2xl shadow border border-blue-100 p-4">
            <div className="font-semibold text-gray-900 mb-3">
              Users {loadingUsers ? "(loading...)" : `(${users.length})`}
            </div>

            <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  u={u}
                  active={String(u.id) === String(selectedId)}
                  onClick={() => setSelectedId(u.id)}
                />
              ))}
              {!loadingUsers && users.length === 0 && (
                <div className="text-gray-500 text-sm">No users found.</div>
              )}
            </div>
          </div>

          {/* RIGHT: user detail + charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* User detail */}
            <div className="bg-white rounded-2xl shadow border border-blue-100 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    {detail?.fullName || selectedUser?.fullName || "User"}
                  </div>
                  <div className="text-sm text-gray-600">
                    Role:{" "}
                    <span className="font-semibold">
                      {detail?.role || selectedUser?.role || "USER"}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  User ID: <span className="font-semibold">{selectedId || "-"}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <InfoLine icon={<Mail className="w-4 h-4" />} label="Email" value={detail?.email} />
                <InfoLine icon={<User className="w-4 h-4" />} label="Full name" value={detail?.fullName} />
                <InfoLine icon={<Phone className="w-4 h-4" />} label="Phone" value={detail?.phone} />
                <InfoLine icon={<Globe className="w-4 h-4" />} label="Country" value={detail?.country} />
                <div className="md:col-span-2">
                  <InfoLine icon={<StickyNote className="w-4 h-4" />} label="Bio" value={detail?.bio} />
                </div>
              </div>
            </div>

            {/* Vocabulary charts */}
            <div className="bg-white rounded-2xl shadow border border-blue-100 p-4 md:p-6">
              <SectionTitle
                icon={<BookOpen className="w-5 h-5" />}
                title="Vocabulary Progress"
                subtitle="Known vs Unknown & Progress by CEFR"
              />
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChartCard title="Known vs Unknown (Vocabulary)">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={knownPie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                      >
                        {knownPie.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Progress by CEFR (Vocabulary)">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cefrBars} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="level" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="known" name="Known" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="unknown" name="Unknown" fill="#a855f7" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </div>

            {/* ✅ Grammar charts (NEW) */}
            <div className="bg-white rounded-2xl shadow border border-blue-100 p-4 md:p-6">
              <SectionTitle
                icon={<BookOpen className="w-5 h-5" />}
                title="Grammar Progress"
                subtitle="Known vs Unknown & Progress by Level"
              />
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChartCard title="Known vs Unknown (Grammar)">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={grammarKnownPie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                      >
                        {grammarKnownPie.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Progress by Level (Grammar)">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={grammarLevelBars} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="level" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="known" name="Known" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="unknown" name="Unknown" fill="#a855f7" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
