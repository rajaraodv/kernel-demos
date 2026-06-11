"use client";
import { useEffect, useRef, useState } from "react";

const PRODUCT = {
  name: "Designer Leather Handbag",
  amount: 24900,
  image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80",
};

export default function Store() {
  const [phase, setPhase] = useState("idle"); // idle | running | done | error
  const [events, setEvents] = useState([]);
  const [liveView, setLiveView] = useState(null);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  async function start(mode = "success") {
    setPhase("running"); setEvents([]); setLiveView(null); setCheckoutUrl(null); setResult(null); setError(null);
    const res = await fetch("/api/agent-buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product: PRODUCT, mode }),
    });
    const { runId } = await res.json();

    timer.current = setInterval(async () => {
      const j = await fetch(`/api/agent-buy/status?runId=${runId}`).then((r) => r.json());
      if (j.events) {
        setEvents(j.events);
        const lv = j.events.find((e) => e.liveViewUrl); if (lv) setLiveView(lv.liveViewUrl);
        const co = j.events.find((e) => e.checkoutUrl); if (co) setCheckoutUrl(co.checkoutUrl);
      }
      if (j.done) {
        clearInterval(timer.current);
        if (j.error) { setError(j.error); setPhase("error"); }
        else { setResult(j.result); setPhase("done"); }
      }
    }, 800);
  }

  const price = `$${(PRODUCT.amount / 100).toFixed(2)}`;

  return (
    <div className="wrap">
      <div className="bar">
        <div className="logo">▲ LUXE<span>.market</span></div>
        <div className="badge">Kernel × Stripe · agent checkout</div>
      </div>

      <div className="grid">
        {/* ───────── left: compact product + controls ───────── */}
        <aside className="side">
          <div className="card mini">
            <div className="thumb"><img src={PRODUCT.image} alt={PRODUCT.name} /></div>
            <div className="eyebrow">Full-grain leather</div>
            <div className="name">{PRODUCT.name}</div>
            <div className="price">{price}</div>
            {phase !== "running" && (
              <div className="bubble">👋 Click here to start!<span className="tail" /></div>
            )}
            <button className={`buy ${phase !== "running" ? "pulse" : ""}`} onClick={() => start("success")} disabled={phase === "running"}>
              {phase === "running" ? "Agent is shopping…" : "🤖 Buy it for me"}
            </button>
            <button className="buy alt" onClick={() => start("decline")} disabled={phase === "running"}>
              💳 Try a card that gets declined
            </button>
            <div className="hint">An AI agent opens a real cloud browser and pays with Stripe.</div>
          </div>

          {result?.paid && (
            <div className="card success">
              <div className="check">✓</div>
              <div className="sbody">
                <b>Paid {`$${(result.amount / 100).toFixed(2)}`}</b>
                <div className="pi">{result.paymentIntentId}</div>
                <a href={result.dashboardUrl} target="_blank" rel="noreferrer">View in Stripe Dashboard ↗</a>
              </div>
            </div>
          )}
          {result?.declined && (
            <div className="card declined">
              <div className="xmark">✕</div>
              <div className="sbody">
                <b>Payment declined</b>
                <div className="reason-tx">{result.reason}</div>
                {result.dashboardUrl && <a href={result.dashboardUrl} target="_blank" rel="noreferrer">See the failed attempt in Stripe ↗</a>}
              </div>
            </div>
          )}
          {error && <div className="card err">✗ {error}</div>}

          {checkoutUrl && (
            <a className="card colink" href={checkoutUrl} target="_blank" rel="noreferrer">
              🔗 Open the Stripe page the agent used ↗
            </a>
          )}

          {phase !== "idle" && (
            <div className="card timeline">
              {events.map((e, i) => (
                <div className="tl" key={i}>
                  <span className="t">{(e.t / 1000).toFixed(1)}s</span>
                  <span className="m">{e.msg}</span>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ───────── right: big live agent preview ───────── */}
        <main className="stage">
          {phase === "idle" && (
            <div className="ghost">
              <div className="ghost-ic">👀</div>
              <div className="ghost-tx">The agent&apos;s live cloud browser appears here.</div>
              <div className="ghost-sub">👈 Click <b>“Buy it for me”</b> on the left to start.</div>
            </div>
          )}
          {phase === "running" && (
            liveView
              ? <iframe title="agent" src={liveView} allow="autoplay" />
              : <div className="ghost"><div className="spinner" /><div className="ghost-tx">Spinning up cloud browser…</div></div>
          )}
          {(phase === "done" || phase === "error") && (
            <div className="ghost done">
              <div className="done-ic">{result?.paid ? "✅" : result?.declined ? "❌" : "⚠️"}</div>
              <div className="ghost-tx">
                {result?.paid
                  ? `The agent paid $${(result.amount / 100).toFixed(2)} via Stripe`
                  : result?.declined
                    ? "The card was declined"
                    : "The run didn’t finish"}
              </div>
              <div className="ghost-sub">
                {result?.paid
                  ? "The cloud browser was shut down automatically."
                  : result?.declined
                    ? result.reason
                    : (error || "")}
              </div>
              <button className="again" onClick={() => start("success")}>🔄 Run the demo again</button>
            </div>
          )}
        </main>
      </div>

      {/* ───────── short dev guide ───────── */}
      <section className="devguide">
        <h2>For developers: how an e-commerce team uses Kernel × Stripe</h2>
        <p className="lede">
          Already on Stripe? Give your app — or an AI agent — a real cloud browser to check out,
          QA your funnel, or monitor prices. You provision and bill Kernel right through Stripe.
        </p>

        <div className="agentflow">
          <div className="flow">🧠 Your agent calls a tool&nbsp;→&nbsp;🌐 Kernel opens a browser&nbsp;→&nbsp;💳 it pays on Stripe</div>
          <pre>{`// 1. expose a tool to your AI agent
{ name: "buy_product", input_schema: { url: "string" } }

// 2. when the agent calls it, run the Kernel flow
async function buy_product({ url }) {
  const b = await kernel.browsers.create({ startUrl: url });
  // → drive checkout + pay on Stripe (steps below)
}`}</pre>
        </div>

        <div className="steps">
          <div className="step"><span className="n">1</span><div>
            <b>Provision through Stripe</b>
            <p>One command links Kernel to your Stripe account and returns a project-scoped API key — usage billed on your Stripe invoice.</p>
            <pre>stripe projects add kernel/plan:hobbyist</pre>
            <a href="https://www.kernel.sh/docs/integrations/stripe-projects" target="_blank" rel="noreferrer">Stripe Projects integration ↗</a>
          </div></div>

          <div className="step"><span className="n">2</span><div>
            <b>Launch a cloud browser</b>
            <p>Spin up a sandboxed Chromium in ~300ms and get a CDP URL to drive it.</p>
            <pre>{`npm i @onkernel/sdk
const kernel = new Kernel();
const b = await kernel.browsers.create();`}</pre>
            <a href="https://www.kernel.sh/docs/quickstart" target="_blank" rel="noreferrer">Quickstart ↗</a>
          </div></div>

          <div className="step"><span className="n">3</span><div>
            <b>Drive it like a user</b>
            <p>Connect Playwright or Puppeteer over CDP — navigate, fill forms, and pay on Stripe Checkout (exactly what this demo does).</p>
            <pre>{`const browser =
  await chromium.connectOverCDP(b.cdp_ws_url);`}</pre>
            <a href="https://www.kernel.sh/docs" target="_blank" rel="noreferrer">Docs ↗</a>
          </div></div>

          <div className="step"><span className="n">4</span><div>
            <b>Watch &amp; debug</b>
            <p>Live-view the session and pull an MP4 replay, so you can see whether the agent did its job.</p>
            <a href="https://www.kernel.sh/docs/browsers/replays" target="_blank" rel="noreferrer">Live view &amp; replays ↗</a>
          </div></div>
        </div>

        <div className="uses">
          <b>Where an e-commerce team uses this:</b> agentic shopping assistants · automated checkout QA ·
          price &amp; inventory monitoring · support workflows that act on the web for you.
        </div>

        <div className="links">
          <a href="https://www.kernel.sh" target="_blank" rel="noreferrer">kernel.sh</a>
          <a href="https://www.kernel.sh/docs" target="_blank" rel="noreferrer">Docs</a>
          <a href="https://www.kernel.sh/docs/integrations/stripe-projects" target="_blank" rel="noreferrer">Stripe integration</a>
          <a href="https://www.kernel.sh/pricing" target="_blank" rel="noreferrer">Pricing</a>
        </div>
      </section>

      <style jsx>{`
        .wrap{max-width:1440px;margin:0 auto;padding:0 24px 40px;color:#37352f}
        .bar{display:flex;align-items:center;justify-content:space-between;padding:16px 0;border-bottom:1px solid #ebeae8}
        .logo{font-weight:800;letter-spacing:-.02em;font-size:18px}
        .logo span{color:#9b9a97;font-weight:600}
        .badge{font-size:12px;color:#635bff;background:#f1f0ff;border:1px solid #e0ddff;border-radius:999px;padding:5px 11px;font-weight:600}

        .grid{display:grid;grid-template-columns:270px 1fr;gap:20px;margin-top:20px}
        .side{display:flex;flex-direction:column;gap:14px;min-width:0}
        .card{background:#fff;border:1px solid #e3e2df;border-radius:14px}

        .mini{padding:14px}
        .thumb{aspect-ratio:4/3;border-radius:10px;overflow:hidden;background:#f0eee9}
        .thumb img{width:100%;height:100%;object-fit:cover;display:block}
        .eyebrow{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#9b9a97;font-weight:600;margin-top:12px}
        .name{font-size:16px;font-weight:700;letter-spacing:-.01em;margin-top:3px;line-height:1.25}
        .price{font-size:20px;font-weight:800;color:#111;margin-top:4px}
        .buy{width:100%;margin-top:12px;padding:12px 14px;border:0;border-radius:10px;background:#635bff;color:#fff;font-size:14.5px;font-weight:650;cursor:pointer;transition:background .12s,transform .05s}
        .buy:hover{background:#5249f0}
        .buy:active{transform:translateY(1px)}
        .buy:disabled{background:#b7b3f5;cursor:default}
        .buy.alt{margin-top:9px;background:#fff;color:#c0473f;border:1px solid #f0d3d1;font-weight:650;font-size:13px}
        .buy.alt:hover{background:#fbecec}
        .buy.alt:disabled{opacity:.5;background:#fff;color:#d99}
        .bubble{position:relative;margin:16px 4px 18px;background:#ffd43b;color:#3a2f00;font-size:15.5px;font-weight:800;text-align:center;padding:12px 14px;border-radius:13px;box-shadow:0 8px 22px rgba(250,176,5,.45);animation:bob 1.1s ease-in-out infinite}
        .bubble .tail{position:absolute;left:50%;bottom:-6px;transform:translateX(-50%) rotate(45deg);width:14px;height:14px;background:#ffd43b;border-radius:3px}
        @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}}
        .buy.pulse{animation:pulse 1.7s ease-in-out infinite}
        @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(99,91,255,.5)}70%{box-shadow:0 0 0 12px rgba(99,91,255,0)}100%{box-shadow:0 0 0 0 rgba(99,91,255,0)}}
        .hint{font-size:12px;color:#9b9a97;text-align:center;margin-top:9px;line-height:1.45}

        .success{display:flex;gap:11px;padding:13px 14px;background:#edf3ee;border-color:#cfe4d6}
        .success .check{width:26px;height:26px;flex:none;border-radius:50%;background:#3f7e5e;color:#fff;display:grid;place-items:center;font-weight:800;font-size:14px}
        .sbody b{font-size:14.5px}
        .sbody .pi{font-family:ui-monospace,Menlo,monospace;font-size:10.5px;color:#787774;margin:3px 0;word-break:break-all}
        .sbody a{font-size:12.5px;color:#635bff;font-weight:600}
        .declined{display:flex;gap:11px;padding:13px 14px;background:#fbecec;border-color:#f0d3d1}
        .declined .xmark{width:26px;height:26px;flex:none;border-radius:50%;background:#c0473f;color:#fff;display:grid;place-items:center;font-weight:800;font-size:13px}
        .reason-tx{font-size:12.5px;color:#9a3b35;margin:3px 0}
        .declined a{font-size:12.5px;color:#635bff;font-weight:600}
        .err{padding:12px 14px;background:#fbecec;border-color:#f0d3d1;color:#9a3b35;font-size:13px}

        .colink{display:block;padding:12px 14px;font-size:13px;color:#635bff;font-weight:600;text-decoration:none}
        .colink:hover{background:#faf9ff}

        .timeline{padding:8px;max-height:340px;overflow:auto}
        .tl{display:grid;grid-template-columns:42px 1fr;gap:9px;padding:5px 7px;font-size:12.5px;border-radius:6px}
        .tl:hover{background:#f7f7f5}
        .tl .t{color:#9b9a97;font-variant-numeric:tabular-nums;font-size:11px;text-align:right;font-family:ui-monospace,Menlo,monospace}
        .tl .m{color:#37352f;line-height:1.4}

        .stage{background:#1c1c1a;border:1px solid #e3e2df;border-radius:16px;overflow:hidden;position:relative;height:calc(100vh - 130px);min-height:520px}
        .stage iframe{width:100%;height:100%;border:0;display:block}
        .ghost{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;color:#cfcfcd}
        .ghost-ic{font-size:46px}
        .ghost-tx{font-size:16px;font-weight:600}
        .ghost-sub{font-size:13.5px;color:#9b9a97}
        .ghost-sub b{color:#cfcfcd}
        .done-ic{font-size:58px}
        .again{margin-top:14px;padding:12px 20px;border:0;border-radius:11px;background:#635bff;color:#fff;font-size:14.5px;font-weight:700;cursor:pointer;transition:background .12s,transform .05s}
        .again:hover{background:#5249f0}
        .again:active{transform:translateY(1px)}
        .spinner{width:34px;height:34px;border:3px solid #3a3a38;border-top-color:#9b9a97;border-radius:50%;animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}

        .devguide{margin-top:30px;padding:26px 28px;background:#fff;border:1px solid #e3e2df;border-radius:16px}
        .devguide h2{font-size:19px;font-weight:700;letter-spacing:-.01em}
        .devguide .lede{color:#787774;font-size:13.5px;margin-top:7px;max-width:740px;line-height:1.55}
        .agentflow{margin-top:16px;background:#faf9ff;border:1px solid #e0ddff;border-radius:12px;padding:14px 16px}
        .agentflow .flow{font-size:13px;font-weight:700;color:#37352f;margin-bottom:10px}
        .agentflow pre{background:#1c1c1a;color:#e7e7e4;font-family:ui-monospace,Menlo,monospace;font-size:11.5px;padding:11px 13px;border-radius:8px;overflow:auto;line-height:1.55;white-space:pre-wrap;margin:0}
        .steps{display:grid;grid-template-columns:1fr 1fr;gap:18px 22px;margin-top:20px}
        .step{display:flex;gap:12px;min-width:0}
        .step .n{width:24px;height:24px;flex:none;border-radius:7px;background:#635bff;color:#fff;display:grid;place-items:center;font-weight:800;font-size:12px}
        .step b{font-size:14.5px}
        .step p{color:#787774;font-size:12.5px;margin:3px 0 8px;line-height:1.5}
        .step pre{background:#1c1c1a;color:#e7e7e4;font-family:ui-monospace,Menlo,monospace;font-size:11.5px;padding:10px 12px;border-radius:8px;overflow:auto;line-height:1.55;white-space:pre-wrap;margin:0}
        .step a{font-size:12px;color:#635bff;font-weight:600;display:inline-block;margin-top:8px}
        .uses{margin-top:18px;font-size:12.5px;color:#5a5a57;background:#f7f7f5;border:1px solid #ebeae8;border-radius:10px;padding:11px 14px;line-height:1.6}
        .uses b{color:#37352f}
        .links{display:flex;flex-wrap:wrap;gap:18px;margin-top:18px;padding-top:15px;border-top:1px solid #ebeae8}
        .links a{font-size:13px;color:#635bff;font-weight:600}

        @media(max-width:820px){
          .grid{grid-template-columns:1fr}
          .stage{height:60vh}
          .steps{grid-template-columns:1fr}
        }
      `}</style>
    </div>
  );
}
