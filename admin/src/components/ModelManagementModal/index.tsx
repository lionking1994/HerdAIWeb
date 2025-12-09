import React, { useState } from "react";
import { Save, Plus, Trash, Edit, X } from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { ModelForm } from "./ModelForm";

interface ModelConfig {
  id: number;
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

interface ModelManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ApiConfig | null;
  onConfigUpdate: (updatedConfig: ApiConfig) => void;
}

export function ModelManagementModal({
  isOpen,
  onClose,
  config,
  onConfigUpdate,
}: ModelManagementModalProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleModelOperation = async (
    operation: "add" | "update" | "delete",
    modelData?: ModelConfig
  ) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      let endpoint = `${
        import.meta.env.VITE_API_BASE_URL
      }/system-settings/api-config/${config?.id}/models`;
      let method =
        operation === "add"
          ? "post"
          : operation === "update"
          ? "put"
          : "delete";

      if (operation === "update" || operation === "delete") {
        endpoint += `/${modelData?.id}`;
      }
      console.log("modelData", modelData);
      console.log("endpoint", endpoint);

      const result =
        operation === "delete"
          ? await axios.delete(endpoint, {
              headers: { Authorization: `Bearer ${token}` },
            })
          : operation === "add"
          ? await axios.post(endpoint, modelData, {
              headers: { Authorization: `Bearer ${token}` },
            })
          : await axios.put(endpoint, modelData, {
              headers: { Authorization: `Bearer ${token}` },
            });

      if (result.data.success) {
        toast.success(`Model ${operation}d successfully`);
        // Refresh the config data
        const updatedConfig = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/system-settings/api-config/${
            config?.id
          }`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        onConfigUpdate(updatedConfig.data.apiConfig);
        if (operation !== "delete") {
          setIsFormOpen(false);
        }
      }
    } catch (error) {
      toast.error(`Failed to ${operation} model`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (model: ModelConfig) => {
    setEditingModel({
      id: model.id,
      name: model.name,
      model: model.model,
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (model: ModelConfig) => {
    await handleModelOperation("delete", model);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Models for {config?.name}</DialogTitle>
        </DialogHeader>

        {isFormOpen ? (
          <ModelForm
            model={editingModel}
            onSubmit={async (modelData) => {
              console.log("modelData", modelData);
              await handleModelOperation(
                editingModel ? "update" : "add",
                modelData as ModelConfig
              );
            }}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingModel(null);
            }}
            isLoading={isLoading}
          />
        ) : (
          <>
            <div className="mb-4">
              <Button
                onClick={() => {
                  setEditingModel(null);
                  setIsFormOpen(true);
                }}
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Model
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Model Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {config?.models?.map((model) => (
                    <tr key={model.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {model.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              handleEdit(model);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(model)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
