declare module 'dagre' {
  export interface GraphLabel {
    rankdir?: string;
    ranksep?: number;
    nodesep?: number;
    edgesep?: number;
    marginx?: number;
    marginy?: number;
  }

  export interface Node {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export interface Edge {
    points: Array<{ x: number; y: number }>;
  }

  export class graphlib {
    static Graph: new () => Graph;
  }

  export class Graph {
    constructor();
    setGraph(label: GraphLabel): void;
    setNode(id: string, node: { width: number; height: number }): void;
    setEdge(source: string, target: string): void;
    node(id: string): Node;
    edge(source: string, target: string): Edge;
    nodes(): string[];
    edges(): Array<{ v: string; w: string }>;
  }

  export function layout(graph: Graph): void;
}

export default dagre; 