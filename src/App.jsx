import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import InventoryItems from './pages/InventoryItems';
import InventoryRequests from './pages/InventoryRequests';
import Login from './pages/Login';
import MedicalMasterData from './pages/MedicalMasterData';
import MedicalRequests from './pages/MedicalRequests';

function ProtectedRoute({ children }) {
  const hasToken = Boolean(localStorage.getItem('access'));

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees"
        element={
          <ProtectedRoute>
            <EmployeeDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory/items"
        element={
          <ProtectedRoute>
            <InventoryItems />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory/requests"
        element={
          <ProtectedRoute>
            <InventoryRequests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/medical/requests"
        element={
          <ProtectedRoute>
            <MedicalRequests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/medical/master-data"
        element={
          <ProtectedRoute>
            <MedicalMasterData />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
