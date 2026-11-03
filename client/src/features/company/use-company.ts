import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/auth.store'
import { JOBS_KEY } from '@/features/jobs/use-jobs'

import {
  fetchCompanies,
  fetchCompany,
  fetchMyCompany,
  removeCompanyImage,
  saveMyCompany,
  setCompanyVerified,
  uploadCompanyImage,
  type CompanyFilters,
} from './company.api'

export const COMPANY_KEY = ['company'] as const

export const useCompanies = (filters: CompanyFilters) =>
  useInfiniteQuery({
    queryKey: [...COMPANY_KEY, 'list', filters],
    queryFn: ({ pageParam }) => fetchCompanies(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

export const useCompany = (id: string) =>
  useQuery({ queryKey: [...COMPANY_KEY, 'public', id], queryFn: () => fetchCompany(id), enabled: !!id, retry: false })

// No focus refetch: a reload would reset the edit form and drop unsaved changes.
export const useMyCompany = (enabled = true) => {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  return useQuery({
    // Keyed by user so one account's company is never served to another.
    queryKey: [...COMPANY_KEY, 'mine', userId],
    queryFn: fetchMyCompany,
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

function useRefreshCompany() {
  const queryClient = useQueryClient()
  // Job cards and job pages embed the company name, badge and logo, so jobs refresh too.
  return () => {
    queryClient.invalidateQueries({ queryKey: COMPANY_KEY })
    queryClient.invalidateQueries({ queryKey: JOBS_KEY })
  }
}

export function useSaveCompany() {
  const refresh = useRefreshCompany()
  return useMutation({ mutationFn: saveMyCompany, onSuccess: refresh })
}

export function useUploadCompanyImage() {
  const refresh = useRefreshCompany()
  return useMutation({ mutationFn: uploadCompanyImage, onSuccess: refresh })
}

export function useRemoveCompanyImage() {
  const refresh = useRefreshCompany()
  return useMutation({ mutationFn: removeCompanyImage, onSuccess: refresh })
}

export function useSetCompanyVerified() {
  const refresh = useRefreshCompany()
  return useMutation({ mutationFn: setCompanyVerified, onSuccess: refresh })
}
