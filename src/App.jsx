// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AuthProvider from "./auth/AuthProvider";
import ProtectedRoute from "./auth/ProtectedRoute";

import Home from "./components/Home/Home.jsx";
import CarListRegular from "./components/Car/CarListRegular";
import CarListSplit from "./components/Car/CarListSplit";
import CustomerAppointmentList from "./components/CustomerAppointment/CustomerAppointmentList";
import ReconditionerAppointmentList from "./components/ReconditionerAppointment/ReconditionerAppointmentList";
import TaskList from "./components/Tasks/TaskList";
import Login from "./components/Auth/Login.jsx";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/car-list" element={<ProtectedRoute><CarListRegular /></ProtectedRoute>} />
          <Route path="/car-list-split" element={<ProtectedRoute><CarListSplit /></ProtectedRoute>} />
          <Route path="/customer-appointment-list" element={<ProtectedRoute><CustomerAppointmentList /></ProtectedRoute>} />
          <Route path="/reconditioner-appointment-list" element={<ProtectedRoute><ReconditionerAppointmentList /></ProtectedRoute>} />
          <Route path="/task-list" element={<ProtectedRoute><TaskList /></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
export default App;
