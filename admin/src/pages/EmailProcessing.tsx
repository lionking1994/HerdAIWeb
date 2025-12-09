import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import {
  Zap,
  FileText,
  CheckCircle,
  Database,
  ArrowLeft,
  Trash,
  RefreshCcw,
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import OpportunityNodeGraph from "../components/OpportunityNodeGraph";
import { useSearchParams } from "react-router-dom";
import { EnhancedDataTable } from "../components/DataTable/EnhancedDataTable";
import ViewToggle from "../components/ViewListToggle";
import { createColumnHelper } from "@tanstack/react-table";
import { ColumnDef } from "@tanstack/react-table";

type Opportunity = {
  id: string;
  internet_message_id?: string;
  subject?: string;
  body?: string | null;
  sender?: string;
  template_message?: string;
  to_recipients?: string[];
  cc_recipients?: string[];
  bcc_recipients?: string[];
  received_at?: string;
  created_at?: string;
  node_graph_json?: string;
  template_id?: number;
  prompt?: string;
  template_name?: string;
  graph_message?: string[];
  has_attachments?: boolean;
  processed_graph?: boolean;
};

const isHTML = (str?: string | null) => !!str && /<\/?[a-z][\s\S]*>/i.test(str);

const getCleanBody = (body?: string | null) => {
  if (!body) return "";
  // you had markers logic previously — keep simple trimming for now
  return body.replace(/\r\n/g, "\n").trim();
};

const getFirstNWords = (input?: string | null, maxWords = 10) => {
  if (!input) return "";
  const words = input.trim().split(/\s+/);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ") + "…";
};

export default function EmailProcessing(): JSX.Element {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get("company");

  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOpportunityForGraph, setSelectedOpportunityForGraph] = useState<Opportunity | null>(null);
  const [showIntelligenceGraph, setShowIntelligenceGraph] = useState<boolean>(false);
  const [isProcessingMeeting, setIsProcessingMeeting] = useState(false);
  const [loadingOpportunities, setLoadingOpportunities] = useState(false);
  const [activeTab, setActiveTab] = useState<"activity" | "participants" | "tasks">("activity");
  const [viewMode, setViewMode] = useState<"list" | "table">("table");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"all" | "today" | "this-week" | "this-month" | "processed" | "without-body">("all");
  const [emailType, setEmailType] = useState("sent"); // default is "sent"
  // Table / pagination / sorting
  const [sorting, setSorting] = useState<any[]>([{ id: "received_at", desc: true }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  // KPI metrics
  const [metrics, setMetrics] = useState({
    totalEmails: 0,
    withoutBody: 0,
    processedGraphs: 0,
    withAttachments: 0,
  });

  // local pagination for list/cards (keeps existing itemsPerPage=9 behaviour)
  const itemsPerPage = pagination.pageSize;

  // Derived filtered list (search + filters + sorting)
  const filteredOpportunities = useMemo(() => {
    let list = [...opportunities];

    // Search filter
    if (searchQuery && searchQuery.trim() !== "") {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((o) => {
        return (
          (o.subject || "").toLowerCase().includes(q) ||
          (o.body || "").toLowerCase().includes(q) ||
          (o.sender || "").toLowerCase().includes(q)
        );
      });
    }

    // Apply sorting based on table sorting state
    if (sorting && sorting.length > 0) {
      const sortConfig = sorting[0]; // Use first sorting configuration
      const { id: sortId, desc } = sortConfig;

      list.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortId) {
          case "subject":
            aValue = (a.subject || "").toLowerCase();
            bValue = (b.subject || "").toLowerCase();
            break;
          case "received_at":
            aValue = a.received_at ? new Date(a.received_at).getTime() : 0;
            bValue = b.received_at ? new Date(b.received_at).getTime() : 0;
            break;
          case "sender":
            aValue = (a.sender || "").toLowerCase();
            bValue = (b.sender || "").toLowerCase();
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return desc ? 1 : -1;
        if (aValue > bValue) return desc ? -1 : 1;
        return 0;
      });
    } else {
      // Default sorting by received_at date (latest first) when no sorting is applied
      list.sort((a, b) => {
        const dateA = a.received_at ? new Date(a.received_at).getTime() : 0;
        const dateB = b.received_at ? new Date(b.received_at).getTime() : 0;
        return dateB - dateA; // Descending order (latest first)
      });
    }

    return list;
  }, [opportunities, activeFilter, searchQuery, sorting]);

  // paginated slice for card/list mode
  const paginatedOpportunities = useMemo(
  () =>
    filteredOpportunities.slice(
      pagination.pageIndex * itemsPerPage,
      (pagination.pageIndex + 1) * itemsPerPage
    ),
  [filteredOpportunities, pagination]
);

  const handlePaginationChange = (newPagination: { pageIndex: number; pageSize: number }) => {
    setPagination(newPagination);
  };

  const columnHelper = createColumnHelper<Opportunity>();

  const columns: ColumnDef<Opportunity, any>[] = [
    columnHelper.accessor("subject", {
      header: "Subject",
      cell: (info) => (
        <div
          className="font-bold text-gray-800 cursor-pointer hover:text-blue-600"
          onClick={() => openOpportunityGraph(info.row.original)}
        >
          {info.getValue()
            ? getFirstNWords(
              String(info.getValue()).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
              10
            )
            : "No subject"}
        </div>
      ),
      enableSorting: true,
    }),
    // Table column definition
    columnHelper.accessor((row) => row.body, {
      id: "body",
      header: "Description",
      cell: (info) => {
        const html = info.getValue() || "";
        const plainText = String(html)
          .replace(/<[^>]*>/g, " ") // remove HTML tags
          .replace(/&nbsp;/gi, " ") // remove HTML entities
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/&#39;/gi, "'")
          .replace(/&quot;/gi, '"')
          .replace(/\s+/g, " ")
          .trim();

        return (
          <div
            className="text-gray-600 max-w-xs truncate cursor-pointer hover:text-blue-600 hover:underline"
            onClick={() => openOpportunityGraph(info.row.original)}
            title={plainText}
          >
            {getFirstNWords(plainText, 12)}
          </div>
        );
      },
      enableSorting: false,
    }),
    columnHelper.accessor("received_at", {
      header: "Date & Time",
      cell: (info) => (
        <div className="text-gray-600">
          {info.getValue() ? new Date(String(info.getValue())).toLocaleString() : <span className="italic text-gray-400">No Date</span>}
        </div>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor("sender", {
      header: "Sender",
      cell: (info) => <div className="text-gray-600">{info.getValue() || "-"}</div>,
      enableSorting: true,
    }),
    columnHelper.accessor((row) => row.id, {
      id: "actions",
      header: "Actions",
      cell: (info) => (
        <div className="cursor-pointer" onClick={() => handleDelete(String(info.getValue()))}>
          <Trash className="h-4 w-4 text-red-500 hover:text-red-700" />
        </div>
      ),
      enableSorting: false,
    }),
  ];

  // Fetch users for company
  useEffect(() => {
    if (!companyId) return;
    const fetchUsers = async () => {
      try {
        const response = await api.post("/users/all", {
          company: parseInt(companyId),
          status: "enabled",
          filter: "",
          page: 1,
          per_page: 1000,
        });
        if (response?.data?.users) {
          setUsers(response.data.users);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };
    fetchUsers();
    setSelectedUser("");
    setOpportunities([]);
    setShowIntelligenceGraph(false);
    setSelectedOpportunityForGraph(null);
  }, [companyId]);

  const fetchOpportunities = async () => {
    try {
      setLoadingOpportunities(true);
      const response = await api.get(
        `/crm/opportunities/getOwnerOpportunities?tenantId=${companyId}&owner_id=${selectedUser}&email_Type=${emailType}`
      );
      if (response?.data?.data) {
        setOpportunities(response.data.data);
      } else {
        setOpportunities([]);
      }
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      setOpportunities([]);
    } finally {
      setLoadingOpportunities(false);
    }
  };

  // Fetch opportunities when company or selectedUser changes
  useEffect(() => {
    if (!companyId || !selectedUser) return

    fetchOpportunities();
    setSelectedOpportunityForGraph(null);
    setShowIntelligenceGraph(false);
  }, [companyId, selectedUser, emailType]);

  // Recalculate metrics when opportunities change
  useEffect(() => {
    const totalEmails = opportunities.length;
    const withoutBody = opportunities.filter((o) => !o.body || o.body.trim() === "").length;
    const processedGraphs = opportunities.filter((o) => !!o.node_graph_json || o.processed_graph).length;
    const withAttachments = opportunities.filter((o) => !!o.has_attachments).length;
    setMetrics({ totalEmails, withoutBody, processedGraphs, withAttachments });
  }, [opportunities]);

  // Handle opening an opportunity (graph view)
  const openOpportunityGraph = (opp: Opportunity) => {
    setSelectedOpportunityForGraph(opp);
    setShowIntelligenceGraph(true);
  };

  // fetchOpportunityGraph stays mostly same
  const fetchOpportunityGraph = async (opportunity: Opportunity) => {
    if (!opportunity?.id) {
      console.error("Missing opportunity ID");
      return;
    }
    setIsProcessingMeeting(true);
    try {
      const response = await api.post(`/company-strategy/opportunity-node-graph`, {
        emailId: opportunity.id,
      });

      if (response?.data) {
        const updatedGraphJson = JSON.stringify(response.data?.node_json ?? response.data.graph_data);
        const updated = { ...opportunity, node_graph_json: updatedGraphJson, template_name: response.data.template_name, template_id: response.data.template_id };
        setSelectedOpportunityForGraph(updated);
        setOpportunities((prev) => prev.map((p) => (p.id === opportunity.id ? { ...p, node_graph_json: updatedGraphJson, template_name: response.data.template_name, template_id: response.data.template_id } : p)));
      }
    } catch (error) {
      console.error("Error fetching opportunity graph:", error);
    } finally {
      setIsProcessingMeeting(false);
    }
  };

  // delete handler
  const handleDelete = async (emailId: string) => {
    try {
      const response = await api.delete(`/crm/opportunities/deleteOpp?emailId=${emailId}`);
      if (response?.data?.success) {
        setOpportunities((prev) => prev.filter((opp) => opp.id !== emailId));
      } else {
        console.error("Failed to delete email:", response?.data?.message);
      }
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  const handleTabClick = (tab: "activity" | "participants" | "tasks") => {
    setActiveTab(tab);
  };

  // handle table pagination change from EnhancedDataTable
  const handleTablePaginationChange = (newPagination: any) => {
    setPagination(newPagination);
  };

  // handle sorting change from EnhancedDataTable
  const handleSortingChange = (newSorting: any) => {
    setSorting(newSorting);
  };

  // handle filter click
  const handleFilterClick = (filterType: "all" | "today" | "this-week" | "this-month" | "processed" | "without-body") => {
    setActiveFilter(filterType);
    // Only set default sorting if no sorting is currently applied
    if (!sorting || sorting.length === 0) {
      setSorting([{ id: "received_at", desc: true }]);
    }
  };

  // small skeleton stream styles (same animation used in MeetingList)
  useEffect(() => {
    const styleId = "skeleton-stream-styles-email-processing";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .skeleton-stream {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: stream 1.5s infinite;
        }
        @keyframes stream {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const handleChange = (event: any) => {
    const selectedType = event.target.value;
    setEmailType(selectedType);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex-grow container mx-auto">
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200/60 backdrop-blur-sm z-10 sticky top-0">
          <div className="px-6 py-4">
            <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Users Dropdown */}
                  <div className="flex flex-col flex-1">
                    <label className="text-sm font-medium text-gray-700">Users</label>
                    <div className="relative">
                      <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                      >
                        <option value="">Select a user</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>

                      {/* Optional visual indicator (you can customize this later) */}
                      <div className="absolute inset-y-0 right-2 flex items-center">
                        <div className="w-2 h-2 rounded-full" />
                      </div>
                    </div>
                  </div>

                  {/* Refresh Button */}
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => fetchOpportunities()}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      title="Reset User Filter"
                    >
                      <RefreshCcw className="w-4 h-4 mr-1" />
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          {showIntelligenceGraph ? (

            <div className="mt-10 flex flex-col w-full px-6">
              <div className="w-full flex items-center mb-4">
                {/* Back button */}
                <div className="flex-shrink-0">
                  <button
                    onClick={() => {
                      setShowIntelligenceGraph(false);
                      setSelectedOpportunityForGraph(null);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-all duration-200"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                </div>

                {/* Title */}
                <div className="flex-1 text-center">
                  <h1 className="text-lg font-semibold">
                    {selectedOpportunityForGraph?.subject}
                  </h1>
                </div>

                <div className="w-px bg-gray-300 mx-4" />
              </div>

              {/* Tabs */}
              <div className="my-6 border-b">
                <div className="flex text-gray-600">
                  <button
                    className={`flex-1 text-center px-4 py-2 font-medium ${activeTab === "activity" ? "text-blue-600 border-b-2 border-blue-600" : "hover:text-blue-600"}`}
                    onClick={() => handleTabClick("activity")}
                  >
                    Email Details
                  </button>
                  <button
                    className={`flex-1 text-center px-4 py-2 font-medium ${activeTab === "participants"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "hover:text-blue-600"
                      }`}
                    onClick={() => handleTabClick("participants")}
                  >
                    Participants (
                    {selectedOpportunityForGraph
                      ? [
                        selectedOpportunityForGraph.sender,
                        ...(selectedOpportunityForGraph.to_recipients || []),
                        ...(selectedOpportunityForGraph.cc_recipients || []),
                        ...(selectedOpportunityForGraph.bcc_recipients || []),
                      ]
                        .filter(Boolean)
                        .filter((v, i, a) => a.indexOf(v) === i).length
                      : 0}
                    )
                  </button>

                  <button
                    className={`flex-1 text-center px-4 py-2 font-medium ${activeTab === "tasks" ? "text-blue-600 border-b-2 border-blue-600" : "hover:text-blue-600"}`}
                    onClick={() => handleTabClick("tasks")}
                  >
                    Node Graph
                  </button>
                </div>
              </div>
              <div className="rounded-md bg-white relative w-full flex items-center justify-center h-auto">
                <div className="rounded-md bg-white relative w-full flex flex-col items-center justify-center p-6 min-h-[200px]">

                  {isProcessingMeeting ? (
                    <div className="text-center text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                      <p>Processing intelligence graph...</p>
                    </div>
                  ) : (
                    <>
                      {activeTab === "activity" && selectedOpportunityForGraph?.body && (
                        <section className="email-summary w-full">
                          <h2 className="text-xl font-semibold mb-2">Description</h2>
                          <div className="description-content">
                            {isHTML(selectedOpportunityForGraph.body) ? (
                              <div
                                className="mb-2 break-words whitespace-pre-line"
                                dangerouslySetInnerHTML={{
                                  __html: getCleanBody(selectedOpportunityForGraph.body),
                                }}
                              />
                            ) : (
                              <p className="mb-2 break-words whitespace-pre-line">
                                {getCleanBody(selectedOpportunityForGraph.body)}
                              </p>
                            )}
                          </div>
                        </section>
                      )}

                      {activeTab === "participants" && selectedOpportunityForGraph && (
                        <section className="participants w-full p-5 bg-white rounded-lg shadow-md">
                          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Participants</h2>

                          <div className="participants-content flex flex-col gap-4">
                            {/* Sender Section */}
                            <div className="sender-section">
                              <h3 className="text-xl font-medium text-blue-600">Sender</h3>
                              <div className="flex flex-col gap-2">
                                {selectedOpportunityForGraph.sender ? (
                                  <div className="px-4 py-2 bg-blue-50 rounded-md text-blue-700">
                                    {selectedOpportunityForGraph.sender}
                                  </div>
                                ) : (
                                  <p>No sender found.</p>
                                )}
                              </div>
                            </div>

                            {/* To Recipients Section */}
                            {selectedOpportunityForGraph.to_recipients && selectedOpportunityForGraph.to_recipients.length > 0 && (
                              <div className="to-section">
                                <h3 className="text-xl font-medium text-indigo-600">To</h3>
                                <div className="flex flex-col gap-2">
                                  {selectedOpportunityForGraph.to_recipients.map((participant, index) => (
                                    <div key={index} className="px-4 py-2 bg-indigo-50 rounded-md text-indigo-700">
                                      {participant}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* CC Section */}
                            {selectedOpportunityForGraph.cc_recipients && selectedOpportunityForGraph.cc_recipients.length > 0 && (
                              <div className="cc-section">
                                <h3 className="text-xl font-medium text-green-600">CC</h3>
                                <div className="flex flex-col gap-2">
                                  {selectedOpportunityForGraph.cc_recipients.map((participant, index) => (
                                    <div key={index} className="px-4 py-2 bg-green-50 rounded-md text-green-700">
                                      {participant}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* BCC Section */}
                            {selectedOpportunityForGraph.bcc_recipients && selectedOpportunityForGraph.bcc_recipients.length > 0 && (
                              <div className="bcc-section">
                                <h3 className="text-xl font-medium text-gray-600">BCC</h3>
                                <div className="flex flex-col gap-2">
                                  {selectedOpportunityForGraph.bcc_recipients.map((participant, index) => (
                                    <div key={index} className="px-4 py-2 bg-gray-50 rounded-md text-gray-700">
                                      {participant}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Default message if no participants */}
                            {!selectedOpportunityForGraph.sender && !selectedOpportunityForGraph.to_recipients &&
                              !selectedOpportunityForGraph.cc_recipients && !selectedOpportunityForGraph.bcc_recipients && (
                                <p className="text-gray-500 mt-4">No participants found.</p>
                              )}
                          </div>
                        </section>
                      )}

                      {activeTab === "tasks" && (
                        <div className="w-full">
                          {selectedOpportunityForGraph?.node_graph_json ? (
                            (() => {
                              try {
                                const graphData = JSON.parse(selectedOpportunityForGraph.node_graph_json);
                                return (
                                  <OpportunityNodeGraph
                                    jsonData={graphData.graph_data || graphData}
                                    meetingId={selectedOpportunityForGraph.id}
                                    templateId={selectedOpportunityForGraph.template_id}
                                    tPrompt={selectedOpportunityForGraph.prompt}
                                    template_name={selectedOpportunityForGraph.template_name}
                                    onReprocess={async () => {
                                      if (selectedOpportunityForGraph) {
                                        await fetchOpportunityGraph(selectedOpportunityForGraph);
                                      }
                                    }}
                                    onNodeClick={(node) => {
                                      console.log("Node clicked:", node);
                                      // You can add custom logic here for node clicks
                                    }}
                                    onAnnotationChange={(nodeId, annotation, type) => {
                                      console.log("Annotation changed:", { nodeId, annotation, type });
                                      // You can add custom logic here for annotation changes
                                    }}
                                    exportFormat="png"
                                  />
                                );
                              } catch (error) {
                                console.error("Error parsing graph JSON:", error);
                                return (
                                  <p className="text-red-500">
                                    {selectedOpportunityForGraph?.graph_message
                                      ? selectedOpportunityForGraph.graph_message
                                      : "Error loading interactive graph data."}
                                  </p>

                                );
                              }
                            })()
                          ) : (
                            <div className="text-center text-gray-500">
                              <p>No interactive graph data available for this opportunity.</p>
                              <div className="mt-4 flex justify-center">
                                <button
                                  onClick={() => {
                                    if (selectedOpportunityForGraph?.id) {
                                      fetchOpportunityGraph(selectedOpportunityForGraph);
                                    }
                                  }}
                                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-all duration-200"
                                >
                                  Process Graph
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : loadingOpportunities ? (
            // 🔄 Loader while fetching
            <div className="flex justify-center items-center h-full text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
              <span>Loading mails...</span>
            </div>
          ) : opportunities.length > 0 ? (<div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            {/* KPI Cards */}
            <div className="hidden  flex-wrap justify-center gap-4 mb-6">
              <div className="w-[240px]">
                <div
                  className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${activeFilter === 'all' ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => handleFilterClick("all")}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-bold text-gray-900">All Emails</p>
                      <p className="text-xl font-bold text-gray-800">{metrics.totalEmails}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-[240px]">
                <div
                  className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${activeFilter === 'without-body' ? 'ring-2 ring-amber-500' : ''}`}
                  onClick={() => handleFilterClick(activeFilter === "without-body" ? "all" : "without-body")}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Zap className="h-6 w-6 text-amber-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-bold text-gray-900">Without Body</p>
                      <p className="text-xl font-bold text-gray-800">{metrics.withoutBody}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-[240px]">
                <div
                  className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${activeFilter === 'processed' ? 'ring-2 ring-purple-500' : ''}`}
                  onClick={() => handleFilterClick(activeFilter === "processed" ? "all" : "processed")}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <CheckCircle className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-bold text-gray-900">Processed Graphs</p>
                      <p className="text-xl font-bold text-gray-800">{metrics.processedGraphs}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-[240px]">
                <div
                  className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                  onClick={() => handleFilterClick("all")}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-cyan-100 rounded-lg">
                      <Database className="h-6 w-6 text-cyan-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-bold text-gray-900">With Attachments</p>
                      <p className="text-xl font-bold text-gray-800">{metrics.withAttachments}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="flex justify-center items-center gap-4 mb-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="emailType"
                  value="sent"
                  checked={emailType === "sent"}
                  onChange={handleChange}
                  className="accent-gray-600"
                />
                <span className="text-gray-700 font-medium">Sent</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="emailType"
                  value="received"
                  checked={emailType === "received"}
                  onChange={handleChange}
                  className="accent-gray-600"
                />
                <span className="text-gray-700 font-medium">Received</span>
              </label>
              <div className="relative w-full max-w-md">
                <input
                  type="text"
                  placeholder="Search emails by subject, sender or contents..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="mb-6">
              <div className="flex justify-center items-center gap-2">
                <p className="text-sm font-medium text-gray-900 mr-3">Timing:</p>
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-medium ${activeFilter === "today" ? "bg-blue-500 border-blue-500 text-white" : "bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50"}`}
                  onClick={() => handleFilterClick(activeFilter === "today" ? "all" : "today")}
                >
                  Today
                </button>
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-medium ${activeFilter === "this-week" ? "bg-blue-500 border-blue-500 text-white" : "bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50"}`}
                  onClick={() => handleFilterClick(activeFilter === "this-week" ? "all" : "this-week")}
                >
                  This Week
                </button>
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-medium ${activeFilter === "this-month" ? "bg-blue-500 border-blue-500 text-white" : "bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50"}`}
                  onClick={() => handleFilterClick(activeFilter === "this-month" ? "all" : "this-month")}
                >
                  This Month
                </button>
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm font-medium ${activeFilter === "all" ? "bg-blue-500 border-blue-500 text-white" : "bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50"}`}
                  onClick={() => handleFilterClick("all")}
                >
                  All
                </button>
              </div>
            </div>

            {/* View toggle */}
            <div className="flex justify-center mb-4">
              <ViewToggle currentView={viewMode} onViewChange={(v: "list" | "table") => setViewMode(v)} />

            </div>

            <div className="overflow-x-auto">
              {/* Table view */}
              <div className={`${viewMode === "table" ? "block" : "hidden"}`}>
                <EnhancedDataTable
                  columns={columns}
                  data={filteredOpportunities}
                  pagination={pagination} 
                  showPagination={true}
                  manualPagination={false}
                  manualSorting={true}
                  onPaginationChange={handleTablePaginationChange}
                  sorting={sorting}
                  onSortingChange={handleSortingChange}
                  isLoading={loadingOpportunities}
                  totalCount={filteredOpportunities.length}
                />
              </div>

              {/* List view (cards) */}
              <div className={`${viewMode === "list" ? "block" : "hidden"}`}>
                <div className="bg-white rounded-lg shadow-md">
                  {loadingOpportunities ? (
                    Array.from({ length: pagination.pageSize }, (_, i) => (
                      <div key={`skeleton-${i}`} className="border-b border-gray-200 p-4 bg-white rounded-lg shadow-md mb-4">
                        <div className="space-y-3">
                          <div className="h-4 rounded skeleton-stream" style={{ width: `${70 + (i % 3) * 6}%` }} />
                          <div className="h-4 rounded skeleton-stream" style={{ width: `${55 + (i % 4) * 7}%` }} />
                          <div className="h-4 rounded skeleton-stream" style={{ width: `${50 + (i % 5) * 6}%` }} />
                          <div className="flex justify-between items-center">
                            <div className="h-4 rounded skeleton-stream" style={{ width: "30%" }} />
                            <div className="h-4 rounded skeleton-stream" style={{ width: "25%" }} />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : filteredOpportunities.length > 0 ? (
                    <>
                    <div className="bg-white rounded-lg shadow-md max-h-[90vh] overflow-hidden p-4">
                    <div className="overflow-y-auto max-h-[80vh]">

                      {paginatedOpportunities.map((opp) => (
                        <div key={opp.id} className="border-b border-gray-200 p-4 bg-white rounded-lg shadow-md mb-4">
                          <div className="flex justify-between items-start">
                            <h3 className="font-bold text-gray-900 text-lg cursor-pointer hover:text-blue-600" onClick={() => openOpportunityGraph(opp)}>
                              {opp.subject ? getFirstNWords(opp.subject.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(), 10) : "No subject"}
                            </h3>
                            <span className="text-l text-gray-500">{opp.processed_graph ? "Processed" : ""}</span>
                          </div>

                          <p className="text-gray-600 mt-1">{getFirstNWords(opp.body ? opp.body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "", 25)}</p>

                          <div className="flex justify-between items-center mt-2">
                            <div className="text-sm text-gray-600">
                              <span>{opp.received_at ? new Date(opp.received_at).toLocaleString() : "No Date"}</span>
                              <span className="mx-2">•</span>
                              <span>{opp.sender || "-"}</span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                            <div className="text-sm text-gray-600">
                              <span>{opp.template_name || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => openOpportunityGraph(opp)} className="bg-blue-500 text-white rounded-lg py-1 px-3 text-sm hover:bg-blue-600 transition duration-200">Details</button>
                              <button onClick={() => handleDelete(opp.id)} className="text-red-500 hover:text-red-700 p-2">
                                <Trash className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      </div>
                      </div>

                      {/* Pagination for list view */}
                      {filteredOpportunities.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg shadow mt-4">
                          <div className="flex-1 text-sm text-gray-700">
                            Showing {pagination.pageIndex * pagination.pageSize + 1} to{" "}
                            {Math.min((pagination.pageIndex + 1) * pagination.pageSize, opportunities.length)} of{" "}
                            {opportunities.length} results
                          </div>
                          <div className="flex items-center space-x-2">
                           <button className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              onClick={() =>
                                handlePaginationChange({
                                  ...pagination,
                                  pageIndex: pagination.pageIndex - 1,
                                })
                              }
                              disabled={pagination.pageIndex === 0}
                            >
                              Previous
                            </button>

                            <span className="text-sm text-gray-700">
                              Page {pagination.pageIndex + 1} of{" "}
                              {Math.ceil(opportunities.length / pagination.pageSize)}
                            </span>

                            <button className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50" 
                              onClick={() =>
                                handlePaginationChange({
                                  ...pagination,
                                  pageIndex: pagination.pageIndex + 1,
                                })
                              }
                              disabled={
                                pagination.pageIndex >=
                                Math.ceil(opportunities.length / pagination.pageSize) - 1
                              }
                            >
                              Next
                            </button>
                          </div>

                          {/* Page size dropdown */}
                          <div className="flex items-center space-x-2 ml-4">
                            <span className="text-sm text-gray-700">Show</span>
                            <select
                              value={pagination.pageSize}
                              onChange={(e) => {
                                const newPageSize = parseInt(e.target.value, 10);
                                setPagination({
                                  pageIndex: 0,
                                  pageSize: newPageSize,
                                });
                              }}
                              className="px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value={10}>Show 10</option>
                              <option value={20}>Show 20</option>
                              {/* <option value={50}>Show 50</option> */}
                            </select>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-8 text-center text-gray-500">No emails found for this filter</div>
                  )}
                </div>
              </div>
            </div>
          </div>) : (
            <div className="text-center text-gray-500 py-8">
              <p>No email found</p>
            </div>
          )}
        </div>
      </div>


    </div>
  );
}
