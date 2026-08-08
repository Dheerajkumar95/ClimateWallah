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
import NotFound from "@/pages/NotFound";

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
import { Navigate } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <Toaster position="top-right" richColors />
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
              <Route path="blog" element={<BlogAdmin />} />
              <Route path="enquiries" element={<Enquiries />} />
              <Route path="media" element={<Media />} />
              <Route path="capability" element={<CapabilityAdmin />} />
              <Route path="settings" element={<Settings />} />
              <Route path="seo" element={<Seo />} />
              <Route path="legal" element={<LegalAdmin />} />
              <Route path="change-password" element={<ChangePassword />} />
            </Route>
          </Routes>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
