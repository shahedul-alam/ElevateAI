import { disconnectDb } from '../src/config/db'
import { seedCatalog } from '../src/modules/catalog/catalog.service'

const { terms } = await seedCatalog()
console.log(`Catalog seeded: ${terms} terms`)

await disconnectDb()
