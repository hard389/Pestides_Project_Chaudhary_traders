import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  Sun,
  Moon,
  Bell,
  Home,
  PlusCircle,
  ShoppingCart,
  PieChart,
  DollarSign,
  TrendingUp,
  CreditCard,
  Receipt,
  LogOut,
  Download,
  Calendar,
  X,
  AlertTriangle,
  Info,
  Building2,
  Zap,
  Plus,
  Trash2,
  Package,
  CheckCircle2,
  Scale,
  Edit2,
  Coffee,
  Printer,
  ShieldCheck
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

// Helper to format Date as YYYY-MM
const getCurrentMonthKey = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export default function ExpensesAndProfit() {
  const location = useLocation();
  const navigate = useNavigate();

  // Auth & Theme
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  // Auto-set current month state
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());

  // Firestore Data States
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [inventoryCategories, setInventoryCategories] = useState<any[]>([]);
  const [inventoryCostMap, setInventoryCostMap] = useState<{ [key: string]: number }>({});
  const [monthlyExpenseList, setMonthlyExpenseList] = useState<any[]>([]);

  // Expense Modal Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [shopRent, setShopRent] = useState<string>('');
  const [electricityBill, setElectricityBill] = useState<string>('');
  const [otherExpenses, setOtherExpenses] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Daily Expense Modal (+ Button)
  const [isQuickExpenseOpen, setIsQuickExpenseOpen] = useState(false);
  const [quickAmount, setQuickAmount] = useState<string>('');
  const [quickReason, setQuickReason] = useState<string>('');

  // Print Invoice Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);

  // PWA & Logout States
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Toast States
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Auto Month Auto-Check
  useEffect(() => {
    const interval = setInterval(() => {
      const currentMonthNow = getCurrentMonthKey();
      if (selectedMonth !== currentMonthNow) {
        setSelectedMonth(currentMonthNow);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [selectedMonth]);

  // PWA Listener
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstallable(false);
    setDeferredPrompt(null);
  };

  // Auth Listener
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

  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  // Real-time Notifications Listener
  useEffect(() => {
    if (!currentUserEmail) return;
    const notificationsRef = collection(db, "users", currentUserEmail, "notifications");
    const unsubscribe = onSnapshot(notificationsRef, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      const unread = data.filter((item) => !item.read).length;
      setNotificationCount(unread);
    });
    return () => unsubscribe();
  }, [currentUserEmail]);

  // Fetch Sales & Inventory Categories
  const fetchData = async () => {
    if (!currentUserEmail) return;
    setLoading(true);
    try {
      const salesRef = collection(db, 'users', currentUserEmail, 'sales');
      const salesSnap = await getDocs(salesRef);
      const sales: any[] = [];
      salesSnap.forEach((docSnap) => {
        sales.push({ id: docSnap.id, ...docSnap.data() });
      });
      setSalesData(sales);

      const categoriesRef = collection(db, 'users', currentUserEmail, 'inventory_categories');
      const categoriesSnap = await getDocs(categoriesRef);
      const cats: any[] = [];
      const costMap: { [key: string]: number } = {};

      categoriesSnap.forEach((docSnap) => {
        const catData = docSnap.data();
        cats.push({ id: docSnap.id, ...catData });
        if (Array.isArray(catData.products)) {
          catData.products.forEach((prod: any) => {
            if (prod.name) {
              const cost = Number(prod.costPrice || prod.purchasePrice || 0);
              costMap[prod.name.trim().toLowerCase()] = cost;
            }
          });
        }
      });
      setInventoryCategories(cats);
      setInventoryCostMap(costMap);

    } catch (err) {
      console.error("Error loading data:", err);
      triggerToast("Failed to fetch records from database!", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUserEmail]);

  // Realtime Expense Subcollection Listener for Selected Month
  useEffect(() => {
    if (!currentUserEmail || !selectedMonth) return;

    const expensesRef = collection(db, 'users', currentUserEmail, 'expenses');
    const q = query(expensesRef, where('monthKey', '==', selectedMonth));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setMonthlyExpenseList(list);
    }, (err) => {
      console.error("Expense listener error:", err);
    });

    return () => unsubscribe();
  }, [currentUserEmail, selectedMonth]);

  // Logout Execution
  const handleConfirmLogout = async () => {
    try {
      setIsLoggingOut(true);
      localStorage.clear();
      sessionStorage.clear();
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      triggerToast("Logout Failed", "error");
    } finally {
      setIsLoggingOut(false);
      setShowConfirmModal(false);
    }
  };

  // Helper to extract Date object from records
  const parseRecordDate = (rec: any): Date => {
    if (rec.date) return new Date(rec.date);
    if (rec.createdAt?.seconds) return new Date(rec.createdAt.seconds * 1000);
    if (typeof rec.createdAt === 'string') return new Date(rec.createdAt);
    if (rec.timestamp) return new Date(rec.timestamp);
    return new Date();
  };

  // Check if fixed expenses exist for current selected month
  const existingFixedExpense = useMemo(() => {
    return monthlyExpenseList.find(
      (exp) => (Number(exp.shopRent) > 0 || Number(exp.electricityBill) > 0) && (!exp.note || !exp.note.toLowerCase().includes('quick'))
    ) || monthlyExpenseList[0] || null;
  }, [monthlyExpenseList]);

  // Handle Opening Fixed Expense Modal
  const handleOpenFixedExpenseModal = () => {
    if (existingFixedExpense) {
      setEditingExpenseId(existingFixedExpense.id);
      setShopRent(existingFixedExpense.shopRent ? String(existingFixedExpense.shopRent) : '');
      setElectricityBill(existingFixedExpense.electricityBill ? String(existingFixedExpense.electricityBill) : '');
      setOtherExpenses(existingFixedExpense.otherExpenses ? String(existingFixedExpense.otherExpenses) : '');
      setExpenseNote(existingFixedExpense.note || '');
    } else {
      setEditingExpenseId(null);
      setShopRent('');
      setElectricityBill('');
      setOtherExpenses('');
      setExpenseNote('');
    }
    setIsModalOpen(true);
  };

  // Monthly Metrics Computation
  const metrics = useMemo(() => {
    let totalSales = 0;
    let totalCredit = 0;
    let totalNetCashSales = 0;
    let totalGrossProfit = 0;

    const netPayCustomerList: any[] = [];
    const creditCustomerList: any[] = [];

    salesData.forEach((sale) => {
      const saleDate = parseRecordDate(sale);
      const saleMonthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;

      if (saleMonthKey === selectedMonth) {
        const grandTotal = Number(sale.grandTotal || sale.totalAmount || sale.amount || 0);
        const paidAmount = Number(sale.paidAmount !== undefined ? sale.paidAmount : grandTotal);

        let saleCredit = 0;
        if (sale.creditAmount !== undefined) {
          saleCredit = Number(sale.creditAmount);
        } else if (sale.pendingBalance !== undefined) {
          saleCredit = Number(sale.pendingBalance);
        } else if (String(sale.paymentType).toUpperCase() === 'CREDIT' || sale.isUdhaar) {
          saleCredit = Math.max(0, grandTotal - paidAmount);
        }

        const customer = sale.customerName || sale.clientName || 'Cash Customer';
        const netPaidForThisSale = Math.max(0, grandTotal - saleCredit);

        totalSales += grandTotal;
        totalCredit += saleCredit;
        totalNetCashSales += netPaidForThisSale;

        if (saleCredit > 0) {
          creditCustomerList.push({
            id: sale.id,
            customerName: customer,
            totalAmount: grandTotal,
            creditAmount: saleCredit,
            paidAmount: netPaidForThisSale,
            date: saleDate.toLocaleDateString('en-GB')
          });
        } else {
          netPayCustomerList.push({
            id: sale.id,
            customerName: customer,
            totalAmount: grandTotal,
            paidAmount: grandTotal,
            date: saleDate.toLocaleDateString('en-GB')
          });
        }

        let saleProfit = 0;
        if (Array.isArray(sale.items)) {
          sale.items.forEach((item: any) => {
            const qty = Number(item.quantity || 1);
            const sellPrice = Number(item.price || item.unitPrice || 0);
            const prodKey = String(item.name || '').trim().toLowerCase();
            const lookupCost = inventoryCostMap[prodKey] || 0;
            const costPrice = Number(item.costPrice || item.purchasePrice || lookupCost || 0);

            saleProfit += (sellPrice - costPrice) * qty;
          });
        }
        totalGrossProfit += saleProfit;
      }
    });

    const totalExpenses = monthlyExpenseList.reduce((acc, curr) => {
      const rent = Number(curr.shopRent || 0);
      const elec = Number(curr.electricityBill || 0);
      const other = Number(curr.otherExpenses || 0);
      return acc + rent + elec + other;
    }, 0);

    const netProfit = totalGrossProfit - totalExpenses;

    let addedInventoryValue = 0;
    let addedInventoryItemsCount = 0;
    const monthlyAddedProductsList: any[] = [];

    let totalStockPresentValue = 0;

    inventoryCategories.forEach((cat) => {
      if (Array.isArray(cat.products)) {
        cat.products.forEach((prod: any) => {
          const price = Number(prod.costPrice || prod.salePrice || prod.purchasePrice || 0);
          const qty = Number(prod.quantity || 0);
          totalStockPresentValue += price * qty;

          const prodDate = parseRecordDate(prod);
          const prodMonthKey = `${prodDate.getFullYear()}-${String(prodDate.getMonth() + 1).padStart(2, '0')}`;

          if (prodMonthKey === selectedMonth) {
            addedInventoryValue += price * qty;
            addedInventoryItemsCount += 1;
            monthlyAddedProductsList.push({
              name: prod.name || 'Unnamed Product',
              quantity: qty,
              rate: price,
              total: price * qty
            });
          }
        });
      }
    });

    return {
      totalSales,
      totalCredit,
      totalNetCashSales,
      totalGrossProfit,
      totalExpenses,
      netProfit,
      addedInventoryValue,
      addedInventoryItemsCount,
      totalStockPresentValue,
      monthlyAddedProductsList,
      netPayCustomerList,
      creditCustomerList
    };
  }, [salesData, monthlyExpenseList, inventoryCategories, inventoryCostMap, selectedMonth]);

  // Handle PDF Print Execution
  const handleExecutePrint = () => {
    setShowPrintModal(false);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Open Edit Modal for specific expense entry
  const handleOpenEdit = (exp: any) => {
    setEditingExpenseId(exp.id);
    setShopRent(exp.shopRent ? String(exp.shopRent) : '');
    setElectricityBill(exp.electricityBill ? String(exp.electricityBill) : '');
    setOtherExpenses(exp.otherExpenses ? String(exp.otherExpenses) : '');
    setExpenseNote(exp.note || '');
    setIsModalOpen(true);
  };

  // Reset Modal Form
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpenseId(null);
    setShopRent('');
    setElectricityBill('');
    setOtherExpenses('');
    setExpenseNote('');
  };

  // Save / Update Monthly Expenses
  const handleSaveExpenses = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserEmail) return;

    const rentVal = Number(shopRent) || 0;
    const elecVal = Number(electricityBill) || 0;
    const otherVal = Number(otherExpenses) || 0;

    if (rentVal <= 0 && elecVal <= 0 && otherVal <= 0) {
      triggerToast("Please enter at least one expense amount!", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const expenseData = {
        monthKey: selectedMonth,
        shopRent: rentVal,
        electricityBill: elecVal,
        otherExpenses: otherVal,
        note: expenseNote.trim(),
        updatedAt: new Date().toISOString(),
        timestamp: serverTimestamp()
      };

      if (editingExpenseId) {
        const expDocRef = doc(db, 'users', currentUserEmail, 'expenses', editingExpenseId);
        await updateDoc(expDocRef, expenseData);
        triggerToast("Expense record updated successfully!");
      } else {
        await addDoc(collection(db, 'users', currentUserEmail, 'expenses'), {
          ...expenseData,
          createdAt: new Date().toISOString()
        });
        triggerToast("Expense saved successfully to database!");
      }

      const summaryRef = doc(db, 'users', currentUserEmail, 'monthly_summaries', selectedMonth);
      await setDoc(summaryRef, {
        monthKey: selectedMonth,
        totalSales: metrics.totalSales,
        totalCredit: metrics.totalCredit,
        totalExpenses: metrics.totalExpenses,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      handleCloseModal();
    } catch (err) {
      console.error("Save expense error:", err);
      triggerToast("Failed to save expense", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Expense Add Handler
  const handleSaveQuickExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserEmail) return;

    const amt = Number(quickAmount) || 0;
    if (amt <= 0) {
      triggerToast("Please enter a valid expense amount!", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const newExpense = {
        monthKey: selectedMonth,
        shopRent: 0,
        electricityBill: 0,
        otherExpenses: amt,
        note: quickReason.trim() || 'Cold Drink / Daily Hospitality Expense',
        createdAt: new Date().toISOString(),
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, 'users', currentUserEmail, 'expenses'), newExpense);

      const summaryRef = doc(db, 'users', currentUserEmail, 'monthly_summaries', selectedMonth);
      await setDoc(summaryRef, {
        monthKey: selectedMonth,
        totalSales: metrics.totalSales,
        totalCredit: metrics.totalCredit,
        totalExpenses: metrics.totalExpenses + amt,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      triggerToast(`Quick expense Rs. ${amt} added successfully!`);
      setQuickAmount('');
      setQuickReason('');
      setIsQuickExpenseOpen(false);
    } catch (err) {
      console.error("Quick expense error:", err);
      triggerToast("Failed to save quick expense", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Expense Document
  const handleDeleteExpense = async (id: string) => {
    if (!currentUserEmail) return;
    try {
      await deleteDoc(doc(db, 'users', currentUserEmail, 'expenses', id));
      triggerToast("Expense record removed!");
    } catch (err) {
      triggerToast("Error deleting expense", "error");
    }
  };

  // Donut Chart Segment Calculations
  const chartValues = useMemo(() => {
    const sale = metrics.totalSales || 1;
    const exp = metrics.totalExpenses;
    const credit = metrics.totalCredit;

    const circumference = 314.159;

    const totalMagnitude = Math.max(sale, exp + credit + 1);
    const salePct = Math.min((sale / totalMagnitude) * 100, 100);
    const creditPct = Math.min((credit / totalMagnitude) * 100, 100);
    const expPct = Math.min((exp / totalMagnitude) * 100, 100);

    const saleDash = (salePct / 100) * circumference;
    const creditDash = (creditPct / 100) * circumference;
    const expDash = (expPct / 100) * circumference;

    return {
      circumference,
      saleDash,
      creditDash,
      expDash
    };
  }, [metrics]);

  const navigationTabs = [
    { label: 'Home', icon: Home, href: '/dashboard' },
    { label: 'Add Product', icon: PlusCircle, href: '/departments' },
    { label: 'Sell Product', icon: ShoppingCart, href: '/attendance' },
    { label: 'Analytics', icon: PieChart, href: '/analytics' },
    { label: 'Notification', icon: Bell, href: '/alerts' },
  ];

  const currentDateFormatted = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const currentTimeFormatted = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (
    <div className={`min-h-screen bg-[#f8fafc] dark:bg-[#070b13] text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-36 ${isDark ? 'dark' : ''}`}>

      {/* GLOBAL PRINT CSS RULES FOR PERFECT MULTI-PAGE FLOW */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* PRINT REPORT STATEMENT LAYOUT (SHOWS ONLY ON PDF / PRINT) */}
      <div className="hidden print:block print:w-full print:bg-white print:text-black print:p-0">
        <div className="max-w-4xl mx-auto space-y-4 font-sans">
          
          {/* HEADER SECTION */}
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black uppercase tracking-wider text-slate-900">CHAUDHARY TRADER</h1>
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest">
              Complete Monthly Financial, Sales & Inventory Statement Report
            </p>
            <div className="w-full border-b-2 border-orange-500 my-2"></div>
          </div>

          <div className="border border-slate-300 rounded-xl p-3 flex justify-between text-xs font-bold text-slate-700 bg-slate-50 print-avoid-break">
            <div className="space-y-1">
              <p><span className="font-extrabold text-slate-900">Address:</span> Chak No 389 Jb Toba Tek Singh Punjab Pakistan</p>
              <p><span className="font-extrabold text-slate-900">Phone:</span> +92 3261770389</p>
              <p><span className="font-extrabold text-slate-900">Email:</span> alitahir243715@gmail.com</p>
            </div>
            <div className="space-y-1 text-right">
              <p><span className="font-extrabold text-slate-900">Report Month:</span> {selectedMonth}</p>
              <p><span className="font-extrabold text-slate-900">Print Date:</span> {currentDateFormatted}</p>
              <p><span className="font-extrabold text-slate-900">Print Time:</span> {currentTimeFormatted}</p>
            </div>
          </div>

          {/* 1. MONTHLY SALES BREAKDOWN SECTION */}
          <div className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
              1. MONTHLY SALES STATEMENT ({selectedMonth})
            </h2>

            {/* A. NET PAY (CASH) CUSTOMERS */}
            <div className="space-y-1 print-avoid-break">
              <p className="text-[11px] font-extrabold text-emerald-700 uppercase">
                A. Net Pay / Cash Customers (Paid Complete) - Total: PKR {metrics.totalNetCashSales.toLocaleString()}
              </p>
              <table className="w-full text-left text-[11px] border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 font-extrabold uppercase text-slate-600 border-b border-slate-200">
                    <th className="p-1.5">S.#</th>
                    <th className="p-1.5">Customer Name</th>
                    <th className="p-1.5 text-center">Date</th>
                    <th className="p-1.5 text-right">Paid Total (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {metrics.netPayCustomerList.length > 0 ? (
                    metrics.netPayCustomerList.map((item, idx) => (
                      <tr key={idx} className="font-semibold">
                        <td className="p-1.5">{idx + 1}</td>
                        <td className="p-1.5 font-bold">{item.customerName}</td>
                        <td className="p-1.5 text-center">{item.date}</td>
                        <td className="p-1.5 text-right font-black">PKR {item.totalAmount.toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-2 text-center text-slate-400">No cash sales recorded in this month</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* B. CREDIT (UDHAAR) CUSTOMERS */}
            <div className="space-y-1 pt-1 print-avoid-break">
              <p className="text-[11px] font-extrabold text-rose-700 uppercase">
                B. Credit (Udhaar) Customers Separate - Total Udhaar: PKR {metrics.totalCredit.toLocaleString()}
              </p>
              <table className="w-full text-left text-[11px] border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 font-extrabold uppercase text-slate-600 border-b border-slate-200">
                    <th className="p-1.5">S.#</th>
                    <th className="p-1.5">Customer Name</th>
                    <th className="p-1.5 text-center">Date</th>
                    <th className="p-1.5 text-right">Grand Total</th>
                    <th className="p-1.5 text-right">Credit Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {metrics.creditCustomerList.length > 0 ? (
                    metrics.creditCustomerList.map((item, idx) => (
                      <tr key={idx} className="font-semibold">
                        <td className="p-1.5">{idx + 1}</td>
                        <td className="p-1.5 font-bold">{item.customerName}</td>
                        <td className="p-1.5 text-center">{item.date}</td>
                        <td className="p-1.5 text-right">PKR {item.totalAmount.toLocaleString()}</td>
                        <td className="p-1.5 text-right font-black text-rose-600">PKR {item.creditAmount.toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-2 text-center text-slate-400">No credit sales recorded in this month</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. MONTHLY EXPENSES SECTION */}
          <div className="space-y-1 pt-2 print-avoid-break">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
              2. MONTHLY EXPENSES BREAKDOWN ({selectedMonth})
            </h2>
            <table className="w-full text-left text-[11px] border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 font-extrabold uppercase text-slate-600 border-b border-slate-200">
                  <th className="p-1.5">Expense Entry / Description</th>
                  <th className="p-1.5 text-right">Shop Rent</th>
                  <th className="p-1.5 text-right">Electricity</th>
                  <th className="p-1.5 text-right">Other / Hospitality</th>
                  <th className="p-1.5 text-right">Subtotal (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {monthlyExpenseList.length > 0 ? (
                  monthlyExpenseList.map((exp, idx) => {
                    const rowTotal = (Number(exp.shopRent) || 0) + (Number(exp.electricityBill) || 0) + (Number(exp.otherExpenses) || 0);
                    return (
                      <tr key={idx} className="font-semibold">
                        <td className="p-1.5 font-bold">{exp.note || 'Monthly Fixed Expense Entry'}</td>
                        <td className="p-1.5 text-right">PKR {Number(exp.shopRent || 0).toLocaleString()}</td>
                        <td className="p-1.5 text-right">PKR {Number(exp.electricityBill || 0).toLocaleString()}</td>
                        <td className="p-1.5 text-right">PKR {Number(exp.otherExpenses || 0).toLocaleString()}</td>
                        <td className="p-1.5 text-right font-black">PKR {rowTotal.toLocaleString()}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="p-2 text-center text-slate-400">No expense recorded for this month</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-orange-50 font-black text-slate-900 border-t border-slate-300">
                  <td colSpan={4} className="p-1.5 text-right uppercase">TOTAL MONTHLY EXPENSES:</td>
                  <td className="p-1.5 text-right text-orange-600">PKR {metrics.totalExpenses.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 3. INVENTORY ADDED IN THIS MONTH */}
          <div className="space-y-1 pt-2 print-avoid-break">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
              3. INVENTORY ADDED IN THIS MONTH ({selectedMonth})
            </h2>
            <table className="w-full text-left text-[11px] border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 font-extrabold uppercase text-slate-600 border-b border-slate-200">
                  <th className="p-1.5">S.#</th>
                  <th className="p-1.5">Product Name</th>
                  <th className="p-1.5 text-center">Quantity Added</th>
                  <th className="p-1.5 text-right">Cost Rate (PKR)</th>
                  <th className="p-1.5 text-right">Total Price (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {metrics.monthlyAddedProductsList.length > 0 ? (
                  metrics.monthlyAddedProductsList.map((prod, idx) => (
                    <tr key={idx} className="font-semibold">
                      <td className="p-1.5">{idx + 1}</td>
                      <td className="p-1.5 font-bold">{prod.name}</td>
                      <td className="p-1.5 text-center">{prod.quantity}</td>
                      <td className="p-1.5 text-right">PKR {prod.rate.toLocaleString()}</td>
                      <td className="p-1.5 text-right font-black">PKR {prod.total.toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-2 text-center text-slate-400">
                      No new inventory added into stock for this month
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 4. FINAL FINANCIAL SUMMARY SECTION AT THE BOTTOM */}
          <div className="border-2 border-orange-500 rounded-xl p-3 bg-orange-50/30 space-y-2 mt-4 print-avoid-break">
            <h3 className="text-xs font-black uppercase tracking-wider text-orange-700 border-b border-orange-200 pb-1 text-center">
              FINAL MONTHLY AUDIT & STOCK SUMMARY
            </h3>
            
            <div className="grid grid-cols-2 gap-2 text-xs font-extrabold">
              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span className="text-slate-600">Inventory Added In This Month Price:</span>
                <span className="text-slate-900 font-black">PKR {metrics.addedInventoryValue.toLocaleString()}</span>
              </div>

              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span className="text-slate-600">Total Value Of Stock Present:</span>
                <span className="text-slate-900 font-black">PKR {metrics.totalStockPresentValue.toLocaleString()}</span>
              </div>

              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span className="text-slate-600">Total Month Sales Revenue:</span>
                <span className="text-slate-900 font-black">PKR {metrics.totalSales.toLocaleString()}</span>
              </div>

              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span className="text-slate-600">Gross Profit Of Month:</span>
                <span className="text-emerald-700 font-black">PKR {metrics.totalGrossProfit.toLocaleString()}</span>
              </div>

              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span className="text-slate-600">Expense Of Month:</span>
                <span className="text-orange-600 font-black">PKR {metrics.totalExpenses.toLocaleString()}</span>
              </div>

              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span className="text-slate-600">After Expense Net Profit:</span>
                <span className={`font-black ${metrics.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  PKR {metrics.netProfit.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs print-avoid-break">
            <div className="border border-dashed border-slate-300 rounded-xl p-2 text-center w-52">
              <p className="text-[10px] font-black uppercase text-slate-400">AUTHORIZED OWNER</p>
              <p className="text-xs font-black text-slate-900">Chaudhary Khalil Tahir</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-slate-400">NET MONTH PROFIT</p>
              <p className="text-xl font-black text-emerald-600">PKR {metrics.netProfit.toLocaleString()}</p>
            </div>
          </div>

          <div className="pt-2 text-center text-[10px] text-slate-400 font-medium print-avoid-break">
            This is an official computer-generated monthly statement report for Chaudhary Trader.
          </div>
        </div>
      </div>

      {/* TOAST NOTIFICATION */}
      {showToast && (
        <div className={`print:hidden fixed top-5 left-1/2 -translate-x-1/2 z-[110] text-white font-extrabold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border animate-in fade-in zoom-in-95 ${
          toastType === 'error'
            ? 'bg-rose-600 border-rose-400 shadow-[0_0_30px_rgba(225,19,72,0.5)]'
            : 'bg-emerald-600 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)]'
        }`}>
          {toastType === 'error' ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
          <span>{toastMessage}</span>
          <button onClick={() => setShowToast(false)} className="ml-2 hover:opacity-80">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* PRINT CONFIRMATION MODAL */}
      {showPrintModal && (
        <div className="print:hidden fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-[2.5rem] bg-white dark:bg-[#0c1222] p-6 border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-4 animate-in zoom-in-95">
            <div className="mx-auto h-14 w-14 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/20">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Print Monthly Report?</h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Allow app to generate official <span className="text-orange-500 font-black">Chaudhary Trader</span> monthly sales, expense & stock report.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowPrintModal(false)}
                className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 font-extrabold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleExecutePrint}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Printer className="h-4 w-4" />
                <span>Allow & Print</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="print:hidden fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
      <div className="print:hidden w-full bg-white/70 dark:bg-[#070b13]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/60 sticky top-0 z-40">
        <div className="mx-auto max-w-2xl flex h-16 items-center justify-between px-4">
          <span className="font-black text-xl tracking-tight bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
            Chaudhary Traders
          </span>

          <div className="flex items-center gap-3">
            {isInstallable && (
              <button
                onClick={handleInstallPWA}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5 text-white font-extrabold text-xs shadow-[0_0_15px_rgba(249,115,22,0.4)] hover:scale-105 active:scale-95 transition-all"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}

            <button
              onClick={() => setIsDark(!isDark)}
              className="flex h-8 w-14 items-center rounded-full bg-slate-200/80 p-1 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700/50"
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ${isDark ? 'translate-x-6 bg-slate-900 text-yellow-400' : 'text-orange-500'}`}>
                {isDark ? <Moon className="h-3.5 w-3.5 fill-current" /> : <Sun className="h-3.5 w-3.5 fill-current" />}
              </div>
            </button>

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

            <button
              onClick={() => setShowConfirmModal(true)}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-3 py-1.5 text-white font-bold text-xs hover:bg-red-700 transition-all">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      <main className="print:hidden mx-auto max-w-2xl px-4 py-6 space-y-6">

        {/* PRINT MONTHLY REPORT BUTTON */}
        <div className="flex justify-start">
          <button
            onClick={() => setShowPrintModal(true)}
            className="w-full sm:w-auto px-6 py-3 rounded-full border-2 border-orange-500/80 bg-white dark:bg-[#0c1222] text-orange-500 font-black text-sm flex items-center justify-center gap-2 shadow-md hover:bg-orange-500 hover:text-white transition-all active:scale-95"
          >
            <Printer className="h-5 w-5" />
            <span>Print Monthly Report</span>
          </button>
        </div>

        {/* HERO TITLE CARD & MONTH FILTER */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 dark:from-[#0c1222] dark:via-[#0e162a] dark:to-[#070b13] p-6 border-2 border-orange-500/80 shadow-[0_0_30px_rgba(249,115,22,0.25)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="h-6 w-6 text-orange-500" />
                Expenses & Profit
              </h1>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Monthly Financial Ledger & Net Profit Calculator
              </p>
            </div>

            {/* MONTH FILTER DROPDOWN */}
            <div className="flex items-center gap-2 bg-white dark:bg-[#070b13] border-2 border-orange-500 px-3 py-2 rounded-2xl shadow-sm">
              <Calendar className="h-4 w-4 text-orange-500 shrink-0" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* ADD / EDIT FIXED MONTHLY EXPENSE BUTTON */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleOpenFixedExpenseModal}
              className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:scale-[1.01] active:scale-95 transition-all"
            >
              {existingFixedExpense ? <Edit2 className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
              <span>{existingFixedExpense ? "Edit Fixed Monthly Expense" : "Add Fixed Monthly Expense"}</span>
            </button>

            <button
              onClick={() => {
                setQuickAmount('300');
                setQuickReason('Cold Drink / Tea Hospitality');
                setIsQuickExpenseOpen(true);
              }}
              className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white font-extrabold text-xs shadow-md border border-slate-700/80 hover:scale-[1.01] active:scale-95 transition-all"
            >
              <Plus className="h-5 w-5 text-amber-400" />
              <span>+ Quick Expense (Cold Drink / Tea)</span>
            </button>
          </div>
        </div>

        {/* CIRCULAR GRAPH & SUMMARY SECTION */}
        <div className="bg-white dark:bg-[#0c1222] p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Scale className="h-4 w-4 text-orange-500" />
              GRAPHICAL BREAKDOWN ({selectedMonth})
            </span>
            <span className="text-xs font-extrabold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              Live Breakdown
            </span>
          </div>

          {/* CIRCULAR DONUT GRAPH */}
          <div className="flex flex-col md:flex-row items-center justify-around gap-6 pt-2">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  className="stroke-slate-100 dark:stroke-slate-800"
                  strokeWidth="14"
                  fill="transparent"
                />
                
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="#10b981"
                  strokeWidth="14"
                  strokeDasharray={`${chartValues.saleDash} ${chartValues.circumference}`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />

                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="#f97316"
                  strokeWidth="14"
                  strokeDasharray={`${chartValues.expDash} ${chartValues.circumference}`}
                  strokeDashoffset={`-${chartValues.saleDash}`}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />

                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="#ef4444"
                  strokeWidth="14"
                  strokeDasharray={`${chartValues.creditDash} ${chartValues.circumference}`}
                  strokeDashoffset={`-${chartValues.saleDash + chartValues.expDash}`}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-black uppercase text-slate-400">Net Profit</span>
                <span className={`text-base font-black ${metrics.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  Rs. {metrics.netProfit.toLocaleString()}
                </span>
              </div>
            </div>

            {/* COLOR INDICATOR KEYS */}
            <div className="w-full md:w-1/2 space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">Total Sale (Green)</span>
                </div>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  Rs. {metrics.totalSales.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 rounded-full bg-orange-500"></div>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">Expenses (Orange)</span>
                </div>
                <span className="text-xs font-black text-orange-600 dark:text-orange-400">
                  Rs. {metrics.totalExpenses.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 rounded-full bg-rose-500"></div>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">Total Credit (Red)</span>
                </div>
                <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                  Rs. {metrics.totalCredit.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FINANCIAL METRICS GRID */}
        <div className="space-y-3">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
            MONTHLY STATS OVERVIEW
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* TOTAL MONTH SALE */}
            <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border-2 border-emerald-400/60 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  TOTAL MONTH SALE
                </span>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  Rs. {metrics.totalSales.toLocaleString()}
                </p>
                <p className="text-[10px] font-extrabold text-emerald-500">Gross Sales Revenue</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <DollarSign className="h-6 w-6 stroke-[2.5]" />
              </div>
            </div>

            {/* TOTAL MONTH EXPENSES CARD */}
            <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border-2 border-orange-400/60 shadow-sm flex items-center justify-between group hover:border-orange-500 transition-all">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    TOTAL EXPENSES
                  </span>
                  <button
                    onClick={() => {
                      setQuickAmount('300');
                      setQuickReason('Cold Drink Expense');
                      setIsQuickExpenseOpen(true);
                    }}
                    title="Add Expense (+ Sign)"
                    className="h-5 w-5 rounded-full bg-orange-500 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[3]" />
                  </button>
                </div>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  Rs. {metrics.totalExpenses.toLocaleString()}
                </p>
                <p className="text-[10px] font-extrabold text-orange-500">Includes Shop, Bills & Hospitality</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                <Receipt className="h-6 w-6 stroke-[2.5]" />
              </div>
            </div>

            {/* NET PROFIT */}
            <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border-2 border-indigo-400/60 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  CALCULATED NET PROFIT
                </span>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  Rs. {metrics.netProfit.toLocaleString()}
                </p>
                <p className="text-[10px] font-extrabold text-indigo-500">Gross Profit - Expenses</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 stroke-[2.5]" />
              </div>
            </div>

            {/* TOTAL CREDIT */}
            <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2rem] border-2 border-rose-400/60 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  TOTAL CREDIT (UDHAAR)
                </span>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  Rs. {metrics.totalCredit.toLocaleString()}
                </p>
                <p className="text-[10px] font-extrabold text-rose-500">Uncollected Customer Credit</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <CreditCard className="h-6 w-6 stroke-[2.5]" />
              </div>
            </div>
          </div>
        </div>

        {/* INVENTORY PRICE ADDED IN THIS MONTH */}
        <div className="bg-white dark:bg-[#0c1222] p-5 rounded-[2.5rem] border-2 border-sky-400/60 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Package className="h-4 w-4 text-sky-500" />
              NEW INVENTORY ADDED ({selectedMonth})
            </span>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              Rs. {metrics.addedInventoryValue.toLocaleString()}
            </p>
            <p className="text-[11px] font-extrabold text-sky-500">
              {metrics.addedInventoryItemsCount} New product batches inserted into stock
            </p>
          </div>
          <button
            onClick={() => setShowPrintModal(true)}
            className="h-12 w-12 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
            title="Print Report"
          >
            <Plus className="h-7 w-7 stroke-[2.5]" />
          </button>
        </div>

        {/* RECORDED EXPENSES BREAKDOWN LIST */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              EXPENSE LOGS FOR {selectedMonth} ({monthlyExpenseList.length})
            </span>
            <button
              onClick={() => {
                setQuickAmount('300');
                setQuickReason('Cold Drink Hospitality');
                setIsQuickExpenseOpen(true);
              }}
              className="text-[11px] font-extrabold text-orange-500 hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Cold Drink Expense</span>
            </button>
          </div>

          {monthlyExpenseList.length > 0 ? (
            <div className="space-y-3">
              {monthlyExpenseList.map((exp) => {
                const totalThisEntry = (Number(exp.shopRent) || 0) + (Number(exp.electricityBill) || 0) + (Number(exp.otherExpenses) || 0);
                return (
                  <div
                    key={exp.id}
                    className="bg-white dark:bg-[#0c1222] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-3 hover:border-orange-500/50 transition-all"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-orange-500" />
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                          {exp.monthKey ? `Month Record: ${exp.monthKey}` : 'Expense Details'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(exp)}
                          title="Edit Expense"
                          className="p-1.5 rounded-xl text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 transition-all"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          title="Delete Expense"
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {exp.shopRent > 0 && (
                        <div className="p-2.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between">
                          <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" /> Shop Rent:
                          </span>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                            Rs. {Number(exp.shopRent).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {exp.electricityBill > 0 && (
                        <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Zap className="h-3.5 w-3.5" /> Electricity:
                          </span>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                            Rs. {Number(exp.electricityBill).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {exp.otherExpenses > 0 && (
                        <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
                          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                            <Coffee className="h-3.5 w-3.5" /> Other Exp:
                          </span>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                            Rs. {Number(exp.otherExpenses).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {exp.note && (
                      <p className="text-xs font-extrabold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                        Description: {exp.note}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-black uppercase text-slate-400">Total Entry Amount</span>
                      <span className="text-sm font-black text-rose-500">
                        Rs. {totalThisEntry.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center bg-white dark:bg-[#0c1222] rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 space-y-2">
              <Info className="h-8 w-8 text-amber-500 mx-auto opacity-70" />
              <p className="text-xs font-bold text-slate-400">
                No expense entries saved for {selectedMonth}. Click "+ Quick Expense" or "Add Fixed Expense" above.
              </p>
            </div>
          )}
        </div>

      </main>

      {/* EDIT / ADD FIXED EXPENSES MODAL */}
      {isModalOpen && (
        <div className="print:hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[2.5rem] bg-white dark:bg-[#0c1222] p-6 border-2 border-orange-500/50 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-orange-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {editingExpenseId ? `Edit Monthly Expense (${selectedMonth})` : `Add Monthly Expense (${selectedMonth})`}
                </h3>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpenses} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-orange-500" />
                  Shop Rent (Rupees)
                </label>
                <input
                  type="number"
                  placeholder="Enter shop rent amount"
                  value={shopRent}
                  onChange={(e) => setShopRent(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs font-bold outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Electricity Bills (Rupees)
                </label>
                <input
                  type="number"
                  placeholder="Enter electricity bill amount"
                  value={electricityBill}
                  onChange={(e) => setElectricityBill(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs font-bold outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Coffee className="h-4 w-4 text-indigo-500" />
                  Another / Other Expenses (Rupees)
                </label>
                <input
                  type="number"
                  placeholder="Enter cold drink, tea, transport etc."
                  value={otherExpenses}
                  onChange={(e) => setOtherExpenses(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs font-bold outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Expense Description / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cold drink for customer 300 Rs."
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs font-bold outline-none focus:border-orange-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 font-extrabold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editingExpenseId ? "Update Expense" : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK DAILY / CUSTOMER EXPENSE MODAL */}
      {isQuickExpenseOpen && (
        <div className="print:hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-[2.5rem] bg-white dark:bg-[#0c1222] p-6 border-2 border-amber-500/60 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Coffee className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  + Quick Expense
                </h3>
              </div>
              <button
                onClick={() => setIsQuickExpenseOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickExpense} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Expense Amount (Rs.)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 300"
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-sm font-black text-amber-500 outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Reason / Hospitality Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cold drink ordered for customer"
                  value={quickReason}
                  onChange={(e) => setQuickReason(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs font-bold outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsQuickExpenseOpen(false)}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 font-extrabold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold text-xs shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "Adding..." : "Add Rs. " + (quickAmount || 0)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING BOTTOM NAVIGATION BAR */}
      <div className="print:hidden fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
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
