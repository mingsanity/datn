// src/pages/VocabularyPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getToken } from "../api";
import {
  BookOpen,
  ChevronLeft,
  Clock,
  Plus,
  RotateCcw,
  Search,
  Volume2,
} from "lucide-react";


const STORAGE_KEY = "eng_vocab_progress_v1";
const DEFAULT_EASE = 2.5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const now = () => Date.now();

function readProgressMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeProgressMap(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function saveProgress(id, patch) {
  const map = readProgressMap();
  const old = map[String(id)] || {};
  map[String(id)] = { ...old, ...patch };
  writeProgressMap(map);
}

function clearAllProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

/** ==============================
 *  SRS (SM-2-ish)
 *  ============================== */
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
      return { reps, ease, interval, lapses, due: t + 10 * 60 * 1000 }; // 10 min
    case "hard":
      ease = Math.max(1.3, ease - 0.15);
      interval = interval ? Math.max(1, Math.round(interval * 1.2)) : 1;
      reps = Math.max(1, reps);
      return { reps, ease, interval, lapses, due: t + interval * MS_PER_DAY };
    case "good":
      reps += 1;
      if (interval === 0) interval = 1;
      else interval = Math.max(1, Math.round(interval * ease));
      return { reps, ease, interval, lapses, due: t + interval * MS_PER_DAY };
    case "easy":
      reps += 1;
      ease = ease + 0.15;
      interval = interval ? Math.round(interval * (ease + 0.15)) : 3;
      return { reps, ease, interval, lapses, due: t + interval * MS_PER_DAY };
    default:
      return s;
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sampleN(arr, n, excludeId) {
  return shuffle(arr.filter((x) => String(x.id) !== String(excludeId))).slice(
    0,
    n
  );
}

/** ==============================
 *  BACKEND HELPERS
 *  ============================== */
const isServerId = (id) => /^\d+$/.test(String(id));

function mapServerToCard(v) {
  return {
    id: String(v.id),
    word: v.word || "",
    meaning_vi: v.meaning || "",
    examples: v.example ? [{ en: v.example, vi: "" }] : [],
    pronunciation: v.pronunciation || "",
    pos: v.pos || "",
    cefr: v.cefr || "A1",
    topic: v.topic || "",

   
    known: !!v.known,
    favorite: !!v.favorite,
    correctCount: Number(v.correctCount || 0),
    wrongCount: Number(v.wrongCount || 0),

    
    srs: {
      reps: 0,
      ease: DEFAULT_EASE,
      interval: 0,
      due: now(),
      lapses: 0,
    },
    createdAt: now(),
  };
}

function mergeServerWithLocalProgress(serverArr) {
  const progress = readProgressMap();

  return (serverArr || []).map((sv) => {
    const base = mapServerToCard(sv);
    const p = progress[base.id];

    if (!p) return base;

    return {
      ...base,
      srs: p.srs || base.srs,
      createdAt: p.createdAt || base.createdAt,
      
      examples:
        Array.isArray(p.examples) && p.examples.length ? p.examples : base.examples,
    };
  });
}

async function apiAnswer(vocabId, correct) {
  if (!isServerId(vocabId)) return;
  await apiFetch(`/api/vocabulary/${vocabId}/answer`, {
    method: "POST",
    body: JSON.stringify({ correct }),
  });
}

async function apiSetKnown(vocabId, known) {
  if (!isServerId(vocabId)) return;
  await apiFetch(`/api/vocabulary/${vocabId}/known`, {
    method: "POST",
    body: JSON.stringify({ known }),
  });
}

async function apiSetFavorite(vocabId, favorite) {
  if (!isServerId(vocabId)) return;
  await apiFetch(`/api/vocabulary/${vocabId}/favorite`, {
    method: "POST",
    body: JSON.stringify({ favorite }),
  });
}

/** ==============================
 *  PAGE
 *  ============================== */
export default function EnglishVocabularyPage({ initialLevel = "A1" }) {
  const navigate = useNavigate();


  const [deck, setDeck] = useState([]);


  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cefr, setCefr] = useState(initialLevel || "ALL");
  const [lessonId, setLessonId] = useState("ALL"); //  UI name kept; actually topic
  const [topics, setTopics] = useState([]);

  // UI
  const [mode, setMode] = useState("flashcard"); // flashcard | quiz | list
  const [showAnswer, setShowAnswer] = useState(false);
  const [direction, setDirection] = useState("en2vi");
  const [dueOnly, setDueOnly] = useState(true);
  const [newLimit, setNewLimit] = useState(20);

  // backend status
  const [serverLoading, setServerLoading] = useState(true);
  const [serverError, setServerError] = useState("");

  // speech
  const [voices, setVoices] = useState([]);
  const [voiceReady, setVoiceReady] = useState(false);

  // add modal (backend create)
  const [showAddModal, setShowAddModal] = useState(false);
  const [draft, setDraft] = useState({
    word: "",
    meaning: "",
    example: "",
    pronunciation: "",
    pos: "",
    cefr: "A1",
    topic: "",
  });

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Voices
  useEffect(() => {
    const loadVoices = () => {
      if (!("speechSynthesis" in window)) return;
      const v = window.speechSynthesis
        .getVoices()
        .filter((vc) => vc.lang?.toLowerCase().startsWith("en"));
      setVoices(v);
      setVoiceReady(true);
    };
    loadVoices();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const speak = (text) => {
    if (!text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    if (voices.length > 0) u.voice = voices[0];
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  };

  // Auth guard + load topics once
  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    (async () => {
      try {
        const t = await apiFetch("/api/vocabulary/topics");
        setTopics(Array.isArray(t) ? t : []);
      } catch (e) {
        console.warn("Cannot load topics:", e?.message || e);
        setTopics([]);
      }
    })();
  }, [navigate]);

  // Fetch vocabulary from backend (filters applied server-side)
  const fetchVocab = useCallback(async () => {
    const token = getToken();
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setServerLoading(true);
    setServerError("");

    try {
      const params = new URLSearchParams();
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      if (cefr && cefr !== "ALL") params.set("cefr", cefr);
      if (lessonId && lessonId !== "ALL") params.set("lessonId", lessonId); // topic here

      const server = await apiFetch(`/api/vocabulary?${params.toString()}`);
      const serverArr = Array.isArray(server) ? server : [];

      const merged = mergeServerWithLocalProgress(serverArr);
      setDeck(merged);
      setShowAnswer(false);
    } catch (e) {
      setServerError(e?.message || "Không thể tải từ vựng từ backend");
      setDeck([]);
    } finally {
      setServerLoading(false);
    }
  }, [navigate, debouncedQuery, cefr, lessonId]);

  useEffect(() => {
    fetchVocab();
  }, [fetchVocab]);

  /** STUDY POOL (SRS) **/
  const dueCards = useMemo(
    () => deck.filter((w) => (w.srs?.due || 0) <= now()),
    [deck]
  );
  const newCards = useMemo(
    () => deck.filter((w) => (w.srs?.reps || 0) === 0),
    [deck]
  );

  const learningPool = useMemo(() => {
    const pool = [...dueCards];
    const remaining = Math.max(0, newLimit - pool.length);
    if (remaining > 0) pool.push(...newCards.slice(0, remaining));
    return pool.length > 0 ? pool : deck;
  }, [dueCards, newCards, deck, newLimit]);

  const currentCard = useMemo(() => {
    const list = dueOnly ? learningPool : deck;
    if (!list.length) return null;
    const sorted = [...list].sort(
      (a, b) => (a.srs?.due || 0) - (b.srs?.due || 0)
    );
    return sorted[0];
  }, [dueOnly, learningPool, deck]);

  const updateCard = (id, updater) => {
    setDeck((prev) =>
      prev.map((c) => {
        if (String(c.id) !== String(id)) return c;
        const patch = updater(c) || {};
        return { ...c, ...patch };
      })
    );
  };

  const handleGrade = async (grade) => {
    if (!currentCard) return;

    const nextSrs = schedule(currentCard, grade);
    updateCard(currentCard.id, () => ({ srs: nextSrs }));
    saveProgress(currentCard.id, { srs: nextSrs, createdAt: currentCard.createdAt || now() });
    setShowAnswer(false);

    // backend sync
    const correct = grade === "good" || grade === "easy";
    try {
      await apiAnswer(currentCard.id, correct);
      if ((nextSrs.reps || 0) >= 3 && correct) {
        await apiSetKnown(currentCard.id, true);
        updateCard(currentCard.id, () => ({ known: true }));
      }
    } catch (e) {
      console.warn("Backend sync failed:", e?.message || e);
    }
  };

  const toggleKnown = async () => {
    if (!currentCard) return;
    const next = !currentCard.known;
    updateCard(currentCard.id, () => ({ known: next }));
    try {
      await apiSetKnown(currentCard.id, next);
    } catch (e) {
      console.warn("Set known failed:", e?.message || e);
    }
  };

  const toggleFavorite = async () => {
    if (!currentCard) return;
    const next = !currentCard.favorite;
    updateCard(currentCard.id, () => ({ favorite: next }));
    try {
      await apiSetFavorite(currentCard.id, next);
    } catch (e) {
      console.warn("Set favorite failed:", e?.message || e);
    }
  };

  const resetProgress = () => {
    if (!window.confirm("Đặt lại toàn bộ tiến độ SRS (local)?")) return;
    clearAllProgress();
    setDeck((prev) =>
      prev.map((w) => ({
        ...w,
        srs: { reps: 0, ease: DEFAULT_EASE, interval: 0, due: now(), lapses: 0 },
      }))
    );
    setShowAnswer(false);
  };

  // Keyboard shortcuts (flashcard)
  useEffect(() => {
    const onKey = (e) => {
      if (!currentCard) return;
      if (mode === "flashcard") {
        if (e.code === "Space") {
          e.preventDefault();
          setShowAnswer((s) => !s);
        }
        if (e.key === "1") handleGrade("again");
        if (e.key === "2") handleGrade("hard");
        if (e.key === "3") handleGrade("good");
        if (e.key === "4") handleGrade("easy");
        if (e.key.toLowerCase() === "r") speak(currentCard.word);
      }
      if (mode === "quiz") {
        if (["1", "2", "3", "4"].includes(e.key)) {
          // quiz handler is inside QuizView; we handle there via props
        }
        if (e.key.toLowerCase() === "r") speak(currentCard.word);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentCard]); // keep it simple

  /** QUIZ **/
  const [choices, setChoices] = useState([]);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);

  useEffect(() => {
    if (mode !== "quiz" || !currentCard) return;
    const wrong = sampleN(deck, 3, currentCard.id);
    const items =
      direction === "en2vi"
        ? shuffle([currentCard.meaning_vi, ...wrong.map((x) => x.meaning_vi)])
        : shuffle([currentCard.word, ...wrong.map((x) => x.word)]);
    setChoices(items);
    setSelectedChoice(null);
    setIsAnswered(false);
  }, [mode, currentCard, direction, deck]);

  const handleQuizAnswer = async (choice) => {
    if (!currentCard || isAnswered) return;
    setSelectedChoice(choice);
    setIsAnswered(true);

    const correct =
      direction === "en2vi" ? currentCard.meaning_vi : currentCard.word;
    const ok = choice === correct;

    const grade = ok ? "good" : "again";
    const nextSrs = schedule(currentCard, grade);
    updateCard(currentCard.id, () => ({ srs: nextSrs }));
    saveProgress(currentCard.id, { srs: nextSrs, createdAt: currentCard.createdAt || now() });

    try {
      await apiAnswer(currentCard.id, ok);
      if ((nextSrs.reps || 0) >= 3 && ok) {
        await apiSetKnown(currentCard.id, true);
        updateCard(currentCard.id, () => ({ known: true }));
      }
    } catch (e) {
      console.warn("Backend sync failed:", e?.message || e);
    }

    if (ok) {
      setTimeout(() => {
        setSelectedChoice(null);
        setIsAnswered(false);
      }, 700);
    }
  };

  /** STATS **/
  const learnedCount = deck.filter((w) => (w.srs?.reps || 0) >= 3).length;
  const dueCount = dueCards.length;
  const newCount = newCards.length;

  /** ADD (backend) **/
  const createVocabOnBackend = async () => {
    const payload = {
      word: draft.word.trim(),
      meaning: draft.meaning.trim(),
      example: draft.example.trim() || null,
      pronunciation: draft.pronunciation.trim() || null,
      pos: draft.pos.trim() || null,
      cefr: draft.cefr || "A1",
      topic: draft.topic || "",
    };

    if (!payload.word || !payload.meaning) {
      alert("Vui lòng nhập word và meaning.");
      return;
    }

    try {
      // Requires backend endpoint: POST /api/vocabulary
      await apiFetch("/api/vocabulary", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowAddModal(false);
      setDraft({
        word: "",
        meaning: "",
        example: "",
        pronunciation: "",
        pos: "",
        cefr: "A1",
        topic: "",
      });
      await fetchVocab();
    } catch (e) {
      alert(
        "Không thể thêm từ (cần endpoint POST /api/vocabulary): " +
          (e?.message || "Error")
      );
    }
  };

  /** UI **/
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50">
      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 transition"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="font-semibold">Trang chủ</span>
            </a>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
              Study Vocabulary
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Filters */}
            <div className="hidden md:flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-2 top-2.5" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search... "
                  className="pl-8 pr-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-0 w-64"
                />
              </div>

              {/* lessonId UI => topic dropdown */}
              <select
                value={lessonId}
                onChange={(e) => setLessonId(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400"
                title="Topic (sent as lessonId=<topic>)"
              >
                <option value="ALL">ALL Topics</option>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                value={cefr}
                onChange={(e) => setCefr(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400"
                title="CEFR"
              >
                {["ALL", "A1", "A2", "B1", "B2", "C1", "C2"].map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 rounded-lg border border-gray-200 px-1">
                {["flashcard", "quiz", "list"].map((m) => (
                  <button
                    key={m}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                      mode === m ? "bg-blue-500 text-white" : "hover:bg-gray-100"
                    }`}
                    onClick={() => setMode(m)}
                  >
                    {m === "flashcard"
                      ? "Thẻ"
                      : m === "quiz"
                      ? "Quiz"
                      : "Danh sách"}
                  </button>
                ))}
              </div>

              <button
                className={`px-3 py-2 rounded-lg border ${
                  dueOnly ? "border-blue-400 text-blue-600" : "border-gray-200"
                } hover:bg-blue-50`}
                onClick={() => setDueOnly((v) => !v)}
              >
                <Clock className="w-4 h-4 inline -mt-1 mr-1" />
                {dueOnly ? "Đến hạn" : "Tất cả"}
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4 inline -mt-1 mr-1" /> Thêm
              </button>

              <button
                className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={resetProgress}
                title="Reset SRS (local)"
              >
                <RotateCcw className="w-4 h-4 inline -mt-1 mr-1" /> Reset SRS
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* BODY */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Backend status */}
        {serverLoading && (
          <div className="mb-4 p-3 rounded-lg bg-white border border-blue-100 text-gray-700">
            Đang tải từ vựng từ server...
          </div>
        )}
        {!serverLoading && serverError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
            {serverError}
          </div>
        )}

        {/* Statistics */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-white rounded-xl shadow border border-blue-100">
            <div className="text-sm text-gray-500">Đến hạn</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">
              {dueCount}
            </div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow border border-blue-100">
            <div className="text-sm text-gray-500">Từ mới</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">
              {newCount}
            </div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow border border-blue-100">
            <div className="text-sm text-gray-500">Đã nắm vững (≥3)</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">
              {learnedCount}
            </div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow border border-blue-100">
            <div className="text-sm text-gray-500">Giới hạn từ mới / phiên</div>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                min={5}
                max={50}
                value={newLimit}
                onChange={(e) => setNewLimit(Number(e.target.value))}
                className="w-full"
              />
              <span className="w-10 text-right font-semibold">{newLimit}</span>
            </div>
          </div>
        </section>

        {/* Modes */}
        {mode === "flashcard" && (
          <FlashcardView
            card={currentCard}
            showAnswer={showAnswer}
            setShowAnswer={setShowAnswer}
            onSpeak={() => speak(currentCard?.word)}
            onGrade={handleGrade}
            direction={direction}
            setDirection={setDirection}
            voiceReady={voiceReady}
            onToggleKnown={toggleKnown}
            onToggleFavorite={toggleFavorite}
          />
        )}

        {mode === "quiz" && (
          <QuizView
            card={currentCard}
            onSpeak={() => speak(currentCard?.word)}
            direction={direction}
            setDirection={setDirection}
            choices={choices}
            selected={selectedChoice}
            isAnswered={isAnswered}
            onAnswer={handleQuizAnswer}
            voiceReady={voiceReady}
          />
        )}

        {mode === "list" && <ListView words={deck} speak={speak} />}
      </main>

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200">
            <div className="p-5 border-b flex items-center justify-between">
              <div className="font-bold text-lg">Thêm từ (Backend)</div>
              <button
                className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={() => setShowAddModal(false)}
              >
                Đóng
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">Word *</label>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400"
                  value={draft.word}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, word: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Meaning (VI) *</label>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400"
                  value={draft.meaning}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, meaning: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">CEFR</label>
                <select
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400"
                  value={draft.cefr}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, cefr: e.target.value }))
                  }
                >
                  {["A1", "A2", "B1", "B2", "C1", "C2"].map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">Topic</label>
                <select
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400"
                  value={draft.topic}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, topic: e.target.value }))
                  }
                >
                  <option value="">(none)</option>
                  {topics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">POS</label>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400"
                  value={draft.pos}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, pos: e.target.value }))
                  }
                  placeholder="noun / verb / adj..."
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Pronunciation</label>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400"
                  value={draft.pronunciation}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, pronunciation: e.target.value }))
                  }
                  placeholder="/ˈæp.əl/ (optional)"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">Example</label>
                <textarea
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400"
                  value={draft.example}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, example: e.target.value }))
                  }
                  rows={3}
                  placeholder="I eat an apple every day."
                />
              </div>
            </div>

            <div className="p-5 border-t flex items-center justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={() => setShowAddModal(false)}
              >
                Hủy
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                onClick={createVocabOnBackend}
              >
                Lưu
              </button>
            </div>

            <div className="px-5 pb-5 text-xs text-gray-500">
              * Lưu ý: Cần backend endpoint{" "}
              <code className="px-1 py-0.5 border rounded">POST /api/vocabulary</code>{" "}
              để nút “Lưu” hoạt động.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** ==============================
 *  UI COMPONENTS
 *  ============================== */

function FlashcardView({
  card,
  showAnswer,
  setShowAnswer,
  onSpeak,
  onGrade,
  direction,
  setDirection,
  voiceReady,
  onToggleKnown,
  onToggleFavorite,
}) {
  if (!card) {
    return (
      <div className="p-12 bg-white rounded-xl shadow border border-blue-100 text-center">
        <BookOpen className="w-10 h-10 text-blue-500 mx-auto mb-2" />
        <div className="text-lg font-semibold">Không có thẻ nào phù hợp</div>
        <div className="text-gray-600 mt-1">
          Hãy đổi bộ lọc (Topic/CEFR/Search) hoặc tắt “Đến hạn”.
        </div>
      </div>
    );
  }

  const front =
    direction === "en2vi" ? (
      <div className="text-center">
        <div className="text-5xl md:text-7xl font-bold text-gray-900 tracking-wide mb-3">
          {card.word}
        </div>
        {(card.pronunciation || card.pos || card.cefr || card.topic) && (
          <div className="text-sm text-gray-500 mt-3 space-y-1">
            {card.pronunciation && <div>{card.pronunciation}</div>}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {card.cefr && (
                <span className="px-2 py-0.5 rounded-full border bg-white">
                  CEFR: {card.cefr}
                </span>
              )}
              {card.pos && (
                <span className="px-2 py-0.5 rounded-full border bg-white">
                  {card.pos}
                </span>
              )}
              {card.topic && (
                <span className="px-2 py-0.5 rounded-full border bg-white">
                  {card.topic}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    ) : (
      <div className="text-center">
        <div className="text-4xl font-bold text-gray-900 mb-3">
          {card.meaning_vi}
        </div>
        <div className="text-gray-600">Hãy nhớ lại từ tiếng Anh tương ứng</div>
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap text-sm text-gray-500">
          {card.cefr && (
            <span className="px-2 py-0.5 rounded-full border bg-white">
              CEFR: {card.cefr}
            </span>
          )}
          {card.topic && (
            <span className="px-2 py-0.5 rounded-full border bg-white">
              {card.topic}
            </span>
          )}
        </div>
      </div>
    );

  const back =
    direction === "en2vi" ? (
      <div className="text-center">
        <div className="text-4xl font-bold text-gray-900 mb-3">
          {card.meaning_vi}
        </div>

        {Array.isArray(card.examples) && card.examples.length > 0 && (
          <div className="mt-6 text-left max-w-2xl mx-auto">
            <div className="text-sm font-semibold text-gray-500 uppercase">
              Ví dụ
            </div>
            <ul className="mt-2 space-y-2">
              {card.examples.map((ex, i) => (
                <li
                  key={i}
                  className="p-3 rounded-lg bg-gradient-to-br from-white to-blue-50 border border-blue-100"
                >
                  <div className="text-gray-900">{ex.en}</div>
                  {ex.vi ? (
                    <div className="text-gray-600 text-sm">{ex.vi}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    ) : (
      <div className="text-center">
        <div className="text-5xl md:text-7xl font-bold text-gray-900 tracking-wide mb-3">
          {card.word}
        </div>
        {card.pronunciation && (
          <div className="text-xl text-gray-600 mb-2">{card.pronunciation}</div>
        )}
        {card.pos && <div className="text-sm text-gray-500">({card.pos})</div>}
      </div>
    );

  return (
    <section className="bg-white rounded-2xl shadow-xl border border-blue-100 p-6 md:p-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1.5 rounded-lg border ${
              direction === "en2vi"
                ? "bg-blue-500 text-white"
                : "border-gray-200 hover:bg-gray-50"
            }`}
            onClick={() => setDirection("en2vi")}
          >
            EN → VI
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg border ${
              direction === "vi2en"
                ? "bg-blue-500 text-white"
                : "border-gray-200 hover:bg-gray-50"
            }`}
            onClick={() => setDirection("vi2en")}
          >
            VI → EN
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={onToggleFavorite}
            className={`px-3 py-2 rounded-lg border ${
              card.favorite
                ? "border-yellow-400 text-yellow-700 bg-yellow-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
            title="Yêu thích"
          >
            {card.favorite ? "★ Yêu thích" : "☆ Yêu thích"}
          </button>

          <button
            onClick={onToggleKnown}
            className={`px-3 py-2 rounded-lg border ${
              card.known
                ? "border-green-400 text-green-700 bg-green-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
            title="Đã biết"
          >
            {card.known ? "✓ Đã biết" : "Đánh dấu đã biết"}
          </button>

          <button
            onClick={onSpeak}
            className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            title={voiceReady ? "Phát âm (R)" : "Trình duyệt không hỗ trợ Speech"}
          >
            <Volume2 className="w-4 h-4 inline -mt-1 mr-1" /> Phát âm
          </button>

          <span className="text-xs text-gray-500">
            <kbd className="px-1.5 py-0.5 border rounded">Space</kbd> lật •{" "}
            <kbd className="px-1.5 py-0.5 border rounded">1–4</kbd> chấm •{" "}
            <kbd className="px-1.5 py-0.5 border rounded">R</kbd> phát âm
          </span>
        </div>
      </div>

      <div
        className="p-8 md:p-12 rounded-xl border border-gray-100 bg-gradient-to-br from-white to-blue-50 text-center cursor-pointer"
        onClick={() => setShowAnswer((s) => !s)}
      >
        {!showAnswer ? front : back}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
        <GradeBtn
          color="bg-gray-200 text-gray-800 hover:bg-gray-300"
          label="Again"
          hotkey="1"
          onClick={() => onGrade("again")}
        />
        <GradeBtn
          color="bg-orange-200 text-orange-900 hover:bg-orange-300"
          label="Hard"
          hotkey="2"
          onClick={() => onGrade("hard")}
        />
        <GradeBtn
          color="bg-green-500 text-white hover:bg-green-600"
          label="Good"
          hotkey="3"
          onClick={() => onGrade("good")}
        />
        <GradeBtn
          color="bg-blue-500 text-white hover:bg-blue-600"
          label="Easy"
          hotkey="4"
          onClick={() => onGrade("easy")}
        />
      </div>
    </section>
  );
}

function GradeBtn({ color, label, hotkey, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full py-3 rounded-lg font-semibold transition ${color}`}
    >
      {label} <span className="opacity-80 text-xs">[{hotkey}]</span>
    </button>
  );
}

function QuizView({
  card,
  onSpeak,
  direction,
  setDirection,
  choices,
  selected,
  isAnswered,
  onAnswer,
  voiceReady,
}) {
  if (!card) {
    return (
      <div className="p-12 bg-white rounded-xl shadow border border-blue-100 text-center">
        <BookOpen className="w-10 h-10 text-blue-500 mx-auto mb-2" />
        <div className="text-lg font-semibold">Không có câu hỏi phù hợp</div>
        <div className="text-gray-600 mt-1">
          Hãy đổi bộ lọc (Topic/CEFR/Search) hoặc tắt “Đến hạn”.
        </div>
      </div>
    );
  }

  const prompt = direction === "en2vi" ? card.word : card.meaning_vi;
  const correct = direction === "en2vi" ? card.meaning_vi : card.word;

  return (
    <section className="bg-white rounded-2xl shadow-xl border border-blue-100 p-6 md:p-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1.5 rounded-lg border ${
              direction === "en2vi"
                ? "bg-blue-500 text-white"
                : "border-gray-200 hover:bg-gray-50"
            }`}
            onClick={() => setDirection("en2vi")}
          >
            EN → VI
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg border ${
              direction === "vi2en"
                ? "bg-blue-500 text-white"
                : "border-gray-200 hover:bg-gray-50"
            }`}
            onClick={() => setDirection("vi2en")}
          >
            VI → EN
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSpeak}
            className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            title={voiceReady ? "Phát âm (R)" : "Không hỗ trợ Speech"}
          >
            <Volume2 className="w-4 h-4 inline -mt-1 mr-1" /> Phát âm
          </button>
        </div>
      </div>

      <div className="text-center mb-6">
        <div className="text-sm text-gray-500 font-medium">
          Câu hỏi {card.topic ? `• ${card.topic}` : ""}{" "}
          {card.cefr ? `• ${card.cefr}` : ""}
        </div>
        <div className="mt-2 text-3xl md:text-5xl font-bold text-gray-900">
          {prompt}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {choices.map((c, idx) => {
          const isCorrect = c === correct;
          const isSelected = c === selected;
          let cls =
            "w-full p-4 rounded-lg border text-left hover:bg-gray-50 transition";
          if (isAnswered) {
            if (isCorrect)
              cls =
                "w-full p-4 rounded-lg border border-green-400 bg-green-50";
            else if (isSelected)
              cls = "w-full p-4 rounded-lg border border-red-400 bg-red-50";
          }
          return (
            <button
              key={c + idx}
              className={cls}
              onClick={() => onAnswer(c)}
              disabled={isAnswered}
            >
              <div className="font-semibold">
                {idx + 1}. {c}
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-sm text-gray-500 mt-4">
        Gợi ý: Nhấn{" "}
        <kbd className="px-1.5 py-0.5 border rounded">1–4</kbd> để chọn đáp án •{" "}
        <kbd className="px-1.5 py-0.5 border rounded">R</kbd> phát âm
      </div>
    </section>
  );
}

function ListView({ words, speak }) {
  return (
    <section className="bg-white rounded-2xl shadow-xl border border-blue-100 p-4 md:p-6">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr className="text-gray-600 text-sm border-b">
              <th className="py-2 pr-4">Topic</th>
              <th className="py-2 pr-4">CEFR</th>
              <th className="py-2 pr-4">POS</th>
              <th className="py-2 pr-4">Word</th>
              <th className="py-2 pr-4">Meaning (VI)</th>
              <th className="py-2 pr-4">Pron</th>
              <th className="py-2 pr-4">SRS</th>
              <th className="py-2 pr-4"> </th>
            </tr>
          </thead>
          <tbody>
            {words.map((w) => (
              <tr key={w.id} className="border-b hover:bg-blue-50/40">
                <td className="py-2 pr-4">{w.topic || "-"}</td>
                <td className="py-2 pr-4">{w.cefr || "-"}</td>
                <td className="py-2 pr-4">{w.pos || "-"}</td>
                <td className="py-2 pr-4 font-semibold">{w.word}</td>
                <td className="py-2 pr-4">{w.meaning_vi}</td>
                <td className="py-2 pr-4">{w.pronunciation || "-"}</td>
                <td className="py-2 pr-4">
                  <span className="text-xs text-gray-500">
                    reps: {w.srs?.reps ?? 0} • ease:{" "}
                    {(w.srs?.ease ?? 0).toFixed(2)} • I: {w.srs?.interval ?? 0}d
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <button
                    className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                    onClick={() => speak(w.word)}
                    title="Phát âm"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {words.length === 0 && (
              <tr>
                <td className="py-6 text-center text-gray-500" colSpan={8}>
                  Không có từ nào trong bộ lọc hiện tại.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
