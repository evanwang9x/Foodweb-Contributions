import { and, eq, gt, isNotNull } from 'drizzle-orm'

import { type AppDatabase } from '../../../database/index.js'
import { distributorProducts, invoiceItems, latestDistributorProductMetadata } from '../../../database/schema.js'

export interface DistributorProduct {
    id: number
    productItemId: string | null
    description: string
}

/**
 * Fetches distributor products with their latest descriptions, filtering out items without invoice items or with zero/null prices
 * @param db - The database instance to use for the query
 * @param distributorId - The ID of the distributor
 * @returns Promise that resolves to an array of distributor products with non-zero prices from invoice items
 */
export async function getDistributorProducts(db: AppDatabase, distributorId: number): Promise<DistributorProduct[]> {
    // Join distributor products with invoice items and latest metadata, filtering for non-zero prices
    const productsWithPrices = await db
        .select({
            id: distributorProducts.id,
            itemId: distributorProducts.itemId,
            description: latestDistributorProductMetadata.description,
        })
        .from(distributorProducts)
        .innerJoin(invoiceItems, eq(distributorProducts.id, invoiceItems.distributorProductId))
        .leftJoin(
            latestDistributorProductMetadata,
            eq(distributorProducts.id, latestDistributorProductMetadata.distributorProductId)
        )
        .where(and(eq(distributorProducts.distributorId, distributorId)))
        .groupBy(distributorProducts.id, distributorProducts.itemId, latestDistributorProductMetadata.description)

    return productsWithPrices.map((product) => ({
        id: Number(product.id),
        productItemId: product.itemId,
        description: product.description ?? '',
    }))
}