import { z } from 'zod'


export const DocumentSchema = z.object({
  distributorName: z.string().describe('The name of the distributor or company'),
  invoiceDate: z.string().describe('The invoice date in YYYY-MM-DD format'),
  totalAmount: z.number().optional().describe('The total amount of the invoice'),
  invoiceItems: z
    .array(
      z.object({
        description: z.string().describe('Item description'),
        quantity: z.number().describe('Quantity of the item'),
        unitPrice: z.number().describe('Unit price of the item, may be 0 if its a gift'),
        itemId: z.string().optional().describe('Item ID or SKU'),
      })
    )
    .describe('List of invoice items'),
})

export type DocumentSchema = z.infer<typeof DocumentSchema>