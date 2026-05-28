import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import InventoryItems from './pages/InventoryItems';
import InventoryRequests from './pages/InventoryRequests';
import Login from './pages/Login';
import MedicalMasterData from './pages/MedicalMasterData';
import MedicalRequests from './pages/MedicalRequests';
import ManagementDashboard from './pages/ManagementDashboard';
import ManagementInventory from './pages/ManagementInventory';
import ManagementMedical from './pages/ManagementMedical';
import ManagementOperations from './pages/ManagementOperations';
import ManagementUsers from './pages/ManagementUsers';
import OperationsCalendarGrid from './pages/OperationsCalendarGrid';
import OperationsCalendarPrint from './pages/OperationsCalendarPrint';
import OperationsCalendars from './pages/OperationsCalendars';
import OperationsAttendanceDashboard from './pages/OperationsAttendanceDashboard';
import OperationsDashboard from './pages/OperationsDashboard';
import OperationsHikitsugui from './pages/OperationsHikitsugui';

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
        path="/management"
        element={
          <ProtectedRoute>
            <ManagementDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/management/users"
        element={
          <ProtectedRoute>
            <ManagementUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/management/operations"
        element={
          <ProtectedRoute>
            <ManagementOperations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/management/inventory"
        element={
          <ProtectedRoute>
            <ManagementInventory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/management/medical"
        element={
          <ProtectedRoute>
            <ManagementMedical />
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
      <Route
        path="/operations/calendars"
        element={
          <ProtectedRoute>
            <OperationsCalendars />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations/calendars/:id/grid"
        element={
          <ProtectedRoute>
            <OperationsCalendarGrid />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations/calendars/:id/print"
        element={
          <ProtectedRoute>
            <OperationsCalendarPrint />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations/hikitsugui"
        element={
          <ProtectedRoute>
            <OperationsHikitsugui />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations/attendance-dashboard"
        element={
          <ProtectedRoute>
            <OperationsAttendanceDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations/dashboard"
        element={
          <ProtectedRoute>
            <OperationsDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
