import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
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
  Home,
  PlusCircle,
  ShoppingCart,
  PieChart,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowLeft,
  UserCheck,
  CreditCard,
  Banknote,
  Receipt,
  User,
  Filter,
  DollarSign,
  History,
  Clock,
  Check,
  Eye,
  Printer,
  FileText,
  Layers
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

const ORDERS_PER_CARD_PAGE = 5;

interface SaleItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface SaleDoc {
  id: string;
  customerName: string;
  date: string;
  items: SaleItem[];
  grandTotal: number;
  paidAmount: number;
  creditAmount: number;
}

interface CustomerGroup {
  customerName: string;
  totalCredit: number;
  totalGrandTotal: number;
  totalPaidAmount: number;
  orders: SaleDoc[];
  allLifetimeOrders: SaleDoc[];
}

export default function CreditCustomers() {
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState('credit-customers');

  // Sales and Credit Data
  const [salesRecords, setSalesRecords] = useState<SaleDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'7' | '15' | '30' | 'all'>('all');

  // UI Toast & Modal States
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Payment Settlement Modal State
  const [selectedCustomerGroup, setSelectedCustomerGroup] = useState<CustomerGroup | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState<number | ''>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Complete Customer History Modal State
  const [historyCustomerGroup, setHistoryCustomerGroup] = useState<CustomerGroup | null>(null);

  // Generate Invoice Printable Modal State
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceTimeframe, setInvoiceTimeframe] = useState<'today' | '3days' | 'week' | '15days' | 'month'>('today');
  // Option: 'credit' (Only Credit), 'paid' (Only Payable / Paid), 'all' (Payable + Credit / All)
  // Default set to 'credit'
  const [invoiceType, setInvoiceType] = useState<'credit' | 'paid' | 'all'>('credit');

  // Per-card pagination state for order lists: { [customerName]: currentPage }
  const [cardPages, setCardPages] = useState<{ [key: string]: number }>({});

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

  // 2. Fetch Sales Data from Firebase Firestore
  const fetchSalesData = async () => {
    if (!currentUserEmail) return;
    setLoading(true);
    try {
      const salesRef = collection(db, 'users', currentUserEmail, 'sales');
      const q = query(salesRef, orderBy('date', 'desc'));
      const querySnap = await getDocs(q);

      const fetchedSales: SaleDoc[] = [];
      querySnap.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedSales.push({
          id: docSnap.id,
          customerName: data.customerName || 'Unknown Customer',
          date: data.date || new Date().toISOString(),
          items: data.items || [],
          grandTotal: Number(data.grandTotal || 0),
          paidAmount: Number(data.paidAmount || 0),
          creditAmount: Number(data.creditAmount || 0),
        });
      });

      setSalesRecords(fetchedSales);
    } catch (err) {
      console.error("Error fetching credit records:", err);
      triggerError("Failed to fetch customer credit records!");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData();
  }, [currentUserEmail]);

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

  // Grouping Sales per Customer & Filtering STRICTLY ONLY CREDIT CUSTOMERS (Exclude Fully Paid)
  // Normalizing customer names (case-insensitive & trimmed) so repeat purchases merge into ONE SINGLE CARD
  const customerGroups = useMemo(() => {
    const groupsMap: { [key: string]: CustomerGroup } = {};
    const now = new Date();

    salesRecords.forEach((sale) => {
      const rawName = sale.customerName ? sale.customerName.trim() : '';
      if (!rawName) return;

      // Case-insensitive key so variations like "Maqoolb" or "maqoolb" merge into the exact same card
      const key = rawName.toLowerCase();

      if (!groupsMap[key]) {
        groupsMap[key] = {
          customerName: rawName, // Preserves nicely formatted name
          totalCredit: 0,
          totalGrandTotal: 0,
          totalPaidAmount: 0,
          orders: [],
          allLifetimeOrders: []
        };
      }

      // Track lifetime records
      groupsMap[key].allLifetimeOrders.push(sale);
      groupsMap[key].totalGrandTotal += sale.grandTotal;
      groupsMap[key].totalPaidAmount += sale.paidAmount;

      // Check date filter for active unpaid debts
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const saleDate = new Date(sale.date);
        const diffDays = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24));
        const maxDays = Number(dateFilter);
        matchesDate = diffDays <= maxDays;
      }

      // Track active credit orders
      if (sale.creditAmount > 0 && matchesDate) {
        groupsMap[key].totalCredit += sale.creditAmount;
        groupsMap[key].orders.push(sale);
      }
    });

    // ONLY FETCH CREDIT CUSTOMERS NOT PAID CUSTOMERS (totalCredit > 0)
    return Object.values(groupsMap).filter(group => {
      const matchesName = group.customerName.toLowerCase().includes(searchQuery.toLowerCase());
      const hasCredit = group.totalCredit > 0;
      return matchesName && hasCredit;
    });
  }, [salesRecords, searchQuery, dateFilter]);

  // Overall Total Outstanding Credit Summary
  const overallTotalCredit = useMemo(() => {
    return customerGroups.reduce((acc, c) => acc + c.totalCredit, 0);
  }, [customerGroups]);

  // Handle Receiving Money (Paying Credit)
  const handleProcessPayment = async () => {
    if (!selectedCustomerGroup) return;
    if (!paymentAmountInput || Number(paymentAmountInput) <= 0) {
      return triggerError("Please enter a valid amount!");
    }
    if (Number(paymentAmountInput) > selectedCustomerGroup.totalCredit) {
      return triggerError(`Payment amount (Rs. ${paymentAmountInput}) cannot exceed total credit balance (Rs. ${selectedCustomerGroup.totalCredit})`);
    }

    if (!currentUserEmail) return;
    setIsSubmittingPayment(true);

    try {
      let remainingToDeduct = Number(paymentAmountInput);
      const sortedOrders = [...selectedCustomerGroup.orders].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      for (const order of sortedOrders) {
        if (remainingToDeduct <= 0) break;

        const currentCredit = order.creditAmount;
        const currentPaid = order.paidAmount;

        const deductionForThisOrder = Math.min(remainingToDeduct, currentCredit);
        const newCredit = currentCredit - deductionForThisOrder;
        const newPaid = currentPaid + deductionForThisOrder;

        remainingToDeduct -= deductionForThisOrder;

        // Update Firestore Document
        const orderRef = doc(db, 'users', currentUserEmail, 'sales', order.id);
        await updateDoc(orderRef, {
          creditAmount: newCredit,
          paidAmount: newPaid
        });
      }

      triggerSuccess(`Successfully received Rs. ${paymentAmountInput} from ${selectedCustomerGroup.customerName}!`);
      setSelectedCustomerGroup(null);
      setPaymentAmountInput('');
      fetchSalesData();
    } catch (err) {
      console.error("Payment update failed:", err);
      triggerError("Failed to update credit record. Try again.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Generate & Print Invoice Statement according to Selected Invoice Type & Timeframe
  const handleGeneratePrintInvoice = () => {
    const now = new Date();
    let maxDays = 0;
    let timeframeLabel = "Sales Invoice";

    if (invoiceTimeframe === 'today') {
      maxDays = 0;
      timeframeLabel = "Today";
    } else if (invoiceTimeframe === '3days') {
      maxDays = 3;
      timeframeLabel = "Previous 3 Days";
    } else if (invoiceTimeframe === 'week') {
      maxDays = 7;
      timeframeLabel = "Full Week";
    } else if (invoiceTimeframe === '15days') {
      maxDays = 15;
      timeframeLabel = "15 Days";
    } else if (invoiceTimeframe === 'month') {
      maxDays = 30;
      timeframeLabel = "1 Month";
    }

    let typeLabel = "Credit Only";
    if (invoiceType === 'paid') typeLabel = "Payable / Paid Only";
    if (invoiceType === 'all') typeLabel = "Payable + Credit (All)";

    const reportTitle = `${timeframeLabel} Sales - ${typeLabel}`;

    // Filter sales by Timeframe & Invoice Type
    const filtered = salesRecords.filter((sale) => {
      const saleDate = new Date(sale.date);
      let matchesTime = false;

      if (invoiceTimeframe === 'today') {
        matchesTime = saleDate.toDateString() === now.toDateString();
      } else {
        const diffTime = now.getTime() - saleDate.getTime();
        const diffDays = diffTime / (1000 * 3600 * 24);
        matchesTime = diffDays >= 0 && diffDays <= maxDays;
      }

      if (!matchesTime) return false;

      if (invoiceType === 'credit') {
        return sale.creditAmount > 0;
      } else if (invoiceType === 'paid') {
        return sale.paidAmount > 0;
      } else { // 'all'
        return true;
      }
    });

    const totalGrand = filtered.reduce((acc, s) => acc + s.grandTotal, 0);
    const totalPaid = filtered.reduce((acc, s) => acc + s.paidAmount, 0);
    const totalCredit = filtered.reduce((acc, s) => acc + s.creditAmount, 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Chaudhary Traders - ${reportTitle}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 40px;
              background: #ffffff;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .company-name {
              font-size: 28px;
              font-weight: 900;
              letter-spacing: 1px;
              color: #0f172a;
              margin: 0;
            }
            .subtitle {
              font-size: 14px;
              font-weight: 700;
              color: #f97316;
              margin-top: 4px;
            }
            .divider {
              height: 3px;
              background: #f97316;
              margin: 15px 0 25px 0;
              border-radius: 2px;
            }
            .meta-box {
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              padding: 16px 24px;
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
              background-color: #f8fafc;
              font-size: 13px;
              line-height: 1.6;
            }
            .meta-box p {
              margin: 2px 0;
            }
            .meta-left { font-weight: 600; }
            .meta-right { text-align: right; font-weight: 600; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
              font-size: 13px;
            }
            th {
              text-align: left;
              padding: 12px 10px;
              border-bottom: 2px solid #cbd5e1;
              font-weight: 800;
              color: #334155;
            }
            td {
              padding: 12px 10px;
              border-bottom: 1px solid #e2e8f0;
              font-weight: 600;
              vertical-align: top;
            }
            .text-green { color: #10b981; }
            .text-red { color: #f43f5e; }
            .summary-card {
              float: right;
              width: 320px;
              border: 1px solid #fed7aa;
              border-radius: 16px;
              padding: 16px 20px;
              background: #fff;
              margin-top: 10px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              font-weight: 700;
              margin-bottom: 8px;
            }
            .dotted-line {
              border-bottom: 1px dashed #cbd5e1;
              margin: 10px 0;
            }
            .summary-row.net {
              font-size: 15px;
              color: #f97316;
              font-weight: 900;
            }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="company-name">CHAUDHARY TRADERS</h1>
            <div class="subtitle">Pesticides Stock & Sales Statement</div>
          </div>
          <div class="divider"></div>

          <div class="meta-box">
            <div class="meta-left">
              <p><strong>Address:</strong> Chak No 389 Jb Toba Tek Singh Punjab Pakistan</p>
              <p><strong>Phone:</strong> +92 3261770389</p>
              <p><strong>Email:</strong> admin@gmail.com</p>
            </div>
            <div class="meta-right">
              <p><strong>Report:</strong> ${reportTitle}</p>
              <p><strong>Type:</strong> ${typeLabel.toUpperCase()}</p>
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
                ${invoiceType !== 'credit' ? '<th>Paid Amount</th>' : ''}
                ${invoiceType !== 'paid' ? '<th>Credit Amount</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `<tr><td colspan="7" style="text-align:center; padding: 20px; color: #94a3b8;">No matching records found for this selection.</td></tr>` : ''}
              ${filtered.map(s => {
                const itemsText = s.items.map(i => `${i.name} (${i.quantity}x)`).join(', ');
                return `
                  <tr>
                    <td>INV-${s.id.slice(-6)}</td>
                    <td><strong>${s.customerName}</strong></td>
                    <td>${new Date(s.date).toLocaleDateString()}</td>
                    <td>${itemsText}</td>
                    <td>Rs. ${s.grandTotal}</td>
                    ${invoiceType !== 'credit' ? `<td class="${s.paidAmount > 0 ? 'text-green' : ''}">Rs. ${s.paidAmount}</td>` : ''}
                    ${invoiceType !== 'paid' ? `<td class="${s.creditAmount > 0 ? 'text-red' : ''}">Rs. ${s.creditAmount}</td>` : ''}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div style="clear: both;"></div>

          <div class="summary-card">
            <div class="summary-row">
              <span>Total Grand Sales:</span>
              <span>Rs. ${totalGrand}</span>
            </div>
            ${invoiceType !== 'credit' ? `
              <div class="summary-row text-green">
                <span>Total Paid Amount:</span>
                <span>Rs. ${totalPaid}</span>
              </div>
            ` : ''}
            ${invoiceType !== 'paid' ? `
              <div class="summary-row text-red">
                <span>Total Credit Amount:</span>
                <span>Rs. ${totalCredit}</span>
              </div>
            ` : ''}
            <div class="dotted-line"></div>
            <div class="summary-row net">
              <span>
                ${invoiceType === 'credit' ? 'Net Credit Outstanding:' : invoiceType === 'paid' ? 'Net Paid Collected:' : 'Net Overall Balance:'}
              </span>
              <span>Rs. ${invoiceType === 'paid' ? totalPaid : totalCredit}</span>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setShowInvoiceModal(false);
  };

  const navigationTabs = [
    { id: 'home', label: 'Home', icon: Home, href: '/' },
    { id: 'add', label: 'Add Product', icon: PlusCircle, href: '/add-product' },
    { id: 'sell', label: 'Sell Product', icon: ShoppingCart, href: '/sell-product' },
    { id: 'credit-customers', label: 'Credit Ledger', icon: CreditCard, href: '/credit-customers' },
    { id: 'analytics', label: 'Analytics', icon: PieChart, href: '/analytics' },
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
              to="/sell-product"
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
        
        {/* HERO BANNER CARD WITH GENERATE INVOICE ACTION */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 dark:from-[#0c1222] dark:via-[#0e162a] dark:to-[#070b13] p-6 md:p-8 border-2 border-orange-500/80 shadow-[0_0_30px_rgba(249,115,22,0.25)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                <CreditCard className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">CREDIT / UDHAAR MANAGER</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                Credit Customers Ledger
              </h1>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Track pending balances, inspect complete buying history & receive payments.
              </p>

              {/* GENERATE INVOICE BUTTON */}
              <div className="pt-2">
                <button
                  onClick={() => setShowInvoiceModal(true)}
                  className="px-6 py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/30 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" /> GENERATE INVOICE
                </button>
              </div>
            </div>

            {/* OVERALL TOTAL STATS BADGE */}
            <div className="bg-white/80 dark:bg-[#070b13]/80 backdrop-blur-md px-6 py-4 rounded-3xl border border-orange-500/30 flex items-center gap-4 shadow-lg">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]">
                <Banknote className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Udhaar Recoverable</span>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  Rs. {overallTotalCredit.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH & PRESET TIME FILTERS BAR */}
        <div className="bg-white dark:bg-[#0c1222] p-4 sm:p-5 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search credit customer by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-xs font-extrabold text-slate-800 dark:text-slate-100 outline-none focus:border-orange-500 transition-all"
            />
          </div>

          {/* Quick Date Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-black text-slate-400 flex items-center gap-1 shrink-0 mr-1">
              <Filter className="h-3.5 w-3.5 text-orange-500" /> Filter:
            </span>

            {[
              { id: '7', label: '1 Week Previous' },
              { id: '15', label: '15 Days Previous' },
              { id: '30', label: '30 Days Previous' },
              { id: 'all', label: 'All Time' }
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setDateFilter(filter.id as any)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all ${
                  dateFilter === filter.id
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20'
                    : 'bg-slate-100 dark:bg-[#070b13] text-slate-600 dark:text-slate-400 hover:text-orange-500 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* CUSTOMERS CREDIT CARDS GRID */}
        {loading ? (
          <div className="text-center py-20 bg-white dark:bg-[#0c1222] rounded-[2.5rem] border border-slate-200 dark:border-slate-800">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
            <p className="mt-3 text-xs font-black text-slate-400">Loading Credit Ledger Records...</p>
          </div>
        ) : customerGroups.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#0c1222] rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
            <UserCheck className="h-12 w-12 text-emerald-500 mx-auto opacity-80" />
            <h3 className="text-base font-black text-slate-700 dark:text-slate-200">No Credit Customers Found</h3>
            <p className="text-xs font-bold text-slate-400 max-w-sm mx-auto">
              {searchQuery || dateFilter !== 'all' 
                ? 'No matching credit customers found for the selected filter.'
                : 'All customers have paid in full! No outstanding udhaar balance.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {customerGroups.map((group) => {
              const currentPage = cardPages[group.customerName] || 1;
              const totalOrders = group.orders.length;
              const totalOrderPages = Math.ceil(totalOrders / ORDERS_PER_CARD_PAGE) || 1;
              
              const startIdx = (currentPage - 1) * ORDERS_PER_CARD_PAGE;
              const paginatedOrders = group.orders.slice(startIdx, startIdx + ORDERS_PER_CARD_PAGE);

              return (
                <div
                  key={group.customerName}
                  className="bg-white dark:bg-[#0c1222] p-6 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/60 shadow-sm hover:border-orange-500/40 transition-all flex flex-col justify-between space-y-5"
                >
                  {/* CARD HEADER */}
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-lg border border-orange-500/30">
                        {group.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">
                          {group.customerName}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-bold text-slate-400">
                            {totalOrders} Unpaid Order{totalOrders > 1 ? 's' : ''}
                          </span>
                          <button
                            onClick={() => setHistoryCustomerGroup(group)}
                            className="inline-flex items-center gap-1 text-[11px] font-black text-orange-500 hover:text-orange-600 underline cursor-pointer"
                          >
                            <Eye className="h-3 w-3" /> View History
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* TOTAL OUTSTANDING CREDIT BOX */}
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 block">
                        Remaining Credit
                      </span>
                      <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                        Rs. {group.totalCredit.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* ORDERS HISTORY ACCORDION / RECEIPT ITEMS LIST */}
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center justify-between text-xs font-black text-slate-400 px-1">
                      <span className="flex items-center gap-1">
                        <History className="h-3.5 w-3.5 text-orange-500" /> Pending Receipts Breakdown
                      </span>
                      <span>Total Unpaid: Rs. {group.orders.reduce((a,b)=>a+b.creditAmount,0).toLocaleString()}</span>
                    </div>

                    <div className="space-y-3">
                      {paginatedOrders.map((order) => (
                        <div
                          key={order.id}
                          className="bg-slate-50 dark:bg-[#070b13] p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 space-y-2.5"
                        >
                          <div className="flex justify-between items-center text-xs font-black">
                            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-orange-500" />
                              {new Date(order.date).toLocaleDateString()} at {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                              Debt: Rs. {order.creditAmount}
                            </span>
                          </div>

                          {/* Items List */}
                          <div className="space-y-1 pl-2 border-l-2 border-orange-500/30">
                            {order.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                                <span>{it.name} <span className="text-orange-500">({it.quantity}x)</span></span>
                                <span>Rs. {it.total}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex justify-between items-center text-[11px] font-black pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-slate-500">
                            <span>Bill Total: Rs. {order.grandTotal}</span>
                            <span>Paid Amount: Rs. {order.paidAmount}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Order Pagination Controls (> 5 items) */}
                    {totalOrderPages > 1 && (
                      <div className="flex items-center justify-between pt-2 px-1 border-t border-slate-100 dark:border-slate-800/60">
                        <button
                          onClick={() => setCardPages(prev => ({ ...prev, [group.customerName]: Math.max(currentPage - 1, 1) }))}
                          disabled={currentPage === 1}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#070b13] text-xs font-black disabled:opacity-40 hover:text-orange-500 transition-all"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" /> Previous
                        </button>

                        <span className="text-[11px] font-black text-slate-400">
                          Orders {currentPage} of {totalOrderPages}
                        </span>

                        <button
                          onClick={() => setCardPages(prev => ({ ...prev, [group.customerName]: Math.min(currentPage + 1, totalOrderPages) }))}
                          disabled={currentPage === totalOrderPages}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#070b13] text-xs font-black disabled:opacity-40 hover:text-orange-500 transition-all"
                        >
                          Next <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => setHistoryCustomerGroup(group)}
                      className="py-3.5 rounded-2xl bg-slate-100 dark:bg-[#070b13] text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800"
                    >
                      <Eye className="h-4 w-4 text-orange-500" /> View History
                    </button>

                    <button
                      onClick={() => {
                        setSelectedCustomerGroup(group);
                        setPaymentAmountInput('');
                      }}
                      className="py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-md hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <DollarSign className="h-4 w-4 stroke-[3]" /> Add Money
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* GENERATE INVOICE MODAL WITH TYPE SELECTION (CREDIT / PAYABLE / ALL) */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500/50 rounded-[2.5rem] p-6 max-w-md w-full shadow-[0_0_50px_rgba(249,115,22,0.3)] space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Printer className="h-6 w-6 text-orange-500" />
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Generate Invoice
                </h3>
              </div>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-[#070b13] hover:text-orange-500 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* SECTION 1: INVOICE TYPE OPTIONS (CREDIT / PAYABLE / ALL) */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-orange-500" /> Select Invoice Type:
              </label>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'credit', label: 'Only Credit' },
                  { id: 'paid', label: 'Only Payable' },
                  { id: 'all', label: 'Payable + Credit' }
                ].map((type) => {
                  const isSelected = invoiceType === type.id;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setInvoiceType(type.id as any)}
                      className={`py-3 px-2 rounded-2xl font-black text-xs text-center border-2 transition-all ${
                        isSelected
                          ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20 scale-[1.02]'
                          : 'bg-slate-50 dark:bg-[#070b13] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 pt-1">
              Select time period to generate printable official stock invoice statement:
            </p>

            {/* SECTION 2: TIMEFRAME SELECTOR OPTIONS */}
            <div className="space-y-2.5">
              {[
                { id: 'today', label: 'Today' },
                { id: '3days', label: 'Previous Three Days' },
                { id: 'week', label: 'Full Week' },
                { id: '15days', label: '15 Days' },
                { id: 'month', label: '1 Month' },
              ].map((option) => {
                const isSelected = invoiceTimeframe === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setInvoiceTimeframe(option.id as any)}
                    className={`w-full py-3.5 px-5 rounded-2xl font-black text-sm text-left flex items-center justify-between border-2 transition-all ${
                      isSelected
                        ? 'bg-orange-500/10 dark:bg-orange-500/20 border-orange-500 text-orange-600 dark:text-orange-400 shadow-md'
                        : 'bg-slate-50 dark:bg-[#070b13] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check className="h-4 w-4 text-orange-500 stroke-[3]" />}
                  </button>
                );
              })}
            </div>

            {/* Generate & Print Action Button */}
            <button
              onClick={handleGeneratePrintInvoice}
              className="w-full py-4 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/30 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.01] active:scale-95"
            >
              <Printer className="h-4 w-4" /> GENERATE & PRINT INVOICE
            </button>
          </div>
        </div>
      )}

      {/* COMPLETE CUSTOMER HISTORY MODAL */}
      {historyCustomerGroup && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500/50 rounded-[2.5rem] p-6 max-w-2xl w-full shadow-[0_0_50px_rgba(249,115,22,0.3)] space-y-5 max-h-[85vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-black">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-orange-500 tracking-wider block">CUSTOMER AUDIT LOG</span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    {historyCustomerGroup.customerName}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setHistoryCustomerGroup(null)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-[#070b13] hover:text-orange-500 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Overall Customer Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-[#070b13] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400">Total Spent</span>
                <p className="text-base font-black text-slate-800 dark:text-slate-100">
                  Rs. {historyCustomerGroup.totalGrandTotal}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-[#070b13] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-1">
                <span className="text-[10px] font-black uppercase text-emerald-500">Total Paid</span>
                <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  Rs. {historyCustomerGroup.totalPaidAmount}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-[#070b13] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-1">
                <span className="text-[10px] font-black uppercase text-rose-500">Pending Debt</span>
                <p className="text-base font-black text-rose-600 dark:text-rose-400">
                  Rs. {historyCustomerGroup.totalCredit}
                </p>
              </div>
            </div>

            {/* Lifetime Sales Timeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <History className="h-4 w-4 text-orange-500" /> Complete Buying History ({historyCustomerGroup.allLifetimeOrders.length} Invoices)
              </h4>

              <div className="space-y-3">
                {historyCustomerGroup.allLifetimeOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-slate-50 dark:bg-[#070b13] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                          Invoice ID: {order.id}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {new Date(order.date).toLocaleString()}
                        </span>
                      </div>

                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                        order.creditAmount > 0
                          ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                      }`}>
                        {order.creditAmount > 0 ? `Unpaid Credit: Rs. ${order.creditAmount}` : 'Fully Paid'}
                      </span>
                    </div>

                    {/* Receipt Items Breakdown */}
                    <div className="bg-white dark:bg-[#0c1222] p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1.5">
                      {order.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                          <span>{it.name} ({it.quantity}x @ Rs. {it.price})</span>
                          <span>Rs. {it.total}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center text-xs font-black pt-1">
                      <span>Grand Total: Rs. {order.grandTotal}</span>
                      <span className="text-emerald-500">Paid Amount: Rs. {order.paidAmount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setHistoryCustomerGroup(null)}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg hover:scale-[1.01] transition-all"
            >
              Close History
            </button>
          </div>
        </div>
      )}

      {/* ADD MONEY / RECEIVE PAYMENT MODAL */}
      {selectedCustomerGroup && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500/50 rounded-[2.5rem] p-6 max-w-md w-full shadow-[0_0_50px_rgba(249,115,22,0.3)] space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-black uppercase text-orange-500 tracking-wider block">RECEIVE PAYMENT</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {selectedCustomerGroup.customerName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCustomerGroup(null)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-[#070b13] hover:text-orange-500 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-[#070b13] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs font-extrabold text-slate-500">
                <span>Total Recoverable Credit:</span>
                <span className="text-rose-500 font-black">Rs. {selectedCustomerGroup.totalCredit}</span>
              </div>
            </div>

            {/* Input payment amount */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Payment Received Amount (Rs.)
              </label>
              <div className="relative">
                <Banknote className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  placeholder="e.g. 1300"
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-sm font-black text-slate-900 dark:text-slate-100 outline-none focus:border-orange-500"
                />
              </div>

              {/* Remaining calculation preview */}
              {paymentAmountInput !== '' && Number(paymentAmountInput) > 0 && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex justify-between text-xs font-black text-emerald-600 dark:text-emerald-400">
                  <span>New Remaining Balance:</span>
                  <span>
                    Rs. {Math.max(0, selectedCustomerGroup.totalCredit - Number(paymentAmountInput))}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedCustomerGroup(null)}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-[#070b13] text-slate-600 dark:text-slate-400 font-black text-xs uppercase tracking-wider rounded-2xl hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessPayment}
                disabled={isSubmittingPayment}
                className="flex-1 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg hover:scale-[1.01] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isSubmittingPayment ? "Updating..." : "Save Payment"}
              </button>
            </div>
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
