import { FileText, Presentation, Workflow, Users, Target, CalendarDays, X } from 'lucide-react'

export type CanvasTemplateId = 'meeting-notes' | 'project-proposal' | 'pitch-deck' | 'sprint-review' | 'brainstorm' | 'user-journey'

const templates: { id: CanvasTemplateId; title: string; kind: string; description: string; icon: typeof FileText; color: string }[] = [
  { id: 'meeting-notes', title: 'Meeting notes', kind: 'Document-style board', description: 'Agenda, discussion points, decisions, and action items.', icon: FileText, color: 'sage' },
  { id: 'project-proposal', title: 'Project proposal', kind: 'Document-style board', description: 'Problem, goals, scope, risks, and next steps.', icon: Target, color: 'sand' },
  { id: 'pitch-deck', title: 'Pitch deck', kind: 'Presentation-style board', description: 'A structured sequence for your idea, market, solution, and plan.', icon: Presentation, color: 'lilac' },
  { id: 'sprint-review', title: 'Sprint review', kind: 'Presentation-style board', description: 'Highlights, shipped work, learnings, and upcoming priorities.', icon: CalendarDays, color: 'blue' },
  { id: 'brainstorm', title: 'Brainstorming', kind: 'Whiteboard', description: 'Explore ideas, opportunities, questions, and votes.', icon: Users, color: 'peach' },
  { id: 'user-journey', title: 'User journey', kind: 'Whiteboard', description: 'Map stages, user actions, pain points, and opportunities.', icon: Workflow, color: 'mint' },
]

export function TemplateGallery({ onChoose, onClose }: { onChoose: (id: CanvasTemplateId) => void; onClose: () => void }) {
  return <div className="template-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="template-dialog" role="dialog" aria-modal="true" aria-labelledby="template-gallery-title">
      <header className="template-dialog-header">
        <div><span className="template-eyebrow">CANVASLAB LIBRARY</span><h2 id="template-gallery-title">Start with a template</h2><p>Choose a starting point. Everything created on the board stays editable and collaborative.</p></div>
        <button className="template-close" onClick={onClose} aria-label="Close templates"><X size={18} /></button>
      </header>
      <div className="template-grid">
        {templates.map((template) => {
          const Icon = template.icon
          return <button className="template-card" key={template.id} onClick={() => onChoose(template.id)}>
            <span className={`template-art template-art-${template.color}`}><Icon size={23} /><span className="template-art-lines"><i /><i /><i /></span></span>
            <span className="template-card-copy"><strong>{template.title}</strong><small>{template.kind}</small><span>{template.description}</span></span>
            <span className="template-use">Use template <span aria-hidden="true">→</span></span>
          </button>
        })}
      </div>
      <footer className="template-dialog-footer"><span>Native CanvasLab templates</span><span>Google Drive import/export can be added separately.</span></footer>
    </section>
  </div>
}
