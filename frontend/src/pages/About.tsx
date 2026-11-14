import Breadcrumbs from '../components/Breadcrumbs'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export default function About() {
  useDocumentTitle('About the data')
  return (
    <div className="max-w-2xl space-y-4">
      <Breadcrumbs items={[{ label: 'About the data' }]} />
      <h1 className="text-2xl font-semibold">About the data</h1>
      <ul className="list-disc space-y-3 pl-5 text-slate-700">
        <li>
          <strong>Reports and slides are separate.</strong> The 979 pathology reports are synthetic and match no slide, so
          nothing here links a report to a patient's slides.
        </li>
        <li>
          <strong>Criteria matches (Task A)</strong> come from one rule per criterion. The rules score a mean F1 of 1.000 on
          the 9,010 training reports; the test reports have no answer key.
        </li>
        <li>
          <strong>Organ predictions (Task C1)</strong> apply to the 67 held-out slides only. Leave-one-out accuracy on
          labelled slides is 87.4%, and slides under 50% confidence are flagged for manual review.
        </li>
        <li>
          <strong>Similar slides (Task C2)</strong> are ranked by predicted organ first, then by GigaPath similarity, so a wrong
          organ prediction pulls in the wrong slides. Only ranks are available, not similarity scores.
        </li>
        <li>
          <strong>Slide upload is a demo.</strong> The organ model needs precomputed GigaPath embeddings, so an uploaded slide
          is not analysed. The page shows the stored result for a randomly chosen held-out slide and says so.
        </li>
        <li>
          <strong>Tiles</strong> are a sample of up to 35 per slide at about 0.5 µm/px, not the whole slide. Marker
          positions on the overview are approximate.
        </li>
      </ul>
      <p className="text-sm text-slate-500">Research prototype built on hackathon data. Not for clinical use.</p>
    </div>
  )
}
