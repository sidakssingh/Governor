"use client";

import { AnimatePresence, motion, useInView, useScroll, useTransform } from "framer-motion";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type NavLink = {
  label: string;
  href: string;
};

type CodeTab = "typescript" | "python";

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

const navLinks: NavLink[] = [
  { label: "Product", href: "#product" },
  { label: "For builders", href: "#builders" },
  { label: "Security", href: "#security" },
  { label: "Use cases", href: "#use-cases" },
  { label: "Docs", href: "#builders" },
];

const whatCards = [
  {
    title: "Parent",
    body: "Fund wallets, define policies, choose rails. Governor treats you as the only source of authority.",
    bullet: "Per-agent budgets and vendor allowlists.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M4.5 20c.8-3.6 3.8-5.6 7.5-5.6S18.7 16.4 19.5 20" />
      </svg>
    ),
  },
  {
    title: "Agent",
    body: "Agents hold API keys, not cards. They can ask to spend but cannot move their own limits.",
    bullet: "LLMs request; Governor decides.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="5" cy="12" r="2.2" />
        <circle cx="19" cy="6" r="2.2" />
        <circle cx="19" cy="18" r="2.2" />
        <path d="M7.2 11.4 16.6 6.7m-9.4 5.9 9.4 4.7" />
      </svg>
    ),
  },
  {
    title: "Governor",
    body: "A deterministic state machine and ledger that approves or denies every transaction before money moves.",
    bullet: "No LLM in the loop, only rules and data.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="7" />
        <path d="M12 8.5v3.7l2.8 1.5" />
      </svg>
    ),
  },
];

const howSteps = [
  "Agent calls POST /spend with amount, vendor, and a unique request ID.",
  "Governor locks the wallet, checks policy and limits, and computes a decision.",
  "If approved, Governor provisions a one-time card or wallet instruction on your chosen rail.",
  "Merchant gets paid; you get an audit log and a reconciled ledger entry.",
];

const timelineLabels = ["Request", "Evaluate", "Provision", "Settle"];

const enforceCards = [
  {
    title: "Policy engine",
    text: "Per-agent budgets, vendor and MCC allowlists, time windows, and approval thresholds in a structured policy model.",
  },
  {
    title: "Ledger and locks",
    text: "Postgres ledger with row-level locks and idempotency, so concurrent agents cannot double-spend.",
  },
  {
    title: "Sidecar proxy",
    text: "Agents browse through a proxy URL. Governor injects card details at checkout; no secrets leave your control.",
  },
  {
    title: "KYA and kill switch",
    text: "Know Your Agent by identity and behavior, with one-click freezes when anomalies fire.",
  },
];

const securityChecks = [
  "Hard-coded daily and per-transaction limits at the database layer.",
  "Idempotency keys on every spend call to block infinite purchase loops.",
  "Prompt-injection resistant: the LLM never approves its own transactions.",
  "Human-in-the-loop approvals for large, new, or unusual spends.",
  "Instant kill switch for any agent or entire organizations.",
];

const anomalyFlow = [
  "Agent suddenly attempts 12 purchases in 60 seconds.",
  "Governor flags an anomaly and flips the request to pending_approval.",
  "Owner denies, freezes agent, and no money leaves.",
];

const apiBullets = [
  "POST /agents - create agents and issue API keys.",
  "POST /policies - define budgets, vendors, and thresholds in JSON.",
  "POST /spend - request a spend and get approved, pending_approval, or denied with a clear code.",
  "Webhooks for approvals, anomalies, and settlements.",
];

const useCases = [
  {
    label: "SaaS",
    title: "Agentic SaaS copilots",
    text: "Let your product agent buy APIs, credits, and tools for customers without direct card access.",
  },
  {
    label: "Growth",
    title: "Growth and ad spend agents",
    text: "Keep agents from overspending on ads. Cap budgets per channel and require approvals for new experiments.",
  },
  {
    label: "Enterprise",
    title: "Internal AI coworkers",
    text: "Give internal agents controlled access to travel, software, and cloud budgets with full ledger and audit trails.",
  },
];

