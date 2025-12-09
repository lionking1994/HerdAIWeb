// import { useState, useEffect } from 'react';
// import { X, Plus, Trash2, User, MapPin, DollarSign, Clock, Award, Star, Save, Loader2 } from 'lucide-react';
// import { Resource } from '../Dashboard/types';
// import api from '../../../lib/api';
// import { toast } from 'react-toastify';

// interface ResourceEditModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   resource: Resource;
//   onSave: (updatedResource: Resource) => void;
//   companyId?: string;
//   companyRoles?: any[];
// }

// export default function ResourceEditModal({ isOpen, onClose, resource, onSave, companyId, companyRoles = [] }: ResourceEditModalProps) {
//   const [formData, setFormData] = useState({
//     name: resource.user.name,
//     email: resource.user.email,
//     role: resource.user.role,
//     department: resource.department,
//     departmentId: resource.departmentId || null, // Set from resource data
//     location: resource.location,
//     hourlyRate: resource.hourlyRate || 0,
//     timezone: 'America/New_York', // Default timezone
//     employmentType: resource.resource?.employment_type || 'full_time',
//     level: resource.resource?.level || 'senior',
//     costCenter: resource.resource?.cost_center || 'default',
//     workingDays: resource.resource?.working_days || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
//     hoursPerWeek: resource.resource?.hours_per_week || 40,    
//     skills: [...resource.skills],
//     certifications: [...resource.certifications],
//     availability: resource.availability,
//     performanceRating: resource.performanceRating,
//   });

//   const [activeTab, setActiveTab] = useState('basic');
//   const [isLoading, setIsLoading] = useState(false);
//   const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
//   const [skills, setSkills] = useState<any[]>([]);
//   const [certifications, setCertifications] = useState<any[]>([]);
//   const [newSkill, setNewSkill] = useState({ skillId: '', proficiencyLevel: 1, yearsExperience: 0 });
//   const [newCertification, setNewCertification] = useState({ 
//     certificationId: '', 
//     dateObtained: '', 
//     expirationDate: '',
//     certificateNumber: '',
//     verificationUrl: '',
//     status: 'active' as 'active' | 'expired' | 'expiring_soon'
//   });

//   // Fetch skills and certifications from API
//   useEffect(() => {
//     const fetchSkillsAndCertifications = async () => {
//       try {
//         const token = localStorage.getItem('token');
        
//         // Fetch skills
//         const skillsResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/psa/skills`, {
//           headers: {
//             'Authorization': `Bearer ${token}`,
//           },
//         });
        
//         if (skillsResponse.ok) {
//           const skillsData = await skillsResponse.json();
//           if (skillsData.success) {
//             setSkills(skillsData.skills);
//           }
//         }

//         // Fetch certifications
//         const certificationsResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/psa/certifications`, {
//           headers: {
//             'Authorization': `Bearer ${token}`,
//           },
//         });
        
//         if (certificationsResponse.ok) {
//           const certificationsData = await certificationsResponse.json();
//           if (certificationsData.success) {
//             setCertifications(certificationsData.certifications);
//           }
//         }
//       } catch (error) {
//         console.error('Error fetching skills and certifications:', error);
//       }
//     };

//     if (isOpen) {
//       fetchSkillsAndCertifications();
//     }
//   }, [isOpen]);

//   // Update formData when resource changes
//   useEffect(() => {
//     if (resource) {
//       // Use departmentId directly from resource, or find by name if needed
//       let departmentId = resource.departmentId || null;
//       if (!departmentId && resource.department && companyRoles.length > 0) {
//         const matchingRole = companyRoles.find(role => role.name === resource.department);
//         if (matchingRole) {
//           departmentId = matchingRole.id;
//         }
//       }

//       setFormData(prev => ({
//         ...prev,
//         departmentId: departmentId,
//         // Note: These fields are not available in the flattened Resource interface
//         // They would need to be added to the transformation logic if needed
//         employmentType: 'full_time', // Default value
//         level: 'senior', // Default value
//         costCenter: 'default', // Default value
//         workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], // Default value
//         hoursPerWeek: 40, // Default value
//         location: resource.location,
//         hourlyRate: resource.hourlyRate || 0,
//         availability: resource.availability,
//         performanceRating: resource.performanceRating,
//         // Map existing skills with proper IDs
//         skills: resource.skills.map(skill => ({
//           skillId: skill.skill?.id || skill.skillId,
//           skill: skill.skill,
//           proficiencyLevel: skill.proficiencyLevel,
//           yearsExperience: skill.yearsExperience,
//           lastUsed: skill.lastUsed
//         })),
//         // Map existing certifications with proper IDs
//         certifications: resource.certifications.map(cert => ({
//           certificationId: cert.certification?.id || cert.certificationId,
//           certification: cert.certification,
//           dateObtained: cert.dateObtained,
//           expirationDate: cert.expirationDate,
//           certificateNumber: cert.certificateNumber,
//           verificationUrl: cert.verificationUrl,
//           status: cert.status
//         }))
//       }));
//     }
//   }, [resource, companyRoles]);

//   if (!isOpen) return null;

//   const handleInputChange = (field: string, value: any) => {
//     setFormData(prev => ({ ...prev, [field]: value }));
//     // Clear field error when user starts typing
//     if (fieldErrors[field]) {
//       setFieldErrors(prev => ({ ...prev, [field]: '' }));
//     }
//   };

//   const validateField = (field: string, value: any): string => {
//     switch (field) {
//       case 'name':
//         if (!value || value.trim().length === 0) return 'Full name is required';
//         if (value.trim().length < 2) return 'Name must be at least 2 characters';
//         return '';
//       case 'email':
//         if (!value || value.trim().length === 0) return 'Email is required';
//         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//         if (!emailRegex.test(value)) return 'Please enter a valid email address';
//         return '';
//       case 'departmentId':
//         if (!value) return 'Department is required';
//         return '';
//       case 'location':
//         if (!value || value.trim().length === 0) return 'Location is required';
//         return '';
//       case 'hourlyRate':
//         if (!value || value <= 0) return 'Hourly rate must be greater than 0';
//         if (value > 1000) return 'Hourly rate seems too high';
//         return '';
//       case 'performanceRating':
//         if (value < 1 || value > 5) return 'Performance rating must be between 1 and 5';
//         return '';
//       default:
//         return '';
//     }
//   };

//   const validateForm = (): boolean => {
//     const errors: {[key: string]: string} = {};
//     let isValid = true;

//     // Validate required fields
//     const requiredFields = ['name', 'email', 'departmentId', 'location', 'hourlyRate'];
    
//     requiredFields.forEach(field => {
//       const error = validateField(field, formData[field as keyof typeof formData]);
//       if (error) {
//         errors[field] = error;
//         isValid = false;
//       }
//     });

//     setFieldErrors(errors);
//     return isValid;
//   };

