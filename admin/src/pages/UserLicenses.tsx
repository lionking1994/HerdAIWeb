import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Plus, Edit, Trash, Loader2, CreditCard, CheckCircle, XCircle, DollarSign, Search, Copy, ExternalLink, Mail } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { EnhancedDataTable } from '../components/DataTable';

interface Product {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  default_price: {
    id: string;
    unit_amount: number;
    recurring: {
      interval: string;
    };
  };
  features: string[];
}

interface UserLicense {
  id: number;
  company_id: number;
  company_name?: string;
  product_ids: string[];
  license_count: number;
  total_price: number;
  payment_method: string;
  payment_details: any;
  status: string;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  payment_link?: string;
  payment_link_expires_at?: string;
  billing_interval?: string;
  next_billing_date?: string;
  stripe_subscription_id?: string;
  is_recurring?: boolean;
}

const paymentMethods = [
  { id: "credit_card", name: "Credit Card", icon: CreditCard },
  { id: "checking", name: "Checking", icon: DollarSign },
  { id: "ach", name: "ACH Transfer", icon: DollarSign },
  { id: "wire", name: "Wire Transfer", icon: DollarSign },
];

const licenseFormSchema = z.object({
  company_id: z.string().min(1, { message: "Company is required" }),
  license_count: z.number().min(1, { message: "License count must be at least 1" }),
});

type LicenseFormData = z.infer<typeof licenseFormSchema>;

