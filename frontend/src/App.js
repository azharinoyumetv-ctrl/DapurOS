import { sessionToken } from "@/auth/session";
import "@/styles/android-restaurant.css";
import { useEffect } from "react";
import PasswordSetup from "@/auth/PasswordSetup";
import { firstAllowedPath } from "@/auth/permissions";
import { deferred } from "@/navigation/DeferredPage";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { Toaster } from "@/components/ui/sonner";

const DagangOS = deferred(() => import("@/pages/DagangOS"));
const DapurOS = deferred(() => import("@/pages/DapurOS"));
const Pricing = deferred(() => import("@/pages/Pricing"));
import Login from "@/pages/Login";
const Register = deferred(() => import("@/pages/Register"));
import AppLayout from "@/layouts/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import POS from "@/pages/POS";
const Sales = deferred(() => import("@/pages/Sales"));
const About = deferred(() => import("@/pages/About"));
const LicenseDevices = deferred(() => import("@/pages/LicenseDevices"));

// Submodules
const Categories = deferred(() => import("@/pages/products/Categories"));
const Brands = deferred(() => import("@/pages/products/Brands"));
const Units = deferred(() => import("@/pages/products/Units"));
const StockAdjustment = deferred(() => import("@/pages/products/StockAdjustment"));
const StockTransfer = deferred(() => import("@/pages/products/StockTransfer"));
const Ingredients = deferred(() => import("@/pages/products/Ingredients"));

const StockOverview = deferred(() => import("@/pages/inventory/StockOverview"));
const StockMovement = deferred(() => import("@/pages/inventory/StockMovement"));
const InventoryValuation = deferred(() => import("@/pages/inventory/InventoryValuation"));
const LowStock = deferred(() => import("@/pages/inventory/LowStock"));
const DeadStock = deferred(() => import("@/pages/inventory/DeadStock"));

const PurchaseOrder = deferred(() => import("@/pages/purchase/PurchaseOrder"));
const GoodsReceiving = deferred(() => import("@/pages/purchase/GoodsReceiving"));
const SupplierInvoice = deferred(() => import("@/pages/purchase/SupplierInvoice"));

const SupplierList = deferred(() => import("@/pages/supplier/SupplierList"));

const CustomerList = deferred(() => import("@/pages/customer/CustomerList"));
const Membership = deferred(() => import("@/pages/customer/Membership"));
const LoyaltyPoints = deferred(() => import("@/pages/customer/LoyaltyPoints"));

const AccountsReceivable = deferred(() => import("@/pages/debt/AccountsReceivable"));
const AccountsPayable = deferred(() => import("@/pages/debt/AccountsPayable"));

const PaymentConfig = deferred(() => import("@/pages/payments/PaymentConfig"));
const Reports = deferred(() => import("@/pages/reports/Reports"));

const StaffManagement = deferred(() => import("@/pages/staff/StaffManagement"));
const Roles = deferred(() => import("@/pages/staff/Roles"));
const Permissions = deferred(() => import("@/pages/staff/Permissions"));
const Attendance = deferred(() => import("@/pages/staff/Attendance"));

const BranchManagement = deferred(() => import("@/pages/branches/BranchManagement"));
const Integrations = deferred(() => import("@/pages/integrations/Integrations"));
const Settings = deferred(() => import("@/pages/settings/Settings"));

import RoleGuard from "@/components/RoleGuard";
const KdsScreen = deferred(() => import("@/pages/KdsScreen"));
const QrMenu = deferred(() => import("@/pages/products/QrMenu"));
const Activate = deferred(() => import("@/pages/Activate"));

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-sm text-center text-[hsl(var(--muted))]" data-testid="auth-loading">Memuat sesi…</div>;
  if (!user) return <Navigate to="/dapuros/login" replace />;
  if (user.must_change_password) return <PasswordSetup />;
  return children;
}

function AndroidRouterBridge() {
 const navigate = useNavigate();
 useEffect(() => {
  const router = { navigate: href => { const url = new URL(href, location.origin); if (url.origin !== location.origin || !url.pathname.startsWith('/dapuros/app/')) return false; navigate(url.pathname + url.search + url.hash); return true; } };
  window.DapurOSRouter = router; return () => { if (window.DapurOSRouter === router) delete window.DapurOSRouter; };
 }, [navigate]); return null;
}

function RootComponent() {
  const { user, loading } = useAuth();
  const token = typeof window !== "undefined" ? sessionToken() : null;

  if (loading) return <div className="p-10 text-sm text-center text-[hsl(var(--muted))]" data-testid="root-loading">Memuat…</div>;
  if (user || token) {
    return <Navigate to={firstAllowedPath(user?.role)} replace />;
  }
  return <DapurOS />;
}

function IndexRedirect() {

  return <Navigate to="dashboard" replace />;
}

