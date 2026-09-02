import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, Box, Wrench, AlertCircle, Layers } from 'lucide-react';
import { InventoryItem } from '../types.ts';

interface SearchableItemSelectProps {
  items: InventoryItem[];
  value: number | '' | undefined;
  onChange: (itemId: number | '') => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  filterType?: 'all' | 'asset' | 'consumable';
  showEngagementInfo?: boolean;
  id?: string;
}

export const SearchableItemSelect: React.FC<SearchableItemSelectProps> = ({
  items = [],
  value,
  onChange,
  placeholder = 'Type to search item by name, code or category...',
  label,
  required = false,
  disabled = false,
  filterType = 'all',
  showEngagementInfo = false,
  id = 'searchable-item-select',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'asset' | 'consumable'>(filterType);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep type filter in sync with prop if changed
  useEffect(() => {
    setActiveTypeFilter(filterType);
  }, [filterType]);

  const safeItems = Array.isArray(items) ? items : [];

  // Filter items by type
  const eligibleItems = safeItems.filter((item) => {
    if (!item) return false;
    if (activeTypeFilter === 'all') return true;
    return item.itemType === activeTypeFilter;
  });

  const selectedItem = safeItems.find((i) => i && i.id === value);

  // Filter items matching user search query
  const filteredItems = eligibleItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const nameMatch = item.name ? item.name.toLowerCase().includes(query) : false;
    const codeMatch = item.code ? item.code.toLowerCase().includes(query) : false;
    const catMatch = item.category?.name ? item.category.name.toLowerCase().includes(query) : false;
    const modelMatch = item.model?.name ? item.model.name.toLowerCase().includes(query) : false;
    return nameMatch || codeMatch || catMatch || modelMatch;
  });

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedItem) {
          setSearchQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedItem]);

  // Keep highlighted index in bounds
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, isOpen, activeTypeFilter]);

  const handleSelectItem = (item: InventoryItem) => {
    onChange(item.id);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[highlightedIndex]) {
        handleSelectItem(filteredItems[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <div className="relative w-full space-y-1" ref={containerRef} id={`${id}-wrapper`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-700">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          <span className="text-[11px] text-slate-400 font-medium">
            {safeItems.length} items available
          </span>
        </div>
      )}

      <div
        id={id}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={`relative flex items-center min-h-[42px] px-3 py-1.5 bg-white border rounded-xl transition cursor-pointer shadow-xs ${
          isOpen ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-300 hover:border-slate-400'
        } ${disabled ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''}`}
      >
        <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />

        {/* Text Input / Display */}
        <div className="flex-1 flex items-center flex-wrap gap-1 min-w-0">
          {selectedItem && !isOpen && (
            <div className="flex items-center gap-1.5 text-xs text-slate-900 font-bold truncate max-w-full">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  selectedItem.itemType === 'asset' ? 'bg-blue-500' : 'bg-emerald-500'
                }`}
              />
              <span className="font-mono text-slate-500 font-semibold shrink-0">[{selectedItem.code}]</span>
              <span className="truncate">{selectedItem.name}</span>
              <span className="text-[11px] font-normal text-slate-500 ml-1 shrink-0">
                ({selectedItem.availableQuantity} {selectedItem.uom})
              </span>
            </div>
          )}

          <input
            ref={inputRef}
            type="text"
            id={`${id}-input`}
            disabled={disabled}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedItem && !isOpen ? '' : placeholder}
            className={`w-full bg-transparent text-xs text-slate-900 focus:outline-none placeholder:text-slate-400 ${
              selectedItem && !isOpen ? 'hidden' : 'block'
            }`}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {selectedItem && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) {
                setIsOpen((prev) => !prev);
                if (!isOpen) inputRef.current?.focus();
              }
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-50 transition cursor-pointer"
            title="Toggle item list"
          >
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-blue-600' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Floating Dropdown List */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 z-[100] mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-72 overflow-hidden flex flex-col text-xs animate-in fade-in zoom-in-95 duration-100">
          {/* Header Quick Filters */}
          {filterType === 'all' && (
            <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTypeFilter('all')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    activeTypeFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  All ({safeItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTypeFilter('asset')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    activeTypeFilter === 'asset'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  Assets ({safeItems.filter((i) => i.itemType === 'asset').length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTypeFilter('consumable')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    activeTypeFilter === 'consumable'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  Consumables ({safeItems.filter((i) => i.itemType === 'consumable').length})
                </button>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {filteredItems.length} listed
              </span>
            </div>
          )}

          {/* List of items */}
          <div className="overflow-y-auto divide-y divide-slate-100 max-h-56">
            {filteredItems.length === 0 ? (
              <div className="p-5 text-center text-slate-400">
                <AlertCircle className="w-5 h-5 mx-auto text-slate-300 mb-1" />
                <p className="font-semibold text-slate-600">
                  {safeItems.length === 0 ? 'No stock items loaded' : 'No matching items found'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {safeItems.length === 0
                    ? 'No inventory records found in current branch/system.'
                    : 'Try typing a different SKU code, model or item name.'}
                </p>
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const isSelected = item.id === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={item.id}
                    id={`${id}-item-${item.id}`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelectItem(item)}
                    className={`px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition ${
                      isSelected
                        ? 'bg-blue-50/90 text-blue-950 font-bold'
                        : isHighlighted
                        ? 'bg-slate-50 text-slate-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          item.itemType === 'asset'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item.itemType === 'asset' ? (
                          <Wrench className="w-3.5 h-3.5" />
                        ) : (
                          <Box className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                            {item.code}
                          </span>
                          <p className="font-semibold text-slate-900 truncate text-xs">{item.name}</p>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                          {item.category && <span>{item.category.name}</span>}
                          {item.model && (
                            <>
                              <span>•</span>
                              <span className="text-slate-600 font-medium">{item.model.name}</span>
                            </>
                          )}
                          {showEngagementInfo && item.engagementStatus && (
                            <>
                              <span>•</span>
                              <span
                                className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                                  item.engagementStatus === 'engaged'
                                    ? 'bg-blue-100 text-blue-700'
                                    : item.engagementStatus === 'repaired'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {item.engagementStatus}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-right">
                      <div>
                        <p className="font-bold text-slate-900 font-mono text-xs">
                          {item.availableQuantity}{' '}
                          <span className="text-[10px] uppercase font-semibold text-slate-500 font-sans">
                            {item.uom}
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-400">Available</p>
                      </div>

                      {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

