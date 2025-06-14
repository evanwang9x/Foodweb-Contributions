import DocumentIntelligence, {
  type AnalyzeResultOutput,
  type DocumentFieldOutput,
  getLongRunningPoller,
  isUnexpected,
} from '@azure-rest/ai-document-intelligence'

import type { DistributorInfo } from './models.js'

// Inputs the scanned invoices and converts them into pdfbase 64 for OCR parsing.
// Then parsing logic will sort out the azureOCR output and put them into a map.
// This will then be sent through to mistralFilter to fix OCR mistakkes.


export interface OCRResult {
  invoiceItems: OCRInvoiceItem[]
  distributorInfo: DistributorInfo
  invoiceDate: string
  rawOutput: Record<string, unknown>
}

export interface OCRInvoiceItem {
  itemId: string | undefined
  itemDescription: string | undefined
  quantity: number | undefined
  unitPrice: number | undefined
  total: number | undefined
  pageIndex: number
}

/**
 * Performs OCR on a base64-encoded document and returns a structured invoice OCR result.
 *
 * @param documentBase64 - The document content encoded as a base64 string (supports PDF, JPEG, PNG, BMP, and TIFF formats)
 * @returns A structured invoice OCR result
 * @throws Error if the API request fails or returns an unexpected response
 */
export async function performOCR(documentBase64: string): Promise<OCRResult> {
  const docClient = DocumentIntelligence(process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT as string, {
    key: process.env.AZURE_DOCUMENT_INTELLIGENCE_API_KEY as string,
  })

  const analyzeResult = await analyzeDocument(docClient, documentBase64)

  const invoiceDate = extractInvoiceDate(analyzeResult)
  const distributorInfo = extractDistributorInfoFromOCRResult(analyzeResult)
  const invoiceItems = extractInvoiceItem(analyzeResult)

  return {
    invoiceItems,
    distributorInfo,
    invoiceDate,
    rawOutput: JSON.parse(JSON.stringify(analyzeResult)),
  }
}

/**
 * Analyzes a document using Azure Document Intelligence.
 *
 * @param docClient - The Document Intelligence client.
 * @param documentBase64 - The base64 encoded document.
 * @returns A promise that resolves to the AnalyzeResultOutput.
 * @throws Error if the API request fails or returns an unexpected response.
 */
async function analyzeDocument(
  docClient: ReturnType<typeof DocumentIntelligence>,
  documentBase64: string
): Promise<AnalyzeResultOutput> {
  const initialResponse = await docClient.path('/documentModels/{modelId}:analyze', 'prebuilt-invoice').post({
    contentType: 'application/json',
    body: {
      base64Source: documentBase64,
    },
  })

  if (isUnexpected(initialResponse)) {
    throw initialResponse.body.error
  }

  const poller = getLongRunningPoller(docClient, initialResponse)
  const result = await poller.pollUntilDone()

  if (!result.body || !('analyzeResult' in (result.body as any))) {
    throw new Error('Analyze result not found in response body')
  }

  return (result.body as { analyzeResult: AnalyzeResultOutput }).analyzeResult
}

/**
 * Extracts the invoice date from an OCR analysis result.
 *
 * @param analyzeResult
 * @returns The invoice creation date as a string in the format "YYYY-MM-DD" if found, or an empty string if not found
 */
function extractInvoiceDate(analyzeResult: AnalyzeResultOutput): string {
  if (!analyzeResult.documents || analyzeResult.documents.length === 0) {
    throw new Error('No document data found in analysis result')
  }

  const fields = analyzeResult.documents[0].fields
  if (!fields) {
    return ''
  }
  const invoiceDate = fields['InvoiceDate']?.valueDate
  return invoiceDate ?? ''
}

/**
 * Extracts distributor information from an OCR analysis result.
 *
 * Reads the vendor name and address from the analysis result.
 *
 * @param analyzeResult - The result output from Azure Document Intelligence analysis
 * @returns Distributor information containing name and address
 * @throws Error if no document data found
 */
function extractDistributorInfoFromOCRResult(analyzeResult: AnalyzeResultOutput): DistributorInfo {
  if (!analyzeResult.documents || analyzeResult.documents.length === 0) {
    throw new Error('No document data found in analysis result')
  }

  const fields = analyzeResult.documents[0].fields
  const distributorName = fields?.['VendorName']?.valueString ?? ''
  const parsedAddress = fields?.['VendorAddress']?.valueAddress

  if (!parsedAddress) {
    return {
      name: distributorName,
      address: {
        streetAddress: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US',
      },
    }
  }

  return {
    name: distributorName,
    address: {
      streetAddress: parsedAddress.streetAddress ?? '',
      city: parsedAddress.city ?? '',
      state: parsedAddress.state ?? '',
      zipCode: parsedAddress.postalCode ?? '',
      country: 'US',
    },
  }
}

/**
 * Processes Azure OCR result to extract invoice items with key fields.
 * Extracts Amount, Description, ProductCode, Quantity, and UnitPrice from the structured document data.
 *
 * @param ocrResult - The analysis result from Azure Document Intelligence
 * @returns An array of OCR invoice items extracted from the OCR result
 */
function extractInvoiceItem(ocrResult: AnalyzeResultOutput): OCRInvoiceItem[] {
  // Checks that documents is not empty
  const documents = ocrResult.documents
  if (!documents || documents.length === 0) {
    throw new Error('No document data found in analysis result')
  }

  // Process each document, collecting and flattening results
  return documents.flatMap((document) => {
    // Ensure Items field and its valueArray exist
    const itemsField = document.fields?.['Items']
    if (itemsField && itemsField.type === 'array' && itemsField.valueArray) {
      return processItemsFromDocument(itemsField.valueArray)
    }
    return []
  })
}

/**
 * Processes items from a single document, focusing on key fields
 *
 * @param items - Array of item values from document
 * @returns Array of extracted OCR invoice items
 */
function processItemsFromDocument(items: DocumentFieldOutput[]): OCRInvoiceItem[] {
  return items
    .filter((item) => item.type === 'object' && item.valueObject) // Ensure item is an object and has valueObject
    .map(extractItem)
}

/**
 * Extracts data from a single item, focusing on key fields
 *
 * @param item - The item data to process (should be a DocumentFieldOutput with type 'object')
 * @returns An OCR invoice item with extracted fields
 */
function extractItem(item: DocumentFieldOutput): OCRInvoiceItem {
  const itemData = item.valueObject // itemData is Record<string, DocumentFieldOutput>
  if (itemData === undefined) {
    // This case should ideally be filtered out by processItemsFromDocument
    throw new Error('Item data is undefined')
  }

  // Extract page index from bounding regions if available
  let pageIndex = 0
  if (item.boundingRegions && item.boundingRegions.length > 0) {
    pageIndex = item.boundingRegions[0].pageNumber - 1
  }

  // Extract key fields from the document
  // Accessing fields from itemData, which is Record<string, DocumentFieldOutput>
  const description = itemData.Description?.valueString
  const productCode = itemData.ProductCode?.valueString
  const unitPrice = itemData.UnitPrice?.valueCurrency?.amount
  const total = itemData.Amount?.valueCurrency?.amount
  const quantity = itemData.Quantity?.valueNumber

  // Return the OCR invoice item with all extracted fields
  return {
    itemId: productCode,
    itemDescription: description,
    quantity: quantity,
    unitPrice: unitPrice,
    total: total,
    pageIndex,
  }
}
