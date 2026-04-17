import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./admin/AdminLayout.jsx";
import AdminDashboard from "./admin/AdminDashboard.jsx";
import OperationsPage from "./admin/OperationsPage.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import DemoMern from "./pages/DemoMern.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import Reservations from "./pages/Reservations.jsx";
import OffersPage from "./pages/OffersPage.jsx";
import BookPage from "./pages/BookPage.jsx";
import CustomerLogin from "./pages/CustomerLogin.jsx";
import CustomerRegister from "./pages/CustomerRegister.jsx";
import GuestProfilePage from "./pages/GuestProfilePage.jsx";
import CustomerChangePasswordPage from "./pages/CustomerChangePasswordPage.jsx";
import StaffLogin from "./pages/StaffLogin.jsx";
import StaffLayout from "./staff/StaffLayout.jsx";
import StaffDashboard from "./staff/StaffDashboard.jsx";
import RoomManagement from "./staff/RoomManagement.jsx";
import CustomerManagement from "./staff/CustomerManagement.jsx";
import ReceptionistBookings from "./staff/ReceptionistBookings.jsx";
import KitchenMenuManagement from "./staff/KitchenMenuManagement.jsx";
import FoodOrderingPage from "./pages/FoodOrderingPage.jsx";
import ReviewManagement from "./staff/ReviewManagement.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/reservations" element={<Reservations />} />
      <Route path="/offers" element={<OffersPage />} />
      <Route path="/book" element={<BookPage />} />
      <Route path="/restaurant" element={<FoodOrderingPage />} />
      <Route path="/account/login" element={<CustomerLogin />} />
      <Route path="/account/register" element={<CustomerRegister />} />
      <Route path="/account/profile" element={<GuestProfilePage />} />
      <Route path="/account/change-password" element={<CustomerChangePasswordPage />} />
      <Route path="/demo" element={<DemoMern />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/staff/login" element={<StaffLogin />} />

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="operations" element={<OperationsPage />} />
      </Route>

      <Route path="/staff" element={<StaffLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<StaffDashboard />} />
        <Route path="rooms" element={<RoomManagement />} />
        <Route path="customers" element={<CustomerManagement />} />
        <Route path="bookings" element={<ReceptionistBookings />} />
        <Route path="kitchen" element={<KitchenMenuManagement />} />
        <Route path="reviews" element={<ReviewManagement />} />
      </Route>
    </Routes>
  );
}
