import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Home,
  PlusCircle,
  ShoppingCart,
  PieChart,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowLeft,
  Banknote,
  Package,
  Layers,
  Flame,
  Edit3,
  AlertCircle,
  Box,
  ChevronLeft,
  ChevronRight
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

// Helper function to safely convert any value to a valid finite number (fixes all NaN issues)
const safeNum = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

interface Product {
  id: string | number;
  name: string;
  quantity: number;
  costPrice: number;
  salePrice: number;
  avatar?: string;
  categoryDocId: string;
  rawProductData: any;
}

interface SaleDocItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export default function StockOverview() {
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory');

  // Firestore Inventory & Sales State
  const [products, setProducts] = useState<Product[]>([]);
  const [salesMap, setSalesMap] = useState<{ [productName: string]: number }>({});
  const [loading, setLoading] = useState(true);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'in'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'qty-asc' | 'qty-desc' | 'sold-desc'>('sold-desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // UI Toast State
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Stock Adjustment Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newQuantityInput, setNewQuantityInput] = useState<number | ''>('');
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);

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

  // Fetch Stock and Sales Data sequentially from Firebase Firestore
  const fetchStockAndSalesData = async () => {
    if (!currentUserEmail) return;
    setLoading(true);
    try {
      // Step A: Fetch Products from Inventory Categories sequentially
      const inventoryRef = collection(db, 'users', currentUserEmail, 'inventory_categories');
      const invSnap = await getDocs(inventoryRef);

      const fetchedProducts: Product[] = [];

      invSnap.docs.forEach((categoryDoc) => {
        const data = categoryDoc.data();
        if (data && Array.isArray(data.products)) {
          data.products.forEach((prod: any) => {
            fetchedProducts.push({
              id: prod.id || Math.random().toString(),
              name: prod.name || 'Unnamed Product',
              quantity: safeNum(prod.quantity),
              costPrice: safeNum(prod.costPrice),
              salePrice: safeNum(prod.salePrice),
              avatar: prod.avatar || '',
              categoryDocId: categoryDoc.id,
              rawProductData: prod
            });
          });
        }
      });

      // Step B: Fetch Sales Documents sequentially to compute Most Selling Products
      const salesRef = collection(db, 'users', currentUserEmail, 'sales');
      const salesSnap = await getDocs(salesRef);

      const soldCounts: { [productName: string]: number } = {};

      salesSnap.docs.forEach((saleDoc) => {
        const sData = saleDoc.data();
        if (sData && Array.isArray(sData.items)) {
          sData.items.forEach((item: SaleDocItem) => {
            const nameKey = item.name ? item.name.trim().toLowerCase() : '';
            if (nameKey) {
              soldCounts[nameKey] = (soldCounts[nameKey] || 0) + safeNum(item.quantity);
            }
          });
        }
      });

      setProducts(fetchedProducts);
      setSalesMap(soldCounts);
    } catch (err) {
      console.error("Error fetching inventory data:", err);
      triggerError("Failed to fetch stock overview data!");
    } fontally: {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockAndSalesData();
  }, [currentUserEmail]);

  // Reset pagination to page 1 whenever search, filter, or sort options change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, stockFilter, sortBy]);

  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setShowErrorToast(true);
    setTimeout(() => setShowErrorToast(false), 3500);
  };

  const triggerSuccess = (msg: string) => {
    setToastMessage(msg);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3500);
  };

  const getUnitsSold = (productName: string) => {
    const key = productName.trim().toLowerCase();
    return salesMap[key] || 0;
  };

  const mostSellingProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => getUnitsSold(b.name) - getUnitsSold(a.name))
      .slice(0, 4);
  }, [products, salesMap]);

  const stats = useMemo(() => {
    let totalStockQty = 0;
    let totalValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach((p) => {
      const qty = safeNum(p.quantity);
      const price = safeNum(p.salePrice);
      totalStockQty += qty;
      totalValuation += qty * price;

      if (qty === 0) outOfStockCount++;
      else if (qty < 10) lowStockCount++;
    });

    return {
      totalProducts: products.length,
      totalStockQty,
      totalValuation,
      lowStockCount,
      outOfStockCount
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        let matchesStock = true;
        const qty = safeNum(p.quantity);
        if (stockFilter === 'low') matchesStock = qty > 0 && qty < 10;
        else if (stockFilter === 'out') matchesStock = qty === 0;
        else if (stockFilter === 'in') matchesStock = qty >= 10;

        return matchesSearch && matchesStock;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'qty-asc') return safeNum(a.quantity) - safeNum(b.quantity);
        if (sortBy === 'qty-desc') return safeNum(b.quantity) - safeNum(a.quantity);
        if (sortBy === 'sold-desc') return getUnitsSold(b.name) - getUnitsSold(a.name);
        return 0;
      });
  }, [products, searchQuery, stockFilter, sortBy, salesMap]);

  // Paginated products calculations
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const currentPaginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const handleUpdateStockQuantity = async () => {
    if (!selectedProduct || newQuantityInput === '') return;
    const validatedQty = safeNum(newQuantityInput);
    if (validatedQty < 0) {
      return triggerError("Stock quantity cannot be negative!");
    }

    if (!currentUserEmail) return;
    setIsUpdatingStock(true);

    try {
      const categoryRef = doc(db, 'users', currentUserEmail, 'inventory_categories', selectedProduct.categoryDocId);
      const categorySnap = await getDocs(collection(db, 'users', currentUserEmail, 'inventory_categories'));
      let updatedProductsArray: any[] = [];

      categorySnap.forEach((cDoc) => {
        if (cDoc.id === selectedProduct.categoryDocId) {
          const cData = cDoc.data();
          if (Array.isArray(cData.products)) {
            updatedProductsArray = cData.products.map((p: any) => {
              if (String(p.id) === String(selectedProduct.id)) {
                return { ...p, quantity: validatedQty };
              }
              return p;
            });
          }
        }
      });

      await updateDoc(categoryRef, {
        products: updatedProductsArray
      });

      triggerSuccess(`Successfully updated stock for ${selectedProduct.name}!`);
      setSelectedProduct(null);
      setNewQuantityInput('');
      fetchStockAndSalesData();
    } catch (err) {
      console.error("Stock update error:", err);
      triggerError("Failed to update product stock quantity.");
    } finally {
      setIsUpdatingStock(false);
    }
  };

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

      {/* SUCCESS TOAST */}
      {showSuccessToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-xs sm:text-sm px-6 py-3.5 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.6)] flex items-center gap-3 border border-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 animate-bounce" />
          <span>{toastMessage}</span>
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
        
        {/* HERO BANNER CARD */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 dark:from-[#0c1222] dark:via-[#0e162a] dark:to-[#070b13] p-6 md:p-8 border-2 border-orange-500/80 shadow-[0_0_30px_rgba(249,115,22,0.25)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                <Package className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">LIVE INVENTORY ANALYTICS</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                Stock Overview & Most Selling
              </h1>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Monitor real-time product quantities, track fast-moving items, and manage inventory stock levels.
              </p>
            </div>

            {/* TOTAL INVENTORY VALUATION BADGE */}
            <div className="bg-white/80 dark:bg-[#070b13]/80 backdrop-blur-md px-6 py-4 rounded-3xl border border-orange-500/30 flex items-center gap-4 shadow-lg">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]">
                <Banknote className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Stock Value</span>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  Rs. {safeNum(stats.totalValuation).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* METRICS SUMMARY GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-500">
              <Box className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Products</span>
              <p className="text-xl font-black text-slate-900 dark:text-white">{stats.totalProducts}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Units</span>
              <p className="text-xl font-black text-slate-900 dark:text-white">{safeNum(stats.totalStockQty)}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Low Stock (&lt;10)</span>
              <p className="text-xl font-black text-amber-500">{stats.lowStockCount}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Out of Stock</span>
              <p className="text-xl font-black text-rose-500">{stats.outOfStockCount}</p>
            </div>
          </div>
        </div>

        {/* MOST SELLING PRODUCTS SECTION (4 ANIMATED & GLOWING CARDS) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500 animate-pulse" />
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Most Selling Products
              </h2>
            </div>
            <span className="text-xs font-extrabold text-orange-500">Ranked by Sales Volume</span>
          </div>

          {loading ? (
            <div className="text-center py-10 bg-white dark:bg-[#0c1222] rounded-[2rem]">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-orange-500 border-t-transparent"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {mostSellingProducts.map((p, index) => {
                const soldQty = safeNum(getUnitsSold(p.name));
                const actualSalePrice = safeNum(p.salePrice);
                return (
                  <div
                    key={p.id}
                    className="relative overflow-hidden bg-white dark:bg-[#0c1222] p-5 rounded-[2.2rem] border-2 border-orange-500/80 shadow-[0_0_25px_rgba(249,115,22,0.35)] hover:shadow-[0_0_40px_rgba(249,115,22,0.6)] hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between space-y-4 group"
                  >
                    {/* GLOWING ANIMATED BACKDROP PULSE */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-orange-500/20 rounded-[2.2rem] blur-md opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse -z-10"></div>

                    <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 text-white font-black text-xs flex items-center justify-center shadow-[0_0_12px_rgba(249,115,22,0.8)] border border-white/40">
                      #{index + 1}
                    </div>

                    <div className="flex items-center gap-3">
                      {p.avatar ? (
                        <img src={p.avatar} alt={p.name} className="h-12 w-12 rounded-2xl object-cover border-2 border-orange-500/40 shadow-sm" />
                      ) : (
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-orange-500 font-black flex items-center justify-center text-lg border border-orange-500/40 shadow-inner">
                          {p.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h3 className="font-black text-sm text-slate-900 dark:text-white line-clamp-1">{p.name}</h3>
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Rs. {actualSalePrice} / unit</span>
                      </div>
                    </div>

                    <div className="bg-orange-500/5 dark:bg-[#070b13]/80 p-3 rounded-2xl border border-orange-500/20 flex items-center justify-between text-xs font-black">
                      <span className="text-slate-500 dark:text-slate-400">Total Units Sold:</span>
                      <span className="text-orange-500 font-black text-sm drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">{soldQty} Units</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SEARCH, FILTER & SORT BAR */}
        <div className="bg-white dark:bg-[#0c1222] p-4 sm:p-5 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-xs font-extrabold text-slate-800 dark:text-slate-100 outline-none focus:border-orange-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#070b13] p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
              {[
                { id: 'all', label: 'All' },
                { id: 'in', label: 'In Stock' },
                { id: 'low', label: 'Low Stock' },
                { id: 'out', label: 'Out of Stock' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStockFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    stockFilter === f.id
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'text-slate-500 hover:text-orange-500'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-100 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2.5 text-xs font-black text-slate-700 dark:text-slate-300 outline-none focus:border-orange-500"
            >
              <option value="sold-desc">Sort by Most Sold</option>
              <option value="qty-desc">Sort by Qty (High to Low)</option>
              <option value="qty-asc">Sort by Qty (Low to High)</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
        </div>

        {/* ALL PRODUCTS LIST GRID (PAGINATED AT 5 ITEMS PER PAGE) */}
        {loading ? (
          <div className="text-center py-20 bg-white dark:bg-[#0c1222] rounded-[2.5rem] border border-slate-200 dark:border-slate-800">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
            <p className="mt-3 text-xs font-black text-slate-400">Loading Product Inventory...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#0c1222] rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
            <Box className="h-12 w-12 text-slate-400 mx-auto opacity-80" />
            <h3 className="text-base font-black text-slate-700 dark:text-slate-200">No Products Found</h3>
            <p className="text-xs font-bold text-slate-400 max-w-sm mx-auto">
              No inventory products match your current search or stock filter.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentPaginatedProducts.map((p) => {
                const soldUnits = safeNum(getUnitsSold(p.name));
                const currentQty = safeNum(p.quantity);
                const actualCostPrice = safeNum(p.costPrice);
                const actualSalePrice = safeNum(p.salePrice);

                const isLow = currentQty > 0 && currentQty < 10;
                const isOut = currentQty === 0;

                return (
                  <div
                    key={p.id}
                    className="bg-white dark:bg-[#0c1222] p-6 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm hover:border-orange-500/40 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {p.avatar ? (
                          <img src={p.avatar} alt={p.name} className="h-12 w-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-800" />
                        ) : (
                          <div className="h-12 w-12 rounded-2xl bg-orange-500/10 text-orange-500 font-black flex items-center justify-center text-lg border border-orange-500/30">
                            {p.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h3 className="text-base font-black text-slate-900 dark:text-white line-clamp-1">{p.name}</h3>
                          <span className="text-[11px] font-bold text-slate-400">ID: {p.id}</span>
                        </div>
                      </div>

                      <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${
                        isOut
                          ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                          : isLow
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                      }`}>
                        {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#070b13] p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                        <span>Sale Price:</span>
                        <span className="font-black text-orange-500">Rs. {actualSalePrice}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                        <span>Cost Price:</span>
                        <span>Rs. {actualCostPrice}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                        <span>Units Sold:</span>
                        <span className="text-slate-900 dark:text-white font-black">{soldUnits} units</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Current Stock</span>
                        <span className={`text-2xl font-black ${isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                          {currentQty} <span className="text-xs font-bold text-slate-400">units</span>
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedProduct(p);
                          setNewQuantityInput(currentQty);
                        }}
                        className="px-4 py-2.5 rounded-2xl bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white font-black text-xs transition-all flex items-center gap-1.5 border border-orange-500/30"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Adjust Stock
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ANIMATED BEAUTIFUL PAGINATION CONTROLS (5 ITEMS PER PAGE) */}
            <div className="bg-white dark:bg-[#0c1222] p-4 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Showing <strong className="text-orange-500">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredProducts.length)}</strong> to <strong className="text-orange-500">{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</strong> of <strong className="text-slate-900 dark:text-white">{filteredProducts.length}</strong> products
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-orange-500 hover:text-white hover:border-orange-500 disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 transition-all flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>

                <div className="flex items-center gap-1.5">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-8 w-8 rounded-xl text-xs font-black transition-all ${
                        currentPage === pageNum
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)] scale-110'
                          : 'bg-slate-100 dark:bg-[#070b13] text-slate-600 dark:text-slate-400 hover:text-orange-500 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-orange-500 hover:text-white hover:border-orange-500 disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 transition-all flex items-center gap-1"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* STOCK ADJUSTMENT MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500/50 rounded-[2.5rem] p-6 max-w-md w-full shadow-[0_0_50px_rgba(249,115,22,0.3)] space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-black uppercase text-orange-500 tracking-wider block">UPDATE STOCK QUANTITY</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {selectedProduct.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-[#070b13] hover:text-orange-500 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Available Stock Quantity
              </label>
              <div className="relative">
                <Box className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  placeholder="Enter new quantity"
                  value={newQuantityInput}
                  onChange={(e) => setNewQuantityInput(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-sm font-black text-slate-900 dark:text-slate-100 outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-[#070b13] text-slate-600 dark:text-slate-400 font-black text-xs uppercase tracking-wider rounded-2xl hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateStockQuantity}
                disabled={isUpdatingStock}
                className="flex-1 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg hover:scale-[1.01] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isUpdatingStock ? "Updating..." : "Save Quantity"}
              </button>
            </div>
          </div>
        </div>
      )}

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
