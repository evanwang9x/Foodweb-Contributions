import { eq } from 'drizzle-orm'

import { type AppDatabase } from '../../../database/index.js'
import { shoppingLists, users, usersShoppingListRoles } from '../../../database/schema.js'

export class UserNotFoundError extends Error {
    constructor(email: string) {
        super(`User with email ${email} not found`)
        this.name = 'UserNotFoundError'
    }
}

export class ShoppingListNotFoundError extends Error {
    constructor(id: number) {
        super(`Shopping list with id ${id} not found`)
        this.name = 'ShoppingListNotFoundError'
    }
}

/**
 * Creates a new user shopping list role entry by email
 * @param db - The database instance
 * @param shoppingListId - The shopping list ID
 * @param email - The user's email address
 * @param permissions - The permission type ('owner' | 'editor')
 * @throws {UserNotFoundError} When user with email is not found
 * @throws {ShoppingListNotFoundError} When shopping list with id is not found
 */
export async function createUserShoppingListRoleByEmail(
    db: AppDatabase,
    shoppingListId: number,
    email: string,
    permissions: 'owner' | 'editor'
): Promise<void> {
    await db.transaction(async (tx) => {
        // Run user and shopping list validation in parallel
        const [user, shoppingList] = await Promise.all([
            tx.query.users.findFirst({
                where: eq(users.emailAddress, email),
                columns: { id: true },
            }),
            tx.query.shoppingLists.findFirst({
                where: eq(shoppingLists.id, shoppingListId),
                columns: { id: true },
            }),
        ])

        if (!user) {
            throw new UserNotFoundError(email)
        }

        if (!shoppingList) {
            throw new ShoppingListNotFoundError(shoppingListId)
        }

        // Create the shopping list role entry
        await tx.insert(usersShoppingListRoles).values({
            shoppingListId,
            userId: user.id,
            permissions,
        })
    })
}