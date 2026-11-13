import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CoordinatorDashboardPage } from './pages/CoordinatorDashboard/CoordinatorDashboardPage';
import { LoginPage } from './pages/Login/LoginPage';
import { RegisterPage } from './pages/Register/RegisterPage';
import { CreateReportPage } from './pages/Reports/CreateReportPage';
import { ReportsPage } from './pages/Reports/ReportsPage';
import { WorkerDashboardPage } from './pages/WorkerDashboard/WorkerDashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/worker" element={<WorkerDashboardPage />} />
        <Route path="/coordinator" element={<CoordinatorDashboardPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/new" element={<CreateReportPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
