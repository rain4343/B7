import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Building2, Shield, Menu, LogOut, FileText, UserCircle, ChevronLeft, MessageCircle } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const ku: React.CSSProperties = { fontFamily: "'Noto Kufi Arabic', sans-serif" };

const navItems = [
  { icon: LayoutDashboard, label: "داشبۆرد", href: "/", accent: "text-blue-400", activeBg: "bg-blue-600" },
  { icon: Users, label: "فەرمانبەران", href: "/staff", accent: "text-blue-400", activeBg: "bg-blue-600" },
  { icon: Building2, label: "هۆبەکان", href: "/departments", accent: "text-emerald-400", activeBg: "bg-emerald-600" },
  { icon: Shield, label: "ڕۆڵەکان", href: "/roles", accent: "text-violet-400", activeBg: "bg-violet-600" },
  { icon: FileText, label: "نوسراوەکان", href: "/documents", accent: "text-amber-400", activeBg: "bg-amber-600" },
  { icon: MessageCircle, label: "چات", href: "/chat", accent: "text-sky-400", activeBg: "bg-sky-600" },
  { icon: UserCircle, label: "پڕۆفایلی من", href: "/profile", accent: "text-slate-300", activeBg: "bg-slate-600" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  function initials(name: string) {
    return name.trim().split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col" dir="rtl" style={{ background: "linear-gradient(180deg, #0f172a 0%, #1a2744 100%)" }}>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shrink-0 shadow-md p-0.5">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="لۆگۆ" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="text-base font-extrabold" style={{ ...ku, color: '#22c55e' }}>ب.پ.شارباژێڕ</h2>
            <p className="text-sm font-extrabold mt-0.5" style={{ ...ku, color: '#38bdf8' }}>ئی - ڕێکار</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? `${item.activeBg} text-white shadow-sm`
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
              style={ku}
            >
              <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : item.accent}`} />
              {item.label}
              {isActive && <ChevronLeft className="h-3 w-3 mr-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4 pt-3 border-t border-white/5">
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-lg bg-white/5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials(user.full_name || user.username)}
            </div>
            <div className="min-w-0" style={ku}>
              <p className="text-xs font-medium text-white truncate">{user.full_name || user.username}</p>
              <p className="text-[10px] text-slate-500 truncate">@{user.username}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
          style={ku}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          دەرچوون
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background" dir="rtl">
      {/* Desktop Sidebar */}
      <div className="hidden md:block md:w-60 shrink-0">
        <div className="sticky top-0 h-screen shadow-xl shadow-black/20">
          <SidebarContent />
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Mobile Header */}
        <header className="flex h-14 items-center gap-4 px-4 md:hidden bg-[#0f172a] border-b border-white/5">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white hover:bg-white/5">
                <Menu className="h-5 w-5" />
                <span className="sr-only">مێنو</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-60 p-0 border-none">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <div className="font-bold text-white text-sm" style={ku}>ئی-ڕێکار</div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-5 md:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
