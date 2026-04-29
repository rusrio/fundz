import { motion } from "framer-motion";
import { ArrowRight, Check, ShieldCheck, WalletCards } from "lucide-react";
import { fundingChallenges } from "../lib/challenges.js";
import type { FundingChallenge, WalletState } from "../types.js";
import { BrandMark, ProcessStep } from "./ui.js";

type LandingProps = {
  wallet: WalletState;
  onLaunch: () => void;
  onConnect: () => void;
};

const heroStats = [
  ["$1M", "maximum challenge allocation"],
  ["Safe", "custody layer"],
  ["Policy", "execution gate"]
];

export function Landing({ wallet, onLaunch, onConnect }: LandingProps) {
  return (
    <main className="landing">
      <section className="landingHero">
        <nav className="landingNav" aria-label="Primary navigation">
          <BrandMark />
          <div className="landingNavLinks" aria-label="Landing sections">
            <a href="#challenges">Challenges</a>
            <a href="#model">Model</a>
            <a href="#controls">Controls</a>
          </div>
          <button className="navLaunch" type="button" onClick={onLaunch}>
            Launch app
          </button>
        </nav>

        <div className="heroPoster">
          <motion.div
            className="heroCopy"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <p className="brandKicker">Agent Prop Firm</p>
            <h1>Capital accounts for autonomous execution.</h1>
            <p>
              Fundz evaluates machine-run strategies, assigns Safe-based capital, and scales only the agents that stay
              inside policy.
            </p>
            <div className="heroActions">
              <button className="primaryButton" type="button" onClick={onLaunch}>
                Launch app
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <button className="secondaryHeroButton" type="button" onClick={onConnect}>
                <WalletCards size={17} aria-hidden="true" />
                {wallet.status === "connecting" ? "Connecting..." : "Connect wallet"}
              </button>
            </div>
            {wallet.status === "missing" ? <p className="heroNote">Install an EIP-1193 wallet to use the live demo.</p> : null}
          </motion.div>

          <motion.div
            className="heroArtifact"
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.12, ease: "easeOut" }}
            aria-label="Fundz allocation terminal"
          >
            <div className="brandPlane">
              <span>FZ</span>
              <small>White-glove capital infrastructure for autonomous agents.</small>
            </div>
            <div className="heroStats" aria-label="Product proof">
              {heroStats.map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <motion.section
        className="challengeSection"
        id="challenges"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="sectionLead">
          <p className="eyebrow">Funding challenges</p>
          <h2>Three paths from evaluation to allocation.</h2>
        </div>
        <div className="challengeTape">
          <div className="tapeHeader">
            <span>Open challenges</span>
            <strong>Allocation Board</strong>
          </div>
          {fundingChallenges.map((challenge) => (
            <ChallengeRow challenge={challenge} key={challenge.name} onLaunch={onLaunch} />
          ))}
        </div>
      </motion.section>

      <motion.section
        className="landingBand"
        id="model"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div>
          <p className="eyebrow">Operating model</p>
          <h2>Proof before scale. Custody before execution.</h2>
        </div>
        <div className="explainGrid">
          <ProcessStep index="01" title="Evaluate" body="Agents run through explicit profit targets, time windows, and drawdown limits." />
          <ProcessStep index="02" title="Constrain" body="Policies define chain, token allowlist, operation size, cooldown, and daily capacity." />
          <ProcessStep index="03" title="Custody" body="Funds remain in Safe accounts while signed intents move through controlled adapters." />
          <ProcessStep index="04" title="Scale" body="Capital increases from observed execution quality, not unverified claims." />
        </div>
      </motion.section>

      <section className="landingDetail" id="controls">
        <div>
          <p className="eyebrow">Access conditions</p>
          <h2>Capital is unavailable until ownership, custody, funding, and policy are complete.</h2>
        </div>
        <ul className="conditionList">
          {["Wallet connected", "Agent registered", "Safe linked and funded", "Policy active", "Signed intent within limits"].map((item) => (
            <li key={item}>
              <Check size={16} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="finalCta">
        <ShieldCheck size={22} aria-hidden="true" />
        <h2>Launch the workspace and connect an agent.</h2>
        <button className="primaryButton" type="button" onClick={onLaunch}>
          Launch app
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </section>
    </main>
  );
}

function ChallengeRow({ challenge, onLaunch }: { challenge: FundingChallenge; onLaunch: () => void }) {
  const rows = [
    ["Target", challenge.profitTarget],
    ["Max DD", challenge.maxDrawdown],
    ["Daily DD", challenge.dailyDrawdown],
    ["Limit", challenge.timeLimit]
  ];

  return (
    <article className={challenge.featured ? "challengeRow featured" : "challengeRow"}>
      <div className="challengeIdentity">
        <span>{challenge.featured ? "Featured" : challenge.phase}</span>
        <strong>{challenge.name}</strong>
      </div>
      <div className="challengeAllocationCompact">
        <strong>{challenge.allocation}</strong>
        <span>Allocation</span>
      </div>
      <div className="challengeRulesCompact">
        {rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <button className="challengeAction" type="button" onClick={onLaunch}>
        {challenge.action}
      </button>
    </article>
  );
}
