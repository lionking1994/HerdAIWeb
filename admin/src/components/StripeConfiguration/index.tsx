import React, { useState, useEffect } from "react";
import { Edit, Trash, Plus, X, Loader2, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

interface StripeConfig {
  maxMeetingCount: number;
  productionPublishableKey: string;
  productionSecretKey: string;
  productionWebhookSecret: string;
  sandboxPublishableKey: string;
  sandboxSecretKey: string;
  sandboxWebhookSecret: string;
  environment: "production" | "sandbox";
}

interface StripeProduct {
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
  metadata: Record<string, string>;
}

const stripeConfigSchema = z.object({
  maxMeetingCount: z.number().min(1, { message: "Must be at least 1" }),
  productionPublishableKey: z.string().min(1, { message: "Production publishable key is required" }),
  productionSecretKey: z.string().min(1, { message: "Production secret key is required" }),
  productionWebhookSecret: z.string().min(1, { message: "Production webhook secret is required" }),
  sandboxPublishableKey: z.string().min(1, { message: "Sandbox publishable key is required" }),
  sandboxSecretKey: z.string().min(1, { message: "Sandbox secret key is required" }),
  sandboxWebhookSecret: z.string().min(1, { message: "Sandbox webhook secret is required" }),
  environment: z.enum(["production", "sandbox"]),
});

type StripeConfigFormData = z.infer<typeof stripeConfigSchema>;

const StripeConfiguration: React.FC = () => {
  // Mock products for development
  const mockProducts: StripeProduct[] = [];

  // State for Stripe configuration
  const [stripeConfig, setStripeConfig] = useState<StripeConfig>({
    maxMeetingCount: 10,
    productionPublishableKey: "",
    productionSecretKey: "",
    productionWebhookSecret: "",
    sandboxPublishableKey: "",
    sandboxSecretKey: "",
    sandboxWebhookSecret: "",
    environment: "sandbox",
  });
  const [isStripeConfigLoading, setIsStripeConfigLoading] = useState(true);
  const [isSavingStripeConfig, setIsSavingStripeConfig] = useState(false);
  const [showStripeSecretKeys, setShowStripeSecretKeys] = useState(false);

  // State for products
  const [products, setProducts] = useState<StripeProduct[]>(mockProducts);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StripeProduct | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: 0,
    interval: "month",
    features: [""]
  });

  // Add a new state for the product filter
  const [productFilter, setProductFilter] = useState<'active' | 'archived' | 'all'>('active');

  // Form handling for Stripe configuration
  const {
    register: registerStripeConfig,
    handleSubmit: handleSubmitStripeConfig,
    reset: resetStripeConfig,
    setValue: setStripeConfigValue,
    formState: { errors: stripeConfigErrors },
  } = useForm<StripeConfigFormData>({
    resolver: zodResolver(stripeConfigSchema),
    defaultValues: {
      maxMeetingCount: 10,
      productionPublishableKey: "",
      productionSecretKey: "",
      productionWebhookSecret: "",
      sandboxPublishableKey: "",
      sandboxSecretKey: "",
      sandboxWebhookSecret: "",
      environment: "sandbox",
    },
  });

  useEffect(() => {
    fetchStripeConfig();
    fetchProducts();
  }, []);

  // Fetch Stripe configuration
  const fetchStripeConfig = async () => {
    setIsStripeConfigLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/system-settings/stripe-config`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        const config = response.data.stripeConfig;
        setStripeConfig(config);

        // Update form values
        resetStripeConfig({
          maxMeetingCount: config.maxMeetingCount,
          productionPublishableKey: config.productionPublishableKey,
          productionSecretKey: config.productionSecretKey,
          productionWebhookSecret: config.productionWebhookSecret,
          sandboxPublishableKey: config.sandboxPublishableKey,
          sandboxSecretKey: config.sandboxSecretKey,
          sandboxWebhookSecret: config.sandboxWebhookSecret,
          environment: config.environment,
        });
      }
    } catch (error) {
      toast.error("Failed to fetch Stripe configuration");
      console.error(error);
      
      // For development, use mock data
      resetStripeConfig({
        maxMeetingCount: 10,
        productionPublishableKey: "pk_live_example",
        productionSecretKey: "sk_live_example",
        productionWebhookSecret: "whsec_live_example",
        sandboxPublishableKey: "pk_test_example",
        sandboxSecretKey: "sk_test_example",
        sandboxWebhookSecret: "whsec_test_example",
        environment: "sandbox",
      });
    } finally {
      setIsStripeConfigLoading(false);
    }
  };

  // Fetch products
  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/system-settings/stripe-products`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        // Map Stripe products to our format
        const mappedProducts = response.data.products.map((product: any) => ({
          id: product.id,
          name: product.name,
          description: product.description || "",
          active: product.active,
          default_price: product.default_price,
          features: product.features || [],
          metadata: product.metadata || {}
        }));
        setProducts(mappedProducts);
      }
    } catch (error) {
      toast.error("Failed to fetch products");
      console.error(error);
      // Keep using mock products in case of error
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Submit Stripe configuration
  const onSubmitStripeConfig = async (data: StripeConfigFormData) => {
    setIsSavingStripeConfig(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/system-settings/stripe-config`,
        data,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        toast.success(response.data.message || "Stripe configuration updated successfully");
        setStripeConfig(data);
      }
    } catch (error) {
      toast.error("Failed to update Stripe configuration");
      console.error(error);
    } finally {
      setIsSavingStripeConfig(false);
    }
  };

  // Toggle environment
  const toggleEnvironment = async () => {
    const newEnvironment = stripeConfig.environment === "production" ? "sandbox" : "production";

    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/system-settings/stripe-environment`,
        { environment: newEnvironment },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        toast.success(`Switched to ${newEnvironment} environment`);
        setStripeConfig({
          ...stripeConfig,
          environment: newEnvironment as "production" | "sandbox",
        });
        setStripeConfigValue("environment", newEnvironment as "production" | "sandbox");
      }
    } catch (error) {
      toast.error("Failed to switch environment");
      console.error(error);
    }
  };

  // Product management functions
  const toggleProductStatus = async (id: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/products/${id}/toggle`,
        { is_enabled: !currentStatus },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        toast.success(response.data.message || "Product status updated");
        setProducts(products.map(product => 
          product.id === id ? { ...product, active: !currentStatus } : product
        ));
      }
    } catch (error) {
      toast.error("Failed to update product status");
      console.error(error);
      
      // For development, update the UI anyway
      setProducts(products.map(product => 
        product.id === id ? { ...product, active: !currentStatus } : product
      ));
    }
  };

  const handleEditProduct = (product: StripeProduct) => {
    console.log(product)
    setEditingProduct({
      ...product,
      features: [...product.features]
    });
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    
    try {
      const token = localStorage.getItem("token");
      // Create the request payload
      const productData = {
        name: editingProduct.name,
        description: editingProduct.description,
        active: editingProduct.active,
        features: editingProduct.features.filter(f => f.trim() !== ""),
        // Only include price data if price has changed
        ...(editingProduct.priceChanged && {
          price_data: {
            unit_amount: Math.round(editingProduct.newPrice * 100),
            currency: 'usd',
            recurring: {
              interval: editingProduct.default_price.recurring.interval
            }
          }
        })
      };
      console.log(productData)

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/system-settings/stripe-products/${editingProduct.id}`,
        productData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        toast.success("Product updated successfully");
        fetchProducts(); // Refresh the products list
        setEditingProduct(null);
      }
    } catch (error) {
      toast.error("Failed to update product");
      console.error(error);
    }
  };

  const handleCreateProduct = async () => {
    try {
      const token = localStorage.getItem("token");

      // Validate required fields
      if (!newProduct.name || !newProduct.price) {
        toast.error("Product name and price are required");
        return;
      }

      // Create the request payload
      const productData = {
        name: newProduct.name,
        description: newProduct.description,
        // Price data for creating the associated price
        price_data: {
          unit_amount: Math.round(newProduct.price * 100), // Convert to cents for Stripe
          currency: 'usd',
          recurring: {
            interval: newProduct.interval
          }
        },
        features: newProduct.features.filter(f => f.trim() !== "")
      };

      // Send request to create product with price
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/system-settings/add-product`,
        productData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        toast.success("Product and price created successfully");
        fetchProducts(); // Refresh the products list
        setNewProduct({
          name: "",
          description: "",
          price: 0,
          interval: "month",
          features: [""]
        });
        setIsCreatingProduct(false);
      }
    } catch (error) {
      toast.error("Failed to create product and price");
      console.error(error);
    }
  };

  // Replace handleDeleteProduct with handleArchiveProduct
  const handleArchiveProduct = async (id: string) => {
    if (!confirm("Are you sure you want to archive this product? Archived products won't be available for new subscriptions.")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/system-settings/archive-product`,
        {
          product_id: id
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        toast.success(response.data.message || "Product archived successfully");
        setProducts(products.map(product =>
          product.id === id ? { ...product, active: false } : product
        ));
      }
    } catch (error) {
      toast.error("Failed to archive product");
      console.error(error);
    }
  };

  const handleAddFeature = (isNew = false) => {
    if (isNew) {
      setNewProduct({
        ...newProduct,
        features: [...newProduct.features, ""]
      });
    } else if (editingProduct) {
      setEditingProduct({
        ...editingProduct,
        features: [...editingProduct.features, ""]
      });
    }
  };

  const handleRemoveFeature = (index: number, isNew = false) => {
    if (isNew) {
      const updatedFeatures = [...newProduct.features];
      updatedFeatures.splice(index, 1);
      setNewProduct({
        ...newProduct,
        features: updatedFeatures
      });
    } else if (editingProduct) {
      const updatedFeatures = [...editingProduct.features];
      updatedFeatures.splice(index, 1);
      setEditingProduct({
        ...editingProduct,
        features: updatedFeatures
      });
    }
  };

  const handleFeatureChange = (index: number, value: string, isNew = false) => {
    if (isNew) {
      const updatedFeatures = [...newProduct.features];
      updatedFeatures[index] = value;
      setNewProduct({
        ...newProduct,
        features: updatedFeatures
      });
    } else if (editingProduct) {
      const updatedFeatures = [...editingProduct.features];
      updatedFeatures[index] = value;
      setEditingProduct({
        ...editingProduct,
        features: updatedFeatures
      });
    }
  };

  const handlePriceChange = (value) => {
    if (!editingProduct) return;

    const newPrice = parseFloat(value);
    const currentPrice = editingProduct.default_price?.unit_amount / 100;

    setEditingProduct({
      ...editingProduct,
      newPrice: newPrice,
      priceChanged: newPrice !== currentPrice
    });
  };

  // Add a function to filter products based on status
  const filteredProducts = products.filter(product => {
    if (productFilter === 'all') return true;
    if (productFilter === 'active') return product.active;
    if (productFilter === 'archived') return !product.active;
    return true;
  });

  return (
    <div className="">
      {/* Stripe Configuration Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-6">Stripe Configuration</h2>

        {isStripeConfigLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-medium">Environment</h3>
                <p className="text-sm text-gray-500">
                  Current: <span className="font-semibold capitalize">{stripeConfig.environment}</span>
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="environment-toggle"
                  checked={stripeConfig.environment === "production"}
                  onCheckedChange={toggleEnvironment}
                />
                <Label htmlFor="environment-toggle">
                  {stripeConfig.environment === "production" ? "Production" : "Sandbox"}
                </Label>
              </div>
            </div>

            <form onSubmit={handleSubmitStripeConfig(onSubmitStripeConfig)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Meeting Count (Free Plan)
                </label>
                <input
                  type="number"
                  {...registerStripeConfig("maxMeetingCount", { valueAsNumber: true })}
                  className="w-full p-2 border rounded-lg"
                  placeholder="10"
                />
                {stripeConfigErrors.maxMeetingCount && (
                  <p className="text-red-500 text-sm mt-1">
                    {stripeConfigErrors.maxMeetingCount.message}
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  Number of meetings allowed before requiring a subscription
                </p>
              </div>

                <Tabs defaultValue={stripeConfig.environment} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="production">Production</TabsTrigger>
                  <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
                </TabsList>

                <TabsContent value="production" className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Publishable Key
                    </label>
                    <input
                      type="text"
                      {...registerStripeConfig("productionPublishableKey")}
                      className="w-full p-2 border rounded-lg"
                      placeholder="pk_live_..."
                    />
                    {stripeConfigErrors.productionPublishableKey && (
                      <p className="text-red-500 text-sm mt-1">
                        {stripeConfigErrors.productionPublishableKey.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Secret Key
                    </label>
                    <div className="relative">
                      <input
                        type={showStripeSecretKeys ? "text" : "password"}
                        {...registerStripeConfig("productionSecretKey")}
                          className="w-full pr-[30px] p-2 border rounded-lg"
                        placeholder="sk_live_..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowStripeSecretKeys(!showStripeSecretKeys)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                          {showStripeSecretKeys ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {stripeConfigErrors.productionSecretKey && (
                      <p className="text-red-500 text-sm mt-1">
                        {stripeConfigErrors.productionSecretKey.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Webhook Secret
                    </label>
                    <div className="relative">
                      <input
                        type={showStripeSecretKeys ? "text" : "password"}
                        {...registerStripeConfig("productionWebhookSecret")}
                          className="w-full pr-[30px] p-2 border rounded-lg"
                        placeholder="whsec_..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowStripeSecretKeys(!showStripeSecretKeys)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                          {showStripeSecretKeys ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {stripeConfigErrors.productionWebhookSecret && (
                      <p className="text-red-500 text-sm mt-1">
                        {stripeConfigErrors.productionWebhookSecret.message}
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="sandbox" className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Publishable Key
                    </label>
                    <input
                      type="text"
                      {...registerStripeConfig("sandboxPublishableKey")}
                      className="w-full p-2 border rounded-lg"
                      placeholder="pk_test_..."
                    />
                    {stripeConfigErrors.sandboxPublishableKey && (
                      <p className="text-red-500 text-sm mt-1">
                        {stripeConfigErrors.sandboxPublishableKey.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Secret Key
                    </label>
                    <div className="relative">
                      <input
                        type={showStripeSecretKeys ? "text" : "password"}
                        {...registerStripeConfig("sandboxSecretKey")}
                          className="w-full pr-[30px] p-2 border rounded-lg"
                        placeholder="sk_test_..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowStripeSecretKeys(!showStripeSecretKeys)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                          {showStripeSecretKeys ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {stripeConfigErrors.sandboxSecretKey && (
                      <p className="text-red-500 text-sm mt-1">
                        {stripeConfigErrors.sandboxSecretKey.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Webhook Secret
                    </label>
                    <div className="relative">
                      <input
                        type={showStripeSecretKeys ? "text" : "password"}
                        {...registerStripeConfig("sandboxWebhookSecret")}
                          className="w-full pr-[30px] p-2 border rounded-lg"
                        placeholder="whsec_..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowStripeSecretKeys(!showStripeSecretKeys)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                          {showStripeSecretKeys ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {stripeConfigErrors.sandboxWebhookSecret && (
                      <p className="text-red-500 text-sm mt-1">
                        {stripeConfigErrors.sandboxWebhookSecret.message}
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingStripeConfig}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                >
                  {isSavingStripeConfig ? (
                    <>
                      <Loader2 className="h-4 w-4 inline mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Configuration"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Products Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Subscription Products</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value as 'active' | 'archived' | 'all')}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="active">Active Products</option>
                <option value="archived">Archived Products</option>
                <option value="all">All Products</option>
              </select>
            </div>
            <button
              onClick={() => setIsCreatingProduct(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 inline mr-1" /> Add Product
            </button>
          </div>
        </div>

        {isLoadingProducts ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interval</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className={!product.active ? "bg-gray-50" : ""}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        ${(product.default_price?.unit_amount / 100).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {product.default_price?.recurring?.interval === 'month' ? 'Monthly' : 'Yearly'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Switch
                          checked={product.active}
                          onCheckedChange={() => toggleProductStatus(product.id, product.active)}
                            disabled={!product.active && productFilter === 'archived'}
                        />
                        <span className="ml-2 text-sm text-gray-500">
                            {product.active ? "Active" : "Archived"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                        {product.active && (
                          <button
                            onClick={() => handleArchiveProduct(product.id)}
                            className="text-amber-600 hover:text-amber-900"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Edit Product</h3>
              <button
                onClick={() => (null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                  placeholder="Product name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                  placeholder="Product description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price
                  </label>
                  <input
                    type="number"
                    value={editingProduct.newPrice || (editingProduct.default_price?.unit_amount / 100)}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                  {editingProduct.priceChanged && (
                    <p className="text-amber-500 text-xs mt-1">
                      Changing the price will create a new price in Stripe. Existing subscriptions will not be affected.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Billing Interval
                  </label>
                  <select
                    value={editingProduct.interval}
                    onChange={(e) => setEditingProduct({ ...editingProduct, interval: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Features
                </label>
                {editingProduct.features.map((feature, index) => (
                  <div key={index} className="flex items-center mb-2">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => handleFeatureChange(index, e.target.value)}
                      className="flex-1 p-2 border rounded-lg mr-2"
                      placeholder="Feature description"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleAddFeature()}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  + Add Feature
                </button>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateProduct}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Product Modal */}
      {isCreatingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Create New Product</h3>
              <button
                onClick={() => setIsCreatingProduct(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                  placeholder="Product name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                  placeholder="Product description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price
                  </label>
                  <input
                    type="number"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
                    className="w-full p-2 border rounded-lg"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Billing Interval
                  </label>
                  <select
                    value={newProduct.interval}
                    onChange={(e) => setNewProduct({ ...newProduct, interval: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Features
                </label>
                {newProduct.features.map((feature, index) => (
                  <div key={index} className="flex items-center mb-2">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => handleFeatureChange(index, e.target.value, true)}
                      className="flex-1 p-2 border rounded-lg mr-2"
                      placeholder="Feature description"
                    />
                    {newProduct.features.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(index, true)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleAddFeature(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  + Add Feature
                </button>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsCreatingProduct(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateProduct}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create Product
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StripeConfiguration;




