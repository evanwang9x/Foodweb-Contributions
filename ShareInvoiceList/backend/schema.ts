import { relations } from 'drizzle-orm'
import {
    bigint,
    bigserial,
    boolean,
    date,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    pgView,
    real,
    text,
    timestamp,
    unique,
    uuid,
} from 'drizzle-orm/pg-core'

export const ocrProviderEnum = pgEnum('ocr_provider', ['azure_document_intelligence'])
export const shoppingListPermissionTypeEnum = pgEnum('shopping_list_permission_type', ['owner', 'editor'])

// Define the type for a single time entry
type TimeEntry = {
    hour: number
    minute: number
}

// Define the type for a business hours interval
type BusinessHoursInterval = {
    start: TimeEntry
    end: TimeEntry
}


export const shoppingListsRelations = relations(shoppingLists, ({ one, many }) => ({
    distributor: one(distributors, {
        fields: [shoppingLists.distributorId],
        references: [distributors.id],
    }),
    items: many(shoppingListItems),
    userRoles: many(usersShoppingListRoles),
}))

export const usersShoppingListRoles = pgTable(
    'users_shopping_list_roles',
    {
        id: bigserial({ mode: 'number' }).primaryKey(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        shoppingListId: bigint('shopping_list_id', { mode: 'number' })
            .notNull()
            .references(() => shoppingLists.id, { onDelete: 'cascade' }),
        userId: uuid('user_id').notNull(),
        permissions: shoppingListPermissionTypeEnum('permissions').notNull(),
    },
    (table) => ({
        userListUnique: unique().on(table.shoppingListId, table.userId),
    })
)

export const usersShoppingListRolesRelations = relations(usersShoppingListRoles, ({ one }) => ({
    shoppingList: one(shoppingLists, {
        fields: [usersShoppingListRoles.shoppingListId],
        references: [shoppingLists.id],
    }),
    user: one(users, {
        fields: [usersShoppingListRoles.userId],
        references: [users.id],
    }),
}))
