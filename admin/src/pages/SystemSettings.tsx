import React, { useState, useEffect } from "react";
import axios from "axios";
import { Save, Loader2, Eye, EyeOff, Plus, Trash, Edit } from "lucide-react";
import { toast } from "react-toastify";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ModelManagementModal } from "../components/ModelManagementModal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import StripeConfiguration from "../components/StripeConfiguration";

const AI_MODELS = [
  { id: "claude", name: "Claude", requiresKey: true },
  { id: "perplexity", name: "Perplexity AI", requiresKey: true },
  { id: "gemini", name: "Gemini", requiresKey: true },
];

const systemSettingsSchema = z.object({
  threshold: z.number().min(1, { message: "Threshold is required" }),
});

const apiConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, { message: "Name is required" }),
  provider: z.string().min(2, { message: "Provider is required" }),
  apiKey: z.string().min(1, { message: "API Key is required" }),
});

// Add new schema for agent configuration
const agentConfigSchema = z.object({
  recallApiKey: z.string(),
  elevenlabsKey: z.string(),
  pineconeApiKey: z.string(),
  pineconeIndexName: z.string(),
  agentId: z.string(),
});

interface ApiResponse {
  success: boolean;
  message: string;
}

interface ModelConfig {
  id: string;
  name: string;
  model: string;
}

interface ApiConfig {
  id?: string;
  name: string;
  provider: string;
  apiKey: string;
  models?: ModelConfig[];
}

// Add new interface for agent configuration
interface AgentConfig {
  recallApiKey: string;
  elevenlabsKey: string;
  pineconeApiKey: string;
  pineconeIndexName: string;
  agentId: string;
}

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
  description: string;
  price: number;
  interval: string;
  is_enabled: boolean;
  features: string[];
}

type SystemSettingsFormData = z.infer<typeof systemSettingsSchema>;
type ApiConfigFormData = z.infer<typeof apiConfigSchema>;
type AgentConfigFormData = z.infer<typeof agentConfigSchema>;
type StripeConfigFormData = z.infer<typeof stripeConfigSchema>;

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

const mockProducts: StripeProduct[] = [
  {
    id: "1",
    name: "Basic Plan",
    description: "Essential features for small teams",
    price: 29.99,
    interval: "month",
    is_enabled: true,
    features: ["Up to 5 users", "10GB storage", "Basic support"]
  },
  {
    id: "2",
    name: "Pro Plan",
    description: "Advanced features for growing businesses",
    price: 79.99,
    interval: "month",
    is_enabled: true,
    features: ["Up to 20 users", "50GB storage", "Priority support", "Advanced analytics"]
  },
  {
    id: "3",
    name: "Enterprise Plan",
    description: "Complete solution for large organizations",
    price: 199.99,
    interval: "month",
    is_enabled: false,
    features: ["Unlimited users", "500GB storage", "24/7 support", "Custom integrations", "Dedicated account manager"]
  },
  {
    id: "4",
    name: "Starter Annual",
    description: "Annual billing with discount",
    price: 249.99,
    interval: "year",
    is_enabled: true,
    features: ["Up to 10 users", "25GB storage", "Email support", "Save 30% vs monthly"]
  }
];

