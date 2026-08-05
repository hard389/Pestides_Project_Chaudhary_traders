import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  setDoc, 
  updateDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  Search,
  Bell,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  Home,
  PlusCircle,
  ShoppingCart,
  PieChart,
  Check,
  Save,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  SlidersHorizontal,
  Lock,
  AlertTriangle,
  X,
  ArrowLeft,
  Trash2,
  Edit2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  Receipt,
  User,
  Package,
  CalendarDays,
  Filter
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

const CUSTOMERS_PER_PAGE = 10;

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  availableStock: number;
}

interface CustomerBill {
  id: string;
  customerName: string;
  date: string;
  items: { name: string; quantity: number; price: number; total: number }[];
  grandTotal: number;
  paymentType: 'CASH' | 'CREDIT';
  paidAmount: number;
  creditAmount: number;
}

export default function SellProduct() {
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState('sell');

  // Available Pesticide Inventory from Firebase
  const [inventory, setInventory] = useState<any[]>([]);

  // Form Input States
  const [customerName, setCustomerName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [unitPrice, setUnitPrice] = useState<number | ''>('');

  // Cart & Editing States
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Payment States
  const [paymentType, setPaymentType] = useState<'CASH' | 'CREDIT'>('CASH');
  const [paidAmountInput, setPaidAmountInput] = useState<number | ''>('');

  // Saved Customers / Bills Data
  const [customerBills, setCustomerBills] = useState<CustomerBill[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [dayFilter, setDayFilter] = useState<number | ''>('');
  const [thisMonthOnly, setThisMonthOnly] = useState(false);
  const [customerPage, setCustomerPage] = useState(1);

  // UI Toast & Modal States
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [latestBill, setLatestBill] = useState<CustomerBill | null>(null);
  const [showBillModal, setShowBillModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Authentication Listener
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

  // 2. Fetch Pesticide Products from path: users/{email}/inventory_categories/general_inventory
  useEffect(() => {
    if (!currentUserEmail) return;

    const fetchData = async () => {
      try {
        // Fetch document general_inventory
        const docRef = doc(db, 'users', currentUserEmail, 'inventory_categories', 'general_inventory');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const productsArray = data.products || [];

          // Map items to internal format expected by the UI
          const formattedProducts = productsArray.map((p: any, index: number) => ({
            id: String(p.id || index),
            name: p.name || 'Unnamed Product',
            stock: Number(p.quantity || 0),
            price: Number(p.salePrice || 0),
            costPrice: Number(p.costPrice || 0),
            avatar: p.avatar || ''
          }));

          setInventory(formattedProducts);
        } else {
          setInventory([]);
        }

        // Fetch Saved Sales Bills
        const billsRef = collection(db, 'users', currentUserEmail, 'sales');
        const q = query(billsRef, orderBy('date', 'desc'));
        const billsSnap = await getDocs(q);
        const fetchedBills = billsSnap.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as CustomerBill[];
        setCustomerBills(fetchedBills);
      } catch (err) {
        console.error("Firebase fetch error:", err);
      }
    };

    fetchData();
  }, [currentUserEmail]);

  // 3. IDENTIFY FREQUENT CUSTOMERS WITH 3 OR MORE ORDERS
  const frequentCustomers = useMemo(() => {
    const orderCounts: Record<string, number> = {};
    customerBills.forEach(bill => {
      const name = bill.customerName ? bill.customerName.trim() : '';
      if (name) {
        orderCounts[name] = (orderCounts[name] || 0) + 1;
      }
    });

    // Return unique list of customer names who have 3 or more completed orders
    return Object.keys(orderCounts).filter(name => orderCounts[name] >= 3);
  }, [customerBills]);

  // Filter Auto-Suggestions based on current input
  const filteredSuggestions = useMemo(() => {
    if (!customerName.trim()) return [];
    return frequentCustomers.filter(name =>
      name.toLowerCase().includes(customerName.toLowerCase().trim())
    );
  }, [frequentCustomers, customerName]);

  // Handle Product Dropdown Change
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    const prod = inventory.find(p => p.id === productId);
    if (prod) {
      setUnitPrice(prod.price || 0);
    } else {
      setUnitPrice('');
    }
  };

  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setShowErrorToast(true);
    setTimeout(() => setShowErrorToast(false), 3500);
  };

  // Add Item to Cart
  const handleAddToCart = () => {
    if (!selectedProductId) return triggerError("Please select a pesticide product!");
    if (!quantity || Number(quantity) <= 0) return triggerError("Please enter a valid quantity!");
    if (unitPrice === '' || Number(unitPrice) < 0) return triggerError("Please enter a valid price!");

    const prod = inventory.find(p => p.id === selectedProductId);
    if (!prod) return triggerError("Product not found!");

    if (Number(quantity) > prod.stock) {
      return triggerError(`Stock unavailable! Only ${prod.stock} units available.`);
    }

    const existingIndex = cartItems.findIndex(i => i.id === selectedProductId);
    if (existingIndex > -1) {
      const updated = [...cartItems];
      const newQty = updated[existingIndex].quantity + Number(quantity);
      if (newQty > prod.stock) {
        return triggerError(`Cannot exceed available stock (${prod.stock} units).`);
      }
      updated[existingIndex].quantity = newQty;
      updated[existingIndex].price = Number(unitPrice);
      setCartItems(updated);
    } else {
      setCartItems(prev => [
        ...prev,
        {
          id: prod.id,
          name: prod.name || 'Pesticide Product',
          quantity: Number(quantity),
          price: Number(unitPrice),
          availableStock: prod.stock
        }
      ]);
    }

    // Reset product selection inputs only
    setSelectedProductId('');
    setQuantity(1);
    setUnitPrice('');
  };

  // Update Cart Item Quantity or Price
  const handleUpdateCartItem = (id: string, newQty: number, newPrice: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id) {
        const clampedQty = Math.min(Math.max(1, newQty), item.availableStock);
        return { ...item, quantity: clampedQty, price: Math.max(0, newPrice) };
      }
      return item;
    }));
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  // Grand Total Calculation
  const grandTotal = useMemo(() => {
    return cartItems.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0);
  }, [cartItems]);

  // Net Paid and Credit Amounts
  const calculatedPayment = useMemo(() => {
    if (paymentType === 'CASH') {
      return { paid: grandTotal, credit: 0 };
    }
    const paid = paidAmountInput === '' ? 0 : Math.min(Number(paidAmountInput), grandTotal);
    const credit = Math.max(0, grandTotal - paid);
    return { paid, credit };
  }, [paymentType, paidAmountInput, grandTotal]);

  // Save Bill & Update Firestore Document
  const handleSaveBill = async () => {
    if (!customerName.trim()) return triggerError("Please enter Customer Name!");
    if (cartItems.length === 0) return triggerError("Cart is empty! Add products first.");
    if (!currentUserEmail) return;

    setIsSubmitting(true);

    try {
      const billData: CustomerBill = {
        id: `INV-${Date.now()}`,
        customerName: customerName.trim(),
        date: new Date().toISOString(),
        items: cartItems.map(i => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          total: i.quantity * i.price
        })),
        grandTotal: grandTotal,
        paymentType: paymentType,
        paidAmount: calculatedPayment.paid,
        creditAmount: calculatedPayment.credit
      };

      // 1. Save Bill record
      const billRef = doc(db, 'users', currentUserEmail, 'sales', billData.id);
      await setDoc(billRef, billData);

      // 2. Update array inside general_inventory document
      const genInvRef = doc(db, 'users', currentUserEmail, 'inventory_categories', 'general_inventory');
      const docSnap = await getDoc(genInvRef);

      if (docSnap.exists()) {
        const currentData = docSnap.data();
        let productsArray = currentData.products || [];

        // Deduct quantities for sold products
        cartItems.forEach(cartItem => {
          productsArray = productsArray.map((p: any) => {
            if (String(p.id) === String(cartItem.id)) {
              const currentQty = Number(p.quantity || 0);
              return {
                ...p,
                quantity: String(Math.max(0, currentQty - cartItem.quantity))
              };
            }
            return p;
          });
        });

        await updateDoc(genInvRef, { products: productsArray });

        // Refresh local inventory state
        setInventory(prev => prev.map(invItem => {
          const cartMatch = cartItems.find(c => String(c.id) === String(invItem.id));
          if (cartMatch) {
            return { ...invItem, stock: Math.max(0, invItem.stock - cartMatch.quantity) };
          }
          return invItem;
        }));
      }

      // 3. Update Local States
      setCustomerBills(prev => [billData, ...prev]);
      setLatestBill(billData);
      setShowBillModal(true);

      // Reset Form & Cart
      setCustomerName('');
      setShowSuggestions(false);
      setCartItems([]);
      setPaidAmountInput('');
      setPaymentType('CASH');

      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);

    } catch (error) {
      console.error("Error committing transaction:", error);
      triggerError("Failed to save transaction. Please check connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Saved Customer Cards
  const filteredCustomerBills = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return customerBills.filter(bill => {
      const matchesName = bill.customerName.toLowerCase().includes(customerSearchQuery.toLowerCase());
      
      let matchesDays = true;
      if (dayFilter !== '' && Number(dayFilter) >= 0) {
        const billDate = new Date(bill.date);
        const diffInDays = Math.floor((now.getTime() - billDate.getTime()) / (1000 * 3600 * 24));
        matchesDays = diffInDays <= Number(dayFilter);
      }

      let matchesMonth = true;
      if (thisMonthOnly) {
        const billDate = new Date(bill.date);
        matchesMonth = billDate.getMonth() === currentMonth && billDate.getFullYear() === currentYear;
      }

      return matchesName && matchesDays && matchesMonth;
    });
  }, [customerBills, customerSearchQuery, dayFilter, thisMonthOnly]);

  // Paginated Customers
  const totalCustomerPages = Math.ceil(filteredCustomerBills.length / CUSTOMERS_PER_PAGE) || 1;
  const paginatedCustomerBills = useMemo(() => {
    const start = (customerPage - 1) * CUSTOMERS_PER_PAGE;
    return filteredCustomerBills.slice(start, start + CUSTOMERS_PER_PAGE);
  }, [filteredCustomerBills, customerPage]);

  const navigationTabs = [
    { id: 'home', label: 'Home', icon: Home, href: '/' },
    { id: 'add', label: 'Add Product', icon: PlusCircle, href: '/add-product' },
    { id: 'sell', label: 'Sell Product', icon: ShoppingCart, href: '/sell-product' },
    { id: 'analytics', label: 'Analytics', icon: PieChart, href: '/analytics' },
    { id: 'notifications', label: 'Notification', icon: Bell, href: '/notifications' },
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
          <span>Sale Recorded & Stock Updated Automatically!</span>
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
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider">PREMIUM SELLING TERMINAL</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                Selling Products
              </h1>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Automated stock deduction, live cart management, cash & credit billing.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT FORM & CART SECTION */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* ADD ITEM INPUT CARD */}
            <div className="bg-white dark:bg-[#0c1222] p-6 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm space-y-5">
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-500" />
                <span>1. Enter Details</span>
              </h2>

              <div className="space-y-4">
                {/* Customer Name with Dynamic Auto-Suggestions */}
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                    Customer Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                    <input
                      type="text"
                      placeholder="Enter customer name..."
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      className="w-full bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-xs font-extrabold text-slate-800 dark:text-slate-100 outline-none focus:border-orange-500"
                    />

                    {/* Auto-Suggestion Popup for Frequent Customers (3+ Orders) */}
                    {showSuggestions && filteredSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-[#0c1222] border-2 border-orange-500 rounded-2xl shadow-2xl z-50 overflow-hidden">
                        <div className="px-3 py-1.5 bg-orange-500/10 border-b border-orange-500/20 text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Frequent Customer Suggestions (3+ Orders)
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowSuggestions(false)}
                            className="p-0.5 hover:bg-orange-500/20 rounded-md"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredSuggestions.map((name) => (
                            <div
                              key={name}
                              onClick={() => {
                                setCustomerName(name);
                                setShowSuggestions(false);
                              }}
                              className="px-4 py-2.5 text-xs font-black text-slate-800 dark:text-slate-100 hover:bg-orange-500 hover:text-white transition-colors cursor-pointer flex items-center justify-between"
                            >
                              <span>{name}</span>
                              <Check className="h-3.5 w-3.5 text-orange-400" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Select Product */}
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                    Select Pesticide Product
                  </label>
                  <div className="relative">
                    <select
                      value={selectedProductId}
                      onChange={(e) => handleProductSelect(e.target.value)}
                      className="w-full appearance-none bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-xs font-extrabold text-slate-800 dark:text-slate-100 outline-none focus:border-orange-500 cursor-pointer"
                    >
                      <option value="">-- Choose Pesticide --</option>
                      {inventory.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.name} (Stock: {prod.stock}) - Rs. {prod.price}
                        </option>
                      ))}
                    </select>
                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Quantity & Price Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-xs font-extrabold text-slate-800 dark:text-slate-100 outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                      Price (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-xs font-extrabold text-slate-800 dark:text-slate-100 outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Add Product Button */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-md hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4 stroke-[3]" /> Add Product To Bill
                </button>
              </div>
            </div>

            {/* CART ITEMS DISPLAY CARD */}
            <div className="bg-white dark:bg-[#0c1222] p-6 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-orange-500" />
                  <span>2. Added Products Card</span>
                </h2>
                <span className="text-xs font-black px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  {cartItems.length} Items
                </span>
              </div>

              {cartItems.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-[#070b13] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-400">No products added yet. Select a pesticide and click Add Product.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-50 dark:bg-[#070b13] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">{item.name}</h4>
                        <p className="text-[11px] font-bold text-slate-400">
                          Rs. {item.price} × {item.quantity} = <strong className="text-orange-500">Rs. {item.price * item.quantity}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Quantity Counter */}
                        <div className="flex items-center bg-white dark:bg-[#0c1222] rounded-xl border border-slate-200 dark:border-slate-800 p-1">
                          <button
                            onClick={() => handleUpdateCartItem(item.id, item.quantity - 1, item.price)}
                            className="p-1 hover:text-orange-500"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="px-2 text-xs font-black">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateCartItem(item.id, item.quantity + 1, item.price)}
                            className="p-1 hover:text-orange-500"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Price Input */}
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => handleUpdateCartItem(item.id, item.quantity, Number(e.target.value))}
                          className="w-20 bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800 rounded-xl py-1 px-2 text-xs font-extrabold outline-none focus:border-orange-500"
                        />

                        {/* Delete Button */}
                        <button
                          onClick={() => handleRemoveCartItem(item.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PAYMENT TYPE & CHECKOUT CARD */}
            <div className="bg-white dark:bg-[#0c1222] p-6 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm space-y-5">
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Banknote className="h-5 w-5 text-orange-500" />
                <span>3. Payment Setup</span>
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentType('CASH')}
                  className={`py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border-2 transition-all ${
                    paymentType === 'CASH'
                      ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                      : 'bg-slate-50 dark:bg-[#070b13] border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  <Banknote className="h-4 w-4" /> Net Cash
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentType('CREDIT')}
                  className={`py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border-2 transition-all ${
                    paymentType === 'CREDIT'
                      ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                      : 'bg-slate-50 dark:bg-[#070b13] border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  <CreditCard className="h-4 w-4" /> Credit / Udhaar
                </button>
              </div>

              {/* Partial Credit Input */}
              {paymentType === 'CREDIT' && (
                <div className="space-y-2 bg-amber-500/10 p-4 rounded-2xl border border-amber-500/30">
                  <label className="text-xs font-black text-amber-700 dark:text-amber-300 block">
                    Paid Amount (e.g. Total 3000, Customer gives 1000, Credit is 2000)
                  </label>
                  <input
                    type="number"
                    placeholder="Enter Paid Amount..."
                    value={paidAmountInput}
                    onChange={(e) => setPaidAmountInput(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white dark:bg-[#070b13] border border-amber-500/50 rounded-xl py-2.5 px-4 text-xs font-extrabold outline-none"
                  />
                  <div className="flex justify-between text-xs font-black text-amber-800 dark:text-amber-200 pt-1">
                    <span>Net Paid: Rs. {calculatedPayment.paid}</span>
                    <span>Remaining Credit: Rs. {calculatedPayment.credit}</span>
                  </div>
                </div>
              )}

              {/* Bill Summary Breakdown */}
              <div className="bg-slate-50 dark:bg-[#070b13] p-4 rounded-2xl space-y-2 text-xs font-extrabold">
                <div className="flex justify-between text-slate-500">
                  <span>Grand Total:</span>
                  <span className="text-slate-800 dark:text-slate-100">Rs. {grandTotal}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Net Paid:</span>
                  <span>Rs. {calculatedPayment.paid}</span>
                </div>
                <div className="flex justify-between text-rose-500">
                  <span>Credit Balance:</span>
                  <span>Rs. {calculatedPayment.credit}</span>
                </div>
              </div>

              {/* SAVE BILL BUTTON */}
              <button
                onClick={handleSaveBill}
                disabled={isSubmitting || cartItems.length === 0}
                className="w-full py-4 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-sm uppercase tracking-wider shadow-[0_10px_30px_rgba(255,108,0,0.4)] hover:scale-[1.01] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <Save className="h-5 w-5" />
                {isSubmitting ? "Generating Bill & Updating Stock..." : "Save Sale Bill"}
              </button>
            </div>

          </div>

          {/* RIGHT SAVED CUSTOMERS & BILLS HISTORY */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-[#0c1222] p-6 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-orange-500" />
                  <span>Customer Records</span>
                </h2>
              </div>

              {/* Filters for Customers */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search customer name..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-bold outline-none focus:border-orange-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Previous Days Filter Input */}
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#070b13] p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <CalendarDays className="h-4 w-4 text-orange-500 shrink-0" />
                    <input
                      type="number"
                      min="0"
                      placeholder="Last Days (e.g. 1)"
                      value={dayFilter}
                      onChange={(e) => setDayFilter(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-transparent text-xs font-black outline-none"
                    />
                  </div>

                  {/* This Month Toggle Filter Button */}
                  <button
                    type="button"
                    onClick={() => setThisMonthOnly(!thisMonthOnly)}
                    className={`p-2.5 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all border ${
                      thisMonthOnly
                        ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                        : 'bg-slate-50 dark:bg-[#070b13] border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span>This Month</span>
                  </button>
                </div>
              </div>

              {/* Customer Cards List */}
              <div className="space-y-3">
                {paginatedCustomerBills.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 dark:bg-[#070b13] rounded-2xl">
                    <p className="text-xs font-bold text-slate-400">No customer records found.</p>
                  </div>
                ) : (
                  paginatedCustomerBills.map((bill) => (
                    <div
                      key={bill.id}
                      className="bg-slate-50 dark:bg-[#070b13] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 space-y-2 shadow-sm hover:border-orange-500/50 transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">{bill.customerName}</h4>
                          <span className="text-[10px] font-bold text-slate-400">
                            {new Date(bill.date).toLocaleDateString()}
                          </span>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md ${
                          bill.creditAmount > 0 
                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        }`}>
                          {bill.creditAmount > 0 ? `Credit: Rs. ${bill.creditAmount}` : 'Paid Net Cash'}
                        </span>
                      </div>

                      <div className="text-[11px] font-bold text-slate-500 space-y-1">
                        {bill.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{it.name} ({it.quantity}x)</span>
                            <span>Rs. {it.total}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between items-center text-xs font-black">
                        <span>Total: Rs. {bill.grandTotal}</span>
                        <button
                          onClick={() => {
                            setLatestBill(bill);
                            setShowBillModal(true);
                          }}
                          className="text-[10px] text-orange-500 hover:underline"
                        >
                          View Receipt
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 10-Item Pagination */}
              {totalCustomerPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setCustomerPage(p => Math.max(p - 1, 1))}
                    disabled={customerPage === 1}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-[#070b13] disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-black text-slate-400">
                    Page {customerPage} of {totalCustomerPages}
                  </span>
                  <button
                    onClick={() => setCustomerPage(p => Math.min(p + 1, totalCustomerPages))}
                    disabled={customerPage === totalCustomerPages}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-[#070b13] disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* GENERATED SALE BILL CARD MODAL */}
      {showBillModal && latestBill && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500/50 rounded-[2.5rem] p-6 max-w-md w-full shadow-[0_0_50px_rgba(249,115,22,0.3)] space-y-5">
            <div className="text-center space-y-1">
              <span className="text-[10px] font-black uppercase text-orange-500 tracking-wider">OFFICIAL INVOICE</span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Pesticides Chaudhary Traders</h3>
              <p className="text-[11px] font-bold text-slate-400">Date: {new Date(latestBill.date).toLocaleString()}</p>
            </div>

            <div className="bg-slate-50 dark:bg-[#070b13] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="text-xs font-black text-slate-800 dark:text-slate-100">
                Customer: <span className="text-orange-500">{latestBill.customerName}</span>
              </div>

              <div className="space-y-1.5 border-t border-b border-slate-200 dark:border-slate-800 py-2">
                {latestBill.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span>{item.name} ({item.quantity}x)</span>
                    <span>Rs. {item.total}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-xs font-black">
                <div className="flex justify-between text-slate-800 dark:text-slate-100">
                  <span>Grand Total:</span>
                  <span>Rs. {latestBill.grandTotal}</span>
                </div>
                <div className="flex justify-between text-emerald-500">
                  <span>Paid Amount:</span>
                  <span>Rs. {latestBill.paidAmount}</span>
                </div>
                {latestBill.creditAmount > 0 && (
                  <div className="flex justify-between text-rose-500">
                    <span>Credit Balance:</span>
                    <span>Rs. {latestBill.creditAmount}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowBillModal(false)}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg hover:scale-[1.01] transition-all"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}

      {/* FLOATING BOTTOM NAVBAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-5 pt-2 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/90 to-transparent dark:from-[#070b13] dark:via-[#070b13]/90 pointer-events-none">
        <nav className="mx-auto max-w-md bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-[2.5rem] shadow-2xl px-4 py-3 flex items-center justify-around pointer-events-auto">
          {navigationTabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <Link
                key={tab.id}
                to={tab.href}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center justify-center flex-1 relative group"
              >
                <div className={`p-2.5 rounded-full transition-all duration-300 flex items-center justify-center ${
                  isActive 
                    ? 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.6)] scale-110' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}>
                  <IconComponent className="h-5 w-5" />
                </div>
                <span className={`text-[10px] font-black mt-1 transition-all ${
                  isActive ? 'text-orange-500' : 'text-slate-400'
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
