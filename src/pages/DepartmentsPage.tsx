import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Plus,
  Package,
  Home,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Edit2,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Camera,
  ShoppingCart,
  PieChart,
  PackagePlus,
  Layers,
  Printer,
  ShieldCheck
} from 'lucide-react';

// Firebase Imports
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  doc, 
  onSnapshot, 
  updateDoc,
  deleteDoc,
  setDoc
} from 'firebase/firestore';

// Data Interfaces
interface Product {
  id: number;
  name: string;
  quantity: string;
  costPrice: string;
  salePrice?: string;
  avatar: string;
  createdAt?: string;
}

interface CategoryItem {
  id: string;
  name: string;
  code: string;
  createdAt?: string;
  products: Product[];
}

interface CenterToast {
  isOpen: boolean;
  type: 'success' | 'delete' | 'print';
  title: string;
  message: string;
}

export default function Inventory() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  
  // Real-time Firestore State
  const [categoryList, setCategoryList] = useState<CategoryItem[]>([]);

  // Active View State (Selected Category ID)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // Category Edit/Delete States
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState<CategoryItem | null>(null);

  // Product Modal States
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<Product | null>(null);

  // Print Permission Modal & Printing State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Center Notification Toast State
  const [toast, setToast] = useState<CenterToast>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  // Category Form Inputs
  const [editCategoryNameInput, setEditCategoryNameInput] = useState('');
  const [editCategoryCodeInput, setEditCategoryCodeInput] = useState('');

  // Product Form Inputs
  const [productName, setProductName] = useState('');
  const [productQuantity, setProductQuantity] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [productAvatar, setProductAvatar] = useState<string>('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Sync active bottom navbar tab based on route / location
  useEffect(() => {
    if (activeCategoryId) {
      setActiveTab('inventory');
      return;
    }

    const path = location.pathname;
    if (path === '/') setActiveTab('home');
    else if (path === '/sell') setActiveTab('sell');
    else if (path === '/analytics') setActiveTab('analytics');
    else if (path === '/alerts') setActiveTab('notification');
    else setActiveTab('inventory');
  }, [location.pathname, activeCategoryId]);

  // Image Upload Handler
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setProductAvatar(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Back Button History Handler
  useEffect(() => {
    const handlePopState = () => {
      if (activeCategoryId) {
        setActiveCategoryId(null);
      } else if (isAddProductOpen || editingCategory || deleteConfirmCategory || deleteConfirmProduct || isPrintModalOpen) {
        setIsAddProductOpen(false);
        setEditingCategory(null);
        setDeleteConfirmCategory(null);
        setDeleteConfirmProduct(null);
        setIsPrintModalOpen(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeCategoryId, isAddProductOpen, editingCategory, deleteConfirmCategory, deleteConfirmProduct, isPrintModalOpen]);

  const handleSelectCategory = (categoryId: string) => {
    window.history.pushState({ categoryId }, '', '#view-category');
    setActiveCategoryId(categoryId);
  };

  const handleBackToCategories = () => {
    if (window.location.hash) {
      window.history.back();
    } else {
      setActiveCategoryId(null);
    }
  };

  // Notification Popup Trigger
  const showCenterNotification = (type: 'success' | 'delete' | 'print', title: string, message: string) => {
    setToast({ isOpen: true, type, title, message });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, isOpen: false }));
    }, 2500);
  };

  // Listen to Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const getUserDocId = (user: User | null): string => {
    if (!user) return 'test_user';
    return user.email ? user.email.toLowerCase().trim() : user.uid;
  };

  // Real-time Firestore Sync
  useEffect(() => {
    if (!currentUser) {
      setCategoryList([]);
      return;
    }

    const userDocId = getUserDocId(currentUser);
    const userCategoriesRef = collection(db, 'users', userDocId, 'inventory_categories');
    
    const unsubscribe = onSnapshot(userCategoriesRef, (snapshot) => {
      const fetchedCategories: CategoryItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        let productsList: Product[] = Array.isArray(data.products) ? data.products : [];
        
        productsList = productsList.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : a.id || 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : b.id || 0;
          return dateB - dateA;
        });

        return {
          id: docSnap.id,
          name: data.name || '',
          code: data.code || '',
          createdAt: data.createdAt,
          products: productsList
        };
      });

      fetchedCategories.sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );

      setCategoryList(fetchedCategories);
    }, (error) => {
      console.error("Firestore Listen Error:", error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const currentCategory = useMemo(() => {
    return categoryList.find((c) => c.id === activeCategoryId) || null;
  }, [categoryList, activeCategoryId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [productSearchQuery, searchQuery, activeCategoryId]);

  // CATEGORIES SEARCH / FILTERING
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categoryList;
    const q = searchQuery.toLowerCase().trim();

    return categoryList
      .filter((c) => {
        const matchesCategory = c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
        const matchesProductName = (c.products || []).some((p) => p.name.toLowerCase().includes(q));
        return matchesCategory || matchesProductName;
      });
  }, [categoryList, searchQuery]);

  // PRODUCTS FILTERING & SORTING
  const sortedAndFilteredProducts = useMemo(() => {
    if (!currentCategory) return [];

    let list = [...(currentCategory.products || [])];

    list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
      return timeB - timeA;
    });

    return list.filter((p) =>
      p.name.toLowerCase().includes(productSearchQuery.toLowerCase())
    );
  }, [currentCategory, productSearchQuery]);

  const totalPages = Math.ceil(sortedAndFilteredProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedAndFilteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedAndFilteredProducts, currentPage]);

  // CATEGORY ACTIONS
  const handleOpenEditCategory = (cls: CategoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCategory(cls);
    setEditCategoryNameInput(cls.name);
    setEditCategoryCodeInput(cls.code);
  };

  const handleSaveEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !currentUser) return;

    try {
      const userDocId = getUserDocId(currentUser);
      const categoryDocRef = doc(db, 'users', userDocId, 'inventory_categories', editingCategory.id);
      await updateDoc(categoryDocRef, {
        name: editCategoryNameInput,
        code: editCategoryCodeInput.toUpperCase()
      });

      setEditingCategory(null);
      showCenterNotification('success', 'Category Updated!', `${editCategoryNameInput} details updated.`);
    } catch (error) {
      console.error("Error updating category:", error);
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deleteConfirmCategory || !currentUser) return;

    try {
      const userDocId = getUserDocId(currentUser);
      const categoryDocRef = doc(db, 'users', userDocId, 'inventory_categories', deleteConfirmCategory.id);
      await deleteDoc(categoryDocRef);
      
      const deletedName = deleteConfirmCategory.name;
      setDeleteConfirmCategory(null);
      showCenterNotification('delete', 'Category Deleted', `${deletedName} category removed.`);
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  // PRODUCT ACTIONS
  const handleOpenAddProduct = (categoryId?: string) => {
    const targetCatId = categoryId || activeCategoryId || categoryList[0]?.id || null;
    if (targetCatId && activeCategoryId !== targetCatId) {
      handleSelectCategory(targetCatId);
    }

    setEditingProduct(null);
    setProductName('');
    setProductQuantity('');
    setCostPrice('');
    setSalePrice('');
    setProductAvatar('');

    setIsAddProductOpen(true);
  };

  const handleOpenEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductName(product.name);
    setProductQuantity(product.quantity);
    setCostPrice(product.costPrice);
    setSalePrice(product.salePrice || '');
    setProductAvatar(product.avatar || '');
    setIsAddProductOpen(true);
  };

  const handleConfirmDeleteProduct = async () => {
    if (!deleteConfirmProduct || !activeCategoryId || !currentCategory || !currentUser) return;

    try {
      const userDocId = getUserDocId(currentUser);
      const categoryDocRef = doc(db, 'users', userDocId, 'inventory_categories', activeCategoryId);
      const updatedProducts = (currentCategory.products || []).filter((p) => p.id !== deleteConfirmProduct.id);
      await updateDoc(categoryDocRef, { products: updatedProducts });
      
      const deletedName = deleteConfirmProduct.name;
      setDeleteConfirmProduct(null);
      showCenterNotification('delete', 'Product Removed', `${deletedName} deleted successfully.`);
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  // SAVE PRODUCT TO FIREBASE
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || !costPrice || !currentUser) return;

    try {
      const userDocId = getUserDocId(currentUser);
      let targetCategoryId = activeCategoryId || categoryList[0]?.id;

      if (!targetCategoryId) {
        targetCategoryId = 'general_inventory';
        const defaultCategoryRef = doc(db, 'users', userDocId, 'inventory_categories', targetCategoryId);
        await setDoc(defaultCategoryRef, {
          name: 'General Inventory',
          code: 'GEN',
          createdAt: new Date().toISOString(),
          products: []
        }, { merge: true });
        setActiveCategoryId(targetCategoryId);
      }

      const categoryDocRef = doc(db, 'users', userDocId, 'inventory_categories', targetCategoryId);
      const targetCategory = categoryList.find(c => c.id === targetCategoryId);
      let updatedProducts = [...(targetCategory?.products || [])];

      const defaultAvatar = 'https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?w=200&auto=format&fit=crop&q=80';
      const isEditMode = !!editingProduct;

      if (editingProduct) {
        updatedProducts = updatedProducts.map((p) =>
          p.id === editingProduct.id
            ? { 
                ...p, 
                name: productName, 
                quantity: productQuantity || '0', 
                costPrice: costPrice,
                salePrice: salePrice || costPrice,
                avatar: productAvatar || p.avatar || defaultAvatar
              }
            : p
        );
      } else {
        const newProductObj: Product = {
          id: Date.now(),
          name: productName,
          quantity: productQuantity || '0',
          costPrice: costPrice,
          salePrice: salePrice || costPrice,
          avatar: productAvatar || defaultAvatar,
          createdAt: new Date().toISOString()
        };
        updatedProducts.unshift(newProductObj);
      }

      await updateDoc(categoryDocRef, { products: updatedProducts });

      setIsAddProductOpen(false);
      setEditingProduct(null);

      showCenterNotification(
        'success',
        isEditMode ? 'Product Updated!' : 'Product Saved!',
        isEditMode ? `${productName} details updated.` : `${productName} added to top of list.`
      );
    } catch (error) {
      console.error("Error saving product to Firebase:", error);
    }
  };

  // PRINT INVOICE FUNCTION
  const handleConfirmAndPrint = () => {
    setIsPrintModalOpen(false);
    showCenterNotification('print', 'Preparing PDF...', 'Generating Chaudhary Trader Stock Invoice.');

    const productsToPrint = currentCategory 
      ? sortedAndFilteredProducts 
      : categoryList.flatMap(c => c.products || []);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalGrandCost = productsToPrint.reduce(
      (sum, p) => sum + Number(p.costPrice || 0) * Number(p.quantity || 0), 0
    );

    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Chaudhary Trader - Stock Inventory Invoice</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { 
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
              color: #1e293b; 
              background: #ffffff; 
              margin: 0; 
              padding: 0; 
            }
            .invoice-card { 
              width: 100%; 
              max-width: 800px; 
              margin: 0 auto; 
              padding: 20px; 
              box-sizing: border-box;
            }
            .header-title { 
              text-align: center; 
              margin-bottom: 25px; 
              border-bottom: 3px solid #f97316;
              padding-bottom: 15px;
            }
            .company-name { 
              font-size: 32px; 
              font-weight: 900; 
              color: #0f172a; 
              letter-spacing: 1px;
              text-transform: uppercase;
              margin: 0;
            }
            .tagline {
              font-size: 13px;
              color: #f97316;
              font-weight: 700;
              margin-top: 4px;
            }
            .details-box {
              display: flex;
              justify-content: space-between;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 15px 20px;
              margin-bottom: 20px;
              font-size: 12px;
            }
            .details-col p { margin: 4px 0; font-weight: 600; color: #475569; }
            .details-col p strong { color: #0f172a; font-weight: 800; }
            
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 15px; 
            }
            th { 
              background-color: #0c1222; 
              color: #ffffff; 
              font-size: 11px; 
              font-weight: 800; 
              text-transform: uppercase; 
              padding: 10px 12px; 
              text-align: left; 
            }
            td { 
              padding: 10px 12px; 
              border-bottom: 1px solid #e2e8f0; 
              font-size: 12px; 
              font-weight: 600; 
              color: #334155;
            }
            tr:nth-child(even) { background-color: #f8fafc; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            
            .summary-container {
              margin-top: 25px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .owner-section {
              border: 1px dashed #cbd5e1;
              padding: 12px 20px;
              border-radius: 10px;
              text-align: center;
              min-width: 220px;
            }
            .owner-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
            .owner-name { font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 4px; }
            
            .total-box {
              background: #0c1222;
              color: #ffffff;
              padding: 12px 20px;
              border-radius: 10px;
              text-align: right;
              min-width: 200px;
            }
            .total-box p { margin: 0; font-size: 11px; text-transform: uppercase; color: #94a3b8; }
            .total-box h2 { margin: 4px 0 0 0; font-size: 20px; color: #f97316; font-weight: 900; }

            .footer-note {
              text-align: center;
              margin-top: 30px;
              font-size: 10px;
              color: #94a3b8;
              border-top: 1px solid #f1f5f9;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="invoice-card">
            
            <div class="header-title">
              <h1 class="company-name">Chaudhary Trader</h1>
              <div class="tagline">Stock Inventory & Product Invoice Statement</div>
            </div>

            <div class="details-box">
              <div class="details-col">
                <p><strong>Address:</strong> Chak No 389 Jb Toba Tek Singh Punjab Pakistan</p>
                <p><strong>Phone:</strong> +92 3261770389</p>
                <p><strong>Email:</strong> alitahir243715@gmail.com</p>
              </div>
              <div class="details-col" style="text-align: right;">
                <p><strong>Date:</strong> ${currentDate}</p>
                <p><strong>Time:</strong> ${currentTime}</p>
                <p><strong>Category:</strong> ${currentCategory ? currentCategory.name : 'All Categories'}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 8%;">S.#</th>
                  <th style="width: 42%;">Product Name</th>
                  <th class="text-center" style="width: 15%;">Quantity</th>
                  <th class="text-right" style="width: 17%;">Rate (PKR)</th>
                  <th class="text-right" style="width: 18%;">Total (PKR)</th>
                </tr>
              </thead>
              <tbody>
                ${productsToPrint.length === 0 ? `
                  <tr>
                    <td colspan="5" class="text-center" style="padding: 20px;">No products available to print.</td>
                  </tr>
                ` : productsToPrint.map((prod, idx) => {
                  const rate = Number(prod.costPrice || 0);
                  const qty = Number(prod.quantity || 0);
                  const itemTotal = rate * qty;
                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><strong>${prod.name}</strong></td>
                      <td class="text-center">${prod.quantity}</td>
                      <td class="text-right">PKR ${rate.toLocaleString()}</td>
                      <td class="text-right">PKR ${itemTotal.toLocaleString()}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div class="summary-container">
              <div class="owner-section">
                <div class="owner-title">Authorized Owner</div>
                <div class="owner-name">Chaudhary Khalil Tahir </div>
              </div>

              <div class="total-box">
                <p>Grand Total Stock Value</p>
                <h2>PKR ${totalGrandCost.toLocaleString()}</h2>
              </div>
            </div>

            <div class="footer-note">
              This is an official computer-generated stock inventory invoice statement for Chaudhary Trader.
            </div>

          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 800);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const navigationTabs = [
    { id: 'home', label: 'Home', icon: Home, href: '/' },
    { id: 'add_product', label: 'Add Product', icon: PackagePlus, action: () => handleOpenAddProduct() },
    { id: 'sell', label: 'Sell Product', icon: ShoppingCart, href: '/sell' },
    { id: 'analytics', label: 'Analytics', icon: PieChart, href: '/analytics' },
    { id: 'notification', label: 'Notification', icon: Bell, href: '/alerts' },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#070b13]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.6)]" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#f8fafc] dark:bg-[#070b13] text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-28 ${isDark ? 'dark' : ''}`}>

      {/* TOP NAVBAR */}
      <div className="w-full bg-white/60 dark:bg-[#070b13]/60 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/80 sticky top-0 z-40 shadow-sm transition-all">
        <div className="mx-auto max-w-7xl flex h-14 items-center justify-between px-3 sm:px-6 lg:px-8 gap-2">
          
          <div className="flex items-center gap-2 flex-1">
            <button
              onClick={() => {
                if (activeCategoryId) {
                  handleBackToCategories();
                } else {
                  navigate('/');
                }
              }}
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-orange-500/10 hover:bg-orange-500 text-orange-600 dark:text-orange-400 hover:text-white transition-all shadow-[0_0_12px_rgba(249,115,22,0.25)] hover:shadow-[0_0_20px_rgba(249,115,22,0.5)] active:scale-95 shrink-0"
              title="Go Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            {/* SEARCH INPUT */}
            <div className="relative w-full max-w-[200px] sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={activeCategoryId ? "Search in products..." : "Search product name..."}
                value={activeCategoryId ? productSearchQuery : searchQuery}
                onChange={(e) => activeCategoryId ? setProductSearchQuery(e.target.value) : setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-[#0c1222]/80 py-1.5 pl-9 pr-3 text-xs font-bold outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:focus:ring-orange-500/30 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* PRINT INVENTORY BUTTON */}
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs shadow-[0_0_15px_rgba(249,115,22,0.35)] hover:shadow-[0_0_25px_rgba(249,115,22,0.55)] transition-all active:scale-95 shrink-0"
              title="Print Stock Inventory Invoice"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Print Stock</span>
            </button>

            <button
              onClick={() => setIsDark(!isDark)}
              className="flex h-7 w-12 items-center rounded-full bg-slate-200/80 p-0.5 transition-all dark:bg-slate-800 border border-slate-300/40 dark:border-slate-700/50 hover:shadow-[0_0_12px_rgba(249,115,22,0.2)]"
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded-full bg-white text-orange-500 shadow-md transition-all ${isDark ? 'translate-x-5 bg-slate-950 text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : ''}`}>
                {isDark ? <Moon className="h-3 w-3 fill-current" /> : <Sun className="h-3 w-3 fill-current" />}
              </div>
            </button>

            <Link
              to="/alerts"
              className="relative rounded-xl p-2 text-slate-500 hover:bg-orange-500/10 dark:text-slate-400 dark:hover:bg-[#0c1222] transition-all hover:shadow-[0_0_15px_rgba(249,115,22,0.3)] active:scale-95 flex items-center justify-center"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#070b13] animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]">
                2
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

        {/* VIEW 1: CATEGORIES DIRECTORY */}
        {!activeCategoryId && (
          <>
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-white via-orange-50/40 to-amber-50/20 dark:from-[#0c1222] dark:via-[#0c1222]/90 dark:to-[#070b13] p-6 sm:p-8 border-2 border-orange-500/40 dark:border-orange-500/50 shadow-[0_0_35px_rgba(249,115,22,0.25)] hover:shadow-[0_0_55px_rgba(249,115,22,0.45)] transition-all duration-500 group">
              <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-orange-500/25 blur-3xl animate-pulse pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-amber-500/20 blur-3xl animate-pulse pointer-events-none delay-700" />
              
              <div className="relative z-10 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)] backdrop-blur-md">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-extrabold text-xs shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                    <span>{categoryList.length} Categories Loaded</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white drop-shadow-sm flex items-center gap-3">
                    Chaudhary Traders
                  </h1>
                  <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                    Agri-Chemicals, Pesticides & Fertilizer Management System
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    onClick={() => handleOpenAddProduct()}
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-black text-xs px-5 py-3 shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] transition-all active:scale-95 flex items-center gap-2"
                  >
                    Add Product +
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setIsPrintModalOpen(true)}
                    className="rounded-2xl border-orange-500/30 dark:border-orange-500/40 text-orange-600 dark:text-orange-400 font-extrabold text-xs px-5 py-3 hover:bg-orange-500/10 transition-all flex items-center gap-2"
                  >
                    <Printer className="h-4 w-4" /> Print Stock Invoice
                  </Button>
                </div>
              </div>
            </div>

            {/* CATEGORIES GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCategories.map((cls) => (
                <div
                  key={cls.id}
                  className="bg-white/90 dark:bg-[#0c1222]/90 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm hover:shadow-[0_0_25px_rgba(249,115,22,0.22)] dark:hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] dark:hover:border-orange-500/40 transition-all duration-300 hover:-translate-y-1 space-y-4 group relative backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => handleSelectCategory(cls.id)}
                      className="cursor-pointer flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div className="h-11 w-11 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black shrink-0 border border-orange-500/20 shadow-[0_0_12px_rgba(249,115,22,0.15)] group-hover:scale-105 transition-transform">
                        <Layers className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-orange-500 transition-colors truncate">
                          {cls.name}
                        </h3>
                        <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md inline-block mt-1 border border-slate-200 dark:border-slate-800">
                          Code: {cls.code}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleOpenEditCategory(cls, e)}
                        className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-95"
                        title="Edit Category"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmCategory(cls);
                        }}
                        className="p-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all active:scale-95"
                        title="Delete Category"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="bg-slate-50 dark:bg-[#070b13] p-2.5 rounded-2xl text-center border border-slate-100 dark:border-slate-800/40">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Total Items</span>
                      <span className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1 mt-0.5">
                        <Package className="h-3.5 w-3.5 text-orange-500" /> {(cls.products || []).length}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#070b13] p-2.5 rounded-2xl text-center border border-slate-100 dark:border-slate-800/40">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Category Status</span>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                        Active Stock
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleOpenAddProduct(cls.id)}
                      className="flex-1 py-2.5 px-3 rounded-2xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 border border-orange-500/20 active:scale-95"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Product
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* VIEW 2: PRODUCTS TABLE INSIDE CATEGORY */}
        {activeCategoryId && currentCategory && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200 max-w-4xl mx-auto">

            <div className="flex items-center justify-between">
              <button
                onClick={handleBackToCategories}
                className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-black text-lg hover:text-orange-500 transition-colors group"
              >
                <div className="p-1 rounded-xl group-hover:bg-orange-500/10 group-hover:text-orange-500">
                  <ChevronLeft className="h-6 w-6" />
                </div>
                <span>{currentCategory.name}</span>
              </button>

              <button 
                onClick={() => setIsPrintModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-black border border-orange-500/20 shadow-[0_0_12px_rgba(249,115,22,0.2)]"
              >
                <Printer className="h-3.5 w-3.5" /> Print Category
              </button>
            </div>

            {/* SEARCH + ADD PRODUCT BUTTON */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search product name..."
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0c1222] py-2.5 pl-9 pr-3 text-xs font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 dark:text-white"
                />
              </div>

              <Button
                onClick={() => handleOpenAddProduct()}
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-xs px-4 py-2.5 shadow-[0_0_15px_rgba(249,115,22,0.35)] shrink-0 active:scale-95 transition-all flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Product
              </Button>
            </div>

            {/* PRODUCT TABLE */}
            <div className="bg-white dark:bg-[#0c1222] border border-slate-200/70 dark:border-slate-800/60 rounded-3xl p-3 shadow-sm space-y-2">
              
              {/* TABLE HEADER */}
              <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider px-2 py-1.5 border-b border-slate-100 dark:border-slate-800/60 w-full">
                <div className="flex-1 min-w-0 pr-1">PRODUCT DETAILS</div>
                <div className="w-10 sm:w-14 shrink-0 text-center">QTY</div>
                <div className="hidden sm:block shrink-0 text-center sm:min-w-[75px]">COST PRICE</div>
                <div className="shrink-0 text-right min-w-[46px] sm:min-w-[50px]">ACTIONS</div>
              </div>

              {/* TABLE BODY */}
              {paginatedProducts.length === 0 ? (
                <div className="text-center py-8 text-xs font-bold text-slate-400">
                  No products in this category.
                </div>
              ) : (
                paginatedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-2 px-2 py-2.5 rounded-2xl hover:bg-orange-500/5 dark:hover:bg-slate-900/60 transition-colors border-b border-slate-100 dark:border-slate-800/40 last:border-0 w-full group"
                  >
                    {/* PRODUCT NAME & IMAGE */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <img
                        src={product.avatar}
                        alt={product.name}
                        className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-100 dark:bg-slate-900"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-xs font-extrabold text-slate-900 dark:text-slate-100 leading-tight break-words"
                          title={product.name}
                        >
                          {product.name}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 mt-0.5 whitespace-nowrap">
                          Cost: PKR {Number(product.costPrice || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* QUANTITY */}
                    <div className="w-10 sm:w-14 shrink-0 text-center">
                      <span className="bg-orange-500/10 text-orange-600 dark:text-orange-400 px-1.5 sm:px-2 py-0.5 rounded-md border border-orange-500/20 inline-block text-[11px] sm:text-xs font-black">
                        {product.quantity}
                      </span>
                    </div>

                    {/* COST PRICE */}
                    <div className="hidden sm:block shrink-0 text-center sm:min-w-[75px]">
                      <span className="text-[10px] sm:text-[11px] font-black text-emerald-600 dark:text-emerald-400 block whitespace-nowrap">
                        PKR {Number(product.costPrice || 0).toLocaleString()}
                      </span>
                    </div>

                    {/* ACTIONS */}
                    <div className="shrink-0 flex items-center justify-end gap-1 min-w-[46px] sm:min-w-[50px]">
                      <button
                        onClick={() => handleOpenEditProduct(product)}
                        className="p-1 sm:p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-95"
                        title="Edit Product"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmProduct(product)}
                        className="p-1 sm:p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all active:scale-95"
                        title="Delete Product"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* PAGINATION CONTROLS */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/60 px-1">
                  <span className="text-[10px] font-black text-slate-400">
                    Pg {currentPage}/{totalPages} ({sortedAndFilteredProducts.length})
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      className="flex items-center gap-0.5 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-black disabled:opacity-40 hover:bg-orange-500 hover:text-white transition-all"
                    >
                      <ChevronLeft className="h-3 w-3" /> Prev
                    </button>

                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      className="flex items-center gap-0.5 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-black disabled:opacity-40 hover:bg-orange-500 hover:text-white transition-all"
                    >
                      Next <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>
        )}

      </main>

      {/* CENTER NOTIFICATION TOAST */}
      {toast.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in zoom-in-90 duration-200">
          <div className={`bg-white dark:bg-[#0c1222] border rounded-3xl p-6 max-w-xs w-full text-center space-y-3 relative shadow-2xl transition-all duration-300 ${
            toast.type === 'success' 
              ? 'border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.4)]' 
              : toast.type === 'print'
              ? 'border-orange-500/50 shadow-[0_0_50px_rgba(249,115,22,0.4)]'
              : 'border-rose-500/50 shadow-[0_0_50px_rgba(244,63,94,0.4)]'
          }`}>
            <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center animate-bounce ${
              toast.type === 'success' 
                ? 'bg-emerald-500/20 text-emerald-500' 
                : toast.type === 'print'
                ? 'bg-orange-500/20 text-orange-500'
                : 'bg-rose-500/20 text-rose-500'
            }`}>
              {toast.type === 'success' ? (
                <CheckCircle2 className="h-8 w-8" />
              ) : toast.type === 'print' ? (
                <Printer className="h-8 w-8" />
              ) : (
                <Trash2 className="h-8 w-8" />
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {toast.title}
              </h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-snug">
                {toast.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PERMISSION MODAL */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c1222] border border-orange-500/40 rounded-3xl max-w-sm w-full p-6 shadow-[0_0_50px_rgba(249,115,22,0.35)] relative text-center space-y-4">
            
            <div className="w-14 h-14 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center mx-auto border border-orange-500/30 animate-pulse">
              <ShieldCheck className="h-7 w-7 text-orange-500" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Print Stock Invoice?
              </h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Allow app to generate official <span className="text-orange-500 font-extrabold">Chaudhary Trader</span> invoice in PDF print layout.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                onClick={() => setIsPrintModalOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-xs py-3 transition-colors"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmAndPrint}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-black text-xs py-3 shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4" /> Allow & Print
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* DELETE CATEGORY CONFIRMATION MODAL */}
      {deleteConfirmCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c1222] border border-rose-500/40 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative text-center space-y-4">
            
            <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/30">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Delete Category?
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-1">
                Are you sure you want to delete <span className="text-rose-500 font-extrabold">{deleteConfirmCategory.name}</span>? All products inside will be deleted.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                onClick={() => setDeleteConfirmCategory(null)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-xs py-3 transition-colors"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDeleteCategory}
                className="bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-xs py-3 transition-all active:scale-95"
              >
                Yes, Delete
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* DELETE PRODUCT CONFIRMATION MODAL */}
      {deleteConfirmProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c1222] border border-rose-500/40 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative text-center space-y-4">
            
            <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/30">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Delete Product?
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-1">
                Are you sure you want to remove <span className="text-rose-500 font-extrabold">{deleteConfirmProduct.name}</span>?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                onClick={() => setDeleteConfirmProduct(null)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-xs py-3 transition-colors"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDeleteProduct}
                className="bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-xs py-3 transition-all active:scale-95"
              >
                Yes, Delete
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* EDIT CATEGORY MODAL */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setEditingCategory(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-orange-500" /> Edit Category
            </h3>

            <form onSubmit={handleSaveEditCategory} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-600 dark:text-slate-300 block mb-1">Category Name</label>
                <input
                  type="text"
                  value={editCategoryNameInput}
                  onChange={(e) => setEditCategoryNameInput(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070b13] px-3.5 py-2.5 text-xs font-bold outline-none focus:border-orange-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-600 dark:text-slate-300 block mb-1">Category Code</label>
                <input
                  type="text"
                  value={editCategoryCodeInput}
                  onChange={(e) => setEditCategoryCodeInput(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070b13] px-3.5 py-2.5 text-xs font-bold outline-none focus:border-orange-500 text-slate-900 dark:text-white"
                />
              </div>

              <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 font-black text-xs shadow-lg transition-all active:scale-95">
                Update Category
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT PRODUCT MODAL */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsAddProductOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-xs font-extrabold text-orange-500 uppercase tracking-wider">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </span>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handlePhotoSelect} 
              accept="image/*" 
              className="hidden" 
            />

            <div className="flex justify-center">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-orange-400 bg-orange-50/30 dark:bg-slate-900/40 flex flex-col items-center justify-center text-center cursor-pointer hover:scale-105 transition-all overflow-hidden group"
              >
                {productAvatar ? (
                  <>
                    <img src={productAvatar} alt="Product Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-5 w-5 text-white" />
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-orange-500 mb-1" />
                    <span className="text-[9px] font-black text-orange-600 dark:text-orange-400">Product Image</span>
                  </>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Product Name</label>
                <input
                  type="text"
                  placeholder="e.g. Chlorpyrifos 40% EC"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070b13] px-4 py-2.5 text-xs font-bold outline-none focus:border-orange-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Product Quantity</label>
                <input
                  type="text"
                  placeholder="e.g. 50 Bottles / 100 Packs"
                  value={productQuantity}
                  onChange={(e) => setProductQuantity(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070b13] px-4 py-2.5 text-xs font-bold outline-none focus:border-orange-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Cost Price (PKR)</label>
                <input
                  type="number"
                  placeholder="e.g. 1500"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070b13] px-4 py-2.5 text-xs font-bold outline-none focus:border-orange-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full py-5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-xs shadow-[0_0_20px_rgba(249,115,22,0.35)] transition-all active:scale-95"
                >
                  {editingProduct ? 'Update Product' : 'Product Save'}
                </Button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* FLOATING BOTTOM NAVBAR */}
      <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <nav className="pointer-events-auto bg-white dark:bg-[#0c1222] border border-slate-100 dark:border-slate-800 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] px-5 py-2.5 flex items-center gap-4 sm:gap-8">
          {navigationTabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;

            const content = (
              <div className="flex flex-col items-center justify-center relative group cursor-pointer">
                <div
                  className={`flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? 'h-10 w-10 rounded-full bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]'
                      : 'h-8 w-8 text-slate-400 dark:text-slate-400 hover:text-orange-500'
                  }`}
                >
                  <IconComponent className={isActive ? "h-5 w-5" : "h-4 w-4"} />
                </div>

                <span
                  className={`text-[10px] font-bold mt-1 transition-colors ${
                    isActive ? 'text-orange-500 font-extrabold' : 'text-slate-400 dark:text-slate-400'
                  }`}
                >
                  {tab.label}
                </span>
              </div>
            );

            if (tab.action) {
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    tab.action();
                  }}
                  className="outline-none"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={tab.id}
                to={tab.href || '/'}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'home') {
                    handleBackToCategories();
                  }
                }}
                className="outline-none"
              >
                {content}
              </Link>
            );
          })}
        </nav>
      </div>

    </div>
  );
}
