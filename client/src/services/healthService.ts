import { apiGet } from './apiClient';

export interface HealthResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

export function fetchApiHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>('/health');
}
