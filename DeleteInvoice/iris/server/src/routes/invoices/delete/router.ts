import { Hono } from 'hono'

import deleteInvoiceRoute from './delete/route.js'
import { parseRoute } from './parse/index.js'
import { saveRoute } from './save/index.js'
const invoicesRouter = new Hono()
    .route('/invoices', parseRoute)
    .route('/invoices', saveRoute)
    .route('/invoices', deleteInvoiceRoute)

export default invoicesRouter