const codeSamples: Record<CodeTab, string> = {
  typescript: `import { Governor } from '@governor/sdk';

const client = new Governor({ apiKey: process.env.AGENT_KEY });

const res = await client.spend({
  requestId: '550e8400-e29b-41d4-a716-446655440000',
  amount: 2000, // cents
  currency: 'usd',
  vendor: 'openai.com',
  meta: { purpose: 'gpt-4 credits' },
});

switch (res.status) {
  case 'approved':
    // use res.card or res.proxySessionUrl depending on your config
    break;
  case 'pending_approval':
    // pause and wait for webhook / poll
    break;
  case 'denied':
    // surface res.reason to logs / UI
}`,
  python: `from governor import Governor

client = Governor(api_key=os.environ["AGENT_KEY"])

res = client.spend(
    request_id="550e8400-e29b-41d4-a716-446655440000",
    amount=2000,
    currency="usd",
    vendor="openai.com",
    meta={"purpose": "gpt-4 credits"},
)

if res.status == "approved":
    pass
elif res.status == "pending_approval":
    pass
else:
    print(res.reason)`,
};

type RevealSectionProps = {
  id?: string;
  className?: string;
  children: React.ReactNode;
};

function RevealSection({ id, className, children }: RevealSectionProps) {
  return (
    <motion.section
      id={id}
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: easeOut }}
    >
      {children}
    </motion.section>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-12 max-w-3xl">
      <h2 className="serif-title text-3xl leading-tight text-[var(--text-primary)] md:text-[2.45rem]">{title}</h2>
      <p className="mt-4 max-w-2xl text-base text-[var(--text-secondary)] md:text-lg">{subtitle}</p>
    </div>
  );
}

const HERO_TIMING = {
  request: 1500,
  evaluate: 1500,
  route: 2000,
  reset: 2000,
} as const;

const HERO_TOTAL_MS = HERO_TIMING.request + HERO_TIMING.evaluate + HERO_TIMING.route + HERO_TIMING.reset;
const AGENT_ORDER = [1, 2, 0] as const;

type HeroPoint = { x: number; y: number };
type HeroCurve = { start: HeroPoint; control: HeroPoint; end: HeroPoint };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const easeInOutQuad = (value: number) => {
  const t = clamp(value, 0, 1);
  if (t < 0.5) {
    return 2 * t * t;
  }
  return 1 - Math.pow(-2 * t + 2, 2) / 2;
};

const pulseAt = (time: number, start: number, duration: number) => {
  if (time < start || time > start + duration) {
    return 0;
  }
  const progress = (time - start) / duration;
  return progress < 0.5 ? progress * 2 : (1 - progress) * 2;
};

const pointOnCurve = (curve: HeroCurve, progress: number): HeroPoint => {
  const t = clamp(progress, 0, 1);
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * curve.start.x + 2 * oneMinusT * t * curve.control.x + t * t * curve.end.x,
    y: oneMinusT * oneMinusT * curve.start.y + 2 * oneMinusT * t * curve.control.y + t * t * curve.end.y,
  };
};

