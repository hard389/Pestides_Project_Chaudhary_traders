import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Folder, BookOpen, FileText, Upload, Share2, Copy, Check, Eye, Download,
  Plus, ArrowLeft, Search, Sun, Moon, Home, GraduationCap, Users, Wallet,
  Sparkles, X, Trash2, Settings, AlertCircle, Pencil, AlertTriangle
} from 'lucide-react';

// --- FIREBASE SETUP ---
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAmHi2OOGNteUXjuX0_weF8XKEa3KP7OYE",
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

// Types
type ResourceCategory = 'All' | 'Notes' | 'Textbooks' | 'Past Papers' | 'Assignments';

interface LibraryResource {
  id: string;
  title: string;
  category: Exclude<ResourceCategory, 'All'>;
  fileType: 'pdf' | 'doc' | 'image' | 'link';
  fileSize?: string;
  fileName?: string;
  fileDataUrl?: string;
  uploadDate: string;
  shareUrl: string;
  contentPreview?: string;
}

interface ClassLibrary {
  id: string;
  className: string;
  classCode: string;
  totalStudents: number;
  bgGradient: string;
  resources: LibraryResource[];
}

// --- BOTTOM NAVBAR COMPONENT ---
function BottomNavbar() {
  const location = useLocation();

  const navigationTabs = [
    { id: 'home', label: 'Home', icon: Home, href: '/' },
    { id: 'classes', label: 'Classes', icon: GraduationCap, href: '/departments' },
    { id: 'attendance', label: 'Attendance', icon: Users, href: '/attendance' },
    { id: 'fees', label: 'Fees', icon: Wallet, href: '/fees' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  ];

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <nav className="pointer-events-auto bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_40px_rgba(0,0,0,0.12)] rounded-full px-5 py-2 flex items-center justify-between gap-6 max-w-md w-full">
        {navigationTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            location.pathname === tab.href ||
            (tab.id === 'fees' && location.pathname.includes('/fees'));

          return (
            <Link
              key={tab.id}
              to={tab.href}
              className="flex flex-col items-center justify-center flex-1 py-1 transition-all group"
            >
              <div
                className={`p-2.5 rounded-full transition-all duration-300 flex items-center justify-center ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-md scale-110'
                    : 'text-slate-400 bg-transparent group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={`text-[10px] font-bold mt-1 transition-colors ${
                  isActive ? 'text-orange-500' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

// --- MAIN PAGE COMPONENT ---
export default function NotesLibraryPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [libraries, setLibraries] = useState<ClassLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewResource, setPreviewResource] = useState<LibraryResource | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Delete, Edit & Toast States
  const [deletingResId, setDeletingResId] = useState<string | null>(null);
  const [editingResource, setEditingResource] = useState<LibraryResource | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<Exclude<ResourceCategory, 'All'>>('Notes');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Upload Form Inputs
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Exclude<ResourceCategory, 'All'>>('Notes');
  const [newDescription, setNewDescription] = useState('');
  const [fileObject, setFileObject] = useState<File | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Auth Listener & Dynamic Data Fetching
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Use user.email (or user.uid) dynamically matching Fee Page logic
        const userIdentifier = user.email || user.uid;
        await fetchClasses(userIdentifier);
      } else {
        setLibraries([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch Data from Firestore dynamically per user
  const fetchClasses = async (userKey: string) => {
    try {
      setLoading(true);
      const classesRef = collection(db, 'users', userKey, 'classes');
      
      const querySnapshot = await getDocs(classesRef);
      const fetchedClasses: ClassLibrary[] = [];
      
      for (const classDoc of querySnapshot.docs) {
        const data = classDoc.data();
        const documentsRef = collection(db, 'users', userKey, 'classes', classDoc.id, 'documents');
        const documentsSnapshot = await getDocs(documentsRef);
        
        const subCollectionDocs = documentsSnapshot.docs.map(doc => {
          const docData = doc.data() as LibraryResource;
          const currentOrigin = window.location.origin;
          return {
            ...docData,
            shareUrl: `${currentOrigin}/notes/share?id=${docData.id}`
          };
        });

        fetchedClasses.push({
          id: classDoc.id,
          className: data.name || data.className || 'Unnamed Class',
          classCode: data.code || data.classCode || 'N/A',
          totalStudents: data.students ? data.students.length : (data.totalStudents || 0),
          bgGradient: data.bgGradient || 'from-blue-500/10 to-indigo-500/10 text-blue-600 border-blue-200',
          resources: [...(data.resources || []), ...subCollectionDocs],
        });
      }

      fetchedClasses.sort((a, b) => a.className.localeCompare(b.className));
      setLibraries(fetchedClasses);
    } catch (error) {
      console.error("Error fetching data: ", error);
    } finally {
      setLoading(false);
    }
  };

  const currentClass = useMemo(() => {
    return libraries.find((cls) => cls.id === selectedClassId) || null;
  }, [libraries, selectedClassId]);

  const filteredResources = useMemo(() => {
    if (!currentClass) return [];
    return currentClass.resources.filter((res) => {
      const matchesCategory = selectedCategory === 'All' || res.category === selectedCategory;
      const matchesSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [currentClass, selectedCategory, searchQuery]);

  const handleCopyLink = (shareUrl: string, id: string) => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedId(id);
    showToast("Share link copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // REAL FILE DOWNLOAD FUNCTION
  const handleDownloadResource = (resource: LibraryResource) => {
    if (resource.fileDataUrl) {
      const link = document.createElement("a");
      link.href = resource.fileDataUrl;
      link.download = resource.fileName || `${resource.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Download started!");
    } else {
      const fileContent = `Document Title: ${resource.title}\nCategory: ${resource.category}\n\nNotes:\n${resource.contentPreview || 'No notes provided.'}`;
      const blob = new Blob([fileContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${resource.title.replace(/\s+/g, '_')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Text file downloaded!");
    }
  };

  // REAL FILE UPLOAD SUBMIT FUNCTION
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !selectedClassId || !currentUser) return;
    setIsUploading(true);

    const convertFileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });
    };

    try {
      let fileDataUrl = '';
      let fileName = '';
      let fileSizeStr = '3.2 MB';

      if (fileObject) {
        fileDataUrl = await convertFileToBase64(fileObject);
        fileName = fileObject.name;
        fileSizeStr = `${(fileObject.size / (1024 * 1024)).toFixed(2)} MB`;
      }

      const newResId = `res-${Date.now()}`;
      const userKey = currentUser.email || currentUser.uid;

      const currentOrigin = window.location.origin;
      const dynamicShareUrl = `${currentOrigin}/notes/share?id=${newResId}`;

      await setDoc(doc(db, 'users', userKey), { active: true }, { merge: true });

      const newResourceItem: LibraryResource = {
        id: newResId,
        title: newTitle,
        category: newCategory,
        fileType: 'pdf',
        fileName: fileName || `${newTitle}.pdf`,
        fileSize: fileSizeStr,
        fileDataUrl: fileDataUrl,
        uploadDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        shareUrl: dynamicShareUrl,
        contentPreview: newDescription || 'Uploaded study material/CV for students.'
      };

      // Save into Sub-collection dynamically
      const docRef = doc(db, 'users', userKey, 'classes', selectedClassId, 'documents', newResId);
      await setDoc(docRef, newResourceItem);

      setLibraries((prev) =>
        prev.map((cls) => {
          if (cls.id === selectedClassId) {
            return {
              ...cls,
              resources: [newResourceItem, ...cls.resources]
            };
          }
          return cls;
        })
      );

      setNewTitle('');
      setNewDescription('');
      setFileObject(null);
      setIsUploadModalOpen(false);
      showToast("Document saved to Database successfully!");
    } catch (error) {
      console.error("Error saving document:", error);
      alert("Failed to save document. File might be too large for Firestore.");
    } finally {
      setIsUploading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (res: LibraryResource) => {
    setEditingResource(res);
    setEditTitle(res.title);
    setEditCategory(res.category);
    setEditDescription(res.contentPreview || '');
  };

  // Save Edit Function
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResource || !selectedClassId || !currentUser) return;
    setIsSavingEdit(true);

    try {
      const userKey = currentUser.email || currentUser.uid;
      const docRef = doc(db, 'users', userKey, 'classes', selectedClassId, 'documents', editingResource.id);
      
      const updatedData = {
        title: editTitle,
        category: editCategory,
        contentPreview: editDescription
      };

      await updateDoc(docRef, updatedData);

      setLibraries((prev) =>
        prev.map((cls) => {
          if (cls.id === selectedClassId) {
            return {
              ...cls,
              resources: cls.resources.map((r) =>
                r.id === editingResource.id ? { ...r, ...updatedData } : r
              )
            };
          }
          return cls;
        })
      );

      setEditingResource(null);
      showToast("Document updated successfully!");
    } catch (error) {
      console.error("Error updating document:", error);
      alert("Could not update document.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete Resource Function
  const confirmDeleteResource = async () => {
    if (!deletingResId || !selectedClassId || !currentUser) return;

    try {
      const userKey = currentUser.email || currentUser.uid;
      const docRef = doc(db, 'users', userKey, 'classes', selectedClassId, 'documents', deletingResId);
      await deleteDoc(docRef);

      setLibraries((prev) =>
        prev.map((cls) => {
          if (cls.id === selectedClassId) {
            return {
              ...cls,
              resources: cls.resources.filter((r) => r.id !== deletingResId)
            };
          }
          return cls;
        })
      );
      showToast("Document deleted successfully!");
    } catch (error) {
      console.error("Error deleting document: ", error);
    } finally {
      setDeletingResId(null);
    }
  };

  return (
    <div className={`min-h-screen bg-[#f8fafc] dark:bg-[#070b13] text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-28 ${isDark ? 'dark' : ''}`}>

      {/* TOAST NOTIFICATION POPUP */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 dark:bg-orange-500/90 text-white border border-orange-500/50 px-4 py-2.5 rounded-2xl shadow-[0_0_20px_rgba(249,115,22,0.4)] backdrop-blur-md flex items-center gap-2 text-xs font-black animate-in fade-in slide-in-from-top-4 duration-300">
          <Sparkles className="h-4 w-4 text-yellow-300 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="w-full bg-white/80 dark:bg-[#070b13]/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedClassId ? (
              <button
                onClick={() => setSelectedClassId(null)}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white transition-all shadow-sm"
                title="Back to All Classes"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={() => navigate('/')}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white transition-all shadow-sm"
                title="Back to Dashboard"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                {selectedClassId ? currentClass?.className : 'Notes & Library'}
              </h1>
              <p className="text-[10px] font-bold text-slate-400">
                {selectedClassId ? `Code: ${currentClass?.classCode}` : 'Select a class to view or upload materials'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedClassId && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="bg-orange-500 text-white hover:bg-orange-600 px-3 py-1.5 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(249,115,22,0.4)] transition-all active:scale-95"
              >
                <Plus className="h-4 w-4" /> Upload
              </button>
            )}

            <button
              onClick={() => setIsDark(!isDark)}
              className="flex h-7 w-12 items-center rounded-full bg-slate-200/60 p-0.5 transition-all dark:bg-slate-800 border border-slate-300/30"
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded-full bg-white text-orange-500 shadow-sm transition-all ${isDark ? 'translate-x-5 bg-slate-950 text-yellow-400' : ''}`}>
                {isDark ? <Moon className="h-3 w-3 fill-current" /> : <Sun className="h-3 w-3 fill-current" />}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5 relative">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-4"></div>
            <p className="text-sm font-bold">Fetching classes from Database...</p>
          </div>
        ) : (
          <>
            {/* SCREEN 1: ALL CLASSES GRID */}
            {!selectedClassId && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                <div className="bg-white dark:bg-[#0c1222] border-[3px] border-orange-500 rounded-3xl p-5 shadow-[0_0_20px_rgba(249,115,22,0.2)] hover:shadow-[0_0_35px_rgba(249,115,22,0.35)] transition-all duration-500 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-orange-500/10 blur-3xl rounded-full animate-pulse pointer-events-none"></div>

                  <div className="relative z-10 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-orange-500" />
                        <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                          Digital Library
                        </h2>
                      </div>
                      <span className="bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse border border-orange-200 dark:border-orange-500/20">
                        Live Engine
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-sm mt-1">
                      Upload PDF notes, CVs, textbooks, & past papers for students and generate instant shareable links.
                    </p>
                  </div>
                  
                  <BookOpen className="absolute -right-6 -bottom-6 h-36 w-36 text-orange-50 dark:text-orange-950/20 group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Your Classes</h3>
                  <span className="text-xs font-black text-orange-500">{libraries.length} Classes Available</span>
                </div>

                {libraries.length === 0 ? (
                  <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                    <p className="text-sm font-bold text-slate-500">No classes found in the database.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {libraries.map((cls, index) => (
                      <div
                        key={cls.id}
                        onClick={() => {
                          setSelectedClassId(cls.id);
                          setSelectedCategory('All');
                        }}
                        style={{ animationDelay: `${index * 50}ms` }}
                        className="bg-white dark:bg-[#0c1222] border rounded-3xl p-4 shadow-sm cursor-pointer transition-all duration-300 group relative overflow-hidden border-slate-200/80 dark:border-slate-800 hover:-translate-y-1 hover:border-orange-500 hover:shadow-[0_0_25px_rgba(249,115,22,0.25)] animate-in fade-in slide-in-from-bottom-2"
                      >
                        <div className="flex items-start justify-between relative z-10">
                          <div className={`p-3 rounded-2xl border transition-colors duration-300 group-hover:bg-orange-500 group-hover:text-white group-hover:border-orange-500 ${cls.bgGradient || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            <Folder className="h-6 w-6" />
                          </div>
                          <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-slate-500 dark:text-slate-400 group-hover:bg-orange-100 dark:group-hover:bg-orange-500/20 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                            {cls.resources?.length || 0} Items
                          </span>
                        </div>

                        <div className="mt-4 space-y-1 relative z-10">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-orange-500 transition-colors">
                            {cls.className}
                          </h4>
                          <p className="text-[11px] font-bold text-slate-400">
                            Code: {cls.classCode} • {cls.totalStudents} Students
                          </p>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-black text-slate-400 group-hover:text-orange-500 transition-colors relative z-10">
                          <span>Open Library</span>
                          <ArrowLeft className="h-3.5 w-3.5 rotate-180 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SCREEN 2: INSIDE SELECTED CLASS LIBRARY */}
            {selectedClassId && currentClass && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search notes, books, or papers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white dark:bg-[#0c1222] text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:border-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.2)] transition-all shadow-sm"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {(['All', 'Notes', 'Textbooks', 'Past Papers', 'Assignments'] as ResourceCategory[]).map((cat) => {
                      const isActive = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3.5 py-1.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all ${
                            isActive
                              ? 'bg-orange-500 text-white shadow-[0_0_12px_rgba(249,115,22,0.4)] scale-105'
                              : 'bg-white dark:bg-[#0c1222] text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:border-orange-500/50 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {filteredResources.length === 0 ? (
                  <div className="bg-white dark:bg-[#0c1222] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 text-center space-y-3 shadow-sm animate-in fade-in zoom-in-95">
                    <div className="h-12 w-12 rounded-full bg-orange-500/10 text-orange-500 mx-auto flex items-center justify-center animate-pulse">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">No Study Material Found</h4>
                      <p className="text-xs text-slate-400 font-medium mt-1">
                        Upload notes or books for this class to get started.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsUploadModalOpen(true)}
                      className="bg-orange-500 text-white px-5 py-2.5 mt-2 rounded-2xl text-xs font-black shadow-[0_0_15px_rgba(249,115,22,0.3)] inline-flex items-center gap-1.5 hover:bg-orange-600 hover:scale-105 transition-all"
                    >
                      <Plus className="h-4 w-4" /> Upload Material
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredResources.map((res, index) => (
                      <div
                        key={res.id}
                        style={{ animationDelay: `${index * 50}ms` }}
                        className="relative bg-white dark:bg-[#0c1222] border-2 border-orange-500/40 dark:border-orange-500/50 rounded-3xl p-4 shadow-[0_0_15px_rgba(249,115,22,0.15)] hover:shadow-[0_0_25px_rgba(249,115,22,0.3)] hover:border-orange-500 transition-all duration-300 space-y-3 group animate-in fade-in slide-in-from-bottom-2"
                      >
                        <div className="flex items-start justify-between gap-2 relative z-10">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-110 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                                {res.category}
                              </span>
                              <h4 className="text-xs font-black mt-1 text-slate-900 dark:text-white group-hover:text-orange-500 transition-colors">
                                {res.title}
                              </h4>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                {res.fileSize} • Uploaded on {res.uploadDate}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(res)}
                              className="text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 p-1.5 rounded-xl transition-colors"
                              title="Edit Document"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeletingResId(res.id)}
                              className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 p-1.5 rounded-xl transition-colors"
                              title="Delete Material"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-[#070b13] p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 relative z-10">
                          <div className="flex items-center gap-2 truncate text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                            <Share2 className="h-3 w-3 text-orange-500 flex-shrink-0" />
                            <span className="truncate">{res.shareUrl}</span>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                              onClick={() => handleCopyLink(res.shareUrl, res.id)}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 transition-all ${
                                copiedId === res.id
                                  ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-orange-500 hover:border-orange-500'
                              }`}
                            >
                              {copiedId === res.id ? (
                                <>
                                  <Check className="h-3 w-3" /> Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" /> Share Link
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => setPreviewResource(res)}
                              className="bg-orange-500 text-white hover:bg-orange-600 px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-md hover:shadow-[0_0_12px_rgba(249,115,22,0.4)] transition-all"
                            >
                              <Eye className="h-3 w-3" /> Preview
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* DELETE CONFIRMATION DIALOG */}
      {deletingResId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-rose-500/50 rounded-3xl max-w-xs w-full p-6 shadow-[0_0_40px_rgba(244,63,94,0.3)] space-y-4 text-center animate-in zoom-in-95">
            <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center border border-rose-500/20 shadow-inner">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Delete Document?</h3>
              <p className="text-xs text-slate-400 font-bold mt-1">
                Are you sure you want to delete this document, mere jaan?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDeletingResId(null)}
                className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-2xl text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteResource}
                className="flex-1 bg-rose-500 text-white py-3 rounded-2xl text-xs font-black hover:bg-rose-600 transition-all shadow-[0_0_15px_rgba(244,63,94,0.4)]"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MATERIAL MODAL */}
      {editingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500/50 rounded-3xl max-w-md w-full p-6 shadow-[0_0_40px_rgba(249,115,22,0.3)] space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil className="h-4 w-4 text-orange-500" /> Edit Document
              </h3>
              <button
                onClick={() => setEditingResource(null)}
                className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-400 block mb-1">
                  Title / Subject Name *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#070b13] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-bold outline-none focus:border-orange-500 transition-all"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-400 block mb-1">
                  Category *
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as Exclude<ResourceCategory, 'All'>)}
                  className="w-full bg-slate-50 dark:bg-[#070b13] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-bold outline-none focus:border-orange-500 transition-all"
                >
                  <option value="Notes">Notes</option>
                  <option value="Textbooks">Textbooks</option>
                  <option value="Past Papers">Past Papers</option>
                  <option value="Assignments">Assignments</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-400 block mb-1">
                  Description / Preview Notes
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#070b13] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-bold outline-none focus:border-orange-500 transition-all resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingResource(null)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-2xl text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || !editTitle}
                  className="flex-1 bg-orange-500 text-white py-3 rounded-2xl text-xs font-black hover:bg-orange-600 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                >
                  {isSavingEdit ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD MATERIAL MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500/50 rounded-3xl max-w-md w-full p-6 shadow-[0_0_40px_rgba(249,115,22,0.3)] space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="h-4 w-4 text-orange-500" /> Upload Study Material / CV
              </h3>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-400 block mb-1">
                  Title / Subject Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Resume / CV"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#070b13] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-bold outline-none focus:border-orange-500 transition-all"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-400 block mb-1">
                  Category *
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as Exclude<ResourceCategory, 'All'>)}
                  className="w-full bg-slate-50 dark:bg-[#070b13] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-bold outline-none focus:border-orange-500 transition-all"
                >
                  <option value="Notes">Notes</option>
                  <option value="Textbooks">Textbooks</option>
                  <option value="Past Papers">Past Papers</option>
                  <option value="Assignments">Assignments</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-400 block mb-1">
                  Attach File (PDF / Doc) *
                </label>
                <div 
                  className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-center hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/5 transition-all bg-slate-50/50 dark:bg-[#070b13]/50 group cursor-pointer relative overflow-hidden"
                >
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      if(e.target.files && e.target.files.length > 0) {
                        setFileObject(e.target.files[0]);
                      }
                    }}
                  />
                  <Upload className="h-6 w-6 text-orange-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-black text-slate-700 dark:text-slate-300">
                    {fileObject ? fileObject.name : 'Select PDF / Document File'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Supports PDF, DOCX, PNG</p>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-400 block mb-1">
                  Description / Quick Notes
                </label>
                <textarea
                  placeholder="Additional notes..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-[#070b13] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-bold outline-none focus:border-orange-500 transition-all resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-2xl text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !newTitle}
                  className="flex-1 bg-orange-500 text-white py-3 rounded-2xl text-xs font-black hover:bg-orange-600 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                >
                  {isUploading ? 'Saving...' : 'Save to Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW & DOWNLOAD MODAL */}
      {previewResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c1222] rounded-3xl max-w-sm w-full shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-in zoom-in-95 border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full mb-0.5 inline-block">
                    STUDENT VIEW • {previewResource.category}
                  </span>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[200px]">
                    {previewResource.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setPreviewResource(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 flex-1 flex flex-col items-center justify-center space-y-4 bg-slate-50 dark:bg-[#070b13]">
              <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2 mb-2">
                <span>PDF Document</span>
                <span>{previewResource.fileSize}</span>
              </div>
              
              <div className="text-sm text-slate-600 dark:text-slate-300 text-center font-medium my-4">
                {previewResource.contentPreview}
              </div>

              <div className="w-full pt-4">
                <button 
                  onClick={() => handleDownloadResource(previewResource)}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all active:scale-95"
                >
                  <Download className="h-4 w-4" />
                  Download Complete File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <BottomNavbar />
    </div>
  );
}
