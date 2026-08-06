import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  Sun,
  Moon,
  Bell,
  ArrowRight,
  Home,
  PlusCircle,
  ShoppingCart,
  PieChart,
  DollarSign,
  TrendingUp,
  CreditCard,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  AlertTriangle,
  X,
  LogOut,
  Package,
  Users,
  BellRing,
  Calendar,
  Info,
  RotateCcw
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

// Helper function to format Date as YYYY-MM-DD in local time
const getLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  // Firestore Data States
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [inventoryCostMap, setInventoryCostMap] = useState<{ [key: string]: number }>({});

  // Date Filter State (Restricted to 1 Month Back from Today)
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const minDateStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getLocalDateString(d);
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Notification States
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Logout Modal States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Toast & Notification States
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Beautiful "Data Not Found" Notification Toast
  const [showNotFoundToast, setShowNotFoundToast] = useState(false);
  const [notFoundMessage, setNotFoundMessage] = useState('');

  // Authentication Listener
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

  // Fetch Real-time Notifications from Firebase
  useEffect(() => {
    if (!currentUserEmail) return;

    const notificationsRef = collection(
      db,
      "users",
      currentUserEmail,
      "notifications"
    );

    const unsubscribe = onSnapshot(
      notificationsRef, 
      (snapshot) => {
        const data: any[] = [];
        snapshot.forEach((doc) => {
          data.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        setNotifications(data);
        const unread = data.filter((item) => !item.read).length;
        setNotificationCount(unread);
      },
      (error) => {
        console.error("Error fetching notifications:", error);
      }
    );

    return () => unsubscribe();
  }, [currentUserEmail]);

  // Fetch Firestore Dashboard Data & Inventory Cost Prices
  const fetchDashboardData = async () => {
    if (!currentUserEmail) return;
    setLoading(true);
    try {
      // 1. Fetch Sales Documents
      const salesRef = collection(db, 'users', currentUserEmail, 'sales');
      const salesSnap = await getDocs(salesRef);
      const fetchedSales: any[] = [];
      salesSnap.forEach((doc) => {
        fetchedSales.push({ id: doc.id, ...doc.data() });
      });
      setSalesData(fetchedSales);

      // 2. Fetch Inventory Categories to Map Product Costs
      const categoriesRef = collection(db, 'users', currentUserEmail, 'inventory_categories');
      const categoriesSnap = await getDocs(categoriesRef);
      const costMap: { [key: string]: number } = {};

      categoriesSnap.forEach((doc) => {
        const catData = doc.data();
        if (Array.isArray(catData.products)) {
          catData.products.forEach((prod: any) => {
            if (prod.name) {
              const cost = Number(prod.costPrice || prod.purchasePrice || 0);
              costMap[prod.name.trim().toLowerCase()] = cost;
            }
          });
        }
      });
      setInventoryCostMap(costMap);

    } catch (err) {
      console.error("Error loading dashboard data:", err);
      triggerError("Failed to load live metrics!");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentUserEmail]);

  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setShowErrorToast(true);
    setTimeout(() => setShowErrorToast(false), 3500);
  };

  // Helper to extract Date object from sale record
  const getSaleDateObj = (sale: any): Date => {
    if (sale.date) return new Date(sale.date);
    if (sale.createdAt?.seconds) return new Date(sale.createdAt.seconds * 1000);
    if (sale.timestamp) return new Date(sale.timestamp);
    return new Date();
  };

  // Handle Date Selector Change with Validation & Toast Notification
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDateStr = e.target.value;
    if (!newDateStr) return;

    setSelectedDate(newDateStr);
    setCurrentPage(1);

    // Check if sales data exists for selected date
    const hasData = salesData.some((sale) => {
      const sDate = getSaleDateObj(sale);
      return getLocalDateString(sDate) === newDateStr;
    });

    if (!hasData) {
      setNotFoundMessage(`No sales record found in database for ${newDateStr}!`);
      setShowNotFoundToast(true);
      setTimeout(() => setShowNotFoundToast(false), 4000);
    } else {
      setShowNotFoundToast(false);
    }
  };

  // Handle Reset Date back to Today
  const handleResetToToday = () => {
    setSelectedDate(todayStr);
    setCurrentPage(1);
    setShowNotFoundToast(false);
  };

  // Handle Logout Execution
  const handleConfirmLogout = async () => {
    try {
      setIsLoggingOut(true);
      localStorage.clear();
      sessionStorage.clear();
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout Error:", error);
      triggerError("Logout Failed");
    } finally {
      setIsLoggingOut(false);
      setShowConfirmModal(false);
    }
  };

  // Dynamic Financial Metrics Calculation for the SELECTED DATE
  const { dashboardMetrics, selectedSoldItems } = useMemo(() => {
    let daySales = 0;
    let dayEstProfit = 0;
    let dayCredit = 0;
    let dayNetCash = 0;

    const soldItemsAggregated: { [key: string]: { name: string; category: string; quantity: number; totalAmount: number } } = {};

    salesData.forEach((sale) => {
      const saleDate = getSaleDateObj(sale);
      const saleDateStr = getLocalDateString(saleDate);

      // Only calculate metrics for sales matching selectedDate
      if (saleDateStr === selectedDate) {
        const grandTotal = Number(sale.grandTotal || sale.totalAmount || sale.amount || 0);
        const paidAmount = Number(sale.paidAmount !== undefined ? sale.paidAmount : grandTotal);

        // Extract Credit directly from Firestore Document
        let saleCredit = 0;
        if (sale.creditAmount !== undefined) {
          saleCredit = Number(sale.creditAmount);
        } else if (sale.pendingBalance !== undefined) {
          saleCredit = Number(sale.pendingBalance);
        } else if (String(sale.paymentType).toUpperCase() === 'CREDIT' || sale.isUdhaar) {
          saleCredit = Math.max(0, grandTotal - paidAmount);
        }

        daySales += grandTotal;
        dayCredit += saleCredit;
        dayNetCash += Math.min(paidAmount, grandTotal);

        // Profit calculation for the day: (Sell Price - Cost Price) * Quantity
        let saleProfit = 0;

        if (Array.isArray(sale.items)) {
          sale.items.forEach((item: any) => {
            const qty = Number(item.quantity || 1);
            const sellPrice = Number(item.price || item.unitPrice || 0);
            
            const prodKey = String(item.name || '').trim().toLowerCase();
            const lookupCost = inventoryCostMap[prodKey] || 0;
            const costPrice = Number(item.costPrice || item.purchasePrice || lookupCost || 0);

            saleProfit += (sellPrice - costPrice) * qty;

            const prodName = item.name || item.title || 'General Product';
            const catName = item.category || 'Agri Product';
            const itemTotal = Number(item.total || sellPrice * qty);

            if (soldItemsAggregated[prodName]) {
              soldItemsAggregated[prodName].quantity += qty;
              soldItemsAggregated[prodName].totalAmount += itemTotal;
            } else {
              soldItemsAggregated[prodName] = {
                name: prodName,
                category: catName,
                quantity: qty,
                totalAmount: itemTotal || grandTotal
              };
            }
          });
        }

        dayEstProfit += saleProfit;
      }
    });

    const soldList = Object.values(soldItemsAggregated);

    return {
      dashboardMetrics: {
        totalSales: daySales,
        totalEstProfit: dayEstProfit,
        totalCredit: dayCredit,
        totalNetCash: dayNetCash
      },
      selectedSoldItems: soldList
    };
  }, [salesData, inventoryCostMap, selectedDate]);

  const totalPages = Math.ceil(selectedSoldItems.length / itemsPerPage) || 1;
  const currentSoldProducts = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return selectedSoldItems.slice(startIdx, startIdx + itemsPerPage);
  }, [selectedSoldItems, currentPage]);

  const navigationTabs = [
    { label: 'Home', icon: Home, href: '/dashboard' },
    { label: 'Add Product', icon: PlusCircle, href: '/departments' },
    { label: 'Sell Product', icon: ShoppingCart, href: '/attendance' },
    { label: 'Analytics', icon: PieChart, href: '/analytics' },
    { label: 'Notification', icon: Bell, href: '/alerts' },
  ];

  // Quick Access Configuration using identical navbar path routes
  const quickAccessItems = [
    {
      title: 'Add Product',
      href: '/departments',
      icon: PlusCircle,
      lightBg: 'bg-emerald-500/10',
      lightBorder: 'border-emerald-200',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]',
    },
    {
      title: 'Sell Product',
      href: '/attendance',
      icon: ShoppingCart,
      lightBg: 'bg-orange-500/10',
      lightBorder: 'border-orange-200',
      textColor: 'text-orange-600 dark:text-orange-400',
      glow: 'hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]',
    },
    {
      title: 'Analytics',
      href: '/analytics',
      icon: PieChart,
      lightBg: 'bg-indigo-500/10',
      lightBorder: 'border-indigo-200',
      textColor: 'text-indigo-600 dark:text-indigo-400',
      glow: 'hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]',
    },
    {
      title: 'Stock View',
      href: '/fees',
      icon: Package,
      lightBg: 'bg-amber-500/10',
      lightBorder: 'border-amber-200',
      textColor: 'text-amber-600 dark:text-amber-400',
      glow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]',
    },
    {
      title: 'Credit Customer',
      href: '/settings',
      icon: Users,
      lightBg: 'bg-sky-500/10',
      lightBorder: 'border-sky-200',
      textColor: 'text-sky-600 dark:text-sky-400',
      glow: 'hover:shadow-[0_0_20px_rgba(14,165,233,0.3)]',
    },
    {
      title: 'Alerts & Notification',
      href: '/alerts',
      icon: BellRing,
      lightBg: 'bg-rose-500/10',
      lightBorder: 'border-rose-200',
      textColor: 'text-rose-600 dark:text-rose-400',
      glow: 'hover:shadow-[0_0_20px_rgba(244,63,94,0.3)]',
    },
  ];

  return (
    <div className={`min-h-screen bg-[#f8fafc] dark:bg-[#070b13] text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-36 ${isDark ? 'dark' : ''}`}>
      
      {/* ERROR TOAST */}
      {showErrorToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] bg-rose-600 text-white font-extrabold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-[0_0_30px_rgba(225,19,72,0.5)] flex items-center gap-3 border border-rose-400 animate-in fade-in zoom-in-95">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
          <button onClick={() => setShowErrorToast(false)} className="ml-2 hover:opacity-80">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* BEAUTIFUL "DATA NOT FOUND" NOTIFICATION TOAST */}
      {showNotFoundToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-black text-xs sm:text-sm px-6 py-3.5 rounded-2xl shadow-[0_0_35px_rgba(249,115,22,0.6)] flex items-center gap-3 border border-amber-300 animate-in fade-in slide-in-from-top-4">
          <Info className="h-5 w-5 shrink-0 animate-pulse text-yellow-200" />
          <span>{notFoundMessage}</span>
          <button onClick={() => setShowNotFoundToast(false)} className="ml-2 hover:opacity-80 bg-white/20 p-1 rounded-full">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#0c1222] p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Confirm Logout</h3>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Are you sure you want to log out of Chaudhary Traders?
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isLoggingOut}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 font-extrabold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLogout}
                disabled={isLoggingOut}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-extrabold text-xs hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="w-full bg-white/70 dark:bg-[#070b13]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/60 sticky top-0 z-40">
        <div className="mx-auto max-w-2xl flex h-16 items-center justify-between px-4">
          <span className="font-black text-xl tracking-tight bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
            Chaudhary Traders
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDark(!isDark)}
              className="flex h-8 w-14 items-center rounded-full bg-slate-200/80 p-1 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700/50"
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ${isDark ? 'translate-x-6 bg-slate-900 text-yellow-400' : 'text-orange-500'}`}>
                {isDark ? <Moon className="h-3.5 w-3.5 fill-current" /> : <Sun className="h-3.5 w-3.5 fill-current" />}
              </div>
            </button>

            {/* NOTIFICATION BELL WITH LIVE COUNTER */}
            <Link to="/alerts" className="relative rounded-2xl p-2 text-slate-500 hover:text-orange-500 dark:text-slate-400 transition-all cursor-pointer">
              <Bell className="h-5 w-5" />
              {notificationCount > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold">
                  {notificationCount}
                </span>
              ) : (
                <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                </span>
              )}
            </Link>

            {/* LOGOUT BUTTON */}
            <button
              onClick={() => setShowConfirmModal(true)}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-3 py-1.5 text-white font-bold text-xs hover:bg-red-700 transition-all">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">

        {/* HERO TITLE CARD */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 dark:from-[#0c1222] dark:via-[#0e162a] dark:to-[#070b13] p-6 border-2 border-orange-500/80 shadow-[0_0_30px_rgba(249,115,22,0.25)]">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Chaudhary Traders
            </h1>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Agri-Chemicals, Pesticides & Fertilizer Management System
            </p>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Link
              to="/attendance"
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:scale-[1.02] active:scale-95 transition-all"
            >
              <span>Sell Product</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/analytics"
              className="flex-1 flex items-center justify-center py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-extrabold text-xs border border-slate-200/80 dark:border-slate-700/80 hover:border-orange-500 transition-all"
            >
              <span>Sell Analytics</span>
            </Link>
          </div>
        </div>

        {/* QUICK ACCESS SECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              QUICK ACCESS
            </span>
            <span className="text-[11px] font-bold text-orange-500 dark:text-orange-400 hover:underline cursor-pointer">
              View All
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {quickAccessItems.map((item, index) => {
              const IconComp = item.icon;
              return (
                <button
                  key={index}
                  onClick={() => navigate(item.href)}
                  className={`group relative flex flex-col items-center justify-center p-4 rounded-3xl ${item.lightBg} border ${item.lightBorder} dark:border-slate-800 dark:bg-[#0c1222] transition-all duration-300 transform hover:-translate-y-1 active:scale-95 cursor-pointer ${item.glow}`}
                >
                  <div className={`p-2.5 rounded-2xl mb-2 group-hover:scale-110 transition-transform duration-300 ${item.textColor}`}>
                    <IconComp className="h-7 w-7 stroke-[2]" />
                  </div>
                  <span className={`text-xs font-black text-center tracking-tight ${item.textColor}`}>
                    {item.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* FINANCIAL OVERVIEW SECTION WITH CALENDAR DATE FILTER */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              FINANCIAL OVERVIEW
              {selectedDate !== todayStr && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/30">
                  {selectedDate}
                </span>
              )}
            </span>

            {/* CALENDAR FILTER INPUT (Restricted to 1 Month Back) */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white dark:bg-[#0c1222] border-2 border-orange-500/50 rounded-2xl px-3 py-1.5 shadow-sm hover:border-orange-500 transition-all">
                <Calendar className="h-4 w-4 text-orange-500 shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  min={minDateStr}
                  max={todayStr}
                  onChange={handleDateChange}
                  className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                />
              </div>

              {selectedDate !== todayStr && (
                <button
                  onClick={handleResetToToday}
                  title="Reset to Today"
                  className="p-2 rounded-xl bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white transition-all border border-orange-500/30"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3.5">
            {/* SALES CARD */}
            <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border-2 border-emerald-400/60 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {selectedDate === todayStr ? 'TODAY SALES' : `SALES (${selectedDate})`}
                </span>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  Rs. {dashboardMetrics.totalSales.toLocaleString()}
                </p>
                <p className="text-[10px] font-extrabold text-emerald-500">
                  {selectedDate === todayStr ? 'Live Sales Today' : `Total Sales on ${selectedDate}`}
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <DollarSign className="h-6 w-6 stroke-[2.5]" />
              </div>
            </div>

            {/* EST. PROFIT CARD */}
            <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border-2 border-indigo-400/60 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  EST. PROFIT
                </span>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  Rs. {dashboardMetrics.totalEstProfit.toLocaleString()}
                </p>
                <p className="text-[10px] font-extrabold text-emerald-500">
                  Calculated Net Profit
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 stroke-[2.5]" />
              </div>
            </div>

            {/* CREDIT CARD */}
            <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border-2 border-rose-400/60 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  CREDIT (UDHAAR)
                </span>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  Rs. {dashboardMetrics.totalCredit.toLocaleString()}
                </p>
                <p className="text-[10px] font-extrabold text-rose-500">
                  Pending Balance
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <CreditCard className="h-6 w-6 stroke-[2.5]" />
              </div>
            </div>

            {/* NET CASH CARD */}
            <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border-2 border-amber-400/60 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  NET CASH
                </span>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  Rs. {dashboardMetrics.totalNetCash.toLocaleString()}
                </p>
                <p className="text-[10px] font-extrabold text-emerald-500">
                  In-Hand Cash
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Briefcase className="h-6 w-6 stroke-[2.5]" />
              </div>
            </div>
          </div>
        </div>

        {/* SOLD PRODUCTS FOR SELECTED DATE WITH PAGINATION OF 5 */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              {selectedDate === todayStr ? "TODAY'S SOLD PRODUCTS" : `SOLD PRODUCTS (${selectedDate})`} ({selectedSoldItems.length})
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              Page {currentPage} of {totalPages}
            </span>
          </div>

          {currentSoldProducts.length > 0 ? (
            <div className="space-y-3">
              {currentSoldProducts.map((prod, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-[#0c1222] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center justify-between hover:border-orange-500/40 transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="h-12 w-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                      <PackageCheck className="h-6 w-6 stroke-[2.2]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        {prod.name}
                      </h4>
                      <p className="text-[11px] font-bold text-slate-400">
                        Cat: {prod.category}
                      </p>
                    </div>
                  </div>

                  <div className="text-right space-y-0.5">
                    <p className="text-sm font-black text-emerald-500">
                      Qty: {prod.quantity}
                    </p>
                    <span className="text-[10px] font-extrabold text-orange-500">
                      Rs. {prod.totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-white dark:bg-[#0c1222] rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 space-y-2">
              <Info className="h-8 w-8 text-amber-500 mx-auto opacity-70" />
              <p className="text-xs font-bold text-slate-400">
                No sales completed on {selectedDate}.
              </p>
            </div>
          )}

          {/* PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 px-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-orange-500"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Prev</span>
              </button>

              <span className="text-xs font-extrabold text-slate-500">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-orange-500"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

      </main>

      {/* FLOATING BOTTOM NAVIGATION */}
      <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <nav className="w-full max-w-lg bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.08)] px-4 py-2.5 flex items-center justify-between pointer-events-auto">
          {navigationTabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = location.pathname === tab.href;

            return (
              <Link
                key={tab.href}
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