function getAppSubRoutes() {
  return [
    <Route key="idx" index element={<IndexRedirect />} />,
    
    <Route key="r-attendance-self" path="attendance" element={<RoleGuard><Attendance /></RoleGuard>} />,
    /* General Routes */
    <Route key="r-dash" path="dashboard" element={<RoleGuard><Dashboard /></RoleGuard>} />,
    <Route key="r-pos" path="pos" element={<RoleGuard><POS /></RoleGuard>} />,
    <Route key="r-kds" path="kds" element={<RoleGuard><KdsScreen /></RoleGuard>} />,
    <Route key="r-qr" path="qr-menu" element={<RoleGuard><QrMenu /></RoleGuard>} />,
    <Route key="r-sales" path="sales" element={<RoleGuard><Sales /></RoleGuard>} />,
    <Route key="r-lic" path="license" element={<RoleGuard><LicenseDevices /></RoleGuard>} />,
    <Route key="r-abt" path="about" element={<RoleGuard><About /></RoleGuard>} />,

    /* Produk & Bahan Baku BOM */
    <Route key="r-p" path="products" element={<RoleGuard><Products /></RoleGuard>} />,
    <Route key="r-pc" path="products/categories" element={<RoleGuard><Categories /></RoleGuard>} />,
    <Route key="r-pb" path="products/brands" element={<RoleGuard><Brands /></RoleGuard>} />,
    <Route key="r-pu" path="products/units" element={<RoleGuard><Units /></RoleGuard>} />,
    <Route key="r-psa" path="products/stock-adjustment" element={<RoleGuard><StockAdjustment /></RoleGuard>} />,
    <Route key="r-pst" path="products/stock-transfer" element={<RoleGuard><StockTransfer /></RoleGuard>} />,
    <Route key="r-pi" path="products/ingredients" element={<RoleGuard><Ingredients /></RoleGuard>} />,
    <Route key="r-[ii]" path="inventory/ingredients" element={<RoleGuard><Ingredients /></RoleGuard>} />,
    <Route key="r-irm" path="inventory/raw-materials" element={<RoleGuard><Ingredients /></RoleGuard>} />,
    <Route key="r-rm" path="raw-materials" element={<RoleGuard><Ingredients /></RoleGuard>} />,
    <Route key="r-ing" path="ingredients" element={<RoleGuard><Ingredients /></RoleGuard>} />,
    <Route key="r-bom" path="bom" element={<RoleGuard><Ingredients /></RoleGuard>} />,
    <Route key="r-rec" path="recipes" element={<RoleGuard><Ingredients /></RoleGuard>} />,

    /* Inventory */
    <Route key="r-inv" path="inventory" element={<RoleGuard><StockOverview /></RoleGuard>} />,
    <Route key="r-invo" path="inventory/overview" element={<RoleGuard><StockOverview /></RoleGuard>} />,
    <Route key="r-invm" path="inventory/movement" element={<RoleGuard><StockMovement /></RoleGuard>} />,
    <Route key="r-invv" path="inventory/valuation" element={<RoleGuard><InventoryValuation /></RoleGuard>} />,
    <Route key="r-invl" path="inventory/low-stock" element={<RoleGuard><LowStock /></RoleGuard>} />,
    <Route key="r-invd" path="inventory/dead-stock" element={<RoleGuard><DeadStock /></RoleGuard>} />,

    /* Purchase */
    <Route key="r-pur" path="purchase" element={<RoleGuard><PurchaseOrder /></RoleGuard>} />,
    <Route key="r-puro" path="purchase/orders" element={<RoleGuard><PurchaseOrder /></RoleGuard>} />,
    <Route key="r-purr" path="purchase/receiving" element={<RoleGuard><GoodsReceiving /></RoleGuard>} />,
    <Route key="r-puri" path="purchase/invoices" element={<RoleGuard><SupplierInvoice /></RoleGuard>} />,

    /* Supplier */
    <Route key="r-sup" path="suppliers" element={<RoleGuard><SupplierList /></RoleGuard>} />,

    /* Customer */
    <Route key="r-cust" path="customers" element={<RoleGuard><CustomerList /></RoleGuard>} />,
    <Route key="r-custm" path="customers/membership" element={<RoleGuard><Membership /></RoleGuard>} />,
    <Route key="r-custl" path="customers/loyalty" element={<RoleGuard><LoyaltyPoints /></RoleGuard>} />,

    /* Hutang Piutang */
    <Route key="r-debt" path="debt" element={<RoleGuard><AccountsReceivable /></RoleGuard>} />,
    <Route key="r-debtr" path="debt/receivable" element={<RoleGuard><AccountsReceivable /></RoleGuard>} />,
    <Route key="r-debtp" path="debt/payable" element={<RoleGuard><AccountsPayable /></RoleGuard>} />,

    /* Payments */
    <Route key="r-payt" path="settings/payments/:type" element={<RoleGuard><PaymentConfig /></RoleGuard>} />,
    <Route key="r-payw" path="settings/payments/*" element={<RoleGuard><PaymentConfig /></RoleGuard>} />,
    <Route key="r-[#pay]" path="settings/payments" element={<RoleGuard><PaymentConfig /></RoleGuard>} />,
    <Route key="r-pt" path="payments/:type" element={<RoleGuard><PaymentConfig /></RoleGuard>} />,
    <Route key="r-[pw]" path="payments/*" element={<RoleGuard><PaymentConfig /></RoleGuard>} />,
    <Route key="r-[p]" path="payments" element={<RoleGuard><PaymentConfig /></RoleGuard>} />,

    /* Reports */
    <Route key="r-rept" path="reports/:type" element={<RoleGuard><Reports /></RoleGuard>} />,
    <Route key="r-repw" path="reports/*" element={<RoleGuard><Reports /></RoleGuard>} />,
    <Route key="r-rep" path="reports" element={<RoleGuard><Reports /></RoleGuard>} />,

    /* Staff */
    <Route key="r-stfm" path="staff/management" element={<RoleGuard><StaffManagement /></RoleGuard>} />,
    <Route key="r-stfr" path="staff/roles" element={<RoleGuard><Roles /></RoleGuard>} />,
    <Route key="r-stfp" path="staff/permissions" element={<RoleGuard><Permissions /></RoleGuard>} />,
    <Route key="r-stfa" path="staff/attendance" element={<RoleGuard><Attendance /></RoleGuard>} />,
    <Route key="r-stfw" path="staff/*" element={<RoleGuard><StaffManagement /></RoleGuard>} />,
    <Route key="r-stf" path="staff" element={<RoleGuard><StaffManagement /></RoleGuard>} />,

    /* Branches */
    <Route key="r-br" path="branches" element={<RoleGuard><BranchManagement /></RoleGuard>} />,

    /* Integrations */
    <Route key="r-intt" path="integrations/:type" element={<RoleGuard><Integrations /></RoleGuard>} />,
    <Route key="r-intw" path="integrations/*" element={<RoleGuard><Integrations /></RoleGuard>} />,
    <Route key="r-int" path="integrations" element={<RoleGuard><Integrations /></RoleGuard>} />,

    /* Settings */
    <Route key="r-setb" path="settings/billing" element={<RoleGuard><Settings /></RoleGuard>} />,
    <Route key="r-setbi" path="billing" element={<RoleGuard><Settings /></RoleGuard>} />,
    <Route key="r-sett" path="settings/:type" element={<RoleGuard><Settings /></RoleGuard>} />,
    <Route key="r-setw" path="settings/*" element={<RoleGuard><Settings /></RoleGuard>} />,
    <Route key="r-set" path="settings" element={<RoleGuard><Settings /></RoleGuard>} />
  ];
}

