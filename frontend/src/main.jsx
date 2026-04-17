import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { StaffAuthProvider } from "./context/StaffAuthContext.jsx";
import { CustomerAuthProvider } from "./context/CustomerAuthContext.jsx";
import App from "./App.jsx";
import "./theme.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <StaffAuthProvider>
          <CustomerAuthProvider>
            <App />
          </CustomerAuthProvider>
        </StaffAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
