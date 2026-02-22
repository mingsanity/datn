// src/pages/Grammar.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getToken } from "../api";
import { BookOpen, ChevronLeft, Search, Volume2 } from "lucide-react";

/* ===========================================================
   🧠 LOCAL SRS (per-user localStorage) — BACKEND = SOURCE OF TRUTH FOR CONTENT
   =========================================================== */

const BASE_STORAGE_KEY = "grammar_deck_v1";
const DEFAULT_EASE = 2.5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ✅ Mastery rule (you can tune these)
const MASTERED_REPS = 5; // learned enough times
const MASTERED_INTERVAL_DAYS = 7; // scheduled far enough in the future

const now = () => Date.now();

/** SM-2-ish schedule */
function schedule(card, grade) {
  const s = card.srs || {
    reps: 0,
    ease: DEFAULT_EASE,
    interval: 0,
    due: now(),
    lapses: 0,
  };

  let { reps, ease, interval, lapses } = s;
  const t = now();

  switch (grade) {
    case "again":
      lapses += 1;
      reps = 0;
      ease = Math.max(1.3, ease - 0.2);
      interval = 0;
      return { reps, ease, interval, lapses, due: t + 10 * 60 * 1000 };
    case "hard":
      ease = Math.max(1.3, ease - 0.15);
      interval = interval ? Math.max(1, Math.round(interval * 1.2)) : 1;
      reps = Math.max(1, reps);
      return { reps, ease, interval, lapses, due: t + interval * MS_PER_DAY };
    case "good":
      reps += 1;
      interval = interval === 0 ? 1 : Math.max(1, Math.round(interval * ease));
      return { reps, ease, interval, lapses, due: t + interval * MS_PER_DAY };
    case "easy":
      reps += 1;
      ease += 0.15;
      interval = interval ? Math.round(interval * (ease + 0.15)) : 3;
      return { reps, ease, interval, lapses, due: t + interval * MS_PER_DAY };
    default:
      return s;
  }
}

