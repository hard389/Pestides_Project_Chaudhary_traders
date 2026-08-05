import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  PlusCircle,
  Search,
  CreditCard,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Layers,
  UserCheck,
  UserX,
  Calculator,
  Edit2,
  Trash2,
  AlertTriangle
} from 'lucide-react';

// Firebase Imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAmHi20OGNTeUXjuXO_weF8XKEa3KP7oYE",
  authDomain: "tuition-management-b9e2f.firebaseapp.com",
  projectId: "tuition-management-b9e2f",
  storageBucket: "tuition-management-b9e2f.firebasestorage.app",
  messagingSenderId: "634395063857",
  appId: "1:634395063857:web:24d5e9c303845557f1c710",
  measurementId: "G-5SS0BVJWTK"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const USER_ID = "X1Q76ib1XXPWcPp3FSQPLLaTzL83";

interface ExtraFeeCard {
  id: string;
  purpose: string;
  amount: number;
  classId: string;
  className: string;
  createdAt: string;
}

// Safely extracts YYYY-MM from student joining/admission date
const getStudentAdmissionMonth = (student: any): string | null => {
  const rawDate = student?.joiningDate || student?.admissionDate || student?.createdAt || student?.date;
  if (!rawDate) return null;
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  } catch {
    return null;
  }
};

// Class Creation Date strict priority
const getClassCreationMonth = (cls: any): string | null => {
  if (!cls) return null;
  const rawDate = cls.createdAt || cls.createdDate || cls.date || cls.createdMonth;
  
  if (rawDate) {
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
      }
    } catch {}
  }

  const students = cls.students || [];
  let earliestStudentMonth: string | null = null;
  students.forEach((st: any) => {
    const admMonth = getStudentAdmissionMonth(st);
    if (admMonth) {
      if (!earliestStudentMonth || admMonth < earliestStudentMonth) {
        earliestStudentMonth = admMonth;
      }
    }
  });

  return earliestStudentMonth || null;
};

// Formats raw date string into nice readable format
const formatDisplayDate = (rawDate: string): string => {
  if (!rawDate) return 'N/A';
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return rawDate;
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return rawDate;
  }
};

// AUTOMATIC MONTH SYSTEM (Always Current Month & Previous Month)
const getDynamicTwoMonths = () => {
  const now = new Date();
  const currDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const formatMonth = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { label, value: `${y}-${m}` };
  };

  return [formatMonth(currDate), formatMonth(prevDate)];
};

// Extracts students in strict numerical sequence
const extractStudentsFromClass = (classData: any): any[] => {
  if (!classData) return [];
  let rawList: any[] = [];

  if (Array.isArray(classData.students)) {
    rawList = classData.students.map((s, idx) => ({ ...s, _seqKey: s.rollNo || s.roll_no || idx + 1 }));
  } else if (classData.students && typeof classData.students === 'object') {
    const keys = Object.keys(classData.students).sort((a, b) => Number(a) - Number(b));
    rawList = keys.map(k => ({ ...classData.students[k], _seqKey: Number(k) }));
  } else {
    const numericKeys = Object.keys(classData)
      .filter(k => !isNaN(Number(k)))
      .sort((a, b) => Number(a) - Number(b));
    rawList = numericKeys.map(k => ({ ...classData[k], _seqKey: Number(k) }));
  }

  return rawList.sort((a, b) => {
    const rA = Number(a.rollNo || a.roll_no || a.roll || a._seqKey || 0);
    const rB = Number(b.rollNo || b.roll_no || b.roll || b._seqKey || 0);
    return rA - rB;
  });
};

