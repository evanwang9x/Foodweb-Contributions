import { useMutation } from '@tanstack/react-query'

import { useAuthenticatedClient } from '@/services/api'

interface ShareShoppingListRequest {
    shoppingListId: number
    email: string
    permissions: 'owner' | 'editor'
}

export function useShareShoppingList() {
    const authenticatedApiClient = useAuthenticatedClient()

    return useMutation({
        mutationFn: async ({ shoppingListId, email, permissions }: ShareShoppingListRequest) => {
            const response = await authenticatedApiClient.api['shopping-lists'][':shoppingListId']['permissions'].$post({
                param: { shoppingListId: shoppingListId.toString() },
                json: {
                    email,
                    permissions,
                },
            })

            if (!response.ok) {
                try {
                    const errorData = await response.json()
                    throw new Error(errorData.error || 'Failed to share shopping list')
                } catch {
                    // If JSON parsing fails, throw a generic error
                    throw new Error('Failed to share shopping list')
                }
            }

            return
        },
    })
}