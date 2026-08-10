import "@/App.css";
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";

import { PublicLayout } from "@/components/site/PublicLayout";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Services from "@/pages/Services";
import ServiceDetail from "@/pages/ServiceDetail";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Team from "@/pages/Team";
import Blog from "@/pages/Blog";
import BlogDetail from "@/pages/BlogDetail";
import Contact from "@/pages/Contact";
import Legal from "@/pages/Legal";
import Capability from "@/pages/Capability";
import Book from "@/pages/Book";
import CertificationFinder from "@/pages/CertificationFinder";
import Assessment from "@/pages/Assessment";
import Industries from "@/pages/Industries";
import IndustryDetail from "@/pages/IndustryDetail";
import Resources from "@/pages/Resources";
import NotFound from "@/pages/NotFound";
import { FloatingActions } from "@/components/site/FloatingActions";

import { ProtectedRoute } from "@/admin/components/ProtectedRoute";
import { AdminLayout } from "@/admin/layouts/AdminLayout";
import Login from "@/admin/pages/Login";
import Dashboard from "@/admin/pages/Dashboard";
import Homepage from "@/admin/pages/Homepage";
import AboutAdmin from "@/admin/pages/AboutAdmin";
import ServicesAdmin from "@/admin/pages/ServicesAdmin";
import ProjectsAdmin from "@/admin/pages/ProjectsAdmin";
import TeamAdmin from "@/admin/pages/TeamAdmin";
import BlogAdmin from "@/admin/pages/BlogAdmin";
import Enquiries from "@/admin/pages/Enquiries";
import Media from "@/admin/pages/Media";
import CapabilityAdmin from "@/admin/pages/CapabilityAdmin";
import Settings from "@/admin/pages/Settings";
import Seo from "@/admin/pages/Seo";
import LegalAdmin from "@/admin/pages/LegalAdmin";
import ChangePassword from "@/admin/pages/ChangePassword";
import IndustriesAdmin from "@/admin/pages/IndustriesAdmin";
import MethodologyAdmin from "@/admin/pages/MethodologyAdmin";
import ResourcesAdmin from "@/admin/pages/ResourcesAdmin";
import { PartnersAdmin, EventsAdmin, CertificationRulesAdmin, AssessmentQuestionsAdmin } from "@/admin/pages/ContentAdmins";
import Leads from "@/admin/pages/Leads";
import Bookings from "@/admin/pages/Bookings";
import { AssessmentResults, CertificationResults } from "@/admin/pages/Results";
import { Navigate } from "react-router-dom";

import { PortalAuthProvider } from "@/portal/PortalAuthContext";
import { PortalProtectedRoute } from "@/portal/PortalProtectedRoute";
import { PortalLayout } from "@/portal/PortalLayout";
import PortalLogin from "@/portal/pages/PortalLogin";
import Register from "@/portal/pages/Register";
import ClientDashboard from "@/portal/pages/ClientDashboard";
import MyProjects from "@/portal/pages/MyProjects";
import CreateProject from "@/portal/pages/CreateProject";
import ProjectWizard from "@/portal/pages/ProjectWizard";
import ReviewerDashboard from "@/portal/pages/ReviewerDashboard";
import ReviewerProject from "@/portal/pages/ReviewerProject";
import { PortalClients, PortalReviewers, PortalProjects } from "@/admin/pages/CertificationPortal";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PortalAuthProvider>
        <SettingsProvider>
          <Toaster position="top-right" richColors />
          <FloatingActions />
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/:slug" element={<ServiceDetail />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:slug" element={<ProjectDetail />} />
              <Route path="/team" element={<Team />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogDetail />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/capability-profile" element={<Capability />} />
              <Route path="/book" element={<Book />} />
              <Route path="/certification-finder" element={<CertificationFinder />} />
              <Route path="/assessment" element={<Assessment />} />
              <Route path="/industries" element={<Industries />} />
              <Route path="/industries/:slug" element={<IndustryDetail />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/legal/:slug" element={<Legal />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="homepage" element={<Homepage />} />
              <Route path="about" element={<AboutAdmin />} />
              <Route path="services" element={<ServicesAdmin />} />
              <Route path="projects" element={<ProjectsAdmin />} />
              <Route path="team" element={<TeamAdmin />} />
              <Route path="industries" element={<IndustriesAdmin />} />
              <Route path="methodology" element={<MethodologyAdmin />} />
              <Route path="certification-rules" element={<CertificationRulesAdmin />} />
              <Route path="assessment-questions" element={<AssessmentQuestionsAdmin />} />
              <Route path="assessment-results" element={<AssessmentResults />} />
              <Route path="certification-results" element={<CertificationResults />} />
              <Route path="portal-clients" element={<PortalClients />} />
              <Route path="portal-reviewers" element={<PortalReviewers />} />
              <Route path="portal-projects" element={<PortalProjects />} />
              <Route path="resources" element={<ResourcesAdmin />} />
              <Route path="partners" element={<PartnersAdmin />} />
              <Route path="events" element={<EventsAdmin />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="leads" element={<Leads />} />
              <Route path="blog" element={<BlogAdmin />} />
              <Route path="enquiries" element={<Enquiries />} />
              <Route path="media" element={<Media />} />
              <Route path="capability" element={<CapabilityAdmin />} />
              <Route path="settings" element={<Settings />} />
              <Route path="seo" element={<Seo />} />
              <Route path="legal" element={<LegalAdmin />} />
              <Route path="change-password" element={<ChangePassword />} />
            </Route>

            {/* ---------- Certification Portal (Client / Reviewer) ---------- */}
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/portal/register" element={<Register />} />
            <Route path="/portal" element={<PortalProtectedRoute roles={["client"]}><PortalLayout role="client" /></PortalProtectedRoute>}>
              <Route index element={<Navigate to="/portal/dashboard" replace />} />
              <Route path="dashboard" element={<ClientDashboard />} />
              <Route path="projects" element={<MyProjects />} />
              <Route path="projects/new" element={<CreateProject />} />
              <Route path="projects/:id" element={<ProjectWizard />} />
            </Route>
            <Route path="/reviewer" element={<PortalProtectedRoute roles={["reviewer"]}><PortalLayout role="reviewer" /></PortalProtectedRoute>}>
              <Route index element={<Navigate to="/reviewer/dashboard" replace />} />
              <Route path="dashboard" element={<ReviewerDashboard />} />
              <Route path="assignments" element={<ReviewerDashboard />} />
              <Route path="projects/:id" element={<ReviewerProject />} />
            </Route>
          </Routes>
        </SettingsProvider>
        </PortalAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