//   const addSkill = () => {
//     if (newSkill.skillId && !formData.skills.some(s => s.skillId === newSkill.skillId)) {
//       const skill = skills.find(s => s.id === newSkill.skillId);
//       if (skill) {
//         const resourceSkill = {
//           skillId: skill.id, // Use the actual skill ID from database
//           skill,
//           proficiencyLevel: newSkill.proficiencyLevel as 1 | 2 | 3 | 4 | 5,
//           yearsExperience: newSkill.yearsExperience,
//           lastUsed: new Date().toISOString().split('T')[0]
//         };
//         setFormData(prev => ({
//           ...prev,
//           skills: [...prev.skills, resourceSkill]
//         }));
//         setNewSkill({ skillId: '', proficiencyLevel: 1, yearsExperience: 0 });
//       }
//     }
//   };

//   const removeSkill = (skillId: string) => {
//     setFormData(prev => ({
//       ...prev,
//       skills: prev.skills.filter(s => s.skillId !== skillId)
//     }));
//   };

//   const updateSkill = (skillId: string, field: string, value: any) => {
//     setFormData(prev => ({
//       ...prev,
//       skills: prev.skills.map(s => 
//         s.skillId === skillId ? { ...s, [field]: value } : s
//       )
//     }));
//   };

//   const addCertification = () => {
//     if (newCertification.certificationId && newCertification.dateObtained) {
//       const certification = certifications.find(c => c.id === newCertification.certificationId);
//       if (certification) {
//         const resourceCertification = {
//           certificationId: certification.id, // Use the actual certification ID from database
//           certification,
//           dateObtained: newCertification.dateObtained,
//           expirationDate: newCertification.expirationDate,
//           certificateNumber: newCertification.certificateNumber,
//           verificationUrl: newCertification.verificationUrl,
//           status: newCertification.status
//         };
//         setFormData(prev => ({
//           ...prev,
//           certifications: [...prev.certifications, resourceCertification]
//         }));
//         setNewCertification({ 
//           certificationId: '', 
//           dateObtained: '', 
//           expirationDate: '',
//           certificateNumber: '',
//           verificationUrl: '',
//           status: 'active'
//         });
//       }
//     }
//   };

//   const removeCertification = (certificationId: string) => {
//     setFormData(prev => ({
//       ...prev,
//       certifications: prev.certifications.filter(c => c.certificationId !== certificationId)
//     }));
//   };

//   const updateCertification = (certificationId: string, field: string, value: any) => {
//     setFormData(prev => ({
//       ...prev,
//       certifications: prev.certifications.map(c => 
//         c.certificationId === certificationId ? { ...c, [field]: value } : c
//       )
//     }));
//   };

//   const handleSave = async () => {
//     if (!companyId) {
//       toast.error('Company ID is required');
//       return;
//     }

//     // Validate form before submitting
//     if (!validateForm()) {
//       toast.error('Please fix the validation errors before saving');
//       return;
//     }

//     setIsLoading(true);

//     try {
//       // Prepare the payload according to the API structure
//       const payload = {
//         resourceId: resource.resource?.resource_id || null, // Resource ID for skills/certifications
//         userId: resource.user.id, // This is the user ID
//         employeeId: resource.user.id, // Using user ID as employee ID
//         employmentType: formData.employmentType,
//         level: formData.level,
//         hourlyRate: formData.hourlyRate,
//         costCenter: formData.costCenter,
//         workingDays: formData.workingDays,
//         hoursPerWeek: formData.hoursPerWeek,
//         performanceRating: formData.performanceRating,
//         departmentId: formData.departmentId, // Use selected department ID
//         location: formData.location,
//          skills: formData.skills.map(skill => ({
//            id: skill.skillId || null, // Use the skill ID from database
//            name: skill.skill?.name || 'Unknown Skill',
//            category: skill.skill?.category || 'General',
//            description: skill.skill?.description || '',
//            proficiency_level: skill.proficiencyLevel,
//            years_experience: skill.yearsExperience,
//            last_used: skill.lastUsed,
//            resourceSkillId: null // For updating existing resource skills
//          })),
//          certifications: formData.certifications.map(cert => ({
//            id: cert.certificationId || null, // Use the certification ID from database
//            name: cert.certification?.name || 'Unknown Certification',
//            issuing_organization: cert.certification?.issuingOrganization || 'Unknown',
//            description: cert.certification?.description || '',
//            validity_period_months: 12, // Default validity period
//            date_obtained: cert.dateObtained,
//            expiration_date: cert.expirationDate,
//            status: cert.status,
//            certificate_number: cert.certificateNumber || '',
//            verification_url: cert.verificationUrl || '',
//            resourceCertificationId: null // For updating existing resource certifications
//          }))
//       };

//       // Call the API
//       const response = await api.post(`/psa/resources/${resource.user.id}/${companyId}`, payload);

//       if (response.data.success) {
//         // Create updated resource object
//         const updatedResource: Resource = {
//           ...resource,
//           user: {
//             ...resource.user,
//             name: formData.name,
//             email: formData.email,
//             role: formData.role
//           },
//           department: formData.department,
//           location: formData.location,
//           hourlyRate: formData.hourlyRate,
//           skills: formData.skills,
//           certifications: formData.certifications,
//           availability: formData.availability,
//           performanceRating: formData.performanceRating,
//         };

//         onSave(updatedResource);
//         onClose();
//         toast.success('Resource updated successfully!');
//       } else {
//         throw new Error(response.data.message || 'Failed to update resource');
//       }
//     } catch (err: any) {
//       console.error('Error updating resource:', err);
      
//       // Handle different types of errors
//       let errorMessage = 'Failed to update resource';
      
//       if (err.response?.data?.message) {
//         errorMessage = err.response.data.message;
//       } else if (err.response?.data?.error) {
//         errorMessage = err.response.data.error;
//       } else if (err.message) {
//         errorMessage = err.message;
//       }
      
//       toast.error(errorMessage);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const getProficiencyLabel = (level: number) => {
//     const levels = ['', 'Beginner', 'Novice', 'Intermediate', 'Advanced', 'Expert'];
//     return levels[level] || 'Unknown';
//   };

//   const getStatusColor = (status: string) => {
//     switch (status) {
//       case 'active': return 'bg-green-100 text-green-800';
//       case 'expiring_soon': return 'bg-yellow-100 text-yellow-800';
//       case 'expired': return 'bg-red-100 text-red-800';
//       default: return 'bg-gray-100 text-gray-800';
//     }
//   };

//   const tabs = [
//     { id: 'basic', label: 'Basic Info', icon: User },
//     { id: 'skills', label: 'Skills', icon: Star },
//     { id: 'certifications', label: 'Certifications', icon: Award },
//   ];

//   const timezones = [
//     'America/New_York',
//     'America/Chicago', 
//     'America/Denver',
//     'America/Los_Angeles',
//     'Europe/London',
//     'Europe/Paris',
//     'Asia/Tokyo',
//     'Asia/Shanghai',
//     'Australia/Sydney'
//   ];

//   const roles = ['admin', 'manager', 'resource', 'client'];
//   // Use API company roles data instead of hardcoded list
//   const departmentOptions = companyRoles.map(role => ({ id: role.id, name: role.name }));
  
//   // Debug logging for company roles
//   console.log('Resource data:', resource);
//   console.log('Form data departmentId:', formData.departmentId);
//   console.log('Available company roles:', companyRoles);
//   console.log('Department options:', departmentOptions);
//   console.log('Resource department ID:', resource.departmentId);
//   console.log('Resource department name:', resource.department);

