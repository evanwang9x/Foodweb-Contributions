import { Mistral } from '@mistralai/mistralai'
import { z } from 'zod'

import type { InvoiceItem } from './models.js' 
import { InvoiceItemSchema } from './models.js'

// A script to filter out items returned the first parsing logic. The goal of this is to find items that are
// improperly parsed by OCR since OCR can be dumb and add items like tax / gas / random fees.
// As a result, an LLM call is necessary to filter out these bad responses and ensure accuracy.


// For structured outputs to work, we need to ensure that no fields are nullable.
const InvoiceItemSchemaWithNonnullItemId = InvoiceItemSchema.omit({ itemId: true }).extend({
  itemId: z.string(),
})

const InvoiceDataSchema = z.object({
  itemsToRemove: z.array(InvoiceItemSchemaWithNonnullItemId),
})
interface LLMResponse {
  itemsToRemove: InvoiceItem[]
}

// Function to filter the invoice items
export async function filterInvoiceItems(invoiceItems: InvoiceItem[]): Promise<InvoiceItem[]> {
  const mistral = new Mistral({
    apiKey: process.env.MISTRAL_API_KEY as string,
  })

  // Get items to remove from Mistral LLM
  const itemsToRemove = await getItemsToRemove(invoiceItems, mistral)
  // Since we made the LLM output empty strings for NULL itemId, we need to convert them back to NULL
  const itemsToRemoveWithNullItemId = itemsToRemove.map((item) => ({
    ...item,
    itemId: item.itemId === '' ? null : item.itemId,
  }))

  // Filter out items that should be removed
  const validItems = invoiceItems.filter((item) => {
    const isItemToRemove = itemsToRemoveWithNullItemId.some((removeItem) => {
      const isMatch =
        removeItem.itemDescription === item.itemDescription &&
        removeItem.itemId === item.itemId &&
        removeItem.quantity === item.quantity &&
        removeItem.unitPrice === item.unitPrice &&
        removeItem.pageIndex === item.pageIndex
      return isMatch
    })
    return !isItemToRemove
  })

  return validItems
}

async function getItemsToRemove(invoiceItems: InvoiceItem[], mistral: Mistral): Promise<InvoiceItem[]> {
  try {
    const completion = await mistral.chat.parse({
      model: MODEL,
      temperature: TEMPERATURE,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: JSON.stringify(invoiceItems),
        },
      ],
      responseFormat: InvoiceDataSchema,
    })

    const message = completion.choices?.[0]?.message
    if (!message?.parsed) {
      throw new Error('Parsed response is missing')
    }

    const parsed = message.parsed as LLMResponse
    return parsed.itemsToRemove ?? []
  } catch (error) {
    console.error('Error analyzing invoice items with Mistral:', error)
    return []
  }
}

const MODEL = 'mistral-medium-latest'
const TEMPERATURE = 0
const SYSTEM_PROMPT = `
You are an AI assistant tasked with analyzing invoice items for a restaurant business.
Your primary job is to identify and remove non-inventory related food items.
These are typically entries that do not represent physical products that would be tracked in an inventory system.
You can use fields like 'itemId' (product code) and 'itemDescription' to make your decision.

The input is an array of InvoiceItem objects with this structure:
{
  itemId: string,         // The product code, though it may be empty
  itemDescription: string, // Description of the item
  quantity: number,       // Quantity ordered
  unitPrice: number,      // Price per unit
  pageIndex: number       // Page where the item appears
}

Your task is to return ONLY the entries that should be REMOVED from the inventory system.

IMPORTANT: Be very conservative in what you flag for removal. If in doubt, DO NOT include the item in your response.

Items that should ALWAYS be KEPT (do not include these in your response):
- All food products (including specialty items)
- All beverages (alcoholic and non-alcoholic)
- All kitchen and dining supplies
- Gift items, gift baskets, or special occasion items
- Seasonal or promotional products
- Any ingredient that could possibly be used in cooking or drinks

Examples of items that should be flagged for removal (include ONLY these in your response):
- Explicit service charges (labeled as "Service Fee", "Service Charge", etc.)
- Shipping or delivery fees
- Explicit handling charges
- Fuel surcharges or travel expenses
- Administrative or processing fees
- Credit card fees
- Account fees or membership dues
- Late payment penalties
- Tax-only line items

When examining item descriptions and item IDs:
1. Focus specifically on the exact wording of the item description and the content of the itemId.
2. Look for explicit terms like "fee", "charge", "surcharge", "tax", etc. in the itemDescription.
3. If the itemId looks like it's not just a product code (random alphanumeric string), you should treat it as an itemDescription and evaluate it by the rules above.
4. Do not remove an item based solely on price or quantity.

Provide your response as a valid JSON object with an 'itemsToRemove' array containing ONLY the invoice items that should be removed from the inventory.
Each item should maintain its original structure (itemId, itemDescription, quantity, unitPrice, pageIndex).
`
