import { useMutation, useQueryClient } from '@tanstack/react-query'

import { QUERY_KEY } from '@/hooks/queries/useUserInvoices'
import { useAuthenticatedClient } from '@/services/api'

export function useDeleteUserInvoice() {
    const queryClient = useQueryClient()
    const authenticatedApiClient = useAuthenticatedClient()

    return useMutation({
        mutationFn: async ({ invoiceId, restaurantId }: { invoiceId: string; restaurantId: number }) => {
            const response = await authenticatedApiClient.api.invoices[':invoiceId'].$delete({
                param: { invoiceId },
                json: { restaurantId },
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to delete invoice')
            }

            return
        },
        onSuccess: () => {
            // Clear any user-related queries
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
        },
    })
}