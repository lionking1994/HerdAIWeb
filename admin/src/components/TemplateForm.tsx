import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';


const TEMPLATE_CATEGORIES = [
  { value: '', label: 'Select a category...' },
  { value: 'executive_summary', label: 'Meeting Exec Summary' },
  { value: 'task', label: 'Meeting Task' },
  { value: 'meeting_intelligence', label: 'Meeting Intelligence' },
  { value: 'email_processing', label: 'Email Processing' },
  { value: 'psa', label:'PSA'},
  { value: 'other', label: 'Other' },
];

const defaultPrompt = `Create a JSON representation of this meeting transcript including:

1. **Meeting Summary**:
   - Title
   - Description
   - Date & Time

2. **Entities and Relationships**:
   - Companies (label: blue): name, website (if available), and any relevant notes
   - People (label: purple): name, email, phone (if mentioned)
   - Opportunities (label: green): description, status, value (if mentioned)

3. **Graph Structure**:
   - Central node: the **main theme** of the meeting (label: orange)
   - Connect related entities with labeled relationships (e.g. "works at", "discussed", "potential client", etc.)
   - Use the **thickest relationship line** for the strongest/primary topic (e.g. opportunities or decisions)

Output should be structured in a JSON format suitable for a knowledge graph visualization engine.

Only include what is mentioned or implied in the transcript.`;

interface Template {
  id: number;
  name: string;
  description: string;
  prompt: string;
  company_id: number;
  tags: string[];
  category?: string;
  created_at: string;
  updated_at: string;
  platform?: string;
}

interface TemplateFormProps {
  template: Template | null;
  companyId?: number;
  onSubmitSuccess: () => void;
  onCancel: () => void;
  existingTemplates?: Template[];
}

const TemplateForm = ({ template, companyId, onSubmitSuccess, onCancel, existingTemplates = [] }: TemplateFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt: defaultPrompt || '',
    category: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({
    name: '',
    prompt: '',
    company_id: '',
    category: ''
  });

  const [selectedModel, setSelectedModel] = useState('Sonar');
  const [aiModels, setAiModels] = useState<{ [key: string]: { name: string, models: { id: string, name: string }[] } }>({});

  // Check if a category is already taken by another template
  const isCategoryTaken = (category: string) => {
    if (!category || category === 'other') return false;
    
    const restrictedCategories = ['task', 'executive_summary'];
    if (!restrictedCategories.includes(category)) return false;
    
    // When editing, exclude the current template from the check
    const otherTemplates = template 
      ? existingTemplates.filter(t => t.id !== template.id)
      : existingTemplates;
    
    return otherTemplates.some(t => t.category === category);
  };

  // Get available categories based on current state
  const getAvailableCategories = () => {
    return TEMPLATE_CATEGORIES.map(category => ({
      ...category,
      disabled: isCategoryTaken(category.value)
    }));
  };

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description || '',
        prompt: template.prompt,
        category: template.category || ''
      });
      if (template.platform) {
        setSelectedModel(template.platform);
      }
    } else {
      setFormData({
        name: '',
        description: '',
        prompt: defaultPrompt,
        category: ''
      });
      setSelectedModel('Sonar');
    }
  }, [template]);

  useEffect(() => {
    const fetchAIModels = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/meeting/api_settings`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (response.data.success) {
          const modelsByProvider = response.data.apiConfigs.reduce((acc: any, config: any) => {
            acc[config.provider] = {
              name: config.name,
              models: config.models || [],
            };
            return acc;
          }, {});

          setAiModels(modelsByProvider);
        }
      } catch (error) {
        console.error("Failed to fetch AI models:", error);
        toast.error("Failed to load AI models");
      }
    };

    fetchAIModels();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {
      name: '',
      prompt: '',
      company_id: '',
      category: ''
    };

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.prompt.trim()) {
      newErrors.prompt = 'Prompt is required';
    }

    if (!companyId) {
      newErrors.company_id = 'Company ID is required';
    }

    // Validate category restrictions
    if (formData.category && isCategoryTaken(formData.category)) {
      const categoryName = formData.category === 'executive_summary' ? 'Meeting Exec Summary' : formData.category=== 'task' ? 'Meeting Task' : 'Meeting Intelligence';
      newErrors.category = `A template with category "${categoryName}" already exists. Each company can only have one template per category.`;
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const data = {
        name: formData.name,
        description: formData.description,
        prompt: formData.prompt,
        category: formData.category,
        company_id: companyId,
        platform: selectedModel
      };

      let response;

      if (template) {
        response = await axios.put(
          `${import.meta.env.VITE_API_BASE_URL}/template/update/${template.id}`,
          data,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        toast.success('Template updated successfully');
      } else {
        response = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/template/create-template`,
          data,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        toast.success('Template created successfully');
      }

      if (response.data.success) {
        onSubmitSuccess();
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(template ? 'Failed to update template' : 'Failed to create template');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl mx-auto">
      <div className="space-y-4">
        <div>
          <Label htmlFor="name" className="text-sm font-medium">
            Template Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`mt-1 ${errors.name ? 'border-red-500' : ''}`}
            placeholder="Enter template name"
          />
          {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
        </div>

        <div>
          <Label htmlFor="description" className="text-sm font-medium">
            Description
          </Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="mt-1"
            placeholder="Enter template description"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="category" className="text-sm font-medium">
            Category
          </Label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            className={`mt-1 w-full block appearance-none bg-white border text-gray-700 py-2 px-4 pr-8 rounded shadow leading-tight focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
              errors.category ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            {getAvailableCategories().map((category) => (
              <option 
                key={category.value} 
                value={category.value}
                disabled={category.disabled}
                className={category.disabled ? 'text-gray-400 bg-gray-100' : ''}
              >
                {category.disabled ? `${category.label} (Already exists)` : category.label}
              </option>
            ))}
          </select>
          {errors.category && <p className="mt-1 text-sm text-red-500">{errors.category}</p>}
        </div>

        <div className="mt-4">
          <Label htmlFor="platform" className="text-sm font-medium">
            Platform
          </Label>
          <select
            id="platform"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="mt-1 w-full block appearance-none bg-white border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded shadow leading-tight focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            {Object.entries(aiModels).map(([providerKey, provider]) => (
              <optgroup key={providerKey} label={provider.name}>
                {provider.models.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="prompt" className="text-sm font-medium">
            Prompt <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="prompt"
            name="prompt"
            value={formData.prompt}
            onChange={handleChange}
            className={`mt-1 ${errors.prompt ? 'border-red-500' : ''}`}
            placeholder="Enter prompt text"
            rows={10}
          />
          {errors.prompt && <p className="mt-1 text-sm text-red-500">{errors.prompt}</p>}
        </div>

      </div>

      <div className="flex justify-end space-x-4 items-center">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          disabled={isSubmitting}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              {template ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            template ? 'Update Template' : 'Create Template'
          )}
        </Button>
      </div>

    </form>
  );
};

export default TemplateForm;
