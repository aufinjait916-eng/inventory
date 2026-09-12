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
  InventoryItem,
  Category,
  Model,
  Vendor,
  Department,
  LocationItem,
  Machine,
  UOM_OPTIONS,
  UOMType,
  FieldSet,
} from '../types.ts';

interface ItemEditModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ItemEditModal: React.FC<ItemEditModalProps> = ({
  isOpen,
  item,
  onClose,
  onSuccess,
}) => {
  const { currentBranchId, branches, showToast } = useApp();

  const [itemType, setItemType] = useState<'asset' | 'consumable'>('asset');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [modelId, setModelId] = useState<number | ''>('');
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [uom, setUom] = useState<UOMType>('unit');
  const [totalQuantity, setTotalQuantity] = useState<string>('1');
  const [availableQuantity, setAvailableQuantity] = useState<string>('1');
  const [minThreshold, setMinThreshold] = useState<string>('5');
  const [status, setStatus] = useState<string>('in_stock');
  const [notes, setNotes] = useState('');

  // Dynamic Custom Fields
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>({});
  const [activeFieldSet, setActiveFieldSet] = useState<FieldSet | null>(null);

  // Metadata
  const [categories, setCategories] = useState<Category[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !item) return;

    setItemType(item.itemType);
    setName(item.name);
    setCode(item.code);
    setImageUrl(item.imageUrl || '');
    setCategoryId(item.categoryId);
    setModelId(item.modelId || '');
    setSupplierId(item.supplierId || '');
    setUom(item.uom);
    setTotalQuantity(item.totalQuantity.toString());
    setAvailableQuantity(item.availableQuantity.toString());
    setMinThreshold(item.minThreshold.toString());
    setStatus(item.status || 'in_stock');
    setNotes(item.notes || '');
    setCustomFieldsData(item.customFieldsData || {});

    async function loadMeta() {
      try {
        const [cats, mods, vends] = await Promise.all([
          fetchApi<Category[]>('/api/categories'),
          fetchApi<Model[]>('/api/models'),
          fetchApi<Vendor[]>('/api/vendors'),
        ]);

        setCategories(cats || []);
        setModels(mods || []);
        setVendors(vends || []);
      } catch (err) {
        console.error('Failed to load item edit metadata:', err);
      }
    }
    loadMeta();
  }, [isOpen, item]);

  useEffect(() => {
    if (!modelId) {
      setActiveFieldSet(null);
      return;
    }

    const selectedModel = models.find((m) => m.id === modelId);
    if (selectedModel && selectedModel.fieldSet) {
      setActiveFieldSet(selectedModel.fieldSet);
    } else {
      setActiveFieldSet(null);
    }
  }, [modelId, models]);

  if (!isOpen || !item) return null;

  const filteredModels = models.filter((m) => (categoryId ? m.categoryId === categoryId : true));

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

  const handleCustomFieldChange = (fName: string, val: any) => {
    setCustomFieldsData((prev) => ({
      ...prev,
      [fName]: val,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !categoryId) {
      showToast('Name, SKU code, and Category are required.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        itemType,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        imageUrl: imageUrl.trim() || null,
        categoryId: Number(categoryId),
        modelId: modelId ? Number(modelId) : null,
        supplierId: supplierId ? Number(supplierId) : null,
        uom,
        totalQuantity: Number(totalQuantity) || 0,
        availableQuantity: Number(availableQuantity) || 0,
        minThreshold: Number(minThreshold) || 0,
        status,
        notes: notes.trim(),
        customFieldsData,
      };

      await fetchApi(`/api/inventory/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      showToast(`Item "${name}" updated successfully!`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Update item failed:', err);
      showToast(err.message || 'Failed to update item', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl text-white ${
                itemType === 'asset' ? 'bg-blue-600' : 'bg-emerald-600'
              }`}
            >
              {itemType === 'asset' ? <Boxes className="w-5 h-5" /> : <Package className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Edit Inventory Record</h3>
              <p className="text-xs text-slate-500 font-mono">ID #{item.id} • SKU: {item.code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* Classification Selection */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Classification</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                tabIndex={1}
                title="Select Capital Asset tracking for equipment and machinery"
                onClick={() => setItemType('asset')}
                className={`p-3 rounded-xl border flex items-center gap-3 text-left transition cursor-pointer ${
                  itemType === 'asset'
                    ? 'border-[#FF8C00] bg-amber-50/70 ring-2 ring-[#FF8C00]/20 text-amber-950 font-bold'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Boxes className={`w-4 h-4 ${itemType === 'asset' ? 'text-[#FF8C00]' : 'text-slate-400'}`} />
                <div>
                  <div className="font-bold">Capital Asset</div>
                  <div className="text-[10px] text-slate-500">Tracked equipment, tools, machinery</div>
                </div>
              </button>

              <button
                type="button"
                tabIndex={2}
                title="Select Consumable Stock tracking for batch items and oils"
                onClick={() => setItemType('consumable')}
                className={`p-3 rounded-xl border flex items-center gap-3 text-left transition cursor-pointer ${
                  itemType === 'consumable'
                    ? 'border-[#FF8C00] bg-amber-50/70 ring-2 ring-[#FF8C00]/20 text-amber-950 font-bold'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Package className={`w-4 h-4 ${itemType === 'consumable' ? 'text-[#FF8C00]' : 'text-slate-400'}`} />
                <div>
                  <div className="font-bold">Consumable Stock</div>
                  <div className="text-[10px] text-slate-500">Expended items, lubricants, raw stock</div>
                </div>
              </button>
            </div>
          </div>

          {/* Core Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Item Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                tabIndex={3}
                title="Equipment or item name"
                placeholder="e.g. End Mill Carbide 10mm or Spindle Motor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                SKU / Tracking Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                tabIndex={4}
                title="Unique tracking barcode or SKU code"
                placeholder="e.g. AST-CNC-5021"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
              />
            </div>
          </div>

          {/* Category & Model */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={categoryId}
                required
                tabIndex={5}
                title="Select equipment category"
                onChange={(e) => {
                  setCategoryId(Number(e.target.value));
                  setModelId('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Equipment / Item Model</label>
              <select
                value={modelId}
                tabIndex={6}
                title="Linked catalog model template"
                onChange={(e) => setModelId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
              >
                <option value="">-- Generic / No Specific Model --</option>
                {filteredModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.modelNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Item Picture / Image Upload */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
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
              <div className="flex items-center gap-4">
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
              <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl cursor-pointer bg-white hover:bg-blue-50/30 transition group">
                <div className="flex items-center gap-2 text-slate-600 group-hover:text-blue-600">
                  <Upload className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold">Click to upload photo</span>
                  <span className="text-slate-400 text-xs font-normal">or drag and drop</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WEBP, GIF up to 10MB</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Supplier & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Supplier / Vendor</label>
              <select
                tabIndex={7}
                title="Select source supplier or vendor"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
              >
                <option value="">-- Direct Stock / Internal --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Status</label>
              <select
                tabIndex={8}
                title="Current operating or stock status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white font-semibold"
              >
                <option value="in_stock">In Stock / Available</option>
                <option value="in_use">In Use / Active</option>
                <option value="in_repair">In Repair (Vendor / Maintenance)</option>
                <option value="trashed">Trashed / Retired</option>
              </select>
            </div>
          </div>

          {/* Quantities & UOM */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Unit of Measure (UOM)</label>
              <select
                tabIndex={9}
                title="Unit of Measurement"
                value={uom}
                onChange={(e) => setUom(e.target.value as UOMType)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00]"
              >
                {UOM_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label} ({u.value})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Total Quantity {itemType === 'asset' && <span className="text-[10px] text-[#FF8C00] font-normal">(Asset = 1)</span>}
              </label>
              {itemType === 'asset' ? (
                <input
                  type="number"
                  readOnly
                  value="1"
                  title="Locked to 1 for capital equipment tracking"
                  className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg bg-slate-100 text-slate-700 cursor-not-allowed"
                />
              ) : (
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  tabIndex={10}
                  title="Total units in stock inventory"
                  value={totalQuantity}
                  onChange={(e) => setTotalQuantity(e.target.value)}
                  className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00]"
                />
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Available Quantity {itemType === 'asset' && <span className="text-[10px] text-[#FF8C00] font-normal">(Asset = 1)</span>}
              </label>
              {itemType === 'asset' ? (
                <input
                  type="number"
                  readOnly
                  value="1"
                  title="Locked to 1 for capital equipment tracking"
                  className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg bg-slate-100 text-slate-700 cursor-not-allowed"
                />
              ) : (
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  tabIndex={11}
                  title="Quantity immediately unallocated and available for use"
                  value={availableQuantity}
                  onChange={(e) => setAvailableQuantity(e.target.value)}
                  className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00]"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Internal Notes</label>
            <input
              type="text"
              tabIndex={12}
              title="Serial number, batch number, or condition comments"
              placeholder="Serial number, batch number, or condition..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00]"
            />
          </div>

          {/* Dynamic Custom Fields Rendering */}
          {activeFieldSet && activeFieldSet.fields && activeFieldSet.fields.length > 0 && (
            <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/70 space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#FF8C00]" />
                <h4 className="font-bold text-amber-950">
                  Model Specifications ({activeFieldSet.name})
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeFieldSet.fields.map((fld) => (
                  <div key={fld.id}>
                    <label className="block font-bold text-slate-700 mb-1">
                      {fld.label} {fld.isRequired && <span className="text-red-500">*</span>}
                    </label>

                    {fld.fieldType === 'text' && (
                      <input
                        type="text"
                        required={fld.isRequired}
                        title={`Specification field: ${fld.label}`}
                        value={customFieldsData[fld.name] || ''}
                        onChange={(e) => handleCustomFieldChange(fld.name, e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#FF8C00]"
                      />
                    )}

                    {fld.fieldType === 'number' && (
                      <input
                        type="number"
                        step="any"
                        required={fld.isRequired}
                        title={`Specification field: ${fld.label}`}
                        value={customFieldsData[fld.name] || ''}
                        onChange={(e) => handleCustomFieldChange(fld.name, e.target.value)}
                        className="w-full px-3 py-1.5 font-mono border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#FF8C00]"
                      />
                    )}

                    {fld.fieldType === 'dropdown' && (
                      <select
                        required={fld.isRequired}
                        title={`Select ${fld.label}`}
                        value={customFieldsData[fld.name] || ''}
                        onChange={(e) => handleCustomFieldChange(fld.name, e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#FF8C00]"
                      >
                        <option value="">-- Select {fld.label} --</option>
                        {fld.options?.map((opt, i) => (
                          <option key={i} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}

                    {fld.fieldType === 'date' && (
                      <input
                        type="date"
                        required={fld.isRequired}
                        title={`Date specification: ${fld.label}`}
                        value={customFieldsData[fld.name] || ''}
                        onChange={(e) => handleCustomFieldChange(fld.name, e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#FF8C00]"
                      />
                    )}

                    {fld.fieldType === 'boolean' && (
                      <label className="flex items-center gap-2 pt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(customFieldsData[fld.name])}
                          onChange={(e) => handleCustomFieldChange(fld.name, e.target.checked)}
                          className="w-4 h-4 text-[#FF8C00] rounded"
                        />
                        <span className="font-semibold text-slate-700">Verified / Checked</span>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              tabIndex={13}
              title="Close modal without saving changes"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              tabIndex={14}
              disabled={submitting}
              title="Save changes to stock registry"
              className="px-5 py-2 bg-gradient-to-r from-[#FF8C00] to-[#FF4500] hover:from-[#FF8C00] hover:to-[#e03e00] text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Update Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
