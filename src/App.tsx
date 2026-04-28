import { Navigate, Route, Routes, useParams } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout";
import BlogListPage from "./pages/blog/BlogListPage";
import BlogEditorPage from "./pages/blog/BlogEditorPage";
import DashboardPage from "./pages/DashboardPage";
import AdminManagementPage from "./pages/AdminManagementPage";
import LoginPage from "./pages/LoginPage";
import PsychologistPage from "./pages/PsychologistPage";
import PsychologistEditorPage from "./pages/psychologists/PsychologistEditorPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { RequireAuth } from "./auth/RequireAuth";
import ActivityListPage from "./pages/activities/ActivityListPage";
import ActivityEditorPage from "./pages/activities/ActivityEditorPage";
import ServiceCardListPage from "./pages/services/ServiceCardListPage";
import ServiceCardEditorPage from "./pages/services/ServiceCardEditorPage";
import WorkshopCategoryListPage from "./pages/services/WorkshopCategoryListPage";
import WorkshopCategoryEditorPage from "./pages/services/WorkshopCategoryEditorPage";
import WorkshopProgramListPage from "./pages/services/WorkshopProgramListPage";
import WorkshopProgramEditorPage from "./pages/services/WorkshopProgramEditorPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="blog" element={<BlogListPage />} />
        <Route path="blog/create" element={<BlogEditorPage />} />
        <Route path="blog/edit/:id" element={<BlogEditorPage />} />
        <Route path="blog/new" element={<Navigate to="/blog/create" replace />} />
        <Route path="blog/:id" element={<BlogLegacyRedirect />} />
        <Route path="psychologists" element={<PsychologistPage />} />
        <Route path="psychologists/create" element={<PsychologistEditorPage />} />
        <Route path="psychologists/edit/:id" element={<PsychologistEditorPage />} />
        <Route path="psychologists/new" element={<Navigate to="/psychologists/create" replace />} />
        <Route path="psychologists/:id" element={<PsychologistLegacyRedirect />} />
        <Route path="activities" element={<ActivityListPage />} />
        <Route path="activities/create" element={<ActivityEditorPage />} />
        <Route path="activities/edit/:id" element={<ActivityEditorPage />} />
        <Route path="activities/new" element={<Navigate to="/activities/create" replace />} />
        <Route path="activities/:id" element={<ActivityLegacyRedirect />} />
        <Route path="services/cards" element={<ServiceCardListPage />} />
        <Route path="services/cards/create" element={<ServiceCardEditorPage />} />
        <Route path="services/cards/edit/:id" element={<ServiceCardEditorPage />} />
        <Route path="services/workshop-categories" element={<WorkshopCategoryListPage />} />
        <Route
          path="services/workshop-categories/create"
          element={<WorkshopCategoryEditorPage />}
        />
        <Route
          path="services/workshop-categories/edit/:id"
          element={<WorkshopCategoryEditorPage />}
        />
        <Route path="services/workshop-programs" element={<WorkshopProgramListPage />} />
        <Route
          path="services/workshop-programs/create"
          element={<WorkshopProgramEditorPage />}
        />
        <Route
          path="services/workshop-programs/edit/:id"
          element={<WorkshopProgramEditorPage />}
        />
        <Route path="admins" element={<AdminManagementPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function BlogLegacyRedirect() {
  const { id } = useParams();

  if (!id) {
    return <Navigate to="/blog" replace />;
  }

  return <Navigate to={`/blog/edit/${id}`} replace />;
}

function PsychologistLegacyRedirect() {
  const { id } = useParams();

  if (!id) {
    return <Navigate to="/psychologists" replace />;
  }

  return <Navigate to={`/psychologists/edit/${id}`} replace />;
}

function ActivityLegacyRedirect() {
  const { id } = useParams();

  if (!id) {
    return <Navigate to="/activities" replace />;
  }

  return <Navigate to={`/activities/edit/${id}`} replace />;
}
