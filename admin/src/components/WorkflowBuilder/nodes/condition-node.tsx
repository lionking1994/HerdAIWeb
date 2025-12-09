"use client"

import { Handle, Position } from "@xyflow/react"
import { Diamond } from "lucide-react"

interface ConditionNodeData {
  label: string;
  description: string;
  condition: string;
  trueLabel: string;
  falseLabel: string;
  isStartNode?: boolean;
}

export function ConditionNode({ data }: { data: ConditionNodeData }) {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-yellow-100 border-2 border-yellow-200 min-w-[140px] relative ${data?.isStartNode ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}>
      {/* Play Button for Start Node */}
      {data?.isStartNode && (
        <div className="absolute -top-2 -right-2 bg-blue-500 text-white p-1 rounded-full shadow-lg z-10 hover:bg-blue-600 transition-colors cursor-pointer">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      )}
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-yellow-500" />
      <div className="flex items-center gap-2">
        <Diamond className="w-4 h-4 text-yellow-700" />
        <div className="text-yellow-700 font-medium">{data.label}</div>
      </div>
      {data.description && <div className="text-xs text-yellow-600 mt-1">{data.description}</div>}
      {data.condition && <div className="text-xs text-yellow-600 mt-1 font-mono">{data.condition}</div>}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="w-3 h-3 !bg-green-500"
        style={{ top: "70%" }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="false"
        className="w-3 h-3 !bg-red-500"
        style={{ top: "70%" }}
      />
      <div className="absolute -right-8 top-1/2 text-xs text-green-600 font-medium">{data.trueLabel || "Yes"}</div>
      <div className="absolute -left-8 top-1/2 text-xs text-red-600 font-medium">{data.falseLabel || "No"}</div>
    </div>
  )
}
