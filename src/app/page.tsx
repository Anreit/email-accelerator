"use client";

import { useState, useEffect, useRef } from "react";

const LOADING_MESSAGES = [
  "Scanning website...",
  "Extracting brand colors...",
  "Finding their logo...",
  "Cataloging products...",
  "Analyzing typography...",
  "Studying their visual style...",
  "Generating email layouts...",
  "Writing compelling copy...",
  "Adding product images...",
  "Styling CTA buttons...",
  "Optimizing for mobile...",
  "Building table-based layouts...",
  "Inlining all CSS...",
  "Polishing the details...",
  "Almost there...",
];

type GeneratedEmail = {
  type: string;
  subject: string;
  html: string;
};

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(false);
  const [url, setUrl] = useState("");
  const [emailCount, setEmailCount] = useState(1);
  const [context, setContext] = useState("");
  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [emails, setEmails] = useState<GeneratedEmail[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const loadingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (loading) {
      setLoadingMsgIndex(0);
      loadingInterval.current = setInterval(() => {
        setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
    } else {
      if (loadingInterval.current) clearInterval(loadingInterval.current);
    }
    return () => {
      if (loadingInterval.current) clearInterval(loadingInterval.current);
    };
  }, [loading]);

  const handleLogin = async () => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const handleGenerate = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setEmails([]);

    try {
      // Step 1: Scrape
      const scrapeRes = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), password }),
      });
      if (!scrapeRes.ok) throw new Error("Failed to analyze website");
      const brandData = await scrapeRes.json();

      // Step 2: Generate (include before image if uploaded for reference)
      const generateRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandData,
          emailCount,
          context: context.trim(),
          beforeImage: beforeImage ? true : false,
          beforeImageContext: beforeImage
            ? "The user uploaded a screenshot of the client's current email. Generate templates that are a clear visual upgrade — better layout, better product presentation, better CTAs. Make the improvement obvious."
            : undefined,
          password,
        }),
      });
      if (!generateRes.ok) throw new Error("Failed to generate emails");
      const { emails: generated } = await generateRes.json();

      setEmails(generated);
      setActiveTab(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const downloadHtml = (email: GeneratedEmail) => {
    const blob = new Blob([email.html], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${email.type.toLowerCase().replace(/\s+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  const openInNewTab = (email: GeneratedEmail) => {
    const blob = new Blob([email.html], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
  };

  if (!authed) {
    return (
      <div className="gradient-bg min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div
            className="text-[11px] font-bold tracking-[2.5px] uppercase mb-8"
            style={{ fontFamily: "var(--font-heading)", color: "var(--blue)" }}
          >
            scandiweb &middot; Email Accelerator
          </div>
          <h1
            className="text-2xl font-extrabold mb-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Enter password
          </h1>
          <p className="text-sm mb-8" style={{ color: "var(--dark-gray)" }}>
            This tool is for internal use only.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glow-input w-full px-4 py-3.5 rounded-lg text-white text-sm font-medium outline-none transition-all mb-4 text-center"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${authError ? "var(--orange)" : "rgba(255,255,255,0.1)"}`,
              }}
              autoFocus
            />
            {authError && (
              <div className="text-xs mb-4" style={{ color: "var(--orange)" }}>
                Wrong password
              </div>
            )}
            <button
              type="submit"
              className="w-full py-3.5 rounded-lg text-sm font-bold cursor-pointer"
              style={{
                fontFamily: "var(--font-heading)",
                background: "var(--blue)",
                color: "white",
              }}
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-bg min-h-screen">
      {/* Header */}
      <header className="px-8 py-4 flex items-center justify-between border-b border-white/5">
        <div
          className="text-[11px] font-bold tracking-[2.5px] uppercase"
          style={{ fontFamily: "var(--font-heading)", color: "var(--blue)" }}
        >
          scandiweb &middot; Email Accelerator
        </div>
        <div className="text-xs" style={{ color: "var(--dark-gray)" }}>
          Internal tool
        </div>
      </header>

      {/* Hero + Form */}
      {emails.length === 0 && (
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div
              className="inline-block px-4 py-1.5 rounded-full text-[10px] font-bold tracking-[2px] uppercase mb-6"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--green)",
                background: "rgba(110,247,110,0.1)",
                border: "1px solid rgba(110,247,110,0.2)",
              }}
            >
              Instant email templates
            </div>
            <h1
              className="text-5xl font-extrabold leading-tight mb-4"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Drop a URL,{" "}
              <span style={{ color: "var(--green)" }}>get emails</span>
            </h1>
            <p className="text-base" style={{ color: "var(--dark-gray)" }}>
              Paste any website. We&apos;ll scrape their branding, products, and
              style — then generate production-ready HTML email templates in
              seconds.
            </p>
          </div>

          <div
            className="w-full max-w-xl rounded-2xl p-8"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* URL input */}
            <div className="mb-6">
              <label
                className="block text-xs font-semibold mb-2 tracking-wide uppercase"
                style={{ color: "var(--dark-gray)" }}
              >
                Company website
              </label>
              <input
                type="url"
                placeholder="https://www.example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="glow-input w-full px-4 py-3.5 rounded-lg text-white text-sm font-medium outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
            </div>

            {/* Email count */}
            <div className="mb-6">
              <label
                className="block text-xs font-semibold mb-3 tracking-wide uppercase"
                style={{ color: "var(--dark-gray)" }}
              >
                Number of emails
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => setEmailCount(n)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer"
                    style={{
                      fontFamily: "var(--font-heading)",
                      background:
                        emailCount === n
                          ? "var(--blue)"
                          : "rgba(255,255,255,0.05)",
                      color: emailCount === n ? "white" : "var(--dark-gray)",
                      border: `1px solid ${emailCount === n ? "var(--blue)" : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Context */}
            <div className="mb-8">
              <label
                className="block text-xs font-semibold mb-2 tracking-wide uppercase"
                style={{ color: "var(--dark-gray)" }}
              >
                Context{" "}
                <span className="normal-case tracking-normal font-normal">
                  (optional)
                </span>
              </label>
              <textarea
                placeholder="E.g. Focus on welcome + cart abandon flows, they sell premium skincare to women 25-45, want a luxurious feel..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
                className="glow-input w-full px-4 py-3 rounded-lg text-white text-sm outline-none transition-all resize-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
            </div>

            {/* Before screenshot upload */}
            <div className="mb-8">
              <label
                className="block text-xs font-semibold mb-2 tracking-wide uppercase"
                style={{ color: "var(--dark-gray)" }}
              >
                Current email screenshot{" "}
                <span className="normal-case tracking-normal font-normal">
                  (optional — for before/after comparison)
                </span>
              </label>
              <label
                className="flex items-center justify-center gap-3 w-full py-4 rounded-lg cursor-pointer transition-all"
                style={{
                  background: beforeImage ? "rgba(63,74,175,0.1)" : "rgba(255,255,255,0.05)",
                  border: `1px dashed ${beforeImage ? "var(--blue)" : "rgba(255,255,255,0.15)"}`,
                  color: beforeImage ? "var(--blue)" : "var(--dark-gray)",
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setBeforeImage(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {beforeImage ? (
                  <span className="text-sm font-semibold">✓ Screenshot uploaded — will show before/after</span>
                ) : (
                  <span className="text-sm">Drop or click to upload their current email</span>
                )}
              </label>
              {beforeImage && (
                <button
                  onClick={() => setBeforeImage(null)}
                  className="text-xs mt-2 cursor-pointer"
                  style={{ color: "var(--dark-gray)" }}
                >
                  Remove
                </button>
              )}
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !url.trim()}
              className={`w-full py-4 rounded-lg text-base font-bold transition-all cursor-pointer ${!loading && url.trim() ? "pulse-btn" : ""}`}
              style={{
                fontFamily: "var(--font-heading)",
                background:
                  loading || !url.trim()
                    ? "rgba(255,255,255,0.05)"
                    : "var(--green)",
                color:
                  loading || !url.trim() ? "var(--dark-gray)" : "var(--dark)",
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray="31.4 31.4"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span key={loadingMsgIndex} className="step-animate">
                    {LOADING_MESSAGES[loadingMsgIndex]}
                  </span>
                </span>
              ) : (
                "Generate Emails"
              )}
            </button>

            {error && (
              <div
                className="mt-4 p-3 rounded-lg text-sm text-center"
                style={{
                  background: "rgba(255,90,49,0.1)",
                  color: "var(--orange)",
                }}
              >
                {error}
              </div>
            )}
          </div>

        </main>
      )}

      {/* Results */}
      {emails.length > 0 && (
        <main className="flex-1 relative z-10">
          {/* Results header */}
          <div className="text-center py-10 px-6">
            <h2
              className="text-3xl font-extrabold mb-2"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <span style={{ color: "var(--green)" }}>{emails.length}</span>{" "}
              emails generated
            </h2>
            <p className="text-sm" style={{ color: "var(--dark-gray)" }}>
              Click each tab to preview. Download or open in a new tab.
            </p>
            <button
              onClick={() => {
                setEmails([]);
                setStep(null);
              }}
              className="mt-4 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
              style={{
                color: "var(--blue)",
                background: "rgba(63,74,175,0.1)",
              }}
            >
              &larr; Generate more
            </button>
          </div>

          {/* Tabs */}
          <div
            className="flex gap-0 justify-center border-b mx-8"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            {emails.map((email, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className="px-6 py-3 text-sm font-semibold transition-all relative cursor-pointer"
                style={{
                  fontFamily: "var(--font-heading)",
                  color:
                    activeTab === i ? "var(--green)" : "var(--dark-gray)",
                }}
              >
                {email.type}
                {activeTab === i && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: "var(--green)" }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Active email preview */}
          {emails[activeTab] && (
            <div className="flex flex-col items-center py-10 px-6">
              <div className="mb-6 text-center">
                <div
                  className="text-lg font-bold"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {emails[activeTab].type}
                </div>
                <div
                  className="text-xs mt-1"
                  style={{ color: "var(--dark-gray)" }}
                >
                  Subject: {emails[activeTab].subject}
                </div>
              </div>

              {/* Before / After comparison or just After */}
              <div className={`flex gap-8 items-start ${beforeImage ? "justify-center" : ""}`}>
                {/* Before phone (only if screenshot uploaded) */}
                {beforeImage && (
                  <div className="flex flex-col items-center">
                    <div
                      className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-[1.5px] uppercase mb-4"
                      style={{ background: "rgba(255,90,49,0.1)", color: "var(--orange)" }}
                    >
                      Current
                    </div>
                    <div className="phone-mockup">
                      <div className="phone-screen">
                        <div className="phone-status-bar">9:41</div>
                        <div className="phone-scroll">
                          <img src={beforeImage} alt="Current email" style={{ width: "100%", display: "block" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* After phone (generated email) */}
                <div className="flex flex-col items-center">
                  {beforeImage && (
                    <div
                      className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-[1.5px] uppercase mb-4"
                      style={{ background: "rgba(63,74,175,0.1)", color: "var(--blue)" }}
                    >
                      Proposed
                    </div>
                  )}
                  <div className="phone-mockup">
                    <div className="phone-screen">
                      <div className="phone-status-bar">9:41</div>
                      <div className="phone-scroll">
                        <iframe
                          srcDoc={emails[activeTab].html}
                          style={{ height: "2400px" }}
                          title={emails[activeTab].type}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => openInNewTab(emails[activeTab])}
                  className="px-6 py-3 rounded-lg text-sm font-bold transition-all cursor-pointer"
                  style={{
                    fontFamily: "var(--font-heading)",
                    background: "var(--blue)",
                    color: "white",
                  }}
                >
                  Open full email ↗
                </button>
                <button
                  onClick={() => downloadHtml(emails[activeTab])}
                  className="px-6 py-3 rounded-lg text-sm font-bold transition-all cursor-pointer"
                  style={{
                    fontFamily: "var(--font-heading)",
                    background: "rgba(255,255,255,0.05)",
                    color: "var(--dark-gray)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  Download HTML
                </button>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