//   const renderBasicInfo = () => (
//     <div className="space-y-6">
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-2">
//             Full Name *
//           </label>
//           <input
//             type="text"
//             value={formData.name}
//             onChange={(e) => handleInputChange('name', e.target.value)}
//             className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
//               fieldErrors.name ? 'border-red-500' : 'border-gray-300'
//             }`}
//             placeholder="Enter full name"
//           />
//           {fieldErrors.name && (
//             <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
//           )}
//         </div>

//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-2">
//             Email Address *
//           </label>
//           <input
//             type="email"
//             value={formData.email}
//             onChange={(e) => handleInputChange('email', e.target.value)}
//             className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
//               fieldErrors.email ? 'border-red-500' : 'border-gray-300'
//             }`}
//             placeholder="Enter email address"
//           />
//           {fieldErrors.email && (
//             <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
//           )}
//         </div>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-2">
//             Role *
//           </label>
//           <select
//             value={formData.role}
//             onChange={(e) => handleInputChange('role', e.target.value)}
//             className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//           >
//             {roles.map(role => (
//               <option key={role} value={role}>
//                 {role.charAt(0).toUpperCase() + role.slice(1)}
//               </option>
//             ))}
//           </select>
//         </div>

//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-2">
//             Department *
//           </label>
//           <select
//             value={formData.departmentId?.toString() || ''}
//             onChange={(e) => {
//               console.log('Department changed to:', e.target.value);
//               const selectedDept = departmentOptions.find(dept => dept.id.toString() === e.target.value);
//               console.log('Selected department:', selectedDept);
//               handleInputChange('departmentId', e.target.value ? parseInt(e.target.value) : null);
//               handleInputChange('department', selectedDept?.name || '');
//             }}
//             className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
//               fieldErrors.departmentId ? 'border-red-500' : 'border-gray-300'
//             }`}
//           >
//             <option value="">Select Department</option>
//             {departmentOptions.map(dept => (
//               <option key={dept.id} value={dept.id.toString()}>{dept.name}</option>
//             ))}
//           </select>
//           {fieldErrors.departmentId && (
//             <p className="mt-1 text-sm text-red-600">{fieldErrors.departmentId}</p>
//           )}
//         </div>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-2">
//             Location *
//           </label>
//           <div className="relative">
//             <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
//             <input
//               type="text"
//               value={formData.location}
//               onChange={(e) => handleInputChange('location', e.target.value)}
//               className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
//                 fieldErrors.location ? 'border-red-500' : 'border-gray-300'
//               }`}
//               placeholder="City, State/Country"
//             />
//           </div>
//           {fieldErrors.location && (
//             <p className="mt-1 text-sm text-red-600">{fieldErrors.location}</p>
//           )}
//         </div>

//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-2">
//             Timezone *
//           </label>
//           <div className="relative">
//             <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
//             <select
//               value={formData.timezone || 'America/New_York'}
//               onChange={(e) => handleInputChange('timezone', e.target.value)}
//               className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             >
//               {timezones.map(tz => (
//                 <option key={tz} value={tz}>
//                   {tz.replace('_', ' ').replace('/', ' - ')}
//                 </option>
//               ))}
//             </select>
//           </div>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-2">
//             Hourly Rate ($) *
//           </label>
//           <div className="relative">
//             <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
//             <input
//               type="number"
//               min="0"
//               step="5"
//               value={formData.hourlyRate}
//               onChange={(e) => handleInputChange('hourlyRate', parseFloat(e.target.value) || 0)}
//               className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
//                 fieldErrors.hourlyRate ? 'border-red-500' : 'border-gray-300'
//               }`}
//               placeholder="0"
//             />
//           </div>
//           {fieldErrors.hourlyRate && (
//             <p className="mt-1 text-sm text-red-600">{fieldErrors.hourlyRate}</p>
//           )}
//         </div>

//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-2">
//             Total Allocation (%)
//           </label>
//           <div className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-700">
//             {formData.availability}%
//           </div>
//           <p className="mt-1 text-xs text-gray-500">
//             This value is automatically calculated based on your project allocations
//           </p>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-2">
//             Employment Type
//           </label>
//           <select
//             value={formData.employmentType}
//             onChange={(e) => handleInputChange('employmentType', e.target.value)}
//             className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//           >
//             <option value="full_time">Full Time</option>
//             <option value="part_time">Part Time</option>
//             <option value="contract">Contract</option>
//             <option value="consultant">Consultant</option>
//           </select>
//         </div>

//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-2">
//             Level
//           </label>
//           <select
//             value={formData.level}
//             onChange={(e) => handleInputChange('level', e.target.value)}
//             className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//           >
//             <option value="junior">Junior</option>
//             <option value="mid">Mid Level</option>
//             <option value="senior">Senior</option>
//             <option value="lead">Lead</option>
//             <option value="principal">Principal</option>
//           </select>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-2">
//             Cost Center
//           </label>
//           <input
//             type="text"
//             value={formData.costCenter}
//             onChange={(e) => handleInputChange('costCenter', e.target.value)}
//             className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             placeholder="Enter cost center"
//           />
//         </div>

//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-2">
//             Hours Per Week
//           </label>
//           <input
//             type="number"
//             min="1"
//             max="80"
//             value={formData.hoursPerWeek}
//             onChange={(e) => handleInputChange('hoursPerWeek', parseInt(e.target.value) || 40)}
//             className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             placeholder="40"
//           />
//         </div>
//       </div>

//       {/* <div>
//         <label className="block text-sm font-medium text-gray-700 mb-2">
//           Notes
//         </label>
//         <textarea
//           value={formData.notes}
//           onChange={(e) => handleInputChange('notes', e.target.value)}
//           className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//           rows={3}
//           placeholder="Additional notes about the resource..."
//         />
//       </div> */}

//       <div>
//         <label className="block text-sm font-medium text-gray-700 mb-2">
//           Performance Rating: {formData.performanceRating}/5.0
//         </label>
//         <input
//           type="range"
//           min="1"
//           max="5"
//           step="0.1"
//           value={formData.performanceRating}
//           onChange={(e) => handleInputChange('performanceRating', parseFloat(e.target.value))}
//           className="w-full"
//         />
//         <div className="flex justify-between text-xs text-gray-500 mt-1">
//           <span>1.0 - Needs Improvement</span>
//           <span>3.0 - Meets Expectations</span>
//           <span>5.0 - Exceeds Expectations</span>
//         </div>
//       </div>
//     </div>
//   );

//   const renderSkills = () => (
//     <div className="space-y-6">
//       <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
//         <h4 className="font-medium text-blue-900 mb-3">Add New Skill</h4>
//         <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
//           <select
//             value={newSkill.skillId}
//             onChange={(e) => setNewSkill(prev => ({ ...prev, skillId: e.target.value }))}
//             className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//           >
//             <option value="">Select Skill</option>
//             {skills
//               .filter(skill => !formData.skills.some(s => s.skillId === skill.id))
//               .map(skill => (
//                 <option key={skill.id} value={skill.id}>{skill.name}</option>
//               ))}
//           </select>
          
