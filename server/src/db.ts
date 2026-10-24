import mongoose from 'mongoose'

export async function connectDb() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')

  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'))
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'))
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err))

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  console.log(`MongoDB connected (${mongoose.connection.name})`)
}

export const isDbConnected = () => mongoose.connection.readyState === 1

export const disconnectDb = () => mongoose.disconnect()
