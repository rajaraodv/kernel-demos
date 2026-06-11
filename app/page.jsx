const DEMOS = [
  {
    emoji: "🛍️",
    title: "Agent Commerce (Kernel × Stripe)",
    href: "/store",
    blurb:
      "Press one button and an AI agent spins up a real cloud browser, finds the product, and pays for it with Stripe — you watch it live, then the charge shows up in your Stripe Dashboard. The web's two halves for agents: browse (Kernel) + pay (Stripe).",
    tags: ["Kernel browsers", "Stripe Checkout", "Agentic commerce"],
  },
  {
    emoji: "🧪",
    title: "Agent Run Observability",
    href: "/demos/agent-observability",
    blurb:
      "Runs a suite of browser QA checks on live Kernel browsers, records an MP4 of every run, and shows pass/fail with the replay, step timeline, and error log — so you can see at a glance whether the agent did its job, and watch exactly why it didn't.",
    tags: ["Kernel browsers", "Playwright", "MP4 replay", "Observability"],
  },
  {
    emoji: "📊",
    title: "Marketing Teardown",
    href: "/teardown",
    blurb:
      "A presentation-style teardown of Kernel's developer journey, benchmarked against Stripe (DX gold standard) and Steel — what's working, what's missing, and the highest-leverage fixes.",
    tags: ["Strategy", "Developer experience", "Positioning"],
  },
];

export default function Home() {
  return (
    <>
      <div className="topbar">
        <div className="shell" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0", width: "100%" }}>
          <div className="mark">K</div>
          <div className="crumb"><b>Kernel Demos</b></div>
          <div className="right">
            built on <a href="https://www.kernel.sh" target="_blank" rel="noreferrer">kernel.sh</a>
          </div>
        </div>
      </div>

      <div className="shell">
        <div className="hero">
          <div className="ico">🟣</div>
          <h1>Kernel Demos</h1>
          <p>
            A small, growing collection of working demos built on Kernel&apos;s browser
            infrastructure for AI agents. Each one runs against real cloud browsers.
          </p>
        </div>

        <div className="seclabel">Demos</div>
        <div className="grid">
          {DEMOS.map((d) => (
            <a className="card" key={d.title} href={d.href}>
              <div className="emoji">{d.emoji}</div>
              <h3>{d.title}</h3>
              <p>{d.blurb}</p>
              <div className="tags">
                {d.tags.map((t) => (
                  <span className="tag" key={t}>{t}</span>
                ))}
              </div>
              <div className="go">Open demo <span className="ar">→</span></div>
            </a>
          ))}

          <div className="card soon">
            <div className="emoji">✨</div>
            <h3>More coming</h3>
            <p>Additional Kernel-powered demos will land here.</p>
          </div>
        </div>

        <div className="foot">
          <b>How it works:</b> demos render as static dashboards served by this Next.js app.
          The data + replays are generated locally by a runner that drives live Kernel
          browsers, then committed — so the cloud site always shows real recorded runs.
        </div>
      </div>
    </>
  );
}