//           <select
//             value={newSkill.proficiencyLevel}
//             onChange={(e) => setNewSkill(prev => ({ ...prev, proficiencyLevel: parseInt(e.target.value) }))}
//             className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//           >
//             {[1, 2, 3, 4, 5].map(level => (
//               <option key={level} value={level}>
//                 {level} - {getProficiencyLabel(level)}
//               </option>
//             ))}
//           </select>
          
//           <input
//             type="number"
//             min="0"
//             max="20"
//             value={newSkill.yearsExperience}
//             onChange={(e) => setNewSkill(prev => ({ ...prev, yearsExperience: parseInt(e.target.value) || 0 }))}
//             className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             placeholder="Years"
//           />
          
//           <button
//             type="button"
//             onClick={addSkill}
//             className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
//           >
//             <Plus className="w-4 h-4 mr-1" />
//             Add
//           </button>
//         </div>
//       </div>

//       <div className="space-y-3">
//         <h4 className="font-medium text-gray-900">Current Skills ({formData.skills.length})</h4>
//         {formData.skills.map(skill => (
//           <div key={skill.skillId} className="bg-white border border-gray-200 rounded-lg p-4">
//             <div className="flex items-center justify-between mb-3">
//               <div>
//                 <h5 className="font-medium text-gray-900">{skill.skill.name}</h5>
//                 <p className="text-sm text-gray-600">{skill.skill.category}</p>
//               </div>
//               <button
//                 type="button"
//                 onClick={() => removeSkill(skill.skillId)}
//                 className="text-red-600 hover:text-red-700 p-1"
//               >
//                 <Trash2 className="w-4 h-4" />
//               </button>
//             </div>
            
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               <div>
//                 <label className="block text-xs font-medium text-gray-700 mb-1">
//                   Proficiency Level
//                 </label>
//                 <select
//                   value={skill.proficiencyLevel}
//                   onChange={(e) => updateSkill(skill.skillId, 'proficiencyLevel', parseInt(e.target.value))}
//                   className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 >
//                   {[1, 2, 3, 4, 5].map(level => (
//                     <option key={level} value={level}>
//                       {level} - {getProficiencyLabel(level)}
//                     </option>
//                   ))}
//                 </select>
//               </div>
              
//               <div>
//                 <label className="block text-xs font-medium text-gray-700 mb-1">
//                   Years Experience
//                 </label>
//                 <input
//                   type="number"
//                   min="0"
//                   max="20"
//                   value={skill.yearsExperience}
//                   onChange={(e) => updateSkill(skill.skillId, 'yearsExperience', parseInt(e.target.value) || 0)}
//                   className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>
//             </div>
//           </div>
//         ))}
        
//         {formData.skills.length === 0 && (
//           <div className="text-center py-8 text-gray-500">
//             <Star className="w-8 h-8 mx-auto mb-2 text-gray-400" />
//             <p>No skills added yet</p>
//           </div>
//         )}
//       </div>
//     </div>
//   );

//   const renderCertifications = () => (
//     <div className="space-y-6">
//         <div className="bg-green-50 p-4 rounded-lg border border-green-200">
//         <h4 className="font-medium text-green-900 mb-3">Add New Certification</h4>
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
//           <select
//             value={newCertification.certificationId}
//             onChange={(e) => setNewCertification(prev => ({ ...prev, certificationId: e.target.value }))}
//             className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//           >
//             <option value="">Select Certification</option>
//             {certifications
//               .filter(cert => !formData.certifications.some(c => c.certificationId === cert.id))
//               .map(cert => (
//                 <option key={cert.id} value={cert.id}>{cert.name}</option>
//               ))}
//           </select>
          
//           <input
//             type="date"
//             value={newCertification.dateObtained}
//             onChange={(e) => setNewCertification(prev => ({ ...prev, dateObtained: e.target.value }))}
//             className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             placeholder="Date Obtained"
//           />
          
//           <input
//             type="date"
//             value={newCertification.expirationDate}
//             onChange={(e) => setNewCertification(prev => ({ ...prev, expirationDate: e.target.value }))}
//             className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             placeholder="Expiration Date"
//           />
          
//           <select
//             value={newCertification.status}
//             onChange={(e) => setNewCertification(prev => ({ ...prev, status: e.target.value as any }))}
//             className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//           >
//             <option value="active">Active</option>
//             <option value="expiring_soon">Expiring Soon</option>
//             <option value="expired">Expired</option>
//           </select>
//         </div>      
        
//         <div className="flex justify-end">
//           <button
//             type="button"
//             onClick={addCertification}
//             className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
//           >
//             <Plus className="w-4 h-4 mr-1" />
//             Add
//           </button>
//         </div>
//       </div>

//       <div className="space-y-3">
//         <h4 className="font-medium text-gray-900">Current Certifications ({formData.certifications.length})</h4>
//         {formData.certifications.map(cert => (
//           <div key={cert.certificationId} className="bg-white border border-gray-200 rounded-lg p-4">
//             <div className="flex items-center justify-between mb-3">
//               <div>
//                 <h5 className="font-medium text-gray-900">{cert.certification.name}</h5>
//                 <p className="text-sm text-gray-600">{cert.certification.issuingOrganization}</p>
//               </div>
//               <div className="flex items-center space-x-2">
//                 <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(cert.status)}`}>
//                   {cert.status.replace('_', ' ').toUpperCase()}
//                 </span>
//                 <button
//                   type="button"
//                   onClick={() => removeCertification(cert.certificationId)}
//                   className="text-red-600 hover:text-red-700 p-1"
//                 >
//                   <Trash2 className="w-4 h-4" />
//                 </button>
//               </div>
//             </div>
            
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//               <div>
//                 <label className="block text-xs font-medium text-gray-700 mb-1">
//                   Date Obtained
//                 </label>
//                 <input
//                   type="date"
//                   value={cert.dateObtained}
//                   onChange={(e) => updateCertification(cert.certificationId, 'dateObtained', e.target.value)}
//                   className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>
              
//               <div>
//                 <label className="block text-xs font-medium text-gray-700 mb-1">
//                   Expiration Date
//                 </label>
//                 <input
//                   type="date"
//                   value={cert.expirationDate || ''}
//                   onChange={(e) => updateCertification(cert.certificationId, 'expirationDate', e.target.value)}
//                   className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>
              
//               <div>
//                 <label className="block text-xs font-medium text-gray-700 mb-1">
//                   Status
//                 </label>
//                 <select
//                   value={cert.status}
//                   onChange={(e) => updateCertification(cert.certificationId, 'status', e.target.value)}
//                   className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 >
//                   <option value="active">Active</option>
//                   <option value="expiring_soon">Expiring Soon</option>
//                   <option value="expired">Expired</option>
//                 </select>
//               </div>
//             </div>
//           </div>
//         ))}
        
//         {formData.certifications.length === 0 && (
//           <div className="text-center py-8 text-gray-500">
//             <Award className="w-8 h-8 mx-auto mb-2 text-gray-400" />
//             <p>No certifications added yet</p>
//           </div>
//         )}
//       </div>
//     </div>
//   ); 

//  return (
//   <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
//     <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
//       {/* Header */}
//       <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
//         <div className="flex items-center">
//           <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mr-4">
//             <User className="w-6 h-6 text-white" />
//           </div>
//           <div>
//             <h2 className="text-2xl font-bold text-gray-900">Edit Resource</h2>
//             <p className="text-gray-600">{resource.user.name} - {resource.department}</p>
//           </div>
//         </div>
//         <button
//           onClick={onClose}
//           className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
//         >
//           <X className="w-5 h-5" />
//         </button>
//       </div>

