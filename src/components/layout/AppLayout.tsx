import { useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentReportId={id}
        />
        <main className="flex-1 overflow-y-auto bg-muted/30">
          {/* Mobile hamburger */}
          <div className="md:hidden px-4 pt-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="btn-secondary !text-xs !px-3 !py-1.5 gap-1.5"
              aria-label="Open history sidebar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              History
            </button>
          </div>
          <Outlet context={{ sidebarOpen, setSidebarOpen }} />
        </main>
      </div>
    </div>
  );
}