import Link from 'next/link'
import './landing.css'

export const dynamic = 'force-static'

export const metadata = {
  title: 'CanvasLab — Think, sketch, build together',
  description: 'A collaborative whiteboard for teams to organize ideas, sketch workflows, and write code together in real time.',
}

const capabilities = [
  { number: '01', title: 'Think visually', description: 'Turn rough ideas into notes, diagrams, and connected workflows on a flexible canvas.' },
  { number: '02', title: 'Collaborate live', description: 'Work together with shared updates, collaborator presence, and live cursors.' },
  { number: '03', title: 'Keep ideas together', description: 'Combine notes, text, and code blocks in one shared workspace.' },
]

export default function HomePage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="landing-brand" href="/" aria-label="CanvasLab home"><span className="landing-brand-mark">C</span><span>CanvasLab</span></Link>
        <nav className="landing-nav-actions" aria-label="Main navigation">
          <Link className="landing-sign-in" href="/login">Sign in</Link>
          <Link className="landing-nav-cta" href="/login">Open workspace <span aria-hidden="true">↗</span></Link>
        </nav>
      </header>
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow"><span /> A shared space for ideas</p>
          <h1>Make room for<br /><span>better thinking.</span></h1>
          <p className="landing-intro">Sketch the idea, map the flow, write the code. CanvasLab brings your team’s thinking into one collaborative workspace.</p>
          <div className="landing-hero-actions">
            <Link className="landing-primary-cta" href="/login">Get started <span aria-hidden="true">↗</span></Link>
            <a className="landing-secondary-cta" href="#how-it-works">Explore the workspace <span aria-hidden="true">↓</span></a>
          </div>
          <p className="landing-note"><span className="landing-status-dot" /> Built for focused, real-time collaboration</p>
        </div>
        <div className="landing-preview" aria-label="Illustration of a collaborative whiteboard">
          <div className="preview-topbar">
            <div className="preview-window-dots"><i /><i /><i /></div>
            <span className="preview-document-title">Product brainstorm <span>⌄</span></span>
            <div className="preview-avatars"><span>T</span><span>M</span><span>+</span></div>
          </div>
          <div className="preview-workspace">
            <div className="preview-toolbar" aria-hidden="true"><span className="selected">↖</span><span>✳</span><span>▱</span><span>⌁</span><span>T</span></div>
            <div className="preview-canvas">
              <div className="preview-label">THE BIG IDEA</div>
              <div className="preview-sticky preview-sticky-yellow"><strong>Start with the why</strong><span>What problem are we solving?</span></div>
              <div className="preview-connector preview-connector-one" />
              <div className="preview-sticky preview-sticky-green"><strong>Explore ideas</strong><span>Small steps, big outcomes.</span></div>
              <div className="preview-connector preview-connector-two" />
              <div className="preview-code-card"><div><span /><span /><span /></div><strong>prototype.ts</strong><code>const idea = {'{'}<br />&nbsp; impact: &apos;real&apos;,<br />&nbsp; together: true<br />{'}'}</code></div>
              <div className="preview-cursor preview-cursor-one"><span>Tarun</span><b>↖</b></div>
              <div className="preview-cursor preview-cursor-two"><span>Maya</span><b>↖</b></div>
              <div className="preview-canvas-caption">A workspace that moves with your thinking.</div>
            </div>
          </div>
        </div>
      </section>
      <section className="landing-capabilities" id="how-it-works">
        <div className="landing-section-heading"><p className="landing-eyebrow">One canvas, many ways to think</p><h2>From first thought to shared understanding.</h2></div>
        <div className="landing-capability-grid">
          {capabilities.map((capability) => <article className="landing-capability" key={capability.number}><span className="landing-capability-number">{capability.number}</span><h3>{capability.title}</h3><p>{capability.description}</p></article>)}
        </div>
      </section>
      <footer className="landing-footer">
        <Link className="landing-brand" href="/"><span className="landing-brand-mark">C</span><span>CanvasLab</span></Link>
        <span>Good ideas get better together.</span>
        <Link href="/login">Enter your workspace <span aria-hidden="true">↗</span></Link>
      </footer>
    </main>
  )
}