//       {/* Main Content */}
//       <div className="flex flex-1 min-h-0">
//         {/* Tab Navigation */}
//         <div className="w-64 border-r border-gray-200 p-4 flex-shrink-0">
//           <nav className="space-y-2">
//             {tabs.map((tab) => {
//               const Icon = tab.icon;
//               return (
//                 <button
//                   key={tab.id}
//                   onClick={() => setActiveTab(tab.id)}
//                   className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors text-left ${
//                     activeTab === tab.id
//                       ? 'bg-blue-100 text-blue-700 border border-blue-200'
//                       : 'text-gray-600 hover:bg-gray-100'
//                   }`}
//                 >
//                   <Icon className="w-5 h-5 mr-3" />
//                   {tab.label}
//                 </button>
//               );
//             })}
//           </nav>
//         </div>

//         {/* Tab Content */}
//         <div className="flex-1 p-6 overflow-y-auto">
//           {activeTab === 'basic' && renderBasicInfo()}
//           {activeTab === 'skills' && renderSkills()}
//           {activeTab === 'certifications' && renderCertifications()}
//         </div>
//       </div>

//       {/* Footer - Fixed positioning */}
//       <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
//         <div className="text-sm text-gray-600">
//           Last updated: {new Date().toLocaleDateString()}
//         </div>
//         <div className="flex gap-3">
//           <button
//             type="button"
//             onClick={onClose}
//             className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
//           >
//             Cancel
//           </button>
//           <button
//             type="button"
//             onClick={handleSave}
//             disabled={isLoading}
//             className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
//           >
//             {isLoading ? (
//               <Loader2 className="w-4 h-4 mr-2 animate-spin" />
//             ) : (
//               <Save className="w-4 h-4 mr-2" />
//             )}
//             {isLoading ? 'Saving...' : 'Save Changes'}
//           </button>
//         </div>
//       </div>
//     </div>
//   </div>
// );

// }






import { useState, useEffect } from 'react';
import { X, Plus, Trash2, User, MapPin, DollarSign, Clock, Award, Star, Save, Loader2 } from 'lucide-react';
import { Resource } from '../Dashboard/types';
import api from '../../../lib/api';
import { toast } from 'react-toastify';
 
interface ResourceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: Resource;
  onSave: (updatedResource: Resource) => void;
  companyId?: string;
  companyRoles?: any[];
}
 
export default function ResourceEditModal({ isOpen, onClose, resource, onSave, companyId, companyRoles = [] }: ResourceEditModalProps) {
  const [formData, setFormData] = useState({
    name: resource.user.name,
    email: resource.user.email,
    role: resource.user.role,
    department: resource.department,
    departmentId: resource.departmentId || null, // Set from resource data
    location: resource.location,
    hourlyRate: resource.hourlyRate || 0,
    timezone: 'America/New_York', // Default timezone
    employmentType: resource.resource?.employment_type || 'full_time',
    level: resource.resource?.level || 'senior',
    costCenter: resource.resource?.cost_center || 'default',
    workingDays: resource.resource?.working_days || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    hoursPerWeek: resource.resource?.hours_per_week || 40,
    skills: [...resource.skills],
    certifications: [...resource.certifications],
    availability: resource.availability,
    performanceRating: resource.performanceRating,
  });
 
  const [activeTab, setActiveTab] = useState('basic');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [skills, setSkills] = useState<any[]>([]);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [newSkill, setNewSkill] = useState({ skillId: '', proficiencyLevel: 1, yearsExperience: 0 });
  const [newCertification, setNewCertification] = useState({
    certificationId: '',
    dateObtained: '',
    expirationDate: '',
    certificateNumber: '',
    verificationUrl: '',
    status: 'active' as 'active' | 'expired' | 'expiring_soon'
  });
 
  // Fetch skills and certifications from API
  useEffect(() => {
    const fetchSkillsAndCertifications = async () => {
      try {
        const token = localStorage.getItem('token');
 
        // Fetch skills
        const skillsResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/psa/skills`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
 
        console.log('Skills API response status:', skillsResponse.status);
        if (skillsResponse.ok) {
          const skillsData = await skillsResponse.json();
          console.log('Skills API response:', skillsData);
          if (skillsData.success) {
            console.log('Setting skills:', skillsData.skills);
            setSkills(skillsData.skills);
          }
        } else {
          console.error('Skills API failed:', skillsResponse.status, skillsResponse.statusText);
        }
 
        // Fetch certifications
        const certificationsResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/psa/certifications`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
 
        if (certificationsResponse.ok) {
          const certificationsData = await certificationsResponse.json();
          console.log('Certifications API response:', certificationsData);
          if (certificationsData.success) {
            console.log('Setting certifications:', certificationsData.certifications);
            console.log('First certification:', certificationsData.certifications[0]);
            setCertifications(certificationsData.certifications);
          }
        } else {
          console.error('Certifications API failed:', certificationsResponse.status, certificationsResponse.statusText);
        }
      } catch (error) {
        console.error('Error fetching skills and certifications:', error);
      }
    };
 
    if (isOpen) {
      fetchSkillsAndCertifications();
    }
  }, [isOpen]);
 
  const handleDeleteSkill = async (skillId: string) => {
  try {
      setIsLoading(true);
    const token = localStorage.getItem('token');
 
      // Delete from psa_resource_skills table (not from master psa_skills)
      console.log('fdfd',resource)
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/psa/resource-skills/${resource.id}/${skillId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
 
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
          // Remove from formData.skills (current skills list)
          setFormData(prev => ({
            ...prev,
            skills: prev.skills.filter(s => s.skillId !== skillId)
          }));
          
          // Show success toast
          toast.success('Skill removed successfully!');
      } else {
        console.error('Failed to delete skill:', data.message);
          toast.error('Failed to delete skill');
      }
    } else {
      console.error('Failed to delete skill:', response.statusText);
        toast.error('Failed to delete skill');
    }
  } catch (error) {
    console.error('Error deleting skill:', error);
      toast.error('Error deleting skill');
    } finally {
      setIsLoading(false);
  }
};
 
const handleDeleteCertification = async (certification_id: string) => {
  try {
    setIsLoading(true);
    const token = localStorage.getItem('token');
    console.log("Deleting certification ID:", certification_id);
 
    // Delete from psa_resource_certifications table (not from master psa_certifications)
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/psa/resource-certifications/${resource.id}/${certification_id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
 
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        // Remove from formData.certifications (current certifications list)
        setFormData(prev => ({
          ...prev,
          certifications: prev.certifications.filter(c => 
            c.certificationId !== certification_id
          )
        }));
        
        // Show success toast
        toast.success('Certification removed successfully!');
      } else {
        console.error('Failed to delete certification:', data.message);
        toast.error('Failed to delete certification');
      }
    } else {
      console.error('Failed to delete certification:', response.statusText);
      toast.error('Failed to delete certification');
    }
  } catch (error) {
    console.error('Error deleting certification:', error);
    toast.error('Error deleting certification');
  } finally {
    setIsLoading(false);
  }
};
 
 
 
  // Update formData when resource changes
