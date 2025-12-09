import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, BookOpen, Award } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  people_count: number;
}

interface Certification {
  id: string;
  name: string;
  description: string;
  category: string;
  validity_period_months?: number;
  external_link?: string;
  people_count: number;
}

export default function SkillsCertifications() {
  const { showSuccess, showError } = useToast();

  const [skills, setSkills] = useState<Skill[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'skills' | 'certifications'>('skills');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Skill | Certification | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchSkills(), fetchCertifications()]);
    } catch (error) {
      console.error('Error fetching data:', error);
      showError('Failed to fetch skills and certifications');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSkills = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/psa/skills`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSkills(data.skills || []);
        }
      }
    } catch (error) {
      console.error('Error fetching skills:', error);
    }
  };

  const fetchCertifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/psa/certifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCertifications(data.certifications || []);
        }
      }
    } catch (error) {
      console.error('Error fetching certifications:', error);
    }
  };

  const handleDelete = async (id: string, type: 'skill' | 'certification') => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const endpoint = type === 'skill' ? 'skills' : 'certifications';
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/psa/${endpoint}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          showSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`);
          fetchData();
        } else {
          showError(data.message || `Failed to delete ${type}`);
        }
      } else {
        showError(`Failed to delete ${type}`);
      }
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      showError(`Failed to delete ${type}`);
    }
  };

  const handleEdit = (item: Skill | Certification) => {
    setEditingItem(item);
    setShowAddModal(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setShowAddModal(true);
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setEditingItem(null);
  };

  const handleSave = () => {
    fetchData();
    handleModalClose();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skills & Certifications</h1>
          <p className="text-gray-600">Manage skills and certifications for your team</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('skills')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'skills'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4" />
                <span>Skills ({skills.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('certifications')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'certifications'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Award className="w-4 h-4" />
                <span>Certifications ({certifications.length})</span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        {activeTab === 'skills' ? (
          <SkillsTable skills={skills} onEdit={handleEdit} onDelete={handleDelete} />
        ) : (
          <CertificationsTable certifications={certifications} onEdit={handleEdit} onDelete={handleDelete} />
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <AddEditModal
          isOpen={showAddModal}
          onClose={handleModalClose}
          onSave={handleSave}
          item={editingItem}
          type={activeTab}
        />
      )}
    </div>
  );
}

// Skills Table Component
function SkillsTable({ skills, onEdit, onDelete }: { 
  skills: Skill[]; 
  onEdit: (skill: Skill) => void; 
  onDelete: (id: string, type: 'skill') => void; 
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Edit/Delete
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              # of People
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {skills.map((skill) => (
            <tr key={skill.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex space-x-2">
                  <button
                    onClick={() => onEdit(skill)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(skill.id, 'skill')}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{skill.name}</div>
                <div className="text-sm text-gray-500">{skill.category}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900">{skill.description}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center text-sm text-gray-900">
                  <Users className="w-4 h-4 mr-1" />
                  {skill.people_count}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Certifications Table Component
function CertificationsTable({ certifications, onEdit, onDelete }: { 
  certifications: Certification[]; 
  onEdit: (cert: Certification) => void; 
  onDelete: (id: string, type: 'certification') => void; 
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Edit/Delete
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              External Link
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              # of People
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {certifications.map((cert) => (
            <tr key={cert.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex space-x-2">
                  <button
                    onClick={() => onEdit(cert)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(cert.id, 'certification')}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{cert.name}</div>
                <div className="text-sm text-gray-500">{cert.category}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900">{cert.description}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {cert.external_link ? (
                  <a 
                    href={cert.external_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    View Link
                  </a>
                ) : (
                  <span className="text-gray-400">No link</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center text-sm text-gray-900">
                  <Users className="w-4 h-4 mr-1" />
                  {cert.people_count}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Add/Edit Modal Component
function AddEditModal({ 
  isOpen, 
  onClose, 
  onSave, 
  item, 
  type 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: () => void; 
  item: Skill | Certification | null; 
  type: 'skills' | 'certifications'; 
}) {
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    validity_period_months: '',
    external_link: ''
  });

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        description: item.description,
        category: item.category,
        validity_period_months: (item as Certification).validity_period_months?.toString() || '',
        external_link: (item as Certification).external_link || ''
      });
    } else {
      setFormData({
        name: '',
        description: '',
        category: '',
        validity_period_months: '',
        external_link: ''
      });
    }
  }, [item]);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);
 
  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem("token");
      const endpoint = type === "skills" ? "skills" : "certifications";
 
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/psa/${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
 
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          type BaseItem = { category: string };
          const list: BaseItem[] = data[endpoint] || [];
 
          const uniqueCategories = [...new Set(list.map((item) => item.category))];
          setAllCategories(uniqueCategories);
        }
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };
 
  const handleCategoryChange = (value: string) => {
    setFormData((prev) => ({ ...prev, category: value }));
 
    if (value.length > 0) {
      const filtered = allCategories.filter((cat) =>
        cat.toLowerCase().includes(value.toLowerCase())
      );
      setCategorySuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }
    
    if (!formData.description.trim()) {
      alert('Description is required');
      return;
    }
    
    if (!formData.category.trim()) {
      alert('Category is required');
      return;
    }
    
    if (formData.category.length > 100) {
      alert('Category name is too long (maximum 100 characters)');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const endpoint = type === 'skills' ? 'skills' : 'certifications';
      const url = item 
        ? `${import.meta.env.VITE_API_BASE_URL}/psa/${endpoint}/${item.id}`
        : `${import.meta.env.VITE_API_BASE_URL}/psa/${endpoint}`;
      
      const method = item ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          category: formData.category.trim(),
          ...(type === 'certifications' && {
            validity_period_months: formData.validity_period_months 
              ? parseInt(formData.validity_period_months) 
              : undefined,
            external_link: formData.external_link
          })
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          onSave();
        } else {
          alert(data.message || 'Failed to save');
        }
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to save');
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('An error occurred while saving');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {item ? 'Edit' : 'Add'} {type === 'skills' ? 'Skill' : 'Certification'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              required
            />
          </div>
<div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <div className="relative">
              <input
                type="text"
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
 
              {showSuggestions && categorySuggestions.length > 0 && (
                <ul className="border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto bg-white shadow-md absolute z-10 w-full">
                  {categorySuggestions.map((cat, idx) => (
                    <li
                      key={idx}
                      onClick={() => {
                        setFormData({ ...formData, category: cat });
                        setShowSuggestions(false);
                      }}
                      className="px-3 py-2 cursor-pointer hover:bg-blue-100"
                    >
                      {cat}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          
          {/* <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div> */}
          
          {type === 'certifications' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Validity Period (months)
                </label>
                <input
                  type="number"
                  value={formData.validity_period_months}
                  onChange={(e) => setFormData({ ...formData, validity_period_months: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="12"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  External Link
                </label>
                <input
                  type="url"
                  value={formData.external_link}
                  onChange={(e) => setFormData({ ...formData, external_link: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/certification"
                />
              </div>
            </>
          )}
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              {item ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
