import React, { useEffect, useState } from "react";
import { Node, Edge } from "@xyflow/react";
import { Trash2, X, Plus, MessageSquare, Copy, Check, ChevronDown, ChevronUp, Move, ArrowUp, ArrowDown } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import McpDetailsModal from "./McpDetailsModal";
import PromptCompositionModal from "./PromptCompositionModal";
import UserSearchCombobox from "./UserSearchCombobox";
import { WorkflowUser } from "../../types";
import MultiSelectDropdown from "../ui/MultiSelectDropdown";
import { useSearchParams } from "react-router-dom";
import { workflowAPI } from "../../lib/api";
import { validateUserNodeId } from "./nodeIdGenerator";

interface FormField {
  name: string;
  type: "text" | "dropdown" | "memo" | "file" | "radio" | "signature" | "date";
  required?: boolean;
  options?: string[]; // For dropdown and radio
  placeholder?: string;
  validation?:
    | "none"
    | "email"
    | "phone"
    | "url"
    | "number"
    | "date"
    | "time"
    | "zipcode"
    | "ssn"
    | "creditcard";
  logicalId?: string;
  sourceFormLabel?: string;
  originalName?: string;
}

interface NodeData {
  label?: string;
  description?: string;
  isStartNode?: boolean;
  formFields?: FormField[];
  publicData?: boolean;
  [key: string]: unknown;
}

interface NodePropertiesPanelProps {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  onUpdateNode: (nodeId: string, newData: Record<string, unknown>) => void;
  onUpdateNodeId: (oldNodeId: string, newNodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose?: () => void;
}

// Sortable Form Field Component
interface SortableFormFieldProps {
  field: FormField;
  index: number;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  isFirst: boolean;
  isLast: boolean;
}

const SortableFormField: React.FC<SortableFormFieldProps> = ({
  field,
  index,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 border border-gray-200 rounded-lg p-2 hover:bg-gray-50 transition-colors ${
        isDragging ? 'shadow-lg border-blue-500' : ''
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded flex-shrink-0"
        title="Drag to reorder"
      >
        <Move className="w-3 h-3 text-gray-400" />
      </div>
      
      <div 
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onEdit(index)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900 truncate">
              {field.name}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span className="capitalize">{field.type}</span>
              {field.required && (
                <span className="text-red-500">• Required</span>
              )}
              {field.validation && field.validation !== "none" && (
                <span className="text-blue-500">
                  • {field.validation}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp(index);
          }}
          disabled={isFirst}
          className={`p-1 rounded transition-colors ${
            isFirst 
              ? 'text-gray-300 cursor-not-allowed' 
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          }`}
          title="Move up"
        >
          <ArrowUp className="w-3 h-3" />
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown(index);
          }}
          disabled={isLast}
          className={`p-1 rounded transition-colors ${
            isLast 
              ? 'text-gray-300 cursor-not-allowed' 
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          }`}
          title="Move down"
        >
          <ArrowDown className="w-3 h-3" />
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(index);
          }}
          className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
          title="Delete field"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

