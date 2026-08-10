import { useEffect, useState } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from "react-router-dom";
import { supabase } from "./lib/supabase";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import Research from "./pages/Research";
import Report from "./pages/Report";
import { useTheme } from "./hooks/useTheme";

function AuthGuard() {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
    });

    // Listen for auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  if (session === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout />;
}

function ThemeInit() {
  useTheme();
  return <Outlet />;
}

const router = createBrowserRouter([
  {
    element: <ThemeInit />,
    children: [
      { path: "/login", element: <Login /> },
      { path: "/signup", element: <Signup /> },
      {
        element: <AuthGuard />,
        children: [
          { index: true, element: <Home /> },
          { path: "/research/:id", element: <Research /> },
          { path: "/report/:id", element: <Report /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}