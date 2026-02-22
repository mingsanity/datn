import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { UserCircle, Save, AlertTriangle, ChevronLeft, BookOpen } from "lucide-react";

const PIE_COLORS = ["#22c55e", "#ef4444"]; // known / unknown

function Card({ title, value, sub }) {
  return (
    <div className="p-4 bg-white rounded-xl shadow border border-blue-100">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-3xl font-bold text-gray-900 mt-1">{value}</div>
      {sub ? <div className="text-xs text-gray-500 mt-1">{sub}</div> : null}
    </div>
  );
}

function ChartCard({ title, children, right }) {
  return (
    <div className="bg-white rounded-2xl shadow border border-blue-100 p-4 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-gray-900">{title}</div>
        {right}
      </div>
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

export default function ProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [me, setMe] = useState(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    country: "",
    bio: "",
  });

  // vocab summary
  const [summary, setSummary] = useState(null);

  // ✅ grammar summary
  const [grammarSummary, setGrammarSummary] = useState(null);
  const [grammarErr, setGrammarErr] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr("");
      setGrammarErr("");

      // ✅ IMPORTANT: dùng allSettled để 1 cái fail không làm fail toàn bộ
      const results = await Promise.allSettled([
        apiFetch("/api/me"),
        apiFetch("/api/profile/summary"),
        apiFetch("/api/profile/grammar-summary"),
      ]);

      if (!mounted) return;

      const [meRes, sumRes, gsumRes] = results;

      // me
      if (meRes.status === "fulfilled") {
        const meData = meRes.value;
        setMe(meData);
        setForm({
          fullName: meData?.fullName || "",
          phone: meData?.phone || "",
          country: meData?.country || "",
          bio: meData?.bio || "",
        });
      } else {
        setErr(meRes.reason?.message || "Failed to load /api/me");
      }

      // vocab summary
      if (sumRes.status === "fulfilled") {
        setSummary(sumRes.value);
      } else {
        setErr(sumRes.reason?.message || "Failed to load /api/profile/summary");
      }

      // grammar summary (optional)
      if (gsumRes.status === "fulfilled") {
        setGrammarSummary(gsumRes.value);
      } else {
        // chỉ hiện lỗi nhỏ, không phá cả trang
        setGrammarErr(gsumRes.reason?.message || "Failed to load /api/profile/grammar-summary");
        setGrammarSummary(null);
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // ---------- VOCAB CHARTS ----------
  const totals = useMemo(() => {
    const total = summary?.totalWords ?? 0;
    const known = summary?.knownCount ?? 0;
    const fav = summary?.favoriteCount ?? 0;
    const unknown = Math.max(0, total - known);
    return { total, known, unknown, fav };
  }, [summary]);

  const knownPie = useMemo(() => {
    return [
      { name: "Known", value: totals.known },
      { name: "Unknown", value: totals.unknown },
    ];
  }, [totals]);

  const cefrBars = useMemo(() => {
    const arr = Array.isArray(summary?.byCefr) ? summary.byCefr : [];
    return arr.map((x) => ({
      level: x.key,
      known: x.known ?? 0,
      unknown: Math.max(0, (x.total ?? 0) - (x.known ?? 0)),
      total: x.total ?? 0,
    }));
  }, [summary]);

  const topicBars = useMemo(() => {
    const arr = Array.isArray(summary?.byTopic) ? summary.byTopic : [];
    const top = [...arr].sort((a, b) => (b.total ?? 0) - (a.total ?? 0)).slice(0, 8);
    return top.map((x) => ({
      topic: x.key,
      known: x.known ?? 0,
      unknown: Math.max(0, (x.total ?? 0) - (x.known ?? 0)),
      total: x.total ?? 0,
    }));
  }, [summary]);

  // ---------- ✅ GRAMMAR CHARTS ----------
  const gTotals = useMemo(() => {
    const total = grammarSummary?.totalGrammar ?? 0;
    const known = grammarSummary?.knownCount ?? 0;
    const fav = grammarSummary?.favoriteCount ?? 0;
    const unknown = Math.max(0, total - known);
    return { total, known, unknown, fav };
  }, [grammarSummary]);

  const gKnownPie = useMemo(() => {
    return [
      { name: "Known", value: gTotals.known },
      { name: "Unknown", value: gTotals.unknown },
    ];
  }, [gTotals]);

  const gLevelBars = useMemo(() => {
    const arr = Array.isArray(grammarSummary?.byLevel) ? grammarSummary.byLevel : [];
    return arr.map((x) => ({
      level: x.key,
      known: x.known ?? 0,
      unknown: Math.max(0, (x.total ?? 0) - (x.known ?? 0)),
      total: x.total ?? 0,
    }));
  }, [grammarSummary]);

  const onSave = async () => {
    setSaving(true);
    setErr("");
    try {
      const updated = await apiFetch("/api/me", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setMe(updated);
    } catch (e) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="bg-white/80 backdrop-blur shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center text-blue-500 hover:text-blue-700 font-medium transition-colors"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              <span className="hidden sm:inline">Trang chủ</span>
            </button>

            <div className="h-6 w-px bg-gray-200" />

            <div className="flex items-center gap-2">
              <UserCircle className="w-6 h-6 text-blue-600" />
              <div className="text-xl font-bold text-gray-900">Profile</div>
            </div>
          </div>

          <button
            onClick={onSave}
            disabled={saving || loading}
            className={`px-4 py-2 rounded-lg font-semibold border shadow-sm inline-flex items-center gap-2 ${
              saving || loading
                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent hover:opacity-95"
            }`}
          >
            <Save className="w-4 h-4" />
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {err && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {err}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: personal info */}
          <div className="bg-white rounded-2xl shadow border border-blue-100 p-5">
            <div className="font-semibold text-gray-900 mb-1">Thông tin cá nhân</div>
            <div className="text-sm text-gray-600 mb-4">Email: {me?.email || "-"}</div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-700 font-medium">Họ và tên</label>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 font-medium">Số điện thoại</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 font-medium">Quốc gia</label>
                <input
                  value={form.country}
                  onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 font-medium">Giới thiệu</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                  rows={5}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 outline-none"
                  placeholder="Viết vài dòng về bạn..."
                />
              </div>
            </div>
          </div>

          {/* Right: stats + charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* -------- VOCAB SECTION -------- */}
            <div className="bg-white rounded-2xl shadow border border-blue-100 p-4 md:p-6">
              <SectionTitle
                icon={<BookOpen className="w-5 h-5" />}
                title="Vocabulary Progress"
                subtitle="Known vs Unknown • CEFR • Topics"
              />

              <section className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card title="Tổng từ" value={totals.total} />
                <Card title="Đã biết" value={totals.known} sub="known=true" />
                <Card title="Chưa biết" value={totals.unknown} sub="known=false" />
                <Card title="Yêu thích" value={totals.fav} sub="favorite=true" />
              </section>

              <section className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
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

                <ChartCard title="Tiến độ theo CEFR (Vocabulary)">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cefrBars} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="level" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="known" name="Known" fill="#22c55e" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="unknown" name="Unknown" fill="#ef4444" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </section>

              <div className="mt-6">
                <ChartCard title="Top Topics (Known vs Unknown)">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topicBars} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="topic" angle={-20} textAnchor="end" interval={0} height={60} />
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

            {/* -------- ✅ GRAMMAR SECTION -------- */}
            <div className="bg-white rounded-2xl shadow border border-blue-100 p-4 md:p-6">
              <SectionTitle
                icon={<BookOpen className="w-5 h-5" />}
                title="Grammar Progress"
                subtitle="Known vs Unknown • Level"
              />

              {grammarErr ? (
                <div className="mt-4 p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
                  {grammarErr}
                </div>
              ) : null}

              <section className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card title="Tổng chủ điểm" value={gTotals.total} />
                <Card title="Đã biết" value={gTotals.known} sub="known=true" />
                <Card title="Chưa biết" value={gTotals.unknown} sub="known=false" />
                <Card title="Yêu thích" value={gTotals.fav} sub="favorite=true" />
              </section>

              <section className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChartCard title="Known vs Unknown (Grammar)">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gKnownPie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                      >
                        {gKnownPie.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Tiến độ theo Level (Grammar)">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gLevelBars} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="level" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="known" name="Known" fill="#22c55e" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="unknown" name="Unknown" fill="#ef4444" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