// Calculates prorated daily fee for student's first month
const calculateProratedFee = (student: any, monthlyFee: number) => {
  const rawDate = student?.joiningDate || student?.admissionDate || student?.createdAt || student?.date;
  if (!rawDate) return null;
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return null;

    const totalDaysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const dayOfJoining = d.getDate();
    const daysStudied = Math.max(1, totalDaysInMonth - dayOfJoining + 1);
    
    const dailyRate = Math.round(monthlyFee / totalDaysInMonth);
    const proratedFee = Math.round(daysStudied * (monthlyFee / totalDaysInMonth));

    return {
      joiningDay: dayOfJoining,
      totalDaysInMonth,
      daysStudied,
      dailyRate,
      proratedFee,
      joiningDateFormatted: formatDisplayDate(rawDate)
    };
  } catch {
    return null;
  }
};

export default function ExtraFee() {
  const navigate = useNavigate();

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Deletion Permission Modal State
  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null);

  // Data States
  const [classes, setClasses] = useState<any[]>([]);
  const [extraCards, setExtraCards] = useState<ExtraFeeCard[]>([]);
  
  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<ExtraFeeCard | null>(null);
  
  // Form Inputs
  const [purposeInput, setPurposeInput] = useState('');
  const [feeInput, setFeeInput] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');

  // Selected Card Detail View
  const [selectedCard, setSelectedCard] = useState<ExtraFeeCard | null>(null);
  const [paymentRecords, setPaymentRecords] = useState<Record<string, { paidAmount: number; status: string }>>({});
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'Male' | 'Female'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID' | 'PARTIAL'>('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  // Student Payment Modal State
  const [activeStudent, setActiveStudent] = useState<any | null>(null);
  const [modalPaidInput, setModalPaidInput] = useState<string>('');

  // Helper Trigger Toast Notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Fetch Classes
  useEffect(() => {
    const classesRef = collection(db, 'users', USER_ID, 'classes');
    const unsub = onSnapshot(classesRef, (snapshot) => {
      const fetched = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        students: extractStudentsFromClass(docSnap.data())
      }));

      fetched.sort((a, b) => 
        (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
      );

      setClasses(fetched);
      if (fetched.length > 0 && !selectedClassId) {
        setSelectedClassId(fetched[0].id);
      }
    });
    return () => unsub();
  }, []);

  const activeClassObj = useMemo(() => {
    if (!selectedCard) return null;
    return classes.find(c => c.id === selectedCard.classId) || { students: [] };
  }, [selectedCard, classes]);

  const monthOptions = useMemo(() => {
    const baseMonths = getDynamicTwoMonths();
    const creationMonth = getClassCreationMonth(activeClassObj);

    if (creationMonth) {
      const filtered = baseMonths.filter(m => m.value >= creationMonth);
      return filtered.length > 0 ? filtered : [baseMonths[0]];
    }

    return baseMonths;
  }, [activeClassObj]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => monthOptions[0]?.value || getDynamicTwoMonths()[0].value);

  useEffect(() => {
    if (monthOptions.length > 0) {
      const isValidOption = monthOptions.some(m => m.value === selectedMonth);
      if (!isValidOption) {
        setSelectedMonth(monthOptions[0].value);
      }
    }
  }, [monthOptions, selectedMonth]);

  // 2. Fetch Extra Fee Cards
  useEffect(() => {
    const cardsRef = collection(db, 'users', USER_ID, 'extra_fee_cards');
    const unsub = onSnapshot(cardsRef, (snapshot) => {
      const fetched: ExtraFeeCard[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ExtraFeeCard, 'id'>)
      }));
      fetched.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setExtraCards(fetched);
    });
    return () => unsub();
  }, []);

  // 3. Sync Payment Records
  useEffect(() => {
    if (!selectedCard) {
      setPaymentRecords({});
      return;
    }
    const payDocRef = doc(db, 'users', USER_ID, 'extra_fee_payments', selectedCard.id);
    const unsub = onSnapshot(payDocRef, (snap) => {
      if (snap.exists()) {
        setPaymentRecords(snap.data()?.records || {});
      } else {
        setPaymentRecords({});
      }
    });
    return () => unsub();
  }, [selectedCard]);

  // Open Create Modal
  const openCreateModal = () => {
    setEditingCard(null);
    setPurposeInput('');
    setFeeInput('');
    if (classes.length > 0) setSelectedClassId(classes[0].id);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal with Pre-filled Data
  const openEditModal = (card: ExtraFeeCard, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCard(card);
    setPurposeInput(card.purpose);
    setFeeInput(card.amount.toString());
    setSelectedClassId(card.classId);
    setIsCreateModalOpen(true);
  };

  // Handle Save / Update Card
  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purposeInput || !feeInput || !selectedClassId) return;

    const targetClass = classes.find(c => c.id === selectedClassId);
    const cardData = {
      purpose: purposeInput,
      amount: Number(feeInput),
      classId: selectedClassId,
      className: targetClass?.name || 'Class',
      createdAt: editingCard ? editingCard.createdAt : new Date().toISOString()
    };

    try {
      if (editingCard) {
        // Update Card
        const cardDocRef = doc(db, 'users', USER_ID, 'extra_fee_cards', editingCard.id);
        await updateDoc(cardDocRef, cardData);
        showToast(`Card "${purposeInput}" updated successfully!`);
        if (selectedCard?.id === editingCard.id) {
          setSelectedCard({ ...editingCard, ...cardData });
        }
      } else {
        // Create Card
        const cardsRef = collection(db, 'users', USER_ID, 'extra_fee_cards');
        await addDoc(cardsRef, cardData);
        showToast(`Card "${purposeInput}" created successfully!`);
      }
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error("Error saving card:", err);
    }
  };

  // Prompt Deletion Confirmation
  const promptDeleteCard = (cardId: string, cardName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteModal({ id: cardId, name: cardName });
  };

  // Confirm Delete Card
  const confirmDeleteCard = async () => {
    if (!deleteModal) return;
    try {
      await deleteDoc(doc(db, 'users', USER_ID, 'extra_fee_cards', deleteModal.id));
      if (selectedCard?.id === deleteModal.id) setSelectedCard(null);
      showToast(`"${deleteModal.name}" card deleted successfully! ✨`);
      setDeleteModal(null);
    } catch (err) {
      console.error("Error deleting card:", err);
    }
  };

  const eligibleStudentsForMonth = useMemo(() => {
    if (!activeClassObj) return [];
    const rawStudents = activeClassObj.students || [];
    return rawStudents.filter((student: any) => {
      const admissionMonth = getStudentAdmissionMonth(student);
      if (admissionMonth && selectedMonth < admissionMonth) {
        return false;
      }
      return true;
    });
  }, [activeClassObj, selectedMonth]);

  const cardStats = useMemo(() => {
    if (!selectedCard || !activeClassObj) {
      return { totalCollected: 0, totalPending: 0, paidCount: 0, unpaidCount: 0, partialCount: 0, totalStudents: 0 };
    }

    const students = eligibleStudentsForMonth;
    const targetAmount = selectedCard.amount || 0;

    let totalCollected = 0;
    let totalPending = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let partialCount = 0;

    students.forEach((st: any) => {
      const rec = paymentRecords[st.id] || { paidAmount: 0 };
      const paid = rec.paidAmount || 0;
      totalCollected += paid;

      const remaining = Math.max(0, targetAmount - paid);
      totalPending += remaining;

      if (paid >= targetAmount) {
        paidCount++;
      } else if (paid > 0) {
        partialCount++;
      } else {
        unpaidCount++;
      }
    });

    return {
      totalCollected,
      totalPending,
      paidCount,
      unpaidCount,
      partialCount,
      totalStudents: students.length
    };
  }, [selectedCard, activeClassObj, paymentRecords, eligibleStudentsForMonth]);

  const filteredStudents = useMemo(() => {
    if (!activeClassObj) return [];

    return eligibleStudentsForMonth.filter((st: any) => {
      const matchesSearch = (st.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const studentGender = (st.gender || st.sex || '').toString().toLowerCase();
      let matchesGender = true;
      if (genderFilter === 'Male') matchesGender = studentGender.includes('male') && !studentGender.includes('female');
      if (genderFilter === 'Female') matchesGender = studentGender.includes('female');

      const rec = paymentRecords[st.id] || { paidAmount: 0 };
      const reqAmount = selectedCard?.amount || 0;
      const isPaid = rec.paidAmount >= reqAmount;
      const isPartial = rec.paidAmount > 0 && !isPaid;
      const isUnpaid = rec.paidAmount === 0;

      let matchesStatus = true;
      if (statusFilter === 'PAID') matchesStatus = isPaid;
      if (statusFilter === 'UNPAID') matchesStatus = isUnpaid;
      if (statusFilter === 'PARTIAL') matchesStatus = isPartial;

      return matchesSearch && matchesGender && matchesStatus;
    });
  }, [activeClassObj, eligibleStudentsForMonth, searchQuery, genderFilter, statusFilter, paymentRecords, selectedCard]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, genderFilter, statusFilter, selectedCard, selectedMonth]);

  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredStudents.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredStudents, currentPage]);

  const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE) || 1;

  const openStudentModal = (student: any) => {
    setActiveStudent(student);
    const existing = paymentRecords[student.id];
    const defaultVal = existing ? existing.paidAmount : (selectedCard?.amount || 0);
    setModalPaidInput(defaultVal.toString());
  };

  const handleSavePayment = async () => {
    if (!selectedCard || !activeStudent) return;

    const paidVal = Number(modalPaidInput) || 0;
    const reqAmount = selectedCard.amount;
    const isPaid = paidVal >= reqAmount;

    const newRecord = {
      paidAmount: paidVal,
      status: isPaid ? 'PAID' : (paidVal > 0 ? 'PARTIAL' : 'UNPAID')
    };

    const updatedMap = {
      ...paymentRecords,
      [activeStudent.id]: newRecord
    };

    try {
      const payDocRef = doc(db, 'users', USER_ID, 'extra_fee_payments', selectedCard.id);
      await setDoc(payDocRef, {
        cardId: selectedCard.id,
        records: updatedMap,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setActiveStudent(null);
      showToast(`Payment saved for ${activeStudent.name}!`);
    } catch (err) {
      console.error("Error saving payment:", err);
    }
  };

  const activeModalStudentAdmissionMonth = activeStudent ? getStudentAdmissionMonth(activeStudent) : null;
  const isModalStudentInFirstMonth = activeModalStudentAdmissionMonth === selectedMonth;
  const modalProratedDetails = activeStudent && selectedCard ? calculateProratedFee(activeStudent, selectedCard.amount) : null;

  return (
    <div className="min-h-screen transition-colors duration-300 p-4 sm:p-6 lg:p-8 pb-24 bg-slate-50 dark:bg-black text-slate-800 dark:text-slate-100">
      
      {/* BEAUTIFUL SUCCESS & ACTION TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[100] animate-in slide-in-from-top-5 duration-300">
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_10px_30px_rgba(249,115,22,0.3)] border border-amber-300/40">
            <CheckCircle2 className="h-5 w-5 stroke-[2.5]" />
            <span className="text-xs font-black tracking-wide">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (selectedCard) {
                setSelectedCard(null);
              } else {
                navigate('/fees');
              }
            }}
            className="flex items-center justify-center h-11 w-11 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_4px_15px_rgba(249,115,22,0.3)] hover:scale-105 active:scale-95 transition-all"
            title="Go Back"
          >
            <ArrowLeft className="h-5 w-5 stroke-[3]" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2 text-slate-900 dark:text-white">
              {selectedCard ? selectedCard.purpose : 'Extra Expenditures'}
              <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">
              {selectedCard ? `Class: ${selectedCard.className} • PKR ${selectedCard.amount}` : 'Manage custom charges, trip fees, uniforms or annual funds'}
            </p>
          </div>
        </div>

        {!selectedCard && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs shadow-[0_4px_20px_rgba(249,115,22,0.35)] hover:scale-105 active:scale-95 transition-all ml-auto"
          >
            <PlusCircle className="h-4 w-4" /> Add Extra Charge Card
          </button>
        )}
      </div>

      <div className="max-w-7xl mx-auto space-y-8">

        {/* 1. EXTRA CARDS VIEW */}
        {!selectedCard ? (
          <div>
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4 text-orange-500" /> Active Expenditure Cards
            </h2>

            {extraCards.length === 0 ? (
              <div className="text-center py-16 rounded-3xl border-2 border-dashed border-orange-300 dark:border-orange-500/30 bg-white dark:bg-[#050505] shadow-sm">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Abhi tak koi Extra Charge Card add nahi hua. Click "+ Add Extra Charge Card" to create one.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {extraCards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => setSelectedCard(card)}
                    className="group cursor-pointer relative overflow-hidden rounded-3xl p-6 border transition-all duration-300 hover:scale-[1.02] bg-white dark:bg-[#050505] border-slate-200/80 dark:border-zinc-800 hover:border-orange-500/80 shadow-[0_10px_25px_rgba(0,0,0,0.04)] dark:shadow-[0_0_25px_rgba(0,0,0,0.8)] hover:shadow-[0_15px_30px_rgba(249,115,22,0.12)]"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 border border-orange-200 dark:border-orange-500/30">
                        {card.className}
                      </span>
                      
                      {/* EDIT & DELETE ACTION BUTTONS */}
                      <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => openEditModal(card, e)}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-500/10 hover:bg-orange-500 hover:text-white text-slate-500 dark:text-slate-400 transition-all border border-slate-200 dark:border-slate-700/30"
                          title="Edit Card"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => promptDeleteCard(card.id, card.purpose, e)}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-500/10 hover:bg-rose-500 hover:text-white text-slate-500 dark:text-slate-400 transition-all border border-slate-200 dark:border-slate-700/30"
                          title="Delete Card"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 mb-5">
                      <h3 className="text-lg font-black group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors text-slate-800 dark:text-white">
                        {card.purpose}
                      </h3>
                      <div className="text-2xl font-black text-orange-500">
                        PKR {card.amount.toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 pt-3 border-t border-slate-100 dark:border-zinc-800">
                      <span>Click to Collect Fees</span>
                      <ChevronRight className="h-4 w-4 text-orange-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* 2. CARD SELECTED VIEW */
          <div className="space-y-6 animate-in fade-in duration-300">

            {/* TOP STATS CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="p-5 rounded-3xl border transition-all bg-white dark:bg-[#050505] border-emerald-200 dark:border-emerald-500/30 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 text-xs font-black uppercase tracking-wider mb-2">
                  <Wallet className="h-4 w-4" /> Collected Fee
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  PKR {cardStats.totalCollected.toLocaleString()}
                </div>
              </div>

              <div className="p-5 rounded-3xl border transition-all bg-white dark:bg-[#050505] border-rose-200 dark:border-rose-500/30 shadow-sm">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-500 text-xs font-black uppercase tracking-wider mb-2">
                  <AlertCircle className="h-4 w-4" /> Pending Fee
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
                  PKR {cardStats.totalPending.toLocaleString()}
                </div>
              </div>

              <div className="p-5 rounded-3xl border transition-all bg-white dark:bg-[#050505] border-emerald-200 dark:border-emerald-500/30 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 text-xs font-black uppercase tracking-wider mb-2">
                  <UserCheck className="h-4 w-4" /> Paid Count
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {cardStats.paidCount} / {cardStats.totalStudents}
                </div>
              </div>

              <div className="p-5 rounded-3xl border transition-all bg-white dark:bg-[#050505] border-amber-200 dark:border-amber-500/30 shadow-sm">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 text-xs font-black uppercase tracking-wider mb-2">
                  <UserX className="h-4 w-4" /> Unpaid Count
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                  {cardStats.unpaidCount + cardStats.partialCount}
                </div>
              </div>

            </div>

            {/* FILTERS AND MONTH SELECTOR SECTION */}
            <div className="p-5 rounded-3xl border space-y-4 bg-white dark:bg-[#050505] border-slate-200 dark:border-zinc-800 shadow-sm">
              
              <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
                
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search student by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full border rounded-2xl py-2.5 pl-10 pr-4 text-xs font-bold outline-none transition-colors bg-slate-50 dark:bg-black border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-white focus:border-orange-500"
                  />
                </div>

                {/* BOUNDED MONTH SELECTION DROPDOWN */}
                <div className="relative min-w-[180px]">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full appearance-none rounded-2xl border-2 border-orange-500 px-4 py-2.5 text-xs font-extrabold text-orange-600 dark:text-orange-500 shadow-sm outline-none focus:border-orange-500 cursor-pointer transition-all bg-white dark:bg-black"
                  >
                    {monthOptions.map((m) => (
                      <option key={m.value} value={m.value} className="bg-white dark:bg-black text-slate-800 dark:text-white">
                        🗓️ {m.label}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 h-4 w-4 text-orange-500 pointer-events-none" />
                </div>

                {/* Gender Toggle Pill */}
                <div className="flex items-center p-1 rounded-full border text-xs font-extrabold bg-slate-100 dark:bg-black border-slate-200 dark:border-zinc-800">
                  {(['ALL', 'Male', 'Female'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGenderFilter(g)}
                      className={`px-4 py-2 rounded-full transition-all ${
                        genderFilter === g
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      {g === 'ALL' ? 'All Genders' : g}
                    </button>
                  ))}
                </div>

              </div>

              {/* Status Filter Pill */}
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-2xl border text-xs font-extrabold bg-slate-50 dark:bg-black border-slate-200 dark:border-zinc-800">
                {[
                  { key: 'ALL', label: `All Students (${cardStats.totalStudents})` },
                  { key: 'PAID', label: `Paid (${cardStats.paidCount})` },
                  { key: 'UNPAID', label: `Unpaid (${cardStats.unpaidCount})` },
                  { key: 'PARTIAL', label: `Partial (${cardStats.partialCount})` },
                ].map((st) => (
                  <button
                    key={st.key}
                    onClick={() => setStatusFilter(st.key as any)}
                    className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-center transition-all ${
                      statusFilter === st.key
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm font-black'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

            </div>

            {/* STUDENT CARDS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginatedStudents.length === 0 ? (
                <div className="col-span-full text-center py-16 rounded-3xl border bg-white dark:bg-[#050505] border-slate-200 dark:border-zinc-800">
                  <p className="text-xs font-bold text-slate-400">
                    Koi student matches nahi hua.
                  </p>
                </div>
              ) : (
                paginatedStudents.map((st: any, idx: number) => {
                  const rec = paymentRecords[st.id] || { paidAmount: 0, status: 'UNPAID' };
                  const isPaid = rec.paidAmount >= selectedCard.amount;
                  const isPartial = rec.paidAmount > 0 && !isPaid;

                  const rollNoDisplay = st.rollNo || st.roll_no || st.roll || ((currentPage - 1) * PAGE_SIZE + idx + 1);

                  const studentAdmissionMonth = getStudentAdmissionMonth(st);
                  const isFirstAdmissionMonth = studentAdmissionMonth === selectedMonth;
                  const joiningDateDisplay = st.joiningDate || st.admissionDate || st.createdAt;
                  const prorated = isFirstAdmissionMonth ? calculateProratedFee(st, selectedCard.amount) : null;

                  return (
                    <div
                      key={st.id || idx}
                      className="relative overflow-hidden rounded-3xl p-5 border transition-all duration-300 hover:scale-[1.02] bg-white dark:bg-[#050505] border-slate-200/90 dark:border-zinc-800 hover:border-orange-400/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_0_20px_rgba(0,0,0,0.8)]"
                    >
                      {/* Avatar & Sequence Info */}
                      <div className="flex items-center gap-4 mb-4">
                        <div className="relative">
                          <div className="h-14 w-14 rounded-2xl overflow-hidden bg-orange-50 dark:bg-slate-800 border border-orange-200 dark:border-orange-500/50 flex items-center justify-center font-black text-orange-600 dark:text-orange-500 shadow-inner">
                            {st.photoUrl || st.avatar ? (
                              <img src={st.photoUrl || st.avatar} alt={st.name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-base">{st.name?.slice(0, 2).toUpperCase() || 'ST'}</span>
                            )}
                          </div>
                          <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-orange-500 text-white text-[9px] font-black border border-white dark:border-black shadow">
                            #{rollNoDisplay}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-base font-black text-slate-800 dark:text-white">
                              {st.name || 'Student Name'}
                            </h4>
                            {isFirstAdmissionMonth && joiningDateDisplay && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/40 text-orange-600 dark:text-orange-500 animate-pulse">
                                <Sparkles className="h-3 w-3" />
                                Joined: {formatDisplayDate(joiningDateDisplay)}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-bold block mt-0.5">
                            {st.gender || 'N/A'} | Charge: PKR {selectedCard.amount}
                          </span>
                          {isFirstAdmissionMonth && prorated && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-500 font-extrabold flex items-center gap-1 mt-0.5">
                              <Calculator className="h-3 w-3 text-amber-500" />
                              Prorated: PKR {prorated.proratedFee} ({prorated.daysStudied} days)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dues Pill & Action Button */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
                        <div className={`px-3 py-1.5 rounded-full border text-xs font-black flex items-center gap-1 ${
                          isPaid
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-200 dark:border-emerald-500/30'
                            : isPartial
                            ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-200 dark:border-amber-500/30'
                            : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500 border-rose-200 dark:border-rose-500/30'
                        }`}>
                          <span>DUES: PKR {Math.max(0, selectedCard.amount - rec.paidAmount)}</span>
                        </div>

                        <button
                          onClick={() => openStudentModal(st)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-black hover:scale-105 active:scale-95 transition-all shadow-[0_4px_15px_rgba(249,115,22,0.3)] flex items-center gap-1.5"
                        >
                          <CreditCard className="h-3.5 w-3.5" /> Pay Dues
                        </button>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* PAGINATION CONTROLS */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-3 pt-6">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-2.5 rounded-xl border border-orange-300 dark:border-orange-500/40 text-orange-600 dark:text-orange-500 disabled:opacity-30 disabled:pointer-events-none hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-all bg-white dark:bg-black"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-xs font-black px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-black text-orange-600 dark:text-orange-500 shadow-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-2.5 rounded-xl border border-orange-300 dark:border-orange-500/40 text-orange-600 dark:text-orange-500 disabled:opacity-30 disabled:pointer-events-none hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-all bg-white dark:bg-black"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}

          </div>
        )}

      </div>

      {/* USER PERMISSION DELETION CONFIRMATION MODAL */}
      {deleteModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="border border-rose-200 dark:border-rose-500/80 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative text-center space-y-4 bg-white dark:bg-[#0a0a0a]">
            <div className="h-12 w-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6 stroke-[2.5]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-800 dark:text-white">
                Are you sure?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                Kya aap <strong className="text-rose-600 dark:text-rose-500 font-black">"{deleteModal.name}"</strong> charge card delete karna chahte hain? Yeh action Undo nahi hoga.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 py-3 rounded-2xl text-xs font-black border transition-all border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteCard}
                className="flex-1 py-3 rounded-2xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all"
              >
                Delete Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE & EDIT EXTRA FEE CARD MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="border border-slate-200 dark:border-orange-500 rounded-3xl p-6 w-full max-w-md shadow-2xl relative bg-white dark:bg-[#050505]">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-black flex items-center gap-2 text-slate-800 dark:text-white">
                {editingCard ? <Edit2 className="h-5 w-5 text-orange-500" /> : <PlusCircle className="h-5 w-5 text-orange-500" />}
                {editingCard ? 'Edit Charge Card' : 'Create Extra Fee Card'}
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-rose-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">For What Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. Annual Picnic Fee / Exam Fund"
                  value={purposeInput}
                  onChange={(e) => setPurposeInput(e.target.value)}
                  className="w-full border rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-orange-500 bg-slate-50 dark:bg-black border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Fees Amount (PKR)</label>
                <input
                  type="number"
                  placeholder="e.g. 1500"
                  value={feeInput}
                  onChange={(e) => setFeeInput(e.target.value)}
                  className="w-full border rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-orange-500 bg-slate-50 dark:bg-black border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Select Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full border rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-orange-500 bg-slate-50 dark:bg-black border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-white"
                  required
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black py-3.5 rounded-2xl transition-all shadow-[0_4px_20px_rgba(249,115,22,0.3)] flex justify-center items-center gap-2 text-xs"
              >
                <Save className="h-4 w-4" /> {editingCard ? 'Update Card' : 'Save Card'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT PAYMENT MODAL */}
      {activeStudent && selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="border border-slate-200 dark:border-orange-500 rounded-3xl p-6 w-full max-w-md shadow-2xl relative bg-white dark:bg-[#050505]">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">Collect Payment</h3>
                <p className="text-xs text-orange-600 dark:text-orange-500 font-extrabold">{activeStudent.name}</p>
              </div>
              <button onClick={() => setActiveStudent(null)} className="text-slate-400 hover:text-rose-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              
              {/* FIRST MONTH PRORATED FEE ASSISTANT */}
              {isModalStudentInFirstMonth && modalProratedDetails && (
                <div className="bg-gradient-to-br from-amber-50 dark:from-amber-500/10 to-orange-50 dark:to-transparent border border-amber-200 dark:border-amber-500/40 rounded-2xl p-3.5 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-black text-amber-700 dark:text-amber-500">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-4 w-4" /> 1st Month Joining Fee Assistant
                    </span>
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/30">
                      Joined: {modalProratedDetails.joiningDateFormatted}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold space-y-1">
                    <p>Daily Rate: <strong>PKR {modalProratedDetails.dailyRate}/day</strong> ({selectedCard.amount} ÷ {modalProratedDetails.totalDaysInMonth} Days)</p>
                    <p>Classes Taken: <strong>{modalProratedDetails.daysStudied} Days</strong></p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setModalPaidInput(modalProratedDetails.proratedFee.toString())}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-orange-500 text-white font-black text-[11px] shadow-sm hover:bg-orange-600 transition-all text-center"
                    >
                      Apply Prorated Fee (PKR {modalProratedDetails.proratedFee})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalPaidInput(selectedCard.amount.toString())}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-[11px] hover:bg-slate-300 dark:hover:bg-slate-700 transition-all text-center"
                    >
                      Apply Full Fee (PKR {selectedCard.amount})
                    </button>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-2xl border text-xs font-bold space-y-1 bg-slate-50 dark:bg-black border-slate-200 dark:border-zinc-800">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Purpose:</span> <span className="text-slate-800 dark:text-white">{selectedCard.purpose}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Required Charge:</span> <span className="text-orange-600 dark:text-orange-500">PKR {selectedCard.amount}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Amount Paid (PKR)</label>
                <input
                  type="number"
                  value={modalPaidInput}
                  onChange={(e) => setModalPaidInput(e.target.value)}
                  className="w-full border-2 border-orange-400 dark:border-orange-500/60 rounded-2xl px-4 py-3 text-sm font-black outline-none focus:border-orange-500 bg-white dark:bg-black text-slate-800 dark:text-white"
                />
              </div>

              <button
                onClick={handleSavePayment}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black py-3.5 rounded-2xl transition-all shadow-[0_4px_20px_rgba(249,115,22,0.3)] flex justify-center items-center gap-2 text-xs"
              >
                <Save className="h-4 w-4" /> Save Payment Record
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
