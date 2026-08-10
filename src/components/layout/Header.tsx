import { Moon, Sun, Monitor, LogOut, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "../../hooks/useTheme";
import { supabase } from "../../lib/supabase";

export default function Header() {
  const { theme, setTheme, resolved } = useTheme();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const ThemeIcon =
    theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  const cycleTheme = () => {
    setTheme(
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light",
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Search size={16} />
          </div>
          <h1 className="font-heading text-lg font-semibold tracking-tight">
            Research Agent
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={cycleTheme}
            className="btn-secondary !p-2 !rounded-full"
            aria-label={`Theme: ${theme} (${resolved})`}
          >
            <ThemeIcon size={16} />
          </button>

          {userEmail && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="btn-secondary !p-2 !rounded-full text-sm font-medium"
                aria-label="User menu"
              >
                {userEmail.charAt(0).toUpperCase()}
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 card w-56 p-1 shadow-lg">
                    <div className="px-3 py-2 text-sm text-muted-foreground truncate">
                      {userEmail}
                    </div>
                    <hr className="my-1 border-border" />
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}