function HeroDiagram() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(wrapperRef, { amount: 0.45 });
  const [isHovering, setIsHovering] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const elapsedRef = useRef(0);
  const animationStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isInView) {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
      animationStartRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      if (animationStartRef.current === null) {
        animationStartRef.current = timestamp - elapsedRef.current;
      }

      elapsedRef.current = timestamp - animationStartRef.current;
      setElapsedMs(elapsedRef.current);
      rafRef.current = window.requestAnimationFrame(step);
    };

    rafRef.current = window.requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
      animationStartRef.current = null;
    };
  }, [isInView]);

  const agentCenters: HeroPoint[] = [
    { x: 84, y: 58 },
    { x: 210, y: 58 },
    { x: 336, y: 58 },
  ];

  const railCenters: HeroPoint[] = [
    { x: 131, y: 273 },
    { x: 293, y: 273 },
  ];

  const governorCenter = { x: 210, y: 169 };
  const agentCurves: HeroCurve[] = [
    { start: { x: 84, y: 74 }, control: { x: 132, y: 108 }, end: { x: 174, y: 128 } },
    { start: { x: 210, y: 74 }, control: { x: 210, y: 101 }, end: { x: 210, y: 128 } },
    { start: { x: 336, y: 74 }, control: { x: 288, y: 108 }, end: { x: 246, y: 128 } },
  ];
  const railCurves: HeroCurve[] = [
    { start: { x: 190, y: 210 }, control: { x: 170, y: 238 }, end: { x: 138, y: 258 } },
    { start: { x: 230, y: 210 }, control: { x: 250, y: 238 }, end: { x: 282, y: 258 } },
  ];
  const curveToPath = (curve: HeroCurve) => `M${curve.start.x} ${curve.start.y} Q${curve.control.x} ${curve.control.y} ${curve.end.x} ${curve.end.y}`;

  const absoluteMs = elapsedMs;
  const cycleIndex = Math.floor(absoluteMs / HERO_TOTAL_MS);
  const cycleMs = absoluteMs % HERO_TOTAL_MS;

  const requestEnd = HERO_TIMING.request;
  const evaluateEnd = requestEnd + HERO_TIMING.evaluate;
  const routeEnd = evaluateEnd + HERO_TIMING.route;

  const phase = cycleMs < requestEnd ? "request" : cycleMs < evaluateEnd ? "evaluate" : cycleMs < routeEnd ? "route" : "reset";

  const activeAgentIndex = AGENT_ORDER[cycleIndex % AGENT_ORDER.length];
  const activeRailIndex = cycleIndex % 2;

  const requestProgress = clamp(cycleMs / HERO_TIMING.request, 0, 1);
  const evaluateMs = clamp(cycleMs - requestEnd, 0, HERO_TIMING.evaluate);
  const routeMs = clamp(cycleMs - evaluateEnd, 0, HERO_TIMING.route);
  const resetMs = clamp(cycleMs - routeEnd, 0, HERO_TIMING.reset);
  const routeProgress = clamp(routeMs / HERO_TIMING.route, 0, 1);
  const resetProgress = clamp(resetMs / HERO_TIMING.reset, 0, 1);

  const dimFactor =
    phase === "reset"
      ? resetProgress < 0.5
        ? 1 - 0.34 * (resetProgress / 0.5)
        : 0.66 + 0.34 * ((resetProgress - 0.5) / 0.5)
      : 1;

  const activeAgentStrength = phase === "reset" ? 1 - easeInOutQuad(clamp(resetProgress * 1.2, 0, 1)) : 1;
  const governorGlow = (phase === "evaluate" ? 0.56 : phase === "route" ? 0.42 : 0.26) + (isHovering ? 0.12 : 0);

  const checkLabels = ["limits", "policy", "risk"];
  const checkOpacities = checkLabels.map((_, index) => pulseAt(evaluateMs, 700 + index * 220, 280));

  const postLabelOpacity =
    phase === "request"
      ? clamp((requestProgress - 0.12) / 0.42, 0, 1)
      : phase === "evaluate"
        ? clamp(1 - evaluateMs / 260, 0, 1)
        : 0;

  const postLabelPosition = pointOnCurve(agentCurves[activeAgentIndex], 0.47);
  const postLabelXOffset = activeAgentIndex === 2 ? 40 : activeAgentIndex === 0 ? -40 : 11;
  const postLabelYOffset = activeAgentIndex === 2 || activeAgentIndex === 0 ? -13 : -9;
  const postLabelAnchor = activeAgentIndex === 0 ? "end" : "start";

  const railLabelOpacity =
    phase === "route"
      ? clamp((routeProgress - 0.72) / 0.2, 0, 1)
      : phase === "reset"
        ? clamp(1 - resetProgress * 2.4, 0, 1)
        : 0;

  const railPulseProgress = phase === "route" ? clamp((routeProgress - 0.82) / 0.18, 0, 1) : 0;
  const packetDestination = railCenters[activeRailIndex];

  let packetVisible = false;
  let packetPoint = governorCenter;

  if (phase === "request") {
    packetVisible = true;
    packetPoint = pointOnCurve(agentCurves[activeAgentIndex], easeInOutQuad(requestProgress));
  } else if (phase === "evaluate") {
    packetVisible = true;
    packetPoint = governorCenter;
  } else if (phase === "route") {
    packetVisible = true;
    packetPoint = pointOnCurve(railCurves[activeRailIndex], easeInOutQuad(routeProgress));
  }

  return (
    <motion.div
      ref={wrapperRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: easeOut, delay: 0.25 }}
      className="relative mx-auto w-full max-w-[480px]"
    >
      <div
        className="hero-visual relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_20%,rgba(62,130,255,0.08),transparent_45%),radial-gradient(circle_at_72%_74%,rgba(242,185,102,0.05),transparent_40%)]" />

        <svg viewBox="0 0 420 320" className="relative z-[1] h-full w-full">
          <defs>
            <filter id="packetGlow" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {agentCurves.map((curve, index) => {
            const isActiveAgent = index === activeAgentIndex;
            let activeOpacity = 0.44;
            if (isActiveAgent) {
              if (phase === "request") {
                activeOpacity = 0.58 + 0.38 * easeInOutQuad(requestProgress);
              } else if (phase === "evaluate" || phase === "route") {
                activeOpacity = 0.95;
              } else {
                activeOpacity = 0.92 - 0.5 * easeInOutQuad(resetProgress);
              }
            }
            const pathOpacity = activeOpacity * dimFactor;
            const nodePoint = pointOnCurve(curve, 0.56);

            return (
              <g key={curveToPath(curve)}>
                <path
                  d={curveToPath(curve)}
                  fill="none"
                  stroke="#3E82FF"
                  strokeWidth="1.45"
                  strokeLinecap="round"
                  opacity={pathOpacity}
                />
                <circle cx={nodePoint.x} cy={nodePoint.y} r="2" fill="#72A8FF" opacity={0.35 * dimFactor} />
              </g>
            );
          })}

          {railCurves.map((curve, index) => {
            const isActiveRail = index === activeRailIndex;
            let activeOpacity = 0.36;
            if (isActiveRail) {
              if (phase === "route") {
                activeOpacity = 0.48 + 0.5 * easeInOutQuad(routeProgress);
              } else if (phase === "reset") {
                activeOpacity = 0.78 - 0.45 * easeInOutQuad(resetProgress);
              } else {
                activeOpacity = 0.45;
              }
            }

            return (
              <path
                key={curveToPath(curve)}
                d={curveToPath(curve)}
                fill="none"
                stroke="#3E82FF"
                strokeWidth="1.45"
                strokeLinecap="round"
                opacity={activeOpacity * dimFactor}
              />
            );
          })}

          {agentCenters.map((point, index) => {
            const isActiveAgent = index === activeAgentIndex;
            const highlightOpacity = isActiveAgent ? 0.28 * activeAgentStrength : 0;
            return (
              <g key={`agent-${index}`}>
                <text
                  x={point.x}
                  y={25}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#7C8190"
                  fontFamily="var(--font-ui)"
                  opacity={dimFactor}
                >
                  Agent
                </text>
                <rect
                  x={point.x - 28}
                  y={point.y - 14}
                  width="56"
                  height="28"
                  rx="14"
                  fill={isActiveAgent ? "#1A2233" : "#161A24"}
                  stroke={isActiveAgent ? "#3A517D" : "#2B3140"}
                  opacity={0.96 * dimFactor}
                />
                <rect
                  x={point.x - 28}
                  y={point.y - 14}
                  width="56"
                  height="28"
                  rx="14"
                  fill="#3E82FF"
                  opacity={highlightOpacity}
                />
                <text
                  x={point.x}
                  y={point.y + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#E4E9F3"
                  fontFamily="var(--font-ui)"
                  fontWeight="500"
                  opacity={dimFactor}
                >
                  {String.fromCharCode(65 + index)}
                </text>
              </g>
            );
          })}

          <rect
            x="124"
            y="128"
            width="172"
            height="82"
            rx="12"
            fill="#121722"
            stroke="#2C3242"
            opacity={dimFactor}
          />
          <rect
            x="124"
            y="128"
            width="172"
            height="82"
            rx="12"
            fill="#3E82FF"
            opacity={governorGlow * dimFactor}
          />
          <text
            x="210"
            y="170"
            textAnchor="middle"
            fontSize="14"
            fill="#F5F5F5"
            fontWeight="600"
            fontFamily="var(--font-ui)"
            opacity={dimFactor}
          >
            Governor
          </text>

          {[184, 210, 236].map((centerX, index) => {
            const label = checkLabels[index];
            const opacity = phase === "evaluate" ? 0.22 + 0.78 * checkOpacities[index] : 0.15;
            return (
              <g key={label} opacity={opacity * dimFactor}>
                <rect x={centerX - 1.5} y={178} width="3" height="11" rx="1.5" fill="#8EB8FF" />
                <text
                  x={centerX}
                  y={196}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#AAB8CF"
                  fontFamily="var(--font-ui)"
                >
                  {label}
                </text>
              </g>
            );
          })}

          <rect x="58" y="258" width="146" height="30" rx="15" fill="#161A24" stroke="#2B3140" opacity={dimFactor} />
          <text x="131" y="277" textAnchor="middle" fontSize="11" fill="#D8DCE4" fontFamily="var(--font-ui)" opacity={dimFactor}>
            Cards / Stripe Issuing
          </text>
          <rect x="220" y="258" width="146" height="30" rx="15" fill="#161A24" stroke="#2B3140" opacity={dimFactor} />
          <text x="293" y="277" textAnchor="middle" fontSize="11" fill="#D8DCE4" fontFamily="var(--font-ui)" opacity={dimFactor}>
            Wallets / USDC
          </text>

          <text
            x={postLabelPosition.x + postLabelXOffset}
            y={postLabelPosition.y + postLabelYOffset}
            textAnchor={postLabelAnchor}
            fontSize="9"
            fill="#8EB8FF"
            fontFamily="var(--font-ui)"
            opacity={postLabelOpacity}
          >
            POST /spend
          </text>

          <text
            x={packetDestination.x}
            y={302}
            textAnchor="middle"
            fontSize="9"
            fill="#A3C4FF"
            fontFamily="var(--font-ui)"
            opacity={railLabelOpacity}
          >
            {activeRailIndex === 0 ? "VCN issued" : "USDC transfer"}
          </text>

          {packetVisible && (
            <circle cx={packetPoint.x} cy={packetPoint.y} r="3.2" fill="#9CC2FF" filter="url(#packetGlow)" opacity={0.98} />
          )}

          {phase === "route" && railPulseProgress > 0 && (
            <>
              <circle
                cx={packetDestination.x}
                cy={packetDestination.y}
                r={5 + railPulseProgress * 8}
                fill="none"
                stroke="#8EB8FF"
                strokeWidth="1.2"
                opacity={0.65 * (1 - railPulseProgress)}
              />
              <circle
                cx={packetDestination.x}
                cy={packetDestination.y}
                r={2.2 + railPulseProgress * 1.4}
                fill="#8EB8FF"
                opacity={0.7 * (1 - railPulseProgress * 0.7)}
              />
            </>
          )}
        </svg>
      </div>
    </motion.div>
  );
}

