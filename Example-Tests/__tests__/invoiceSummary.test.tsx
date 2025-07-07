import { cleanup, render, waitFor } from '@testing-library/react-native'
import { act } from '@testing-library/react-native'
import React from 'react'

import { InvoiceSummary } from '@/components/scan/InvoiceSummary'
import { AugmentedInvoiceItem } from '@/components/scan/types/augmentedInvoiceItem'

describe('<InvoiceSummary />', () => {
    afterEach(() => {
        cleanup()
    })

    const createMockItem = (overrides: Partial<AugmentedInvoiceItem> = {}): AugmentedInvoiceItem => ({
        itemDescription: 'Test Item Description',
        pageIndex: 0,
        unitPriceCents: 1099,
        quantity: 1,
        itemId: 'item-123',

        index: 0,
        needsAttention: false,

        ...overrides,
    })

    test('rendering the correct amt of items', async () => {
        const items = [createMockItem()]

        const { getByText } = render(<InvoiceSummary items={items} />)

        await act(async () => {
            expect(getByText('1 item scanned')).toBeTruthy()
        })
    })

    test('should display correct count for multiple items', async () => {
        const items = [
            createMockItem({ index: 0, itemId: 'item-1' }),
            createMockItem({ index: 1, itemId: 'item-2' }),
            createMockItem({ index: 2, itemId: 'item-3' }),
        ]

        const { getByText } = render(<InvoiceSummary items={items} />)

        await act(async () => {
            expect(getByText('3 items scanned')).toBeTruthy()
        })
    })

    test('should not show attention warning when no items need attention', async () => {
        const items = [createMockItem({ needsAttention: false }), createMockItem({ needsAttention: false })]

        const { queryByText } = render(<InvoiceSummary items={items} />)

        await act(async () => {
            expect(queryByText(/unusual/)).toBeFalsy()
        })
    })

    test('should show attention warning for single item needing attention', async () => {
        const items = [createMockItem({ needsAttention: true }), createMockItem({ needsAttention: false })]

        const { getByText } = render(<InvoiceSummary items={items} />)

        await waitFor(() => {
            expect(getByText('2 items scanned')).toBeTruthy()
            expect(getByText('1 item looks unusual')).toBeTruthy()
        })
    })

    test('should show attention warning for multiple items needing attention', async () => {
        const items = [
            createMockItem({ index: 0, itemId: 'item-1', needsAttention: true }),
            createMockItem({ index: 1, itemId: 'item-2', needsAttention: true }),
            createMockItem({ index: 2, itemId: 'item-3', needsAttention: false }),
        ]

        const { getByText } = render(<InvoiceSummary items={items} />)

        await waitFor(() => {
            expect(getByText('3 items scanned')).toBeTruthy()
            expect(getByText('2 items look unusual')).toBeTruthy()
        })
    })

    test('should handle empty items array', async () => {
        const items: AugmentedInvoiceItem[] = []

        const { getByText } = render(<InvoiceSummary items={items} />)

        await act(async () => {
            expect(getByText('0 items scanned')).toBeTruthy()
        })
    })

    test('should handle items with null itemId', async () => {
        const items = [
            createMockItem({ itemId: null, needsAttention: true }),
            createMockItem({ itemId: 'valid-item-id', needsAttention: false }),
        ]

        const { getByText } = render(<InvoiceSummary items={items} />)

        await act(async () => {
            expect(getByText('2 items scanned')).toBeTruthy()
            expect(getByText('1 item looks unusual')).toBeTruthy()
        })
    })
})
