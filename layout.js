"use client";

import "./globals.css";
import { useEffect, useState, useRef } from "react";

const PRIZES = [
  { name: "꽝", weight: 35, icon: "😶" },
  { name: "꽝", weight: 35, icon: "😶" },
  { name: "팝마트 가기", weight: 10, icon: "🛍️" },
  { name: "바다 보러 가기", weight: 8, icon: "🌊" },
  { name: "마라탕 시키기", weight: 12, icon: "🍲" },
  { name: "찜닭 시키기", weight: 10, icon: "🍗" },
  { name: "뽑기하러 가기", weight: 6, icon: "🎁" },
  { name: "노래방 가기", weight: 4, icon: "🎤" }
];

const REQUIRED = 500;
const STORAGE_KEY = "oni-star-state-v2";
const LEGACY_STORAGE_KEY = "oni-star-state";

const PROFANITY = [
  "시발", "씨발", "ㅅㅂ", "병신", "ㅄ", "개새끼", "좆",
  "닥쳐", "꺼져", "ㅈㄴ", "존나", "fuck", "shit", "bitch"
];

const KEYBOARD_MASH = [
  "ㅁㄴㅇㄹ", "asdf", "qwer", "zxcv", "ㅂㅈㄷㄱ",
  "ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ", "ㅎㅎㅎㅎㅎㅎㅎㅎㅎㅎㅎㅎㅎㅎㅎ"
];

function normalize(text) {
  return text.replace(/\s+/g, "");
}

function checkReview(review) {
  const trimmed = review.trim();
  const norm = normalize(trimmed);

  if (norm.length < REQUIRED) {
    return { status: "too_short" };
  }

  const uniqueChars = new Set(norm.split(""));
  if (uniqueChars.size <= 3) {
    return { status: "bad", reason: "같은 글자만 반복해서 채운 것 같아요." };
  }

  let maxRun = 1;
  let curRun = 1;
  for (let i = 1; i < norm.length; i++) {
    if (norm[i] === norm[i - 1]) {
      curRun++;
      maxRun = Math.max(maxRun, curRun);
    } else {
      curRun = 1;
    }
  }
  if (maxRun >= 15) {
    return { status: "bad", reason: "같은 글자를 너무 길게 반복했어요." };
  }

  const chunkLen = 10;
  if (norm.length >= chunkLen * 3) {
    const chunks = {};
    for (let i = 0; i + chunkLen <= norm.length; i += chunkLen) {
      const chunk = norm.slice(i, i + chunkLen);
      chunks[chunk] = (chunks[chunk] || 0) + 1;
      if (chunks[chunk] >= 3) {
        return { status: "bad", reason: "같은 문구를 반복 복사한 것 같아요." };
      }
    }
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 6) {
    const wordCounts = {};
    words.forEach((w) => {
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    });
    const maxWordCount = Math.max(...Object.values(wordCounts));
    if (maxWordCount / words.length > 0.5) {
      return { status: "bad", reason: "같은 단어를 너무 많이 반복했어요." };
    }
  }

  const lower = norm.toLowerCase();
  for (const word of PROFANITY) {
    if (lower.includes(word)) {
      return { status: "bad", reason: "부적절한 표현이 포함되어 있어요." };
    }
  }
  for (const m of KEYBOARD_MASH) {
    if (lower.includes(m.toLowerCase())) {
      return { status: "bad", reason: "의미 없는 글자로 채운 것 같아요." };
    }
  }

  return { status: "ok" };
}

