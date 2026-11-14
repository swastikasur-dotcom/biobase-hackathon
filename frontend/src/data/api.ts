import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Cohorts, Criterion, Report, SimilarMap, SlidesFile, TilesMap, UmapFile } from '../types'

async function fetchJson<T>(name: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}`)
  if (!res.ok) throw new Error(`Failed to load ${name} (${res.status}). Run "npm run export-data".`)
  return res.json() as Promise<T>
}

// The data is static, so it never goes stale. reports.json is ~2 MiB: fetched once, then cached.
const staticQuery = { staleTime: Infinity, gcTime: Infinity, retry: false } as const

export const useCriteria = () =>
  useQuery({ queryKey: ['criteria'], queryFn: () => fetchJson<Criterion[]>('criteria.json'), ...staticQuery })

export const useCohorts = () =>
  useQuery({ queryKey: ['cohorts'], queryFn: () => fetchJson<Cohorts>('cohorts.json'), ...staticQuery })

export const useReports = () =>
  useQuery({ queryKey: ['reports'], queryFn: () => fetchJson<Report[]>('reports.json'), ...staticQuery })

/** Reports indexed by id. */
export function useReportIndex() {
  const q = useReports()
  const index = useMemo(() => new Map((q.data ?? []).map((r) => [r.id, r])), [q.data])
  return { ...q, index }
}

export const useSlidesFile = () =>
  useQuery({ queryKey: ['slides'], queryFn: () => fetchJson<SlidesFile>('slides.json'), ...staticQuery })

export const useSimilar = () =>
  useQuery({ queryKey: ['similar'], queryFn: () => fetchJson<SimilarMap>('similar.json'), ...staticQuery })

/** Slides indexed by id. */
export function useSlideIndex() {
  const q = useSlidesFile()
  const index = useMemo(() => new Map((q.data?.slides ?? []).map((s) => [s.id, s])), [q.data])
  return { ...q, index }
}

export const useTiles = () =>
  useQuery({ queryKey: ['tiles'], queryFn: () => fetchJson<TilesMap>('tiles.json'), ...staticQuery })

export const useUmap = () =>
  useQuery({ queryKey: ['umap'], queryFn: () => fetchJson<UmapFile>('umap.json'), ...staticQuery })