export default function App() {
  const appRoutes = getAppSubRoutes();
  return (
    <AuthProvider>
      {/* Global toast host (sonner) -- replaces the native window.alert() calls previously
          used across the app for success/error feedback. A native alert() blocks the entire
          browser tab until dismissed, and this repo's sonner scaffold was never actually
          mounted anywhere before this. Mirrors GerainaOS's App.js. */}
      <Toaster position="top-center" richColors closeButton />
      <BrowserRouter>
        <AndroidRouterBridge />
        <Routes>
          {/* Direct Auth Top-level & Full URL Mappings */}
          <Route path="/" element={<RootComponent />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dapuros/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dapuros/register" element={<Register />} />
          <Route path="/dapuros/activate" element={<Protected><Activate /></Protected>} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/dapuros/pricing" element={<Pricing />} />

          {/* DapurOS F&B Brand Routes */}
          <Route path="/dapuros/*">
            <Route index element={<RootComponent />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="activate" element={<Protected><Activate /></Protected>} />

            {/* Standard prefixed app routes */}
            <Route path="app/*" element={<AppLayout />}>{appRoutes}</Route>

            {/* Direct un-prefixed management routes & deep links under /dapuros/ */}
            <Route path="dashboard/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="pos/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="kds/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="qr-menu/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="products/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="inventory/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="purchase/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="suppliers/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="customers/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="debt/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="payments/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="reports/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="staff/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="branches/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="integrations/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="raw-materials/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="ingredients/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="bom/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="recipes/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="settings/*" element={<AppLayout />}>{appRoutes}</Route>
          </Route>

          {/* Root App Layout Fallbacks */}
          <Route path="/app/*" element={<AppLayout />}>{appRoutes}</Route>

          <Route path="*" element={<RootComponent />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
