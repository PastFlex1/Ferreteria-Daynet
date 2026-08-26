import React, { useState, useEffect } from 'react';
import { useModal } from '../../context/ModalContext';
import { 
  X, 
  Plus, 
  Trash2, 
  Search, 
  User, 
  Package, 
  ShoppingCart, 
  FileText, 
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign
} from 'lucide-react';
import { Customer, Product, StoreSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { validateEcuadorianDocument } from '../../utils/ecuadorianValidator';
import { Select } from '../Shared/Select';

export interface OrderItem {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  taxRate?: number;
  subtotal: number;
}

export interface Order {
  id: string;
  customerName: string;
  customerRuc?: string;
  date: string;
  total: number;
  subtotal: number;
  tax: number;
  status: 'PENDIENTE' | 'EN PREPARACION' | 'DESPACHADO' | 'FACTURADO' | 'ANULADO';
  itemsCount: number;
  items: OrderItem[];
  notes?: string;
  deliveryAddress?: string;
}

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: Order) => void;
  customers: Customer[];
  products: Product[];
  settings: StoreSettings;
  orderToEdit?: Order | null;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  customers,
  products,
  settings,
  orderToEdit,
}) => {
  const { showAlert, showToast } = useModal();

  // Selected customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customCustomerName, setCustomCustomerName] = useState('');
  const [customCustomerRuc, setCustomCustomerRuc] = useState('');

  // Cart items state
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  // Product selection state
  const [productSearch, setProductSearch] = useState('');

  // Reset or initialize state based on orderToEdit
  useEffect(() => {
    if (!isOpen) return;

    if (orderToEdit) {
      const matchCustomer = customers.find(
        (c) => (orderToEdit.customerRuc && c.docNumber === orderToEdit.customerRuc) || 
               c.name.toLowerCase() === orderToEdit.customerName.toLowerCase()
      );
      setSelectedCustomerId(matchCustomer ? matchCustomer.id : '');
      setCustomCustomerName(orderToEdit.customerName || '');
      setCustomCustomerRuc(orderToEdit.customerRuc || '');
      setOrderItems(orderToEdit.items ? JSON.parse(JSON.stringify(orderToEdit.items)) : []);
      setNotes(orderToEdit.notes || '');
      setDeliveryAddress(orderToEdit.deliveryAddress || '');
      setInitialStatus(orderToEdit.status === 'EN PREPARACION' ? 'EN PREPARACION' : 'PENDIENTE');
    } else {
      setSelectedCustomerId('');
      setCustomCustomerName('');
      setCustomCustomerRuc('');
      setOrderItems([]);
      setNotes('');
      setDeliveryAddress('');
      setInitialStatus('PENDIENTE');
    }
  }, [isOpen, orderToEdit, customers]);

  // Global Barcode Scanner Listener for Create Order Modal
  useEffect(() => {
    if (!isOpen) return;
    
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      
      if (currentTime - lastKeyTime > 50) {
        barcodeBuffer = '';
      }
      
      if (e.key === 'Enter' && barcodeBuffer.length > 2) {
        const scannedCode = barcodeBuffer.trim();
        const foundProduct = products.find(p => 
          p.sku.toLowerCase() === scannedCode.toLowerCase() || 
          p.barcode.toLowerCase() === scannedCode.toLowerCase()
        );
        
        if (foundProduct) {
          // Add to cart with qty 1
          setOrderItems(prev => {
            const existingIndex = prev.findIndex((item) => item.productId === foundProduct.id);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex].qty += 1;
              updated[existingIndex].subtotal = updated[existingIndex].qty * updated[existingIndex].unitPrice;
              return updated;
            } else {
              return [...prev, {
                productId: foundProduct.id,
                productName: foundProduct.name,
                qty: 1,
                unitPrice: foundProduct.price,
                subtotal: foundProduct.price
              }];
            }
          });
          setProductSearch(''); // Clear search
        } else {
          setProductSearch(scannedCode);
        }
        
        barcodeBuffer = '';
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
      
      lastKeyTime = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, products]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantityToAdd, setQuantityToAdd] = useState<string>('1');

  // Additional order state
  const [notes, setNotes] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [initialStatus, setInitialStatus] = useState<'PENDIENTE' | 'EN PREPARACION'>('PENDIENTE');

  if (!isOpen) return null;

  // Filter products by search term
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.barcode.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleAddProduct = (prod: Product) => {
    const qty = parseFloat(quantityToAdd) || 1;
    if (qty <= 0) {
      showAlert('La cantidad debe ser mayor a 0.', 'Cantidad Inválida', 'warning');
      return;
    }

    const existingIndex = orderItems.findIndex((item) => item.productId === prod.id);
    if (existingIndex >= 0) {
      const updated = [...orderItems];
      const newQty = updated[existingIndex].qty + qty;
      updated[existingIndex].qty = newQty;
      updated[existingIndex].subtotal = newQty * updated[existingIndex].unitPrice;
      setOrderItems(updated);
    } else {
      const newItem: OrderItem = {
        productId: prod.id,
        productName: prod.name,
        qty: qty,
        unitPrice: prod.price,
        taxRate: typeof prod.taxRate === 'number' ? prod.taxRate : (settings.defaultTaxRate || 15),
        subtotal: qty * prod.price,
      };
      setOrderItems((prev) => [...prev, newItem]);
    }

    setSelectedProductId('');
    setQuantityToAdd('1');
  };

  const handleRemoveItem = (productId: string) => {
    setOrderItems(orderItems.filter((i) => i.productId !== productId));
  };

  const handleUpdateQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setOrderItems(
      orderItems.map((item) =>
        item.productId === productId
          ? { ...item, qty: newQty, subtotal: newQty * item.unitPrice }
          : item
      )
    );
  };

  // Calculations
  const rawSubtotal = orderItems.reduce((acc, item) => acc + item.subtotal, 0);
  const taxAmount = orderItems.reduce((acc, item) => {
    const rate = typeof (item as any).taxRate === 'number' ? (item as any).taxRate : (settings.defaultTaxRate || 15);
    return acc + (item.subtotal * (rate / 100));
  }, 0);
  const totalAmount = rawSubtotal + taxAmount;
  const totalItemsCount = orderItems.reduce((acc, item) => acc + item.qty, 0);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let customerName = customCustomerName.trim();
    let customerRuc = customCustomerRuc.trim();

    if (selectedCustomerId) {
      const found = customers.find((c) => c.id === selectedCustomerId);
      if (found) {
        customerName = found.name;
        customerRuc = found.docNumber;
      }
    }

    if (!selectedCustomerId && customerRuc) {
      const valRes = validateEcuadorianDocument('AUTO', customerRuc);
      if (!valRes.isValid) {
        showAlert(valRes.message || 'El RUC / Cédula / Pasaporte ingresado no es válido.', 'Documento Inválido', 'warning');
        return;
      }
    }

    if (!customerName) {
      showAlert('Por favor, seleccione o ingrese el nombre del cliente.', 'Cliente Requerido', 'warning');
      return;
    }

    if (orderItems.length === 0) {
      showAlert('Debe agregar al menos un producto al pedido.', 'Pedido Vacío', 'warning');
      return;
    }

    const orderId = orderToEdit ? orderToEdit.id : `PED-${Math.floor(1000 + Math.random() * 9000)}`;

    const savedOrder: Order = {
      id: orderId,
      customerName,
      customerRuc,
      date: orderToEdit ? orderToEdit.date : new Date().toISOString(),
      subtotal: rawSubtotal,
      tax: taxAmount,
      total: totalAmount,
      status: orderToEdit ? orderToEdit.status : initialStatus,
      itemsCount: totalItemsCount,
      items: orderItems,
      notes,
      deliveryAddress,
    };

    onSave(savedOrder);
    onClose();
    showToast(
      orderToEdit
        ? `Pedido ${savedOrder.id} actualizado correctamente.`
        : `Pedido ${savedOrder.id} registrado correctamente.`,
      'success'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="bg-slate-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30">
              <ShoppingCart className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {orderToEdit ? `Editar Pedido: ${orderToEdit.id}` : 'Crear Nuevo Pedido de Cliente'}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {orderToEdit
                  ? 'Modifique los productos, cliente o detalles del pedido'
                  : 'Genere una orden formal de venta previa a facturación'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Customer Selection */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-orange-500" />
              <span>Datos del Cliente</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Seleccionar Cliente Registrado
                </label>
                <Select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    if (e.target.value) {
                      setCustomCustomerName('');
                      setCustomCustomerRuc('');
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">-- Cliente Eventual o Nuevo --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.docNumber})
                    </option>
                  ))}
                </Select>
              </div>

              {!selectedCustomerId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nombre / Razón Social *
                    </label>
                    <input
                      type="text"
                      required={!selectedCustomerId}
                      placeholder="Ej: Constructora El Sol"
                      value={customCustomerName}
                      onChange={(e) => setCustomCustomerName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      RUC / Cédula (SRI)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 1792834712001"
                      value={customCustomerRuc}
                      onChange={(e) => setCustomCustomerRuc(e.target.value.trim())}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    {customCustomerRuc && (() => {
                      const res = validateEcuadorianDocument('AUTO', customCustomerRuc);
                      return (
                        <div className={`mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 border ${
                          res.isValid 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {res.isValid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Documento Válido ({res.type})</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>{res.message}</span>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Products Add */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-500" />
              <span>Agregar Productos al Pedido</span>
            </h4>

            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 relative">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Buscar Producto en Catálogo
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por código, nombre o categoría..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && productSearch) {
                        const exactMatch = products.find(p => p.sku.toLowerCase() === productSearch.toLowerCase() || p.barcode.toLowerCase() === productSearch.toLowerCase());
                        if (exactMatch) {
                          handleAddProduct(exactMatch);
                          setProductSearch('');
                        } else if (filteredProducts.length === 1) {
                          handleAddProduct(filteredProducts[0]);
                          setProductSearch('');
                        }
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="w-full sm:w-28">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={quantityToAdd}
                  onChange={(e) => setQuantityToAdd(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Filtered Products quick list */}
            {productSearch && (
              <div className="max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 shadow-sm">
                {filteredProducts.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500 text-center">
                    No se encontraron productos coincidentes.
                  </div>
                ) : (
                  filteredProducts.slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        handleAddProduct(p);
                        setProductSearch('');
                      }}
                      className="p-2.5 hover:bg-orange-50 flex items-center justify-between cursor-pointer transition"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-500">
                          Cód: {p.sku} | Stock: {p.stock} {p.unit}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-orange-600 text-xs">
                          {formatCurrency(p.price, settings.currencySymbol)}
                        </span>
                        <span className="p-1 bg-orange-500 text-white rounded-lg text-[10px] font-bold">
                          + Agregar
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Section 3: Order Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Resumen de Ítems ({orderItems.length})
              </h4>
              <span className="text-xs text-slate-500 font-bold">
                Total Unidades: {totalItemsCount}
              </span>
            </div>

            {orderItems.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 space-y-2">
                <ShoppingCart className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold">El pedido no contiene productos aún.</p>
                <p className="text-[11px]">Use la búsqueda superior para agregar productos.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-white uppercase text-[10px] font-black">
                    <tr>
                      <th className="py-2.5 px-3">Producto</th>
                      <th className="py-2.5 px-3 text-center">Cant.</th>
                      <th className="py-2.5 px-3 text-right">P. Unitario</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {orderItems.map((item) => (
                      <tr key={item.productId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {item.productName}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="1"
                            placeholder="1"
                            value={item.qty === 0 ? '' : item.qty}
                            onChange={(e) =>
                              handleUpdateQty(item.productId, e.target.value === '' ? 0 : parseInt(e.target.value) || 0)
                            }
                            className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-center font-bold text-xs"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(item.unitPrice, settings.currencySymbol)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-950">
                          {formatCurrency(item.subtotal, settings.currencySymbol)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.productId)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 4: Details & Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Dirección de Entrega / Despacho
                </label>
                <input
                  type="text"
                  placeholder="Ej: Av. Panamericana Norte km 10.5, Bodega 3"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Notas / Observaciones del Pedido
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Entregar antes de medio día. Cliente retira en vehículo propio..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Estado Inicial
                </label>
                <Select
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                >
                  <option value="PENDIENTE">PENDIENTE (A la espera de confirmación)</option>
                  <option value="EN PREPARACION">EN PREPARACIÓN (En bodega/alistamiento)</option>
                </Select>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-950 text-white rounded-2xl p-5 flex flex-col justify-between border border-slate-800 space-y-4">
              <h4 className="text-xs font-black uppercase text-orange-400 tracking-wider">
                Resumen de Venta
              </h4>

              <div className="space-y-2 text-xs font-medium text-slate-300 divide-y divide-slate-800">
                <div className="flex justify-between pt-1">
                  <span>Subtotal sin Impuestos:</span>
                  <span className="font-mono text-white font-bold">
                    {formatCurrency(rawSubtotal, settings.currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span>Impuestos (IVA):</span>
                  <span className="font-mono text-white font-bold">
                    {formatCurrency(taxAmount, settings.currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between pt-3 text-base font-black text-orange-400">
                  <span>Total Pedido:</span>
                  <span className="font-mono text-xl">
                    {formatCurrency(totalAmount, settings.currencySymbol)}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={orderItems.length === 0}
                  className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition ${
                    orderItems.length > 0
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>{orderToEdit ? 'Guardar Cambios del Pedido' : 'Guardar Pedido Formal'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
