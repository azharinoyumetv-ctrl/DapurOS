import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ShieldAlert, Lock } from "lucide-react";

// SYNC: KEEP IN SYNC with the minPlan annotations on dynamicMenu in layouts/AppLayout.jsx.
// That nav lock icon only stops nav-clicks -- this is what actually stops a direct URL (typed,
// bookmarked, or deep-linked) from reaching a plan-locked page regardless of how the request
// got there. Ordered most-specific-to-least-specific; the first matching suffix wins. DapurOS
// carries a few entries GerainaOS doesn't (qr-menu, products/ingredients + its path aliases,
// and a parent-level /customers gate -- DapurOS's "Pelanggan" nav item is Pro at the parent,
// unlike GerainaOS where only the membership/loyalty sub-items are locked).
const PLAN_RANK = { starter: 0, pro: 1, business: 2, trial: 2 };
const PLAN_LABEL = { starter: "Starter", pro: "Pro", business: "Business" };
const PLAN_ROUTES = [
  ["/qr-menu", "pro"],
  ["/products/stock-transfer", "business"],
  ["/products/ingredients", "pro"],
  ["/inventory/ingredients", "pro"],
  ["/inventory/raw-materials", "pro"],
  ["/raw-materials", "pro"],
  ["/ingredients", "pro"],
  ["/bom", "pro"],
  ["/recipes", "pro"],
  ["/inventory/movement", "pro"],
  ["/inventory/valuation", "pro"],
  ["/inventory/dead-stock", "pro"],
  ["/purchase", "pro"],
  ["/suppliers", "pro"],
  ["/customers/membership", "business"],
  ["/customers/loyalty", "business"],
  ["/customers", "pro"],
  ["/debt", "pro"],
  ["/reports", "pro"],
  ["/staff/roles", "business"],
  ["/staff/permissions", "business"],
  ["/staff/attendance", "business"],
  ["/branches", "business"],
  ["/integrations/whatsapp", "business"],
  ["/integrations/telegram", "business"],
  ["/integrations/email", "business"],
  ["/integrations", "pro"],
];

function planRank(plan) {
  return PLAN_RANK[plan] ?? 0;
}

function minPlanForPath(pathname) {
  const hit = PLAN_ROUTES.find(([suffix]) => pathname.includes(suffix));
  return hit ? hit[1] : null;
}

const ROLE_PERMISSIONS = {
  Owner: ["*"],
  admin: ["*"], // akun lama dengan peran "admin" setara Owner
  Manager: [
    "dashboard",
    "pos",
    "kds",
    "products",
    "ingredients",
    "inventory",
    "purchase",
    "suppliers",
    "customers",
    "debt",
    "payments",
    "reports",
    "staff",
    "settings",
    "billing",
    "license",
    "about"
  ],
  Cashier: [
    "dashboard",
    "pos",
    "kds",
    "products",
    "customers",
    "about"
  ],
  Warehouse: [
    "products",
    "ingredients",
    "inventory",
    "purchase",
    "suppliers",
    "about"
  ]
};

export default function RoleGuard({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  console.log('[RoleGuard] loading:', loading, 'user:', !!user, 'path:', location.pathname);

  if (loading) {
    return <div className="p-10 text-sm text-center text-[hsl(var(--muted))]" data-testid="auth-loading">Memuat sesi…</div>;
  }

  if (!user) {
    console.log('[RoleGuard] No user, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  // Plan gate runs for every role, including Owner -- direct-URL access to a plan-locked page
  // must be blocked the same way a nav click would be.
  const requiredPlan = minPlanForPath(location.pathname);
  if (requiredPlan && planRank(user.plan) < planRank(requiredPlan)) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center space-y-4" data-testid="plan-locked-page">
        <div className="w-16 h-16 rounded-full bg-[hsl(38,90%,50%,0.12)] text-[hsl(38,90%,42%)] grid place-items-center">
          <Lock size={32} />
        </div>
        <h1 className="font-display text-2xl font-bold">Fitur Terkunci</h1>
        <p className="text-[hsl(var(--muted))] max-w-md text-sm">
          Halaman ini tersedia mulai paket <strong>{PLAN_LABEL[requiredPlan]}</strong>. Paket Anda saat ini: {PLAN_LABEL[user.plan] || "Trial"}.
        </p>
        <a href="/dapuros/pricing" className="btn-primary text-xs px-4 py-2 rounded-lg">Lihat Paket</a>
      </div>
    );
  }

  const role = user.role || "Owner";
  const permissions = ROLE_PERMISSIONS[role] || [];

  if (permissions.includes("*")) {
    return children;
  }

  // Robustly get the module name following the "app" segment in the URL
  const pathParts = location.pathname.split("/");
  const appIndex = pathParts.indexOf("app");
  const moduleName = appIndex !== -1 ? pathParts[appIndex + 1] : "";
  
  // Always allow core operational pages for everyone
  if (
    location.pathname.includes("dashboard") ||
    location.pathname.includes("pos") ||
    location.pathname.includes("kds") ||
    location.pathname.includes("about")
  ) {
    return children;
  }

  const hasAccess = pathParts.some((part) => permissions.includes(part));

  if (!hasAccess) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center space-y-4" data-testid="access-denied-page">
        <div className="w-16 h-16 rounded-full bg-[hsl(9,65%,55%,0.1)] text-[hsl(9,65%,55%)] grid place-items-center">
          <ShieldAlert size={32} />
        </div>
        <h1 className="font-display text-2xl font-bold">Akses Ditolak</h1>
        <p className="text-[hsl(var(--muted))] max-w-md text-sm">
          Peran Anda ({role}) tidak memiliki izin untuk mengakses halaman <strong>/{moduleName}</strong>. 
          Silakan hubungi pemilik toko jika Anda memerlukan akses.
        </p>
      </div>
    );
  }

  return children;
}
