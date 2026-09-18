import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import ExpensesPage from '@/features/expenses/pages/ExpensesPage';
import EmpanadasPage from '@/features/empanadas/pages/EmpanadasPage';
import EmpanadaVendorLibraryPage from '@/features/empanadas/pages/EmpanadaVendorLibraryPage';
import MealsPage from '@/features/meals/pages/MealsPage';
import RecurringFoodLibraryPage from '@/features/meals/pages/RecurringFoodLibraryPage';
import RecipeLibraryPage from '@/features/meals/pages/RecipeLibraryPage';
import ShoppingPage from '@/features/shopping/pages/ShoppingPage';
import LeftoversPage from '@/features/leftovers/pages/LeftoversPage';
import TripMembersPage from '@/features/members/pages/TripMembersPage';
import TripLayout from '@/features/trips/layouts/TripLayout';
import TripDashboardPage from '@/features/trips/pages/TripDashboardPage';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/layouts/AppLayout';
import CreateExpensePage from '@/pages/CreateExpensePage';
import CreateGroupPage from '@/pages/CreateGroupPage';
import CreatePaymentPage from '@/pages/CreatePaymentPage';
import EditExpensePage from '@/pages/EditExpensePage';
import EditGroupPage from '@/pages/EditGroupPage';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';

function ProtectedRoute({ children }) {
  const { authLoading, isAuthenticated } = useAuth();

  if (authLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function LegacyGroupRedirect({ buildPath }) {
  const params = useParams();
  const location = useLocation();

  return <Navigate to={`${buildPath(params)}${location.search}`} replace />;
}

function AppRoutes() {
  const { authLoading } = useAuth();

  if (authLoading) {
    return null;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />

        <Route path="/viajes/nuevo" element={<CreateGroupPage />} />
        <Route path="/biblioteca-comidas" element={<RecipeLibraryPage />} />
        <Route path="/biblioteca-recurrentes" element={<RecurringFoodLibraryPage />} />
        <Route path="/biblioteca-empanadas" element={<EmpanadaVendorLibraryPage />} />

        <Route path="/viajes/:groupId" element={<TripLayout />}>
          <Route index element={<TripDashboardPage />} />
          <Route path="gastos" element={<ExpensesPage />} />
          <Route path="comidas" element={<MealsPage />} />
          <Route path="compras" element={<ShoppingPage />} />
          <Route path="empanadas" element={<EmpanadasPage />} />
          <Route path="sobras" element={<LeftoversPage />} />
          <Route path="participantes" element={<TripMembersPage />} />
        </Route>

        <Route path="/viajes/:groupId/editar" element={<EditGroupPage />} />
        <Route path="/viajes/:groupId/gastos/nuevo" element={<CreateExpensePage />} />
        <Route path="/viajes/:groupId/gastos/:expenseId/editar" element={<EditExpensePage />} />
        <Route path="/viajes/:groupId/pagos/nuevo" element={<CreatePaymentPage />} />

        <Route
          path="/grupos/nuevo"
          element={<LegacyGroupRedirect buildPath={() => '/viajes/nuevo'} />}
        />
        <Route
          path="/grupos/:groupId"
          element={<LegacyGroupRedirect buildPath={({ groupId }) => `/viajes/${groupId}`} />}
        />
        <Route
          path="/grupos/:groupId/editar"
          element={<LegacyGroupRedirect buildPath={({ groupId }) => `/viajes/${groupId}/editar`} />}
        />
        <Route
          path="/grupos/:groupId/gastos/nuevo"
          element={<LegacyGroupRedirect buildPath={({ groupId }) => `/viajes/${groupId}/gastos/nuevo`} />}
        />
        <Route
          path="/grupos/:groupId/gastos/:expenseId/editar"
          element={
            <LegacyGroupRedirect
              buildPath={({ groupId, expenseId }) => `/viajes/${groupId}/gastos/${expenseId}/editar`}
            />
          }
        />
        <Route
          path="/grupos/:groupId/pagos/nuevo"
          element={<LegacyGroupRedirect buildPath={({ groupId }) => `/viajes/${groupId}/pagos/nuevo`} />}
        />
        <Route
          path="/grupos/:groupId/comidas"
          element={<LegacyGroupRedirect buildPath={({ groupId }) => `/viajes/${groupId}/comidas`} />}
        />
        <Route
          path="/grupos/:groupId/compras"
          element={<LegacyGroupRedirect buildPath={({ groupId }) => `/viajes/${groupId}/compras`} />}
        />
        <Route
          path="/grupos/:groupId/empanadas"
          element={<LegacyGroupRedirect buildPath={({ groupId }) => `/viajes/${groupId}/empanadas`} />}
        />
        <Route
          path="/grupos/:groupId/sobras"
          element={<LegacyGroupRedirect buildPath={({ groupId }) => `/viajes/${groupId}/sobras`} />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
