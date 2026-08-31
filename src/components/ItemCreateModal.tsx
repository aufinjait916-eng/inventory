import React, { useState, useEffect } from 'react';
import {
  X,
  Boxes,
  Package,
  Layers,
  Calendar,
  DollarSign,
  Tag,
  Building,
  Wrench,
  AlertCircle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Upload,
  Trash2,
  Link as LinkIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import {
  Category,
  Model,
  Vendor,
  Department,
  LocationItem,
  Machine,
  UOM_OPTIONS,
  UOMType,
  CustomField,
  FieldSet,
} from '../types.ts';

interface ItemCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: 'asset' | 'consumable';
}

export const ItemCreateModal: React.FC<ItemCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultType = 'asset',
}) => {
  const { currentBranchId, branches, showToast } = useApp();

  const [itemType, setItemType] = useState<'asset' | 'consumable'>(defaultType);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [modelId, setModelId] = useState<number | ''>('');
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [uom, setUom] = useState<UOMType>('unit');
  const [quantity, setQuantity] = useState<string>('1');
  const [minThreshold, setMinThreshold] = useState<string>('5');
  const [recordDate, setRecordDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);

  // Initial Storage Destination
  const [selectedBranchId, setSelectedBranchId] = useState<number>(currentBranchId);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | ''>('');
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('');
  const [selectedMachineId, setSelectedMachineId] = useState<number | ''>('');

  // Dynamic Custom Fields from Model's linked Field Set
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>({});

  // Loaded metadata
  const [categories, setCategories] = useState<Category[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [activeFieldSet, setActiveFieldSet] = useState<FieldSet | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function loadMeta() {
      try {
        const [cats, mods, vends, depts, locs, mchs] = await Promise.all([
          fetchApi<Category[]>(`/api/categories?type=${itemType}`),
          fetchApi<Model[]>(`/api/models`),
          fetchApi<Vendor[]>('/api/vendors'),
          fetchApi<Department[]>(`/api/departments?branchId=${selectedBranchId}`),
          fetchApi<LocationItem[]>(`/api/locations?branchId=${selectedBranchId}`),
          fetchApi<Machine[]>(`/api/machines?branchId=${selectedBranchId}`),
        ]);

        setCategories(cats || []);
        setModels(mods || []);
        setVendors(vends || []);
        setDepartments(depts || []);
        setLocations(locs || []);
        setMachines(mchs || []);

        if (cats && cats.length > 0 && !categoryId) {
          setCategoryId(cats[0].id);
        }
      } catch (err) {
        console.error('Failed to load item creation dependencies:', err);
      }
    }
    loadMeta();
  }, [isOpen, itemType, selectedBranchId]);

  // When model changes, fetch / extract custom fields defined in that model's field set
  useEffect(() => {
    if (!modelId) {
      setActiveFieldSet(null);
      setCustomFieldsData({});
      return;
    }

    const selectedModel = models.find((m) => m.id === modelId);
    if (selectedModel && selectedModel.fieldSet) {
      setActiveFieldSet(selectedModel.fieldSet);
      // Initialize default values
      const initialData: Record<string, any> = {};
      if (selectedModel.fieldSet.fields) {
        selectedModel.fieldSet.fields.forEach((f) => {
          initialData[f.name] = f.defaultValue || '';
        });
      }
      setCustomFieldsData(initialData);
    } else {
      setActiveFieldSet(null);
      setCustomFieldsData({});
    }
  }, [modelId, models]);

  // Filter models for selected category
  const filteredModels = models.filter((m) => (categoryId ? m.categoryId === categoryId : true));

  // Generate suggested Code on name/type change if empty
  const handleGenerateCode = () => {
    const prefix = itemType === 'asset' ? 'AST' : 'CON';
    const rand = Math.floor(1000 + Math.random() * 9000);
    const catCode = categories.find((c) => c.id === categoryId)?.code || 'GEN';
    setCode(`${prefix}-${catCode}-${rand}`);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WEBP, GIF)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setImageUrl(compressed);
        } else {
          setImageUrl(rawDataUrl);
        }
      };
      img.onerror = () => {
        setImageUrl(rawDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleCustomFieldChange = (fieldName: string, value: any) => {
    setCustomFieldsData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !categoryId || !uom || !quantity) {
      showToast('Please fill in all required fields (Name, Code, Category, UOM, Quantity)', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await fetchApi('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({
          name,
          code,
          itemType,
          imageUrl: imageUrl.trim() || null,
          categoryId: Number(categoryId),
          modelId: modelId ? Number(modelId) : null,
          supplierId: supplierId ? Number(supplierId) : null,
          uom,
          quantity: parseFloat(quantity),
          minThreshold: parseFloat(minThreshold) || 5,
          recordDate,
          notes,
          branchId: selectedBranchId,
          departmentId: selectedDepartmentId ? Number(selectedDepartmentId) : null,
          locationId: selectedLocationId ? Number(selectedLocationId) : null,
          machineId: selectedMachineId ? Number(selectedMachineId) : null,
          customFieldsData,
        }),
      });

      showToast(`Successfully created and logged ${itemType} stock item "${name}"!`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to create item', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                itemType === 'asset' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {itemType === 'asset' ? <Boxes className="w-5 h-5" /> : <Package className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">New Inventory Stock Item</h2>
              <p className="text-xs text-slate-500">Record asset machinery or consumable stock with custom fields</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Item Type Switcher */}
          <div className="flex items-center gap-4 p-3 bg-slate-100 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Classification:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-select-type-asset"
                onClick={() => setItemType('asset')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                  itemType === 'asset'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-white text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Boxes className="w-4 h-4" />
                <span>Capital Asset (Machinery / Tools)</span>
              </button>
              <button
                type="button"
                id="btn-select-type-consumable"
                onClick={() => setItemType('consumable')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                  itemType === 'consumable'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-white text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Consumable Stock (Oils / PPE / Fasteners)</span>
              </button>
            </div>
          </div>

          {/* Section 1: Core Fields */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>Core Identification & Category</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Item Name / Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DMG Mori 5-Axis CNC Mill or Mobil Vactra Oil No.2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Unique Code / SKU / Tag <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    className="text-[11px] text-blue-600 hover:underline font-semibold"
                  >
                    Auto-Generate Code
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. AST-CNC-501 or CON-LUB-009"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Model (Linked with Field Set)
                </label>
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="">-- None / Generic Model --</option>
                  {filteredModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.modelNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supplier / Vendor</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="">-- Select Supplier --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Item Picture / Image Upload */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>Item Picture / Photo (Optional)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <LinkIcon className="w-3 h-3" />
                  <span>{showUrlInput ? 'Switch to File Upload' : 'Enter Web Image URL'}</span>
                </button>
              </label>

              {imageUrl ? (
                <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-300 bg-white flex items-center justify-center shrink-0">
                    <img
                      src={imageUrl}
                      alt="Item preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={() => {
                        showToast('Failed to load image preview. Please check URL or file.', 'error');
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Picture Attached
                    </p>
                    <p className="text-[11px] text-slate-500 truncate max-w-sm">
                      {imageUrl.startsWith('data:') ? 'Image uploaded from file' : imageUrl}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <label className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer">
                        Replace Picture
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="hidden"
                        />
                      </label>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove Picture
                      </button>
                    </div>
                  </div>
                </div>
              ) : showUrlInput ? (
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/asset-photo.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(false)}
                    className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition group">
                  <div className="flex items-center gap-2 text-slate-600 group-hover:text-blue-600">
                    <Upload className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold">Click to upload photo</span>
                    <span className="text-slate-400 text-xs font-normal">or drag and drop</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, WEBP, GIF up to 10MB</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Section 2: Units of Measurement & Quantity */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Unit of Measurement (UOM) & Stock Level</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  UOM <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={uom}
                  onChange={(e) => setUom(e.target.value as UOMType)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  {UOM_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Initial Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Low Stock Threshold
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={minThreshold}
                  onChange={(e) => setMinThreshold(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Record Date</label>
                <input
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Dynamic Custom Fields from Field Set */}
          {activeFieldSet && activeFieldSet.fields && activeFieldSet.fields.length > 0 && (
            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-200/80 space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                    Model Custom Fields: {activeFieldSet.name}
                  </h4>
                  <p className="text-[11px] text-indigo-700">Grouped specifications dynamically bound to this model</p>
                </div>
                <span className="text-[10px] bg-indigo-200 text-indigo-900 font-bold px-2 py-0.5 rounded-full">
                  {activeFieldSet.fields.length} Custom Fields
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {activeFieldSet.fields.map((field: CustomField) => (
                  <div key={field.id} className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      {field.label} {field.isRequired && <span className="text-red-500">*</span>}
                    </label>

                    {/* Render field according to fieldType: text, number, dropdown, radio, date, boolean */}
                    {field.fieldType === 'text' && (
                      <input
                        type="text"
                        required={field.isRequired}
                        value={customFieldsData[field.name] || ''}
                        onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                      />
                    )}

                    {field.fieldType === 'number' && (
                      <input
                        type="number"
                        step="any"
                        required={field.isRequired}
                        value={customFieldsData[field.name] || ''}
                        onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                      />
                    )}

                    {field.fieldType === 'dropdown' && (
                      <select
                        required={field.isRequired}
                        value={customFieldsData[field.name] || ''}
                        onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                      >
                        <option value="">-- Select {field.label} --</option>
                        {Array.isArray(field.options) &&
                          field.options.map((opt, i) => (
                            <option key={i} value={opt}>
                              {opt}
                            </option>
                          ))}
                      </select>
                    )}

                    {field.fieldType === 'radio' && (
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {Array.isArray(field.options) &&
                          field.options.map((opt, i) => (
                            <label key={i} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name={field.name}
                                value={opt}
                                checked={customFieldsData[field.name] === opt}
                                onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                      </div>
                    )}

                    {field.fieldType === 'date' && (
                      <input
                        type="date"
                        required={field.isRequired}
                        value={customFieldsData[field.name] || ''}
                        onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                      />
                    )}

                    {field.fieldType === 'boolean' && (
                      <label className="flex items-center gap-2 pt-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!customFieldsData[field.name]}
                          onChange={(e) => handleCustomFieldChange(field.name, e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <span className="text-xs text-slate-700 font-medium">Yes / Certified</span>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Initial Storage Location & Machine Allocation */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <span>Initial Physical Location & Allocation</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Branch</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department (Location)</label>
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="">-- General Branch Storage --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Storage Sublocation / Rack</label>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="">-- Direct Department Area --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assign to Machine (Optional)
                </label>
                <select
                  value={selectedMachineId}
                  onChange={(e) => setSelectedMachineId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="">-- Not Assigned to Machine --</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.machineCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Additional Operational Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Initial procurement invoice details, handling precautions, or safety protocol..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              id="btn-submit-stock-item"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition shadow-md shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? 'Recording Item...' : 'Save & Log Stock Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