/** Local deck read/write (per user) */
function readDeckByKey(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDeckByKey(key, deck) {
  localStorage.setItem(key, JSON.stringify(deck));
}

/* ===========================================================
   🌐 BACKEND HELPERS (/api/grammar?level=&q=)
   =========================================================== */

const isServerId = (id) => /^\d+$/.test(String(id));

function mapServerToCard(g) {
  return {
    id: String(g.id),
    level: g.level || "A1",
    title: g.title || "",
    meaning: g.meaning || "",

    // From backend (parsed from content JSON)
    summary: g.summary || "",
    rules: Array.isArray(g.rules) ? g.rules : [],
    forms: Array.isArray(g.forms) ? g.forms : [],
    commonMistakes: Array.isArray(g.commonMistakes) ? g.commonMistakes : [],
    examples: Array.isArray(g.examples) ? g.examples : [],
    quiz: g.quiz || null,

    // local SRS init
    srs: {
      reps: 0,
      ease: DEFAULT_EASE,
      interval: 0,
      due: now(),
      lapses: 0,
    },
    createdAt: now(),

    // backend progress (optional fields)
    known: !!g.known,
    favorite: !!g.favorite,
    correctCount: Number(g.correctCount || 0),
    wrongCount: Number(g.wrongCount || 0),
    lastReviewedAt: g.lastReviewedAt || null,
  };
}

function mergeServerWithLocal(serverArr, localDeck) {
  const localById = new Map((localDeck || []).map((c) => [String(c.id), c]));

  return (serverArr || []).map((sv) => {
    const base = mapServerToCard(sv);
    const local = localById.get(base.id);
    if (!local) return base;

    return {
      ...base,
      srs: local.srs || base.srs,
      createdAt: local.createdAt || base.createdAt,
      // keep backend-known/favorite/correctCount... from server response
    };
  });
}

async function apiAnswer(grammarId, correct) {
  if (!isServerId(grammarId)) return;
  await apiFetch(`/api/grammar/${grammarId}/answer`, {
    method: "POST",
    body: JSON.stringify({ correct }),
  });
}

async function apiSetKnown(grammarId, known) {
  if (!isServerId(grammarId)) return;
  await apiFetch(`/api/grammar/${grammarId}/known`, {
    method: "POST",
    body: JSON.stringify({ known }),
  });
}

/* ===========================================================
   ✅ MASTERED CHECK (local rule)
   =========================================================== */

function isMastered(card) {
  // ✅ Prefer backend known if available
  if (card?.known === true) return true;

  const reps = Number(card?.srs?.reps || 0);
  const interval = Number(card?.srs?.interval || 0);

  return reps >= MASTERED_REPS || interval >= MASTERED_INTERVAL_DAYS;
}

/* ===========================================================
   ✅ MAIN PAGE
   =========================================================== */

export default function EnglishGrammarPage() {
  const navigate = useNavigate();

  // ✅ per-user localStorage key (so SRS is personalized per account on same browser)
  const [storageKey, setStorageKey] = useState(null);

  const [deck, setDeck] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const selected = useMemo(
    () => deck.find((x) => String(x.id) === String(selectedId)) || null,
    [deck, selectedId]
  );

  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);

  const [filterLevel, setFilterLevel] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const debounceRef = useRef(null);
  const latestRequestRef = useRef(0);

  const speak = (text) => {
    if (!text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  const resetQuiz = () => {
    setShowQuiz(false);
    setSelectedAnswer(null);
    setIsCorrect(null);
  };

  const updateCard = (cardId, grade) => {
    setDeck((prev) => {
      const updated = prev.map((card) => {
        if (String(card.id) !== String(cardId)) return card;
        const srs = schedule(card, grade);
        return { ...card, srs };
      });
      if (storageKey) writeDeckByKey(storageKey, updated);
      return updated;
    });
  };

  // ✅ Auth guard
  useEffect(() => {
    const token = getToken();
    if (!token) navigate("/login", { replace: true });
  }, [navigate]);

  // ✅ Determine per-user storageKey using /api/me, then load local SRS for that user
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    (async () => {
      try {
        const me = await apiFetch("/api/me");
        const key = `${BASE_STORAGE_KEY}_${me.id}`;
        setStorageKey(key);

        const local = readDeckByKey(key) || [];
        setDeck(local);
      } catch {
        const key = `${BASE_STORAGE_KEY}_guest`;
        setStorageKey(key);

        const local = readDeckByKey(key) || [];
        setDeck(local);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Backend load with debounce (merge server content + backend progress + local SRS)
  useEffect(() => {
    if (!storageKey) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const requestId = Date.now();
      latestRequestRef.current = requestId;

      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();
        if (filterLevel && filterLevel !== "all") params.set("level", filterLevel);
        if (searchTerm.trim()) params.set("q", searchTerm.trim());

        const path = `/api/grammar${params.toString() ? `?${params}` : ""}`;
        const server = await apiFetch(path);

        if (latestRequestRef.current !== requestId) return;

        const serverArr = Array.isArray(server) ? server : [];
        const local = readDeckByKey(storageKey) || [];
        const merged = mergeServerWithLocal(serverArr, local);

        setDeck(merged);
        writeDeckByKey(storageKey, merged);

        if (selectedId && !merged.some((x) => String(x.id) === String(selectedId))) {
          setSelectedId(null);
          resetQuiz();
        }
      } catch (e) {
        if (latestRequestRef.current !== requestId) return;
        setError(e?.message || "Không thể tải ngữ pháp từ backend (Spring Boot)");
        setDeck([]);
      } finally {
        if (latestRequestRef.current === requestId) setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLevel, searchTerm, storageKey]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* HEADER */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <button
            onClick={() => {
              if (selectedId) {
                setSelectedId(null);
                resetQuiz();
              } else {
                navigate("/");
              }
            }}
            className="flex items-center text-blue-500 hover:text-blue-600"
          >
            <ChevronLeft className="w-5 h-5 mr-1" /> Trang chủ
          </button>

          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Luyện Ngữ Pháp Tiếng Anh
          </h1>
          <BookOpen className="w-6 h-6 text-blue-500" />
        </div>
      </header>

      {/* TOOLBAR (list mode only) */}
      {!selected && (
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-2 items-center flex-wrap">
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="all">Tất cả cấp độ</option>
              <option value="A1">A1 (Cơ bản)</option>
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
              <option value="C1">C1</option>
              <option value="C2">C2</option>
            </select>
          </div>

          <div className="relative w-full md:w-1/3">
            <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Tìm chủ điểm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
      )}

      {/* CONTENT */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {!selected ? (
          <>
            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
              Danh sách chủ điểm ngữ pháp
            </h2>

            {loading && (
              <p className="text-center text-gray-500 italic">Đang tải dữ liệu...</p>
            )}

            {!loading && error && (
              <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">
                {error}
              </div>
            )}

            {!loading && !error && deck.length === 0 && (
              <p className="text-gray-500 text-center italic">
                Không tìm thấy chủ điểm nào phù hợp.
              </p>
            )}

            <div className="grid md:grid-cols-3 gap-6">
              {deck.map((g) => (
                <div
                  key={g.id}
                  onClick={() => {
                    setSelectedId(g.id);
                    resetQuiz();
                  }}
                  className="bg-white border border-blue-100 rounded-xl p-6 shadow-md hover:shadow-xl cursor-pointer hover:-translate-y-1 transition"
                >
                  <h3 className="text-lg font-semibold text-blue-600 mb-2">{g.title}</h3>
                  <p className="text-gray-600 text-sm mb-2">{g.meaning}</p>
                  <p className="text-gray-500 text-sm italic">Cấp độ: {g.level}</p>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <GrammarStats deck={deck} />
            </div>
          </>
        ) : (
          <div className="bg-white border border-blue-100 rounded-2xl shadow-lg p-8">
            <button
              onClick={() => {
                setSelectedId(null);
                resetQuiz();
              }}
              className="text-blue-500 hover:text-blue-600 mb-6 font-semibold"
            >
              ← Quay lại danh sách
            </button>

            <h2 className="text-3xl font-bold text-blue-600 mb-2">{selected.title}</h2>
            <p className="text-gray-700 mb-4">{selected.meaning}</p>

            {/* Summary */}
            {selected.summary ? (
              <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="font-semibold text-indigo-700">Tóm tắt</p>
                <p className="text-gray-700 mt-1">{selected.summary}</p>
              </div>
            ) : null}

            {/* Rules */}
            {Array.isArray(selected.rules) && selected.rules.length > 0 ? (
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-3">Quy tắc</h3>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  {selected.rules.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Forms */}
            {Array.isArray(selected.forms) && selected.forms.length > 0 ? (
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-3">Bảng cấu trúc</h3>
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full text-left">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">
                          Chủ ngữ
                        </th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">
                          Động từ
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.forms.map((row, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                            {row.subject}
                          </td>
                          <td className="px-4 py-3 text-gray-800 font-medium">{row.verb}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* Common mistakes */}
            {Array.isArray(selected.commonMistakes) && selected.commonMistakes.length > 0 ? (
              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-800 mb-3">Lỗi thường gặp</h3>
                <div className="space-y-3">
                  {selected.commonMistakes.map((m, idx) => (
                    <div
                      key={idx}
                      className="border border-red-100 bg-red-50 rounded-xl p-4"
                    >
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-sm font-semibold text-red-700">Sai</p>
                          <p className="text-gray-800">{m.wrong}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-green-700">Đúng</p>
                          <p className="text-gray-800">{m.right}</p>
                        </div>
                      </div>
                      {m.note ? (
                        <p className="text-gray-700 mt-2 text-sm">💡 {m.note}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Examples + speak */}
            <div className="mb-6 space-y-3">
              {(selected.examples || []).map((ex, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center bg-blue-50 p-3 rounded-lg"
                >
                  <div className="pr-3">
                    <p className="font-semibold">{ex.en}</p>
                    <p className="text-gray-600 text-sm">{ex.vi}</p>
                  </div>
                  <button
                    onClick={() => speak(ex.en)}
                    className="text-blue-500 hover:text-blue-600 shrink-0"
                    title="Phát âm"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Quiz */}
            {!selected.quiz ? (
              <div className="text-gray-500 italic">Chủ điểm này chưa có quiz.</div>
            ) : !showQuiz ? (
              <button
                onClick={() => setShowQuiz(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition shadow-lg font-semibold"
              >
                Làm bài kiểm tra
              </button>
            ) : (
              <div>
                <h3 className="text-xl font-semibold mb-4">🧠 {selected.quiz.question}</h3>

                <div className="space-y-3">
                  {(selected.quiz.options || []).map((opt, i) => (
                    <button
                      key={i}
                      onClick={async () => {
                        if (selectedAnswer !== null) return;

                        const correct = i === selected.quiz.correct;
                        setSelectedAnswer(i);
                        setIsCorrect(correct);

                        // local SRS (per user)
                        updateCard(selected.id, correct ? "good" : "again");

                        // backend progress (per user)
                        try {
                          await apiAnswer(selected.id, correct);

                          // ✅ align backend "known" with mastery rule
                          const local = storageKey ? readDeckByKey(storageKey) || [] : [];
                          const localCard = local.find(
                            (x) => String(x.id) === String(selected.id)
                          );

                          const masteredNow = isMastered(localCard);
                          if (masteredNow) {
                            await apiSetKnown(selected.id, true);
                          }
                        } catch (e) {
                          console.warn("Backend sync failed:", e?.message || e);
                        }
                      }}
                      disabled={selectedAnswer !== null}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                        selectedAnswer === i
                          ? isCorrect
                            ? "bg-green-100 border-green-400 text-green-700"
                            : "bg-red-100 border-red-400 text-red-700"
                          : "bg-white hover:bg-gray-50 border-gray-200"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                {selectedAnswer !== null && (
                  <div className="mt-4">
                    {isCorrect ? (
                      <p className="text-green-600 font-semibold">✅ Chính xác! Rất tốt!</p>
                    ) : (
                      <p className="text-red-600 font-semibold">❌ Sai rồi, thử lại nhé!</p>
                    )}

                    {selected.quiz?.explain ? (
                      <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                        <p className="font-semibold text-yellow-800">Giải thích</p>
                        <p className="text-gray-700 mt-1">{selected.quiz.explain}</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            <div className="mt-10">
              <GrammarReviewPanel deck={deck} onReview={(id, grade) => updateCard(id, grade)} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ===========================================================
   📊 ÔN TẬP & THỐNG KÊ (LOCAL SRS)
   =========================================================== */

export function GrammarReviewPanel({ deck, onReview }) {
  const [todayCards, setTodayCards] = useState([]);

  useEffect(() => {
    const dueCards = (deck || []).filter((c) => !c.srs || (c.srs.due || 0) <= now());
    setTodayCards(dueCards.slice(0, 5));
  }, [deck]);

  const handleGrade = (card, grade) => {
    onReview(card.id, grade);
    setTodayCards((prev) => prev.filter((c) => String(c.id) !== String(card.id)));
  };

  if (todayCards.length === 0)
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center text-gray-600">
        🎉 Không có chủ điểm nào cần ôn hôm nay!
      </div>
    );

  return (
    <div className="bg-white border border-blue-100 rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-blue-600 mb-6 text-center">
        Ôn Lại Ngữ Pháp Hôm Nay ({todayCards.length})
      </h2>
      {todayCards.map((card) => (
        <div
          key={card.id}
          className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4"
        >
          <h3 className="font-semibold text-blue-700">{card.title}</h3>
          <p className="text-gray-700 mb-2">{card.meaning}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => handleGrade(card, "again")}
              className="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
            >
              Quên rồi 😅
            </button>
            <button
              onClick={() => handleGrade(card, "hard")}
              className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
            >
              Hơi khó 🤔
            </button>
            <button
              onClick={() => handleGrade(card, "good")}
              className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              Tốt 👍
            </button>
            <button
              onClick={() => handleGrade(card, "easy")}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Dễ quá 😎
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function GrammarStats({ deck }) {
  const total = (deck || []).length;
  const learned = (deck || []).filter((c) => (c.srs?.reps || 0) > 0).length;
  const due = (deck || []).filter((c) => (c.srs?.due || 0) <= now()).length;

  // ✅ FIX: "mastered" should reflect real learning, not only ease>3
  // Rule: backend known OR reps>=5 OR interval>=7 days
  const mastered = (deck || []).filter((c) => isMastered(c)).length;

  return (
    <div className="bg-white border border-blue-100 rounded-xl shadow p-6">
      <h2 className="text-2xl font-bold text-blue-600 mb-4 text-center">
        Tiến độ học của bạn
      </h2>

      {/* small hint under title */}
      

      <div className="grid grid-cols-2 md:grid-cols-4 text-center gap-4">
        <div>
          <p className="text-3xl font-bold text-blue-600">{total}</p>
          <p className="text-gray-600 text-sm">Tổng chủ điểm</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-green-600">{learned}</p>
          <p className="text-gray-600 text-sm">Đã học</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-yellow-600">{due}</p>
          <p className="text-gray-600 text-sm">Cần ôn lại</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-purple-600">{mastered}</p>
          <p className="text-gray-600 text-sm">Đã thành thạo</p>
        </div>
      </div>
    </div>
  );
}
