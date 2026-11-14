import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const Card = ({ to, title, steps, body }: { to: string; title: string; steps: string; body: string }) => (
  <Link to={to} className="lift block rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-400">
    <h2 className="text-xl font-semibold">{title}</h2>
    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{steps}</p>
    <p className="mt-3 text-slate-700">{body}</p>
  </Link>
)

export default function Home() {
  useDocumentTitle('')
  return (
    <div>
      <h1 className="text-3xl font-semibold">Find the right patients</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Two independent tracks over the Biobase hackathon data. Reports and slides come from separate datasets and
        cannot be linked to the same patient.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card
          to="/patients"
          title="Find patients"
          steps="Task A"
          body="Upload a pathology report to see which of 30 clinical criteria it meets and why, with a plain-language summary and similar reports. Or browse the matching cohorts and export them."
        />
        <Card
          to="/slides"
          title="Explore slides"
          steps="Tasks C1 and C2"
          body="Browse whole-slide images, see the predicted organ and how confident the model is, and find the most similar slides."
        />
      </div>
    </div>
  )
}
