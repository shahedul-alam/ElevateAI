import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'
import { env } from './env'

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) })

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
