import React from "react";
import { NodeProps, Handle, Position, useReactFlow } from "@xyflow/react";
import { FileText, Edit, Trash2 } from "lucide-react";

interface PdfNodeData {
  label: string;
  description?: string;
  htmlTemplate?: string;
  fileNameTemplate?: string;
  recipientEmailField?: string;
  publicEmail?: string;
  sendPublicLink?: boolean;
  emailSubject?: string;
  isStartNode?: boolean;
}

const PdfNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  const nodeData = data as unknown as PdfNodeData;
  const { setNodes, setEdges } = useReactFlow();

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    const event = new MouseEvent("click", { bubbles: true });
    e.currentTarget.dispatchEvent(event);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) =>
      eds.filter((edge) => edge.source !== id && edge.target !== id)
    );
  };

  return (
    <div
      className={`relative group ${
        selected ? "ring-2 ring-blue-500 ring-offset-2" : ""
      } ${nodeData?.isStartNode ? "ring-2 ring-green-500 ring-offset-2" : ""}`}
    >
      <div className="bg-purple-500 text-white px-4 py-3 rounded-lg shadow-lg min-w-[180px] max-w-[240px]">
        {nodeData?.isStartNode && (
          <div className="absolute -top-2 -right-2 bg-blue-500 text-white p-1 rounded-full shadow-lg z-10 hover:bg-blue-600 transition-colors cursor-pointer">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4" />
            <span className="font-semibold text-sm">
              {nodeData?.label || "PDF"}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={handleEdit}
              className="p-1 hover:bg-purple-600 rounded text-xs transition-colors"
              title="Edit node"
            >
              <Edit className="w-3 h-3" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 hover:bg-red-500 rounded text-xs transition-colors"
              title="Delete node"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {nodeData?.description ? (
          <div className="text-xs opacity-90 mb-2 leading-relaxed">
            {nodeData.description}
          </div>
        ) : (
          <div className="text-xs opacity-60 mb-2 italic">
            Generates a PDF from HTML template
          </div>
        )}

        <div className="space-y-1 mt-2 text-[11px]">
          <div className="bg-purple-600 px-2 py-1 rounded">PDF Config</div>
          <div className="bg-purple-50 text-purple-800 px-2 py-1 rounded border border-purple-200 truncate">
            {nodeData?.fileNameTemplate
              ? `File: ${nodeData.fileNameTemplate}`
              : "File: {{company}}-nda.pdf"}
          </div>
          {nodeData?.sendPublicLink && (
            <div className="bg-purple-50 text-purple-800 px-2 py-1 rounded border border-purple-200 truncate">
              {nodeData?.publicEmail
                ? `Email: ${nodeData.publicEmail}`
                : "Email: Not configured"}
            </div>
          )}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-purple-600 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-purple-600 border-2 border-white"
      />
    </div>
  );
};

export default PdfNode;
