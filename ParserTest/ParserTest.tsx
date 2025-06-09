import 'dotenv/config'

import { parseArgs } from 'node:util'

import fs from 'fs'
import Fuse from 'fuse.js'
import path from 'path'

import { processDocument } from '../src/routes/invoices/parse/index.js'
import { createPDFFromImages } from '../src/routes/invoices/parse/pdfCreator.js'

//To use this test, navigate to foodweb/iris/server then run npm run test-parse <foldername1> <foldername2>
// where foldername1 and foldername2 are the names of the folders containing the test images in folderTestSamples.
interface TestResults {
  totalItems: number
  itemsWithIssues: number
  differences: number
  passed: boolean
}

// Main test function
export async function runParsingTest(folderNames?: string[]): Promise<TestResults> {
  console.log('🚀 Running Invoice Parsing Test (Separate Folder Processing)\n')

  const foldersToUse = folderNames
  if (foldersToUse == undefined || foldersToUse.length === 0) {
    console.log('❌ No folders or files provided, quitting now')
    console.log('Usage: npm run test-parse <folder1> <folder2> ...')
    console.log('Example: npm run test-parse Ver1ExpectedResults Ver2ExpectedResults')
    throw new Error('No folders or files provided')
  }
  console.log(`Using test sets: ${foldersToUse.join(', ')}`)

  try {
    // Process each folder separately and combine results
    const actualResults = await parseAllFolders(foldersToUse)

    // Load expected results from all specified test sets 
    const expectedResults = await loadExpectedResults(foldersToUse)

    console.log('\n📋 Validating Results...')
    const issuesFound = validateParseResults(actualResults)

    console.log('\n📋 Comparing with Expected Results...')
    const differences = compareResults(actualResults, expectedResults)

    const passed = issuesFound === 0 && differences === 0

    if (!passed) {
      console.log('\n💡 To debug:')
      if (issuesFound > 0) console.log('   • Check validation issues above for data integrity problems')
      if (differences > 0) console.log('   • Check comparison differences above for expected vs actual mismatches')
      console.log('   • Check individual debug PDFs for each folder')
    }

    console.log('='.repeat(50))

    return {
      totalItems: actualResults.length,
      itemsWithIssues: issuesFound,
      differences,
      passed,
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
    throw error
  }
}

// Process all folders separately and combine results (simplified)
async function parseAllFolders(folderNames: string[]): Promise<any[]> {
  console.log(`🚀 Processing ${folderNames.length} folders separately...`)
  const folderPromises = folderNames.map((folderName) => parseImagesFromFolder(folderName))
  const folderResults = await Promise.all(folderPromises)
  const allResults = folderResults.flat()

  console.log(`\n📊 Combined Results Summary:`)
  console.log(`   Total items from all folders: ${allResults.length}`)
  return allResults
}

// Process images from a single folder through OCR (simplified)
async function parseImagesFromFolder(folderName: string): Promise<any[]> {
  // Load images from this specific folder
  const imageBuffers = loadImagesFromFolder(folderName)
  if (imageBuffers.length === 0) {
    console.log(`⚠️  No images found in ${folderName}, skipping...`)
    return []
  }
  // Convert to Files and create PDF for this folder
  const files = imageBuffers.map((buffer, index) => {
    const fileName = `${folderName}-page-${index}.jpg`
    console.log(`   📄 Creating File ${index + 1}/${imageBuffers.length}: ${fileName}`)
    return new File([buffer], fileName, { type: 'image/jpeg' })
  })

  console.log(`📄 Creating PDF for ${folderName} with ${files.length} pages...`)
  const pdfBase64 = await createPDFFromImages(files)

  console.log(`🔍 Processing ${folderName} PDF through OCR...`)
  const parseResults = await processDocument(pdfBase64)

  console.log(`📊 OCR Results for ${folderName}:`)
  console.log(`   Items found: ${parseResults.invoiceItems.length}`)
  const cleanResults = parseResults.invoiceItems.map((item) => ({
    pageIndex: item.pageIndex,
    itemDescription: item.itemDescription,
    itemId: item.itemId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }))

  console.log(`✅ Processed ${cleanResults.length} items from ${folderName}`)
  return cleanResults
}

// Load images from a single folder
// file must be within a folder
function loadImagesFromFolder(folderName: string): Buffer[] {
  const imageBuffers: Buffer[] = []
  const basePath = './tests/parser/test-images/'
  const folderPath = path.join(basePath, folderName)

  try {
    const stat = fs.statSync(folderPath)

    if (stat.isDirectory()) {
      console.log(`📁 Scanning folder: ${folderPath}`)
      const imageFiles = getImagesFromFolder(folderPath)

      if (imageFiles.length === 0) {
        console.warn(`⚠️  No images found in folder: ${folderPath}`)
        return []
      }

      console.log(`   Found ${imageFiles.length} images: ${imageFiles.join(', ')}`)

      // Load all images from this folder
      for (const imageFile of imageFiles) {
        try {
          const fullPath = path.join(folderPath, imageFile)
          const buffer = fs.readFileSync(fullPath)
          imageBuffers.push(buffer)
          console.log(`   ✅ Loaded: ${imageFile}`)
        } catch {
          console.warn(`   ❌ Could not load: ${imageFile}`)
        }
      }
    }
  } catch {
    console.warn(`❌ Could not access: ${folderPath}`)
  }

  console.log(`📸 Loaded ${imageBuffers.length} images from ${folderName}`)
  return imageBuffers
}

// Get all image files from a folder
function getImagesFromFolder(folderPath: string): string[] {
  const imageExtensions = ['.jpg', '.jpeg']

  try {
    const files = fs.readdirSync(folderPath)
    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase()
      return imageExtensions.includes(ext)
    })

    // Sort files based on number (0 goes before 1)
    return imageFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  } catch {
    console.warn(`❌ Could not read folder: ${folderPath}`)
    return []
  }
}

