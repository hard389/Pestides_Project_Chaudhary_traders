import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs 
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  Sun,
  Moon,
  Bell,
  ArrowLeft,
  Home,
  PlusCircle,
  ShoppingCart,
  PieChart,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Package,
  CreditCard,
  X,
  Send,
  Filter,
  RefreshCw
} from 'lucide-react';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAmHi20OGNteUXjuXO_weF8XKEa3KP7oYE",
  authDomain: "tuition-management-b9e2f.firebaseapp.com",
  projectId: "tuition-management-b9e2f",
  storageBucket: "tuition-management-b9e2f.firebasestorage.app",
  messagingSenderId: "634395063857",
  appId: "1:634395063857:web:24d5e9c303845557f1c710",
  measurementId: "G-5SS0BVJWTK"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

interface NotificationItem {
  id: string;
  type: 'low_stock' | 'credit_customer';
  title: string;
  message: string;
  timestamp: Date;
  severity: 'high' | 'medium' | 'info';
  read: boolean;
  metadata?: {
    productName?: string;
    quantity?: number;
    customerName?: string;
    customerPhone?: string;
    remainingAmount?: number;
    invoiceId?: string;
    daysOverdue?: number;
  };
}

export default function Notifications() {
  const navigate = useNavigate();
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [activeTab] = useState('notification');
  const [filterType, setFilterType] = useState<'all' | 'low_stock' | 'credit_customer'>('all');

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Toast State
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email) {
        setCurrentUserEmail(user.email);
      } else {
        const savedEmail = localStorage.getItem('userEmail') || 'alitahir243715@gmail.com';
        setCurrentUserEmail(savedEmail);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Firestore Notifications
  const fetchNotifications = async () => {
    if (!currentUserEmail) return;
    setLoading(true);
    const generatedNotifs: NotificationItem[] = [];

    try {
      // 1. FETCH LOW STOCK ITEMS
      const inventoryRef = collection(db, 'users', currentUserEmail, 'inventory_categories');
      const invSnap = await getDocs(inventoryRef);

      invSnap.forEach((categoryDoc) => {
        const data = categoryDoc.data();
        if (data && Array.isArray(data.products)) {
          data.products.forEach((prod: any) => {
            const qty = Number(prod.quantity || 0);
            if (qty < 10) {
              const isOut = qty === 0;
              generatedNotifs.push({
                id: `stock-${prod.id || prod.name}`,
                type: 'low_stock',
                title: isOut ? 'Out of Stock Alert!' : 'Low Inventory Warning',
                message: isOut 
                  ? `"${prod.name}" is completely out of stock!` 
                  : `"${prod.name}" has only ${qty} units remaining in stock.`,
                timestamp: prod.createdAt ? new Date(prod.createdAt) : new Date(),
                severity: isOut ? 'high' : 'medium',
                read: false,
                metadata: {
                  productName: prod.name,
                  quantity: qty
                }
              });
            }
          });
        }
      });

      // 2. FETCH CREDIT CUSTOMERS (UP TO 15 DAYS)
      const salesRef = collection(db, 'users', currentUserEmail, 'sales');
      const salesSnap = await getDocs(salesRef);
      const now = new Date();

      salesSnap.forEach((saleDoc) => {
        const sale = saleDoc.data();
        const grandTotal = Number(sale.grandTotal || sale.totalAmount || 0);
        const paidAmount = Number(sale.paidAmount || 0);
        const remaining = grandTotal - paidAmount;

        const saleDate = sale.createdAt?.seconds 
          ? new Date(sale.createdAt.seconds * 1000)
          : sale.createdAt 
          ? new Date(sale.createdAt) 
          : new Date();

        const diffInDays = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24));

        // Filter for overdue/pending credit payments up to 15 days or past due
        if (remaining > 0 && diffInDays <= 15) {
          const customerName = sale.customerName || sale.clientName || 'Credit Customer';
          const phone = sale.customerPhone || sale.whatsappNumber || '';

          generatedNotifs.push({
            id: `credit-${saleDoc.id}`,
            type: 'credit_customer',
            title: 'Credit Payment Due',
            message: `${customerName} has unpaid balance of Rs. ${remaining.toLocaleString()} (${diffInDays} days ago).`,
            timestamp: saleDate,
            severity: diffInDays >= 10 ? 'high' : 'medium',
            read: false,
            metadata: {
              customerName,
              customerPhone: phone,
              remainingAmount: remaining,
              invoiceId: saleDoc.id,
              daysOverdue: diffInDays
            }
          });
        }
      });

      // Sort notifications by highest severity & latest timestamp
      generatedNotifs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setNotifications(generatedNotifs);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [currentUserEmail]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    triggerToast("All notifications marked as read!");
  };

  const sendWhatsAppReminder = (phone: string, customer: string, amount: number) => {
    const formattedPhone = phone.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(`Hello ${customer}, this is a gentle reminder regarding your outstanding balance of Rs. ${amount.toLocaleString()} at Chaudhary Traders. Please arrange payment at your earliest convenience.`);
    window.open(`https://wa.me/${formattedPhone || '923032093789'}?text=${text}`, '_blank');
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (filterType === 'all') return true;
      return n.type === filterType;
    });
  }, [notifications, filterType]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const navigationTabs = [
    { id: 'home', label: 'Home', icon: Home, href: '/' },
    { id: 'add', label: 'Add Product', icon: PlusCircle, href: '/add-product' },
    { id: 'inventory', label: 'Sell Product', icon: ShoppingCart, href: '/sell-product' },
    { id: 'analytics', label: 'Analytics', icon: PieChart, href: '/analytics' },
    { id: 'notification', label: 'Notification', icon: Bell, href: '/notifications' },
  ];

  return (
    <div className={`min-h-screen bg-[#f8fafc] dark:bg-[#070b13] text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-36 ${isDark ? 'dark' : ''}`}>
      
      {/* SUCCESS TOAST */}
      {showToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-xs sm:text-sm px-6 py-3.5 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.6)] flex items-center gap-3 border border-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* HEADER NAVBAR */}
      <div className="w-full bg-white/70 dark:bg-[#070b13]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/60 sticky top-0 z-40">
        <div className="mx-auto max-w-7xl flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.5)] hover:scale-105 transition-all"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.5]" />
            </Link>
            <span className="font-black text-lg tracking-tight bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              Chaudhary Traders
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDark(!isDark)}
              className="flex h-8 w-14 items-center rounded-full bg-slate-200/80 p-1 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700/50"
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ${isDark ? 'translate-x-6 bg-slate-900 text-yellow-400' : 'text-orange-500'}`}>
                {isDark ? <Moon className="h-3.5 w-3.5 fill-current" /> : <Sun className="h-3.5 w-3.5 fill-current" />}
              </div>
            </button>

            <div className="relative rounded-2xl p-2.5 text-slate-500 hover:text-orange-500 dark:text-slate-400 transition-all cursor-pointer">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-2 top-2 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        
        {/* HERO BANNER CARD */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 dark:from-[#0c1222] dark:via-[#0e162a] dark:to-[#070b13] p-6 md:p-8 border-2 border-orange-500/80 shadow-[0_0_30px_rgba(249,115,22,0.25)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                <Bell className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">LIVE ALERTS & REMINDERS</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                Notifications Center
              </h1>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Automated stock shortage alerts and credit customer recovery reminders (Up to 15 Days).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchNotifications}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#070b13] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:border-orange-500 transition-all shadow-md"
              >
                <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin text-orange-500' : ''}`} />
              </button>
              <button
                onClick={markAllAsRead}
                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:scale-105 transition-all"
              >
                Mark All Read
              </button>
            </div>
          </div>
        </div>

        {/* FILTER TAB BAR */}
        <div className="bg-white dark:bg-[#0c1222] p-2.5 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: `All Alerts (${notifications.length})`, icon: Filter },
              { id: 'low_stock', label: 'Low Stock Alerts', icon: Package },
              { id: 'credit_customer', label: 'Credit Customers (15 Days)', icon: CreditCard },
            ].map((f) => {
              const Icon = f.icon;
              const isActive = filterType === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id as any)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'text-slate-500 dark:text-slate-400 hover:text-orange-500'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

          <span className="text-xs font-black text-slate-400 hidden sm:inline-block px-3">
            Unread: <strong className="text-orange-500">{unreadCount}</strong>
          </span>
        </div>

        {/* NOTIFICATION LIST */}
        {loading ? (
          <div className="text-center py-20 bg-white dark:bg-[#0c1222] rounded-[2.5rem] border border-slate-200 dark:border-slate-800">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
            <p className="mt-3 text-xs font-black text-slate-400">Syncing Notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#0c1222] rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto opacity-80" />
            <h3 className="text-base font-black text-slate-700 dark:text-slate-200">All Clear! No Pending Notifications</h3>
            <p className="text-xs font-bold text-slate-400 max-w-sm mx-auto">
              Your inventory levels are sufficient and there are no overdue credit customers within 15 days.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotifications.map((notif) => {
              const isStock = notif.type === 'low_stock';
              const isHighSeverity = notif.severity === 'high';

              return (
                <div
                  key={notif.id}
                  className={`bg-white dark:bg-[#0c1222] p-5 sm:p-6 rounded-[2.5rem] border-2 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    !notif.read
                      ? 'border-orange-500/80 shadow-[0_0_20px_rgba(249,115,22,0.15)]'
                      : 'border-slate-200/80 dark:border-slate-800/60 opacity-80'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3.5 rounded-2xl shrink-0 ${
                      isStock
                        ? isHighSeverity ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30' : 'bg-amber-500/10 text-amber-500'
                        : 'bg-blue-500/10 text-blue-500 border border-blue-500/30'
                    }`}>
                      {isStock ? <Package className="h-6 w-6" /> : <CreditCard className="h-6 w-6" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          isHighSeverity ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {isHighSeverity ? 'URGENT' : 'WARNING'}
                        </span>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">{notif.title}</h3>
                      </div>

                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {notif.message}
                      </p>

                      <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {notif.timestamp.toLocaleDateString()}
                        </span>
                        {notif.metadata?.daysOverdue !== undefined && (
                          <span className="text-orange-500">({notif.metadata.daysOverdue} Days Overdue)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800">
                    {isStock ? (
                      <button
                        onClick={() => {
                          markAsRead(notif.id);
                          navigate('/sell-product');
                        }}
                        className="px-4 py-2.5 rounded-2xl bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white font-black text-xs transition-all flex items-center gap-1.5 border border-orange-500/30"
                      >
                        <Package className="h-3.5 w-3.5" /> Restock
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          markAsRead(notif.id);
                          sendWhatsAppReminder(
                            notif.metadata?.customerPhone || '',
                            notif.metadata?.customerName || '',
                            notif.metadata?.remainingAmount || 0
                          );
                        }}
                        className="px-4 py-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white font-black text-xs transition-all flex items-center gap-1.5 border border-emerald-500/30"
                      >
                        <Send className="h-3.5 w-3.5" /> WhatsApp Reminder
                      </button>
                    )}

                    <button
                      onClick={() => markAsRead(notif.id)}
                      className="p-2.5 rounded-2xl bg-slate-100 dark:bg-[#070b13] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* FLOATING BOTTOM NAVBAR */}
      <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <nav className="w-full max-w-lg bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.08)] px-4 py-2.5 flex items-center justify-between pointer-events-auto">
          {navigationTabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <Link
                key={tab.id}
                to={tab.href}
                className="flex flex-col items-center justify-center flex-1 transition-all duration-300"
              >
                {isActive ? (
                  <div className="h-12 w-12 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-[0_4px_20px_rgba(249,115,22,0.6)] mb-1">
                    <IconComponent className="h-6 w-6 stroke-[2.2]" />
                  </div>
                ) : (
                  <div className="h-9 w-9 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                    <IconComponent className="h-5 w-5 stroke-[1.8]" />
                  </div>
                )}
                
                <span className={`text-[10px] font-bold tracking-tight transition-all ${
                  isActive 
                    ? 'text-orange-500 font-extrabold' 
                    : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

    </div>
  );
}
