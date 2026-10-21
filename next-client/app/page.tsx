import Link from 'next/link'

export const dynamic = 'force-static'

export default function HomePage() {
  return (
    <main className="landing">
      <nav className="nav" aria-label="Main navigation">
        <Link className="brand" href="/">CanvasLab<span aria-hidden="true">.</span></Link>
        <a className="nav-link" href="https://github.com/tarunchesetti/canvaslab-pern">View source</a>
      </nav>
      <section className="hero">
        <p className="eyebrow">THINK TOGETHER · BUILD TOGETHER</p>
        <h1>Your ideas deserve<br />room to <em>take shape.</em></h1>
        <p className="intro">A shared canvas for mapping ideas, sketching systems, and writing code with your team in real time.</p>
        <p className="status"><span aria-hidden="true" /> Next.js migration preview</p>
        <p className="note">This preview is intentionally separate from the live Vite application. The collaborative editor will be migrated and benchmarked before any production switch.</p>
      </section>
      <footer>CanvasLab · Built for collaborative thinking</footer>
    </main>
  )
}
