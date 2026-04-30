import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';
import ReposPage from '@/pages/ReposPage';
import IDEPage from '@/pages/IDEPage';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/repos" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/repos"
        element={
          <ProtectedRoute>
            <ReposPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ide/:workspace"
        element={
          <ProtectedRoute>
            <IDEPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