function pickPrize() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) {
    if (r < p.weight) return p;
    r -= p.weight;
  }
  return PRIZES[0];
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
      d.getDate()
    ).padStart(2, "0")}`;
  } catch (e) {
    return "";
  }
}

function defaultState() {
  return { books: [], archive: [], cycleCount: 0, drawHistory: [] };
}

function loadState() {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.books) && Array.isArray(parsed.archive)) {
        return {
          books: parsed.books,
          archive: parsed.archive,
          cycleCount: parsed.cycleCount || 0,
          drawHistory: parsed.drawHistory || []
        };
      }
    }
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy && Array.isArray(legacy.books)) {
        const now = new Date().toISOString();
        const migrated = legacy.books.map((b) => ({ ...b, completedAt: now }));
        return { books: migrated, archive: [], cycleCount: 0, drawHistory: [] };
      }
    }
  } catch (e) {}
  return defaultState();
}

function saveState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [books, setBooks] = useState([]);
  const [archive, setArchive] = useState([]);
  const [cycleCount, setCycleCount] = useState(0);
  const [drawHistory, setDrawHistory] = useState([]);

  const [view, setView] = useState("home");
  const [modal, setModal] = useState(null);
  const [title, setTitle] = useState("");
  const [review, setReview] = useState("");
  const [formError, setFormError] = useState("");
  const [prizeResult, setPrizeResult] = useState(null);
  const [warnReason, setWarnReason] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [justFilledStar, setJustFilledStar] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    const state = loadState();
    setBooks(state.books);
    setArchive(state.archive);
    setCycleCount(state.cycleCount);
    setDrawHistory(state.drawHistory);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveState({ books, archive, cycleCount, drawHistory });
  }, [books, archive, cycleCount, drawHistory, loaded]);

  function openAdd() {
    setTitle("");
    setReview("");
    setFormError("");
    setModal("add");
  }

  function closeModal() {
    setModal(null);
    setPrizeResult(null);
  }

  function submitReview() {
    const t = title.trim();
    if (!t) {
      setFormError("책 제목을 입력해주세요.");
      return;
    }
    const result = checkReview(review);
    if (result.status === "too_short") {
      setFormError("감상평은 500자 이상 작성해야 별이 채워져요.");
      return;
    }
    if (result.status === "bad") {
      setBooks([]);
      setWarnReason(result.reason);
      setModal("warn");
      return;
    }
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: t,
      review: review.trim(),
      completedAt: new Date().toISOString()
    };
    setBooks((prev) => [...prev, entry]);
    setArchive((prev) => [entry, ...prev]);
    closeModal();
    setJustFilledStar(true);
    window.setTimeout(() => setJustFilledStar(false), 900);
  }

  function openDraw() {
    setPrizeResult(null);
    setModal("draw");
  }

  function reveal() {
    const prize = pickPrize();
    setPrizeResult(prize);
    setDrawHistory((prev) => [
      { prize: prize.name, icon: prize.icon, at: new Date().toISOString() },
      ...prev
    ]);
  }

  function finishCycle() {
    setBooks([]);
    setCycleCount((c) => c + 1);
    closeModal();
  }

  const charLen = review.length;
  const filled = books.length;
  const totalStars = archive.length;

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "2rem 1rem"
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 20,
            padding: "1.5rem 1.25rem",
            border: "0.5px solid #E5E2D8"
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "1.1rem" }}>
            <p style={{ fontSize: 13, color: "#888780", margin: "0 0 2px" }}>
              온이의
            </p>
            <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>
              별 쌓기
            </h1>
          </div>

          {!loaded ? (
            <p
              style={{
                textAlign: "center",
                fontSize: 13,
                color: "#888780",
                padding: "2rem 0"
              }}
            >
              불러오는 중
            </p>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 6,
                  marginBottom: 4,
                  padding: "4px 0 12px",
                  background:
                    "radial-gradient(ellipse at center, rgba(250,199,117,0.18) 0%, rgba(250,199,117,0) 70%)",
                  flexWrap: "wrap"
                }}
              >
                {Array.from({ length: 7 }).map((_, i) => {
                  const isFilled = i < filled;
                  const isNewest = isFilled && i === filled - 1 && justFilledStar;
                  return (
                    <span
                      key={i}
                      style={{
                        fontSize: isNewest ? 32 : 26,
                        color: isFilled ? "#EF9F27" : "#D3D1C7",
                        lineHeight: 1,
                        display: "inline-block",
                        transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        textShadow: isFilled
                          ? "0 0 12px rgba(239,159,39,0.45)"
                          : "none"
                      }}
                    >
                      {isFilled ? "★" : "☆"}
                    </span>
                  );
                })}
              </div>

              <p
                style={{
                  textAlign: "center",
                  fontSize: 14,
                  color: "#5F5E5A",
                  margin: "0 0 6px"
                }}
              >
                {filled} / 7권 완독
              </p>

              <p
                style={{
                  textAlign: "center",
                  fontSize: 12,
                  color: "#B4B2A9",
                  margin: "0 0 1.25rem"
                }}
              >
                지금까지 쌓아온 별빛 {totalStars}개
                {cycleCount > 0 ? ` · ${cycleCount}번째 뽑기 완료` : ""}
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginBottom: "1rem"
                }}
              >
                {books.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      background: "#FAF8F2",
                      border: "0.5px solid #E5E2D8",
                      borderRadius: 10
                    }}
                  >
                    <span style={{ fontSize: 18 }}>📖</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          margin: 0,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {b.title}
                      </p>
                      <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>
                        감상평 {b.review.length}자
                      </p>
                    </div>
                    <span style={{ fontSize: 16, color: "#3B6D11" }}>✓</span>
                  </div>
                ))}
              </div>

              {filled < 7 ? (
                <button
                  onClick={openAdd}
                  style={{
                    width: "100%",
                    minHeight: 44,
                    borderRadius: 10,
                    border: "0.5px solid #B4B2A9",
                    background: "transparent",
                    fontSize: 14,
                    fontWeight: 500
                  }}
                >
                  + 읽은 책 추가하기
                </button>
              ) : (
                <button
                  onClick={openDraw}
                  style={{
                    width: "100%",
                    minHeight: 44,
                    borderRadius: 10,
                    border: "none",
                    background: "#2C2C2A",
                    color: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: 500
                  }}
                >
                  🎁 뽑기 하러 가기!
                </button>
              )}
            </>
          )}
        </div>

        {loaded && (
          <button
            onClick={() => setView("library")}
            style={{
              width: "100%",
              minHeight: 44,
              marginTop: 12,
              borderRadius: 10,
              border: "0.5px solid #E5E2D8",
              background: "#FFFFFF",
              fontSize: 14,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6
            }}
          >
            📚 내 서재 보기 ({totalStars}권)
          </button>
        )}

        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#B4B2A9",
            marginTop: 12
          }}
        >
          기록은 이 휴대폰에만 저장돼요.
        </p>
      </div>

      {view === "library" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#FAF8F2",
            zIndex: 20,
            overflowY: "auto"
          }}
        >
          <div
            style={{
              maxWidth: 420,
              margin: "0 auto",
              padding: "1.5rem 1rem 3rem"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: "1.25rem"
              }}
            >
              <button
                onClick={() => {
                  setView("home");
                  setExpandedId(null);
                }}
                aria-label="뒤로가기"
                style={{
                  minWidth: 40,
                  minHeight: 40,
                  borderRadius: 10,
                  border: "0.5px solid #E5E2D8",
                  background: "#FFFFFF",
                  fontSize: 16
                }}
              >
                ←
              </button>
              <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>
                온이의 서재
              </h2>
            </div>

            <div
              style={{
                background: "#FFFFFF",
                border: "0.5px solid #E5E2D8",
                borderRadius: 16,
                padding: "1.1rem",
                marginBottom: "1.25rem",
                textAlign: "center"
              }}
            >
              <p style={{ fontSize: 13, color: "#888780", margin: "0 0 4px" }}>
                지금까지 빛난 별
              </p>
              <p style={{ fontSize: 30, fontWeight: 500, margin: 0, color: "#854F0B" }}>
                ★ {totalStars}
              </p>
              <p style={{ fontSize: 12, color: "#B4B2A9", margin: "6px 0 0" }}>
                완독한 책 {totalStars}권 · 뽑기 완료 {cycleCount}번
              </p>
            </div>

            {archive.length === 0 ? (
              <p
                style={{
                  textAlign: "center",
                  fontSize: 13,
                  color: "#B4B2A9",
                  padding: "2rem 0"
                }}
              >
                아직 서재에 담긴 책이 없어요.
                <br />
                책을 다 읽고 감상평을 쓰면 이곳에 쌓여요.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {archive.map((b) => {
                  const isOpen = expandedId === b.id;
                  return (
                    <div
                      key={b.id}
                      style={{
                        background: "#FFFFFF",
                        border: "0.5px solid #E5E2D8",
                        borderRadius: 14,
                        overflow: "hidden"
                      }}
                    >
                      <button
                        onClick={() => setExpandedId(isOpen ? null : b.id)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "0.9rem 1rem",
                          background: "transparent",
                          border: "none",
                          textAlign: "left"
                        }}
                      >
                        <span style={{ fontSize: 22, color: "#EF9F27" }}>★</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: 15,
                              fontWeight: 500,
                              margin: 0,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}
                          >
                            {b.title}
                          </p>
                          <p style={{ fontSize: 12, color: "#B4B2A9", margin: "2px 0 0" }}>
                            {formatDate(b.completedAt)} 완독 · {b.review.length}자
                          </p>
                        </div>
                        <span style={{ fontSize: 13, color: "#B4B2A9" }}>
                          {isOpen ? "접기" : "펼치기"}
                        </span>
                      </button>
                      {isOpen && (
                        <div
                          style={{
                            padding: "0 1rem 1.1rem",
                            borderTop: "0.5px solid #F1EFE8"
                          }}
                        >
                          <p
                            style={{
                              fontFamily: "Georgia, 'Noto Serif KR', serif",
                              fontSize: 14,
                              lineHeight: 1.8,
                              color: "#2C2C2A",
                              margin: "1rem 0 0",
                              whiteSpace: "pre-wrap"
                            }}
                          >
                            {b.review}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {drawHistory.length > 0 && (
              <div style={{ marginTop: "1.75rem" }}>
                <p
                  style={{
                    fontSize: 13,
                    color: "#888780",
                    margin: "0 0 8px",
                    fontWeight: 500
                  }}
                >
                  지난 뽑기 기록
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {drawHistory.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        background: "#FFFFFF",
                        border: "0.5px solid #F1EFE8",
                        borderRadius: 10,
                        fontSize: 13
                      }}
                    >
                      <span>{d.icon}</span>
                      <span style={{ flex: 1 }}>{d.prize}</span>
                      <span style={{ color: "#B4B2A9", fontSize: 12 }}>
                        {formatDate(d.at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {modal === "add" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 10
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 16,
              padding: "1.25rem",
              width: "100%",
              maxWidth: 360,
              maxHeight: "85vh",
              overflowY: "auto"
            }}
          >
            <h2 style={{ fontSize: 16, margin: "0 0 1rem", fontWeight: 500 }}>
              읽은 책 기록하기
            </h2>

            <label
              style={{
                fontSize: 13,
                color: "#5F5E5A",
                display: "block",
                marginBottom: 4
              }}
            >
              책 제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="책 제목을 입력하세요"
              style={{
                width: "100%",
                marginBottom: "1rem",
                boxSizing: "border-box",
                minHeight: 40,
                borderRadius: 8,
                border: "0.5px solid #B4B2A9",
                padding: "0 10px",
                fontSize: 14
              }}
            />

            <label
              style={{
                fontSize: 13,
                color: "#5F5E5A",
                display: "block",
                marginBottom: 4
              }}
            >
              감상평 (500자 이상, 직접 쓴 글)
            </label>
            <textarea
              ref={textareaRef}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="책을 읽고 느낀 점을 자유롭게 써보세요"
              rows={8}
              style={{
                width: "100%",
                resize: "vertical",
                borderRadius: 8,
                border: "0.5px solid #B4B2A9",
                padding: "8px 10px",
                fontSize: 14,
                boxSizing: "border-box"
              }}
            />
            <p
              style={{
                fontSize: 12,
                color: charLen >= REQUIRED ? "#3B6D11" : "#888780",
                margin: "4px 0 1rem",
                textAlign: "right"
              }}
            >
              {charLen} / 500자
            </p>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={closeModal}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 10,
                  border: "0.5px solid #B4B2A9",
                  background: "transparent",
                  fontSize: 14
                }}
              >
                취소
              </button>
              <button
                onClick={submitReview}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 10,
                  border: "none",
                  background: "#2C2C2A",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                기록 완료
              </button>
            </div>
            {formError && (
              <p
                style={{
                  fontSize: 12,
                  color: "#A32D2D",
                  margin: "8px 0 0"
                }}
              >
                {formError}
              </p>
            )}
          </div>
        </div>
      )}

      {modal === "warn" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 10
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 16,
              padding: "1.75rem 1.5rem",
              width: "100%",
              maxWidth: 340,
              textAlign: "center"
            }}
          >
            <span style={{ fontSize: 40 }}>⚠️</span>
            <p style={{ fontSize: 15, fontWeight: 500, margin: "12px 0 4px" }}>
              감상평을 다시 써주세요
            </p>
            <p style={{ fontSize: 13, color: "#5F5E5A", margin: "0 0 1rem" }}>
              {warnReason}
            </p>
            <p style={{ fontSize: 13, color: "#888780", margin: "0 0 1.25rem" }}>
              지금 사이클의 별이 모두 초기화됐어요. 서재에 이미 담긴 책은 그대로 남아 있어요.
            </p>
            <button
              onClick={closeModal}
              style={{
                width: "100%",
                minHeight: 44,
                borderRadius: 10,
                border: "0.5px solid #B4B2A9",
                background: "transparent",
                fontSize: 14
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {modal === "draw" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 10
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 16,
              padding: "2rem 1.5rem",
              width: "100%",
              maxWidth: 320,
              textAlign: "center"
            }}
          >
            <p style={{ fontSize: 14, color: "#5F5E5A", margin: "0 0 1rem" }}>
              일곱 권을 모두 읽었어요!
            </p>
            <div style={{ margin: "1.5rem 0" }}>
              <span style={{ fontSize: 56 }}>
                {prizeResult ? prizeResult.icon : "🎁"}
              </span>
              {prizeResult && (
                <>
                  <p style={{ fontSize: 20, fontWeight: 500, margin: "12px 0 0" }}>
                    {prizeResult.name}
                  </p>
                  <p style={{ fontSize: 13, color: "#888780", margin: "4px 0 0" }}>
                    {prizeResult.name === "꽝"
                      ? "다음 일곱 권을 기약해요"
                      : "당첨을 축하해요"}
                  </p>
                </>
              )}
            </div>
            {!prizeResult ? (
              <button
                onClick={reveal}
                style={{
                  width: "100%",
                  minHeight: 44,
                  borderRadius: 10,
                  border: "none",
                  background: "#2C2C2A",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                뽑기!
              </button>
            ) : (
              <button
                onClick={finishCycle}
                style={{
                  width: "100%",
                  minHeight: 44,
                  borderRadius: 10,
                  border: "0.5px solid #B4B2A9",
                  background: "transparent",
                  fontSize: 14
                }}
              >
                다음 일곱 권 시작하기
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
