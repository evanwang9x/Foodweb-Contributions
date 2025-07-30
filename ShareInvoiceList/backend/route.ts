import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '../../../database/index.js'
import { createUserShoppingListRoleByEmail, ShoppingListNotFoundError, UserNotFoundError } from './dal.js'

const createMemberRequestSchema = z.object({
    email: z.string().email(),
    permissions: z.enum(['owner', 'editor']),
})

const userShoppingListRolesRoute = new Hono().post(
    '/:shoppingListId/permissions',
    zValidator('json', createMemberRequestSchema),
    async (c) => {
        const shoppingListId = parseInt(c.req.param('shoppingListId'))
        const { email, permissions } = c.req.valid('json')

        if (isNaN(shoppingListId)) {
            return c.json({ error: 'Invalid shopping list ID' }, 400)
        }

        try {
            await createUserShoppingListRoleByEmail(db, shoppingListId, email, permissions)
            return c.json({}, 201)
        } catch (error) {
            if (error instanceof UserNotFoundError) {
                return c.json({ error: 'User does not exist' }, 404)
            }

            if (error instanceof ShoppingListNotFoundError) {
                return c.json({ error: 'Shopping list does not exist' }, 404)
            }

            console.error('Failed to create user shopping list role:', error)
            return c.json({ error: 'Failed to create user shopping list role' }, 500)
        }
    }
)

export default userShoppingListRolesRoute