const NodePropertiesPanel: React.FC<NodePropertiesPanelProps> = ({
  node,
  nodes,
  edges,
  onUpdateNode,
  onUpdateNodeId,
  onDeleteNode,
  onClose,
}) => {
  // Email validation function
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const [description, setDescription] = useState<string>(
    (node.data?.description as string) || ""
  );
  const [publicData, setPublicData] = useState<boolean>(
    (node.data?.publicData as boolean) || false
  );
  const [isTaskThreadModalOpen, setIsTaskThreadModalOpen] = useState<boolean>(false);

  // Helper to collect upstream form fields for the current node
  const getUpstreamFormFieldsForCurrentNode = (): FormField[] => {
    const upstreamFormFields: FormField[] = [];
    const findUpstreamNodes = (
      currentNodeId: string,
      visited: Set<string> = new Set()
    ): string[] => {
      if (visited.has(currentNodeId)) return [];
      visited.add(currentNodeId);
      const upstreamNodeIds: string[] = [];
      edges.forEach((edge) => {
        if (edge.target === currentNodeId && edge.source) {
          upstreamNodeIds.push(edge.source);
          const furtherUpstream = findUpstreamNodes(edge.source, visited);
          upstreamNodeIds.push(...furtherUpstream);
        }
      });
      return upstreamNodeIds;
    };
    const upstreamNodeIds = findUpstreamNodes(node.id);
    upstreamNodeIds.forEach((nodeId) => {
      const upstreamNode = nodes.find((n) => n.id === nodeId);
      if (upstreamNode && upstreamNode.type === "formNode") {
        const formFields = upstreamNode.data?.formFields as FormField[];
        const logicalId =
          (upstreamNode.data?.logicalId as string) || upstreamNode.id;
        const formLabel =
          (upstreamNode.data?.label as string) ||
          (upstreamNode.data?.name as string) ||
          "";
        if (formFields && Array.isArray(formFields)) {
          formFields.forEach((field) => {
            upstreamFormFields.push({
              ...field,
              name: logicalId ? `${logicalId}.${field.name}` : field.name,
              logicalId,
              sourceFormLabel: formLabel || undefined,
              originalName: field.name,
            });
          });
        }
      }
      if (upstreamNode && upstreamNode.type === "promptNode") {
        const logicalId =
          (upstreamNode.data?.logicalId as string) || upstreamNode.id;
        // Expose previous prompt node result as a tag
        upstreamFormFields.push({
          name: `${logicalId}.result`,
          type: "text",
          logicalId,
          sourceFormLabel: (upstreamNode.data?.label as string) || undefined,
        });
      }
    });
    return upstreamFormFields;
  };
  const [publicLink, setPublicLink] = useState<string>("");
  const [isLinkCopied, setIsLinkCopied] = useState<boolean>(false);
  const [isHtmlCopied, setIsHtmlCopied] = useState<boolean>(false);
  const [isPublicFormExpanded, setIsPublicFormExpanded] = useState<boolean>(false);
  const [isEmailConfigExpanded, setIsEmailConfigExpanded] = useState<boolean>(false);
  const [isEmailNotificationExpanded, setIsEmailNotificationExpanded] = useState<boolean>(false);
  const [isApplicationNotificationExpanded, setIsApplicationNotificationExpanded] = useState<boolean>(false);
  const [isMcpModalOpen, setIsMcpModalOpen] = useState<boolean>(false);
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] =
    useState<boolean>(false);
  const [isEditFieldModalOpen, setIsEditFieldModalOpen] =
    useState<boolean>(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState<boolean>(false);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number>(-1);
  const [newFieldData, setNewFieldData] = useState<Partial<FormField>>({
    name: "",
    type: "text",
    required: false,
    placeholder: "",
    options: [],
    validation: "none",
  });
  const [editFieldData, setEditFieldData] = useState<Partial<FormField>>({
    name: "",
    type: "text",
    required: false,
    placeholder: "",
    options: [],
    validation: "none",
  });

  // Logical ID edit state (user-friendly id like form1)
  const [nodeIdInput, setNodeIdInput] = useState<string>(
    (node.data?.logicalId as string) || ""
  );
  const [nodeIdError, setNodeIdError] = useState<string | null>(null);
  const [isFormFieldsExpanded, setIsFormFieldsExpanded] = useState<boolean>(true);
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setNodeIdInput((node.data?.logicalId as string) || "");
    setNodeIdError(null);
  }, [node.id, node.data]);

  // Initialize default API and model for prompt nodes
  useEffect(() => {
    if (node.type === "promptNode") {
      const currentApi = node.data?.api as string;
      const currentModel = node.data?.model as string;
      
      // Set defaults if not already set
      if (!currentApi && !currentModel) {
        onUpdateNode(node.id, { 
          api: "openai", 
          model: "gpt-4" 
        });
      } else if (!currentApi) {
        // Only API is missing
        onUpdateNode(node.id, { api: "openai" });
      } else if (!currentModel) {
        // Only model is missing - set default model for selected API
        const defaultModels: Record<string, string> = {
          openai: "gpt-4",
          anthropic: "claude-sonnet-4",
          perplexity: "sonar-pro",
        };
        onUpdateNode(node.id, { 
          model: defaultModels[currentApi] || "gpt-4" 
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, node.type]);

  // Generate public link if public data is enabled
  useEffect(() => {
    if (publicData && !publicLink) {
      const existingPublicLinkId = node.data?.publicLinkId as string;
      if (existingPublicLinkId) {
        // Use existing publicLinkId
        const baseUrl = 'https://app.getherd.ai';
        const publicFormUrl = `${baseUrl}/public/form?magic_token=${existingPublicLinkId}`;
        setPublicLink(publicFormUrl);
      } else {
        // Generate new publicLinkId
        generatePublicLink();
      }
    }
  }, [publicData, publicLink, node.data?.publicLinkId]);

  const tryUpdateNodeId = () => {
    const trimmed = (nodeIdInput || "").trim();
    if (trimmed === (node.data?.logicalId as string)) {
      setNodeIdError(null);
      return;
    }
    const validation = validateUserNodeId(trimmed, nodes, node.id);
    if (!validation.isValid) {
      setNodeIdError(validation.error || "Invalid logical ID");
      return;
    }
    try {
      onUpdateNodeId(node.id, trimmed);
      setNodeIdError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update logical ID";
      setNodeIdError(message);
    }
  };

  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLabel = event.target.value;
    onUpdateNode(node.id, { label: newLabel });
  };

  const handleDescriptionChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDescription(event.target.value);
    onUpdateNode(node.id, { description: event.target.value });
  };

  const handlePublicDataChange = () => {
    const newPublicData = !publicData;
    setPublicData(newPublicData);
    
    if (newPublicData) {
      // If enabling public data, check if we already have a publicLinkId
      const existingPublicLinkId = node.data?.publicLinkId as string;
      if (existingPublicLinkId) {
        // Use existing publicLinkId and regenerate the link
        onUpdateNode(node.id, { publicData: newPublicData });
        const baseUrl = 'https://app.getherd.ai';
        const publicFormUrl = `${baseUrl}/public/form?magic_token=${existingPublicLinkId}`;
        setPublicLink(publicFormUrl);
      } else {
        // Generate new publicLinkId
        generatePublicLink();
      }
    } else {
      // When disabling public data, clear the publicLinkId and link
      onUpdateNode(node.id, { 
        publicData: newPublicData,
        publicLinkId: undefined 
      });
      setPublicLink("");
    }
  };

  const generatePublicLink = () => {
    // Generate a random ID for the public form link
    const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Update the node with both publicData and publicLinkId
    onUpdateNode(node.id, { 
      publicData: true,
      publicLinkId: randomId 
    });
    
    // Generate the public form URL with the random ID
    const baseUrl = 'https://app.getherd.ai';
    const publicFormUrl = `${baseUrl}/public/form?magic_token=${randomId}`;
    setPublicLink(publicFormUrl);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      setIsLinkCopied(true);
      setTimeout(() => setIsLinkCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = publicLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setIsLinkCopied(true);
      setTimeout(() => setIsLinkCopied(false), 2000);
    }
  };

  const copyHtmlToClipboard = async () => {
    const htmlCode = `<iframe src="${publicLink}" width="100%" height="600" frameborder="0" style="border: 1px solid #ccc; border-radius: 8px;"></iframe>`;
    try {
      await navigator.clipboard.writeText(htmlCode);
      setIsHtmlCopied(true);
      setTimeout(() => setIsHtmlCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy HTML:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = htmlCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setIsHtmlCopied(true);
      setTimeout(() => setIsHtmlCopied(false), 2000);
    }
  };
  const handleDelete = () => {
    onDeleteNode(node.id);
  };

  const [searchParams] = useSearchParams();
  const companyId = searchParams.get("company") || "";

  const [userOptions, setUserOptions] = useState<
    {
      label: string;
      options: { label: string; value: string; email: string }[];
    }[]
  >([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await workflowAPI.getAllUserBycompanyId(companyId);

        const users =
          response?.users?.map(
            (user: {
              user_name: string;
              user_email: string;
              user_id: string;
            }) => ({
              label: `${user?.user_name}`,
              value: user?.user_id,
              email: user?.user_email,
            })
          ) || [];

        setUserOptions([
          {
            label: "Company Users",
            options: users,
          },
        ]);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();
  }, [companyId]);

  const renderTriggerProperties = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Type
        </label>
        <select
          value={(node.data?.triggerSelectType as string) || ""}
          onChange={(e) => {
            const selectedType = e.target.value;
            if (selectedType === "node") {
              onUpdateNode(node.id, {
                triggerSelectType: selectedType,
                selectNode: "opportunity",
                table: "",
              });
            } else {
              onUpdateNode(node.id, {
                triggerSelectType: selectedType,
                selectNode: "",
              });
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Type</option>
          <option value="table">Table</option>
          <option value="node">Node</option>
        </select>
      </div>
      {node.data?.triggerSelectType === "node" && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Node
            </label>
            <select
              value={(node.data?.selectNode as string) || ""}
              onChange={(e) =>
                onUpdateNode(node.id, { selectNode: e.target.value, table: "" })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Node</option>
              <option value="account">Account</option>
              <option value="contact">Contact</option>
              <option value="opportunity">Opportunity</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action
            </label>
            <select
              value={(node.data?.triggerType as string) || ""}
              onChange={(e) =>
                onUpdateNode(node.id, { triggerType: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Action</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>
          </div>
        </>
      )}
      {node.data?.triggerSelectType === "table" && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Table
            </label>
            <select
              value={(node.data?.table as string) || ""}
              onChange={(e) =>
                onUpdateNode(node.id, { table: e.target.value, selectNode: "" })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Table</option>
              <option value="Meeting">Meeting</option>
              <option value="Task">Task</option>
              <option value="User">User</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action
            </label>
            <select
              value={(node.data?.triggerType as string) || ""}
              onChange={(e) =>
                onUpdateNode(node.id, { triggerType: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Action</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>
          </div>
        </>
      )}
    </div>
  );

  const renderFormProperties = () => {
    const formFields = (node.data?.formFields as FormField[]) || [];

    // Drag and drop handlers
    const handleDragEnd = (event: any) => {
      const { active, over } = event;

      if (active.id !== over.id) {
        const oldIndex = formFields.findIndex((field) => field.name === active.id);
        const newIndex = formFields.findIndex((field) => field.name === over.id);
        
        const newFields = arrayMove(formFields, oldIndex, newIndex);
        onUpdateNode(node.id, { formFields: newFields });
      }
    };

    const moveFieldUp = (index: number) => {
      if (index > 0) {
        const newFields = [...formFields];
        [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
        onUpdateNode(node.id, { formFields: newFields });
      }
    };

    const moveFieldDown = (index: number) => {
      if (index < formFields.length - 1) {
        const newFields = [...formFields];
        [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
        onUpdateNode(node.id, { formFields: newFields });
      }
    };

    const addFormField = () => {
      // Validate the new field data
      if (!newFieldData.name?.trim()) {
        alert("Please enter a field name");
        return;
      }

      // Check if field name already exists
      if (
        formFields.some(
          (field) =>
            field.name.toLowerCase() === newFieldData.name?.toLowerCase()
        )
      ) {
        alert("A field with this name already exists");
        return;
      }

      const newField: FormField = {
        name: newFieldData.name.trim(),
        type: newFieldData.type || "text",
        required: newFieldData.required || false,
        placeholder: newFieldData.placeholder || "",
        options: newFieldData.options || [],
        validation: newFieldData.validation || "none",
      };

      const newFields = [...formFields, newField];
      onUpdateNode(node.id, { formFields: newFields });

      // Reset form and close modal
      setNewFieldData({
        name: "",
        type: "text",
        required: false,
        placeholder: "",
        options: [],
        validation: "none",
      });
      setIsAddFieldModalOpen(false);
    };

    // const updateFormField = (index: number, value: FormField) => {
    //   const newFields = [...formFields];
    //   newFields[index] = value;
    //   onUpdateNode(node.id, { formFields: newFields });
    // };

    const removeFormField = (index: number) => {
      const newFields = formFields.filter((_, i) => i !== index);
      onUpdateNode(node.id, { formFields: newFields });
    };

    const handleNewFieldTypeChange = (type: FormField["type"]) => {
      setNewFieldData((prev) => ({
        ...prev,
        type,
        // Reset options if switching away from dropdown/radio
        options: type === "dropdown" || type === "radio" ? prev.options : [],
      }));
    };

    const handleNewFieldOptionsChange = (optionsText: string) => {
      const options = optionsText.split("\n").filter((option) => option.trim());
      setNewFieldData((prev) => ({ ...prev, options }));
    };

    const openEditFieldModal = (index: number) => {
      const field = formFields[index];
      setEditFieldData({
        name: field.name,
        type: field.type,
        required: field.required || false,
        placeholder: field.placeholder || "",
        options: field.options || [],
        validation: field.validation || "none",
      });
      setEditingFieldIndex(index);
      setIsEditFieldModalOpen(true);
    };

    const saveEditField = () => {
      if (!editFieldData.name?.trim()) {
        alert("Please enter a field name");
        return;
      }

      // Check if field name already exists (excluding current field)
      const otherFields = formFields.filter((_, i) => i !== editingFieldIndex);
      if (
        otherFields.some(
          (field) =>
            field.name.toLowerCase() === editFieldData.name?.toLowerCase()
        )
      ) {
        alert("A field with this name already exists");
        return;
      }

      const updatedField: FormField = {
        name: editFieldData.name.trim(),
        type: editFieldData.type || "text",
        required: editFieldData.required || false,
        placeholder: editFieldData.placeholder || "",
        options: editFieldData.options || [],
        validation: editFieldData.validation || "none",
      };

      const newFields = [...formFields];
      newFields[editingFieldIndex] = updatedField;
      onUpdateNode(node.id, { formFields: newFields });

      // Reset and close modal
      setEditFieldData({
        name: "",
        type: "text",
        required: false,
        placeholder: "",
        options: [],
        validation: "none",
      });
      setEditingFieldIndex(-1);
      setIsEditFieldModalOpen(false);
    };

    const handleEditFieldTypeChange = (type: FormField["type"]) => {
      setEditFieldData((prev) => ({
        ...prev,
        type,
        // Reset options if switching away from dropdown/radio
        options: type === "dropdown" || type === "radio" ? prev.options : [],
      }));
    };

    const handleEditFieldOptionsChange = (optionsText: string) => {
      const options = optionsText.split("\n").filter((option) => option.trim());
      setEditFieldData((prev) => ({ ...prev, options }));
    };

    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setIsFormFieldsExpanded(!isFormFieldsExpanded)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              {isFormFieldsExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
              Form Fields
              <span className="text-xs text-gray-500">({formFields.length})</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddFieldModalOpen(true)}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Field
              </button>
            </div>
          </div>

          {isFormFieldsExpanded && (
            <>
              {formFields.length === 0 ? (
                <div className="text-sm text-gray-500 italic py-4 text-center border-2 border-dashed border-gray-300 rounded-lg">
                  No form fields added yet. Click "Add Field" to get started.
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={formFields.map(field => field.name)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {formFields.map((field, index) => (
                        <SortableFormField
                          key={field.name}
                          field={field}
                          index={index}
                          onEdit={openEditFieldModal}
                          onDelete={removeFormField}
                          onMoveUp={moveFieldUp}
                          onMoveDown={moveFieldDown}
                          isFirst={index === 0}
                          isLast={index === formFields.length - 1}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </>
          )}
        </div>

        {/* Add Field Modal */}
        {isAddFieldModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Add Form Field
                </h3>
                <button
                  onClick={() => setIsAddFieldModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Field Name *
                  </label>
                  <input
                    type="text"
                    value={newFieldData.name}
                    onChange={(e) =>
                      setNewFieldData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter field name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Field Type
                  </label>
                  <select
                    value={newFieldData.type}
                    onChange={(e) =>
                      handleNewFieldTypeChange(
                        e.target.value as FormField["type"]
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="text">Text</option>
                    <option value="date">Date Picker</option>
                    <option value="dropdown">Dropdown</option>
                    <option value="memo">Memo</option>
                    <option value="file">File</option>
                    <option value="radio">Radio</option>
                    <option value="signature">Signature</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newFieldData.required || false}
                      onChange={(e) =>
                        setNewFieldData((prev) => ({
                          ...prev,
                          required: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Required field
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Validation
                  </label>
                  <select
                    value={newFieldData.validation || "none"}
                    onChange={(e) =>
                      setNewFieldData((prev) => ({
                        ...prev,
                        validation: e.target.value as FormField["validation"],
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="none">No Validation</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="url">URL</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="time">Time</option>
                    <option value="zipcode">Zip Code</option>
                    <option value="ssn">SSN</option>
                    <option value="creditcard">Credit Card</option>
                  </select>
                </div>

                {/* Placeholder for text/memo fields */}
                {(newFieldData.type === "text" ||
                  newFieldData.type === "memo") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Placeholder Text
                    </label>
                    <input
                      type="text"
                      value={newFieldData.placeholder || ""}
                      onChange={(e) =>
                        setNewFieldData((prev) => ({
                          ...prev,
                          placeholder: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter placeholder text (optional)"
                    />
                  </div>
                )}

                {/* Options for dropdown and radio fields */}
                {(newFieldData.type === "dropdown" ||
                  newFieldData.type === "radio") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {newFieldData.type === "dropdown" ? "Dropdown" : "Radio"}{" "}
                      Options
                    </label>
                    <textarea
                      value={(newFieldData.options || []).join("\n")}
                      onChange={(e) =>
                        handleNewFieldOptionsChange(e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={4}
                      placeholder={`Enter options, one per line:&#10;Option 1&#10;Option 2&#10;Option 3`}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter each option on a new line
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsAddFieldModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addFormField}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Add Field
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Field Modal */}
        {isEditFieldModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Form Field
                </h3>
                <button
                  onClick={() => setIsEditFieldModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Field Name *
                  </label>
                  <input
                    type="text"
                    value={editFieldData.name}
                    onChange={(e) =>
                      setEditFieldData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter field name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Field Type
                  </label>
                  <select
                    value={editFieldData.type}
                    onChange={(e) =>
                      handleEditFieldTypeChange(
                        e.target.value as FormField["type"]
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="text">Text</option>
                    <option value="date">Date Picker</option>
                    <option value="dropdown">Dropdown</option>
                    <option value="memo">Memo</option>
                    <option value="file">File</option>
                    <option value="radio">Radio</option>
                    <option value="signature">Signature</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editFieldData.required || false}
                      onChange={(e) =>
                        setEditFieldData((prev) => ({
                          ...prev,
                          required: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Required field
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Validation
                  </label>
                  <select
                    value={editFieldData.validation || "none"}
                    onChange={(e) =>
                      setEditFieldData((prev) => ({
                        ...prev,
                        validation: e.target.value as FormField["validation"],
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="none">No Validation</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="url">URL</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="time">Time</option>
                    <option value="zipcode">Zip Code</option>
                    <option value="ssn">SSN</option>
                    <option value="creditcard">Credit Card</option>
                  </select>
                </div>

                {/* Placeholder for text/memo fields */}
                {(editFieldData.type === "text" ||
                  editFieldData.type === "memo") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Placeholder Text
                    </label>
                    <input
                      type="text"
                      value={editFieldData.placeholder || ""}
                      onChange={(e) =>
                        setEditFieldData((prev) => ({
                          ...prev,
                          placeholder: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter placeholder text (optional)"
                    />
                  </div>
                )}

                {/* Options for dropdown and radio fields */}
                {(editFieldData.type === "dropdown" ||
                  editFieldData.type === "radio") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {editFieldData.type === "dropdown" ? "Dropdown" : "Radio"}{" "}
                      Options
                    </label>
                    <textarea
                      value={(editFieldData.options || []).join("\n")}
                      onChange={(e) =>
                        handleEditFieldOptionsChange(e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={4}
                      placeholder={`Enter options, one per line:&#10;Option 1&#10;Option 2&#10;Option 3`}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter each option on a new line
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsEditFieldModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditField}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderApprovalProperties = () => {
    // Parse existing approvers data - handle both old string array format and new object format
    const existingApprovers =
      (node.data?.approvers as Array<string | WorkflowUser>) || [];
    const selectedUsers = existingApprovers
      .map((approver) => {
        if (typeof approver === "string") {
          // Handle old format where approvers were just email strings
          return { id: 0, name: approver, email: approver };
        }
        return approver;
      })
      .filter((user) => user.id !== 0); // Filter out old format entries

    const handleApproversChange = (users: WorkflowUser[]) => {
      onUpdateNode(node.id, { approvers: users });
    };

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Approvers
          </label>
          <UserSearchCombobox
            selectedUsers={selectedUsers}
            onUsersChange={handleApproversChange}
            placeholder="Search for users to add as approvers..."
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            Search and select users from the database to assign as approvers for
            this workflow step.
          </p>
        </div>
      </div>
    );
  };

  const renderConditionProperties = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Field
        </label>
        <input
          type="text"
          value={(node.data?.field as string) || ""}
          onChange={(e) => onUpdateNode(node.id, { field: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Select field in flow"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Operator
        </label>
        <select
          value={(node.data?.operator as string) || ""}
          onChange={(e) => onUpdateNode(node.id, { operator: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Operator</option>
          <option value="=">=</option>
          <option value="!=">!=</option>
          <option value="&gt;">&gt;</option>
          <option value="&lt;">&lt;</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Value
        </label>
        <input
          type="text"
          value={(node.data?.value as string) || ""}
          onChange={(e) => onUpdateNode(node.id, { value: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter value"
        />
      </div>
    </div>
  );

  const renderUpdateProperties = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Update Type
        </label>
        <select
          value={(node.data?.updateType as string) || ""}
          onChange={(e) =>
            onUpdateNode(node.id, { updateType: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Update Type</option>
          <option value="task">Task Thread</option>
          <option value="database">Database</option>
        </select>
      </div>

      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="usePreviousNodeData"
          checked={(node.data?.usePreviousNodeData as boolean) ?? true}
          onChange={(e) =>
            onUpdateNode(node.id, { usePreviousNodeData: e.target.checked })
          }
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label
          htmlFor="usePreviousNodeData"
          className="text-sm font-medium text-gray-700"
        >
          Use Previous Node Data
        </label>
      </div>

      {!node.data?.usePreviousNodeData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Data Source:</strong> You can use flow variables like{" "}
            <code className="bg-blue-100 px-1 rounded">
              {"{{previousNode.fieldName}}"}
            </code>{" "}
            or{" "}
            <code className="bg-blue-100 px-1 rounded">
              {"{{workflow.fieldName}}"}
            </code>{" "}
            in the fields below.
          </p>
        </div>
      )}

      {(node.data?.usePreviousNodeData as boolean) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">
            <strong>Previous Node Data:</strong> This node will automatically
            use data from the previous node in the workflow. No additional
            configuration needed.
          </p>
        </div>
      )}

      {!node.data?.usePreviousNodeData &&
        (node.data?.updateType as string) === "task" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Field
              </label>
              <select
                value={(node.data?.taskField as string) || ""}
                onChange={(e) =>
                  onUpdateNode(node.id, { taskField: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Update Method</option>
                <option value="add-reuslt-thread">
                  Add Result To Task Thread
                </option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Task thread message
                </label>
                <button
                  onClick={() => setIsTaskThreadModalOpen(true)}
                  className="px-3 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
                >
                  <MessageSquare className="w-3 h-3" />
                  Compose Task Thread
                </button>
              </div>
              <input
                type="text"
                value={(node.data?.taskThreadMessage as string) || ""}
                onChange={(e) =>
                  onUpdateNode(node.id, { taskThreadMessage: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter task thread message (can use flow variables)"
              />
            </div>

            <PromptCompositionModal
              isOpen={isTaskThreadModalOpen}
              onClose={() => setIsTaskThreadModalOpen(false)}
              onSave={(text) => {
                onUpdateNode(node.id, { taskThreadMessage: text });
                setIsTaskThreadModalOpen(false);
              }}
              formFields={getUpstreamFormFieldsForCurrentNode()}
              initialPrompt={(node.data?.taskThreadMessage as string) || ""}
              customTitle={"Compose Task Thread Message"}
              contentLabel={"Task Thread Message"}
              placeholderText={"Use the form field tags on the left to create a dynamic task thread message. You can also type tags manually using {{fieldName}} syntax."}
              saveButtonLabel={"Save Message"}
            />
          </>
        )}

      {!node.data?.usePreviousNodeData &&
        (node.data?.updateType as string) === "database" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Table
              </label>
              <select
                value={(node.data?.table as string) || ""}
                onChange={(e) =>
                  onUpdateNode(node.id, { table: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Table</option>
                <option value="Meeting">Meeting</option>
                <option value="Task">Task</option>
                <option value="User">User</option>
                <option value="Company">Company</option>
                <option value="Product">Product</option>
                <option value="Opportunity">Opportunity</option>
                <option value="Contact">Contact</option>
                <option value="Account">Account</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Method
              </label>
              <select
                value={(node.data?.method as string) || ""}
                onChange={(e) =>
                  onUpdateNode(node.id, { method: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Method</option>
                <option value="insert">Insert</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
              </select>
            </div>
          </>
        )}
    </div>
  );

  const renderCrmUpdateProperties = () => (
    <div className="space-y-4">
      {/*}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          CRM Entity
        </label>
        <select
          value={(node.data?.crmEntity as string) || ''}
          onChange={(e) => onUpdateNode(node.id, { crmEntity: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select CRM Entity</option>
          <option value="account">Account</option>
          <option value="contact">Contact</option>
          <option value="opportunity">Opportunity</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Update Method
        </label>
        <select
          value={(node.data?.updateMethod as string) || ''}
          onChange={(e) => onUpdateNode(node.id, { updateMethod: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Update Method</option>
          <option value="create">Create New</option>
          <option value="update">Update Existing</option>
          <option value="upsert">Create or Update</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Field Mapping
        </label>
        <textarea
          value={JSON.stringify((node.data?.fieldMapping as Record<string, string>) || {}, null, 2)}
          onChange={(e) => {
            try {
              const fieldMapping = JSON.parse(e.target.value);
              onUpdateNode(node.id, { fieldMapping });
            } catch (error) {
              // Invalid JSON, don't update
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs"
          rows={6}
          placeholder='{"name": "account_name", "email": "contact_email", "phone": "contact_phone"}'
        />
        <p className="text-xs text-gray-500 mt-1">
          Map workflow variables to CRM fields. Use JSON format: crm_field: workflow_variable
        </p>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search Criteria (for updates)
        </label>
        <textarea
          value={(node.data?.searchCriteria as string) || ''}
          onChange={(e) => onUpdateNode(node.id, { searchCriteria: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          placeholder='{"field": "email", "operator": "equals", "value": "{{contact_email}}"}'
        />
        <p className="text-xs text-gray-500 mt-1">
          JSON criteria to find existing records for updates. Use workflow variables in variable_name format.
        </p>
      </div>
      */}
    </div>
  );

  //   const renderNotificationProperties = () => {

  //     const [selectedModels, setSelectedModels] = useState<string[]>([]);
  //     return (
  //     <div className="space-y-4">
  //       <div>
  //         <label className="block text-sm font-medium text-gray-700 mb-2">
  //           Type
  //         </label>
  //         <select
  //           value={(node.data?.notificationType as string) || ''}
  //           onChange={(e) => onUpdateNode(node.id, { notificationType: e.target.value })}
  //           className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  //         >
  //           <option value="">Select Type</option>
  //           <option value="email">Email</option>
  //           <option value="application">Application</option>
  //         </select>
  //       </div>

  //  <div>
  //    <label className="block text-sm font-medium text-gray-700 mb-2">
  //          Select User :
  //         </label>
  //        <MultiSelectDropdown
  //       label="Select Models"
  //       value={selectedModels}
  //       // onChange={setSelectedModels}

  //        onChange={(e) => onUpdateNode(node.id, { notificationType: e.target.value })}
  //       options={[
  //         {
  //           label: "Migrated Claude using Bedrock",
  //           options: [{ label: "Claude", value: "claude" }],
  //         },
  //         {
  //           label: "Migrated Perplexity API",
  //           options: [
  //             { label: "Sonar", value: "sonar" },
  //             { label: "Sonar Deep Research", value: "sonar-deep" },
  //           ],
  //         },
  //       ]}
  //     />
  //       </div>
  //       <div>
  //         <label className="block text-sm font-medium text-gray-700 mb-2">
  //           Title
  //         </label>
  //         <input
  //           type="text"
  //           value={(node.data?.title as string) || ''}
  //           onChange={(e) => onUpdateNode(node.id, { title: e.target.value })}
  //           className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  //           placeholder="Enter title (can use variables)"
  //         />
  //       </div>

  //       <div>
  //         <label className="block text-sm font-medium text-gray-700 mb-2">
  //           Message
  //         </label>
  //         <textarea
  //           value={(node.data?.message as string) || ''}
  //           onChange={(e) => onUpdateNode(node.id, { message: e.target.value })}
  //           className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  //           rows={4}
  //           placeholder="Enter message (can use variables)"
  //         />
  //       </div>
  //     </div>
  //   );
  //   }

  const renderNotificationProperties = () => {
    return (
      <div className="space-y-4">
        {/* Notification Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type
          </label>
          <select
            value={(node.data?.notificationType as string) || ""}
            onChange={(e) =>
              onUpdateNode(node.id, { notificationType: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Type</option>
            <option value="email">Email</option>
            <option value="application">Application</option>
          </select>
        </div>

        {/* Email Notification Fields */}
        {(node.data?.notificationType as string) === "email" && (
          <>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-gray-700">Email Configuration</h5>
              <button
                onClick={() => setIsEmailNotificationExpanded(!isEmailNotificationExpanded)}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                title={isEmailNotificationExpanded ? "Collapse" : "Expand"}
              >
                {isEmailNotificationExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
            
            {isEmailNotificationExpanded && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Addresses
                  </label>
                  <div className="w-full min-h-[80px] border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent p-2">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(node.data?.emailTags as string[])?.map((email, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-md"
                        >
                          <span>{email}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const currentTags =
                                (node.data?.emailTags as string[]) || [];
                              const newTags = currentTags.filter(
                                (_, i) => i !== index
                              );
                              onUpdateNode(node.id, { emailTags: newTags });
                            }}
                            className="text-blue-600 hover:text-blue-800 ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <input
                      type="email"
                      value={(node.data?.emailInput as string) || ""}
                      onChange={(e) =>
                        onUpdateNode(node.id, { emailInput: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          const email = (node.data?.emailInput as string)?.trim();
                          if (email && isValidEmail(email)) {
                            const currentTags =
                              (node.data?.emailTags as string[]) || [];
                            if (!currentTags.includes(email)) {
                              onUpdateNode(node.id, {
                                emailTags: [...currentTags, email],
                                emailInput: "",
                              });
                            }
                          }
                        }
                      }}
                      onBlur={() => {
                        const email = (node.data?.emailInput as string)?.trim();
                        if (email && isValidEmail(email)) {
                          const currentTags =
                            (node.data?.emailTags as string[]) || [];
                          if (!currentTags.includes(email)) {
                            onUpdateNode(node.id, {
                              emailTags: [...currentTags, email],
                              emailInput: "",
                            });
                          }
                        }
                      }}
                      className="w-full border-none outline-none text-sm"
                      placeholder="Type email address and press Enter..."
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Type email addresses and press Enter to add them. You can also
                    use workflow variables.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Title
                  </label>
                  <input
                    type="text"
                    value={(node.data?.emailTitle as string) || ""}
                    onChange={(e) =>
                      onUpdateNode(node.id, { emailTitle: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email title (can use variables)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Body
                  </label>
                  <textarea
                    value={(node.data?.emailBody as string) || ""}
                    onChange={(e) =>
                      onUpdateNode(node.id, { emailBody: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    placeholder="Enter email body (can use variables)"
                  />
                </div>
              </>
            )}
          </>
        )}

        {/* Application Notification Fields */}
        {(node.data?.notificationType as string) === "application" && (
          <>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-gray-700">Application Configuration</h5>
              <button
                onClick={() => setIsApplicationNotificationExpanded(!isApplicationNotificationExpanded)}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                title={isApplicationNotificationExpanded ? "Collapse" : "Expand"}
              >
                {isApplicationNotificationExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
            
            {isApplicationNotificationExpanded && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select User
                  </label>
                  <MultiSelectDropdown
                    label="Select Users"
                    value={(node.data?.selectedUsers as string[]) || []}
                    onChange={(newValues) =>
                      onUpdateNode(node.id, { selectedUsers: newValues })
                    }
                    options={userOptions}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notification Text
                  </label>
                  <textarea
                    value={(node.data?.notificationText as string) || ""}
                    onChange={(e) =>
                      onUpdateNode(node.id, { notificationText: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    placeholder="Enter notification text (can use variables)"
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  };

  const renderDelayProperties = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Time Period
        </label>
        <select
          value={(node.data?.timePeriod as string) || ""}
          onChange={(e) =>
            onUpdateNode(node.id, { timePeriod: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Period</option>
          <option value="minutes">Minutes</option>
          <option value="hours">Hours</option>
          <option value="days">Days</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Duration
        </label>
        <input
          type="number"
          value={(node.data?.duration as number) || ""}
          onChange={(e) =>
            onUpdateNode(node.id, { duration: parseInt(e.target.value) || 0 })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter duration"
          min="1"
        />
      </div>
    </div>
  );

  const renderWebhookProperties = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          URL
        </label>
        <input
          type="url"
          value={(node.data?.url as string) || ""}
          onChange={(e) => onUpdateNode(node.id, { url: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter webhook URL"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Method
        </label>
        <select
          value={(node.data?.method as string) || ""}
          onChange={(e) => onUpdateNode(node.id, { method: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Method</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Auth Type
        </label>
        <select
          value={(node.data?.authType as string) || ""}
          onChange={(e) => onUpdateNode(node.id, { authType: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Auth</option>
          <option value="none">None</option>
          <option value="basic">Basic Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="api-key">API Key</option>
        </select>
      </div>
    </div>
  );

  const renderApiProperties = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Endpoint
        </label>
        <input
          type="text"
          value={(node.data?.endpoint as string) || ""}
          onChange={(e) => onUpdateNode(node.id, { endpoint: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter API endpoint"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Method
        </label>
        <select
          value={(node.data?.method as string) || ""}
          onChange={(e) => onUpdateNode(node.id, { method: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Method</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Headers
        </label>
        <textarea
          value={(node.data?.headers as string) || ""}
          onChange={(e) => onUpdateNode(node.id, { headers: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          placeholder="Enter headers (JSON format)"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Body
        </label>
        <textarea
          value={(node.data?.body as string) || ""}
          onChange={(e) => onUpdateNode(node.id, { body: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={4}
          placeholder="Enter request body (JSON format)"
        />
      </div>
    </div>
  );

  const renderPdfProperties = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          PDF Template
        </label>
        <select
          value={(node.data?.pdfTemplateType as string) || "nda"}
          onChange={(e) =>
            onUpdateNode(node.id, { pdfTemplateType: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="nda">NDA</option>
          <option value="msa">MSA</option>
          <option value="invoice">Invoice</option>
          <option value="contract">Contract</option>
          <option value="custom">Custom (Provide HTML)</option>
        </select>
      </div>

      {((node.data?.pdfTemplateType as string) || "nda") === "custom" && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              HTML Template
            </label>
            <textarea
              value={(node.data?.htmlTemplate as string) || ""}
              onChange={(e) =>
                onUpdateNode(node.id, { htmlTemplate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs"
              rows={8}
              placeholder="Enter HTML content. Use {{fieldName}} to inject form values and {{signature}} to capture the signature image data URL."
            />
            <p className="text-xs text-gray-500 mt-1">
              Supports variable templating from upstream form fields, e.g.
              &#123;&#123;name&#125;&#125;, &#123;&#123;email&#125;&#125;.
            </p>
          </div>
        </>
      )}

      {/* Upload a static PDF file */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload PDF
        </label>
        <input
          type="file"
          accept="application/pdf"
          onChange={async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            try {
              onUpdateNode(node.id, { pdfUploadStatus: "uploading" });
              const resp = await workflowAPI.uploadPdf(file);
              if (resp.success && resp.url) {
                onUpdateNode(node.id, {
                  pdfUrl: resp.url,
                  pdfUploadStatus: "uploaded",
                });
              } else {
                onUpdateNode(node.id, { pdfUploadStatus: "error" });
                alert(resp.message || "Failed to upload PDF");
              }
            } catch {
              onUpdateNode(node.id, { pdfUploadStatus: "error" });
              alert("Error uploading PDF");
            } finally {
              // reset the input so same file can be re-selected if needed
              e.currentTarget.value = "";
            }
          }}
          className="block w-full text-sm text-gray-700"
        />
        <div className="mt-2 text-xs text-gray-500">
          {(node.data?.pdfUploadStatus as string) === "uploading" &&
            "Uploading..."}
          {(node.data?.pdfUploadStatus as string) === "uploaded" && "Uploaded"}
          {(node.data?.pdfUploadStatus as string) === "error" &&
            "Upload failed"}
        </div>
        {(node.data?.pdfUrl as string) && (
          <div className="mt-2">
            <a
              href={node.data?.pdfUrl as string}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline text-sm"
            >
              View uploaded PDF
            </a>
          </div>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Upload a PDF to use as the document source. The file will be stored in
          S3 and referenced by URL.
        </p>
      </div>

      {/* Email Configuration Section */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-700">Email Configuration</h4>
          <button
            onClick={() => setIsEmailConfigExpanded(!isEmailConfigExpanded)}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title={isEmailConfigExpanded ? "Collapse" : "Expand"}
          >
            {isEmailConfigExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {isEmailConfigExpanded && (
          <>
            {/* Send Public Link Toggle */}
            <div className="mb-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={(node.data?.sendPublicLink as boolean) || false}
                  onChange={(e) =>
                    onUpdateNode(node.id, { sendPublicLink: e.target.checked })
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Send Public Magic Link
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                When enabled, sends a secure link to external users for PDF review
                and completion.
              </p>
            </div>

            {/* Email Address Field - Show when toggle is enabled */}
            {(node.data?.sendPublicLink as boolean) && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recipient Email Address
                  </label>
                  <input
                    type="text"
                    value={(node.data?.publicEmail as string) || ""}
                    onChange={(e) =>
                      onUpdateNode(node.id, { publicEmail: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., user@example.com or {{form1.receiver}}"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter a static email address or use variables from upstream form
                    fields like &#123;&#123;form1.receiver&#125;&#125;
                  </p>
                </div>

                {/* Email Subject */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={
                      (node.data?.emailSubject as string) ||
                      "Action Required: Review and Sign Document"
                    }
                    onChange={(e) =>
                      onUpdateNode(node.id, { emailSubject: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email subject (can use variables)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Subject line for the email. Supports variable templating.
                  </p>
                </div>

                {/* Link Expiration Time */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link Expiration (minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="10080"
                    value={(node.data?.expiresInMinutes as number) || 60}
                    onChange={(e) =>
                      onUpdateNode(node.id, {
                        expiresInMinutes: parseInt(e.target.value) || 60,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="60"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    How long the magic link remains valid (5 minutes to 7 days).
                    Default: 60 minutes.
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderAgentProperties = () => {
    const handleSaveMcpDetails = (details: string) => {
      onUpdateNode(node.id, { mcpDetails: details });
      setIsMcpModalOpen(false);
    };

    // Get form fields from upstream nodes for prompt composition
    const getUpstreamFormFields = (): FormField[] => {
      const upstreamFormFields: FormField[] = [];

      // Find all nodes that come before the current agent node
      const findUpstreamNodes = (
        currentNodeId: string,
        visited: Set<string> = new Set()
      ): string[] => {
        if (visited.has(currentNodeId)) return [];
        visited.add(currentNodeId);

        const upstreamNodeIds: string[] = [];

        // Find all edges where current node is the target
        edges.forEach((edge) => {
          if (edge.target === currentNodeId && edge.source) {
            upstreamNodeIds.push(edge.source);
            // Recursively find nodes upstream of this node
            const furtherUpstream = findUpstreamNodes(edge.source, visited);
            upstreamNodeIds.push(...furtherUpstream);
          }
        });

        return upstreamNodeIds;
      };

      // Get all upstream node IDs
      const upstreamNodeIds = findUpstreamNodes(node.id);

      // Extract form fields from upstream form nodes
      upstreamNodeIds.forEach((nodeId) => {
        const upstreamNode = nodes.find((n) => n.id === nodeId);
        if (upstreamNode && upstreamNode.type === "formNode") {
          const formFields = upstreamNode.data?.formFields as FormField[];
          const logicalId =
            (upstreamNode.data?.logicalId as string) || upstreamNode.id;
          const formLabel =
            (upstreamNode.data?.label as string) ||
            (upstreamNode.data?.name as string) ||
            "";
          if (formFields && Array.isArray(formFields)) {
            formFields.forEach((field) => {
              upstreamFormFields.push({
                ...field,
                name: logicalId ? `${logicalId}.${field.name}` : field.name,
                logicalId,
                sourceFormLabel: formLabel || undefined,
                originalName: field.name,
              });
            });
          }
        }
        if (upstreamNode && upstreamNode.type === "promptNode") {
          const logicalId =
            (upstreamNode.data?.logicalId as string) || upstreamNode.id;
          upstreamFormFields.push({
            name: `${logicalId}.result`,
            type: "text",
            logicalId,
            sourceFormLabel: (upstreamNode.data?.label as string) || undefined,
          });
        }
      });

      return upstreamFormFields;
    };

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Agent Configuration
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700">
                  MCP Details
                </span>
              </div>
              <button
                onClick={() => setIsMcpModalOpen(true)}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Configure
              </button>
            </div>

            {(node.data?.mcpDetails as string) && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800">
                    Current Configuration
                  </span>
                  <button
                    onClick={() => setIsMcpModalOpen(true)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                </div>
                <p className="text-xs text-blue-700 line-clamp-2">
                  {(node.data?.mcpDetails as string).substring(0, 100)}
                  {(node.data?.mcpDetails as string).length > 100 && "..."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Prompt Composition Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Agent Prompt
            </label>
            <button
              onClick={() => setIsPromptModalOpen(true)}
              className="px-3 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
              title="Compose prompt for MCP agent"
            >
              <MessageSquare className="w-3 h-3" />
              Compose Prompt
            </button>
          </div>

          {/* Available Form Fields from Upstream Nodes */}
          {(() => {
            const upstreamFields = getUpstreamFormFields();
            return upstreamFields.length > 0 ? (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800">
                    Available Form Fields
                  </span>
                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    {upstreamFields.length} field
                    {upstreamFields.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {upstreamFields.map((field, index) => (
                    <span
                      key={index}
                      className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded border border-blue-200"
                      title={`Type: ${field.type}${
                        field.required ? " (Required)" : ""
                      }`}
                    >
                      {field.name}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Use these fields in your prompt with {"{{fieldName}}"} syntax
                </p>
              </div>
            ) : (
              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-xs text-gray-600">
                  <strong>No upstream form fields found.</strong>
                  <p className="mt-1">
                    Add form nodes before this agent node to use their fields in
                    your prompt.
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Current Prompt Display */}
          {(node.data?.prompt as string) && (
            <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-800">
                  Current Prompt
                </span>
                <button
                  onClick={() => setIsPromptModalOpen(true)}
                  className="text-xs text-green-600 hover:text-green-800"
                >
                  Edit
                </button>
              </div>
              <p className="text-xs text-green-700 line-clamp-3">
                {(node.data?.prompt as string).substring(0, 150)}
                {(node.data?.prompt as string).length > 150 && "..."}
              </p>
            </div>
          )}
        </div>

        <McpDetailsModal
          isOpen={isMcpModalOpen}
          onClose={() => setIsMcpModalOpen(false)}
          onSave={handleSaveMcpDetails}
          mcpDetails={(node.data?.mcpDetails as string) || ""}
        />

        {/* Prompt Composition Modal for Agent Node */}
        <PromptCompositionModal
          isOpen={isPromptModalOpen}
          onClose={() => setIsPromptModalOpen(false)}
          onSave={(prompt) => {
            onUpdateNode(node.id, { prompt: prompt });
            setIsPromptModalOpen(false);
          }}
          formFields={getUpstreamFormFields()}
          initialPrompt={(node.data?.prompt as string) || ""}
          nodeType={node.type}
        />
      </div>
    );
  };

  const renderPromptProperties = () => {
    // Get form fields from upstream nodes for prompt composition
    const getUpstreamFormFields = (): FormField[] => {
      const upstreamFormFields: FormField[] = [];

      // Find all nodes that come before the current prompt node
      const findUpstreamNodes = (
        currentNodeId: string,
        visited: Set<string> = new Set()
      ): string[] => {
        if (visited.has(currentNodeId)) return [];
        visited.add(currentNodeId);

        const upstreamNodeIds: string[] = [];

        // Find all edges where current node is the target
        edges.forEach((edge) => {
          if (edge.target === currentNodeId && edge.source) {
            upstreamNodeIds.push(edge.source);
            // Recursively find nodes upstream of this node
            const furtherUpstream = findUpstreamNodes(edge.source, visited);
            upstreamNodeIds.push(...furtherUpstream);
          }
        });

        return upstreamNodeIds;
      };

      // Get all upstream node IDs
      const upstreamNodeIds = findUpstreamNodes(node.id);

      // Extract form fields from upstream form nodes
      upstreamNodeIds.forEach((nodeId) => {
        const upstreamNode = nodes.find((n) => n.id === nodeId);
        if (upstreamNode && upstreamNode.type === "formNode") {
          const formFields = upstreamNode.data?.formFields as FormField[];
          const logicalId =
            (upstreamNode.data?.logicalId as string) || upstreamNode.id;
          const formLabel =
            (upstreamNode.data?.label as string) ||
            (upstreamNode.data?.name as string) ||
            "";
          if (formFields && Array.isArray(formFields)) {
            formFields.forEach((field) => {
              upstreamFormFields.push({
                ...field,
                name: logicalId ? `${logicalId}.${field.name}` : field.name,
                logicalId,
                sourceFormLabel: formLabel || undefined,
                originalName: field.name,
              });
            });
          }
        }
        if (upstreamNode && upstreamNode.type === "promptNode") {
          const logicalId =
            (upstreamNode.data?.logicalId as string) || upstreamNode.id;
          upstreamFormFields.push({
            name: `${logicalId}.result`,
            type: "text",
            logicalId,
            sourceFormLabel: (upstreamNode.data?.label as string) || undefined,
          });
        }
      });

      return upstreamFormFields;
    };

    // Model to API mapping
    const modelToApiMap: Record<string, string> = {
      "gpt-4": "openai",
      "gpt-4-turbo": "openai",
      "gpt-3.5-turbo": "openai",
      "gpt-5": "openai",
      "dalle-3": "openai",
      "claude-sonnet-4": "anthropic",
      "sonar-pro": "perplexity",
    };

    // All available models
    const allModels = [
      { value: "gpt-4", label: "GPT-4", api: "openai" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo", api: "openai" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", api: "openai" },
      { value: "gpt-5.1", label: "GPT-5.1", api: "openai" },
      { value: "dalle-3", label: "DALL-E 3", api: "openai" },
      { value: "claude-sonnet-4", label: "Claude Sonnet 4", api: "anthropic" },
      { value: "sonar-pro", label: "Sonar Pro", api: "perplexity" },
    ];

    // Get selected API and model with defaults
    const selectedApi = (node.data?.api as string) || "openai";
    const selectedModel = (node.data?.model as string) || "gpt-4";

    // Filter models based on selected API
    const getAvailableModels = () => {
      if (!selectedApi) {
        return allModels; // Show all models if no API is selected
      }
      return allModels.filter((model) => model.api === selectedApi);
    };

    // Handle model selection - auto-select API
    const handleModelChange = (modelValue: string) => {
      if (modelValue) {
        const apiForModel = modelToApiMap[modelValue];
        if (apiForModel) {
          onUpdateNode(node.id, { api: apiForModel, model: modelValue });
        } else {
          onUpdateNode(node.id, { model: modelValue });
        }
      } else {
        onUpdateNode(node.id, { model: "" });
      }
    };

    const availableModels = getAvailableModels();

    return (
      <div className="space-y-4">
        {/* API Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API
          </label>
          <select
            value={selectedApi}
            onChange={(e) => {
              const newApi = e.target.value;
              // Auto-select sonar-pro when perplexity is selected
              if (newApi === "perplexity") {
                onUpdateNode(node.id, { api: newApi, model: "sonar-pro" });
                return;
              }
              if (newApi === "anthropic") {
                onUpdateNode(node.id, { api: newApi, model: "claude-sonnet-4" });
                return;
              }
              // Clear model if it doesn't belong to new API
              if (newApi && selectedModel) {
                const modelApi = modelToApiMap[selectedModel];
                if (modelApi && modelApi !== newApi) {
                  onUpdateNode(node.id, { api: newApi, model: "" });
                } else {
                  onUpdateNode(node.id, { api: newApi });
                }
              } else {
                onUpdateNode(node.id, { api: newApi });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {/* <option value="">All APIs</option> */}
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="perplexity">Perplexity</option>
          </select>
        </div>

        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Model
          </label>
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {/* <option value="">Select Model</option> */}
            {availableModels.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        {/* Prompt Composition Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Prompt Configuration
            </label>
            <button
              onClick={() => setIsPromptModalOpen(true)}
              className="px-3 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
              title="Compose prompt"
            >
              <MessageSquare className="w-3 h-3" />
              Compose Prompt
            </button>
          </div>

          {/* Available Form Fields from Upstream Nodes */}
          {(() => {
            const upstreamFields = getUpstreamFormFields();
            return upstreamFields.length > 0 ? (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800">
                    Available Form Fields
                  </span>
                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    {upstreamFields.length} field
                    {upstreamFields.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {upstreamFields.map((field, index) => (
                    <span
                      key={index}
                      className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded border border-blue-200"
                      title={`Type: ${field.type}${
                        field.required ? " (Required)" : ""
                      }`}
                    >
                      {field.name}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Use these fields in your prompt with {"{{fieldName}}"} syntax
                </p>
              </div>
            ) : (
              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-xs text-gray-600">
                  <strong>No upstream form fields found.</strong>
                  <p className="mt-1">
                    Add form nodes before this prompt node to use their fields
                    in your prompt.
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Current Prompt Display */}
          {(node.data?.prompt as string) && (
            <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-800">
                  Current Prompt
                </span>
                <button
                  onClick={() => setIsPromptModalOpen(true)}
                  className="text-xs text-green-600 hover:text-green-800"
                >
                  Edit
                </button>
              </div>
              <p className="text-xs text-green-700 line-clamp-3">
                {(node.data?.prompt as string).substring(0, 150)}
                {(node.data?.prompt as string).length > 150 && "..."}
              </p>
            </div>
          )}
        </div>

        {/* Prompt Composition Modal for Prompt Node */}
        <PromptCompositionModal
          isOpen={isPromptModalOpen}
          onClose={() => setIsPromptModalOpen(false)}
          onSave={(prompt) => {
            onUpdateNode(node.id, { prompt: prompt });
            setIsPromptModalOpen(false);
          }}
          formFields={getUpstreamFormFields()}
          initialPrompt={(node.data?.prompt as string) || ""}
          nodeType={node.type}
          api={node.data?.api as string || "openai"}
          model={node.data?.model as string || "gpt-4"}
        />
      </div>
    );
  };

  const renderNodeSpecificProperties = () => {
    switch (node.type) {
      case "triggerNode":
        return renderTriggerProperties();
      case "formNode":
        return renderFormProperties();
      case "approvalNode":
        return renderApprovalProperties();
      case "crmApprovalNode":
        return renderApprovalProperties();
      case "conditionNode":
        return renderConditionProperties();
      case "updateNode":
        return renderUpdateProperties();
      case "crmUpdateNode":
        return renderCrmUpdateProperties();
      case "notificationNode":
        return renderNotificationProperties();
      case "delayNode":
        return renderDelayProperties();
      case "webhookNode":
        return renderWebhookProperties();
      case "apiNode":
        return renderApiProperties();
      case "agentNode":
        return renderAgentProperties();
      case "promptNode":
        return renderPromptProperties();
      case "pdfNode":
        return renderPdfProperties();
      default:
        return null;
    }
  };

  return (
    <div className="w-full lg:w-80 bg-white border-l border-gray-200 p-4 lg:p-6 overflow-y-auto max-h-screen">
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <h3 className="text-base lg:text-lg font-semibold text-gray-900">
          Node Properties
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete node"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Node Type
          </label>
          <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
            {node.type}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Node ID
          </label>
          <input
            type="text"
            value={nodeIdInput}
            onChange={(e) => {
              setNodeIdInput(e.target.value);
              const v = validateUserNodeId(
                e.target.value.trim(),
                nodes,
                node.id
              );
              setNodeIdError(v.isValid ? null : v.error || "Invalid node ID");
            }}
            onBlur={tryUpdateNodeId}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                setNodeIdInput(node.id);
                setNodeIdError(null);
              }
            }}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
              nodeIdError ? "border-red-300" : "border-gray-300"
            }`}
            placeholder="e.g., form1, agent2"
          />
          {nodeIdError ? (
            <p className="text-xs text-red-600 mt-1">{nodeIdError}</p>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              Use simple IDs like form1 or agent2. Must be unique in this
              workflow.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start Node
          </label>
          <div className="flex items-center space-x-3">
            <button
              onClick={() =>
                onUpdateNode(node.id, {
                  isStartNode: !(node.data as NodeData)?.isStartNode,
                })
              }
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                (node.data as NodeData)?.isStartNode
                  ? "bg-green-500 text-white hover:bg-green-600 shadow-md"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {(node.data as NodeData)?.isStartNode
                ? "✓ Start Node"
                : "Mark as Start"}
            </button>
            {(node.data as NodeData)?.isStartNode && (
              <div className="flex items-center text-xs text-green-600">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                This node will start the workflow
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Name
          </label>
          <input
            type="text"
            value={(node.data?.label as string) || ""}
            onChange={handleLabelChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter node name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={handleDescriptionChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Enter node description"
          />
        </div>
        {node.type == "formNode" ? (
          <div className="mb-4 lg:mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Public Node Status
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={publicData}
                  onChange={handlePublicDataChange}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {publicData && (
                  <button
                    onClick={() => setIsPublicFormExpanded(!isPublicFormExpanded)}
                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                    title={isPublicFormExpanded ? "Collapse" : "Expand"}
                  >
                    {isPublicFormExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
            
            {publicData && publicLink && isPublicFormExpanded && (
              <div className="mt-3 space-y-4">
                {/* Public Form Link */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Public Form Link
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={publicLink}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center space-x-1 transition-colors"
                      title="Copy link to clipboard"
                    >
                      {isLinkCopied ? (
                        <>
                          <Check className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    This is a static public link that can be accessed directly or embedded in external websites. No authentication required.
                  </p>
                </div>

                {/* HTML Embed Code */}
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    HTML Embed Code
                  </label>
                  <div className="space-y-2">
                    <div className="bg-white border border-gray-300 rounded-md p-3">
                      <code className="text-xs text-gray-800 break-all">
                        {`<iframe src="${publicLink}" width="100%" height="600" frameborder="0" style="border: 1px solid #ccc; border-radius: 8px;"></iframe>`}
                      </code>
                    </div>
                    <button
                      onClick={copyHtmlToClipboard}
                      className="w-full px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center justify-center space-x-1 transition-colors"
                      title="Copy HTML code to clipboard"
                    >
                      {isHtmlCopied ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy HTML Code</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    Use this HTML code to embed the form in your website or application. The iframe will display the form with a responsive design.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {renderNodeSpecificProperties()}
      </div>
    </div>
  );
};

export default NodePropertiesPanel;
