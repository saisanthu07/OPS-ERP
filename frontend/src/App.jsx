import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Inventory from './pages/Inventory.jsx';
import WorkOrders from './pages/WorkOrders.jsx';
import Transfers from './pages/Transfers.jsx';
import Orders from './pages/Orders.jsx';
import Users from './pages/Users.jsx';
import Terms from './pages/Terms.jsx';
import Privacy from './pages/Privacy.jsx';

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/inventory" replace />;
  }
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/inventory" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/inventory" replace />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="work-orders" element={<WorkOrders />} />
        <Route path="transfers" element={<Transfers />} />
        <Route path="orders" element={<Orders />} />
        <Route path="users" element={user?.role === 'ADMIN' ? <Users /> : <Navigate to="/inventory" replace />} />
      </Route>
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="*" element={<Navigate to="/inventory" replace />} />
    </Routes>
  );
}
