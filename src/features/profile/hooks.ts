import { changePassword, fetchProfile, updateProfile } from '@/features/auth/api'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function profileQueryOptions() {
  return queryOptions({
    queryKey: ['profile'],
    queryFn: () => fetchProfile(),
  })
}

export function useProfileQuery() {
  return useQuery(profileQueryOptions())
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (user) => {
      queryClient.setQueryData(['profile'], user)
      queryClient.setQueryData(['session'], user)
    },
  })
}

export function useChangePasswordMutation() {
  return useMutation({ mutationFn: changePassword })
}
