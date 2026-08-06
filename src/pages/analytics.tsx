import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs 
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  AreaChart,
  Area,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  Sun,
  Moon,
  Bell,
  ArrowLeft,
  Home,
  PlusCircle,
  ShoppingCart,
  PieChart,
  TrendingUp,
  DollarSign,
  Package,
  Sparkles,
  Zap,
  AlertTriangle,
  X,
  Filter,
  AlertCircle
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

export default function Analytics() {
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics');
  
  // Time Range Filter: 7 Days, 15 Days, 30 Days, All Time
  const [timeRange, setTimeRange] = useState<'7d' | '15d' | '30d' | 'all'>('30d');

  // Loading & Data State
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [inventoryCategories, setInventoryCategories] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Toast State
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Authentication Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email) {
        setCurrentUserEmail(user.email);
      } else {
        const savedEmail = localStorage.getItem('userEmail') || 'admin@gmail.com';
        setCurrentUserEmail(savedEmail);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Firestore Analytics Data
  const fetchAnalyticsData = async () => {
    if (!currentUserEmail) return;
    setLoading(true);
    try {
      // 1. Fetch Sales History
      const salesRef = collection(db, 'users', currentUserEmail, 'sales');
      const salesSnap = await getDocs(salesRef);
      const fetchedSales: any[] = [];
      salesSnap.forEach((doc) => {
        fetchedSales.push({ id: doc.id, ...doc.data() });
      });

      // 2. Fetch Categories & Inventory Products
      const invRef = collection(db, 'users', currentUserEmail, 'inventory_categories');
      const invSnap = await getDocs(invRef);
      const fetchedCategories: any[] = [];
      invSnap.forEach((doc) => {
        fetchedCategories.push({ id: doc.id, ...doc.data() });
      });

      setSalesData(fetchedSales);
      setInventoryCategories(fetchedCategories);
    } catch (err) {
      console.error("Error loading analytics data:", err);
      triggerError("Failed to fetch analytics metrics!");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [currentUserEmail]);

  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setShowErrorToast(true);
    setTimeout(() => setShowErrorToast(false), 3500);
  };

  // Extract all flattened products from inventory categories
  const allProducts = useMemo(() => {
    const products: any[] = [];
    inventoryCategories.forEach((catDoc) => {
      if (Array.isArray(catDoc.products)) {
        catDoc.products.forEach((prod: any) => {
          products.push({
            ...prod,
            categoryName: catDoc.name || 'General Inventory',
            quantityNum: Number(prod.quantity || 0),
            costPriceNum: Number(prod.costPrice || 0),
            salePriceNum: Number(prod.salePrice || 0)
          });
        });
      }
    });
    return products;
  }, [inventoryCategories]);

  // Set default selected product once products are loaded
  useEffect(() => {
    if (allProducts.length > 0 && !selectedProductId) {
      setSelectedProductId(String(allProducts[0].id));
    }
  }, [allProducts, selectedProductId]);

  // Low Stock Alert: Top 4 Products lowest in quantity
  const lowestQuantityProducts = useMemo(() => {
    return [...allProducts]
      .sort((a, b) => a.quantityNum - b.quantityNum)
      .slice(0, 4);
  }, [allProducts]);

  // Filter Sales By Selected Time Range (7 Days, 15 Days, 30 Days, All Time)
  const filteredSalesData = useMemo(() => {
    if (timeRange === 'all') return salesData;

    const now = new Date().getTime();
    const daysLimit = timeRange === '7d' ? 7 : timeRange === '15d' ? 15 : 30;
    const thresholdMs = daysLimit * 24 * 60 * 60 * 1000;

    return salesData.filter((sale) => {
      let saleTime = 0;
      if (sale.date) {
        saleTime = new Date(sale.date).getTime();
      } else if (sale.createdAt?.seconds) {
        saleTime = sale.createdAt.seconds * 1000;
      } else if (sale.createdAt) {
        saleTime = new Date(sale.createdAt).getTime();
      } else {
        saleTime = Date.now();
      }

      return (now - saleTime) <= thresholdMs;
    });
  }, [salesData, timeRange]);

  // Map Product Cost Prices and Compute Profit Analytics & Chart Data
  const computedAnalytics = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalItemsSold = 0;
    
    // Hash map for direct lookup by product ID and normalized Name
    const productCostById: { [id: string]: number } = {};
    const productCostByName: { [name: string]: number } = {};

    allProducts.forEach((prod) => {
      if (prod.id) productCostById[String(prod.id)] = prod.costPriceNum;
      if (prod.name) productCostByName[prod.name.trim().toLowerCase()] = prod.costPriceNum;
    });

    // Timeline Aggregation Map
    const timelineMap: { 
      [dateKey: string]: { 
        timestamp: number;
        date: string; 
        sales: number; 
        profit: number; 
        orders: number 
      } 
    } = {};

    filteredSalesData.forEach((sale) => {
      let saleDateObj: Date;
      if (sale.date) {
        saleDateObj = new Date(sale.date);
      } else if (sale.createdAt?.seconds) {
        saleDateObj = new Date(sale.createdAt.seconds * 1000);
      } else {
        saleDateObj = new Date();
      }

      const dateKey = saleDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const saleGrandTotal = Number(sale.grandTotal || sale.totalAmount || 0);

      let currentSaleRevenue = 0;
      let currentSaleCost = 0;

      if (Array.isArray(sale.items) && sale.items.length > 0) {
        sale.items.forEach((item: any) => {
          const qty = Number(item.quantity || 1);
          const itemSellingPrice = Number(item.price || item.salePrice || 0);
          
          // Match cost price from product lookup first, or fallback to item cost field
          const itemNameNorm = item.name ? String(item.name).trim().toLowerCase() : '';
          const matchedCostPrice = productCostById[String(item.id)] ?? productCostByName[itemNameNorm] ?? Number(item.costPrice || 0);

          currentSaleRevenue += itemSellingPrice * qty;
          currentSaleCost += matchedCostPrice * qty;
          totalItemsSold += qty;
        });
      } else {
        currentSaleRevenue = saleGrandTotal;
        currentSaleCost = 0;
      }

      // Fallback if item prices sum to 0
      if (currentSaleRevenue === 0 && saleGrandTotal > 0) {
        currentSaleRevenue = saleGrandTotal;
      }

      totalRevenue += currentSaleRevenue;
      totalCost += currentSaleCost;

      const currentSaleProfit = currentSaleRevenue - currentSaleCost;

      if (!timelineMap[dateKey]) {
        timelineMap[dateKey] = {
          timestamp: saleDateObj.getTime(),
          date: dateKey,
          sales: 0,
          profit: 0,
          orders: 0
        };
      }

      timelineMap[dateKey].sales += currentSaleRevenue;
      timelineMap[dateKey].profit += currentSaleProfit;
      timelineMap[dateKey].orders += 1;
    });

    const netProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0';
    const averageOrderValue = filteredSalesData.length > 0 ? (totalRevenue / filteredSalesData.length).toFixed(0) : '0';

    // Sort timeline chronologically
    const revenueTimeline = Object.values(timelineMap).sort((a, b) => a.timestamp - b.timestamp);

    return {
      totalRevenue,
      netProfit,
      totalCost,
      profitMargin,
      totalItemsSold,
      totalOrders: filteredSalesData.length,
      averageOrderValue,
      revenueTimeline
    };
  }, [filteredSalesData, allProducts]);

  // Selected Product Statistics for Circular Ring Chart
  const selectedProductStats = useMemo(() => {
    const product = allProducts.find((p) => String(p.id) === String(selectedProductId));
    if (!product) {
      return {
        name: 'Select Product',
        remainingQty: 0,
        soldQty: 0,
        totalQty: 0,
        chartData: [
          { name: 'Sold Quantity', value: 0, color: '#10b981' },
          { name: 'Remaining Quantity', value: 1, color: '#f97316' }
        ]
      };
    }

    let soldQty = 0;
    filteredSalesData.forEach((sale) => {
      if (Array.isArray(sale.items)) {
        sale.items.forEach((item: any) => {
          const isIdMatch = String(item.id) === String(product.id);
          const isNameMatch = item.name && item.name.trim().toLowerCase() === product.name?.trim().toLowerCase();
          
          if (isIdMatch || isNameMatch) {
            soldQty += Number(item.quantity || 1);
          }
        });
      }
    });

    const remainingQty = product.quantityNum;
    const totalQty = remainingQty + soldQty;

    return {
      name: product.name,
      remainingQty,
      soldQty,
      totalQty,
      chartData: [
        { name: 'Sold Quantity', value: soldQty, color: '#10b981' },
        { name: 'Remaining Quantity', value: remainingQty, color: '#f97316' }
      ]
    };
  }, [allProducts, selectedProductId, filteredSalesData]);

  // Navigation Items
  const navigationTabs = [
    { id: 'home', label: 'Home', icon: Home, href: '/' },
    { id: 'add', label: 'Add Product', icon: PlusCircle, href: '/add-product' },
    { id: 'inventory', label: 'Sell Product', icon: ShoppingCart, href: '/sell-product' },
    { id: 'analytics', label: 'Analytics', icon: PieChart, href: '/analytics' },
    { id: 'notification', label: 'Notification', icon: Bell, href: '/notifications' },
  ];

  return (
    <div className={`min-h-screen bg-[#f8fafc] dark:bg-[#070b13] text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-36 ${isDark ? 'dark' : ''}`}>
      
      {/* ERROR TOAST */}
      {showErrorToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] bg-rose-600 text-white font-extrabold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-[0_0_30px_rgba(225,19,72,0.5)] flex items-center gap-3 border border-rose-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
          <button onClick={() => setShowErrorToast(false)} className="ml-2 hover:opacity-80">
            <X className="h-4 w-4" />
          </button>
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
              <span className="absolute right-2 top-2 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        
        {/* HERO BANNER CARD WITH DYNAMIC 7, 15, 30 DAYS FILTERS */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 dark:from-[#0c1222] dark:via-[#0e162a] dark:to-[#070b13] p-6 md:p-8 border-2 border-orange-500/80 shadow-[0_0_30px_rgba(249,115,22,0.25)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">INTELLIGENT REVENUE INSIGHTS</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                Business Performance & Analytics
              </h1>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Real-time sales velocity, revenue trends, profit breakdowns, and low stock indicators.
              </p>
            </div>

            {/* TIME RANGE SELECTOR (7 Days, 15 Days, 30 Days, All Time) */}
            <div className="bg-white/90 dark:bg-[#070b13]/90 backdrop-blur-md p-1.5 rounded-full border border-orange-500/30 flex items-center gap-1 shadow-lg self-start md:self-auto">
              {[
                { id: '7d', label: '7 Days' },
                { id: '15d', label: '15 Days' },
                { id: '30d', label: '30 Days' },
                { id: 'all', label: 'All Time' }
              ].map((range) => (
                <button
                  key={range.id}
                  onClick={() => setTimeRange(range.id as any)}
                  className={`px-4 py-2 rounded-full text-xs font-black transition-all ${
                    timeRange === range.id
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_4px_15px_rgba(249,115,22,0.4)]'
                      : 'text-slate-500 dark:text-slate-400 hover:text-orange-500'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* METRICS SUMMARY GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm flex flex-col justify-between space-y-2 hover:border-orange-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Revenue</span>
              <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-500">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                Rs. {computedAnalytics.totalRevenue.toLocaleString()}
              </p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-500 mt-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Active Period</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm flex flex-col justify-between space-y-2 hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Net Profit</span>
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500">
                <Zap className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-500">
                Rs. {computedAnalytics.netProfit.toLocaleString()}
              </p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-500 mt-1">
                <span>{computedAnalytics.profitMargin}% Profit Margin</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm flex flex-col justify-between space-y-2 hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Orders</span>
              <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500">
                <ShoppingCart className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {computedAnalytics.totalOrders}
              </p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 mt-1">
                <span>Avg Rs. {computedAnalytics.averageOrderValue} / order</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm flex flex-col justify-between space-y-2 hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Items Sold</span>
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500">
                <Package className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-amber-500">
                {computedAnalytics.totalItemsSold}
              </p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 mt-1">
                <span>Units Dispatched</span>
              </div>
            </div>
          </div>

        </div>

        {/* REVENUE GRAPH & LOW STOCK CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* MAIN AREA REVENUE & PROFIT TRAJECTORY CHART */}
          <div className="lg:col-span-2 bg-white dark:bg-[#0c1222] p-6 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Revenue & Profit Trajectory</h3>
                <p className="text-xs font-bold text-slate-400">Daily financial breakdown performance</p>
              </div>
              <span className="text-xs font-black text-orange-500 bg-orange-500/10 px-3.5 py-1.5 rounded-full border border-orange-500/30">
                Live Overview
              </span>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={
                    computedAnalytics.revenueTimeline.length > 0 
                      ? computedAnalytics.revenueTimeline 
                      : [{ date: 'Today', sales: 0, profit: 0 }]
                  }
                >
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} fontWeight={700} />
                  <YAxis stroke="#94a3b8" fontSize={11} fontWeight={700} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDark ? '#0c1222' : '#ffffff', 
                      borderColor: '#f97316', 
                      borderRadius: '1rem',
                      fontWeight: 'bold',
                      boxShadow: '0px 10px 25px rgba(0,0,0,0.1)'
                    }} 
                    formatter={(value: any) => [`Rs. ${Number(value).toLocaleString()}`, '']}
                  />
                  <Area type="monotone" dataKey="sales" name="Sales (Rs)" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                  <Area type="monotone" dataKey="profit" name="Profit (Rs)" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RECREATED LOW STOCK ALERT CARD (4 LOWEST QUANTITY PRODUCTS) */}
          <div className="bg-white dark:bg-[#0c1222] p-6 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" /> Low Stock Alert
                </h3>
                <p className="text-xs font-bold text-slate-400">4 Products lowest in quantity</p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                ACTION NEEDED
              </span>
            </div>

            <div className="space-y-3 my-auto">
              {lowestQuantityProducts.length > 0 ? (
                lowestQuantityProducts.map((prod, idx) => (
                  <div 
                    key={prod.id || idx} 
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 dark:bg-[#070b13] border border-slate-200/60 dark:border-slate-800/80 transition-all hover:border-amber-500/50"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {prod.avatar ? (
                        <img src={prod.avatar} alt={prod.name} className="h-10 w-10 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-inner">
                          {prod.name?.charAt(0).toUpperCase() || 'P'}
                        </div>
                      )}
                      <div className="truncate">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">{prod.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">{prod.categoryName}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        {prod.quantityNum} left
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs font-bold text-slate-400">
                  No products available in inventory.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* DYNAMIC PRODUCT SELECTOR & CIRCULAR RING CHART */}
        <div className="bg-white dark:bg-[#0c1222] p-6 sm:p-8 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-5">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Product Inventory Dynamics</h3>
              <p className="text-xs font-bold text-slate-400">Select a product to view stock ratio & unit metrics</p>
            </div>

            {/* PRODUCT FILTER DROPDOWN */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#070b13] px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-orange-500 shrink-0" />
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-100 outline-none w-full cursor-pointer"
              >
                {allProducts.length === 0 && <option value="">No products available</option>}
                {allProducts.map((p) => (
                  <option key={p.id} value={p.id} className="bg-white dark:bg-[#0c1222] text-slate-900 dark:text-white">
                    {p.name} ({p.quantityNum} in stock)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ANIMATED CIRCULAR RING CHART */}
          <div className="flex flex-col md:flex-row items-center justify-around gap-8 py-4">
            <div className="relative w-64 h-64 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-2xl animate-pulse"></div>
              <div className="absolute inset-2 rounded-full bg-orange-500/10 blur-xl"></div>

              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={selectedProductStats.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    isAnimationActive={true}
                    animationDuration={1200}
                    animationEasing="ease-out"
                    stroke="none"
                  >
                    {selectedProductStats.chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        className="transition-all duration-500 hover:opacity-80"
                        style={{
                          filter: entry.color === '#10b981' 
                            ? 'drop-shadow(0px 0px 8px rgba(16, 185, 129, 0.8))' 
                            : 'drop-shadow(0px 0px 8px rgba(249, 115, 22, 0.8))'
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDark ? '#0c1222' : '#ffffff', 
                      borderRadius: '1rem', 
                      fontWeight: 'bold',
                      borderColor: '#f97316'
                    }} 
                  />
                </RechartsPie>
              </ResponsiveContainer>

              {/* Total Units Displayed in Center */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Products</span>
                <span className="text-3xl font-black text-slate-900 dark:text-white drop-shadow-sm">
                  {selectedProductStats.totalQty}
                </span>
                <span className="text-[10px] font-bold text-slate-400">Units Total</span>
              </div>
            </div>

            {/* Glowing Statistics Metrics */}
            <div className="space-y-4 w-full max-w-xs">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>
                  <div>
                    <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">Sold Quantity</p>
                    <p className="text-[10px] font-bold text-slate-400">Dispatched units</p>
                  </div>
                </div>
                <span className="text-xl font-black text-emerald-500">{selectedProductStats.soldQty}</span>
              </div>

              <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-between shadow-[0_0_20px_rgba(249,115,22,0.15)]">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-orange-500 shadow-[0_0_10px_#f97316]"></div>
                  <div>
                    <p className="text-xs font-black text-orange-600 dark:text-orange-400">Remaining Quantity</p>
                    <p className="text-[10px] font-bold text-slate-400">In stock units</p>
                  </div>
                </div>
                <span className="text-xl font-black text-orange-500">{selectedProductStats.remainingQty}</span>
              </div>
            </div>
          </div>
        </div>

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
                onClick={() => setActiveTab(tab.id)}
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
