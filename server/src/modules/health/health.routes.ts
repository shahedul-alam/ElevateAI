import { Router } from 'express'
import { health } from './health.controller'

export const healthRouter = Router()

healthRouter.get('/health', health)
