/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { Search, FileText, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Tabs, TabsContent, TabsList, TabsTrigger, useTabsContext } from '../components/ui/tabs';
import TemplateForm from '../components/TemplateForm';

interface Template {
  id: number;
  name: string;
  description: string;
  prompt: string;
  company_id: number;
  tags: string[];
  category?: string;
  platform?: string;
  created_at: string;
  updated_at: string;
}

const TemplateManagement = () => {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  // Custom hook component to access tabs context
  const TabController = () => {
    const { setActiveTab } = useTabsContext();

    const switchToListTab = () => {
      setActiveTab('list');
    };

    const switchToFormTab = () => {
      setActiveTab('form');
    };

    // Expose the functions globally for use in handlers

    (window as any).switchToListTab = switchToListTab;
    (window as any).switchToFormTab = switchToFormTab;

    return null;
  };

  useEffect(() => {
    if (companyId) {
      fetchTemplates();
      setSelectedTemplate(null);
    }
  }, [companyId]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/template?companyId=${companyId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setTemplates(response.data.templates);
        setFilteredTemplates(response.data.templates);

        // Extract all unique tags
        const tags = response.data.templates.reduce((acc: string[], template: Template) => {
          if (template.tags && Array.isArray(template.tags)) {
            template.tags.forEach(tag => {
              if (!acc.includes(tag)) {
                acc.push(tag);
              }
            });
          }
          return acc;
        }, []);

        setAllTags(tags);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to fetch templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    filterTemplates(query, selectedTags);
  };

  const handleTagFilter = (tag: string) => {
    const newSelectedTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];

    setSelectedTags(newSelectedTags);
    filterTemplates(searchQuery, newSelectedTags);
  };

  const filterTemplates = (query: string, tags: string[]) => {
    let filtered = templates;

    // Apply search query filter
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(lowerQuery) ||
        template.description.toLowerCase().includes(lowerQuery)
      );
    }

    // Apply tag filter
    if (tags.length > 0) {
      filtered = filtered.filter(template =>
        template.tags && tags.some(tag => template.tags.includes(tag))
      );
    }

    setFilteredTemplates(filtered);
  };

  const handleEditTemplate = (template: Template) => {
    setSelectedTemplate(template);
    // Switch to form tab for editing
    if ((window as any).switchToFormTab) {
      (window as any).switchToFormTab();
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL}/template/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        toast.success('Template deleted successfully');
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handleFormSubmit = () => {
    fetchTemplates();
    setSelectedTemplate(null);
    // Switch back to list tab
    if ((window as any).switchToListTab) {
      (window as any).switchToListTab();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-80 via-blue-50/40 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/15">
      {/* Main Content */}
      <div className="relative min-h-screen">
        {/* Subtle Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Subtle background circles */}
          <div className="absolute top-32 left-16 w-64 h-64 bg-gradient-to-br from-blue-400/8 to-indigo-400/6 rounded-full blur-2xl"></div>
          <div className="absolute bottom-32 right-16 w-80 h-80 bg-gradient-to-bl from-indigo-400/7 to-blue-400/5 rounded-full blur-2xl"></div>

          {/* Very subtle grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:60px_60px]"></div>
        </div>

        <Tabs
          defaultValue="list"
          className="w-full h-full"
        >
          <TabController />
          <div className="px-3 pt-4 pb-3">
            <div className="max-w-5xl mx-auto">
              {/* <div className="text-center mb-4">
                <div className="relative inline-block mb-3">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/15 rounded-full blur-xl"></div>
                  <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white px-6 py-3 rounded-2xl shadow-xl border border-blue-500/20">
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                      Template Management
                    </h1>
                  </div>
                </div>
              </div> */}

              {/* Compact Stats Section */}
              {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-white/95 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-3 border border-slate-200/90 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Total Templates</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">{templates.length}</p>
                    </div>
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>

                <div className="bg-white/95 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-3 border border-slate-200/90 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Active Filters</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">{selectedTags.length + (searchQuery ? 1 : 0)}</p>
                    </div>
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Search className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>

                <div className="bg-white/95 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-3 border border-slate-200/90 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-gradient-to-br hover:from-emerald-50 hover:to-green-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Available Tags</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">{allTags.length}</p>
                    </div>
                    <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                      <div className="w-4 h-4 bg-white rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div> */}

              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-white/95 dark:bg-gray-800/80 backdrop-blur-sm p-1 rounded-xl border border-slate-200/90 dark:border-gray-700/50 shadow-xl">
                <TabsTrigger value="list" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 rounded-lg transition-all duration-300 font-bold text-sm py-2.5">
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Template List
                </TabsTrigger>
                <TabsTrigger value="form" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 rounded-lg transition-all duration-300 font-bold text-sm py-2.5">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  {selectedTemplate ? 'Edit Template' : 'New Template'}
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="list" className="w-full h-full">
            {/* Search Section */}
            <div className="px-6 py-6">
              <div className="max-w-4xl mx-auto">
                <div className="bg-gradient-to-r from-white/95 via-blue-50/20 to-indigo-50/10 dark:from-gray-900/95 dark:via-blue-900/10 dark:to-indigo-900/5 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-2xl p-6">
                  <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                        <input
                          type="text"
                          placeholder="Search templates..."
                          value={searchQuery}
                          onChange={(e) => handleSearch(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 shadow-lg focus:shadow-xl"
                        />
                      </div>
                    </div>

                    {/* Results counter and status */}
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                          {filteredTemplates.length}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                          {filteredTemplates.length === 1 ? 'template' : 'templates'}
                        </div>
                      </div>
                      <div className="px-6 py-3 bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 text-white rounded-xl text-sm font-bold shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                        {searchQuery ? 'Search Results' : 'All Templates'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tags Filter */}
            {allTags.length > 0 && (
              <div className="px-6 pb-6">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-gradient-to-r from-white/95 via-purple-50/20 to-pink-50/10 dark:from-gray-900/95 dark:via-purple-900/10 dark:to-pink-900/5 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                          Filter by Tags
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                          Select tags to filter your templates
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                          {selectedTags.length}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                          active filters
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {allTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => handleTagFilter(tag)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                            selectedTags.includes(tag)
                              ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white shadow-lg hover:shadow-xl hover:scale-110 hover:-rotate-1'
                              : 'bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30 hover:border-purple-300 hover:scale-105'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>

                    {/* Clear filters button */}
                    {selectedTags.length > 0 && (
                      <div className="mt-6 text-center">
                        <button
                          onClick={() => setSelectedTags([])}
                          className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-gray-500 via-gray-600 to-gray-700 hover:from-gray-600 hover:via-gray-700 hover:to-gray-800 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                        >
                          Clear All Filters
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Templates List */}
            <div className="w-full px-6 pb-6">
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="max-w-md mx-auto text-center">
                    <div className="w-12 h-12 mx-auto mb-4">
                      <div className="w-full h-full border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Templates</h3>
                    <p className="text-sm text-gray-500">Please wait while we fetch your templates...</p>
                  </div>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <div className="max-w-lg mx-auto text-center">
                    <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <FileText className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Templates Found</h3>
                    <p className="text-sm text-gray-500 mb-4 leading-relaxed max-w-md mx-auto">
                      {searchQuery || selectedTags.length > 0
                        ? 'Try adjusting your search or filters to find what you\'re looking for'
                        : 'Create your first template to get started with your workflow'}
                    </p>
                    {!searchQuery && selectedTags.length === 0 && (
                      <button
                        onClick={() => (window as any).switchToFormTab?.()}
                        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-sm transition-colors duration-200"
                      >
                        Create Your First Template
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                                 <div className="max-w-6xl mx-auto">
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                         {filteredTemplates.map((template, index) => (
                       <div
                         key={template.id}
                         className="group relative bg-gradient-to-br from-white/90 via-blue-50/30 to-indigo-50/20 dark:from-gray-900/95 dark:via-blue-900/20 dark:to-indigo-900/10 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-2xl hover:shadow-[0_25px_50px_-12px_rgba(59,130,246,0.25)] hover:scale-105 hover:border-blue-400/50 dark:hover:border-blue-500/50 transition-all duration-500 ease-out overflow-hidden transform hover:-translate-y-2 animate-in fade-in-0 slide-in-from-bottom-4"
                         style={{
                           animationDelay: `${index * 100}ms`,
                           animationFillMode: 'both'
                         }}
                       >
                         {/* Animated background overlay */}
                         <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-blue-500/10 group-hover:via-indigo-500/8 group-hover:to-purple-500/10 transition-all duration-700 rounded-2xl"></div>

                         {/* Floating particles effect */}
                         <div className="absolute inset-0 overflow-hidden">
                           <div className="absolute top-4 right-4 w-2 h-2 bg-blue-400/60 rounded-full animate-pulse group-hover:animate-bounce"></div>
                           <div className="absolute bottom-6 left-6 w-1.5 h-1.5 bg-indigo-400/50 rounded-full animate-pulse group-hover:animate-ping"></div>
                           <div className="absolute top-1/2 right-8 w-1 h-1 bg-purple-400/40 rounded-full animate-pulse group-hover:animate-spin"></div>
                         </div>

                         {/* Glowing border effect */}
                         <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-blue-500/20 group-hover:via-indigo-500/15 group-hover:to-purple-500/20 transition-all duration-500 blur-xl"></div>

                         {/* Template header with icon */}
                         <div className="p-6 border-b border-white/10 dark:border-gray-700/50 relative z-10">
                           <div className="flex items-center justify-between mb-3">
                            <div className="relative">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-2xl group-hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] group-hover:rotate-3">
                                <FileText className="h-6 w-6 text-white group-hover:rotate-12 transition-transform duration-500" />
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-500"></div>
                            </div>
                            <div className="flex space-x-3 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
                               <button
                                 onClick={() => handleEditTemplate(template)}
                                className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl transition-all duration-300 hover:scale-110 hover:shadow-[0_10px_25px_rgba(59,130,246,0.3)] hover:-rotate-2"
                               >
                                <Edit className="h-4 w-4" />
                               </button>
                               <button
                                 onClick={() => handleDeleteTemplate(template.id)}
                                className="p-3 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white rounded-xl transition-all duration-300 hover:scale-110 hover:shadow-[0_10px_25px_rgba(239,68,68,0.3)] hover:rotate-2"
                               >
                                <Trash2 className="h-4 w-4" />
                               </button>
                             </div>
                           </div>
                           <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:via-indigo-600 group-hover:to-purple-600 transition-all duration-500 group-hover:scale-105 transform origin-left">
                              {template.name}
                            </h3>
                         </div>

                         {/* Template content */}
                         <div className="p-6 relative z-10">
                           <p className="text-gray-600 dark:text-gray-300 mb-6 line-clamp-2 leading-relaxed text-sm group-hover:text-gray-800 dark:group-hover:text-gray-100 transition-colors duration-500">
                             {template.description || 'No description provided'}
                           </p>

                           {/* Tags with hover effects */}
                           {template.tags && template.tags.length > 0 && (
                            <div className="flex flex-wrap gap-3 mb-6">
                               {template.tags.map((tag, tagIndex) => (
                                 <span
                                   key={tagIndex}
                                  className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-800/50 dark:hover:to-indigo-800/50 hover:text-blue-800 dark:hover:text-blue-200 hover:scale-110 hover:shadow-lg transition-all duration-300 cursor-default border border-blue-200/50 dark:border-blue-700/30"
                                 >
                                   {tag}
                                 </span>
                               ))}
                             </div>
                           )}

                           {/* Template metadata */}
                           <div className="pt-4 border-t border-white/10 dark:border-gray-700/50">
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
                              <span className="group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors duration-300 font-medium">
                                 Created: {new Date(template.created_at).toLocaleDateString()}
                               </span>
                              <span className="px-3 py-1.5 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-full group-hover:from-blue-100 group-hover:to-indigo-100 dark:group-hover:from-blue-900/30 dark:group-hover:to-indigo-900/30 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-all duration-300 font-semibold shadow-sm">
                                 ID: {template.id}
                               </span>
                             </div>
                             
                             {/* Category display */}
                             {template.category && (
                               <div className="flex items-center justify-center">
                                 <span className="px-4 py-2 bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-bold uppercase tracking-wide border border-emerald-200/50 dark:border-emerald-700/30 shadow-sm group-hover:shadow-md transition-all duration-300">
                                   {template.category === 'executive_summary' ? 'Meeting Exec Summary' : 
                                    template.category === 'task' ? 'Meeting Task' : 
                                    template.category === 'meeting_intelligence' ? 'Meeting Intelligence' :
                                    template.category === 'other' ? 'Other' : template.category}
                                 </span>
                               </div>
                             )}
                           </div>
                         </div>

                         {/* Bottom gradient line */}
                         <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left rounded-full shadow-lg"></div>

                         {/* Corner accent */}
                         <div className="absolute top-0 right-0 w-0 h-0 border-l-[25px] border-l-transparent border-t-[25px] border-t-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-lg"></div>

                         {/* Additional glow effect */}
                         <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:via-indigo-500/3 group-hover:to-purple-500/5 transition-all duration-700"></div>
                       </div>
                     ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="form" className="w-full h-full p-4">
            <TemplateForm
              template={selectedTemplate}
              companyId={companyId ? parseInt(companyId) : undefined}
              existingTemplates={templates}
              onSubmitSuccess={handleFormSubmit}
              onCancel={() => {
                setSelectedTemplate(null);
                // Switch back to list tab
                if ((window as any).switchToListTab) {
                  (window as any).switchToListTab();
                }
              }}
            />
          </TabsContent>
        </Tabs>

        {/* Bottom spacing to ensure all content is visible */}
        <div className="h-16"></div>
      </div>
    </div>
  );
};

export default TemplateManagement;