// Load expected results for multiple test sets
async function loadExpectedResults(folderNames: string[]): Promise<any[]> {
  let allExpectedResults: any[] = []

  for (const folderName of folderNames) {
    try {
      const expectedResultsPath = `./parser/parserTestSamples/${folderName}.js`
      console.log(`📋 Loading expected results from: ${expectedResultsPath}`)
      const { expectedResults } = await import(expectedResultsPath)
      allExpectedResults = allExpectedResults.concat(expectedResults)
      console.log(`   ✅ Loaded ${expectedResults.length} expected items from ${folderName}`)
    } catch (error) {
      console.warn(`⚠️  Could not load expected results for ${folderName}: ${error.message}`)
      console.log(`   Expected file: ./parser/parserTestSamples/${folderName}ExpectedResults.js`)
    }
  }
  console.log(`📋 Total expected results loaded: ${allExpectedResults.length}`)
  return allExpectedResults
}

//Checks for basic data mistakes in the parsed results
function validateParseResults(items: any[]): number {
  let issuesFound = 0

  console.log('Checking data integrity...')

  items.forEach((item, index) => {
    const issues: string[] = []
    if (item.quantity <= 0) {
      issues.push(`Invalid quantity: ${item.quantity} (should be > 0)`)
    }
    if (!item.itemId || item.itemId.trim() === '') {
      issues.push(`Missing or empty itemId`)
    }
    if (!item.itemDescription || item.itemDescription.trim() === '') {
      issues.push(`Missing or empty itemDescription`)
    }
    if (issues.length > 0) {
      console.log(`\n❌ Item ${index} has validation issues:`)
      console.log(`   Description: "${item.itemDescription}"`)
      console.log(`   Item ID: "${item.itemId}"`)
      console.log(`   Quantity: ${item.quantity}`)
      console.log(`   Unit Price: ${item.unitPrice}`)
      console.log(`   Issues found:`)
      issues.forEach((issue) => console.log(`     • ${issue}`))
      console.log('   ---')
      issuesFound++
    }
  })

  if (issuesFound === 0) {
    console.log('✅ All items passed validation!')
  } else {
    console.log(`\n📊 Validation Summary: ${issuesFound} items have validation issues`)
  }

  return issuesFound
}

