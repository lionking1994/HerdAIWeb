// Graph data structure exports (TypeScript version)

export interface GraphNode {
  id: string;
  label: string;
  color?: string;
  group?: string;
  annotation?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  thickness?: number;
  annotation?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface InteractiveNodeGraphProps {
  data: GraphData;
  onAnnotationClick?: (id: string) => void;
}

export interface AnnotationState {
  nodeId: string;
  annotation: string;
}
