import { useQuery } from '@tanstack/react-query'

import type { InferResponseType } from '@/services/api'
import apiClient, { useAuthenticatedClient } from '@/services/api'

export const QUERY_KEY = 'user-invoices'

// Use the API endpoint type to infer the response type
const $getUserInvoices = apiClient.api.users[':userId'].invoices.$get
export type UserInvoicesResponse = InferResponseType<typeof $getUserInvoices>

/**
 * Hook to fetch invoices for a specific user with optional distributor filtering
 *
 * @param userId - The user ID to fetch invoices for
 * @param distributorId - Optional distributor ID to filter invoices by
 * @returns Query result containing the user's invoices
 */
export function useUserInvoices(userId: string, distributorId?: number) {
    const authenticatedApiClient = useAuthenticatedClient()
    return useQuery({
        queryKey: [QUERY_KEY, userId, { distributorId }],
        queryFn: async () => {
            const response = await authenticatedApiClient.api.users[':userId'].invoices.$get({
                param: { userId },
                query: { distributorId: distributorId ? distributorId.toString() : undefined },
            })

            if (!response.ok) {
                throw new Error('Failed to fetch user invoices')
            }

            const data = await response.json()
            return data.invoices
        },
        enabled: !!userId, // Only run the query if userId is provided
    })
}