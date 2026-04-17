import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const companies = await client.execute('PRAGMA table_info(companies)')
console.log('companies columns:', companies.rows.map((r: any) => r.name))

const forecast = await client.execute('PRAGMA table_info(forecast_results)')
console.log('forecast_results columns:', forecast.rows.map((r: any) => r.name))

const taxHistory = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tax_rate_history'")
console.log('tax_rate_history exists:', taxHistory.rows.length > 0)

client.close()
