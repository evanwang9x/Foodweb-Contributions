import { eq } from 'drizzle-orm'

import { type AppDatabase } from '../../../database/index.js'
import { invoices } from '../../../database/schema.js'

export async function deleteUserInvoice(db: AppDatabase, invoiceId: string, restaurantId: number): Promise<void> {
    await db.transaction(async (tx) => {
        const existingInvoice = await tx.query.invoices.findFirst({
            where: eq(invoices.uuid, invoiceId),
            columns: { uuid: true, restaurantId: true },
        })

        if (!existingInvoice) {
            throw new Error('Invoice not found')
        }

        if (existingInvoice.restaurantId !== restaurantId) {
            throw new Error('Access denied')
        }

        // Delete the invoice only if it exists and belongs to the restaurant
        await tx.delete(invoices).where(eq(invoices.uuid, invoiceId))
    })
}