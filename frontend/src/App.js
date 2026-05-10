import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import PinGate from "@/components/PinGate";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import Orders from "@/pages/Orders";
import Inventory from "@/pages/Inventory";
import Analytics from "@/pages/Analytics";
import Mercaderia from "@/pages/Mercaderia";
import Entregas from "@/pages/Entregas";
import Proveedores from "@/pages/Proveedores";
import Gastos from "@/pages/Gastos";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <PinGate>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pos" element={<POS />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/clientes/:id" element={<ClientDetail />} />
              <Route path="/pedidos" element={<Orders />} />
              <Route path="/entregas" element={<Entregas />} />
              <Route path="/inventario" element={<Inventory />} />
              <Route path="/mercaderia" element={<Mercaderia />} />
              <Route path="/proveedores" element={<Proveedores />} />
              <Route path="/gastos" element={<Gastos />} />
              <Route path="/analisis" element={<Analytics />} />
            </Route>
          </Routes>
        </PinGate>
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
