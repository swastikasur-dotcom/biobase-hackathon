import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import About from './pages/About'
import AnalysisResultPage from './pages/AnalysisResultPage'
import Analyze from './pages/Analyze'
import NotFound from './pages/NotFound'
import Cohort from './pages/Cohort'
import CriteriaList from './pages/CriteriaList'
import Home from './pages/Home'
import ReportDetail from './pages/ReportDetail'
import SlideBrowser from './pages/SlideBrowser'
import SlideDetail from './pages/SlideDetail'
import SlideMap from './pages/SlideMap'
import SlideUploadResult from './pages/SlideUploadResult'
import DraftProvider from './state/DraftProvider'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DraftProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="patients" element={<Analyze />} />
              <Route path="patients/result" element={<AnalysisResultPage />} />
              <Route path="patients/browse" element={<CriteriaList />} />
              <Route path="patients/:criterionId" element={<Cohort />} />
              <Route path="patients/:criterionId/:reportId" element={<ReportDetail />} />
              <Route path="slides" element={<SlideBrowser />} />
              <Route path="slides/map" element={<SlideMap />} />
              <Route path="slides/analysis" element={<SlideUploadResult />} />
              <Route path="slides/:slideId" element={<SlideDetail />} />
              <Route path="about" element={<About />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </DraftProvider>
    </QueryClientProvider>
  )
}