// Update formData only when all data is ready
useEffect(() => {
  console.log('useEffect running - resource:', resource);
  console.log('useEffect running - certifications.length:', certifications.length);
  console.log('useEffect running - skills.length:', skills.length);
  if (!resource) return;
 
  let departmentId = resource.departmentId || null;
  if (!departmentId && resource.department && companyRoles.length > 0) {
    const matchingRole = companyRoles.find(role => role.name === resource.department);
    if (matchingRole) departmentId = matchingRole.id;
  }
 
  setFormData(prev => ({
    ...prev,
    departmentId,
    department: resource.department,
    employmentType: resource.employmentType || 'full_time',
    level: resource.level || 'senior',
    costCenter: resource.costCenter || 'default',
    workingDays: resource.workingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    hoursPerWeek: resource.hoursPerWeek || 40,
    location: resource.location,
    hourlyRate: resource.hourlyRate || 0,
    availability: resource.availability,
    performanceRating: resource.performanceRating,
 
    // ✅ Only use resource's existing skills (from psa_resource_skills)
    skills: resource.skills.map(existing => ({
      skillId: existing.skill_id || existing.skill?.id || existing.skillId,
      resourceSkillId: existing.id || existing.resourceSkillId, // Include resource skill ID for updates
      skill: {
        id: existing.skill_id || existing.skill?.id || existing.skillId,
        name: existing.skill_name || existing.skill?.name,
        category: existing.skill_category || existing.skill?.category,
        description: existing.skill_description || existing.skill?.description
      },
      proficiencyLevel: existing.proficiency_level || existing.proficiencyLevel,
      yearsExperience: existing.years_experience || existing.yearsExperience,
      lastUsed: existing.last_used || existing.lastUsed
    })),
 
    // ✅ Use only resource's current certifications (from psa_resource_certifications)
    certifications: resource.certifications.map(existing => {
      console.log('Raw certification data:', existing);
      const mappedCert = {
        certificationId: existing.certificationId,
        resourceCertificationId: existing.id,
        certification: {
          id: existing.certificationId,
          name: existing.certification.name,
          issuingOrganization: existing.certification.issuingOrganization,
          description: existing.certification.description
        },
        dateObtained: existing.dateObtained ? existing.dateObtained.split('T')[0] : '',
        expirationDate: existing.expirationDate ? existing.expirationDate.split('T')[0] : '',
        certificateNumber: existing.certificateNumber || '',
        verificationUrl: existing.verificationUrl || '',
        status: existing.status
      };
      console.log('Mapped certification:', mappedCert);
      return mappedCert;
})
  }));
}, [resource, companyRoles, certifications, skills]);
 
 
 
  if (!isOpen) return null;
 
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
  };
 
  const validateField = (field: string, value: any): string => {
    switch (field) {
      case 'name':
        if (!value || value.trim().length === 0) return 'Full name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return '';
      case 'email':
        if (!value || value.trim().length === 0) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return 'Please enter a valid email address';
        return '';
      case 'departmentId':
        if (!value) return 'Department is required';
        return '';
      case 'location':
        if (!value || value.trim().length === 0) return 'Location is required';
        return '';
      case 'hourlyRate':
        if (!value || value <= 0) return 'Hourly rate must be greater than 0';
        if (value > 1000) return 'Hourly rate seems too high';
        return '';
      case 'performanceRating':
        if (value < 1 || value > 5) return 'Performance rating must be between 1 and 5';
        return '';
      default:
        return '';
    }
  };
 
  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    let isValid = true;
 
    // Validate required fields
    const requiredFields = ['name', 'email', 'departmentId', 'location', 'hourlyRate'];
 
    requiredFields.forEach(field => {
      const error = validateField(field, formData[field as keyof typeof formData]);
      if (error) {
        errors[field] = error;
        isValid = false;
      }
    });
 
    setFieldErrors(errors);
    return isValid;
  };
 
  const addSkill = () => {
    if (newSkill.skillId && !formData.skills.some(s => s.skillId === newSkill.skillId)) {
      const skill = skills.find(s => s.id === newSkill.skillId);
      if (skill) {
        const resourceSkill = {
          skillId: skill.id, // Use the actual skill ID from database
          skill,
          proficiencyLevel: newSkill.proficiencyLevel as 1 | 2 | 3 | 4 | 5,
          yearsExperience: newSkill.yearsExperience,
          lastUsed: new Date().toISOString().split('T')[0]
        };
        setFormData(prev => ({
          ...prev,
          skills: [...prev.skills, resourceSkill]
        }));
        setNewSkill({ skillId: '', proficiencyLevel: 1, yearsExperience: 0 });
        
        // Show success toast
        toast.success('Skill added successfully!');
      }
    }
  };
 
  const removeSkill = (skillId: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s.skillId !== skillId)
    }));
  };
 
  const updateSkill = (skillId: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.map(s =>
        s.skillId === skillId ? { ...s, [field]: value } : s
      )
    }));
  };
 
  const addCertification = () => {
    console.log('Add Certification clicked');
    console.log('newCertification:', newCertification);
    console.log('certifications array:', certifications);
    
    if (newCertification.certificationId && newCertification.dateObtained) {
      // Try to find certification by certification_id first, then by name (fallback)
      let certification = certifications.find(c => c.certification_id === newCertification.certificationId);
      
      // If not found by certification_id, try by name (fallback)
      if (!certification) {
        certification = certifications.find(c => c.name === newCertification.certificationId);
      }
      
      console.log('Found certification:', certification);
      
      if (certification) {
        const resourceCertification = {
          certificationId: certification.certification_id, // Use the actual certification ID from database
          certification: {
            id: certification.certification_id,
            name: certification.name,
            issuingOrganization: certification.category || certification.issuing_organization || 'Unknown',
            description: certification.description || ''
          },
          dateObtained: newCertification.dateObtained || null,
          expirationDate: newCertification.expirationDate || null,
          certificateNumber: newCertification.certificateNumber,
          verificationUrl: newCertification.verificationUrl,
          status: newCertification.status
        };
        
        console.log('Adding resource certification:', resourceCertification);
        
        setFormData(prev => ({
          ...prev,
          certifications: prev.certifications.some(c => c.certificationId === certification.certification_id)
            ? prev.certifications // don't add if already exists
            : [...prev.certifications, resourceCertification]
        }));
 
        setNewCertification({
          certificationId: '',
          dateObtained: '',
          expirationDate: '',
          certificateNumber: '',
          verificationUrl: '',
          status: 'active'
        });
        
        console.log('Certification added successfully');
        // Show success toast instead of alert
        toast.success('Certification added successfully!');
      } else {
        console.log('Certification not found in certifications array');
      }
    } else {
      console.log('Missing required fields:', {
        certificationId: newCertification.certificationId,
        dateObtained: newCertification.dateObtained
      });
    }
  };
 
  const removeCertification = (certificationId: string) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.filter(c => c.certificationId !== certificationId)
    }));
  };
 
  const updateCertification = (certificationId: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.map(c =>
        c.certificationId === certificationId ? { ...c, [field]: value } : c
      )
    }));
  };
 
  const handleSave = async () => {
    if (!companyId) {
      toast.error('Company ID is required');
      return;
    }
 
    // Validate form before submitting
    if (!validateForm()) {
      toast.error('Please fix the validation errors before saving');
      return;
    }
 
    setIsLoading(true);
 
    try {
      // Prepare the payload according to the API structure
      const payload = {
        resourceId: resource.resource?.resource_id || null, // Resource ID for skills/certifications
        userId: resource.user.id, // This is the user ID
        employeeId: resource.user.id, // Using user ID as employee ID
        employmentType: formData.employmentType,
        level: formData.level,
        hourlyRate: formData.hourlyRate,
        costCenter: formData.costCenter,
        workingDays: formData.workingDays,
        hoursPerWeek: formData.hoursPerWeek,
        performanceRating: formData.performanceRating,
        departmentId: formData.departmentId, // Use selected department ID
        location: formData.location,
        skills: formData.skills.map(skill => ({
          id: skill.skillId || null, // Use the skill ID from database
          name: skill.skill?.name || 'Unknown Skill',
          category: skill.skill?.category || 'General',
          description: skill.skill?.description || '',
          proficiency_level: skill.proficiencyLevel,
          years_experience: skill.yearsExperience,
          last_used: skill.lastUsed,
          resourceSkillId: skill.resourceSkillId || null // Use existing resource skill ID if available
        })),
        certifications: formData.certifications.map(cert => ({
          id: cert.certificationId || null, // Use the certification ID from database
          name: cert.certification?.name || 'Unknown Certification',
          issuing_organization: cert.certification?.issuingOrganization || 'Unknown',
          description: cert.certification?.description || '',
          validity_period_months: 12, // Default validity period
          date_obtained: cert.dateObtained || null,
          expiration_date: cert.expirationDate || null,
          status: cert.status,
          certificate_number: cert.certificateNumber || '',
          verification_url: cert.verificationUrl || '',
          resourceCertificationId: cert.resourceCertificationId || null // Use existing resource certification ID if available
        }))
      };
 
      // Call the API
      const response = await api.post(`/psa/resources/${resource.user.id}/${companyId}`, payload);
 
      if (response.data.success) {
        // Create updated resource object
        const updatedResource: Resource = {
          ...resource,
          user: {
            ...resource.user,
            name: formData.name,
            email: formData.email,
            role: formData.role
          },
          department: formData.department,
          location: formData.location,
          hourlyRate: formData.hourlyRate,
          skills: formData.skills,
          certifications: formData.certifications,
          availability: formData.availability,
          performanceRating: formData.performanceRating,
        };
 
        // Call onSave - Resources.tsx will handle the complete refresh
        onSave(updatedResource);
      } else {
        throw new Error(response.data.message || 'Failed to update resource');
      }
    } catch (err: any) {
      console.error('Error updating resource:', err);
 
      // Handle different types of errors
      let errorMessage = 'Failed to update resource';
 
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
 
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
 
  const getProficiencyLabel = (level: number) => {
    const levels = ['', 'Beginner', 'Novice', 'Intermediate', 'Advanced', 'Expert'];
    return levels[level] || 'Unknown';
  };
 
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expiring_soon': return 'bg-yellow-100 text-yellow-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
 
  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: User },
    { id: 'skills', label: 'Skills', icon: Star },
    { id: 'certifications', label: 'Certifications', icon: Award },
  ];
 
  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney'
  ];
 
  const roles = ['admin', 'manager', 'resource', 'client'];
  // Use API company roles data instead of hardcoded list
  const departmentOptions = companyRoles.map(role => ({ id: role.id, name: role.name }));
 
  // Debug logging for company roles
  console.log('Resource data:', resource);
  console.log('Form data departmentId:', formData.departmentId);
  console.log('Available company roles:', companyRoles);
  console.log('Department options:', departmentOptions);
  console.log('Resource department ID:', resource.departmentId);
  console.log('Resource department name:', resource.department);
 
  const renderBasicInfo = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${fieldErrors.name ? 'border-red-500' : 'border-gray-300'
              }`}
            placeholder="Enter full name"
          />
          {fieldErrors.name && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
          )}
        </div>
 
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address *
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${fieldErrors.email ? 'border-red-500' : 'border-gray-300'
              }`}
            placeholder="Enter email address"
          />
          {fieldErrors.email && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
          )}
        </div>
      </div>
 
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Role *
          </label>
          <select
            value={formData.role}
            onChange={(e) => handleInputChange('role', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {roles.map(role => (
              <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>
        </div>
 
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Department *
          </label>
          <select
            value={formData.departmentId?.toString() || ''}
            onChange={(e) => {
              console.log('Department changed to:', e.target.value);
              const selectedDept = departmentOptions.find(dept => dept.id.toString() === e.target.value);
              console.log('Selected department:', selectedDept);
              handleInputChange('departmentId', e.target.value ? parseInt(e.target.value) : null);
              handleInputChange('department', selectedDept?.name || '');
            }}
            className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${fieldErrors.departmentId ? 'border-red-500' : 'border-gray-300'
              }`}
          >
            <option value="">Select Department</option>
            {departmentOptions.map(dept => (
              <option key={dept.id} value={dept.id.toString()}>{dept.name}</option>
            ))}
          </select>
          {fieldErrors.departmentId && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.departmentId}</p>
          )}
        </div>
      </div>
 
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location *
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${fieldErrors.location ? 'border-red-500' : 'border-gray-300'
                }`}
              placeholder="City, State/Country"
            />
          </div>
          {fieldErrors.location && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.location}</p>
          )}
        </div>
 
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Timezone *
          </label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={formData.timezone || 'America/New_York'}
              onChange={(e) => handleInputChange('timezone', e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {timezones.map(tz => (
                <option key={tz} value={tz}>
                  {tz.replace('_', ' ').replace('/', ' - ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
 
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Hourly Rate ($) *
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="number"
              min="0"
              step="5"
              value={formData.hourlyRate}
              onChange={(e) => handleInputChange('hourlyRate', parseFloat(e.target.value) || 0)}
              className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${fieldErrors.hourlyRate ? 'border-red-500' : 'border-gray-300'
                }`}
              placeholder="0"
            />
          </div>
          {fieldErrors.hourlyRate && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.hourlyRate}</p>
          )}
        </div>
 
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Total Allocation (%)
          </label>
          <div className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-700">
            {formData.availability}%
          </div>
          <p className="mt-1 text-xs text-gray-500">
            This value is automatically calculated based on your project allocations
          </p>
        </div>
      </div>
 
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Employment Type
          </label>
          <select
            value={formData.employmentType}
            onChange={(e) => handleInputChange('employmentType', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="full_time">Full Time</option>
            <option value="part_time">Part Time</option>
            <option value="contract">Contract</option>
            <option value="consultant">Consultant</option>
          </select>
        </div>
 
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Level
          </label>
          <select
            value={formData.level}
            onChange={(e) => handleInputChange('level', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="junior">Junior</option>
            <option value="mid">Mid Level</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead</option>
            <option value="principal">Principal</option>
          </select>
        </div>
      </div>
 
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cost Center
          </label>
          <input
            type="text"
            value={formData.costCenter}
            onChange={(e) => handleInputChange('costCenter', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter cost center"
          />
        </div>
 
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Hours Per Week
          </label>
          <input
            type="number"
            min="1"
            max="80"
            value={formData.hoursPerWeek}
            onChange={(e) => handleInputChange('hoursPerWeek', parseInt(e.target.value) || 40)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="40"
          />
        </div>
      </div>
 
      {/* <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          placeholder="Additional notes about the resource..."
        />
      </div> */}
 
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Performance Rating: {formData.performanceRating}/5.0
        </label>
        <input
          type="range"
          min="1"
          max="5"
          step="0.1"
          value={formData.performanceRating}
          onChange={(e) => handleInputChange('performanceRating', parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>1.0 - Needs Improvement</span>
          <span>3.0 - Meets Expectations</span>
          <span>5.0 - Exceeds Expectations</span>
        </div>
      </div>
    </div>
  );
 
  const renderSkills = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h4 className="font-medium text-blue-900 mb-3">Add New Skill</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={newSkill.skillId}
            onChange={(e) => setNewSkill(prev => ({ ...prev, skillId: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Skill</option>
            {console.log('Skills for dropdown:', skills)}
            {console.log('FormData skills:', formData.skills)}
            {skills
              .filter(skill => !formData.skills.some(s => s.skillId === skill.id))
              .map(skill => {
                console.log('Rendering skill option:', skill);
                return (
                <option key={skill.id} value={skill.id}>{skill.name}</option>
                );
              })}
          </select>
 
          <select
            value={newSkill.proficiencyLevel}
            onChange={(e) => setNewSkill(prev => ({ ...prev, proficiencyLevel: parseInt(e.target.value) }))}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {[1, 2, 3, 4, 5].map(level => (
              <option key={level} value={level}>
                {level} - {getProficiencyLabel(level)}
              </option>
            ))}
          </select>
 
          <input
            type="number"
            min="0"
            max="20"
            value={newSkill.yearsExperience}
            onChange={(e) => setNewSkill(prev => ({ ...prev, yearsExperience: parseInt(e.target.value) || 0 }))}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Years"
          />
 
          <button
            type="button"
            onClick={addSkill}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </button>
        </div>
      </div>
 
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Current Skills ({formData.skills.length})</h4>
        {console.log('formData.skills for rendering:', formData.skills)}
        {formData.skills.map(skill => {
          console.log('Rendering skill:', skill);
          return (
          <div key={skill.skillId} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h5 className="font-medium text-gray-900">{skill.skill?.name || 'Unknown Skill'}</h5>
                <p className="text-sm text-gray-600">{skill.skill?.category || 'Unknown Category'}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteSkill(skill.skillId)}
                disabled={isLoading}
                className="text-red-600 hover:text-red-700 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
 
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Proficiency Level
                </label>
                <select
                  value={skill.proficiencyLevel}
                  onChange={(e) => updateSkill(skill.skillId, 'proficiencyLevel', parseInt(e.target.value))}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {[1, 2, 3, 4, 5].map(level => (
                    <option key={level} value={level}>
                      {level} - {getProficiencyLabel(level)}
                    </option>
                  ))}
                </select>
              </div>
 
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Years Experience
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={skill.yearsExperience}
                  onChange={(e) => updateSkill(skill.skillId, 'yearsExperience', parseInt(e.target.value) || 0)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
          );
        })}
 
        {formData.skills.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Star className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No skills added yet</p>
          </div>
        )}
      </div>
    </div>
  );
 
  const renderCertifications = () => (
    <div className="space-y-6">
      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <h4 className="font-medium text-green-900 mb-3">Add New Certification</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <select
            value={newCertification.certificationId}
            onChange={(e) => {
              console.log('Certification selected:', e.target.value);
              setNewCertification(prev => ({ ...prev, certificationId: e.target.value }));
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Certification</option>
            {certifications
              .filter(cert => !formData.certifications.some(c => c.certificationId === cert.certification_id))
              .map(cert => {
                console.log('Available certification:', cert);
                return (
                  <option key={cert.certification_id} value={cert.certification_id}>{cert.name}</option>
                );
              })}
          </select>
 
          <input
            type="date"
            value={newCertification.dateObtained || ''}
            onChange={(e) => {
              console.log('Date obtained changed:', e.target.value);
              setNewCertification(prev => ({ ...prev, dateObtained: e.target.value }));
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Date Obtained"
          />
 
          <input
            type="date"
            value={newCertification.expirationDate || ''}
            onChange={(e) => setNewCertification(prev => ({ ...prev, expirationDate: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Expiration Date"
          />
 
          <select
            value={newCertification.status}
            onChange={(e) => setNewCertification(prev => ({ ...prev, status: e.target.value as any }))}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="active">Active</option>
            <option value="expiring_soon">Expiring Soon</option>
            <option value="expired">Expired</option>
          </select>
        </div>
 
        <div className="flex justify-end">
          <button
            type="button"
            onClick={addCertification}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </button>
        </div>
      </div>
 
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Current Certifications ({formData.certifications.length})</h4>
        {formData.certifications.map((cert:any) => {
           console.log("Certification Data:", cert);
           console.log("Date Obtained:", cert.dateObtained);
           console.log("Expiration Date:", cert.expirationDate);
        return (
          <div key={cert.certificationId} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h5 className="font-medium text-gray-900">{cert.certification.name}</h5>
                <p className="text-sm text-gray-600">{cert.certification.issuingOrganization}</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(cert.status)}`}>
                  {cert.status.replace('_', ' ').toUpperCase()}
                </span>
                <button
  type="button"
  onClick={() => {
                    console.log('Certification to delete:', cert);
                    // Use cert.certificationId directly since that's the actual certification ID
                    handleDeleteCertification(cert.certificationId);
                  }}
                  disabled={isLoading}
                  className="text-red-600 hover:text-red-700 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
  <Trash2 className="w-4 h-4" />
                  )}
</button>
 
              </div>
            </div>
 
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date Obtained
                </label>
                <input
                  type="date"
                  value={cert.dateObtained || ''}
                  onChange={(e) => updateCertification(cert.certificationId, 'dateObtained', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
 
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Expiration Date
                </label>
                <input
                  type="date"
                  value={cert.expirationDate || ''}
                  onChange={(e) => updateCertification(cert.certificationId, 'expirationDate', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
 
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={cert.status}
                  onChange={(e) => updateCertification(cert.certificationId, 'status', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="expiring_soon">Expiring Soon</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
          </div>
        )})}
 
        {formData.certifications.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Award className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No certifications added yet</p>
          </div>
        )}
      </div>
    </div>
  );
 
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mr-4">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit Resource</h2>
              <p className="text-gray-600">{resource.user.name} - {resource.department}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
 
        {/* Main Content */}
        <div className="flex flex-1 min-h-0">
          {/* Tab Navigation */}
          <div className="w-64 border-r border-gray-200 p-4 flex-shrink-0">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors text-left ${activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
 
          {/* Tab Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'basic' && renderBasicInfo()}
            {activeTab === 'skills' && renderSkills()}
            {activeTab === 'certifications' && renderCertifications()}
          </div>
        </div>
 
        {/* Footer - Fixed positioning */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="text-sm text-gray-600">
            Last updated: {new Date().toLocaleDateString()}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
 
}
 