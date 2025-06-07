import { Mistral } from '@mistralai/mistralai'
import { responseFormatFromZodObject } from '@mistralai/mistralai/extra/structChat.js'

import { DocumentSchema } from './models.js'

export async function performOCR(documentBase64: string): Promise<OCRResult> {
  const mistral = new Mistral({
    apiKey: process.env.MISTRAL_API_KEY as string,
  })

  try {
    const ocrResponse = await mistral.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        documentUrl: 'data:application/pdf;base64,' + documentBase64,
      },
      includeImageBase64: false,
      documentAnnotationFormat: responseFormatFromZodObject(DocumentSchema),
    })

    console.log('Mistral OCR Response:', ocrResponse)

    // Convert the structured response to OCRResult
    return parseMistralOCRResponse(ocrResponse)
  } catch (error) {
    console.error('Error processing Mistral OCR:', error)
    throw error
  }
}

function parseMistralOCRResponse(mistralResponse: any): OCRResult {
  const invoiceItems = extractInvoiceItemsFromMistral(mistralResponse)
  const distributorInfo = extractDistributorInfoFromMistral(mistralResponse)
  const invoiceDate = extractInvoiceDateFromMistral(mistralResponse)

  return {
    invoiceItems,
    distributorInfo,
    invoiceDate,
    rawOutput: mistralResponse,
  }
}

function extractInvoiceItemsFromMistral(mistralResponse: any): OCRInvoiceItem[] {
  console.log('Parsing invoice items from Mistral response...')

  const items: OCRInvoiceItem[] = []

  if (mistralResponse.pages) {
    mistralResponse.pages.forEach((page: any, pageIndex: number) => {
      const markdown = page.markdown || ''

      // Extract table rows from markdown
      const lines = markdown.split('\n')

      for (const line of lines) {
        // Look for table rows with pipe separators
        if (line.includes('|') && !line.includes('---')) {
          const cells = line
            .split('|')
            .map((cell) => cell.trim())
            .filter((cell) => cell !== '')

          // Skip header rows
          if (cells.length >= 5 && !cells.includes('ITEM') && !cells.includes('QUANTITY')) {
            const [itemId, quantity, description, unitPrice, total] = cells

            // Validate this looks like a data row
            if (itemId && !isNaN(parseFloat(unitPrice))) {
              items.push({
                itemId: itemId || undefined,
                itemDescription: description || undefined,
                quantity: parseQuantity(quantity),
                unitPrice: parsePrice(unitPrice),
                total: parsePrice(total),
                pageIndex,
              })
            }
          }
        }
      }
    })
  }

  console.log(`Extracted ${items.length} items from Mistral response`)
  return items
}

// Helper functions for parsing
function parseQuantity(quantityStr: string): number | undefined {
  if (!quantityStr) return undefined
  const match = quantityStr.match(/(\d+(?:\.\d+)?)/)
  return match ? parseFloat(match[1]) : undefined
}

function parsePrice(priceStr: string): number | undefined {
  if (!priceStr) return undefined
  const cleaned = priceStr.replace(/[$,]/g, '')
  const number = parseFloat(cleaned)
  return isNaN(number) ? undefined : number
}

function extractDistributorInfoFromMistral(mistralResponse: any): DistributorInfo {
  console.log('Parsing distributor info from Mistral response...')

  let distributorName = ''
  let address = {
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
  }

  if (mistralResponse.pages) {
    mistralResponse.pages.forEach((page: any) => {
      const markdown = page.markdown || ''

      // Look for company name patterns
      const companyMatch =
        markdown.match(/# (.+)/) || markdown.match(/(New Southern Food Inc\.)/i) || markdown.match(/慧丰貿易公司/)
      if (companyMatch && !distributorName) {
        distributorName = companyMatch[1] || 'New Southern Food Inc.'
      }

      // Look for address patterns
      const addressMatch = markdown.match(/(\d+\s+[^,]+),\s*([^,]+),\s*(\w{2})\s*(\d{5})/)
      if (addressMatch) {
        address = {
          streetAddress: addressMatch[1] || '',
          city: addressMatch[2] || '',
          state: addressMatch[3] || '',
          zipCode: addressMatch[4] || '',
          country: 'US',
        }
      }
    })
  }

  return {
    name: distributorName || 'Unknown Distributor',
    address,
  }
}

function extractInvoiceDateFromMistral(mistralResponse: any): string {
  console.log('Parsing invoice date from Mistral response...')

  if (mistralResponse.pages) {
    for (const page of mistralResponse.pages) {
      const markdown = page.markdown || ''

      // Look for various date patterns
      const datePatterns = [
        /Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/,
        /(\d{4}\/\d{1,2}\/\d{1,2})/,
        /(\d{1,2}\/\d{1,2}\/\d{4})/,
        /(\d{4}-\d{1,2}-\d{1,2})/,
      ]

      for (const pattern of datePatterns) {
        const match = markdown.match(pattern)
        if (match) {
          const date = new Date(match[1])
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0]
          }
        }
      }
    }
  }

  return ''
}