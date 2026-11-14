import Breadcrumbs from '../components/Breadcrumbs'
import Status from '../components/Status'
import UmapScatter, { UmapLegend } from '../components/UmapScatter'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { useSlideIndex, useUmap } from '../data/api'

export default function SlideMap() {
  useDocumentTitle('Slide map')
  const slides = useSlideIndex()
  const umap = useUmap()
  return (
    <div>
      <Breadcrumbs items={[{ label: 'Explore slides', to: '/slides' }, { label: 'Map' }]} />
      <h1 className="text-2xl font-semibold">Slide map</h1>
      <p className="mt-1 max-w-2xl text-slate-600">
        Each dot is a slide, placed so that visually similar slides sit close together
        {umap.data && ` (${umap.data.method} of ${umap.data.model === 'gigapath' ? 'GigaPath' : umap.data.model} embeddings)`}. Hover a dot for a preview, click to open the slide.
      </p>
      <div className="mt-4">
        <Status queries={[slides, umap]}>
          {slides.data && umap.data && (
            <div className="space-y-3">
              <UmapLegend organGroups={slides.data.organGroups} />
              <UmapScatter points={umap.data.points} slides={slides.index} organGroups={slides.data.organGroups} maxWidth={760} />
            </div>
          )}
        </Status>
      </div>
    </div>
  )
}
