import React, { useState, useEffect } from 'react';
import { doc, getDoc, getDocs, query, collection, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Quotation, QuotationItem } from '../types';
import { 
  FileText, 
  Printer, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  User, 
  Download,
  AlertTriangle,
  FileCheck,
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  Loader2,
  ChevronLeft,
  Sun,
  Moon
} from 'lucide-react';
import { formatCurrency } from '../utils/i18n';

interface PublicQuotationViewProps {
  quotationId: string;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export default function PublicQuotationView({ quotationId, theme, toggleTheme }: PublicQuotationViewProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load quotation data from Firestore
  useEffect(() => {
    async function fetchQuotationData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch Quotation doc
        const qRef = doc(db, 'quotations', quotationId);
        const qSnap = await getDoc(qRef);

        if (!qSnap.exists()) {
          setError('Quotation not found. Please verify the link.');
          setLoading(false);
          return;
        }

        const qData = { id: qSnap.id, ...qSnap.data() } as Quotation;
        setQuotation(qData);

        // Fetch Quotation items
        const itemsQuery = query(
          collection(db, 'quotation_items'),
          where('quotationId', '==', quotationId)
        );
        const itemsSnap = await getDocs(itemsQuery);
        const itemsList = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as QuotationItem[];
        setItems(itemsList);
      } catch (err: any) {
        console.error('Error fetching public quotation:', err);
        setError('Failed to load quotation details. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    if (quotationId) {
      fetchQuotationData();
    }
  }, [quotationId]);

  const handleUpdateStatus = async (newStatus: 'Accepted' | 'Rejected') => {
    if (!quotation) return;

    const confirmMsg = newStatus === 'Accepted'
      ? 'Are you sure you want to ACCEPT this quotation proposal?'
      : 'Are you sure you want to REJECT this quotation proposal?';

    if (!window.confirm(confirmMsg)) return;

    try {
      setSubmitting(true);
      setError(null);

      const qRef = doc(db, 'quotations', quotation.id);
      
      // Perform strict guest update
      await updateDoc(qRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      // Update local state
      setQuotation(prev => prev ? { ...prev, status: newStatus } : null);
      setSuccessMessage(
        newStatus === 'Accepted'
          ? 'Thank you! You have successfully Accepted the quotation.'
          : 'You have Rejected the quotation. Thank you for your feedback.'
      );
    } catch (err: any) {
      console.error('Error updating quotation status:', err);
      setError('Failed to update quotation response. Please verify and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-550 dark:bg-black p-4 text-center">
        <Loader2 className="w-12 h-12 text-zinc-900 dark:text-zinc-100 animate-spin mb-4" />
        <p className="text-zinc-500 dark:text-zinc-400 font-medium">Loading Quotation details, please wait...</p>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-black p-4 text-center">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 p-8 rounded-3xl shadow-xl max-w-md w-full">
          <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Something went wrong</h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">{error || 'Could not load quotation.'}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full py-2.5 bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 text-white font-bold rounded-xl text-xs uppercase tracking-wider hover:opacity-90"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Calculate totals manually for safety
  const baseSubtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalDiscount = items.reduce((sum, item) => sum + ((item.quantity * item.unitPrice) * (item.discount / 100)), 0);
  const totalTax = items.reduce((sum, item) => sum + (((item.quantity * item.unitPrice) - ((item.quantity * item.unitPrice) * (item.discount / 100))) * (item.tax / 100)), 0);
  const grandTotal = quotation.totalAmount || (baseSubtotal - totalDiscount + totalTax);

  const isExpired = new Date(quotation.validUntilDate) < new Date();
  const canRespond = quotation.status !== 'Accepted' && quotation.status !== 'Rejected' && quotation.status !== 'Expired' && !isExpired;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 py-10 px-4 md:px-8 print:p-0 print:bg-white print:text-black">
      {/* Print styles to ensure only the invoice card is printed cleanly */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* Top action header (no-print) */}
      <div className="no-print max-w-4xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
            <FileCheck className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h2 className="font-bold text-base">Quotation #{quotation.quotationNumber}</h2>
            <p className="text-xs text-zinc-500">For {quotation.clientName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Dark / Light Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors shrink-0"
            title="Toggle theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {/* Print/Download Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl px-4 py-2 text-xs font-bold cursor-pointer transition-colors"
          >
            <Printer size={14} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="no-print max-w-4xl mx-auto mb-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 p-4 rounded-xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-sm">Success</p>
            <p className="text-xs mt-0.5">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Main Quotation Document Sheet */}
      <div className="print-card max-w-4xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-205 dark:border-zinc-801 p-8 md:p-12 rounded-3xl shadow-lg relative overflow-hidden transition-all">
        {/* Status indicator badge (top corner) */}
        <div className="absolute top-0 right-0 h-2 w-full bg-indigo-500" />
        
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-b border-zinc-100 dark:border-zinc-800/80 pb-8 mt-4">
          {/* Service Provider Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-zinc-950 dark:bg-white text-white dark:text-zinc-900 rounded-lg flex items-center justify-center font-black text-lg">
                E
              </div>
              <span className="font-black text-2xl tracking-tight">Expensy</span>
            </div>
            <div className="text-xs text-zinc-550 dark:text-zinc-400 space-y-1">
              <p className="text-zinc-800 dark:text-zinc-200 font-bold">Solutions Agency</p>
              <p className="flex items-center gap-1.5"><Mail size={12} /> info@expensy.io</p>
              <p className="flex items-center gap-1.5"><Globe size={12} /> www.expensy.io</p>
            </div>
          </div>

          {/* Quotation Specs */}
          <div className="text-left md:text-right space-y-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase ${
              quotation.status === 'Accepted'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                : quotation.status === 'Sent'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400'
                : quotation.status === 'Draft'
                ? 'bg-zinc-100 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-300'
                : quotation.status === 'Expired' || isExpired
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
            }`}>
              {isExpired && quotation.status === 'Sent' ? 'Expired' : quotation.status}
            </span>

            <h1 className="text-2xl font-black text-zinc-950 dark:text-white leading-none mt-1">QUOTATION</h1>
            <p className="text-xs font-bold text-zinc-500">Proposal No: <span className="font-mono text-zinc-900 dark:text-white font-black">{quotation.quotationNumber}</span></p>
            
            <div className="text-xs space-y-1 pt-1">
              <p className="text-zinc-500">Quote Date: <span className="font-bold text-zinc-800 dark:text-zinc-200">{quotation.quotationDate}</span></p>
              <p className="text-zinc-500">Valid Until: <span className="font-bold text-zinc-800 dark:text-zinc-200">{quotation.validUntilDate}</span></p>
            </div>
          </div>
        </div>

        {/* Client details & Scope brief */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 border-b border-zinc-100 dark:border-zinc-800/80">
          <div>
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">Prepared For</h3>
            <div className="space-y-1.5">
              <h4 className="font-bold text-base text-zinc-950 dark:text-white">{quotation.clientName}</h4>
              <p className="text-xs text-zinc-500">Client Partner</p>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">Project Brief</h3>
            <div className="space-y-1.5">
              <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{quotation.projectName}</h4>
              <p className="text-xs text-zinc-500 max-w-sm">{quotation.description || 'Deliverables and customized design development according to client instructions.'}</p>
            </div>
          </div>
        </div>

        {/* Itemized pricing items list */}
        <div className="py-8">
          <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-4">Itemized Breakdown</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 pb-2 text-zinc-450 dark:text-zinc-500 uppercase font-black text-[10px] tracking-wider">
                  <th className="py-3 w-1/2">Deliverable Item</th>
                  <th className="py-3 text-center">Qty</th>
                  <th className="py-3 text-right">Unit Price</th>
                  <th className="py-3 text-right">Discount</th>
                  <th className="py-3 text-right">Tax</th>
                  <th className="py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50 font-medium">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-zinc-500 font-medium">No line items included.</td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/20 dark:hover:bg-zinc-850/10">
                      <td className="py-3.5 pr-4">
                        <div className="font-bold text-zinc-900 dark:text-white">{item.itemName}</div>
                        {item.description && <div className="text-[10px] text-zinc-450 dark:text-zinc-500 mt-0.5">{item.description}</div>}
                      </td>
                      <td className="py-3.5 text-center font-bold">{item.quantity}</td>
                      <td className="py-3.5 text-right font-mono font-bold">{formatCurrency(item.unitPrice, 'BDT', 'en')}</td>
                      <td className="py-3.5 text-right text-zinc-500">{item.discount > 0 ? `${item.discount}%` : '-'}</td>
                      <td className="py-3.5 text-right text-zinc-500">{item.tax > 0 ? `${item.tax}%` : '-'}</td>
                      <td className="py-3.5 text-right font-bold font-mono text-zinc-950 dark:text-white">{formatCurrency(item.total, 'BDT', 'en')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pricing calculations total */}
        <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-6 flex flex-col md:flex-row justify-between items-start gap-8">
          {/* T&C or footer notes */}
          <div className="max-w-md text-[11px] text-zinc-500 space-y-1">
            <p className="font-bold text-zinc-800 dark:text-zinc-350">Terms & Conditions</p>
            <p>1. Please confirm acceptance by clicking the 'Accept Proposal' option.</p>
            <p>2. Payment cycles and progress schedules will align directly upon Project confirmation.</p>
            <p>3. Dynamic deliverables can be tweaked based on mutual consensus.</p>
          </div>

          {/* Pricing calculations */}
          <div className="w-full md:w-64 space-y-2 text-xs font-bold text-right shrink-0">
            <div className="flex justify-between text-zinc-500 font-medium">
              <span>Subtotal:</span>
              <span className="font-mono">{formatCurrency(baseSubtotal, 'BDT', 'en')}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-rose-500 font-medium">
                <span>Total Discount:</span>
                <span className="font-mono">-{formatCurrency(totalDiscount, 'BDT', 'en')}</span>
              </div>
            )}
            {totalTax > 0 && (
              <div className="flex justify-between text-zinc-500 font-medium">
                <span>Estimated Tax:</span>
                <span className="font-mono">+{formatCurrency(totalTax, 'BDT', 'en')}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 font-black border-t border-zinc-100 dark:border-zinc-800/80 text-zinc-950 dark:text-white">
              <span>Quotation Total:</span>
              <span className="font-mono text-base text-indigo-650 dark:text-indigo-400">{formatCurrency(grandTotal, 'BDT', 'en')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Decline / Accept Guest action bar (no-print) */}
      <div className="no-print max-w-4xl mx-auto mt-8 flex flex-col sm:flex-row justify-end items-center gap-3">
        {canRespond ? (
          <>
            <button
              onClick={() => handleUpdateStatus('Rejected')}
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-955/20 font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
            >
              Decline Offer
            </button>
            <button
              onClick={() => handleUpdateStatus('Accepted')}
              disabled={submitting}
              className="w-full sm:w-auto px-8 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg shadow-indigo-650/15 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              Accept Proposal
            </button>
          </>
        ) : (
          <div className="text-zinc-500 text-xs text-center sm:text-right">
            {quotation.status === 'Accepted' && (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 size={16} /> This proposal has been accepted. Thank you for your partnership!
              </span>
            )}
            {quotation.status === 'Rejected' && (
              <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-450 font-bold">
                <XCircle size={16} /> This proposal was rejected.
              </span>
            )}
            {quotation.status === 'Expired' || isExpired && (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                <AlertTriangle size={16} /> This proposal has expired. Please contact support.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
