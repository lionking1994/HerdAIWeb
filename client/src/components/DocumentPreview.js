import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  FileIcon,
  Image,
  FileMusic,
  FileVideo,
  FileArchive,
  FileCode,
  File,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { renderAsync } from "docx-preview";
import DocumentCommentThread from "./DocumentCommentThread";
import DocumentHighlighter from "./DocumentHighlighter";
import "../styles/DocumentComments.css";

const DocumentPreview = ({
  isOpen,
  onClose,
  documentUrl,
  documentTitle,
  taskId,
  commentId,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const containerRef = useRef(null);
  const [documentType, setDocumentType] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [highlightedSections, setHighlightedSections] = useState([]);
  const [documentId, setDocumentId] = useState(null);
  const [selectedText, setSelectedText] = useState("");

  useEffect(() => {
    if (isOpen && documentUrl) {
      setIsLoading(true);
      setError(null);
      setCurrentPage(1);
      loadDocument();
      setShowComments(false);
      setDocumentId(null);
      setSelectedSection(null);
      if (commentId) {
        const urlParts = documentUrl.split("/");
        const fileName = urlParts[urlParts.length - 1];
        setDocumentId(`doc-${fileName}`);
        setSelectedSection({
          id: `doc-${fileName}`,
          title: documentTitle,
          text: null,
        });
        setShowComments(true);
      }
    }
  }, [isOpen, documentUrl]);

  // Function to get the appropriate file icon based on document type
  const getFileIcon = (type) => {
    switch (type) {
      case "pdf":
        return <FileArchive size={24} className="text-red-500" />;
      case "docx":
        return <FileCode size={24} className="text-blue-500" />;
      case "xlsx":
        return <FileText size={24} className="text-green-600" />;
      case "pptx":
        return <FileText size={24} className="text-orange-500" />;
      case "image":
        return <Image size={24} className="text-green-500" />;
      case "audio":
        return <FileMusic size={24} className="text-purple-500" />;
      case "video":
        return <FileVideo size={24} className="text-pink-500" />;
      case "archive":
        return <FileArchive size={24} className="text-yellow-500" />;
      case "code":
        return <FileCode size={24} className="text-gray-700" />;
      case "text":
        return <FileText size={24} className="text-gray-500" />;
      default:
        return <FileIcon size={24} className="text-gray-500" />;
    }
  };

  const getDocumentType = (url) => {
    console.log("url", url);
    const extension = url.split(".").pop()?.toLowerCase();
    if (["docx", "doc"].includes(extension)) return "docx";
    if (["xlsx", "xls"].includes(extension)) return "xlsx";
    if (["pptx", "ppt"].includes(extension)) return "pptx";
    if (["pdf"].includes(extension)) return "pdf";
    if (["txt", "text"].includes(extension)) return "text";
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(extension))
      return "image";
    if (["mp3", "wav", "ogg", "flac"].includes(extension)) return "audio";
    if (["mp4", "webm", "avi", "mov", "wmv"].includes(extension))
      return "video";
    if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return "archive";
    if (
      [
        "js",
        "jsx",
        "ts",
        "tsx",
        "html",
        "css",
        "py",
        "java",
        "c",
        "cpp",
      ].includes(extension)
    )
      return "code";
    return "unknown";
  };

  const loadDocument = async () => {
    try {
      const docType = getDocumentType(documentUrl);
      setDocumentType(docType);

      // Generate a document ID based on the URL if not already set
      if (!documentId) {
        // Extract filename from URL and use it as part of the ID
        const urlParts = documentUrl.split("/");
        const fileName = urlParts[urlParts.length - 1];
        setDocumentId(`doc-${fileName}`);
      }

      if (docType === "docx") {
        await loadDocxDocument();
      } else if (docType === "xlsx") {
        loadOfficeDocument();
      } else if (docType === "pptx") {
        loadOfficeDocument();
      } else if (docType === "pdf") {
        loadPdfDocument();
      } else if (docType === "image") {
        loadImageDocument();
      } else if (docType === "audio") {
        loadAudioDocument();
      } else if (docType === "video") {
        loadVideoDocument();
      } else if (docType === "archive") {
        loadArchiveDocument();
      } else if (docType === "code") {
        loadCodeDocument();
      } else if (docType === "text") {
        await loadTextDocument();
      } else {
        // For unknown types, try to open in new tab
        setError(
          "Preview not supported for this file type. Click download to view."
        );
      }
    } catch (err) {
      console.error("Error loading document:", err);
      setError("Failed to load document. Please try downloading it instead.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDocxDocument = async () => {
    try {
      if (!containerRef.current) return;

      // Clear previous content
      containerRef.current.innerHTML = "";

      // Fetch the document
      const response = await fetch(documentUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      // Render the DOCX document
      try {
        // Render the DOCX document with improved options
        await renderAsync(arrayBuffer, containerRef.current, null, {
          className: "docx-preview",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: true, // Changed to true for better image handling
          useMathMLPolyfill: true, // Enable MathML support
          showChanges: true, // Show document changes/revisions
          debug: false,
          renderHeaders: true, // Ensure headers are rendered
          renderFooters: true, // Ensure footers are rendered
          renderFootnotes: true, // Ensure footnotes are rendered
        });

        // Try to count pages (this is approximate for DOCX)
        const pages = containerRef.current.querySelectorAll(
          ".docx-wrapper section"
        );
        setTotalPages(Math.max(1, pages.length));

        // Add custom styles for better docx rendering
        const styleElement = document.createElement("style");
        styleElement.textContent = `
          .docx-wrapper {
            background-color: white;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
          .docx-wrapper section {
            margin-bottom: 20px;
            border-bottom: 1px solid #f0f0f0;
            padding-bottom: 20px;
          }
          .docx-wrapper table {
            border-collapse: collapse;
            width: 100%;
          }
          .docx-wrapper td, .docx-wrapper th {
            border: 1px solid #ddd;
            padding: 8px;
          }
          .docx-wrapper img {
            max-width: 100%;
            height: auto;
          }
        `;
        containerRef.current.appendChild(styleElement);
      } catch (docxError) {
        console.error("Error in docx-preview rendering:", docxError);

        // Fallback rendering approach if the primary method fails
        containerRef.current.innerHTML = `
          <div style="padding: 20px; text-align: center;">
            <p>There was an issue rendering the DOCX file with full formatting.</p>
            <p>Please try downloading the file for the best viewing experience.</p>
            <button id="docx-download-btn" class="px-4 py-2 mt-4 bg-blue-600 text-white rounded hover:bg-blue-700">
              Download Document
            </button>
          </div>
        `;

        // Add event listener to the download button
        const downloadBtn =
          containerRef.current.querySelector("#docx-download-btn");
        if (downloadBtn) {
          downloadBtn.addEventListener("click", handleDownload);
        }

        throw new Error("DOCX rendering failed, fallback view provided");
      }
    } catch (error) {
      console.error("Error rendering DOCX:", error);
      throw error;
    }
  };

  const loadOfficeDocument = () => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const embedUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
      documentUrl
    )}`;
    console.log("current embedURL", embedUrl);
    containerRef.current.innerHTML = `
      <iframe 
        src="${embedUrl}" 
        width="100%" 
        height="600px" 
        frameborder="0" 
        style="border: none;">
      </iframe>
    `;
  };

  const loadPdfDocument = () => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = `
      <iframe 
        src="${documentUrl}" 
        style="width: 100%; height: 100%; border: none;"
        title="PDF Preview"
      />
    `;
  };

  const loadImageDocument = () => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100%; padding: 20px;">
        <img 
          src="${documentUrl}" 
          style="max-width: 100%; max-height: 100%; object-fit: contain;"
          alt="Document Preview"
        />
      </div>
    `;
  };

  const loadAudioDocument = () => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100%; padding: 20px;">
        <audio 
          src="${documentUrl}" 
          controls
          style="max-width: 100%;"
        />
      </div>
    `;
  };

  const loadVideoDocument = () => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100%; padding: 20px;">
        <video 
          src="${documentUrl}" 
          controls
          style="max-width: 100%;"
        />
      </div>
    `;
  };

  const loadArchiveDocument = () => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100%; padding: 20px;">
        <p>Archive preview not supported.</p>
      </div>
    `;
  };

  const loadCodeDocument = () => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100%; padding: 20px;">
        <p>Code preview not supported. Please download the file to view its contents.</p>
      </div>
    `;
  };

  const loadTextDocument = async () => {
    try {
      const response = await fetch(documentUrl);
      const text = await response.text();

      if (!containerRef.current) return;

      containerRef.current.innerHTML = `
        <div style="padding: 20px; font-family: monospace; white-space: pre-wrap; line-height: 1.5;">
          ${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </div>
      `;
    } catch (error) {
      console.error("Error loading text document:", error);
      throw error;
    }
  };

  const handleDownload = () => {
    // Create a temporary link element and trigger download
    const link = document.createElement("a");
    link.href = documentUrl;
    link.download = documentTitle || "document";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      scrollToPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      scrollToPage(currentPage - 1);
    }
  };

  const scrollToPage = (pageNumber) => {
    if (!containerRef.current) return;

    const pages = containerRef.current.querySelectorAll(
      ".docx-wrapper section"
    );
    if (pages[pageNumber - 1]) {
      pages[pageNumber - 1].scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  // Handle section selection for comments
  const handleSectionSelect = (section, tagText = null) => {
    setSelectedSection(section);
    if (tagText) {
      setSelectedText(tagText);
    }
    setShowComments(true);
  };

  // Toggle comments panel
  const toggleComments = () => {
    if (!showComments && !selectedSection) {
      // If opening comments without a selected section, create a default one for the whole document
      const urlParts = documentUrl.split("/");
      const fileName = urlParts[urlParts.length - 1];
      setDocumentId(`doc-${fileName}`);
      setSelectedSection({
        id: `doc-${fileName}`,
        title: documentTitle,
        text: null,
      });
    } else if (showComments) {
      closeComments();
    }
    setShowComments(!showComments);
  };

  // Close comments panel
  const closeComments = () => {
    // setDocumentId(null);
    setSelectedSection(null);
    setShowComments(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#00000080]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative bg-white rounded-lg shadow-xl w-11/12 max-w-6xl h-[90vh] flex flex-col"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Updated for better mobile responsiveness */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border-b bg-gray-50 rounded-t-lg">
              <div className="flex items-center gap-2 mb-2 sm:mb-0 w-full sm:w-auto">
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-gray-100">
                  {getFileIcon(documentType)}
                </div>
                <h3 className="text-base sm:text-xl font-semibold text-gray-800 truncate max-w-[200px] sm:max-w-md">
                  {documentTitle || "Document Preview"}
                </h3>
                {documentType && (
                  <span className="hidden sm:inline-block px-2 py-1 text-xs font-medium text-gray-600 bg-gray-200 rounded uppercase">
                    {documentType}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleComments();
                  }}
                  className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md hover:bg-gray-200 transition-colors ${
                    showComments
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  <MessageSquare size={16} />
                  <span className="hidden sm:inline">Comments</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">Download</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 sm:p-2 text-gray-500 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Document Viewer with Comments Panel */}
            <div className="flex-1 overflow-hidden relative bg-gray-100 flex">
              {/* Document Content */}
              <div
                className={`relative flex-1 overflow-auto ${
                  showComments ? "w-2/3" : "w-full"
                }`}
              >
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-90 z-10">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
                    <p className="text-gray-600">Loading document...</p>
                  </div>
                )}

                {error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
                    <div className="w-16 h-16 mb-4 flex items-center justify-center">
                      {getFileIcon(documentType)}
                    </div>
                    <p className="text-red-600 mb-4 text-center px-4">
                      {error}
                    </p>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <Download size={16} />
                      Download File
                    </button>
                  </div>
                )}

                <div
                  ref={containerRef}
                  className="w-full h-full relative"
                  style={{
                    backgroundColor:
                      documentType === "docx" ? "white" : "transparent",
                  }}
                />

                {/* Document Highlighter */}
                {!isLoading &&
                  !error &&
                  ["docx", "text", "pdf"].includes(documentType) && (
                    <DocumentHighlighter
                      containerRef={containerRef}
                      documentType={documentType}
                      onSectionSelect={handleSectionSelect}
                      highlightedSections={highlightedSections}
                      taskId={taskId}
                      documentId={documentId}
                    />
                  )}
              </div>

              {/* Comments Panel */}
              {showComments && (
                <div className="w-1/3 border-l border-gray-200 bg-white overflow-hidden">
                  <DocumentCommentThread
                    documentId={documentId}
                    selectedSection={selectedSection}
                    onClose={closeComments}
                    user={JSON.parse(localStorage.getItem("user") || "{}")}
                    taskId={taskId}
                    initialText={selectedText}
                    initComment={commentId}
                  />
                </div>
              )}
            </div>

            {/* Footer with pagination - only show for DOCX files */}
            {documentType === "docx" && !error && (
              <div className="flex items-center justify-between p-2 sm:p-4 border-t bg-gray-50 rounded-b-lg">
                <div className="text-xs sm:text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage <= 1}
                    className={`flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                      currentPage <= 1
                        ? "text-gray-400 cursor-not-allowed bg-gray-200"
                        : "text-gray-700 hover:bg-gray-200 bg-white border"
                    }`}
                  >
                    <ChevronLeft size={14} />
                    <span className="hidden sm:inline">Previous</span>
                  </button>
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages}
                    className={`flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                      currentPage >= totalPages
                        ? "text-gray-400 cursor-not-allowed bg-gray-200"
                        : "text-gray-700 hover:bg-gray-200 bg-white border"
                    }`}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DocumentPreview;
