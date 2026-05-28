import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginScreen } from "./screens/login/LoginScreen";
import { PatientsListScreen } from "./screens/patients/PatientsListScreen";
import { PatientDetailScreen } from "./screens/patients/PatientDetailScreen";
import { VisitDetailScreen } from "./screens/visits/VisitDetailScreen";
import { VisitsListScreen } from "./screens/visits/VisitsListScreen";
import { ScheduleScreen } from "./screens/schedule/ScheduleScreen";
import { AdminScreen } from "./screens/admin/AdminScreen";
import { BillingScreen } from "./screens/billing/BillingScreen";
import { FinanceScreen } from "./screens/finance/FinanceScreen";
import { DashboardScreen } from "./screens/dashboard/DashboardScreen";
import { SuperadminGuard } from "./screens/superadmin/SuperadminGuard";
import { SuperadminShell } from "./screens/superadmin/SuperadminShell";
import { SuperadminDashboard } from "./screens/superadmin/SuperadminDashboard";
import { ClinicsListScreen } from "./screens/superadmin/ClinicsListScreen";
import { ClinicDetailScreen } from "./screens/superadmin/ClinicDetailScreen";
import { MasterSpecialtiesScreen } from "./screens/superadmin/MasterSpecialtiesScreen";
import { CrossClinicUsersScreen } from "./screens/superadmin/CrossClinicUsersScreen";
import { AppShell } from "./layout/AppShell";
import { RequireAuth, RedirectIfAuthed } from "./lib/auth/guards";
import { useModuleEnabled } from "./lib/auth/store";

function Placeholder({ title }: { title: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-rule bg-card p-12 text-center shadow-1">
      <div className="eyebrow mb-2">Coming soon</div>
      <h2 className="font-serif text-2xl">{title}</h2>
    </div>
  );
}

/** Route gate that redirects to `/patients` when the named module is off. */
function RequireModule({
  moduleKey,
  children,
}: {
  moduleKey: string;
  children: JSX.Element;
}): JSX.Element {
  const enabled = useModuleEnabled(moduleKey);
  if (!enabled) return <Navigate to="/patients" replace />;
  return children;
}

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <LoginScreen />
            </RedirectIfAuthed>
          }
        />
        {/* Super Admin portal — fully separate layout (no AppShell), authenticated + isSuperAdmin */}
        <Route
          path="/superadmin"
          element={
            <RequireAuth>
              <SuperadminGuard>
                <SuperadminShell />
              </SuperadminGuard>
            </RequireAuth>
          }
        >
          <Route index element={<SuperadminDashboard />} />
          <Route path="clinics" element={<ClinicsListScreen />} />
          <Route path="clinics/:id" element={<ClinicDetailScreen />} />
          <Route path="specialties" element={<MasterSpecialtiesScreen />} />
          <Route path="users" element={<CrossClinicUsersScreen />} />
        </Route>

        {/* Regular tenant app — shares AppShell layout */}
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/patients" element={<PatientsListScreen />} />
          <Route path="/patients/:id" element={<PatientDetailScreen />} />
          <Route path="/schedule" element={<ScheduleScreen />} />
          <Route path="/visits" element={<VisitsListScreen />} />
          <Route path="/visits/:id" element={<VisitDetailScreen />} />
          <Route path="/billing" element={<BillingScreen />} />
          <Route
            path="/finance"
            element={
              <RequireModule moduleKey="finance">
                <FinanceScreen />
              </RequireModule>
            }
          />
          <Route path="/admin" element={<AdminScreen />} />
          <Route path="/" element={<DashboardScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
