import { Hono } from 'hono'

import createListRoute from './create/route.js'
import deleteListRoute from './delete/route.js'
import { getListRoute } from './get-list/route.js'
import getListsRoute from './get-lists/route.js'
import manageShoppingListItemsRoute from './manage-shopping-list-items/route.js'
import userShoppingListRolesRoute from './share-list/route.js'

const shoppingListsRouter = new Hono()
    .route('/shopping-lists', createListRoute)
    .route('/shopping-lists', getListsRoute)
    .route('/shopping-lists', getListRoute)
    .route('/shopping-lists', manageShoppingListItemsRoute)
    .route('/shopping-lists', deleteListRoute)
    .route('/shopping-lists', userShoppingListRolesRoute)

export default shoppingListsRouter