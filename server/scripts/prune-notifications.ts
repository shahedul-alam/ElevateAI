import { disconnectDb } from '../src/config/db'
import { pruneNotifications } from '../src/modules/notifications/notifications.service'

const count = await pruneNotifications()
console.log(`Deleted ${count} expired notification(s)`)

await disconnectDb()
