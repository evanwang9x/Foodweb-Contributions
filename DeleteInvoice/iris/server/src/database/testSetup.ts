import { exec } from 'child_process'
import { randomUUID } from 'crypto'
import { drizzle } from 'drizzle-orm/postgres-js'
import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import postgres from 'postgres'
import { fileURLToPath } from 'url'
import { promisify } from 'util'

import { CONTAINER_INFO_FILE } from '../../tests/jest/constants.js'
import { type AppDatabase } from './index.js'
import * as schema from './schema.js'

const execAsync = promisify(exec)

async function pushSchemaToDatabase(connectionUri: string) {
    const currentDir = dirname(fileURLToPath(import.meta.url))
    const schemaPath = join(currentDir, './schema.ts')

    try {
        await execAsync(`npx drizzle-kit push --dialect=postgresql --schema="${schemaPath}" --url=${connectionUri}`, {
            cwd: currentDir,
        })
    } catch (error) {
        console.error('Error pushing schema to database:', error)
        throw error
    }
}

async function createNewTestDatabase(
    connectionUri: string
): Promise<{ db: AppDatabase; cleanup: () => Promise<void> }> {
    const originalDbName = new URL(connectionUri).pathname.slice(1)

    const testClient = postgres(connectionUri, { prepare: false })
    const testDbName = `test_${randomUUID().replace(/-/g, '_')}`

    try {
        // Create an empty database
        await testClient.unsafe(`CREATE DATABASE ${testDbName}`)
    } catch (error) {
        console.error('Error creating test database:', error)
        throw error
    } finally {
        await testClient.end()
    }

    // Replace only the database name at the end of the URI
    const baseConnectionUri = connectionUri.replace(new RegExp(`/${originalDbName}$`), '')
    const testConnectionUri = `${baseConnectionUri}/${testDbName}`

    // Use drizzle-kit push to apply schema to the new database
    await pushSchemaToDatabase(testConnectionUri)

    const client = postgres(testConnectionUri, { prepare: false })

    // Create the missing view that's marked as .existing() in schema
    await client`
    CREATE OR REPLACE VIEW vwap_aggregated_product_prices_by_date AS
    SELECT 
      ii.distributor_product_id,
      AVG(ii.unit_price_cents) as aggregated_price,
      i.invoice_date as date
    FROM invoice_items ii
    JOIN invoice_scans isa ON ii.invoice_scan_id = isa.id
    JOIN invoices i ON isa.invoice_uuid = i.uuid
    WHERE ii.unit_price_cents IS NOT NULL AND ii.unit_price_cents > 0
    GROUP BY ii.distributor_product_id, i.invoice_date
    ORDER BY ii.distributor_product_id, i.invoice_date DESC
  `

    const db = drizzle(client, { schema })

    const cleanup = async () => {
        await client.end()
    }

    return { db, cleanup }
}

/**
 * Starts a PostgreSQL test container and sets the DATABASE_URL environment variable
 * @returns Promise<{ testDb: AppDatabase }> - The started container instance and test database connection
 */
export async function setupTestDatabase(): Promise<{
    testDb: AppDatabase
    cleanup: () => Promise<void>
}> {
    const fileContent = await fs.readFile(CONTAINER_INFO_FILE, 'utf-8')
    const { connectionUri } = JSON.parse(fileContent)
    const { db, cleanup } = await createNewTestDatabase(connectionUri)

    return { testDb: db, cleanup }
}