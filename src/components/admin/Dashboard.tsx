import { useState } from "react";
import { User, signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { Users, Image as ImageIcon, LogOut, Menu, X } from "lucide-react";
import { ClientsManager } from "./ClientsManager";
import { GalleryManager } from "./GalleryManager";

interface DashboardProps {
  user: User;
}

type Tab = "clients" | "gallery";

export function Dashboard({ user }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("clients");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = () => {
    signOut(auth);
  };

  const NavItem = ({ tab, icon: Icon, label }: { tab: Tab; icon: any; label: string }) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => {
          setActiveTab(tab);
          setIsMobileMenuOpen(false);
        }}
        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
          isActive
            ? "bg-black text-white"
            : "text-neutral-600 hover:bg-neutral-100 hover:text-black"
        }`}
      >
        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
        {label}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-neutral-200 z-20 flex items-center justify-between px-4">
        <span className="font-semibold text-lg tracking-tight">Control Panel</span>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 -mr-2">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-10 w-64 transform border-r border-neutral-200 bg-white transition-transform duration-300 lg:static lg:translate-x-0 ${
          isMobileMenuOpen ? "translate-x-0 pt-16" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="hidden lg:block p-6">
            <span className="text-xl font-bold tracking-tight">Control Panel</span>
            <p className="text-xs text-neutral-400 mt-1 truncate">{user.email}</p>
          </div>

          <nav className="flex-1 space-y-1 p-4 lg:pt-0">
            <NavItem tab="clients" icon={Users} label="Clientes" />
            <NavItem tab="gallery" icon={ImageIcon} label="Galería" />
          </nav>

          <div className="border-t border-neutral-100 p-4">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut size={18} />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-0 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto w-full pt-16 lg:pt-0">
        <main className="p-4 sm:p-8 md:p-12 w-full max-w-6xl mx-auto">
          {activeTab === "clients" ? <ClientsManager /> : <GalleryManager />}
        </main>
      </div>
    </div>
  );
}
