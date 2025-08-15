import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '../../../database/index.js'
import { deleteUserInvoice } from './dal.js'

const requestSchema = z.object({
    restaurantId: z.number(),
})

const deleteInvoiceRoute = new Hono().delete('/:invoiceId', zValidator('json', requestSchema), async (c) => {
    const invoiceId = c.req.param('invoiceId')
    const { restaurantId } = c.req.valid('json')

    try {
        await deleteUserInvoice(db, invoiceId, restaurantId)
        return c.body(null, 204)
    } catch (error) {
        console.error('Failed to delete user invoice', error)
        return c.json({ error: 'Failed to delete user invoice' }, 500)
    }
})

export default deleteInvoiceRoute