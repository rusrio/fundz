import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { ArrowDown, ArrowRight, Check, LockKeyhole, Route, ShieldCheck, WalletCards } from "lucide-react";
import type { WalletState } from "../types.js";
import logo from "../../../../resources/logo-nobackground.png";

type LandingProps = {
  wallet: WalletState;
  onLaunch: () => void;
  onConnect: () => void;
};

const workflow = [
  "Agent proves edge",
  "Fundz opens Safe",
  "Policies gate trades",
  "Risk is monitored",
  "Access scales or exits"
];

const controls = ["Token allowlist", "Max order size", "Cooldown window", "Daily capacity", "Drawdown guard", "Credential revoke"];

export function Landing({ wallet, onLaunch, onConnect }: LandingProps) {
  return (
    <main className="landing">
      <header className="landingTopbar">
        <div className="landingActions">
          <button className="ghostButton" type="button" onClick={onConnect}>
            <WalletCards size={16} aria-hidden="true" />
            {wallet.status === "connecting" ? "Connecting" : "Connect wallet"}
          </button>
          <button className="primaryButton" type="button" onClick={onLaunch}>
            Launch app
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="landingHero">
        <motion.div
          className="landingHeroCopy"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1>Fundz capital accounts for autonomous traders.</h1>
          <p>
            Give AI agents funded Safe accounts, policy-bound execution, and a risk layer that protects protocol capital before every trade.
          </p>
          <div className="heroActions">
            <button className="primaryButton" type="button" onClick={onLaunch}>
              Launch app
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button className="secondaryButton" type="button" onClick={onConnect}>
              <WalletCards size={16} aria-hidden="true" />
              {wallet.account ? "Wallet connected" : "Connect wallet"}
            </button>
          </div>
          {wallet.error ? <p className="heroNote">{wallet.error}</p> : null}
        </motion.div>

        <motion.div
          className="heroAppScene"
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          aria-label="Fundz execution preview"
        >
          <span className="floatingChip chipOne">WETH / USDC</span>
          <span className="floatingChip chipTwo">Safe ready</span>
          <span className="floatingChip chipThree">Drawdown 0.0%</span>
          <div className="fundzAppCard">
            <header className="fundzAppHeader">
              <img src={logo} alt="" aria-hidden="true" />
              <span className="status statusPositive">Policy live</span>
            </header>
            <div className="intentPanel">
              <span>Agent intent</span>
              <strong>Swap 1,000 USDC to WETH</strong>
              <small>OpenClaw Agent · Ethereum fork</small>
            </div>
            <div className="flowDivider"><ArrowDown size={18} aria-hidden="true" /></div>
            <div className="executionStack">
              <PreviewStep icon={<ShieldCheck size={18} />} title="Policy check" body="Allowlist, size, cooldown, and daily capacity pass." status="Approved" />
              <PreviewStep icon={<LockKeyhole size={18} />} title="Safe execution" body="Fundz signs and routes from the assigned Safe." status="Ready" />
              <PreviewStep icon={<Route size={18} />} title="Risk monitor" body="Protected floor stays above $101,000 after execution." status="Guarded" />
            </div>
            <div className="capitalSummary">
              <div>
                <span>Fundz capital</span>
                <strong>$100k</strong>
              </div>
              <div>
                <span>Margin</span>
                <strong>$10k</strong>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="landingStrip">
        <div className="stripHeader">
          <h2>A prop-firm model built for machine execution.</h2>
        </div>
        <div className="workflowGrid">
          {workflow.map((item, index) => (
            <article key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="landingStrip twoColumn">
        <div className="stripHeader">
          <h2>Agent margin takes first loss. Fundz capital stays protected.</h2>
        </div>
        <div className="modelList">
          <ModelLine label="Fundz protocol capital" value="$100,000" />
          <ModelLine label="Agent loss margin" value="$10,000" />
          <ModelLine label="Access fee" value="$1,000" />
          <ModelLine label="Protected value" value="$101,000" strong />
        </div>
      </section>

      <section className="landingStrip twoColumn">
        <div className="stripHeader">
          <h2>Execution constraints are brand infrastructure, not fine print.</h2>
        </div>
        <ul className="controlList">
          {controls.map((item) => (
            <li key={item}>
              <div className="iconWrap"><Check size={16} aria-hidden="true" /></div>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="finalCta">
        <div className="ctaContent">
          <ShieldCheck size={36} aria-hidden="true" className="ctaIcon" />
          <h2>Open Fundz and connect the agent wallet.</h2>
          <button className="primaryButton" type="button" onClick={onLaunch}>
            Launch app
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>
    </main>
  );
}

function ModelLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "modelLine strong" : "modelLine"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PreviewStep({ icon, title, body, status }: { icon: ReactNode; title: string; body: string; status: string }) {
  return (
    <article className="previewStep">
      <div className="previewIcon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      <span>{status}</span>
    </article>
  );
}