export default function SystemSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ApiConfig | null>(null);
  const [showModelModal, setShowModelModal] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<ApiConfig | null>(null);

  // Add new state for agent configuration
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    recallApiKey: "",
    elevenlabsKey: "",
    pineconeApiKey: "",
    pineconeIndexName: "",
    agentId: "",
  });
  const [isAgentConfigLoading, setIsAgentConfigLoading] = useState(true);
  const [isSavingAgentConfig, setIsSavingAgentConfig] = useState(false);
  const [showAgentSecretKeys, setShowAgentSecretKeys] = useState({
    recall: false,
    elevenlabs: false,
    pinecone: false,
  });

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

  const handleConfigNameClick = (config: ApiConfig) => {
    setSelectedConfig(config);
    setShowModelModal(true);
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SystemSettingsFormData>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      threshold: 0,
    },
  });

  const {
    register: registerApiConfig,
    handleSubmit: handleSubmitApiConfig,
    reset: resetApiConfig,
    formState: { errors: apiConfigErrors },
  } = useForm<ApiConfigFormData>({
    resolver: zodResolver(apiConfigSchema),
    defaultValues: {
      name: "",
      provider: "claude",
      apiKey: "",
    },
  });

  // Add new form for agent configuration
  const {
    register: registerAgentConfig,
    handleSubmit: handleSubmitAgentConfig,
    reset: resetAgentConfig,
    formState: { errors: agentConfigErrors },
  } = useForm<AgentConfigFormData>({
    resolver: zodResolver(agentConfigSchema),
    defaultValues: {
      recallApiKey: "",
      elevenlabsKey: "",
      pineconeApiKey: "",
      pineconeIndexName: "",
      agentId: "",
    },
  });

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
    fetchSettings();
    fetchAgentConfig();
    fetchStripeConfig();
    fetchProducts();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/system-settings`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      reset({
        threshold:
          response.data.settings.find((s) => s.setting_key === "threshold")
            ?.setting_value || 0,
      });

      if (response.data.apiConfigs) {
        setApiConfigs(response.data.apiConfigs);
      }
    } catch (error) {
      toast.error("Failed to load system settings");
    } finally {
      setIsLoading(false);
    }
  };

  // Add new function to fetch agent configuration
  const fetchAgentConfig = async () => {
    setIsAgentConfigLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/system-settings/agent-config`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        const config = response.data.agentConfig;
        setAgentConfig(config);

        // Update form values
        resetAgentConfig({
          recallApiKey: config.recallApiKey,
          elevenlabsKey: config.elevenlabsKey,
          pineconeApiKey: config.pineconeApiKey,
          pineconeIndexName: config.pineconeIndexName,
          agentId: config.agentId,
        });
      }
    } catch (error) {
      toast.error("Failed to fetch Agent configuration");
      console.error(error);
    } finally {
      setIsAgentConfigLoading(false);
    }
  };

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
    } finally {
      setIsStripeConfigLoading(false);
    }
  };

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/products`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setProducts(response.data.products);
      }
    } catch (error) {
      toast.error("Failed to load products");
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const onSubmit = async (data: SystemSettingsFormData) => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem("token");
      const result = await axios.put<ApiResponse>(
        `${import.meta.env.VITE_API_BASE_URL}/system-settings`,
        { threshold: data.threshold },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (result.data.success === true) {
        toast.success(result.data.message);
        reset({
          threshold: data.threshold,
        });
      }
    } catch (error) {
      toast.error("Failed to update system settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddApiConfig = () => {
    setEditingConfig(null);
    resetApiConfig({
      name: "",
      provider: "claude",
      apiKey: "",
    });
    setShowModal(true);
  };

  const handleEditApiConfig = (config: ApiConfig) => {
    setEditingConfig(config);
    resetApiConfig({
      id: config.id,
      name: config.name,
      provider: config.provider,
      apiKey: config.apiKey,
    });
    setShowModal(true);
  };

  const handleDeleteApiConfig = async (id?: string) => {
    if (!id) return;

    try {
      const token = localStorage.getItem("token");
      const result = await axios.delete<ApiResponse>(
        `${import.meta.env.VITE_API_BASE_URL}/system-settings/api-config/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (result.data.success) {
        toast.success("API configuration deleted successfully");
        setApiConfigs(apiConfigs.filter((config) => config.id !== id));
      }
    } catch (error) {
      toast.error("Failed to delete API configuration");
    }
  };

  const onSubmitApiConfig = async (data: ApiConfigFormData) => {
    try {
      const token = localStorage.getItem("token");
      const endpoint = editingConfig
        ? `${import.meta.env.VITE_API_BASE_URL}/system-settings/api-config/${
            data.id
          }`
        : `${import.meta.env.VITE_API_BASE_URL}/system-settings/api-config`;

      const method = editingConfig ? axios.put : axios.post;

      const result = await method<ApiResponse>(endpoint, data, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (result.data.success) {
        toast.success(
          editingConfig
            ? "API configuration updated successfully"
            : "API configuration added successfully"
        );

        if (editingConfig) {
          setApiConfigs(
            apiConfigs.map((config) =>
              config.id === data.id ? { ...data } : config
            )
          );
        } else if (result.data.apiConfig) {
          setApiConfigs([...apiConfigs, result.data.apiConfig]);
        }

        setShowModal(false);
      }
    } catch (error) {
      toast.error(
        editingConfig
          ? "Failed to update API configuration"
          : "Failed to add API configuration"
      );
    }
  };

  // Add new function to handle agent configuration submission
  const onSubmitAgentConfig = async (data: AgentConfigFormData) => {
    setIsSavingAgentConfig(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put<ApiResponse>(
        `${import.meta.env.VITE_API_BASE_URL}/system-settings/agent-config`,
        data,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        setAgentConfig(data);
      }
    } catch (error) {
      toast.error("Failed to update Agent configuration");
      console.error(error);
    } finally {
      setIsSavingAgentConfig(false);
    }
  };

  const onSubmitStripeConfig = async (data: StripeConfigFormData) => {
    setIsSavingStripeConfig(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put<ApiResponse>(
        `${import.meta.env.VITE_API_BASE_URL}/system-settings/stripe-config`,
        data,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        setStripeConfig(data);
      }
    } catch (error) {
      toast.error("Failed to update Stripe configuration");
      console.error(error);
    } finally {
      setIsSavingStripeConfig(false);
    }
  };

  const toggleEnvironment = async () => {
    const newEnvironment = stripeConfig.environment === "production" ? "sandbox" : "production";

    try {
      const token = localStorage.getItem("token");
      const response = await axios.put<ApiResponse>(
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

  const toggleProductStatus = (id: string, currentStatus: boolean) => {
    setProducts(products.map(product =>
      product.id === id ? { ...product, is_enabled: !currentStatus } : product
    ));
  };

  const handleEditProduct = (product: StripeProduct) => {
    setEditingProduct({
      ...product,
      features: [...product.features]
    });
  };

  const handleUpdateProduct = () => {
    if (!editingProduct) return;

    setProducts(products.map(product =>
      product.id === editingProduct.id ? editingProduct : product
    ));

    setEditingProduct(null);
  };

  const handleCreateProduct = () => {
    const newId = (Math.max(...products.map(p => parseInt(p.id))) + 1).toString();

    const createdProduct: StripeProduct = {
      id: newId,
      name: newProduct.name,
      description: newProduct.description,
      price: newProduct.price,
      interval: newProduct.interval,
      is_enabled: true,
      features: newProduct.features.filter(f => f.trim() !== "")
    };

    setProducts([...products, createdProduct]);

    setNewProduct({
      name: "",
      description: "",
      price: 0,
      interval: "month",
      features: [""]
    });
    setIsCreatingProduct(false);
  };

  const handleDeleteProduct = (id: string) => {
    if (!confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
      return;
    }

    setProducts(products.filter(product => product.id !== id));
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 flex-1 overflow-y-auto">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">System Settings</h1>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="agent">My Agent Config</TabsTrigger>
            <TabsTrigger value="api">API Config</TabsTrigger>
            <TabsTrigger value="stripe">Stripe</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Threshold Setting */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Threshold Value
                </label>
                <input
                  type="number"
                  {...register("threshold", {
                    valueAsNumber: true,
                    required: "Threshold is required",
                    min: { value: 0, message: "Threshold must be positive" },
                  })}
                  className="w-full p-2 border rounded-lg"
                  min="0"
                  step="1"
                />
                {errors.threshold && (
                  <p className="text-red-500 text-sm">{errors.threshold.message}</p>
                )}
                <p className="text-xs text-gray-500">
                  Enter the threshold value for the system
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Settings
                    </>
                  )}
                </button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="agent" className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">My Agent Configuration</h2>
              <p className="text-sm text-gray-600 mb-6">
                Configure your AI agent's API keys and settings
              </p>

              {isAgentConfigLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <form onSubmit={handleSubmitAgentConfig(onSubmitAgentConfig)} className="space-y-6">
                  {/* Recall API Key */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Recall API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showAgentSecretKeys.recall ? "text" : "password"}
                        {...registerAgentConfig("recallApiKey")}
                        className="w-full p-2 border rounded-lg pr-10"
                        placeholder="Enter your Recall API key"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAgentSecretKeys(prev => ({ ...prev, recall: !prev.recall }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showAgentSecretKeys.recall ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {agentConfigErrors.recallApiKey && (
                      <p className="text-red-500 text-sm">{agentConfigErrors.recallApiKey.message}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      API key for Recall service integration
                    </p>
                  </div>

                  {/* ElevenLabs Key */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      ElevenLabs API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showAgentSecretKeys.elevenlabs ? "text" : "password"}
                        {...registerAgentConfig("elevenlabsKey")}
                        className="w-full p-2 border rounded-lg pr-10"
                        placeholder="Enter your ElevenLabs API key"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAgentSecretKeys(prev => ({ ...prev, elevenlabs: !prev.elevenlabs }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showAgentSecretKeys.elevenlabs ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {agentConfigErrors.elevenlabsKey && (
                      <p className="text-red-500 text-sm">{agentConfigErrors.elevenlabsKey.message}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      API key for ElevenLabs voice synthesis
                    </p>
                  </div>

                  {/* Pinecone API Key */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Pinecone API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showAgentSecretKeys.pinecone ? "text" : "password"}
                        {...registerAgentConfig("pineconeApiKey")}
                        className="w-full p-2 border rounded-lg pr-10"
                        placeholder="Enter your Pinecone API key"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAgentSecretKeys(prev => ({ ...prev, pinecone: !prev.pinecone }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showAgentSecretKeys.pinecone ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {agentConfigErrors.pineconeApiKey && (
                      <p className="text-red-500 text-sm">{agentConfigErrors.pineconeApiKey.message}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      API key for Pinecone vector database
                    </p>
                  </div>

                  {/* Pinecone Index Name */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Pinecone Index Name
                    </label>
                    <input
                      type="text"
                      {...registerAgentConfig("pineconeIndexName")}
                      className="w-full p-2 border rounded-lg"
                      placeholder="Enter your Pinecone index name"
                    />
                    {agentConfigErrors.pineconeIndexName && (
                      <p className="text-red-500 text-sm">{agentConfigErrors.pineconeIndexName.message}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      Name of your Pinecone index for vector storage
                    </p>
                  </div>

                    {/* Agent ID */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Agent ID
                      </label>
                      <input
                        type="text"
                        {...registerAgentConfig("agentId")}
                        className="w-full p-2 border rounded-lg"
                        placeholder="Enter your Agent ID"
                      />
                      {agentConfigErrors.agentId && (
                        <p className="text-red-500 text-sm">{agentConfigErrors.agentId.message}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        ID of your ElevenLabs agent
                      </p>
                    </div>

                  {/* Submit Button */}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingAgentConfig}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
                    >
                      {isSavingAgentConfig ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Agent Config
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            {/* API Configurations Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">API Configurations</h2>
                <button
                  onClick={handleAddApiConfig}
                  className="bg-green-600 text-white px-3 py-1 rounded-lg flex items-center gap-1 hover:bg-green-700"
                >
                  <Plus className="h-4 w-4" />
                  Add API
                </button>
              </div>

              {apiConfigs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No API configurations added yet. Click the "Add API" button to add one.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  {/* Desktop view */}
                  <div className="hidden md:block">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Provider
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {apiConfigs.map((config) => (
                          <tr key={config.id}>
                            <td
                              className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                              onClick={() => handleConfigNameClick(config)}
                            >
                              {config.name}
                            </td>

                            <ModelManagementModal
                              isOpen={showModelModal}
                              onClose={() => setShowModelModal(false)}
                              config={selectedConfig}
                              onConfigUpdate={(updatedConfig) => {
                                // Update your configs state here with the new config
                                setApiConfigs(
                                  apiConfigs.map((c) =>
                                    c.id === updatedConfig.id ? updatedConfig : c
                                  )
                                );
                                setSelectedConfig(updatedConfig)
                              }}
                            />
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {AI_MODELS.find((m) => m.id === config.provider)
                                ?.name || config.provider}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex gap-2">
                              <button
                                onClick={() => handleEditApiConfig(config)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteApiConfig(config.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        </tbody>
                      </table>
                    </div>

                  {/* Mobile view */}
                  <div className="md:hidden">
                    {apiConfigs.map((config) => (
                      <div key={config.id} className="border-b border-gray-200 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-medium text-gray-900" onClick={() => handleConfigNameClick(config)}>
                              {config.name}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                              {AI_MODELS.find((m) => m.id === config.provider)
                                ?.name || config.provider}
                            </p>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleEditApiConfig(config)}
                              className="text-blue-600 hover:text-blue-800 p-2"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteApiConfig(config.id)}
                              className="text-red-600 hover:text-red-800 p-2"
                            >
                              <Trash className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="stripe">
            {/* Stripe Configuration can be moved here */}
            <StripeConfiguration />
          </TabsContent>
        </Tabs>
      </div>

      {/* API Configuration Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              {editingConfig
                ? "Edit API Configuration"
                : "Add API Configuration"}
            </h2>
            <form
              onSubmit={handleSubmitApiConfig(onSubmitApiConfig)}
              className="space-y-4"
            >
              {editingConfig && (
                <input
                  type="hidden"
                  {...registerApiConfig("id")}
                  defaultValue={editingConfig.id}
                />
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  {...registerApiConfig("name")}
                  className="w-full p-2 border rounded-lg"
                  placeholder="My API Configuration"
                />
                {apiConfigErrors.name && (
                  <p className="text-red-500 text-sm mt-1">
                    {apiConfigErrors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provider
                </label>
                <select
                  {...registerApiConfig("provider")}
                  className="w-full p-2 border rounded-lg bg-white"
                >
                  {AI_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
                {apiConfigErrors.provider && (
                  <p className="text-red-500 text-sm mt-1">
                    {apiConfigErrors.provider.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    {...registerApiConfig("apiKey")}
                    className="w-full p-2 border rounded-lg pr-10"
                    placeholder="Enter your API key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showApiKey ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {apiConfigErrors.apiKey && (
                  <p className="text-red-500 text-sm mt-1">
                    {apiConfigErrors.apiKey.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingConfig ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
