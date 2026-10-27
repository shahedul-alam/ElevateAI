import { Router } from 'express'
import { home } from './home.controller'

// Mounted at the server root (outside /api).
export const homeRouter = Router()

homeRouter.get('/', home)
