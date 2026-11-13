import { Router } from 'express';
import { getHealth, getSupabaseHealth } from '../controllers/healthController.js';

const healthRoutes = Router();

healthRoutes.get('/', getHealth);
healthRoutes.get('/supabase', getSupabaseHealth);

export default healthRoutes;
