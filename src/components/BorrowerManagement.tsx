import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, X, Users, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeToBorrowers, addBorrower, updateBorrower, deleteBorrower, logActivity } from '../services/firestoreService';
import { Borrower } from '../types';
import DeleteConfirmationModal from './DeleteConfirmationModal';

export default function BorrowerManagement() {
  const { user } = useAuth();
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBorrower, setEditingBorrower] = useState<Borrower | null>(null);
  const [formData, setFormData] = useState<Omit<Borrower, 'id' | 'ownerId' | 'created_at' | 'updated_at'>>({
    fullName: '',
    mobileNumber: '',
    whatsAppNumber: '',
    email: '',
    address: '',
    companyName: '',
    notes: '',
    status: 'Active'
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [borrowerToDelete, setBorrowerToDelete] = useState<Borrower | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = subscribeToBorrowers(user.id.toString(), (data) => {
      setBorrowers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      if (editingBorrower) {
        await updateBorrower(editingBorrower.id, formData);
        await logActivity(user.id.toString(), user.name, user.email, 'Update Borrower', `Updated ${formData.fullName}`);
      } else {
        await addBorrower({ ...formData, ownerId: user.id.toString() });
        await logActivity(user.id.toString(), user.name, user.email, 'Add Borrower', `Added ${formData.fullName}`);
      }
      setIsModalOpen(false);
      setEditingBorrower(null);
      setFormData({
        fullName: '',
        mobileNumber: '',
        whatsAppNumber: '',
        email: '',
        address: '',
        companyName: '',
        notes: '',
        status: 'Active'
      });
    } catch (err) {
      console.error('Error saving borrower:', err);
    }
  };

  const editBorrower = (borrower: Borrower) => {
    setEditingBorrower(borrower);
    setFormData({
      fullName: borrower.fullName,
      mobileNumber: borrower.mobileNumber || '',
      whatsAppNumber: borrower.whatsAppNumber || '',
      email: borrower.email || '',
      address: borrower.address || '',
      companyName: borrower.companyName || '',
      notes: borrower.notes || '',
      status: borrower.status
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (borrower: Borrower) => {
    setBorrowerToDelete(borrower);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!borrowerToDelete || !user?.id) return;
    setIsDeleting(true);
    try {
      await deleteBorrower(borrowerToDelete.id);
      await logActivity(user.id.toString(), user.name, user.email, 'Delete Borrower', `Deleted borrower ${borrowerToDelete.fullName}`);
      setDeleteModalOpen(false);
      setBorrowerToDelete(null);
    } catch (err) {
      console.error('Error deleting borrower:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredBorrowers = borrowers.filter(b => 
    b.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.mobileNumber && b.mobileNumber.includes(searchTerm))
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users /> Borrowers</h1>
        <button 
          onClick={() => { setEditingBorrower(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold"
        >
          <Plus size={18} /> Add Borrower
        </button>
      </div>

      <div className="mb-4 flex gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-2.5 text-zinc-400" size={18} />
          <input 
            type="text"
            placeholder="Search by name or number..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-50 border-b">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">Mobile</th>
              <th className="p-4">WhatsApp</th>
              <th className="p-4">Company</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBorrowers.map(b => (
              <tr key={b.id} className="border-b hover:bg-zinc-50">
                <td className="p-4 font-bold">{b.fullName}</td>
                <td className="p-4">{b.mobileNumber}</td>
                <td className="p-4">{b.whatsAppNumber}</td>
                <td className="p-4">{b.companyName}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs ${b.status === 'Active' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {b.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => editBorrower(b)} className="p-2 hover:bg-zinc-100 rounded text-blue-600" title="Edit Borrower"><Edit2 size={16} /></button>
                  <button onClick={() => handleDeleteClick(b)} className="p-2 hover:bg-zinc-100 rounded text-red-600 ml-1" title="Delete Borrower"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl"
            >
              <h2 className="text-xl font-bold mb-4">{editingBorrower ? 'Edit' : 'Add'} Borrower</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input required placeholder="Full Name" className="w-full p-2 border rounded" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                <input placeholder="Mobile" className="w-full p-2 border rounded" value={formData.mobileNumber} onChange={e => setFormData({...formData, mobileNumber: e.target.value})} />
                <input placeholder="WhatsApp" className="w-full p-2 border rounded" value={formData.whatsAppNumber} onChange={e => setFormData({...formData, whatsAppNumber: e.target.value})} />
                <input type="email" placeholder="Email" className="w-full p-2 border rounded" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                <input placeholder="Address" className="w-full p-2 border rounded" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                <input placeholder="Company (Optional)" className="w-full p-2 border rounded" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} />
                <select className="w-full p-2 border rounded" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as 'Active' | 'Inactive'})}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 p-2 border rounded">Cancel</button>
                  <button type="submit" className="flex-1 p-2 bg-indigo-600 text-white rounded">Save</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        title="Confirm Deletion"
        message="Are you sure you want to delete this borrower? This action cannot be undone."
        itemName={borrowerToDelete ? `Borrower: ${borrowerToDelete.fullName}` : undefined}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalOpen(false)}
        isLoading={isDeleting}
      />
    </div>
  );
}
