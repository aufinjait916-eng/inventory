import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Plus,
  Layers,
  Settings,
  ShieldCheck,
  Tag,
  CheckCircle2,
  List,
  Edit2,
  Trash2,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import {
  Category,
  CustomField,
  FieldSet,
  Model,
  CategoryPermission,
  RequestReason,
} from '../types.ts';

export const CategoriesAndFieldsView: React.FC = () => {
  const { currentRole, showToast } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'categories' | 'custom_fields' | 'field_sets' | 'models' | 'reasons'>(
    'categories'
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [fieldSets, setFieldSets] = useState<FieldSet[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [reasons, setReasons] = useState<RequestReason[]>([]);
  const [loading, setLoading] = useState(true);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catType, setCatType] = useState<'asset' | 'consumable'>('asset');
  const [catDesc, setCatDesc] = useState('');

  // Custom Field Modal State
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const [fieldCategoryId, setFieldCategoryId] = useState<number | ''>('');
  const [fieldName, setFieldName] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'dropdown' | 'radio' | 'date' | 'boolean'>('text');
  const [fieldOptions, setFieldOptions] = useState('');
  const [fieldRequired, setFieldRequired] = useState(false);

  // Field Set Modal State
  const [isFieldSetModalOpen, setIsFieldSetModalOpen] = useState(false);
  const [editingFieldSetId, setEditingFieldSetId] = useState<number | null>(null);
  const [setName, setSetName] = useState('');
  const [setCategoryId, setSetCategoryId] = useState<number | ''>('');
  const [setDesc, setSetDesc] = useState('');
  const [selectedFieldIds, setSelectedFieldIds] = useState<number[]>([]);
  const [fieldFilterCategory, setFieldFilterCategory] = useState<string>('all');

  // Model Modal State
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [editingModelId, setEditingModelId] = useState<number | null>(null);
  const [modelName, setModelName] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [modelMinThreshold, setModelMinThreshold] = useState<string>('5');
  const [modelCategoryId, setModelCategoryId] = useState<number | ''>('');
  const [modelFieldSetId, setModelFieldSetId] = useState<number | ''>('');

  // Request Reason Modal State
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [editingReasonId, setEditingReasonId] = useState<number | null>(null);
  const [reasonTitle, setReasonTitle] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [reasonDesc, setReasonDesc] = useState('');

  // Delete Confirmation Modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: async () => {},
  });

  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cats, fields, sets, mods, rsnList] = await Promise.all([
        fetchApi<Category[]>('/api/categories'),
        fetchApi<CustomField[]>('/api/custom-fields'),
        fetchApi<FieldSet[]>('/api/field-sets'),
        fetchApi<Model[]>('/api/models'),
        fetchApi<RequestReason[]>('/api/reasons'),
      ]);

      setCategories(cats || []);
      setCustomFields(fields || []);
      setFieldSets(sets || []);
      setModels(mods || []);
      setReasons(rsnList || []);
    } catch (err) {
      console.error('Failed to load categories/fields metadata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 1. Category Handlers
  const handleOpenCreateCategory = () => {
    setEditingCategoryId(null);
    setCatName('');
    setCatCode('');
    setCatType('asset');
    setCatDesc('');
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setCatName(cat.name);
    setCatCode(cat.code);
    setCatType(cat.type);
    setCatDesc(cat.description || '');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName || !catCode) return;

    try {
      setSubmitting(true);
      if (editingCategoryId) {
        await fetchApi(`/api/categories/${editingCategoryId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: catName,
            code: catCode.toUpperCase(),
            type: catType,
            description: catDesc,
          }),
        });
        showToast(`Category "${catName}" updated successfully!`, 'success');
      } else {
        await fetchApi('/api/categories', {
          method: 'POST',
          body: JSON.stringify({
            name: catName,
            code: catCode.toUpperCase(),
            type: catType,
            description: catDesc,
          }),
        });
        showToast(`Category "${catName}" created successfully!`, 'success');
      }

      setIsCategoryModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save category', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = (cat: Category) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Category',
      description: `Are you sure you want to delete category "${cat.name}" (${cat.code})? Associated items and fields will be affected.`,
      onConfirm: async () => {
        try {
          await fetchApi(`/api/categories/${cat.id}`, { method: 'DELETE' });
          showToast(`Category "${cat.name}" deleted`, 'success');
          setDeleteModal((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err: any) {
          showToast(err.message || 'Failed to delete category', 'error');
        }
      },
    });
  };

  // 2. Custom Field Handlers
  const handleOpenCreateCustomField = () => {
    setEditingFieldId(null);
    setFieldCategoryId(categories[0]?.id || '');
    setFieldName('');
    setFieldLabel('');
    setFieldType('text');
    setFieldOptions('');
    setFieldRequired(false);
    setIsFieldModalOpen(true);
  };

  const handleOpenEditCustomField = (f: CustomField) => {
    setEditingFieldId(f.id);
    setFieldCategoryId(f.categoryId);
    setFieldName(f.name);
    setFieldLabel(f.label);
    setFieldType(f.fieldType as any);
    setFieldOptions(f.options ? f.options.join(', ') : '');
    setFieldRequired(f.isRequired || false);
    setIsFieldModalOpen(true);
  };

  const handleSaveCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldCategoryId || !fieldName || !fieldLabel) return;

    try {
      setSubmitting(true);
      const optionsArray =
        fieldType === 'dropdown' || fieldType === 'radio'
          ? fieldOptions.split(',').map((s) => s.trim()).filter(Boolean)
          : null;

      if (editingFieldId) {
        await fetchApi(`/api/custom-fields/${editingFieldId}`, {
          method: 'PUT',
          body: JSON.stringify({
            categoryId: Number(fieldCategoryId),
            name: fieldName.toLowerCase().replace(/\s+/g, '_'),
            label: fieldLabel,
            fieldType,
            options: optionsArray,
            isRequired: fieldRequired,
          }),
        });
        showToast(`Custom Field "${fieldLabel}" updated!`, 'success');
      } else {
        await fetchApi('/api/custom-fields', {
          method: 'POST',
          body: JSON.stringify({
            categoryId: Number(fieldCategoryId),
            name: fieldName.toLowerCase().replace(/\s+/g, '_'),
            label: fieldLabel,
            fieldType,
            options: optionsArray,
            isRequired: fieldRequired,
          }),
        });
        showToast(`Custom Field "${fieldLabel}" defined!`, 'success');
      }

      setIsFieldModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save custom field', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomField = (f: CustomField) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Custom Field',
      description: `Delete custom field "${f.label}"? It will be unlinked from all dynamic field sets.`,
      onConfirm: async () => {
        try {
          await fetchApi(`/api/custom-fields/${f.id}`, { method: 'DELETE' });
          showToast(`Custom field "${f.label}" removed`, 'success');
          setDeleteModal((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err: any) {
          showToast(err.message || 'Failed to delete custom field', 'error');
        }
      },
    });
  };

  // 3. Field Set Handlers
  const handleOpenFieldSetModal = (fs?: FieldSet) => {
    if (fs) {
      setEditingFieldSetId(fs.id);
      setSetName(fs.name);
      setSetCategoryId(fs.categoryId);
      setSetDesc(fs.description || '');
      const initialFieldIds = fs.fields ? fs.fields.map((f) => f.id) : [];
      setSelectedFieldIds(initialFieldIds);
    } else {
      setEditingFieldSetId(null);
      setSetName('');
      setSetCategoryId(categories[0]?.id || '');
      setSetDesc('');
      setSelectedFieldIds([]);
    }
    setFieldFilterCategory('all');
    setIsFieldSetModalOpen(true);
  };

  const handleSaveFieldSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setName || !setCategoryId) return;

    try {
      setSubmitting(true);
      const payload = {
        categoryId: Number(setCategoryId),
        name: setName,
        description: setDesc,
        customFieldIds: selectedFieldIds,
        fieldIds: selectedFieldIds,
      };

      if (editingFieldSetId) {
        await fetchApi(`/api/field-sets/${editingFieldSetId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast(`Field Set "${setName}" updated with ${selectedFieldIds.length} dynamic fields!`, 'success');
      } else {
        await fetchApi('/api/field-sets', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(`Field Set "${setName}" created with ${selectedFieldIds.length} dynamic fields!`, 'success');
      }

      setIsFieldSetModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save field set', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFieldSet = (fs: FieldSet) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Field Set',
      description: `Delete Field Set "${fs.name}"? Models using this specification template will be unlinked.`,
      onConfirm: async () => {
        try {
          await fetchApi(`/api/field-sets/${fs.id}`, { method: 'DELETE' });
          showToast(`Field Set "${fs.name}" deleted`, 'success');
          setDeleteModal((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err: any) {
          showToast(err.message || 'Failed to delete field set', 'error');
        }
      },
    });
  };

  // 4. Model Handlers (no manufacturer)
  const handleOpenCreateModel = () => {
    setEditingModelId(null);
    setModelCategoryId(categories[0]?.id || '');
    setModelFieldSetId('');
    setModelName('');
    setModelNumber('');
    setModelMinThreshold('5');
    setIsModelModalOpen(true);
  };

  const handleOpenEditModel = (m: Model) => {
    setEditingModelId(m.id);
    setModelCategoryId(m.categoryId);
    setModelFieldSetId(m.fieldSetId || '');
    setModelName(m.name);
    setModelNumber(m.modelNumber);
    setModelMinThreshold(m.minThreshold !== undefined && m.minThreshold !== null ? m.minThreshold.toString() : '5');
    setIsModelModalOpen(true);
  };

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName || !modelNumber || !modelCategoryId) return;

    try {
      setSubmitting(true);
      if (editingModelId) {
        await fetchApi(`/api/models/${editingModelId}`, {
          method: 'PUT',
          body: JSON.stringify({
            categoryId: Number(modelCategoryId),
            fieldSetId: modelFieldSetId ? Number(modelFieldSetId) : null,
            name: modelName,
            modelNumber,
            minThreshold: parseFloat(modelMinThreshold) || 5,
          }),
        });
        showToast(`Model "${modelName}" updated!`, 'success');
      } else {
        await fetchApi('/api/models', {
          method: 'POST',
          body: JSON.stringify({
            categoryId: Number(modelCategoryId),
            fieldSetId: modelFieldSetId ? Number(modelFieldSetId) : null,
            name: modelName,
            modelNumber,
            minThreshold: parseFloat(modelMinThreshold) || 5,
          }),
        });
        showToast(`Model "${modelName}" registered!`, 'success');
      }

      setIsModelModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save model', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteModel = (m: Model) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Model',
      description: `Delete Model "${m.name}" (${m.modelNumber})?`,
      onConfirm: async () => {
        try {
          await fetchApi(`/api/models/${m.id}`, { method: 'DELETE' });
          showToast(`Model "${m.name}" deleted`, 'success');
          setDeleteModal((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err: any) {
          showToast(err.message || 'Failed to delete model', 'error');
        }
      },
    });
  };

  // 5. Request Reason Handlers
  const handleOpenCreateReason = () => {
    setEditingReasonId(null);
    setReasonTitle('');
    setReasonCode('');
    setReasonDesc('');
    setIsReasonModalOpen(true);
  };

  const handleOpenEditReason = (r: RequestReason) => {
    setEditingReasonId(r.id);
    setReasonTitle(r.reason);
    setReasonCode(r.categoryType || 'all');
    setReasonDesc('');
    setIsReasonModalOpen(true);
  };

  const handleSaveReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonTitle) return;

    try {
      setSubmitting(true);
      if (editingReasonId) {
        await fetchApi(`/api/reasons/${editingReasonId}`, {
          method: 'PUT',
          body: JSON.stringify({
            reason: reasonTitle,
            categoryType: reasonCode.toLowerCase() === 'asset' || reasonCode.toLowerCase() === 'consumable' ? reasonCode.toLowerCase() : 'all',
            isActive: true,
          }),
        });
        showToast(`Request reason "${reasonTitle}" updated!`, 'success');
      } else {
        await fetchApi('/api/reasons', {
          method: 'POST',
          body: JSON.stringify({
            reason: reasonTitle,
            categoryType: reasonCode.toLowerCase() === 'asset' || reasonCode.toLowerCase() === 'consumable' ? reasonCode.toLowerCase() : 'all',
            isActive: true,
          }),
        });
        showToast(`Request reason "${reasonTitle}" added!`, 'success');
      }
      setIsReasonModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save request reason', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReason = (r: RequestReason) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Request Reason',
      description: `Delete requisition reason "${r.reason}"?`,
      onConfirm: async () => {
        try {
          await fetchApi(`/api/reasons/${r.id}`, { method: 'DELETE' });
          showToast(`Request reason "${r.reason}" deleted`, 'success');
          setDeleteModal((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err: any) {
          showToast(err.message || 'Failed to delete request reason', 'error');
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-extrabold text-slate-900">Categories, Dynamic Fields & Templates</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Full record management for master categories, dynamic custom fields, field sets, models, and requisition reasons.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('categories')}
            className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${
              activeSubTab === 'categories' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Categories ({categories.length})
          </button>
          <button
            onClick={() => setActiveSubTab('custom_fields')}
            className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${
              activeSubTab === 'custom_fields' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Custom Fields ({customFields.length})
          </button>
          <button
            onClick={() => setActiveSubTab('field_sets')}
            className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${
              activeSubTab === 'field_sets' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Field Sets ({fieldSets.length})
          </button>
          <button
            onClick={() => setActiveSubTab('models')}
            className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${
              activeSubTab === 'models' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            4. Models ({models.length})
          </button>
          <button
            onClick={() => setActiveSubTab('reasons')}
            className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${
              activeSubTab === 'reasons' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            5. Requisition Reasons ({reasons.length})
          </button>
        </div>
      </div>

      {/* TAB 1: Categories View */}
      {activeSubTab === 'categories' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Asset & Consumable Categories</h3>
              <p className="text-xs text-slate-500">Master classification codes for the entire organization</p>
            </div>
            {(currentRole === 'admin' || currentRole === 'super_manager') && (
              <button
                onClick={handleOpenCreateCategory}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div key={cat.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2 text-xs relative group hover:border-blue-300 transition">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {cat.code}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        cat.type === 'asset'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {cat.type}
                    </span>
                    {(currentRole === 'admin' || currentRole === 'super_manager') && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => handleOpenEditCategory(cat)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit Category"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">{cat.name}</h4>
                <p className="text-slate-500 text-[11px]">{cat.description || 'General organizational inventory'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Custom Fields View */}
      {activeSubTab === 'custom_fields' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Custom Dynamic Fields</h3>
              <p className="text-xs text-slate-500">
                Create and manage attributes (textbox, numeric, dropdown, radio, date, boolean) under allotted categories
              </p>
            </div>
            {(currentRole === 'admin' || currentRole === 'super_manager') && (
              <button
                onClick={handleOpenCreateCustomField}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Custom Field</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {customFields.map((f) => {
              const cat = categories.find((c) => c.id === f.categoryId);
              return (
                <div key={f.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2 text-xs relative group hover:border-indigo-300 transition">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">{cat?.name || 'Category'}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800">
                        {f.fieldType}
                      </span>
                      {(currentRole === 'admin' || currentRole === 'super_manager') && (
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => handleOpenEditCustomField(f)}
                            className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 transition"
                            title="Edit Custom Field"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomField(f)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"
                            title="Delete Custom Field"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{f.label}</h4>
                  <p className="font-mono text-slate-500 text-[11px]">Key: {f.name}</p>
                  {f.isRequired && (
                    <span className="inline-block text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      Required
                    </span>
                  )}
                  {f.options && f.options.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {f.options.map((opt, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700">
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Field Sets View */}
      {activeSubTab === 'field_sets' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Field Sets (Grouped Custom Fields)</h3>
              <p className="text-xs text-slate-500">
                Bundle dynamic custom fields into reusable specification sets attached to Models
              </p>
            </div>
            {(currentRole === 'admin' || currentRole === 'super_manager') && (
              <button
                onClick={() => handleOpenFieldSetModal()}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Field Set</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fieldSets.map((fs) => {
              const cat = categories.find((c) => c.id === fs.categoryId);
              return (
                <div key={fs.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 text-xs flex flex-col justify-between hover:border-indigo-300 transition">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-500">{cat?.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                          {fs.fields?.length || 0} Dynamic Fields
                        </span>
                        {(currentRole === 'admin' || currentRole === 'super_manager') && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenFieldSetModal(fs)}
                              className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-100 transition"
                              title="Edit Field Set"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFieldSet(fs)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-slate-100 transition"
                              title="Delete Field Set"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{fs.name}</h4>
                      <p className="text-slate-500 text-[11px]">{fs.description || 'Specification template for models'}</p>
                    </div>
                    {fs.fields && fs.fields.length > 0 ? (
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 max-h-48 overflow-y-auto">
                        {fs.fields.map((fld) => (
                          <div key={fld.id} className="flex items-center justify-between text-[11px]">
                            <span className="font-medium text-slate-800">• {fld.label}</span>
                            <div className="flex items-center gap-1">
                              {fld.isRequired && (
                                <span className="text-[9px] text-amber-700 bg-amber-50 px-1 rounded">req</span>
                              )}
                              <span className="text-slate-400 font-mono text-[10px]">{fld.fieldType}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white/60 p-3 rounded-lg border border-dashed border-slate-300 text-slate-400 text-center text-[11px]">
                        No dynamic fields currently linked. Click edit to attach fields.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: Models View */}
      {activeSubTab === 'models' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Equipment & Item Models</h3>
              <p className="text-xs text-slate-500">
                Models link to a category and dynamic Field Set for consistent stock data capture
              </p>
            </div>
            {(currentRole === 'admin' || currentRole === 'super_manager') && (
              <button
                onClick={handleOpenCreateModel}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Model</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {models.map((m) => (
              <div key={m.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5 text-xs relative group hover:border-blue-300 transition">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                    {m.modelNumber}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-blue-700 font-semibold">{m.category?.name}</span>
                    {(currentRole === 'admin' || currentRole === 'super_manager') && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => handleOpenEditModel(m)}
                          className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition cursor-pointer"
                          title="Edit Model"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteModel(m)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition cursor-pointer"
                          title="Delete Model"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">{m.name}</h4>

                {/* Stock & Threshold metrics for this Model */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-medium">Low Stock Alert:</span>{' '}
                    <span className="font-bold font-mono text-slate-800">≤ {m.minThreshold ?? 5} units</span>
                  </div>
                  {m.availableStockQuantity !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        m.isLowStock
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {m.isLowStock ? 'Low Stock' : 'In Stock'}: {m.availableStockQuantity} avail
                    </span>
                  )}
                </div>

                {m.fieldSet ? (
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-semibold">
                      <Layers className="w-3 h-3" />
                      Field Set: {m.fieldSet.name} ({m.fieldSet.fields?.length || 0} fields)
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-[10px] text-slate-400 italic">No Field Set linked</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Requisition Reasons */}
      {activeSubTab === 'reasons' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pre-Fed Request Reasons</h3>
              <p className="text-xs text-slate-500">
                Standardized options displayed at self-service kiosks and requisition punch forms
              </p>
            </div>
            {(currentRole === 'admin' || currentRole === 'super_manager') && (
              <button
                onClick={handleOpenCreateReason}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Request Reason</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reasons.map((r) => (
              <div key={r.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2 text-xs relative group hover:border-amber-300 transition">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase text-[10px]">
                    {r.categoryType || 'ALL ITEMS'}
                  </span>
                  {(currentRole === 'admin' || currentRole === 'super_manager') && (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleOpenEditReason(r)}
                        className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition cursor-pointer"
                        title="Edit Reason"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteReason(r)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition cursor-pointer"
                        title="Delete Reason"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <h4 className="font-bold text-slate-900 text-sm">{r.reason}</h4>
                <p className="text-slate-500 text-[11px]">
                  Applicable for: {r.categoryType === 'asset' ? 'Capital Assets' : r.categoryType === 'consumable' ? 'Consumable Stock' : 'All Materials'}
                </p>
              </div>
            ))}
            {reasons.length === 0 && !loading && (
              <div className="col-span-3 text-center py-8 text-slate-400">
                No custom request reasons configured.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Category Creator/Editor */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingCategoryId ? 'Edit Category' : 'Add Inventory Category'}
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CNC Machinery, Heavy Tooling, or Coolants"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Code Prefix <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="CNC"
                    value={catCode}
                    onChange={(e) => setCatCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Type</label>
                  <select
                    value={catType}
                    onChange={(e) => setCatType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="asset">Capital Asset</option>
                    <option value="consumable">Consumable Stock</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Operational scope for this category..."
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {editingCategoryId ? 'Update Category' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Custom Field Creator/Editor */}
      {isFieldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingFieldId ? 'Edit Custom Field' : 'Create Dynamic Custom Field'}
              </h3>
              <button
                onClick={() => setIsFieldModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomField} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Category</label>
                <select
                  value={fieldCategoryId}
                  onChange={(e) => setFieldCategoryId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Field Label (UI Display)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Spindle Speed (RPM) or Viscosity Rating"
                  value={fieldLabel}
                  onChange={(e) => {
                    setFieldLabel(e.target.value);
                    if (!editingFieldId && !fieldName) {
                      setFieldName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Field Key (JSON)</label>
                  <input
                    type="text"
                    required
                    placeholder="spindle_speed_rpm"
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Field Type</label>
                  <select
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white font-semibold"
                  >
                    <option value="text">Textbox (String)</option>
                    <option value="number">Numeric Field</option>
                    <option value="dropdown">Dropdown Selection</option>
                    <option value="radio">Radio Buttons</option>
                    <option value="date">Date Picker</option>
                    <option value="boolean">Checkbox (Yes/No)</option>
                  </select>
                </div>
              </div>

              {(fieldType === 'dropdown' || fieldType === 'radio') && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Options (Comma Separated) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Option A, Option B, Option C"
                    value={fieldOptions}
                    onChange={(e) => setFieldOptions(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fieldRequired}
                  onChange={(e) => setFieldRequired(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span className="font-semibold text-slate-700">Mandatory / Required Field</span>
              </label>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFieldModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {editingFieldId ? 'Update Custom Field' : 'Save Custom Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Field Set Designer */}
      {isFieldSetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingFieldSetId ? 'Edit Specification Field Set' : 'Create Specification Field Set'}
                </h3>
                <p className="text-xs text-slate-500">Group dynamic fields into a reusable technical specification set</p>
              </div>
              <button
                onClick={() => setIsFieldSetModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFieldSet} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Field Set Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5-Axis CNC Mill Technical Specs"
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Category</label>
                <select
                  value={setCategoryId}
                  onChange={(e) => setSetCategoryId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Mandatory technical tolerance, voltage, and lubrication parameters"
                  value={setDesc}
                  onChange={(e) => setSetDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Select Dynamic Custom Fields</span>
                    <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded font-mono text-[10px]">
                      {selectedFieldIds.length} selected
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={fieldFilterCategory}
                      onChange={(e) => setFieldFilterCategory(e.target.value)}
                      className="text-[11px] px-2 py-0.5 border border-slate-300 rounded-lg bg-slate-50"
                    >
                      <option value="all">All Categories</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {customFields.length === 0 ? (
                  <div className="p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-center text-slate-500">
                    No custom fields found. Please create dynamic custom fields first in tab #2.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50 space-y-1.5">
                    {customFields
                      .filter((f) => (fieldFilterCategory === 'all' ? true : f.categoryId === Number(fieldFilterCategory)))
                      .map((f) => {
                        const isChecked = selectedFieldIds.includes(f.id);
                        const cat = categories.find((c) => c.id === f.categoryId);
                        return (
                          <label
                            key={f.id}
                            className={`flex items-center justify-between p-2 rounded-lg border transition cursor-pointer ${
                              isChecked
                                ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                                : 'bg-white border-slate-200 hover:bg-slate-100/70 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedFieldIds([...selectedFieldIds, f.id]);
                                  else setSelectedFieldIds(selectedFieldIds.filter((id) => id !== f.id));
                                }}
                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                              />
                              <div>
                                <div className="font-semibold text-slate-900">{f.label}</div>
                                <div className="text-[10px] text-slate-500 font-mono">key: {f.name}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {cat?.name || 'Cat'}
                              </span>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                                {f.fieldType}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFieldSetModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {editingFieldSetId ? 'Update Field Set' : 'Save Field Set'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Model Creator/Editor */}
      {isModelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingModelId ? 'Edit Model Template' : 'Create Model Template'}
              </h3>
              <button
                onClick={() => setIsModelModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModel} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Model Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DMU 50 3rd Generation"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Model Number / Code <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="DMU-50-GEN3"
                  value={modelNumber}
                  onChange={(e) => setModelNumber(e.target.value)}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
                <select
                  value={modelCategoryId}
                  required
                  onChange={(e) => setModelCategoryId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Low Stock Threshold <span className="text-slate-400 font-normal">(Alert trigger for this model)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="5"
                  value={modelMinThreshold}
                  onChange={(e) => setModelMinThreshold(e.target.value)}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Alerts will trigger when total available stock of this model drops to or below this quantity.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Link Field Set (Dynamic Custom Fields)</label>
                <select
                  value={modelFieldSetId}
                  onChange={(e) => setModelFieldSetId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white font-semibold text-indigo-900"
                >
                  <option value="">-- No Field Set Attached --</option>
                  {fieldSets.map((fs) => (
                    <option key={fs.id} value={fs.id}>
                      {fs.name} ({fs.fields?.length || 0} fields)
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModelModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {editingModelId ? 'Update Model' : 'Save Model'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Request Reason Creator/Editor */}
      {isReasonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingReasonId ? 'Edit Request Reason' : 'Add Request Reason'}
              </h3>
              <button
                onClick={() => setIsReasonModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReason} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason Text / Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Urgent Tool Wear / Breakage"
                  value={reasonTitle}
                  onChange={(e) => setReasonTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Applicable Item Type</label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">All Items (Assets & Consumables)</option>
                  <option value="asset">Assets Only (Machinery, Equipment)</option>
                  <option value="consumable">Consumables Only (Tools, Raw Materials, Fluids)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReasonModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {editingReasonId ? 'Update Reason' : 'Save Reason'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{deleteModal.title}</h3>
              <p className="text-xs text-slate-500 mt-1.5">{deleteModal.description}</p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteModal.onConfirm}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-md cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