function compareResults(actual: any[], expected: any[]): number {
  console.log(`Comparing ${actual.length} actual items with ${expected.length} expected items...`)
  console.log(
    '📝 Note: Using itemID fuzzy matching first, falling back to itemDescription matching when itemID is missing'
  )
  console.log('📝 Only showing items with differences (perfect matches are hidden)')

  // Helper function to remove \n since those don't appear in review-items
  // and can cause false mismatches
  function normalizeDescription(desc: string): string {
    return desc.replace(/\n/g, '') // Remove all newlines.
  }

  // Fuse options for primary search method itemID search
  const fuseOptionsItemId = {
    keys: [{ name: 'itemId', weight: 1.0 }],
    threshold: 0.0, // Exact match only
    includeScore: true,
    shouldSort: true,
    minMatchCharLength: 1,
  }

  // Fuse options for description-based search incase itemId is missing
  const fuseOptionsDescription = {
    keys: [{ name: 'itemDescription', weight: 1.0 }],
    threshold: 0.3,
    includeScore: true,
    shouldSort: true,
    minMatchCharLength: 3,
    getFn: (obj: any, path: string | string[]) => {
      const key = Array.isArray(path) ? path[0] : path
      const value = obj[key]
      return typeof value === 'string' ? normalizeDescription(value) : value
    },
  }

  // Helper function to find items by exact itemId
  // Returns all matches for further processing
  function findItemsByFuzzyId(expectedItem: any, actualItems: any[]): any[] {
    if (actualItems.length === 0) return []

    const fuse = new Fuse(actualItems, fuseOptionsItemId)
    const results = fuse.search(expectedItem.itemId)

    // Return all items with good enough scores
    return results.filter((result) => result.score !== undefined && result.score < 0.3).map((result) => result.item)
  }

  // Helper function to find exact match among duplicates from findItemsByFuzzyId
  function findExactMatchAmongDuplicates(expectedItem: any, duplicateItems: any[]): any | null {
    const fields = ['pageIndex', 'itemDescription', 'quantity', 'unitPrice']

    for (const actualItem of duplicateItems) {
      let isExactMatch = true

      for (const field of fields) {
        let actualValue = actualItem[field]
        let expectedValue = expectedItem[field]

        // Normalize descriptions for comparison
        if (field === 'itemDescription') {
          actualValue = normalizeDescription(actualValue)
          expectedValue = normalizeDescription(expectedValue)
        }

        if (actualValue !== expectedValue) {
          isExactMatch = false
          break
        }
      }

      if (isExactMatch) {
        return actualItem
      }
    }

    return null
  }

  // Helper function to find best match using itemId approach
  function findBestMatchByItemId(expectedItem: any, actualItems: any[]): any | null {
    if (actualItems.length === 0) return null

    // Step 1: Find items with matching itemID using fuzzy search
    const itemsWithMatchingId = findItemsByFuzzyId(expectedItem, actualItems)

    if (itemsWithMatchingId.length === 0) {
      return null // No items with matching itemID found
    }

    if (itemsWithMatchingId.length === 1) {
      return itemsWithMatchingId[0] // Only one item with matching itemID
    }

    // Step 2: Multiple items with same itemID, find exact match
    const exactMatch = findExactMatchAmongDuplicates(expectedItem, itemsWithMatchingId)

    if (exactMatch) {
      return exactMatch
    }

    // Step 3: No exact match found among duplicates, remove all duplicates from consideration
    console.log(
      `⚠️  Multiple items found with itemID "${expectedItem.itemId}" but no exact match. Removing ${itemsWithMatchingId.length} items from consideration.`
    )

    // Remove all duplicate items from the actual array
    itemsWithMatchingId.forEach((itemToRemove) => {
      const index = actualItems.indexOf(itemToRemove)
      if (index > -1) {
        actualItems.splice(index, 1)
      }
    })

    return null
  }

  // Helper function to find best match using description approach (from second file)
  function findBestMatchByDescription(expectedItem: any, actualItems: any[]): any | null {
    if (actualItems.length === 0) return null

    // Create Fuse instance with available items
    const fuse = new Fuse(actualItems, fuseOptionsDescription)

    // Search using normalized description
    const searchPattern = normalizeDescription(expectedItem.itemDescription)
    const results = fuse.search(searchPattern)

    if (results.length > 0) {
      const bestMatch = results[0]
      if (bestMatch.score !== undefined && bestMatch.score < 0.4) {
        return bestMatch.item
      }
    }

    // If fuzzy search didn't find a good match, try exact itemId match as fallback
    for (const actualItem of actualItems) {
      if (actualItem.itemId === expectedItem.itemId) {
        return actualItem
      }
    }

    return null
  }

  // Main function to find best match - uses itemId first, falls back to description
  function findBestMatch(expectedItem: any, actualItems: any[]): any | null {
    // Check if itemId exists and is not empty
    if (expectedItem.itemId && expectedItem.itemId.trim() !== '') {
      // Use itemId-based matching
      return findBestMatchByItemId(expectedItem, actualItems)
    } else {
      // Fall back to description-based matching
      console.log(`📝 No itemId found for "${expectedItem.itemDescription}", using description-based matching`)
      return findBestMatchByDescription(expectedItem, actualItems)
    }
  }

  let mismatchCount = 0
  let missingCount = 0

  console.log('\n🔍 DIFFERENCES FOUND:')
  console.log('='.repeat(80))

  // Go through expected results sequentially
  expected.forEach((expectedItem, index) => {
    const actualItem = findBestMatch(expectedItem, actual)

    if (!actualItem) {
      // Item is missing from actual results
      missingCount++
      console.log(`\n❌ Missing Item ${index + 1}: "${expectedItem.itemDescription}"`)
      console.log(`   Expected: ${JSON.stringify(expectedItem)}`)
    } else {
      // Remove the matched item from the actual array
      const itemIndex = actual.indexOf(actualItem)
      if (itemIndex > -1) {
        actual.splice(itemIndex, 1)
      }

      // Item exists in both, check if they match
      const fields = ['pageIndex', 'itemId', 'itemDescription', 'quantity', 'unitPrice']
      const fieldDifferences: { field: string; actual: any; expected: any }[] = []

      for (const field of fields) {
        let actualValue = actualItem[field]
        let expectedValue = expectedItem[field]

        // Normalize descriptions for comparison
        if (field === 'itemDescription') {
          actualValue = normalizeDescription(actualValue)
          expectedValue = normalizeDescription(expectedValue)
        }

        if (actualValue !== expectedValue) {
          fieldDifferences.push({
            field,
            actual: actualItem[field], // Show original values in output
            expected: expectedItem[field],
          })
        }
      }

      const matches = fieldDifferences.length === 0

      if (!matches) {
        mismatchCount++
        console.log(`\n⚠️  Mismatch ${mismatchCount}: "${expectedItem.itemDescription}"`)
        // Show field-by-field differences with clear labels
        fieldDifferences.forEach((diff) => {
          console.log(`   • ${diff.field}: actual="${diff.actual}" expected="${diff.expected}"`)
        })
      }
    }
  })

  // Find extra items in actual that weren't matched
  const extraItems = actual.filter((item) => !matchedActualItems.has(item))
  if (extraItems.length > 0) {
    extraItems.forEach((item, index) => {
      console.log(`\n➕ Extra Item ${index + 1}: "${item.itemDescription}"`)
      console.log(`   Found: ${JSON.stringify(item)}`)
    })
  }

  // Summary statistics
  console.log('\n📊 SUMMARY:')
  console.log(`   Items with differences: ${mismatchCount}`)
  console.log(`   Missing from actual: ${missingCount}`)
  console.log(`   Extra in actual: ${extraItems.length}`)
  console.log(`   Total actual items: ${actual.length}`)
  console.log(`   Total expected items: ${expected.length}`)

  const totalErrors = mismatchCount + missingCount + extraItems.length

  if (totalErrors === 0) {
    console.log('✅ All items match perfectly!')
    return 0
  } else {
    console.log(`❌ Total differences found: ${totalErrors}`)
    return 1
  }
}

// Get command line arguments and run test
const { positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
})

const folderNames = positionals.length > 0 ? positionals : undefined
runParsingTest(folderNames)
  .then((results) => {
    process.exit(results.passed ? 0 : 1)
  })
  .catch((error) => {
    console.error('Test execution failed:', error)
    process.exit(1)
  })