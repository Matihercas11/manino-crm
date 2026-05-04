import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import Orders from "@/pages/Orders";
import Inventory from "@/pages/Inventory";
import Analytics from "@/pages/Analytics";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/clientes" element={<Clients />} />
            <Route path="/clientes/:id" element={<ClientDetail />} />
            <Route path="/pedidos" element={<Orders />} />
            <Route path="/inventario" element={<Inventory />} />
            <Route path="/analisis" element={<Analytics />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#FFFFFF",
            border: "1px solid #E6E2DA",
            color: "#2C2420",
            borderRadius: "4px",
            fontFamily: "'IBM Plex Sans', sans-serif",
          },
        }}
      />
    </div>
  );
}

export default App;
