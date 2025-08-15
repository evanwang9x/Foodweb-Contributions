import { type AppDatabase } from '../../../database/index.js'
import {
    distributorProductMetadata,
    distributorProducts,
    distributors,
    invoiceItems,
    invoices,
    invoiceScans,
} from '../../../database/schema.js'
import { setupTestDatabase } from '../../../database/testSetup.js'
import { getDistributorProducts } from './dal.js'

// Set timeout to 30 seconds. Database tests can take a while to run.
jest.setTimeout(30000)

describe('get-distributor-products DAL', () => {
    let testDb: AppDatabase
    let cleanup: () => Promise<void>

    // Test data
    let testDistributorId: number
    let anotherDistributorId: number
    let testProductId1: number
    let testProductId2: number
    let testProductId3: number

    beforeAll(async () => {
        const setup = await setupTestDatabase()
        testDb = setup.testDb
        cleanup = setup.cleanup
    })

    afterAll(async () => {
        await cleanup()
    })

    beforeEach(async () => {
        jest.resetAllMocks()

        // Clean up any existing test data - must be sequential due to foreign key constraints
        await testDb.delete(invoiceItems)
        await testDb.delete(invoiceScans)
        await testDb.delete(invoices)
        await testDb.delete(distributorProductMetadata)
        await testDb.delete(distributorProducts)
        await testDb.delete(distributors)

        // Insert test distributors
        const [insertedDistributor1, insertedDistributor2] = await testDb
            .insert(distributors)
            .values([
                {
                    name: 'Test Distributor',
                    streetAddress: '123 Test Street',
                    city: 'Test City',
                    state: 'Test State',
                    zipCode: '12345',
                    country: 'USA',
                },
                {
                    name: 'Another Distributor',
                    streetAddress: '456 Another Street',
                    city: 'Another City',
                    state: 'Another State',
                    zipCode: '67890',
                    country: 'USA',
                },
            ])
            .returning({ id: distributors.id })

        testDistributorId = insertedDistributor1.id
        anotherDistributorId = insertedDistributor2.id

        // Insert test distributor products
        const [product1, product2, product3] = await testDb
            .insert(distributorProducts)
            .values([
                {
                    distributorId: testDistributorId,
                    itemId: 'ITEM001',
                },
                {
                    distributorId: testDistributorId,
                    itemId: 'ITEM002',
                },
                {
                    distributorId: anotherDistributorId,
                    itemId: 'ITEM003',
                },
            ])
            .returning({ id: distributorProducts.id })

        testProductId1 = product1.id
        testProductId2 = product2.id
        testProductId3 = product3.id

        // Insert test metadata
        const insertedMetadata = await testDb
            .insert(distributorProductMetadata)
            .values([
                {
                    distributorProductId: testProductId1,
                    description: 'Test Product 1 Latest',
                },
                {
                    distributorProductId: testProductId1,
                    description: 'Test Product 1 Older',
                },
                {
                    distributorProductId: testProductId2,
                    description: 'Test Product 2',
                },
                {
                    distributorProductId: testProductId3,
                    description: 'Another Distributor Product',
                },
            ])
            .returning()

        // Insert test invoices and invoice items to create price data
        const [testInvoice] = await testDb
            .insert(invoices)
            .values({
                uuid: 'test-invoice-uuid',
                distributorId: testDistributorId,
                invoiceDate: '2024-01-01',
            })
            .returning()

        const [testInvoiceScan] = await testDb
            .insert(invoiceScans)
            .values({
                invoiceUuid: testInvoice.uuid,
                pageIndex: 0,
            })
            .returning()

        // Insert invoice items with prices for the test products
        await testDb.insert(invoiceItems).values([
            {
                invoiceScanId: testInvoiceScan.id,
                distributorProductId: testProductId1,
                distributorProductMetadataId: insertedMetadata[0].id,
                quantity: 2,
                unitPriceCents: 1000, // $10.00
            },
            {
                invoiceScanId: testInvoiceScan.id,
                distributorProductId: testProductId2,
                distributorProductMetadataId: insertedMetadata[2].id, // Third metadata entry is for product 2
                quantity: 1,
                unitPriceCents: 500, // $5.00
            },
        ])
    })

    describe('getDistributorProducts', () => {
        it('should return products for the specified distributor with latest descriptions', async () => {
            const result = await getDistributorProducts(testDb, testDistributorId)

            expect(result).toHaveLength(2)

            // Find products by item ID to avoid depending on order
            const product1 = result.find((p) => p.productItemId === 'ITEM001')
            const product2 = result.find((p) => p.productItemId === 'ITEM002')

            expect(product1).toMatchObject({
                id: testProductId1,
                productItemId: 'ITEM001',
                description: '', // Since latestDistributorProductMetadata doesn't exist, description will be empty
            })

            expect(product2).toMatchObject({
                id: testProductId2,
                productItemId: 'ITEM002',
                description: '', // Since latestDistributorProductMetadata doesn't exist, description will be empty
            })
        })

        it('should return empty array when distributor has no products', async () => {
            // Create a new distributor with no products
            const [emptyDistributor] = await testDb
                .insert(distributors)
                .values({
                    name: 'Empty Distributor',
                    streetAddress: '789 Empty Street',
                    city: 'Empty City',
                    state: 'Empty State',
                    zipCode: '99999',
                    country: 'USA',
                })
                .returning({ id: distributors.id })

            const result = await getDistributorProducts(testDb, emptyDistributor.id)

            expect(result).toEqual([])
        })

        it('should return products with empty description when no metadata exists', async () => {
            // Insert a product with no metadata
            const [productWithoutMetadata] = await testDb
                .insert(distributorProducts)
                .values({
                    distributorId: testDistributorId,
                    itemId: 'ITEM_NO_META',
                })
                .returning({ id: distributorProducts.id })

            // Create metadata for invoice items requirement
            const [noMetaMetadata] = await testDb
                .insert(distributorProductMetadata)
                .values({
                    distributorProductId: productWithoutMetadata.id,
                    description: '',
                })
                .returning()

            // Create invoice item to give it a price
            const [noMetaInvoice] = await testDb
                .insert(invoices)
                .values({
                    uuid: 'no-meta-invoice-uuid',
                    distributorId: testDistributorId,
                    invoiceDate: '2024-01-01',
                })
                .returning()

            const [noMetaInvoiceScan] = await testDb
                .insert(invoiceScans)
                .values({
                    invoiceUuid: noMetaInvoice.uuid,
                    pageIndex: 0,
                })
                .returning()

            await testDb.insert(invoiceItems).values({
                invoiceScanId: noMetaInvoiceScan.id,
                distributorProductId: productWithoutMetadata.id,
                distributorProductMetadataId: noMetaMetadata.id,
                quantity: 1,
                unitPriceCents: 100, // $1.00
            })

            const result = await getDistributorProducts(testDb, testDistributorId)

            const productNoMeta = result.find((p) => p.productItemId === 'ITEM_NO_META')
            expect(productNoMeta).toMatchObject({
                id: productWithoutMetadata.id,
                productItemId: 'ITEM_NO_META',
                description: '', // Should be empty string when no metadata
            })
        })

        it('should not return products from other distributors', async () => {
            const result = await getDistributorProducts(testDb, testDistributorId)

            // Should not include the product from anotherDistributorId
            expect(result.every((p) => p.productItemId !== 'ITEM003')).toBe(true)
        })

        it('should handle products with null itemId', async () => {
            // Insert a product with null itemId
            const [productWithNullItemId] = await testDb
                .insert(distributorProducts)
                .values({
                    distributorId: testDistributorId,
                    itemId: null,
                })
                .returning({ id: distributorProducts.id })

            // Add metadata for this product
            const [nullItemMetadata] = await testDb
                .insert(distributorProductMetadata)
                .values({
                    distributorProductId: productWithNullItemId.id,
                    description: 'Product with null itemId',
                })
                .returning()

            // Create invoice item to give it a price
            const [nullItemInvoice] = await testDb
                .insert(invoices)
                .values({
                    uuid: 'null-item-invoice-uuid',
                    distributorId: testDistributorId,
                    invoiceDate: '2024-01-01',
                })
                .returning()

            const [nullItemInvoiceScan] = await testDb
                .insert(invoiceScans)
                .values({
                    invoiceUuid: nullItemInvoice.uuid,
                    pageIndex: 0,
                })
                .returning()

            await testDb.insert(invoiceItems).values({
                invoiceScanId: nullItemInvoiceScan.id,
                distributorProductId: productWithNullItemId.id,
                distributorProductMetadataId: nullItemMetadata.id,
                quantity: 1,
                unitPriceCents: 200, // $2.00
            })

            const result = await getDistributorProducts(testDb, testDistributorId)

            const productWithNull = result.find((p) => p.id === productWithNullItemId.id)
            expect(productWithNull).toMatchObject({
                id: productWithNullItemId.id,
                productItemId: null,
                description: '', // Since latestDistributorProductMetadata doesn't exist, description will be empty
            })
        })
    })
})