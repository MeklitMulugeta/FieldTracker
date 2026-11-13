import type { NextFunction, Request, Response } from 'express';
import { getHealthStatus, getSupabaseRuntimeStatus } from '../services/healthService.js';

export function getHealth(_req: Request, res: Response): void {
  const payload = getHealthStatus();
  res.status(200).json(payload);
}

export async function getSupabaseHealth(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const payload = await getSupabaseRuntimeStatus();
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
}