const UserLicenses: React.FC = () => {
  const [licenses, setLicenses] = useState<UserLicense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<UserLicense | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [licenseCount, setLicenseCount] = useState(1);
  const [totalPrice, setTotalPrice] = useState(0);
  const [activeTab, setActiveTab] = useState("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedPaymentLink, setGeneratedPaymentLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [isRecurring, setIsRecurring] = useState(true); // Add recurring subscription state - default to true

  // New state for pagination, sorting, and filtering
  const [totalLicenses, setTotalLicenses] = useState(0);
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'expired' | 'cancelled'>('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Add these states at the top of the component (after other useState hooks)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [licenseToDelete, setLicenseToDelete] = useState<UserLicense | null>(null);

  const columnHelper = createColumnHelper<UserLicense>();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<LicenseFormData>({
    resolver: zodResolver(licenseFormSchema),
    defaultValues: {
      company_id: "",
      license_count: 1,
    },
  });

  useEffect(() => {
    fetchProducts();
    fetchCompanies();
  }, []);

  useEffect(() => {
    calculateTotalPrice();
  }, [selectedProducts, licenseCount, products]);

  // Handle Stripe checkout return
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const sessionId = urlParams.get('session_id');

    if (success === 'true' && sessionId) {
      toast.success('Payment successful! License has been activated.');
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchLicenses();

      // // Verify the session with the backend
      // const verifySession = async () => {
      //   try {
      //     const token = localStorage.getItem("token");
      //     await axios.post(
      //       `${import.meta.env.VITE_API_BASE_URL}/user-licenses/verify-session`,
      //       { sessionId },
      //       {
      //         headers: { Authorization: `Bearer ${token}` },
      //       }
      //     );
      //     toast.success('Payment successful! License has been activated.');
      //   } catch (error) {
      //     console.error('Error verifying session:', error);
      //     toast.error('Payment verification failed. Please contact support.');
      //   } finally {
      //     // Clean up URL parameters
      //     window.history.replaceState({}, document.title, window.location.pathname);
      //     fetchLicenses();
      //   }
      // };
      
      // verifySession();
    } else if (canceled === 'true') {
      toast.info('Payment was canceled.');
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Add effect for sorting changes
  useEffect(() => {
    if (sorting.length > 0) {
      fetchLicenses();
    }
  }, [sorting]);

  // Add effect for pagination and filter changes
  useEffect(() => {
    fetchLicenses();
  }, [
    pagination.pageIndex,
    pagination.pageSize, 
    statusFilter
  ]);

  // Add debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchLicenses();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [globalFilter]);

  const fetchLicenses = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      
      // Prepare sorting parameters
      const sortingParams = sorting.length > 0 
        ? {
            sort_by: sorting[0].id,
            sort_order: sorting[0].desc ? 'desc' : 'asc'
          } 
        : {};
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/user-licenses/all`,
        {
          page: pagination.pageIndex + 1,
          per_page: pagination.pageSize,
          filter: globalFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
          ...sortingParams,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setLicenses(response.data.licenses);
        setTotalLicenses(response.data.pagination.total);
      }
    } catch (error) {
      toast.error("Failed to fetch licenses");
      console.error(error);
      setLicenses([]);
      setTotalLicenses(0);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/user-licenses/products/active`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setProducts(response.data.products);
      }
    } catch (error) {
      toast.error("Failed to fetch products");
      console.error(error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/company`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setCompanies(response.data.companies);
      }
    } catch (error) {
      toast.error("Failed to fetch companies");
      console.error(error);
    }
  };

  const calculateTotalPrice = () => {
    let total = 0;
    selectedProducts.forEach((productId) => {
      const product = products.find((p) => p.id === productId);
      if (product && product.default_price) {
        total += (product.default_price.unit_amount / 100) * licenseCount;
      }
    });
    setTotalPrice(total);
  };

  const handleCreateLicense = () => {
    setIsCreating(true);
    setIsEditing(false);
    setSelectedLicense(null);
    setSelectedProducts([]);
    setLicenseCount(1);
    setTotalPrice(0);
    setGeneratedPaymentLink(null);
    setSelectedCompanyId(null);
    setIsSubmitting(false);
    setIsGeneratingLink(false);
    setIsRecurring(false); // Reset recurring state
    reset();
    setShowModal(true);
  };

  const handleEditLicense = (license: UserLicense) => {
    setIsCreating(false);
    setIsEditing(true);
    setSelectedLicense(license);
    setSelectedProducts(license.product_ids);
    setLicenseCount(license.license_count);
    setTotalPrice(license.total_price);
    setIsSubmitting(false);
    
    setValue("company_id", license.company_id.toString());
    setValue("license_count", license.license_count);
    
    setShowModal(true);
  };

  const handleDeleteLicense = async () => {
    if (!licenseToDelete) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL}/user-licenses/${licenseToDelete.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        toast.success("License deleted successfully");
        fetchLicenses();
      }
    } catch (error) {
      toast.error("Failed to delete license");
      console.error(error);
    } finally {
      setShowDeleteModal(false);
      setLicenseToDelete(null);
      setIsSubmitting(false);
    }
  };

  const handleGeneratePaymentLink = async (license: UserLicense) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/user-licenses/${license.id}/generate-payment-link`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        // Copy link to clipboard
        await navigator.clipboard.writeText(response.data.payment_link);
        toast.success("Payment link copied to clipboard!");
        fetchLicenses(); // Refresh to get updated data
      }
    } catch (error) {
      toast.error("Failed to generate payment link");
      console.error(error);
    }
  };

  const handleCopyPaymentLink = async (license: UserLicense) => {
    try {
      // Always regenerate the payment link to ensure no email pre-fill
      await handleGeneratePaymentLink(license);
    } catch (error) {
      toast.error("Failed to copy payment link");
      console.error(error);
    }
  };

  const isPaymentLinkExpired = (license: UserLicense) => {
    if (!license.payment_link_expires_at) return true;
    return new Date(license.payment_link_expires_at) < new Date();
  };

  const handleCopyGeneratedLink = async () => {
    if (!generatedPaymentLink) return;
    
    try {
      await navigator.clipboard.writeText(generatedPaymentLink);
      toast.success("Payment link copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy payment link");
      console.error(error);
    }
  };

  const isFormValid = () => {
    // For editing, form is already valid since data is populated
    if (isEditing) {
      return true;
    }
    // For creating, check all required fields
    return selectedCompanyId && selectedProducts.length > 0 && licenseCount > 0 && totalPrice > 0;
  };

  const handleGeneratePaymentLinkForNewLicense = async () => {
    if (!isFormValid()) {
      toast.error("Please fill all required fields first");
      return;
    }

    setIsGeneratingLink(true);
    try {
      const token = localStorage.getItem("token");
      
      // Step 1: Create a pending license for link generation
      const createPayload = {
        company_id: selectedCompanyId!,
        product_ids: selectedProducts,
        license_count: licenseCount,
        total_price: totalPrice,
        payment_method: "credit_card",
        payment_details: {},
        is_link_generation: true // Flag to allow credit_card for link generation
      };

      const createResponse = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/user-licenses`,
        createPayload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      if (!createResponse.data.success) {
        toast.error("Failed to create license for link generation");
        return;
      }

      const licenseId = createResponse.data.license.id;

      // Step 2: Generate payment link for the created license
      const linkResponse = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/user-licenses/${licenseId}/generate-payment-link`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      if (linkResponse.data.success) {
        setGeneratedPaymentLink(linkResponse.data.payment_link);
        toast.success("Payment link generated successfully!");
      } else {
        toast.error("Failed to generate payment link");
      }
    } catch (error) {
      toast.error("Failed to generate payment link");
      console.error(error);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleProductSelection = (productId: string) => {
    setSelectedProducts((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleLicenseCountChange = (count: number) => {
    setLicenseCount(count);
  };

  // Add email copy functionality
const handleCopyEmailDetails = async (license: UserLicense) => {
  try {
    // Get product names
    const productNames = license.product_ids
      .map((productId) => {
        const product = products.find((p) => p.id === productId);
        return product ? product.name : 'Unknown Product';
      })
      .join(', ');

    // Determine billing type
    // const billingType = license.is_recurring ? 'Monthly Recurring' : 'One-time Payment';
    const billingType =   'Monthly Recurring' ;
    // const billingNote = license.is_recurring ? ' (This is a monthly recurring subscription)' : '';
    const billingNote = ' (This is a monthly recurring subscription)'  ;

    // Format expiration date if available
    let expirationText = '';
    if (license.payment_link_expires_at) {
      const expirationDate = new Date(license.payment_link_expires_at);
      const formattedDate = expirationDate.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
      expirationText = ` (valid until ${formattedDate})`;
    }
    // Format the email template
    const emailTemplate = `Dear ${license.company_name || 'Client'},

Thank you for choosing GetHerd.AI.

We are pleased to provide the following license purchase details for your review and processing:

------------------------------------------------------------
• License Type  : ${productNames}
• Quantity      : ${license.license_count}
• Total Cost    : ${formatCurrency(license.total_price)}${billingNote}
• Billing Type  : ${billingType}
------------------------------------------------------------

${license.payment_link 
  ? `You can proceed with the payment using the following secure link${expirationText}:\n${license.payment_link}` 
  : 'A payment link will be generated and shared with you shortly upon confirmation.'}

If you have any questions or require modifications, please don't hesitate to reach out. We're here to support your success with GetHerd.AI.

Warm regards,  
GetHerd.AI Team

`;

    // Copy to clipboard
    await navigator.clipboard.writeText(emailTemplate);
    toast.success("Email details copied to clipboard!");
  } catch (error) {
    toast.error("Failed to copy email details");
    console.error(error);
  }
};


  const onSubmit = async (data: LicenseFormData) => {
    // Prevent multiple submissions
    if (isSubmitting) {
      return;
    }

    // Manual validation for products - no API call if validation fails
    if (selectedProducts.length === 0) {
      return; // Silent return, no toast, no API call
    }

    // Always use credit card payment for new licenses
    if (isCreating) {
      setIsSubmitting(true);
      const token = localStorage.getItem("token");
      const payload = {
        company_id: parseInt(data.company_id),
        product_ids: selectedProducts,
        license_count: licenseCount,
        total_price: totalPrice,
        payment_method: "credit_card",
        payment_details: {},
      };

      try {
        // Choose endpoint based on recurring option
        const endpoint = isRecurring 
          ? `${import.meta.env.VITE_API_BASE_URL}/user-licenses/recurring-subscription`
          : `${import.meta.env.VITE_API_BASE_URL}/user-licenses/stripe-checkout`;

        const response = await axios.post(endpoint, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (response.data.success) {
          // Redirect to Stripe checkout
          window.location.href = response.data.checkout_url;
        } else {
          toast.error("Failed to initiate Stripe checkout");
          console.error(response.data.message);
          setIsSubmitting(false);
        }
      } catch (error) {
        toast.error("Failed to initiate Stripe checkout");
        console.error(error);
        setIsSubmitting(false);
      }
      return;
    }

    // For editing existing licenses - update existing license and create payment session
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("token");
      const payload = {
        company_id: parseInt(data.company_id),
        product_ids: selectedProducts,
        license_count: licenseCount,
        total_price: totalPrice,
        payment_method: "credit_card",
        payment_details: {},
      };

      if (isEditing && selectedLicense) {
        // For editing, we need to update the existing license and redirect to payment
        // This ensures the email is pre-filled in Stripe checkout
        const editPayload = {
          ...payload,
          existing_license_id: selectedLicense.id
        };
        
        // Choose endpoint based on recurring option
        const endpoint = isRecurring 
          ? `${import.meta.env.VITE_API_BASE_URL}/user-licenses/recurring-subscription`
          : `${import.meta.env.VITE_API_BASE_URL}/user-licenses/stripe-checkout`;
        
        const paymentResponse = await axios.post(endpoint, editPayload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (paymentResponse.data.success) {
          // Redirect to Stripe checkout with email pre-filled
          window.location.href = paymentResponse.data.checkout_url;
        } else {
          toast.error("Failed to initiate payment");
          console.error(paymentResponse.data.message);
          setIsSubmitting(false);
        }
      }
    } catch (error) {
      toast.error("Failed to process payment");
      console.error(error);
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "expired":
        return "bg-red-100 text-red-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const formatBillingDate = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString();
    return { date: dateStr, time: timeStr };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getPaymentMethodIcon = (method: string) => {
    const paymentMethod = paymentMethods.find((m) => m.id === method);
    if (paymentMethod) {
      const Icon = paymentMethod.icon;
      return <Icon className="h-4 w-4" />;
    }
    return null;
  };

  const getPaymentMethodName = (method: string) => {
    const paymentMethod = paymentMethods.find((m) => m.id === method);
    return paymentMethod ? paymentMethod.name : method;
  };

  // Handle sorting change
  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting);
  };

  // Handle pagination change
  const handlePaginationChange = (newPagination: { pageIndex: number; pageSize: number }) => {
    setPagination(newPagination);
  };

  // Handle search
  const handleSearch = () => {
    fetchLicenses();
  };

  // Define columns for the table
  const columns: any[] = [
    columnHelper.accessor('company_name', {
      header: 'Company',
      cell: (info) => (
        <div className="text-gray-900 dark:text-gray-100 font-medium">
          {info.getValue() || 'N/A'}
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.display({
      id: 'products',
      header: 'Products',
      cell: (info) => {
        const license = info.row.original;
        return (
          <div className="space-y-1">
            {license.product_ids.map((productId: string) => {
              const product = products.find((p) => p.id === productId);
              return product ? (
                <div key={productId} className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                  {product.name}
                </div>
              ) : null;
            })}
          </div>
        );
      },
    }),
    columnHelper.accessor('license_count', {
      header: 'Licenses',
      cell: (info) => (
        <div className="text-gray-900 dark:text-gray-100 font-semibold text-center">
          {info.getValue()}
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('total_price', {
      header: 'Total Price',
      cell: (info) => (
        <div className="text-gray-900 dark:text-gray-100 font-semibold">
          {formatCurrency(info.getValue())}
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('payment_method', {
      header: 'Payment Method',
      cell: (info) => (
        <div className="flex items-center gap-2">
          {getPaymentMethodIcon(info.getValue())}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {getPaymentMethodName(info.getValue())}
          </span>
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.display({
      id: 'recurring',
      header: 'Billing',
      cell: (info) => {
        const license = info.row.original;
        return (
          <div className="flex items-center gap-2">
            {/* {license.is_recurring ? ( */}
              <div className="flex items-center gap-1">
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  Monthly
                </span>
                {license.next_billing_date && (
                  <div className="text-xs text-gray-500">
                    <div>Next: {formatBillingDate(license.next_billing_date).date}</div>
                    <div>{formatBillingDate(license.next_billing_date).time}</div>
                  </div>
                )}
              </div>
            {/* ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                One-time
              </span>
            )} */}
          </div>
        );
      },
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium text-center inline-block ${getStatusBadgeColor(
            info.getValue()
          )}`}
        >
          {info.getValue()}
        </span>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('created_at', {
      header: 'Created',
      cell: (info) => (
        <div className="text-gray-600 dark:text-gray-300 text-sm">
          {formatDate(info.getValue())}
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.display({
      id: 'email',
      header: 'Email',
      cell: (info) => {
        const license = info.row.original;
        return (
          <button
            onClick={() => handleCopyEmailDetails(license)}
            className="text-purple-600 hover:text-purple-800 p-1 rounded hover:bg-purple-50"
            title="Copy Email Details"
          >
            <Mail className="h-4 w-4" />
          </button>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const license = info.row.original;
        return (
          <div className="flex gap-1">
            {license.status !== 'active' && (
              <button
                onClick={() => handleEditLicense(license)}
                className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                title="Edit License"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
            {license.status === 'pending' && (
              <button
                onClick={() => handleCopyPaymentLink(license)}
                className={`p-1 rounded hover:bg-green-50 ${
                  license.payment_link && !isPaymentLinkExpired(license)
                    ? 'text-green-600 hover:text-green-800'
                    : 'text-orange-600 hover:text-orange-800'
                }`}
                title={
                  license.payment_link && !isPaymentLinkExpired(license)
                    ? "Copy Payment Link"
                    : "Generate Payment Link"
                }
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => {
                setLicenseToDelete(license);
                setShowDeleteModal(true);
              }}
              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
              title="Delete License"
            >
              <Trash className="h-4 w-4" />
            </button>
          </div>
        );
      },
    }),
  ];

  return (
    <div className="p-6 flex-1 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Licenses</h1>
        <button
          onClick={handleCreateLicense}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add License
        </button>
      </div>

      {/* Search and Filter Section */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="flex w-full sm:w-96">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              placeholder="Search by company, payment, status, price, licenses, date..."
              disabled={isLoading}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 
                border border-gray-300 dark:border-gray-600 rounded-l-md
                text-sm text-gray-900 dark:text-white 
                placeholder-gray-500 
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
                transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium
              rounded-r-md hover:bg-indigo-700 
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 
              transition-colors duration-200
              flex items-center justify-center
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              'Search'
            )}
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              checked={statusFilter === 'all'}
              onChange={() => setStatusFilter('all')}
              disabled={isLoading}
              className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 disabled:opacity-50"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">All</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              checked={statusFilter === 'active'}
              onChange={() => setStatusFilter('active')}
              disabled={isLoading}
              className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 disabled:opacity-50"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              checked={statusFilter === 'pending'}
              onChange={() => setStatusFilter('pending')}
              disabled={isLoading}
              className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 disabled:opacity-50"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Pending</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              checked={statusFilter === 'expired'}
              onChange={() => setStatusFilter('expired')}
              disabled={isLoading}
              className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 disabled:opacity-50"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Expired</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              checked={statusFilter === 'cancelled'}
              onChange={() => setStatusFilter('cancelled')}
              disabled={isLoading}
              className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 disabled:opacity-50"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Cancelled</span>
          </label>
        </div>
      </div>

      {/* Data Table */}
      <div className="hidden md:block overflow-x-auto">
        <EnhancedDataTable
          columns={columns}
          data={licenses}
          pageSize={pagination.pageSize}
          showPagination={true}
          manualPagination={true}
          manualSorting={true}
          pageCount={Math.ceil(totalLicenses / pagination.pageSize)}
          onPaginationChange={handlePaginationChange}
          sorting={sorting}
          onSortingChange={handleSortingChange}
          isLoading={isLoading}
          totalCount={totalLicenses}
          pagination={pagination}
          columnWidths={{
            company_name: 'w-[180px] min-w-[150px]',
            products: 'w-[140px] min-w-[120px]',
            license_count: 'w-[100px] min-w-[80px]',
            total_price: 'w-[140px] min-w-[120px]',
            payment_method: 'w-[200px] min-w-[180px]',
            recurring: 'w-[200px] min-w-[180px]',
            status: 'w-[120px] min-w-[100px]',
            created_at: 'w-[160px] min-w-[140px]',
            email: 'w-[80px] min-w-[60px]',
            actions: 'w-[100px] min-w-[80px]'
          }}
        />
      </div>

      {/* Mobile view */}
      <div className="md:hidden space-y-4">
        {isLoading ? (
          // Mobile loading skeleton
          Array.from({ length: pagination.pageSize }, (_, index) => (
            <div key={`mobile-loading-${index}`} className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
              <div className="animate-pulse">
                <div className="flex justify-between items-start mb-2">
                  <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-5 bg-gray-200 rounded w-20"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                <div className="flex justify-end">
                  <div className="h-5 w-5 bg-gray-200 rounded-full"></div>
                </div>
              </div>
            </div>
          ))
        ) : licenses.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No licenses found</p>
            <button
              onClick={handleCreateLicense}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 mx-auto"
            >
              <Plus className="h-4 w-4" />
              Add License
            </button>
          </div>
        ) : (
          licenses.map((license) => (
            <div
              key={license.id}
              className="bg-white dark:bg-gray-800 shadow rounded-lg p-4"
            >
              <div className="flex flex-col space-y-2">
                <div className="flex justify-between items-start">
                  <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {license.company_name || 'N/A'}
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(
                      license.status
                    )}`}
                  >
                    {license.status}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {license.license_count} licenses • {formatCurrency(license.total_price)}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    {getPaymentMethodIcon(license.payment_method)}
                    {getPaymentMethodName(license.payment_method)}
                  </div>
                  <div className="flex gap-2">
                    {license.status !== 'active' && (
                      <button
                        onClick={() => handleEditLicense(license)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    )}
                    {license.status === 'pending' && (
                      <button
                        onClick={() => handleCopyPaymentLink(license)}
                        className={`${
                          license.payment_link && !isPaymentLinkExpired(license)
                            ? 'text-green-600 hover:text-green-800'
                            : 'text-orange-600 hover:text-orange-800'
                        }`}
                        title={
                          license.payment_link && !isPaymentLinkExpired(license)
                            ? "Copy Payment Link"
                            : "Generate Payment Link"
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleCopyEmailDetails(license)}
                      className="text-purple-600 hover:text-purple-800"
                      title="Copy Email Details"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setLicenseToDelete(license);
                        setShowDeleteModal(true);
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Mobile Pagination */}
        {!isLoading && licenses.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
              Showing {pagination.pageIndex * pagination.pageSize + 1} to{" "}
              {Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalLicenses)} of{" "}
              {totalLicenses} results
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                onClick={() => handlePaginationChange({
                  ...pagination,
                  pageIndex: pagination.pageIndex - 1
                })}
                disabled={pagination.pageIndex === 0}
              >
                Previous
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Page {pagination.pageIndex + 1} of{" "}
                {Math.ceil(totalLicenses / pagination.pageSize)}
              </span>
              <button
                className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                onClick={() => handlePaginationChange({
                  ...pagination,
                  pageIndex: pagination.pageIndex + 1
                })}
                disabled={pagination.pageIndex >= Math.ceil(totalLicenses / pagination.pageSize) - 1}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* License Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XCircle className="h-6 w-6" />
            </button>
            <h2 className="text-xl font-semibold mb-4 pr-8">
              {isCreating ? "Add New License" : "Edit License"}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Company Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company <span className="text-red-500">*</span>
                </label>
                <select
                  {...register("company_id")}
                  className="w-full p-2 border rounded-lg"
                  onChange={(e) => {
                    setValue("company_id", e.target.value);
                    setSelectedCompanyId(parseInt(e.target.value) || null);
                  }}
                >
                  <option value="">Select a company</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                {errors.company_id && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.company_id.message}
                  </p>
                )}
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Products <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className={`border rounded-lg p-4 cursor-pointer ${
                        selectedProducts.includes(product.id)
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200"
                      }`}
                      onClick={() => handleProductSelection(product.id)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">
                          {selectedProducts.includes(product.id) ? (
                            <CheckCircle className="h-5 w-5 text-blue-500" />
                          ) : (
                            <div className="h-5 w-5 border border-gray-300 rounded-full" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-medium">{product.name}</h3>
                          <p className="text-sm text-gray-500">
                            {formatCurrency(product.default_price.unit_amount / 100)}/
                            {product.default_price.recurring.interval}
                          </p>
                          {product.description && (
                            <p className="text-sm text-gray-600 mt-1">
                              {product.description}
                            </p>
                          )}
                          {product.features && product.features.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {product.features.map((feature, index) => (
                                <li
                                  key={index}
                                  className="text-xs text-gray-600 flex items-center gap-1"
                                >
                                  <span className="h-1 w-1 bg-gray-400 rounded-full"></span>
                                  {feature}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {selectedProducts.length === 0 && (
                  <p className="text-red-500 text-sm mt-1">
                    At least one product must be selected
                  </p>
                )}
              </div>

              {/* License Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of User Licenses <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={licenseCount}
                  onChange={(e) => handleLicenseCountChange(parseInt(e.target.value))}
                  className="w-full p-2 border rounded-lg"
                />
                {errors.license_count && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.license_count.message}
                  </p>
                )}
              </div>

              {/* Recurring Subscription Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Billing Type
                </label>
                <div className="flex items-center space-x-4">
                  {/* One-time payment option commented out - only monthly recurring available */}
                  {/* <label className="flex items-center">
                    <input
                      type="radio"
                      name="billingType"
                      checked={!isRecurring}
                      onChange={() => setIsRecurring(false)}
                      className="mr-2"
                    />
                    <span className="text-sm">One-time Payment</span>
                  </label> */}
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="billingType"
                      checked={isRecurring}
                      onChange={() => setIsRecurring(true)}
                      className="mr-2"
                    />
                    <span className="text-sm">Monthly Recurring</span>
                  </label>
                </div>
                {isRecurring && (
                  <p className="text-xs text-blue-600 mt-1">
                    💳 Monthly subscription - automatically charged every month
                  </p>
                )}
              </div>

              {/* Total Price (calculated) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Price
                </label>
                <div className="w-full p-2 border rounded-lg bg-gray-50">
                  {formatCurrency(totalPrice)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Calculated based on selected products and license count
                </p>
              </div>

              {/* Payment Information Note */}
              {(isCreating || isEditing) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">
                        Payment Processing
                      </h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <p>
                          Upon clicking the "Make Payment" button, you will be securely redirected to our payment gateway powered by Stripe to complete your transaction. Your payment information will be processed securely and encrypted throughout the transaction.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                {isCreating && (
                  <>
                    {generatedPaymentLink ? (
                      <button
                        type="button"
                        onClick={handleCopyGeneratedLink}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700"
                      >
                        <Copy className="h-4 w-4" />
                        Copy Payment Link
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGeneratePaymentLinkForNewLicense}
                        disabled={!isFormValid() || isGeneratingLink}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                          !isFormValid() || isGeneratingLink
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-orange-600 hover:bg-orange-700"
                        } text-white`}
                      >
                        {isGeneratingLink ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <ExternalLink className="h-4 w-4" />
                            Generate Payment Link
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting || !isFormValid()}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    isSubmitting || !isFormValid()
                      ? "bg-gray-400 cursor-not-allowed" 
                      : "bg-blue-600 hover:bg-blue-700"
                  } text-white`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isCreating ? "Creating..." : "Processing..."}
                    </>
                  ) : (
                    <>{isCreating ? "Make Payment" : "Retry Payment"}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Delete License</h2>
            <p>Are you sure you want to delete this license?</p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteLicense}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserLicenses;

