import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';

const DocumentHighlighter = ({ 
  containerRef, 
  documentType, 
  onSectionSelect,
  highlightedSections = [],
  taskId,
  documentId
}) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState(null);
  const [activeHighlights, setActiveHighlights] = useState([]);
  const [selectionRange, setSelectionRange] = useState(null);
  
  const highlighterRef = useRef(null);
  
  // Initialize highlights from props
  useEffect(() => {
    if (highlightedSections && highlightedSections.length > 0) {
      setActiveHighlights(highlightedSections);
      applyHighlights(highlightedSections);
    }
  }, [highlightedSections]);
  
  // Load highlights from database when documentId changes
  useEffect(() => {
    if (documentId) {
      loadHighlightsFromDatabase();
    }
  }, [documentId]);
  
  // Load highlights from database
  const loadHighlightsFromDatabase = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/documents/highlights/${documentId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data.success && response.data.highlights) {
        setActiveHighlights(response.data.highlights);
        applyHighlights(response.data.highlights);
      }
    } catch (error) {
      console.error('Error loading highlights:', error);
      // Don't show error toast to avoid disrupting user experience
    }
  };
  
  // Save highlight to database
  const saveHighlightToDatabase = async (highlight) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_API_URL}/documents/add-highlight`,
        {
          documentId,
          taskId,
          text: highlight.text,
          color: highlight.color,
          position: JSON.stringify(highlight.position),
          rangeData: JSON.stringify(highlight.rangeData)
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
    } catch (error) {
      console.error('Error saving highlight:', error);
      toast.error('Failed to save highlight');
    }
  };
  
  // Set up event listeners for text selection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleMouseUp = (e) => {
      const selection = window.getSelection();
      if (!selection.toString().trim()) return;
      
      // Get selected text
      const text = selection.toString().trim();
      if (text) {
        setSelectedText(text);
        
        // Store the selection range for precise highlighting
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          setSelectionRange({
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset
          });
        }
        
        // Get selection position for context menu
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        setSelectionPosition({
          top: rect.bottom - containerRect.top,
          left: rect.left - containerRect.left + (rect.width / 2)
        });
        
        setIsSelecting(true);
      }
    };
    
    container.addEventListener('mouseup', handleMouseUp);
    
    // Click outside to cancel selection
    const handleClickOutside = (e) => {
      if (isSelecting && highlighterRef.current && !highlighterRef.current.contains(e.target)) {
        setIsSelecting(false);
        setSelectedText('');
        setSelectionPosition(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [containerRef, isSelecting]);
  
  // Apply highlights to the document
  const applyHighlights = (highlights) => {
    const container = containerRef.current;
    if (!container) return;
    
    // Different highlighting approach based on document type
    if (documentType === 'docx') {
      // For DOCX documents
      applyDocxHighlights(container, highlights);
    } else if (documentType === 'pdf') {
      // For PDF documents - would require PDF.js integration
      toast.info('PDF highlighting will be implemented in a future update');
    } else if (documentType === 'text') {
      // For text documents
      applyTextHighlights(container, highlights);
    } else if (['xlsx', 'pptx'].includes(documentType)) {
      // For Office documents in iframe
      toast.info('Office document highlighting will be implemented in a future update');
    }
  };
  
  // Apply highlights to DOCX documents
  const applyDocxHighlights = (container, highlights) => {
    // Find all text nodes in the DOCX container
    const textNodes = [];
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    // Apply highlights to matching text
    highlights.forEach(highlight => {
      const text = highlight.text;
      if (!text) return;
      
      // If we have specific range data, use it for precise highlighting
      if (highlight.rangeData) {
        try {
          const rangeData = typeof highlight.rangeData === 'string' 
            ? JSON.parse(highlight.rangeData) 
            : highlight.rangeData;
          
          // Find the closest matching node and position
          // This is a simplified approach - in a real implementation,
          // you would need more sophisticated node path tracking
          for (let i = 0; i < textNodes.length; i++) {
            const node = textNodes[i];
            const content = node.textContent;
            const index = content.indexOf(text);
            
            if (index !== -1) {
              // Create a range for this specific instance
              const range = document.createRange();
              range.setStart(node, index);
              range.setEnd(node, index + text.length);
              
              const span = document.createElement('span');
              span.className = 'highlighted-text';
              span.dataset.highlightId = highlight.id;
              span.style.backgroundColor = 'rgba(255, 230, 0, 0.5)';
              span.style.cursor = 'pointer';
              
              // Add click event to open comments with the highlighted text
              span.addEventListener('click', () => {
                if (onSectionSelect) {
                  onSectionSelect(highlight, `#${text}`);
                }
              });
              
              range.surroundContents(span);
              
              // We've modified the DOM, so break to avoid issues with the walker
              break;
            }
          }
        } catch (error) {
          console.error('Error applying highlight with range data:', error);
          // Fall back to text-based highlighting
          applyTextBasedHighlight(textNodes, highlight, text);
        }
      } else {
        // Fall back to text-based highlighting
        applyTextBasedHighlight(textNodes, highlight, text);
      }
    });
  };
  
  // Helper function for text-based highlighting
  const applyTextBasedHighlight = (textNodes, highlight, text) => {
    for (const node of textNodes) {
      const content = node.textContent;
      const index = content.indexOf(text);
      
      if (index !== -1) {
        // Split the text node and wrap the highlighted part
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + text.length);
        
        const span = document.createElement('span');
        span.className = 'highlighted-text';
        span.dataset.highlightId = highlight.id;
        span.style.backgroundColor = 'rgba(255, 230, 0, 0.5)';
        span.style.cursor = 'pointer';
        
        // Add click event to open comments with the highlighted text
        span.addEventListener('click', () => {
          if (onSectionSelect) {
            onSectionSelect(highlight, `#${text}`);
          }
        });
        
        range.surroundContents(span);
        
        // We've modified the DOM, so break to avoid issues with the walker
        break;
      }
    }
  };
  
  // Apply highlights to text documents
  const applyTextHighlights = (container, highlights) => {
    // Get the text content
    const content = container.innerHTML;
    
    // Create a new HTML with highlights
    let newContent = content;
    
    // Process highlights one by one to maintain specificity
    highlights.forEach(highlight => {
      const text = highlight.text;
      if (!text) return;
      
      // If we have specific range data, use it for more precise highlighting
      if (highlight.rangeData) {
        try {
          // This is a simplified approach - in a real implementation,
          // you would need more sophisticated DOM manipulation
          
          // For now, we'll still use text replacement but with more context
          // to increase the chance of highlighting the correct instance
          
          // Escape special characters for regex
          const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          
          // Create a unique ID for this highlight
          const highlightId = highlight.id || `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Replace only this specific instance
          const highlightHtml = `<span class="highlighted-text" data-highlight-id="${highlightId}" style="background-color: rgba(255, 230, 0, 0.5); cursor: pointer;">${text}</span>`;
          
          // Use a more targeted replacement approach
          // This is still not perfect for multiple identical text instances
          // but better than replacing all instances
          const parts = newContent.split(escapedText);
          if (parts.length > 1) {
            // Only replace the first instance
            newContent = parts[0] + highlightHtml + parts.slice(1).join(escapedText);
          }
        } catch (error) {
          console.error('Error applying highlight with range data:', error);
          // Fall back to simpler highlighting
          newContent = applySimpleTextHighlight(highlight, text, newContent);
        }
      } else {
        // Fall back to simpler highlighting
        newContent = applySimpleTextHighlight(highlight, text, newContent);
      }
    });
    
    // Set the new content
    container.innerHTML = newContent;
    
    // Add click events to all highlights
    const highlightElements = container.querySelectorAll('.highlighted-text');
    highlightElements.forEach(el => {
      el.addEventListener('click', () => {
        const highlightId = el.dataset.highlightId;
        const highlight = highlights.find(h => h.id === highlightId);
        const text = el.textContent;
        if (highlight && onSectionSelect) {
          onSectionSelect(highlight, `#${text}`);
        }
      });
    });
  };
  
  // Helper function for simple text highlighting
  const applySimpleTextHighlight = (highlight, text, content) => {
    // Escape special characters for regex
    const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Create a unique ID for this highlight
    const highlightId = highlight.id || `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Replace with highlighted version (only first occurrence)
    return content.replace(
      new RegExp(escapedText),
      `<span class="highlighted-text" data-highlight-id="${highlightId}" style="background-color: rgba(255, 230, 0, 0.5); cursor: pointer;">${text}</span>`
    );
  };
  
  // Handle highlight action
  const handleHighlight = (color = 'yellow') => {
    if (!selectedText || !selectionRange) return;
    
    // Create a new highlight object with range data for precise highlighting
    const newHighlight = {
      id: `highlight-${Date.now()}`,
      text: selectedText,
      color,
      position: selectionPosition,
      rangeData: selectionRange,
      comments: []
    };
    
    // Add to active highlights
    const updatedHighlights = [...activeHighlights, newHighlight];
    setActiveHighlights(updatedHighlights);
    
    // Apply the highlight to the specific selection
    if (selectionRange) {
      const container = containerRef.current;
      if (container) {
        // Apply highlight to the specific range
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          
          const span = document.createElement('span');
          span.className = 'highlighted-text';
          span.dataset.highlightId = newHighlight.id;
          span.style.backgroundColor = 'rgba(255, 230, 0, 0.5)';
          span.style.cursor = 'pointer';
          
          // Add click event to open comments with the highlighted text
          span.addEventListener('click', () => {
            if (onSectionSelect) {
              onSectionSelect(newHighlight, `#${selectedText}`);
            }
          });
          
          try {
            range.surroundContents(span);
          } catch (error) {
            console.error('Error applying highlight to range:', error);
            // Fall back to regular highlight application
            applyHighlights([newHighlight]);
          }
        }
      } else {
        // Fall back to regular highlight application
        applyHighlights([newHighlight]);
      }
    } else {
      // Fall back to regular highlight application
      applyHighlights([newHighlight]);
    }
    
    // Save highlight to database
    if (documentId) {
      saveHighlightToDatabase(newHighlight);
    }
    
    // Notify parent component
    if (onSectionSelect) {
      onSectionSelect(newHighlight);
    }
    
    // Reset selection state
    setIsSelecting(false);
    setSelectedText('');
    setSelectionPosition(null);
    setSelectionRange(null);
  };
  
  // Handle comment action
  const handleComment = () => {
    if (!selectedText) return;
    
    // Create a new highlight with comment
    const newHighlight = {
      id: `highlight-${Date.now()}`,
      text: selectedText,
      color: 'yellow',
      position: selectionPosition,
      rangeData: selectionRange,
      comments: []
    };
    
    // Add to active highlights
    const updatedHighlights = [...activeHighlights, newHighlight];
    setActiveHighlights(updatedHighlights);
    
    // Apply the highlight to the specific selection
    if (selectionRange) {
      const container = containerRef.current;
      if (container) {
        // Apply highlight to the specific range
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          
          const span = document.createElement('span');
          span.className = 'highlighted-text';
          span.dataset.highlightId = newHighlight.id;
          span.style.backgroundColor = 'rgba(255, 230, 0, 0.5)';
          span.style.cursor = 'pointer';
          
          // Add click event to open comments with the highlighted text
          span.addEventListener('click', () => {
            if (onSectionSelect) {
              onSectionSelect(newHighlight, `#${selectedText}`);
            }
          });
          
          try {
            range.surroundContents(span);
          } catch (error) {
            console.error('Error applying highlight to range:', error);
            // Fall back to regular highlight application
            applyHighlights([newHighlight]);
          }
        }
      } else {
        // Fall back to regular highlight application
        applyHighlights([newHighlight]);
      }
    } else {
      // Fall back to regular highlight application
      applyHighlights([newHighlight]);
    }
    
    // Save highlight to database
    if (documentId) {
      saveHighlightToDatabase(newHighlight);
    }
    
    // Open comment thread for this section with the highlighted text as a tag
    if (onSectionSelect) {
      onSectionSelect(newHighlight, `#${selectedText}`);
    }
    
    // Reset selection state
    setIsSelecting(false);
    setSelectedText('');
    setSelectionPosition(null);
    setSelectionRange(null);
  };
  
  if (!isSelecting || !selectionPosition) return null;
  
  return (
    <div 
      ref={highlighterRef}
      className="absolute z-10 bg-white rounded-lg shadow-lg border"
      style={{
        top: `${selectionPosition.top}px`,
        left: `${selectionPosition.left}px`,
        transform: 'translateX(-50%)'
      }}
    >
      <div className="flex p-1">
        <button
          onClick={() => handleHighlight('yellow')}
          className="p-2 hover:bg-yellow-100 rounded-md"
          title="Highlight"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        
        <button
          onClick={handleComment}
          className="p-2 hover:bg-blue-100 rounded-md"
          title="Comment"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default DocumentHighlighter;