function HeroSystem() {
  return (
    <HeroDiagram />
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [tab, setTab] = useState<CodeTab>("typescript");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const { scrollY, scrollYProgress } = useScroll();
  const parallax = useTransform(scrollYProgress, [0, 0.3], [0, 48]);

  useEffect(() => {
    const unsubscribe = scrollY.on("change", (value) => setNavScrolled(value > 80));
    return () => unsubscribe();
  }, [scrollY]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const activeCode = useMemo(() => codeSamples[tab], [tab]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(true);
  };

  return (
    <div className="page-shell">
      <motion.div style={{ y: parallax }} className="hero-grid" />

      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          navScrolled ? "border-b border-[var(--border)] bg-[rgba(5,6,8,0.9)] backdrop-blur-lg" : "bg-transparent"
        }`}
      >
        <div className="container-wide flex h-[76px] items-center justify-between gap-8">
          <a href="#top" className="block">
            <p className="serif-title text-[1.3rem] leading-none text-[var(--text-primary)]">Governor</p>
            <p className="mt-1 hidden whitespace-nowrap text-[0.66rem] italic tracking-[0.005em] text-[var(--text-secondary)] lg:block">
              [a mechanism that automatically regulates a system to keep it within safe bounds]
            </p>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="nav-link text-sm text-[var(--text-secondary)]">
                {link.label}
              </a>
            ))}
            <a href="#join" className="btn-primary text-sm">
              Join early access
            </a>
          </nav>

          <button
            className="hamburger md:hidden"
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              className="fixed right-0 top-0 z-[60] flex h-screen w-[84%] max-w-[360px] flex-col border-l border-[var(--border)] bg-[var(--panel)] p-7"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: easeOut }}
            >
              <div className="mb-12 flex items-center justify-between">
                <span className="serif-title text-xl text-[var(--text-primary)]">Governor</span>
                <button className="text-sm text-[var(--text-secondary)]" onClick={() => setMenuOpen(false)}>
                  Close
                </button>
              </div>
              <div className="space-y-6">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="block text-lg text-[var(--text-primary)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <a href="#join" className="btn-primary mt-auto text-center" onClick={() => setMenuOpen(false)}>
                Join early access
              </a>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main>
        <section id="top" className="relative flex min-h-screen items-center overflow-hidden pt-28">
          <div className="container-wide grid gap-14 pb-20 md:grid-cols-12 md:items-center">
            <motion.div
              className="md:col-span-6"
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: {
                  transition: {
                    staggerChildren: 0.1,
                  },
                },
              }}
            >
              <motion.p
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.5, ease: easeOut }}
                className="mb-4 text-[0.72rem] font-medium tracking-[0.18em] text-[var(--accent)]"
              >
                APPLIED AI FOR INTERNET MONEY
              </motion.p>
              <motion.h1
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.5, ease: easeOut }}
                className="serif-title max-w-[16ch] text-4xl leading-[1.02] text-[var(--text-primary)] sm:text-[3.2rem]"
              >
                Let your agents spend.
                <br />
                Keep them inside the bounds.
              </motion.h1>
              <motion.p
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.5, ease: easeOut }}
                className="mt-7 max-w-[62ch] text-base leading-relaxed text-[var(--text-secondary)]"
              >
                Governor is a deterministic policy engine that sits between your AI agents and real-world payments.
                Agents request spend; Governor enforces hard limits across card rails and wallets, with a clean audit
                trail for every decision.
              </motion.p>
              <motion.div
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.5, ease: easeOut }}
                className="mt-9 flex flex-wrap items-center gap-5"
              >
                <a href="#join" className="btn-primary">
                  Get early access
                </a>
                <a href="#how-it-works" className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <span>See how it works</span>
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M2.5 8h10m0 0L8.7 4.2M12.5 8l-3.8 3.8" />
                  </svg>
                </a>
              </motion.div>
            </motion.div>

            <div className="md:col-span-6">
              <HeroSystem />
            </div>
          </div>
        </section>

        <RevealSection id="product" className="section-alt border-y border-[var(--border)] py-24 md:py-28">
          <div className="container-wide">
            <SectionHeader
              title="A control layer for agentic spend."
              subtitle="Your agents see an API. You see hard limits and ledgers."
            />
            <motion.div
              className="grid gap-5 md:grid-cols-3"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={{
                hidden: {},
                show: {
                  transition: { staggerChildren: 0.08 },
                },
              }}
            >
              {whatCards.map((card) => (
                <motion.article
                  key={card.title}
                  variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.45, ease: easeOut }}
                  whileHover={{ y: -3 }}
                  className="surface-card h-full rounded-[10px] p-6"
                >
                  <div className="mb-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--accent)]">
                    {card.icon}
                  </div>
                  <h3 className="text-xl font-medium text-[var(--text-primary)]">{card.title}</h3>
                  <p className="mt-3 text-[0.96rem] leading-relaxed text-[var(--text-secondary)]">{card.body}</p>
                  <p className="mt-6 border-l border-[var(--accent)] pl-3 text-sm text-[#ced6e3]">{card.bullet}</p>
                </motion.article>
              ))}
            </motion.div>
          </div>
        </RevealSection>

        <RevealSection id="how-it-works" className="py-24 md:py-28">
          <div className="container-wide">
            <SectionHeader
              title="From agent intent to constrained spend."
              subtitle="One deterministic path for every transaction."
            />
            <div className="grid gap-10 md:grid-cols-2 md:gap-12">
              <motion.ol
                className="space-y-6"
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
              >
                {howSteps.map((step, index) => (
                  <motion.li
                    key={step}
                    variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.45, ease: easeOut }}
                    className="surface-card rounded-lg p-5"
                  >
                    <p className="mb-2 text-xs tracking-[0.14em] text-[var(--accent)]">STEP {index + 1}</p>
                    <p className="text-[0.98rem] leading-relaxed text-[var(--text-primary)]">{step}</p>
                  </motion.li>
                ))}
              </motion.ol>

              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
                className="surface-card relative rounded-lg p-6"
              >
                <div className="absolute left-9 top-11 bottom-11 w-px bg-[linear-gradient(to_bottom,rgba(62,130,255,0.75),rgba(62,130,255,0.1))]" />
                <div className="space-y-8">
                  {timelineLabels.map((label, index) => (
                    <motion.div
                      key={label}
                      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
                      transition={{ duration: 0.45, ease: easeOut }}
                      className="relative pl-14"
                    >
                      <motion.div
                        className="absolute left-[22px] top-[5px] h-[13px] w-[13px] rounded-full border border-[var(--accent)] bg-[#0d1220]"
                        animate={{ scale: [1, 1.18, 1] }}
                        transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, delay: index * 0.3 }}
                      />
                      <p className="text-sm tracking-[0.12em] text-[var(--text-secondary)]">{`0${index + 1}`}</p>
                      <p className="mt-1 text-lg text-[var(--text-primary)]">{label}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </RevealSection>

        <RevealSection className="py-24 md:py-28">
          <div className="container-wide">
            <SectionHeader
              title="Wrap the rails you already trust."
              subtitle="Start on Stripe. Extend to other cards and USDC without rewriting your policies."
            />
            <div className="grid gap-5 md:grid-cols-2">
              <motion.article whileHover={{ y: -3 }} className="surface-card rounded-lg p-6">
                <h3 className="mb-4 text-xl text-[var(--text-primary)]">Cards and Stripe Issuing.</h3>
                <ul className="space-y-3 text-[0.96rem] leading-relaxed text-[var(--text-secondary)]">
                  <li>Create single-use virtual cards with exact spend caps and MCC controls.</li>
                  <li>Use real-time authorizations so Governor approves each swipe before it posts.</li>
                  <li>Keep PAN and CVV inside Governor and the browser sidecar. Agents never see them.</li>
                </ul>
              </motion.article>

              <motion.article whileHover={{ y: -3 }} className="surface-card rounded-lg p-6">
                <h3 className="mb-4 text-xl text-[var(--text-primary)]">USDC and agent wallets.</h3>
                <ul className="space-y-3 text-[0.96rem] leading-relaxed text-[var(--text-secondary)]">
                  <li>Connect Coinbase Agentic Wallet and x402 for USDC-native agent payments.</li>
                  <li>Apply the same policies to on-chain and off-chain spend.</li>
                  <li>Ideal for agent-to-agent and machine-to-machine commerce.</li>
                </ul>
              </motion.article>
            </div>

            <div className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-5 py-4">
              <p className="text-center text-xs tracking-[0.13em] text-[var(--text-secondary)]">
                Agents <span className="mx-2 text-[var(--accent)]">-&gt;</span> Governor <span className="mx-2 text-[var(--accent)]">-&gt;</span>
                Rails <span className="mx-2 text-[var(--accent)]">-&gt;</span> Merchants
              </p>
            </div>
          </div>
        </RevealSection>

        <RevealSection className="border-y border-[var(--border)] bg-[rgba(17,18,24,0.6)] py-24 md:py-28">
          <div className="container-wide">
            <SectionHeader
              title="Deterministic guardrails, not vibes."
              subtitle="Every request gets a decision and a reason."
            />
            <motion.div
              className="grid gap-5 md:grid-cols-2"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
            >
              {enforceCards.map((card) => (
                <motion.article
                  key={card.title}
                  variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.42, ease: easeOut }}
                  whileHover={{ y: -3 }}
                  className="surface-card min-h-[190px] rounded-lg p-6"
                >
                  <h3 className="text-xl text-[var(--text-primary)]">{card.title}</h3>
                  <p className="mt-3 max-w-[54ch] text-[0.96rem] leading-relaxed text-[var(--text-secondary)]">{card.text}</p>
                </motion.article>
              ))}
            </motion.div>
          </div>
        </RevealSection>

        <RevealSection id="security" className="section-alt py-24 md:py-28">
          <div className="container-wide">
            <SectionHeader title="KYA: Know Your Agent." subtitle="Treat agents like coworkers with controlled authority." />
            <div className="grid gap-8 md:grid-cols-2">
              <ul className="space-y-3">
                {securityChecks.map((item) => (
                  <li key={item} className="surface-card rounded-lg px-4 py-3 text-[0.95rem] text-[var(--text-secondary)]">
                    {item}
                  </li>
                ))}
              </ul>

              <motion.div
                className="surface-card relative rounded-lg p-6"
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
              >
                <div className="absolute left-[22px] top-8 bottom-8 w-px bg-[var(--border)]" />
                <div className="space-y-5">
                  {anomalyFlow.map((item, index) => (
                    <motion.div
                      key={item}
                      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
                      transition={{ duration: 0.4, ease: easeOut }}
                      className="relative rounded-md border border-[var(--border)] bg-[rgba(15,16,22,0.9)] p-4 pl-8"
                    >
                      <span className="absolute left-[15px] top-[20px] h-2 w-2 rounded-full bg-[var(--accent)]" />
                      <p className="mb-1 text-[0.72rem] tracking-[0.12em] text-[var(--text-secondary)]">{`EVENT ${index + 1}`}</p>
                      <p className="text-sm leading-relaxed text-[var(--text-primary)]">{item}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </RevealSection>

        <RevealSection id="builders" className="py-24 md:py-28">
          <div className="container-wide">
            <SectionHeader
              title="Built for people wiring up agents."
              subtitle="Minimal surface area. Predictable results."
            />
            <div className="grid gap-7 md:grid-cols-2 md:gap-10">
              <div className="surface-card rounded-lg p-6">
                <h3 className="mb-4 text-xl text-[var(--text-primary)]">API overview</h3>
                <ul className="space-y-3 text-[0.96rem] text-[var(--text-secondary)]">
                  {apiBullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="surface-card rounded-lg p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 rounded-full border border-[var(--border)] p-1">
                    {(["typescript", "python"] as CodeTab[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTab(key)}
                        className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition-colors ${
                          tab === key
                            ? "bg-[var(--accent)] text-white"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs tracking-[0.1em] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="rounded-md border border-[rgba(62,130,255,0.28)] bg-[#0B0D13] p-3 shadow-[inset_0_0_25px_rgba(62,130,255,0.06)]">
                  <pre className="max-h-[360px] overflow-auto text-[0.78rem] leading-6 text-[#D7DAE3]">
                    {activeCode.split("\n").map((line, index) => (
                      <div key={`${tab}-${index}`} className="grid grid-cols-[2rem_1fr] gap-2">
                        <span className="text-right text-[#6D7281]">{index + 1}</span>
                        <code>{line || " "}</code>
                      </div>
                    ))}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </RevealSection>

        <RevealSection id="use-cases" className="py-24 md:py-28">
          <div className="container-wide">
            <SectionHeader
              title="Where Governor fits first."
              subtitle="Real agentic workloads that need a governor, not a guess."
            />
            <motion.div
              className="grid gap-5 md:grid-cols-3"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
            >
              {useCases.map((card) => (
                <motion.article
                  key={card.title}
                  variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                  whileHover={{ y: -3 }}
                  className="surface-card rounded-lg p-6"
                >
                  <p className="mb-3 text-xs tracking-[0.12em] text-[var(--accent)]">{card.label}</p>
                  <h3 className="text-xl text-[var(--text-primary)]">{card.title}</h3>
                  <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--text-secondary)]">{card.text}</p>
                </motion.article>
              ))}
            </motion.div>
          </div>
        </RevealSection>

        <RevealSection className="border-y border-[var(--border)] py-20 md:py-24">
          <div className="container-wide">
            <div className="max-w-4xl">
              <h2 className="serif-title text-3xl text-[var(--text-primary)] md:text-[2.3rem]">
                The missing layer for agentic commerce.
              </h2>
              <p className="mt-5 max-w-[65ch] text-base leading-relaxed text-[var(--text-secondary)]">
                Agents can already write code, browse the web, and call APIs. What is missing is a neutral governor that
                sits between them and real money. Governor is that control system: deterministic, rails-agnostic, and
                built for the way agents actually behave.
              </p>
              <p className="mt-5 text-sm text-[var(--text-secondary)]">
                We are working with a small group of early teams shaping this layer.
              </p>
            </div>
          </div>
        </RevealSection>

        <RevealSection id="join" className="py-24 md:py-28">
          <div className="container-wide">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6 md:p-8">
              <div className="grid gap-9 md:grid-cols-2 md:gap-11">
                <div>
                  <h2 className="serif-title text-3xl text-[var(--text-primary)] md:text-[2.2rem]">
                    Help set the bounds for agentic spend.
                  </h2>
                  <p className="mt-4 max-w-[56ch] text-[0.98rem] leading-relaxed text-[var(--text-secondary)]">
                    Tell us what you are building. We will bring you into the early access cohort.
                  </p>
                  <ul className="mt-6 space-y-3 text-[0.95rem] text-[var(--text-secondary)]">
                    <li>Access to the Governor sandbox and Stripe Issuing integration.</li>
                    <li>Direct input into the policy and KYA model.</li>
                    <li>Early support for your agentic payment flows.</li>
                  </ul>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <label className="field-wrap">
                    <span>Name</span>
                    <input required type="text" placeholder="Jane Doe" />
                  </label>
                  <label className="field-wrap">
                    <span>Work email</span>
                    <input required type="email" placeholder="jane@company.com" />
                  </label>
                  <label className="field-wrap">
                    <span>Company / project</span>
                    <input type="text" placeholder="Acme Labs" />
                  </label>
                  <label className="field-wrap">
                    <span>What are your agents trying to pay for?</span>
                    <textarea rows={4} placeholder="Describe your payment flow" />
                  </label>

                  <motion.button
                    layout
                    type="submit"
                    className="btn-primary w-full justify-center"
                    whileHover={sent ? undefined : { y: -2 }}
                    whileTap={sent ? undefined : { scale: 0.99 }}
                  >
                    {sent ? (
                      <span className="inline-flex items-center gap-2">
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 8.5 6.4 12 13 5.2" />
                        </svg>
                        Request sent
                      </span>
                    ) : (
                      "Request early access"
                    )}
                  </motion.button>

                  {sent && <p className="text-xs text-[var(--text-secondary)]">We will reach out within a few days.</p>}
                </form>
              </div>
            </div>
          </div>
        </RevealSection>
      </main>

      <footer className="border-t border-[var(--border)] py-7">
        <div className="container-wide flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="serif-title text-lg text-[var(--text-primary)]">Governor</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">A policy engine for agentic payments.</p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm text-[var(--text-secondary)]">
            {[
              ["Email", "mailto:team@governor.so"],
              ["X", "https://x.com"],
              ["GitHub", "https://github.com"],
              ["Privacy", "#"],
            ].map(([label, href]) => (
              <a key={label} href={href} className="footer-link" target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
