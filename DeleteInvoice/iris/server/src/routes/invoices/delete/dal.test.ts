import { type AppDatabase } from '../../../database/index.js'
import { distributors, invoices, restaurants } from '../../../database/schema.js'
import { setupTestDatabase } from '../../../database/testSetup.js'
import { deleteUserInvoice } from './dal.js'

// Set timeout to 30 seconds. Database tests can take a while to run.
jest.setTimeout(30000)

describe('deleteUserInvoice', () => {
    let testDb: AppDatabase
    let cleanup: () => Promise<void>

    // Test data IDs
    let testDistributorId: number
    let testRestaurantId: number
    let anotherRestaurantId: number

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

        // Clean up any existing test data
        await testDb.delete(invoices)
        await testDb.delete(restaurants)
        await testDb.delete(distributors)

        // Insert test distributor
        const [insertedDistributor] = await testDb
            .insert(distributors)
            .values({
                name: 'Test Distributor',
                streetAddress: '123 Test Street',
                city: 'Test City',
                state: 'Test State',
                zipCode: '12345',
                country: 'USA',
            })
            .returning({ id: distributors.id })

        testDistributorId = insertedDistributor.id

        // Insert test restaurants
        const [restaurant1, restaurant2] = await testDb
            .insert(restaurants)
            .values([
                {
                    name: 'Test Restaurant 1',
                },
                {
                    name: 'Test Restaurant 2',
                },
            ])
            .returning({ id: restaurants.id })

        testRestaurantId = restaurant1.id
        anotherRestaurantId = restaurant2.id
    })

    it('should successfully delete an invoice when it exists and belongs to the restaurant', async () => {
        const invoiceId = 'test-invoice-uuid'

        // Insert test invoice
        await testDb.insert(invoices).values({
            uuid: invoiceId,
            distributorId: testDistributorId,
            restaurantId: testRestaurantId,
            invoiceDate: '2024-01-01',
        })

        // Verify invoice exists before deletion
        const invoiceBeforeDelete = await testDb.query.invoices.findFirst({
            where: (invoices, { eq }) => eq(invoices.uuid, invoiceId),
        })
        expect(invoiceBeforeDelete).toBeDefined()

        // Delete the invoice
        await deleteUserInvoice(testDb, invoiceId, testRestaurantId)

        // Verify invoice has been deleted
        const invoiceAfterDelete = await testDb.query.invoices.findFirst({
            where: (invoices, { eq }) => eq(invoices.uuid, invoiceId),
        })
        expect(invoiceAfterDelete).toBeUndefined()
    })

    it('should throw "Invoice not found" error when invoice does not exist', async () => {
        const nonExistentInvoiceId = 'non-existent-invoice'

        await expect(deleteUserInvoice(testDb, nonExistentInvoiceId, testRestaurantId)).rejects.toThrow('Invoice not found')
    })

    it('should throw "Access denied" error when invoice belongs to different restaurant', async () => {
        const invoiceId = 'test-invoice-uuid'

        // Insert test invoice belonging to testRestaurantId
        await testDb.insert(invoices).values({
            uuid: invoiceId,
            distributorId: testDistributorId,
            restaurantId: testRestaurantId,
            invoiceDate: '2024-01-01',
        })

        // Try to delete with different restaurant ID
        await expect(deleteUserInvoice(testDb, invoiceId, anotherRestaurantId)).rejects.toThrow('Access denied')

        // Verify invoice still exists (wasn't deleted)
        const invoiceAfterFailedDelete = await testDb.query.invoices.findFirst({
            where: (invoices, { eq }) => eq(invoices.uuid, invoiceId),
        })
        expect(invoiceAfterFailedDelete).toBeDefined()
        expect(invoiceAfterFailedDelete?.restaurantId).toBe(testRestaurantId)
    })

    it('should handle database transaction properly by rolling back on errors', async () => {
        const invoiceId = 'test-invoice-uuid'

        // Insert test invoice
        await testDb.insert(invoices).values({
            uuid: invoiceId,
            distributorId: testDistributorId,
            restaurantId: testRestaurantId,
            invoiceDate: '2024-01-01',
        })

        // Try to delete with wrong restaurant ID (should fail and rollback)
        await expect(deleteUserInvoice(testDb, invoiceId, anotherRestaurantId)).rejects.toThrow('Access denied')

        // Verify invoice still exists (transaction was rolled back)
        const invoiceAfterFailedDelete = await testDb.query.invoices.findFirst({
            where: (invoices, { eq }) => eq(invoices.uuid, invoiceId),
        })
        expect(invoiceAfterFailedDelete).toBeDefined()
    })

    it('should handle invoices with null restaurantId', async () => {
        const invoiceId = 'test-invoice-uuid-null-restaurant'

        // Insert test invoice with null restaurantId
        await testDb.insert(invoices).values({
            uuid: invoiceId,
            distributorId: testDistributorId,
            restaurantId: null,
            invoiceDate: '2024-01-01',
        })

        // Try to delete with any restaurant ID should fail
        await expect(deleteUserInvoice(testDb, invoiceId, testRestaurantId)).rejects.toThrow('Access denied')

        // Verify invoice still exists
        const invoiceAfterFailedDelete = await testDb.query.invoices.findFirst({
            where: (invoices, { eq }) => eq(invoices.uuid, invoiceId),
        })
        expect(invoiceAfterFailedDelete).toBeDefined()
    })
})