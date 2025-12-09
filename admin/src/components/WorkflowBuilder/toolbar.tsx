import React from 'react';
import { 
  Save, 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Upload, 
  History, 
  FileText, 
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';

interface WorkflowToolbarProps {
  onSave: () => void;
  onRun: () => void;
  onPause: () => void;
  onReset: () => void;
  onExport: () => void;
  onImport: () => void;
  onShowHistory: () => void;
  onShowTemplates: () => void;
  onShowSettings: () => void;
  onTogglePreview: () => void;
  isRunning: boolean;
  isPreviewMode: boolean;
  hasUnsavedChanges: boolean;
}

const WorkflowToolbar: React.FC<WorkflowToolbarProps> = ({
  onSave,
  onRun,
  onPause,
  onReset,
  onExport,
  onImport,
  onShowHistory,
  onShowTemplates,
  onShowSettings,
  onTogglePreview,
  isRunning,
  isPreviewMode,
  hasUnsavedChanges
}) => {
  return (
    <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        {/* Left side - Workflow controls */}
        <div className="flex items-center justify-center sm:justify-start space-x-1 sm:space-x-2">
          <button
            onClick={onSave}
            disabled={!hasUnsavedChanges}
            className={`flex items-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              hasUnsavedChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            title="Save workflow"
          >
            <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Save</span>
          </button>

          <div className="flex items-center space-x-1">
            {isRunning ? (
              <button
                onClick={onPause}
                className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-xs sm:text-sm font-medium"
                title="Pause workflow"
              >
                <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Pause</span>
              </button>
            ) : (
              <button
                onClick={onRun}
                className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium"
                title="Run workflow"
              >
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Run</span>
              </button>
            )}

            <button
              onClick={onReset}
              className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm font-medium"
              title="Reset workflow"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Center - Import/Export */}
        <div className="flex items-center justify-center sm:justify-start space-x-1 sm:space-x-2">
          <button
            onClick={onExport}
            className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs sm:text-sm font-medium"
            title="Export workflow"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={onImport}
            className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs sm:text-sm font-medium"
            title="Import workflow"
          >
            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Import</span>
          </button>
        </div>

        {/* Right side - Additional features */}
        <div className="flex items-center justify-center sm:justify-start space-x-1 sm:space-x-2">
          <button
            onClick={onShowTemplates}
            className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs sm:text-sm font-medium"
            title="Workflow templates"
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Templates</span>
          </button>

          <button
            onClick={onShowHistory}
            className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs sm:text-sm font-medium"
            title="Workflow history"
          >
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">History</span>
          </button>

          <button
            onClick={onTogglePreview}
            className={`flex items-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              isPreviewMode
                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={isPreviewMode ? 'Exit preview mode' : 'Enter preview mode'}
          >
            {isPreviewMode ? (
              <>
                <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Exit Preview</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Preview</span>
              </>
            )}
          </button>

          <button
            onClick={onShowSettings}
            className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs sm:text-sm font-medium"
            title="Workflow settings"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowToolbar; 