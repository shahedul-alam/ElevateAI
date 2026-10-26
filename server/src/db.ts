import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

export async function connectDb() {
  await prisma.$connect()
  console.log('PostgreSQL connected')
}

export async function isDbConnected() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}

export const disconnectDb = () => prisma.$disconnect()
