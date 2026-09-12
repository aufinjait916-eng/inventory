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
  const [recordDate, setRecordDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');

  // Initial Storage Destination
  const [selectedBranchId, setSelectedBranchId] = useState<number>(currentBranchId);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | ''>('');
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('');

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

  // When model changes, fetch / extract custom fields defined in that model's field set & prefill model image
  useEffect(() => {
    if (!modelId) {
      setActiveFieldSet(null);
      setCustomFieldsData({});
      return;
    }

    const selectedModel = models.find((m) => m.id === modelId);
    if (selectedModel) {
      // Auto-prefill image from model if available
      if (selectedModel.imageUrl) {
        setImageUrl(selectedModel.imageUrl);
      }

      if (selectedModel.fieldSet) {
        setActiveFieldSet(selectedModel.fieldSet);
        // Initialize values from model's saved customFieldsData or field defaults
        const initialData: Record<string, any> = {};
        const modelSavedData = selectedModel.customFieldsData || {};
        if (selectedModel.fieldSet.fields) {
          selectedModel.fieldSet.fields.forEach((f) => {
            initialData[f.name] = modelSavedData[f.name] !== undefined ? modelSavedData[f.name] : (f.defaultValue || '');
          });
        }
        setCustomFieldsData(initialData);
      } else {
        setActiveFieldSet(null);
        setCustomFieldsData({});
      }
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
          recordDate,
          notes,
          branchId: selectedBranchId,
          departmentId: selectedDepartmentId ? Number(selectedDepartmentId) : null,
          locationId: selectedLocationId ? Number(selectedLocationId) : null,
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
              <p className="text-xs text-slate-700 font-medium">Record asset machinery or consumable stock with custom fields</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-600 hover:text-slate-950 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Item Type Switcher */}
          <div className="flex items-center gap-4 p-3 bg-slate-100 rounded-xl border border-slate-300">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Classification:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-select-type-asset"
                tabIndex={1}
                title="Select Capital Asset tracking (machinery, tools, equipment with individual serial numbers)"
                onClick={() => {
                  setItemType('asset');
                  setQuantity('1');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  itemType === 'asset'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                    : 'bg-white text-slate-800 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                <Boxes className="w-4 h-4" />
                <span>Capital Asset (Machinery / Tools)</span>
              </button>
              <button
                type="button"
                id="btn-select-type-consumable"
                tabIndex={2}
                title="Select Consumable Stock tracking (lubricants, fasteners, PPE in bulk batches)"
                onClick={() => {
                  setItemType('consumable');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  itemType === 'consumable'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                    : 'bg-white text-slate-800 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Consumable Stock (Oils / PPE / Fasteners)</span>
              </button>
            </div>
          </div>

          {/* Section 1: Core Fields */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-600" />
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
                  tabIndex={3}
                  title="Official equipment title or material item name"
                  placeholder="e.g. DMG Mori 5-Axis CNC Mill or Mobil Vactra Oil No.2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] focus:outline-none bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Unique Code / SKU / Tag <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    tabIndex={4}
                    title="Automatically generate standard SKU/Tag sequence code"
                    onClick={handleGenerateCode}
                    className="text-[11px] text-[#FF8C00] hover:text-[#FF4500] hover:underline font-semibold cursor-pointer"
                  >
                    Auto-Generate Code
                  </button>
                </div>
                <input
                  type="text"
                  required
                  tabIndex={5}
                  title="Unique asset barcode, tag identifier, or inventory SKU"
                  placeholder="e.g. AST-CNC-501 or CON-LUB-009"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] focus:outline-none bg-white uppercase"
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
                  tabIndex={6}
                  title="Select asset or item category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] focus:outline-none bg-white"
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
                  tabIndex={7}
                  title="Link item with a catalog model to inherit picture and specifications"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] focus:outline-none bg-white"
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
                  tabIndex={8}
                  title="Source supplier or vendor for this item"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] focus:outline-none bg-white"
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

            {/* Model Reference Picture Display */}
            {(() => {
              const selectedModel = models.find((m) => m.id === modelId);
              const previewImg = selectedModel?.imageUrl || imageUrl;

              return (
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                      <span>Model Reference Picture</span>
                    </span>
                    {selectedModel?.imageUrl && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Inherited from Model Template
                      </span>
                    )}
                  </label>

                  {previewImg ? (
                    <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-300 bg-white flex items-center justify-center shrink-0 shadow-xs">
                        <img
                          src={previewImg}
                          alt="Model preview"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={() => {
                            showToast('Model template image preview could not be loaded.', 'info');
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          Model Picture Displayed
                        </p>
                        <p className="text-[11px] text-slate-800 font-bold truncate max-w-sm">
                          {selectedModel?.name || 'Selected Model Template'}
                        </p>
                        <p className="text-[10px] text-slate-600 font-medium">
                          This inventory item automatically inherits the photograph and specifications configured on the model template.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex items-center gap-3 text-slate-600 text-xs font-medium">
                      <ImageIcon className="w-5 h-5 text-slate-500 shrink-0" />
                      <span>
                        {modelId
                          ? 'The selected model does not have a picture configured in the model catalog.'
                          : 'Select a model above to automatically display its template photograph and specifications.'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Section 2: Units of Measurement & Quantity */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>Unit of Measurement (UOM) & Stock Level</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  UOM <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  tabIndex={9}
                  title="Unit of measurement (e.g. EA, Units, Litres, Meters)"
                  value={uom}
                  onChange={(e) => setUom(e.target.value as UOMType)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-white"
                >
                  {UOM_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Initial Quantity <span className="text-red-500">*</span>
                </label>
                {itemType === 'asset' ? (
                  <div>
                    <input
                      type="number"
                      readOnly
                      value="1"
                      title="Quantity locked to 1 for unique capital asset tracking"
                      className="w-full px-3 py-2 text-xs font-bold font-mono border border-slate-300 rounded-lg bg-slate-100 text-slate-800 cursor-not-allowed"
                    />
                    <p className="text-[10px] text-amber-800 font-semibold mt-1">
                      Individual asset tracking (Qty is locked to 1)
                    </p>
                  </div>
                ) : (
                  <div>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      tabIndex={10}
                      title="Initial stock batch quantity on hand"
                      placeholder="e.g. 50"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-white"
                    />
                    <p className="text-[10px] text-slate-600 font-medium mt-1">
                      Multiple quantity batch allowed for consumables
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Record Date</label>
                <input
                  type="date"
                  tabIndex={11}
                  title="Date of inventory entry or procurement"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-white font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Dynamic Custom Fields from Field Set */}
          {activeFieldSet && activeFieldSet.fields && activeFieldSet.fields.length > 0 && (
            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-300 space-y-3">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Model Specifications: {activeFieldSet.name}</span>
                  </h4>
                  <p className="text-[11px] text-amber-900 font-medium">Prefilled and locked specification values inherited from Model template</p>
                </div>
                <span className="text-[10px] bg-amber-200 text-amber-950 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-300">
                  🔒 Read-Only Specification
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {activeFieldSet.fields.map((field: CustomField) => (
                  <div key={field.id} className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      {field.label} {field.isRequired && <span className="text-red-500">*</span>}
                    </label>

                    {/* Read-only representation prefilled from Model */}
                    {field.fieldType === 'boolean' ? (
                      <div className="flex items-center gap-2 pt-1.5">
                        <input
                          type="checkbox"
                          disabled
                          checked={!!customFieldsData[field.name]}
                          className="w-4 h-4 text-blue-600 rounded bg-slate-100 border-slate-300 cursor-not-allowed"
                        />
                        <span className="text-xs text-slate-800 font-semibold">
                          {customFieldsData[field.name] ? 'Yes / Enabled' : 'No / Disabled'}
                        </span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        readOnly
                        value={customFieldsData[field.name] !== undefined && customFieldsData[field.name] !== null ? String(customFieldsData[field.name]) : ''}
                        placeholder="Not specified in model"
                        className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-slate-100 text-slate-900 cursor-not-allowed"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Initial Storage Location */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-slate-600" />
              <span>Initial Physical Storage Location</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Branch</label>
                <select
                  tabIndex={12}
                  title="Select storage branch campus"
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Department (Location)</label>
                <select
                  tabIndex={13}
                  title="Select operational department within branch"
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-white"
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
                <label className="block text-xs font-bold text-slate-800 mb-1">Storage Sublocation / Rack</label>
                <select
                  tabIndex={14}
                  title="Specific shelf, bay, room, or rack sublocation"
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-white"
                >
                  <option value="">-- Direct Department Area --</option>
                  {locations.map((loc) => {
                    const parent = loc.parentLocationId ? locations.find((l) => l.id === loc.parentLocationId) : null;
                    const displayName = parent ? `${parent.name}/${loc.name}` : loc.name;
                    return (
                      <option key={loc.id} value={loc.id}>
                        {displayName} ({loc.type})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 font-medium italic">
              Note: Machine allocation can be recorded via the Record Stock Transfer & Allocation form.
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Additional Operational Notes</label>
            <textarea
              rows={2}
              tabIndex={15}
              title="Enter any procurement, handling, or maintenance notes"
              placeholder="e.g. Initial procurement invoice details, handling precautions, or safety protocol..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-white"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              tabIndex={16}
              title="Close form without saving changes"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-950 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              tabIndex={17}
              disabled={submitting}
              id="btn-submit-stock-item"
              title="Save item to database registry and log stock transaction"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition shadow-2xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {submitting ? 'Recording Item...' : 'Save & Log Stock Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
