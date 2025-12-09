import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
// import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import {
  Download,
  Pen,
  Trash2,
  Save,
  X,
  FileText,
  Loader2,
  Eye,
  RotateCcw,
  CheckCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import "./ApprovalPage.css";

const PdfProcessingPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // const user = useSelector((state) => state.auth.user);
  // const dispatch = useDispatch();

  const magicToken =
    searchParams.get("magic_token") || searchParams.get("token");
  const isCompleted = searchParams.get("completed") === "true";

  // Original workflow data
  const [workflowNodeData, setWorkflowNodeData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Store original PDF data as Uint8Array to avoid ArrayBuffer detachment issues
  const [originalPdfData, setOriginalPdfData] = useState(null);

  // Enhanced PDF signature functionality
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfPages, setPdfPages] = useState([]);
  // currentPage state removed - now using scroll view for all pages
  const [signatures, setSignatures] = useState([]);
  const [draggedSignature, setDraggedSignature] = useState(null);
  // const [isProcessing, setIsProcessing] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // PDF Form Field functionality
  const [formFields, setFormFields] = useState([]);
  const [formFieldValues, setFormFieldValues] = useState({});
  const [showFormFields] = useState(true);
  const [activeFormField, setActiveFormField] = useState(null);
  const [formFieldMode, setFormFieldMode] = useState("view"); // 'view', 'edit', 'add'
  // const [hoveredFieldId, setHoveredFieldId] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Canvas refs
  // const canvasRef = useRef(null);
  const signatureCanvasRef = useRef(null);
  // const fileInputRef = useRef(null);
  const pdfCanvasRef = useRef(null);

  // Use workflow node instance id from query param
  const nodeInstanceIdParam = searchParams.get("nodeInstanceId");
  const [nodeInstanceId, setNodeInstanceId] = useState(nodeInstanceIdParam);
  // const [publicPdfUrl, setPublicPdfUrl] = useState(null);

  // Load required libraries
  useEffect(() => {
    const loadLibraries = async () => {
      // Load PDF.js
      if (!window.pdfjsLib) {
        const script1 = document.createElement("script");
        script1.src =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        document.head.appendChild(script1);

        await new Promise((resolve) => {
          script1.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            resolve();
          };
        });
      }

      // Load PDF-lib
      if (!window.PDFLib) {
        const script2 = document.createElement("script");
        script2.src =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
        document.head.appendChild(script2);

        await new Promise((resolve) => {
          script2.onload = resolve;
        });
      }
    };

    loadLibraries().catch(console.error);
  }, []);

  useEffect(() => {
    // If completed=true, show completion component without requiring token
    if (isCompleted) {
      setIsLoading(false);
      return;
    }

    if (!magicToken) {
      setError("Missing token");
      setIsLoading(false);
      return;
    }

    const init = async () => {
      try {
        setIsLoading(true);

        const resp = await axios.get(
          `${process.env.REACT_APP_API_URL}/workflow/pdf-node-data`,
          {
            params: { magic_token: magicToken },
          }
        );
        console.log(resp.data);
        if (resp.data?.success) {
          setWorkflowNodeData(resp.data.node_data);
          setNodeInstanceId(resp.data.node_instance.id);
          if (resp.data.pdfUrl) {
            // setPublicPdfUrl(resp.data.pdfUrl);
            loadPDFFromUrl(resp.data.pdfUrl);
          }
        } else {
          throw new Error(resp.data?.error || "Invalid token");
        }
      } catch (e) {
        console.error(e);
        setError(e.message || "Failed to initialize");
      } finally {
        setIsLoading(false);
      }
    };

    init();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [magicToken, isCompleted]);

  const loadPDFFromUrl = async (url) => {
    try {
      // setIsProcessing(true);

      // Try multiple methods to handle CORS
      let arrayBuffer;

      try {
        // Method 1: Direct fetch with CORS headers
        const response = await fetch(url, {
          mode: "cors",
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        arrayBuffer = await response.arrayBuffer();
      } catch (corsError) {
        console.log("Direct fetch failed, trying proxy method...");

        // Method 2: Use your backend as a proxy
        const token = localStorage.getItem("token");
        const proxyResponse = await fetch(
          `${process.env.REACT_APP_API_URL}/proxy-pdf?url=${encodeURIComponent(
            url
          )}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!proxyResponse.ok) {
          throw new Error(
            `Proxy fetch failed! status: ${proxyResponse.status}`
          );
        }

        arrayBuffer = await proxyResponse.arrayBuffer();
      }

      await loadPDF(arrayBuffer);
    } catch (error) {
      console.error("Error loading PDF from URL:", error);
      toast.error(`Error loading PDF: ${error.message}`);
    } finally {
      // setIsProcessing(false);
    }
  };

  // const handleFileUpload = async (event) => {
  //   const file = event.target.files[0];
  //   if (file && file.type === "application/pdf") {
  //     setPdfFile(file);
  //     setSignatures([]); // Clear existing signatures
  //     const arrayBuffer = await file.arrayBuffer();
  //     await loadPDF(arrayBuffer);
  //   } else {
  //     toast.error("Please select a valid PDF file");
  //   }
  // };

  const loadPDF = async (arrayBuffer) => {
    try {
      // setIsProcessing(true);

      // Create a copy of the ArrayBuffer before PDF.js consumes it
      const arrayBufferCopy = arrayBuffer.slice();

      // Store original PDF data as Uint8Array to avoid ArrayBuffer detachment issues
      // Create a new Uint8Array with a copy of the data to prevent detachment
      const originalData = new Uint8Array(arrayBufferCopy);

      setOriginalPdfData(originalData);

      // Load with PDF.js for rendering
      const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
      const pages = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        pages.push({
          canvas: canvas,
          width: viewport.width,
          height: viewport.height,
          scale: 1.5,
          originalWidth: viewport.width / 1.5,
          originalHeight: viewport.height / 1.5,
          pageNumber: i,
        });
      }

      setPdfPages(pages);

      // Store the copy of the array buffer for PDF rebuilding
      setPdfDoc({ arrayBuffer: arrayBufferCopy });

      // Parse form fields from the PDF after pages are fully set
      // Use a more reliable approach than setTimeout
      await parsePDFFormFieldsAfterPagesLoad(arrayBufferCopy, pages);
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Error loading PDF. Please try again.");
    } finally {
      // setIsProcessing(false);
    }
  };

  // Helper function to extract form fields from PDF using PDF.js annotations
  const extractFormFieldsFromPDF = async (arrayBuffer) => {
    try {
      const newBuffer = arrayBuffer.slice();
      const pdf = await window.pdfjsLib.getDocument(newBuffer).promise;
      const allFields = [];

      console.log(`Processing PDF with ${pdf.numPages} pages`);

      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });

          // Try multiple methods to get annotations
          let annotations = [];

          try {
            // Method 1: Standard getAnnotations()
            annotations = await page.getAnnotations();
          } catch (error) {
            console.warn(`Page ${i}: getAnnotations() failed:`, error);
          }

          // Process found annotations
          annotations.forEach((field, index) => {
            try {

              if (field.subtype === "Widget" || field.isVirtual) {
                if (field.annotationFlags === 132) {
                  return;
                }
                const [x1, y1, x2, y2] = field.rect || [0, 0, 100, 20];

                // Convert PDF coordinates to proper format
                // PDF coordinates are already in the correct format from PDF.js
                const fieldData = {
                  page: i - 1, // Convert to 0-based index
                  name: field.fieldName || `Field_${i}_${index}`,
                  type: field.fieldType || "Tx", // 'Tx', 'Btn', 'Ch', 'Sig'
                  rect: {
                    x: x1,
                    y: y1, // Keep original PDF coordinates for proper conversion later
                    width: Math.max(x2 - x1, 100), // Minimum width
                    height: Math.max(y2 - y1, 20), // Minimum height
                  },
                  value: field.fieldValue || "",
                  pdfField: field.pdfField,
                  isVirtual: field.isVirtual || false,
                  originalField: field,
                  pdfViewport: viewport, // Store viewport for coordinate conversion
                };

                allFields.push(fieldData);
              }
            } catch (fieldError) {
              console.warn(
                `Error processing field ${index} on page ${i}:`,
                fieldError
              );
            }
          });
        } catch (pageError) {
          console.error(`Error processing page ${i}:`, pageError);
        }
      }

      return allFields;
    } catch (error) {
      console.error("Error extracting form fields from PDF:", error);
      return [];
    }
  };

  // Parse form fields after PDF pages are fully loaded
  const parsePDFFormFieldsAfterPagesLoad = async (arrayBuffer, pages) => {
    try {

      // Wait for React state to update and pages to be available
      await new Promise((resolve) => {
        const checkPages = () => {
          if (pdfPages.length > 0 || pages.length > 0) {
            resolve();
          } else {
            setTimeout(checkPages, 50);
          }
        };
        checkPages();
      });

      // Use the passed pages data if pdfPages state isn't ready yet
      const pagesToUse = pdfPages.length > 0 ? pdfPages : pages;

      // Now parse form fields with the loaded pages
      await parsePDFFormFieldsWithPages(arrayBuffer, pagesToUse);
    } catch (error) {
      console.error("Error in parsePDFFormFieldsAfterPagesLoad:", error);
    }
  };

  // Parse PDF form fields using PDF.js annotations with provided pages data
  const parsePDFFormFieldsWithPages = useCallback(
    async (arrayBuffer, pagesData) => {
      try {
        // setIsParsingForms(true);

        // Extract form fields using helper function
        const rawFields = await extractFormFieldsFromPDF(arrayBuffer);
        const extractedFields = [];
        const fieldValues = {};

        // Map field types
        const fieldTypeMap = {
          Tx: "PDFTextField",
          Btn: "PDFCheckBox",
          Ch: "PDFDropdown",
          Sig: "PDFSignature",
        };

        rawFields.forEach((field, index) => {
          // Convert PDF coordinates to canvas coordinates
          const pageData = pagesData[field.page];
          if (pageData) {
            // Get the actual scale and viewport information
            const pdfViewportHeight = pageData.originalHeight;

            // PDF coordinates are in points (1/72 inch)
            // Canvas coordinates are in pixels

            // Calculate accurate scaling factors
            const scaleX = pageData.width / pageData.originalWidth;
            const scaleY = pageData.height / pageData.originalHeight;

            // Use consistent scaling for both position and size
            let canvasX = field.rect.x * scaleX;
            let canvasY =
              (pdfViewportHeight - field.rect.y - field.rect.height) * scaleY;
            let canvasWidth = field.rect.width * scaleX;
            let canvasHeight = field.rect.height * scaleY;

            // Method 2: If we have viewport information from the field, use it for more precision
            if (field.pdfViewport) {
              const viewport = field.pdfViewport;
              const viewportScaleX = pageData.width / viewport.width;
              const viewportScaleY = pageData.height / viewport.height;

              canvasX = field.rect.x * viewportScaleX;
              canvasY =
                (viewport.height - field.rect.y - field.rect.height) *
                viewportScaleY;
              canvasWidth = field.rect.width * viewportScaleX;
              canvasHeight = field.rect.height * viewportScaleY;
            }

            // Ensure reasonable minimum dimensions but preserve original proportions
            const minWidth = Math.max(30, field.rect.width * 0.5);
            const minHeight = Math.max(15, field.rect.height * 0.5);
            canvasWidth = Math.max(canvasWidth, minWidth);
            canvasHeight = Math.max(canvasHeight, minHeight);

            const fieldData = {
              id: `field_${field.page}_${index}`,
              name: field.name || `Field_${field.page}_${index}`,
              type: fieldTypeMap[field.type] || "PDFTextField",
              page: field.page,
              x: canvasX,
              y: canvasY,
              width: canvasWidth,
              height: canvasHeight,
              originalRect: field.rect,
              value: field.value,
              placeholder: field.type === "Sig" ? "Click to add signature" : `Enter ${field.name || "value"}`,
              required: false,
              options: null,
              pdfFieldType: field.type,
              pdfField: field.pdfField, // Store original PDF.js field for later use
            };

            extractedFields.push(fieldData);
            fieldValues[fieldData.id] = fieldData.value;
          }
        });

        setFormFields(extractedFields);
        setFormFieldValues(fieldValues);
      } catch (error) {
        console.error("Error parsing PDF form fields:", error);
        toast.error("Error parsing form fields from PDF");
      } finally {
        // setIsParsingForms(false);
      }
    },
    []
  );


  const deleteSignature = async (id) => {
    setSignatures(signatures.filter((sig) => sig.id !== id));
    // Wait for the canvas to be re-rendered without the deleted signature
    toast.success("Signature removed");
  };

  // Form field management functions
  const updateFormFieldValue = (fieldId, value) => {
    setFormFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const clearFormField = (fieldId) => {
    setFormFieldValues((prev) => ({
      ...prev,
      [fieldId]: "",
    }));
  };


  const clearAllFormFields = () => {
    const clearedValues = {};
    formFields.forEach((field) => {
      clearedValues[field.id] = "";
    });
    setFormFieldValues(clearedValues);
    toast.success("All form fields cleared");
  };



  // Function to render PDF with all signatures and form fields using PDF.js
  const renderPDFWithSignatures = useCallback(async () => {
    if (pdfPages.length > 0) {
      // Render all pages
      for (let pageIndex = 0; pageIndex < pdfPages.length; pageIndex++) {
        const pageData = pdfPages[pageIndex];
        const canvas = document.querySelector(`canvas[data-page="${pageIndex}"]`);
        
        if (!canvas) continue;
        
        const ctx = canvas.getContext("2d");

        // Set canvas dimensions
        canvas.width = pageData.width;
        canvas.height = pageData.height;

        // Clear the entire canvas first
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw PDF page
        ctx.drawImage(pageData.canvas, 0, 0);

        // Draw form fields for this page
        if (showFormFields) {
          const pageFormFields = formFields.filter(
            (field) => field.page === pageIndex
          );

          pageFormFields.forEach((field) => {
            // In preview mode, adjust field size to fit content and skip drawing field backgrounds and borders
            let adjustedField = field;
            if (previewMode && formFieldValues[field.id]) {
              // Calculate text width to adjust field size
              const text = formFieldValues[field.id];
              const fontSize = Math.max(12, field.height * 0.7);
              ctx.font = `${fontSize}px Arial`;
              const textWidth = ctx.measureText(text).width;

              // Adjust field width to fit content with some padding
              const padding = 8; // 4px padding on each side
              const minWidth = Math.max(field.width, textWidth + padding);

              // For very long text, consider wrapping or limiting width
              const maxWidth = field.width * 3; // Don't expand more than 3x original width
              const finalWidth = Math.min(minWidth, maxWidth);

              adjustedField = {
                ...field,
                width: finalWidth,
              };
            }

            if (!previewMode) {
              // Draw field background with different colors for different field types
              if (field.isVirtual) {
                ctx.fillStyle = "rgba(255, 255, 0, 0.15)"; // Yellow for virtual fields
              } else {
                ctx.fillStyle = "rgba(34, 197, 94, 0.15)"; // Green for detected fields
              }
              ctx.fillRect(
                adjustedField.x,
                adjustedField.y + 15,
                adjustedField.width,
                adjustedField.height - 15
              );

              // Draw field border with different colors
              if (activeFormField?.id === field.id) {
                ctx.strokeStyle = "#3b82f6"; // Blue for active field
                ctx.lineWidth = 2;
              } else if (field.isVirtual) {
                ctx.strokeStyle = "#f59e0b"; // Orange for virtual fields
                ctx.lineWidth = 1;
              } else if (field.pdfFieldType === "Sig") {
                // Check if signature field has an existing signature value
                const hasExistingSignature = field.value && field.value.trim() !== "";
                if (hasExistingSignature) {
                  ctx.strokeStyle = "#6b7280"; // Gray for signature fields with existing signature
                } else {
                  ctx.strokeStyle = "#22c55e"; // Green for empty signature fields
                }
                ctx.lineWidth = 2; // Thicker border for signature fields
              } else {
                ctx.strokeStyle = "#22c55e"; // Green for detected fields
                ctx.lineWidth = 1;
              }
              ctx.strokeRect(
                adjustedField.x,
                adjustedField.y + 15,
                adjustedField.width,
                adjustedField.height - 15
              );
            }

            // Draw field value if it exists
            if (formFieldValues[field.id]) {
              // Handle signature fields differently
              if (field.pdfFieldType === "Sig") {
                // For signature fields, try to draw the signature image
                const signatureData = formFieldValues[field.id];
                if (signatureData && signatureData.startsWith('data:image/')) {
                  const img = new Image();
                  img.onload = () => {
                    ctx.drawImage(
                      img,
                      adjustedField.x + 2,
                      adjustedField.y + 2,
                      adjustedField.width - 4,
                      adjustedField.height - 4
                    );
                  };
                  img.src = signatureData;
                } else {
                  // If no signature image, show placeholder text
                  ctx.fillStyle = "#9ca3af";
                  ctx.font = `${Math.max(10, adjustedField.height * 0.5)}px Arial`;
                  ctx.fillText(
                    "Click to add signature",
                    adjustedField.x + 2,
                    adjustedField.y + adjustedField.height - 4
                  );
                }
              } else {
                // Handle other field types
                ctx.fillStyle = "#000000";
                ctx.font = `${Math.max(12, adjustedField.height * 0.7)}px Arial`;

                let displayValue = formFieldValues[field.id];

                // Handle different field types
                if (field.pdfFieldType === "Btn") {
                  // Checkbox
                  displayValue = formFieldValues[field.id] === "true" ? "✓" : "☐";
                  ctx.fillText(
                    displayValue,
                    adjustedField.x + 2,
                    adjustedField.y + adjustedField.height - 4
                  );
                } else if (field.pdfFieldType === "Ch") {
                  // Dropdown
                  displayValue = formFieldValues[field.id];
                  ctx.fillText(
                    displayValue,
                    adjustedField.x + 2,
                    adjustedField.y + adjustedField.height - 4
                  );
                  // Draw dropdown arrow (only in non-preview mode)
                  if (!previewMode) {
                    ctx.fillStyle = "#666666";
                    ctx.fillText(
                      "▼",
                      adjustedField.x + adjustedField.width - 15,
                      adjustedField.y + adjustedField.height - 4
                    );
                  }
                } else {
                  // Text field - handle text truncation for very long text
                  let textToDisplay = displayValue;
                  if (previewMode && adjustedField.width < field.width * 3) {
                    // If field is still constrained, truncate text with ellipsis
                    const maxTextWidth = adjustedField.width - 4; // Account for padding
                    let truncatedText = textToDisplay;
                    while (
                      ctx.measureText(truncatedText + "...").width > maxTextWidth &&
                      truncatedText.length > 0
                    ) {
                      truncatedText = truncatedText.slice(0, -1);
                    }
                    if (truncatedText.length < textToDisplay.length) {
                      textToDisplay = truncatedText + "...";
                    }
                  }

                  ctx.fillText(
                    textToDisplay,
                    adjustedField.x + 2,
                    adjustedField.y + adjustedField.height - 4
                  );
                }
              }
            } else if (!previewMode) {
              // Draw placeholder text (only in non-preview mode)
              ctx.fillStyle = "#9ca3af";
              ctx.font = `${Math.max(10, field.height * 0.5)}px Arial`;
              const placeholderText = field.pdfFieldType === "Sig" 
                ? "Click to add signature" 
                : field.placeholder;
              ctx.fillText(
                placeholderText,
                field.x + 2,
                field.y + field.height - 4
              );
            }
          });
        }

        // Draw signatures for this page
        const pageSignatures = signatures.filter(
          (sig) => sig.page === pageIndex
        );

        // Draw all signatures for this page
        for (const signature of pageSignatures) {
          const img = new Image();
          await new Promise((resolve) => {
            img.onload = () => {
              ctx.drawImage(
                img,
                signature.x,
                signature.y,
                signature.width,
                signature.height
              );

              // Add a subtle border to indicate the signature is interactive
              if (signature.id === draggedSignature?.id) {
                // Highlight the signature being dragged
                ctx.strokeStyle = "#3b82f6";
                ctx.lineWidth = 2;
                ctx.strokeRect(
                  signature.x - 2,
                  signature.y - 2,
                  signature.width + 4,
                  signature.height + 4
                );
              } else {
                // Add a subtle border to indicate interactivity
                ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
                ctx.lineWidth = 1;
                ctx.strokeRect(
                  signature.x - 1,
                  signature.y - 1,
                  signature.width + 2,
                  signature.height + 2
                );
              }
              resolve();
            };
            img.src = signature.data;
          });
        }
      }
    }
  }, [
    pdfPages,
    signatures,
    formFields,
    formFieldValues,
    showFormFields,
    activeFormField,
    draggedSignature,
    previewMode,
  ]);

  useEffect(() => {
    renderPDFWithSignatures();
  }, [renderPDFWithSignatures]);

  // Parse form fields when pdfPages are loaded (fallback safety mechanism)
  useEffect(() => {
    if (
      pdfPages.length > 0 &&
      pdfDoc &&
      pdfDoc.arrayBuffer &&
      formFields.length === 0
    ) {
      console.log("PDF pages loaded, parsing form fields as fallback...");
      parsePDFFormFieldsWithPages(pdfDoc.arrayBuffer, pdfPages).catch(
        (error) => {
          console.error("Error in fallback form field parsing:", error);
        }
      );
    }
  }, [pdfPages, pdfDoc, formFields.length, parsePDFFormFieldsWithPages]);

  // Add mouse event handlers for signature interaction
  const handleCanvasMouseMove = (e, pageIndex) => {
    // In preview mode, disable all interactions
    if (previewMode) return;

    if (draggedSignature) {
      const canvas = e.target;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - 75; // Center on cursor
      const y = e.clientY - rect.top - 37.5;

      setSignatures((prev) =>
        prev.map((sig) =>
          sig.id === draggedSignature.id ? { ...sig, x, y, page: pageIndex } : sig
        )
      );

      // Trigger immediate re-render during drag
      renderPDFWithSignatures();
    } else {
      // Check for field hover
      const canvas = e.target;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const pageFormFields = formFields.filter(
        (field) => field.page === pageIndex
      );

      let foundHover = false;
      for (const field of pageFormFields) {
        if (
          x >= field.x &&
          x <= field.x + field.width &&
          y >= field.y &&
          y <= field.y + field.height
        ) {
          // setHoveredFieldId(field.id);
          foundHover = true;
          break;
        }
      }

      if (!foundHover) {
        // setHoveredFieldId(null);
      }
    }
  };

  const handleCanvasMouseUp = () => {
    if (draggedSignature) {
      setDraggedSignature(null);
      renderPDFWithSignatures();
    }
  };

  const handleCanvasMouseLeave = () => {
    // setHoveredFieldId(null);
  };

  const handleCanvasMouseDown = (e, pageIndex) => {
    // In preview mode, disable all interactions
    if (previewMode) return;

    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on a form field
    const pageFormFields = formFields.filter(
      (field) => field.page === pageIndex
    );
    for (const field of pageFormFields) {
      if (
        x >= field.x &&
        x <= field.x + field.width &&
        y >= field.y &&
        y <= field.y + field.height
      ) {
        // Check if it's a signature field
        if (field.pdfFieldType === "Sig") {
          // Show signature modal for signature fields
          setActiveFormField(field);
          setShowSignatureModal(true);
          return;
        } else {
          // For other form fields, show edit mode
          setActiveFormField(field);
          setFormFieldMode("edit");
          return;
        }
      }
    }

    // Check if clicking on a signature
    const pageSignatures = signatures.filter((sig) => sig.page === pageIndex);

    for (const signature of pageSignatures) {
      if (
        x >= signature.x &&
        x <= signature.x + signature.width &&
        y >= signature.y &&
        y <= signature.y + signature.height
      ) {
        // Start dragging this signature
        setDraggedSignature(signature);
        return;
      }
    }

    // Clear active form field if clicking elsewhere
    setActiveFormField(null);
    setFormFieldMode("view");
  };

  // Rebuild PDF with signatures and form field data using PDF-lib
  const rebuildPDFWithSignatures = async () => {
    if (!originalPdfData) {
      toast.error("No PDF document available.");
      return null;
    }

    try {
      console.log("Starting PDF rebuild process...");
      console.log("Form fields:", formFields.length);
      console.log("Signatures:", signatures.length);
      console.log("Form field values:", formFieldValues);

      // Use the original PDF data directly since it's now a proper copy

      const arrayBuffer = originalPdfData.buffer.slice(0);

      // Create a new PDF document from the array buffer
      const pdfDocCopy = await window.PDFLib.PDFDocument.load(arrayBuffer);
      const pages = pdfDocCopy.getPages();

      // Fill form fields with user data using PDF-lib
      try {
        const form = pdfDocCopy.getForm();
        const fields = form.getFields();

        console.log("PDF form fields found:", fields.length);

        // Update existing form fields with user input
        for (const field of formFields) {
          const fieldValue = formFieldValues[field.id];
          console.log(field.name, fieldValue, field.pdfField);
          if (fieldValue && fieldValue.trim() !== "") {
            try {
              // Find the corresponding PDF-lib field by name
              const pdfField = fields.find((f) => f.getName() === field.name);
              if (pdfField) {
                console.log(
                  `Updating field ${field.name} with value: ${fieldValue}`
                );

                if (field.pdfFieldType === "Tx") {
                  // TextField
                  pdfField.setText(fieldValue);
                } else if (field.pdfFieldType === "Btn") {
                  // CheckBox/Button
                  if (fieldValue === "true" || fieldValue === "checked") {
                    pdfField.check();
                  } else {
                    pdfField.uncheck();
                  }
                } else if (field.pdfFieldType === "Ch") {
                  // Dropdown/Choice
                  try {
                    pdfField.select(fieldValue);
                  } catch (selectError) {
                    console.warn(
                      `Selection failed for ${field.name}, trying text:`,
                      selectError
                    );
                    // If selection fails, try to set as text
                    pdfField.setText(fieldValue);
                  }
                } else if (field.pdfFieldType === "Sig") {
                  // Signature field - handle signature image
                  if (fieldValue.startsWith('data:image/')) {
                    try {
                      // Convert data URL to image and embed in PDF
                      const imageBytes = await fetch(fieldValue).then(res => res.arrayBuffer());
                      const signatureImage = await pdfDocCopy.embedPng(imageBytes);
                      
                      // Get the page for this field
                      const page = pages[field.page];
                      const pageData = pdfPages[field.page];
                      
                      if (page && pageData) {
                        // Convert field coordinates from canvas to PDF coordinates
                        const scaleX = pageData.originalWidth / pageData.width;
                        const scaleY = pageData.originalHeight / pageData.height;
                        
                        const pdfX = field.x * scaleX;
                        const pdfY = pageData.originalHeight - (field.y + field.height) * scaleY;
                        const pdfWidth = field.width * scaleX;
                        const pdfHeight = field.height * scaleY;
                        
                        // Draw the signature image on the page
                        page.drawImage(signatureImage, {
                          x: pdfX,
                          y: pdfY,
                          width: pdfWidth,
                          height: pdfHeight,
                          opacity: 1,
                        });
                        
                        console.log(`Signature added to field ${field.name} on page ${field.page + 1}`);
                      }
                    } catch (sigError) {
                      console.warn(`Error embedding signature for field ${field.name}:`, sigError);
                    }
                  } else {
                    // If it's not an image, treat as text
                    pdfField.setText(fieldValue);
                  }
                }
              } else {
                console.warn(`PDF field not found for: ${field.name}`);
              }
            } catch (fieldError) {
              console.warn(`Error updating field ${field.name}:`, fieldError);
            }
          }
        }
      } catch (formError) {
        console.warn("Error updating form fields:", formError);
      }

      // Process signatures for each page
      for (const signature of signatures) {
        const page = pages[signature.page];
        const pageData = pdfPages[signature.page];

        if (!page || !pageData) continue;

        // Convert signature from canvas coordinates to PDF coordinates
        const scaleX = pageData.originalWidth / pageData.width;
        const scaleY = pageData.originalHeight / pageData.height;

        // PDF coordinates start from bottom-left, canvas from top-left
        const pdfX = signature.x * scaleX;
        const pdfY =
          pageData.originalHeight -
          signature.y * scaleY -
          signature.height * scaleY;
        const pdfWidth = signature.width * scaleX;
        const pdfHeight = signature.height * scaleY;

        try {
          // Convert signature image to PNG bytes
          const signatureImageBytes = await fetch(signature.data).then((res) =>
            res.arrayBuffer()
          );
          const signatureImage = await pdfDocCopy.embedPng(signatureImageBytes);

          // Draw the signature on the page
          page.drawImage(signatureImage, {
            x: pdfX,
            y: pdfY,
            width: pdfWidth,
            height: pdfHeight,
            opacity: 1,
          });

          console.log(
            `Signature added to page ${
              signature.page + 1
            } at (${pdfX}, ${pdfY})`
          );
        } catch (imageError) {
          console.error("Error embedding signature:", imageError);
        }
      }


      // Save the PDF and return bytes
      const pdfBytes = await pdfDocCopy.save();
      console.log("PDF rebuild completed successfully");
      return pdfBytes;
    } catch (error) {
      console.error("Error creating signed PDF:", error);
      toast.error("Error creating signed PDF. Please try again.");
      return null;
    }
  };


  // Render PDF pages with signatures - updated to use the new function
  useEffect(() => {
    renderPDFWithSignatures();
  }, [pdfPages, signatures, renderPDFWithSignatures]);

  // Legacy signature modal functions (for backward compatibility)
  const [isDrawing, setIsDrawing] = useState(false);
  
  const startDrawingLegacy = (e) => {
    setIsDrawing(true);
    const canvas = signatureCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawLegacy = (e) => {
    if (!isDrawing) return;

    const canvas = signatureCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000000";
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawingLegacy = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignatureLegacy = () => {
    const canvas = signatureCanvasRef.current;
    const dataURL = canvas.toDataURL("image/png");
    
    if (activeFormField && activeFormField.pdfFieldType === "Sig") {
      // Update the signature field value
      updateFormFieldValue(activeFormField.id, dataURL);
      setActiveFormField(null);
      toast.success("Signature saved to field!");
    } else {
      // Legacy behavior for non-field signatures
      setSignatureData(dataURL);
      toast.success("Signature saved!");
    }
    
    setShowSignatureModal(false);
  };

  const handleSavePdfWithSignature = async () => {
    if (!signatureData) {
      toast.error("Please add a signature first");
      return;
    }

    setIsSaving(true);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/workflow/pdf-signature/${nodeInstanceId}`,
        {
          signature: signatureData,
          pdfUrl: nodeData?.config?.pdfUrl,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        toast.success("PDF with signature saved successfully!");
      } else {
        toast.error(response.data.error || "Failed to save PDF with signature");
      }
    } catch (err) {
      console.error("Error saving PDF with signature:", err);
      toast.error("Error saving PDF with signature");
    } finally {
      setIsSaving(false);
    }
  };

  // Extract data from the response
  const nodeData = workflowNodeData?.node_data;
  const pdfUrl = nodeData?.config?.pdfUrl;

  const totalSignatures = signatures.length;

  // Page navigation functions removed - now using scroll view

  // Function to download the rebuilt PDF
  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);

      // Check if we have any signatures or form field data
      const hasSignatures = signatures.length > 0;
      const hasFormData = Object.values(formFieldValues).some(
        (value) => value.trim() !== ""
      );

      if (!hasSignatures && !hasFormData) {
        toast.error(
          "Please add signatures or fill form fields before downloading."
        );
        return;
      }

      // Rebuild PDF with signatures and form data using PDF-lib
      const pdfBytes = await rebuildPDFWithSignatures();

      if (!pdfBytes) {
        toast.error("Failed to rebuild PDF with signatures and form data");
        return;
      }

      // Create download link
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `processed-document-${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Error downloading PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  // Function to complete the PDF node and continue to next node
  const handleCompleteNode = async () => {
    try {
      setIsCompleting(true);
      const token = localStorage.getItem("token");

      // Check if we have any signatures or form field data
      const hasSignatures = signatures.length > 0;
      const hasFormData = Object.values(formFieldValues).some(
        (value) => value.trim() !== ""
      );

      if (!hasSignatures && !hasFormData) {
        toast.error(
          "Please add signatures or fill form fields before completing."
        );
        return;
      }

      // Rebuild PDF with signatures and form data using PDF-lib
      const pdfBytes = await rebuildPDFWithSignatures();

      if (!pdfBytes) {
        toast.error("Failed to rebuild PDF with signatures and form data");
        return;
      }

      // Create FormData to send the PDF file
      const formData = new FormData();
      const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
      formData.append("pdf", pdfBlob, "processed-document.pdf");
      formData.append("magic_token", magicToken);

      // Include form field data in the request
      formData.append(
        "formData",
        JSON.stringify({
          signatures: signatures.length,
          formFields: formFields.length,
          filledFields: Object.keys(formFieldValues).filter(
            (key) => formFieldValues[key].trim() !== ""
          ).length,
          fieldData: formFieldValues,
        })
      );

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/workflow/pdf-complete`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...(magicToken
              ? {}
              : {
                  Authorization: `Bearer ${token}`,
                }),
          },
        }
      );

      if (response.data.success) {
        const message =
          hasSignatures && hasFormData
            ? "PDF with signatures and form data completed! Continuing to next workflow step..."
            : hasSignatures
            ? "PDF with signatures completed! Continuing to next workflow step..."
            : "PDF with form data completed! Continuing to next workflow step...";

        toast.success(message);

        // Navigate back to workflow or dashboard after a short delay
        setTimeout(() => {
          if (magicToken) {
            navigate("/public/pdf?completed=true");
          } else {
            navigate("/workflow-instances");
          }
        }, 2000);
      } else {
        toast.error(response.data.error || "Failed to complete PDF processing");
      }
    } catch (error) {
      console.error("Error completing PDF node:", error);
      toast.error("Error completing PDF processing");
    } finally {
      setIsCompleting(false);
    }
  };

  // Show completion component if completed=true
  if (isCompleted) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Document Completed Successfully!
            </h1>
            <p className="text-gray-600 mb-6">
              Your PDF document has been processed and signed. The workflow will
              continue automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-600" />
            <p className="text-gray-600">Loading PDF...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex-grow container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* PDF Viewer - Full Width */}
          <div className="xl:col-span-4">
            {pdfPages.length > 0 ? (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">

                {/* PDF Info and Controls */}
                <div
                  className={`px-6 py-3 border-b bg-[#93d4ff] `}
                >
                  <div className="flex items-center justify-between">

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setPreviewMode(!previewMode)}
                        className={`px-3 py-1 text-xs rounded ${
                          previewMode
                            ? "bg-blue-600 text-white"
                            : "bg-gray-300 text-gray-700"
                        }`}
                      >
                        {previewMode ? "Exit Preview" : "Preview"}
                      </button>
                      {formFields.length > 0 && (
                        <button
                          onClick={clearAllFormFields}
                          className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Clear All Fields
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Signature Management */}
                {signatures.length > 0 && (
                  <div className="bg-yellow-50 px-6 py-3 border-b">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-yellow-800">
                        📝 Signatures ({totalSignatures})
                      </h4>
                      <button
                        onClick={async () => {
                          setSignatures([]);
                          await renderPDFWithSignatures();
                          toast.success("All signatures removed");
                        }}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {signatures.map((signature) => (
                        <div
                          key={signature.id}
                          className="bg-white border border-yellow-200 rounded-lg p-3 flex items-center space-x-3"
                        >
                          <img
                            src={signature.data}
                            alt="Signature"
                            className="w-12 h-8 object-contain border border-gray-200 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-600 truncate">
                              Page {signature.page + 1}
                            </p>
                            <p className="text-xs text-gray-500">
                              Position: ({Math.round(signature.x)},{" "}
                              {Math.round(signature.y)})
                            </p>
                          </div>
                          <button
                            onClick={() => deleteSignature(signature.id)}
                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                            title="Delete signature"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className="p-6 overflow-auto"
                  style={{ maxHeight: "80vh" }}
                >
                  <div className="space-y-4">
                    {pdfPages.map((pageData, pageIndex) => (
                      <div key={pageIndex} className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600">
                            Page {pageIndex + 1}
                          </span>
                          <div className="text-xs text-gray-500">
                            {signatures.filter(sig => sig.page === pageIndex).length} signatures • {' '}
                            {formFields.filter(f => f.page === pageIndex).length} form fields
                          </div>
                        </div>
                        <canvas
                          ref={pageIndex === 0 ? pdfCanvasRef : null}
                          data-page={pageIndex}
                          onMouseDown={(e) => handleCanvasMouseDown(e, pageIndex)}
                          onMouseMove={(e) => handleCanvasMouseMove(e, pageIndex)}
                          onMouseUp={handleCanvasMouseUp}
                          onMouseLeave={handleCanvasMouseLeave}
                          className={`border border-gray-200 max-w-full shadow-md rounded ${
                            previewMode ? "cursor-default" : "cursor-crosshair"
                          }`}
                          style={{ display: "block", margin: "0 auto" }}
                          width={pageData.width}
                          height={pageData.height}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* PDF Actions */}
                <div className="bg-gray-50 px-6 py-4 border-t">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Progress:</span>
                        <span className="ml-2">
                          {signatures.length} signature
                          {signatures.length !== 1 ? "s" : ""} •{" "}
                          {
                            Object.values(formFieldValues).filter((v) =>
                              v.trim()
                            ).length
                          }{" "}
                          of {formFields.length} fields filled
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={handleDownloadPDF}
                        disabled={
                          isDownloading ||
                          (signatures.length === 0 &&
                            Object.values(formFieldValues).every(
                              (v) => !v.trim()
                            ))
                        }
                        className="flex items-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                      >
                        {isDownloading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Download className="w-5 h-5" />
                        )}
                        <span>
                          {isDownloading ? "Downloading..." : "Download PDF"}
                        </span>
                      </button>
                      <button
                        onClick={handleCompleteNode}
                        disabled={
                          isCompleting ||
                          (signatures.length === 0 &&
                            Object.values(formFieldValues).every(
                              (v) => !v.trim()
                            ))
                        }
                        className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                      >
                        {isCompleting ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-5 h-5" />
                        )}
                        <span>
                          {isCompleting
                            ? "Completing..."
                            : "Done - Continue Workflow"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : pdfUrl && (
              <div className="bg-white border border-orange-200 rounded-lg p-6">
                <div className="space-y-6">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-5 h-5 text-orange-600" />
                        <h3 className="text-lg font-semibold text-orange-900">
                          PDF Document
                        </h3>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setShowSignatureModal(true)}
                          className="flex items-center space-x-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                        >
                          <Pen className="w-4 h-4" />
                          <span>Add Signature</span>
                        </button>
                        {signatureData && (
                          <button
                            onClick={handleSavePdfWithSignature}
                            disabled={isSaving}
                            className="flex items-center space-x-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                          >
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            <span>Save PDF</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* PDF Preview using PDF.js instead of iframe */}
                      <div className="border border-gray-300 rounded-lg overflow-hidden">
                        <div className="p-4 bg-gray-50">
                          <p className="text-sm text-gray-600 mb-4">
                            PDF loaded from URL. Please upload a PDF file to use
                            the enhanced signature features.
                          </p>
                          <div className="flex space-x-2">
                            <a
                              href={pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                            >
                              <Eye className="w-4 h-4" />
                              <span>View in New Tab</span>
                            </a>
                            <a
                              href={pdfUrl}
                              download
                              className="flex items-center space-x-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                            >
                              <Download className="w-4 h-4" />
                              <span>Download</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Signature Preview */}
                  {signatureData && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="text-md font-semibold text-gray-900 mb-2">
                        Your Signature
                      </h4>
                      <div className="flex items-center space-x-4">
                        <img
                          src={signatureData}
                          alt="Signature"
                          className="max-h-20 border border-gray-300 rounded"
                        />
                        <button
                          onClick={() => setShowSignatureModal(true)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                          Edit Signature
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) }
          </div>
        </div>


        {/* Form Field Input Modal */}
        {activeFormField && formFieldMode === "edit" && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText size={20} className="text-green-600" />
                  Edit Form Field
                </h3>
                <button
                  onClick={() => {
                    setActiveFormField(null);
                    setFormFieldMode("view");
                  }}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Value
                  </label>
                  {activeFormField.pdfFieldType === "Btn" ? (
                    // Checkbox field
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formFieldValues[activeFormField.id] === "true"}
                        onChange={(e) =>
                          updateFormFieldValue(
                            activeFormField.id,
                            e.target.checked ? "true" : "false"
                          )
                        }
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">
                        {formFieldValues[activeFormField.id] === "true"
                          ? "Checked"
                          : "Unchecked"}
                      </span>
                    </div>
                  ) : activeFormField.pdfFieldType === "Ch" ? (
                    // Dropdown field
                    <select
                      value={formFieldValues[activeFormField.id] || ""}
                      onChange={(e) =>
                        updateFormFieldValue(activeFormField.id, e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select option</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="Maybe">Maybe</option>
                    </select>
                  ) : (
                    // Text field
                    <textarea
                      value={formFieldValues[activeFormField.id] || ""}
                      onChange={(e) =>
                        updateFormFieldValue(activeFormField.id, e.target.value)
                      }
                      placeholder={activeFormField.placeholder}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Page {activeFormField.page + 1}
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => clearFormField(activeFormField.id)}
                      className="text-sm text-orange-600 hover:text-orange-800"
                    >
                      Clear Field
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setActiveFormField(null);
                    setFormFieldMode("view");
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm flex-1"
                >
                  <X size={16} />
                  Close
                </button>
                <button
                  onClick={() => {
                    setActiveFormField(null);
                    setFormFieldMode("view");
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex-1"
                >
                  <Save size={16} />
                  Save & Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legacy Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {activeFormField && activeFormField.pdfFieldType === "Sig" 
                ? `Add Signature to ${activeFormField.name}` 
                : "Add Your Signature"}
            </h3>

            <div className="border border-gray-300 rounded-lg mb-4">
              <canvas
                ref={signatureCanvasRef}
                width={400}
                height={200}
                className="w-full cursor-crosshair"
                onMouseDown={startDrawingLegacy}
                onMouseMove={drawLegacy}
                onMouseUp={stopDrawingLegacy}
                onMouseLeave={stopDrawingLegacy}
                onTouchStart={(e) => {
                  e.preventDefault();
                  const touch = e.touches[0];
                  const mouseEvent = new MouseEvent("mousedown", {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                  });
                  startDrawingLegacy(mouseEvent);
                }}
                onTouchMove={(e) => {
                  e.preventDefault();
                  const touch = e.touches[0];
                  const mouseEvent = new MouseEvent("mousemove", {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                  });
                  drawLegacy(mouseEvent);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  stopDrawingLegacy();
                }}
              />
            </div>

            <div className="flex space-x-2">
              <button
                onClick={clearSignature}
                className="flex items-center space-x-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Clear</span>
              </button>
              <button
                onClick={saveSignatureLegacy}
                className="flex items-center space-x-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
              <button
                onClick={() => setShowSignatureModal(false)}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PdfProcessingPage;
