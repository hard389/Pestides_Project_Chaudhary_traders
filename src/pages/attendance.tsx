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
  deleteDoc,
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
  Home,
  PlusCircle,
  ShoppingCart,
  PieChart,
  Check,
  Save,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  Receipt,
  User,
  Package,
  Printer,
  FileText
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

// Strict Page Limit of 5 Records per Page
const CUSTOMERS_PER_PAGE = 5;

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

interface MonthlySummary {
  monthKey: string; // Format: "YYYY-MM"
  totalSales: number;
  totalCredit: number;
  totalPaid: number;
  updatedAt: string;
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

  // Cart States
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Payment States
  const [paymentType, setPaymentType] = useState<'CASH' | 'CREDIT'>('CASH');
  const [paidAmountInput, setPaidAmountInput] = useState<number | ''>('');

  // Saved Customers / Bills & Monthly Summaries
  const [customerBills, setCustomerBills] = useState<CustomerBill[]>([]);
  const [monthlySummaries, setMonthlySummaries] = useState<Record<string, MonthlySummary>>({});
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  
  // Date Filters
  const [dateFilterRange, setDateFilterRange] = useState<'today' | '3days' | 'week' | '15days' | 'month'>('today');
  const [customerPage, setCustomerPage] = useState(1);

  // Invoice Generator Modal States
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceRange, setInvoiceRange] = useState<'today' | '3days' | 'week' | '15days' | 'month'>('today');

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

  // 2. Fetch Data & Execute Smart 60-Day Automated Database Cleanup
  useEffect(() => {
    if (!currentUserEmail) return;

    const fetchDataAndCleanup = async () => {
      try {
        // Fetch inventory
        const docRef = doc(db, 'users', currentUserEmail, 'inventory_categories', 'general_inventory');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const productsArray = data.products || [];

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

        // Fetch Monthly Summaries first
        const summariesRef = collection(db, 'users', currentUserEmail, 'monthly_summaries');
        const summariesSnap = await getDocs(summariesRef);
        const summariesMap: Record<string, MonthlySummary> = {};
        summariesSnap.docs.forEach(d => {
          summariesMap[d.id] = d.data() as MonthlySummary;
        });

        // Fetch Sales History
        const billsRef = collection(db, 'users', currentUserEmail, 'sales');
        const q = query(billsRef, orderBy('date', 'desc'));
        const billsSnap = await getDocs(q);
        const rawBills = billsSnap.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as CustomerBill[];

        // Automated Database Cleanup (60 Days / 2-Month Retention Logic)
        const now = new Date();
        const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
        
        const activeBills: CustomerBill[] = [];
        const monthlyCalculations: Record<string, { totalSales: number; totalCredit: number; totalPaid: number }> = {};

        for (const bill of rawBills) {
          const billDate = new Date(bill.date);
          const timeDiff = now.getTime() - billDate.getTime();
          const monthKey = `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`;

          if (!monthlyCalculations[monthKey]) {
            monthlyCalculations[monthKey] = { totalSales: 0, totalCredit: 0, totalPaid: 0 };
          }
          monthlyCalculations[monthKey].totalSales += bill.grandTotal || 0;
          monthlyCalculations[monthKey].totalCredit += bill.creditAmount || 0;
          monthlyCalculations[monthKey].totalPaid += bill.paidAmount || 0;

          if (timeDiff > sixtyDaysMs && (bill.creditAmount === 0 || !bill.creditAmount)) {
            await deleteDoc(doc(db, 'users', currentUserEmail, 'sales', bill.id));
          } else {
            activeBills.push(bill);
          }
        }

        for (const [mKey, data] of Object.entries(monthlyCalculations)) {
          const summaryDocRef = doc(db, 'users', currentUserEmail, 'monthly_summaries', mKey);
          const summaryData: MonthlySummary = {
            monthKey: mKey,
            totalSales: data.totalSales,
            totalCredit: data.totalCredit,
            totalPaid: data.totalPaid,
            updatedAt: new Date().toISOString()
          };
          await setDoc(summaryDocRef, summaryData, { merge: true });
          summariesMap[mKey] = summaryData;
        }

        setMonthlySummaries(summariesMap);
        setCustomerBills(activeBills);

      } catch (err) {
        console.error("Firebase fetch/cleanup error:", err);
      }
    };

    fetchDataAndCleanup();
  }, [currentUserEmail]);

  // Total Sales of Current Year Calculation
  const totalYearlySales = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let total = 0;

    Object.keys(monthlySummaries).forEach(mKey => {
      if (mKey.startsWith(String(currentYear))) {
        total += monthlySummaries[mKey].totalSales || 0;
      }
    });

    customerBills.forEach(bill => {
      const bYear = new Date(bill.date).getFullYear();
      if (bYear === currentYear) {
        const mKey = `${bYear}-${String(new Date(bill.date).getMonth() + 1).padStart(2, '0')}`;
        if (!monthlySummaries[mKey]) {
          total += bill.grandTotal || 0;
        }
      }
    });

    return total;
  }, [monthlySummaries, customerBills]);

  // Credit Customers & 3+ Order Frequent Customers Calculation Logic
  const { creditCustomerNames, frequentCustomerNames, candidateCustomers } = useMemo(() => {
    const orderCounts: Record<string, number> = {};
    const creditSet = new Set<string>();
    const frequentSet = new Set<string>();

    customerBills.forEach(bill => {
      const name = bill.customerName ? bill.customerName.trim() : '';
      if (name) {
        orderCounts[name] = (orderCounts[name] || 0) + 1;
        if (bill.creditAmount && bill.creditAmount > 0) {
          creditSet.add(name);
        }
      }
    });

    Object.keys(orderCounts).forEach(name => {
      if (orderCounts[name] >= 3) {
        frequentSet.add(name);
      }
    });

    const combinedSet = new Set([...Array.from(creditSet), ...Array.from(frequentSet)]);

    return {
      creditCustomerNames: creditSet,
      frequentCustomerNames: frequentSet,
      candidateCustomers: Array.from(combinedSet)
    };
  }, [customerBills]);

  // Filter suggestions matching the typed input
  const filteredSuggestions = useMemo(() => {
    if (!customerName.trim()) return [];
    const queryStr = customerName.toLowerCase().trim();
    return candidateCustomers.filter(name =>
      name.toLowerCase().includes(queryStr)
    );
  }, [candidateCustomers, customerName]);

  // Auto-Select Logic
  useEffect(() => {
    if (!customerName.trim()) return;
    const typed = customerName.trim().toLowerCase();
    const matchFrequent = Array.from(frequentCustomerNames).find(
      name => name.toLowerCase() === typed
    );
    if (matchFrequent && customerName !== matchFrequent) {
      setCustomerName(matchFrequent);
      setShowSuggestions(false);
    }
  }, [customerName, frequentCustomerNames]);

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

    setSelectedProductId('');
    setQuantity(1);
    setUnitPrice('');
  };

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

  const grandTotal = useMemo(() => {
    return cartItems.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0);
  }, [cartItems]);

  const calculatedPayment = useMemo(() => {
    if (paymentType === 'CASH') {
      return { paid: grandTotal, credit: 0 };
    }
    const paid = paidAmountInput === '' ? 0 : Math.min(Number(paidAmountInput), grandTotal);
    const credit = Math.max(0, grandTotal - paid);
    return { paid, credit };
  }, [paymentType, paidAmountInput, grandTotal]);

  const handleSaveBill = async () => {
    if (!customerName.trim()) return triggerError("Please enter Customer Name!");
    if (cartItems.length === 0) return triggerError("Cart is empty! Add products first.");
    if (!currentUserEmail) return;

    setIsSubmitting(true);

    try {
      const now = new Date();
      const billData: CustomerBill = {
        id: `INV-${Date.now()}`,
        customerName: customerName.trim(),
        date: now.toISOString(),
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

      const billRef = doc(db, 'users', currentUserEmail, 'sales', billData.id);
      await setDoc(billRef, billData);

      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const summaryDocRef = doc(db, 'users', currentUserEmail, 'monthly_summaries', monthKey);
      const currentMonthSummary = monthlySummaries[monthKey] || { totalSales: 0, totalCredit: 0, totalPaid: 0 };
      
      const newMonthSummary: MonthlySummary = {
        monthKey,
        totalSales: (currentMonthSummary.totalSales || 0) + grandTotal,
        totalCredit: (currentMonthSummary.totalCredit || 0) + calculatedPayment.credit,
        totalPaid: (currentMonthSummary.totalPaid || 0) + calculatedPayment.paid,
        updatedAt: now.toISOString()
      };
      await setDoc(summaryDocRef, newMonthSummary, { merge: true });
      
      setMonthlySummaries(prev => ({ ...prev, [monthKey]: newMonthSummary }));

      const genInvRef = doc(db, 'users', currentUserEmail, 'inventory_categories', 'general_inventory');
      const docSnap = await getDoc(genInvRef);

      if (docSnap.exists()) {
        const currentData = docSnap.data();
        let productsArray = currentData.products || [];

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

        setInventory(prev => prev.map(invItem => {
          const cartMatch = cartItems.find(c => String(c.id) === String(invItem.id));
          if (cartMatch) {
            return { ...invItem, stock: Math.max(0, invItem.stock - cartMatch.quantity) };
          }
          return invItem;
        }));
      }

      setCustomerBills(prev => [billData, ...prev]);
      setLatestBill(billData);
      setShowBillModal(true);

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

  // Record Filter Logic
  const filteredCustomerBills = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();

    return customerBills.filter(bill => {
      const matchesName = bill.customerName.toLowerCase().includes(customerSearchQuery.toLowerCase());
      const billDate = new Date(bill.date);

      let matchesDate = true;

      if (dateFilterRange === 'today') {
        matchesDate = billDate.toDateString() === todayStr;
      } else if (dateFilterRange === '3days') {
        const diffDays = (now.getTime() - billDate.getTime()) / (1000 * 3600 * 24);
        matchesDate = diffDays <= 3;
      } else if (dateFilterRange === 'week') {
        const diffDays = (now.getTime() - billDate.getTime()) / (1000 * 3600 * 24);
        matchesDate = diffDays <= 7;
      } else if (dateFilterRange === '15days') {
        const diffDays = (now.getTime() - billDate.getTime()) / (1000 * 3600 * 24);
        matchesDate = diffDays <= 15;
      } else if (dateFilterRange === 'month') {
        matchesDate = billDate.getMonth() === now.getMonth() && billDate.getFullYear() === now.getFullYear();
      }

      return matchesName && matchesDate;
    });
  }, [customerBills, customerSearchQuery, dateFilterRange]);

  // Strict Pagination of 5 Records per Page
  const totalCustomerPages = Math.ceil(filteredCustomerBills.length / CUSTOMERS_PER_PAGE) || 1;
  const currentStartRecord = (customerPage - 1) * CUSTOMERS_PER_PAGE;
  const currentEndRecord = Math.min(currentStartRecord + CUSTOMERS_PER_PAGE, filteredCustomerBills.length);

  const paginatedCustomerBills = useMemo(() => {
    return filteredCustomerBills.slice(currentStartRecord, currentStartRecord + CUSTOMERS_PER_PAGE);
  }, [filteredCustomerBills, customerPage, currentStartRecord]);

  useEffect(() => {
    setCustomerPage(1);
  }, [customerSearchQuery, dateFilterRange]);

  // Invoice Generation Logic
  const handleGenerateInvoiceRange = (range: 'today' | '3days' | 'week' | '15days' | 'month') => {
    const now = new Date();
    const todayStr = now.toDateString();

    const selectedBills = customerBills.filter(bill => {
      const billDate = new Date(bill.date);
      if (range === 'today') return billDate.toDateString() === todayStr;
      const diffDays = (now.getTime() - billDate.getTime()) / (1000 * 3600 * 24);
      if (range === '3days') return diffDays <= 3;
      if (range === 'week') return diffDays <= 7;
      if (range === '15days') return diffDays <= 15;
      if (range === 'month') return billDate.getMonth() === now.getMonth() && billDate.getFullYear() === now.getFullYear();
      return true;
    });

    if (selectedBills.length === 0) {
      triggerError("No sales records found for selected period!");
      return;
    }

    let totalGrand = 0;
    let totalPaid = 0;
    let totalCredit = 0;

    selectedBills.forEach(b => {
      totalGrand += b.grandTotal;
      totalPaid += b.paidAmount;
      totalCredit += b.creditAmount;
    });

    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const rangeLabel = {
      today: 'Today Sales Invoice',
      '3days': 'Previous 3 Days Sales Invoice',
      week: 'Full Week Sales Invoice',
      '15days': '15 Days Sales Invoice',
      month: '1 Month Sales Invoice'
    }[range];

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Chaudhary Traders - Sales Invoice Statement</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; margin: 0; }
            .header { text-align: center; border-bottom: 3px solid #f97316; padding-bottom: 20px; margin-bottom: 25px; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #0f172a; }
            .header p { margin: 5px 0 0; color: #ea580c; font-weight: 700; font-size: 14px; }
            .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 15px 20px; display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px; }
            th { background: #f1f5f9; text-align: left; padding: 10px; font-weight: 800; border-bottom: 2px solid #cbd5e1; }
            td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
            .summary { background: #fff7ed; border: 2px solid #fed7aa; border-radius: 16px; padding: 20px; width: 320px; margin-left: auto; font-size: 13px; font-weight: 800; }
            .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
            .summary-row.total { font-size: 15px; border-top: 1px dashed #fdba74; padding-top: 8px; color: #ea580c; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>CHAUDHARY TRADERS</h1>
            <p>Pesticides Stock & Product Sales Statement</p>
          </div>

          <div class="meta-card">
            <div>
              <p><strong>Address:</strong> Chak No 389 Jb Toba Tek Singh Punjab Pakistan</p>
              <p><strong>Phone:</strong> +92 3261770389</p>
              <p><strong>Email:</strong> ${currentUserEmail || 'alitahir243715@gmail.com'}</p>
            </div>
            <div style="text-align: right;">
              <p><strong>Report:</strong> ${rangeLabel}</p>
              <p><strong>Date Generated:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Customer Name</th>
                <th>Date</th>
                <th>Items Sold</th>
                <th>Grand Total</th>
                <th>Paid Amount</th>
                <th>Credit Amount</th>
              </tr>
            </thead>
            <tbody>
              ${selectedBills.map(b => `
                <tr>
                  <td>${b.id}</td>
                  <td><strong>${b.customerName}</strong></td>
                  <td>${new Date(b.date).toLocaleDateString()}</td>
                  <td>${b.items.map(i => `${i.name} (${i.quantity}x)`).join(', ')}</td>
                  <td>Rs. ${b.grandTotal}</td>
                  <td style="color: #10b981;">Rs. ${b.paidAmount}</td>
                  <td style="color: #ef4444;">Rs. ${b.creditAmount}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-row">
              <span>Total Grand Sales:</span>
              <span>Rs. ${totalGrand}</span>
            </div>
            <div class="summary-row" style="color: #10b981;">
              <span>Total Paid Amount:</span>
              <span>Rs. ${totalPaid}</span>
            </div>
            <div class="summary-row" style="color: #ef4444;">
              <span>Total Credit Amount:</span>
              <span>Rs. ${totalCredit}</span>
            </div>
            <div class="summary-row total">
              <span>Net Receivable Credit:</span>
              <span>Rs. ${totalCredit}</span>
            </div>
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
    setShowInvoiceModal(false);
  };

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
          <span>Sale Recorded & Monthly Summaries Saved!</span>
        </div>
      )}

      {/* FIXED TOP HEADER NAVBAR */}
      <header className="w-full bg-white/90 dark:bg-[#070b13]/90 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 sticky top-0 z-40">
        <div className="mx-auto max-w-7xl flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center justify-center h-10 w-10 rounded-full bg-orange-500 text-white shadow-md hover:scale-105 transition-all shrink-0"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.5]" />
            </Link>
            <div className="leading-none">
              <span className="font-black text-base sm:text-lg tracking-tight text-orange-500 block">
                Chaudhary Traders
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDark(!isDark)}
              className="flex h-8 w-14 items-center rounded-full bg-slate-200/80 p-1 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700/50 transition-colors"
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ${isDark ? 'translate-x-6 bg-slate-900 text-yellow-400' : 'text-orange-500'}`}>
                {isDark ? <Moon className="h-3.5 w-3.5 fill-current" /> : <Sun className="h-3.5 w-3.5 fill-current" />}
              </div>
            </button>

            <div className="relative rounded-2xl p-2 text-slate-500 hover:text-orange-500 dark:text-slate-400 transition-all cursor-pointer">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 space-y-6">
        
        {/* MOBILE RESPONSIVE HERO CARD */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50/90 via-white to-orange-50/50 dark:from-[#0c1222] dark:via-[#0e162a] dark:to-[#070b13] p-5 sm:p-7 border-2 border-orange-500/80 shadow-md">
          <div className="flex flex-col gap-5 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider">PREMIUM SELLING TERMINAL</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Selling Products
              </h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                Automated stock deduction, live cart management, cash & credit billing with 60-day auto paid customer cleanup.
              </p>
            </div>

            {/* TOTAL SALES OF THE YEAR STAT CARD - RESPONSIVE FIT */}
            <div className="bg-white/95 dark:bg-[#070b13]/95 backdrop-blur-xl border border-orange-500/40 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm w-full">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
                <Banknote className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block truncate">
                  TOTAL SALES OF THE YEAR
                </span>
                <span className="text-[9px] font-bold text-orange-500 block truncate">
                  (1 JAN TO 31 DEC)
                </span>
                <div className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate">
                  Rs. {totalYearlySales.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT FORM & CART SECTION */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* ADD ITEM INPUT CARD */}
            <div className="bg-white dark:bg-[#0c1222] p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/60 shadow-sm space-y-4">
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-500" />
                <span>1. Enter Details</span>
              </h2>

              <div className="space-y-4">
                {/* Customer Name */}
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

                    {showSuggestions && filteredSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-[#0c1222] border-2 border-orange-500 rounded-2xl shadow-2xl z-50 overflow-hidden">
                        <div className="px-3 py-1.5 bg-orange-500/10 border-b border-orange-500/20 text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Customer Suggestions
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowSuggestions(false)}
                            className="p-0.5 hover:bg-orange-500/20 rounded-md"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredSuggestions.map((name) => {
                            const isCredit = creditCustomerNames.has(name);
                            const isFrequent = frequentCustomerNames.has(name);

                            return (
                              <div
                                key={name}
                                onClick={() => {
                                  setCustomerName(name);
                                  setShowSuggestions(false);
                                }}
                                className="px-4 py-2.5 text-xs font-black text-slate-800 dark:text-slate-100 hover:bg-orange-500 hover:text-white transition-colors cursor-pointer flex items-center justify-between"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>{name}</span>
                                  {isCredit && (
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                      Credit
                                    </span>
                                  )}
                                  {isFrequent && (
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                      3+ Sales
                                    </span>
                                  )}
                                </div>
                                <Check className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                              </div>
                            );
                          })}
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
                      className="w-full appearance-none bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 pr-10 text-xs font-extrabold text-slate-800 dark:text-slate-100 outline-none focus:border-orange-500 cursor-pointer truncate"
                    >
                      <option value="" className="bg-white dark:bg-[#070b13] text-slate-800 dark:text-slate-100">-- Choose Pesticide --</option>
                      {inventory.map((prod) => (
                        <option key={prod.id} value={prod.id} className="bg-white dark:bg-[#070b13] text-slate-800 dark:text-slate-100">
                          {prod.name} (Stock: {prod.stock}) - Rs. {prod.price}
                        </option>
                      ))}
                    </select>
                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Quantity & Price Row */}
                <div className="grid grid-cols-2 gap-3">
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
            <div className="bg-white dark:bg-[#0c1222] p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/60 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-orange-500" />
                  <span>2. Added Products Card</span>
                </h2>
                <span className="text-xs font-black px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  {cartItems.length} Items
                </span>
              </div>

              {cartItems.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-[#070b13] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-400">No products added yet. Select a pesticide and click Add Product.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-50 dark:bg-[#070b13] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">{item.name}</h4>
                        <p className="text-[11px] font-bold text-slate-400">
                          Rs. {item.price} × {item.quantity} = <strong className="text-orange-500">Rs. {item.price * item.quantity}</strong>
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
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

                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => handleUpdateCartItem(item.id, item.quantity, Number(e.target.value))}
                          className="w-20 bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800 rounded-xl py-1 px-2 text-xs font-extrabold outline-none focus:border-orange-500"
                        />

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
            <div className="bg-white dark:bg-[#0c1222] p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/60 shadow-sm space-y-4">
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
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

              {paymentType === 'CREDIT' && (
                <div className="space-y-2 bg-amber-500/10 p-4 rounded-2xl border border-amber-500/30">
                  <label className="text-xs font-black text-amber-700 dark:text-amber-300 block">
                    Paid Amount (Remaining will be logged as Credit)
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

              <button
                onClick={handleSaveBill}
                disabled={isSubmitting || cartItems.length === 0}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg hover:scale-[1.01] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <Save className="h-5 w-5" />
                {isSubmitting ? "Generating Bill & Updating Stock..." : "Save Sale Bill"}
              </button>
            </div>

          </div>

          {/* RIGHT SAVED CUSTOMERS & BILLS HISTORY */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-[#0c1222] p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/60 shadow-sm space-y-4">
              
              <div className="space-y-3">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-orange-500" />
                  <span>Customer Records</span>
                </h2>

                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(true)}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95"
                >
                  <FileText className="h-4 w-4" />
                  <span>Generate Invoice</span>
                </button>
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

                {/* Quick Date Range Selectors */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'today', label: 'Today Only' },
                    { id: '3days', label: '3 Days' },
                    { id: 'week', label: '1 Week' },
                    { id: '15days', label: '15 Days' },
                    { id: 'month', label: 'This Month' },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setDateFilterRange(btn.id as any)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold transition-all border ${
                        dateFilterRange === btn.id
                          ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                          : 'bg-slate-50 dark:bg-[#070b13] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-orange-400'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Cards List */}
              <div className="space-y-3">
                {paginatedCustomerBills.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 dark:bg-[#070b13] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-400">No customer records found for selected filter.</p>
                  </div>
                ) : (
                  paginatedCustomerBills.map((bill) => (
                    <div
                      key={bill.id}
                      className="bg-slate-50/70 dark:bg-[#070b13]/70 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 space-y-2 shadow-sm hover:border-orange-500/50 transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">{bill.customerName}</h4>
                          <span className="text-[10px] font-bold text-slate-400">
                            {new Date(bill.date).toLocaleDateString()}
                          </span>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                          bill.creditAmount > 0 
                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30' 
                            : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                        }`}>
                          {bill.creditAmount > 0 ? `Credit: Rs. ${bill.creditAmount}` : 'Paid Net Cash'}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-slate-600 dark:text-slate-300 space-y-1">
                        {bill.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{it.name} ({it.quantity}x)</span>
                            <span>Rs. {it.total}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between items-center text-xs font-black">
                        <span className="text-slate-900 dark:text-white">Total: Rs. {bill.grandTotal}</span>
                        <button
                          onClick={() => {
                            setLatestBill(bill);
                            setShowBillModal(true);
                          }}
                          className="text-xs font-extrabold text-orange-500 hover:underline"
                        >
                          View Receipt
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* PAGINATION UI */}
              {filteredCustomerBills.length > 0 && (
                <div className="bg-white dark:bg-[#0c1222] rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center gap-2 shadow-sm mt-4">
                  <p className="text-[11px] font-black text-slate-500 dark:text-slate-400">
                    Showing <span className="text-orange-500 font-extrabold">{filteredCustomerBills.length > 0 ? currentStartRecord + 1 : 0}</span> to <span className="text-orange-500 font-extrabold">{currentEndRecord}</span> of <span className="text-slate-900 dark:text-white font-extrabold">{filteredCustomerBills.length}</span> records
                  </p>

                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    <button
                      onClick={() => setCustomerPage(p => Math.max(p - 1, 1))}
                      disabled={customerPage === 1}
                      className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#070b13] text-slate-600 dark:text-slate-300 font-bold text-[11px] hover:bg-orange-500 hover:text-white disabled:opacity-40 transition-all flex items-center gap-0.5"
                    >
                      <ChevronLeft className="h-3 w-3" /> Prev
                    </button>

                    {Array.from({ length: totalCustomerPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setCustomerPage(pageNum)}
                        className={`h-7 w-7 rounded-full font-black text-[11px] transition-all ${
                          customerPage === pageNum
                            ? 'bg-orange-500 text-white shadow-md'
                            : 'bg-slate-100 dark:bg-[#070b13] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}

                    <button
                      onClick={() => setCustomerPage(p => Math.min(p + 1, totalCustomerPages))}
                      disabled={customerPage === totalCustomerPages}
                      className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#070b13] text-slate-600 dark:text-slate-300 font-bold text-[11px] hover:bg-orange-500 hover:text-white disabled:opacity-40 transition-all flex items-center gap-0.5"
                    >
                      Next <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </main>

      {/* INVOICE RANGE SELECTOR MODAL */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500/50 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Printer className="h-4 w-4 text-orange-500" />
                <span>Generate Invoice</span>
              </h3>
              <button onClick={() => setShowInvoiceModal(false)} className="p-1 hover:text-orange-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs font-bold text-slate-500">
              Select time period to generate printable official stock invoice statement:
            </p>

            <div className="space-y-2">
              {[
                { id: 'today', title: 'Today' },
                { id: '3days', title: 'Previous Three Days' },
                { id: 'week', title: 'Full Week' },
                { id: '15days', title: '15 Days' },
                { id: 'month', title: '1 Month' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setInvoiceRange(opt.id as any)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-black border-2 transition-all flex items-center justify-between ${
                    invoiceRange === opt.id
                      ? 'bg-orange-500/10 text-orange-600 border-orange-500'
                      : 'bg-slate-50 dark:bg-[#070b13] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{opt.title}</span>
                  {invoiceRange === opt.id && <Check className="h-4 w-4 text-orange-500" />}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleGenerateInvoiceRange(invoiceRange)}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
            >
              <Printer className="h-4 w-4" /> Generate & Print Invoice
            </button>
          </div>
        </div>
      )}

      {/* SINGLE BILL RECEIPT MODAL */}
      {showBillModal && latestBill && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500/50 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <span className="text-[10px] font-black uppercase text-orange-500 tracking-wider">OFFICIAL INVOICE</span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Pesticides Chaudhary Traders</h3>
              <p className="text-[10px] font-bold text-slate-400">Date: {new Date(latestBill.date).toLocaleString()}</p>
            </div>

            <div className="bg-slate-50 dark:bg-[#070b13] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="text-xs font-black text-slate-800 dark:text-slate-100">
                Customer: <span className="text-orange-500">{latestBill.customerName}</span>
              </div>

              <div className="space-y-1 border-t border-b border-slate-200 dark:border-slate-800 py-2">
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
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg hover:scale-[1.01] transition-all"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}

      {/* FIXED BOTTOM NAVIGATION BAR WITH PERFECT MOBILE LAYOUT */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pt-1 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/90 to-transparent dark:from-[#070b13] dark:via-[#070b13]/90 pointer-events-none">
        <nav className="mx-auto max-w-md bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl px-2 py-1.5 flex items-center justify-around pointer-events-auto">
          {navigationTabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <Link
                key={tab.id}
                to={tab.href}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center justify-center flex-1 py-1 group"
              >
                <div className={`p-2 rounded-full transition-all duration-300 flex items-center justify-center ${
                  isActive 
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/40 scale-105' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}>
                  <IconComponent className="h-4 w-4" />
                </div>
                <span className={`text-[9px] font-black mt-0.5 transition-all truncate max-w-[64px] text-center ${
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
