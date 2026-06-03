import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToBorrowers, addBorrower } from '../services/firestoreService';
import { Borrower } from '../types';
import { Search, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  value: string; // borrowerId
  onChange: (borrowerId: string, borrower: Borrower) => void;
  placeholder?: string;
}

export default function BorrowerDropdown({ value, onChange, placeholder = 'Select Borrower...' }: Props) {
  const { user } = useAuth();
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBorrowerName, setNewBorrowerName] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    return subscribeToBorrowers(user.id.toString(), setBorrowers);
  }, [user?.id]);

  const activeBorrowers = borrowers.filter(b => b.status === 'Active');
  const filtered = activeBorrowers.filter(b => 
    b.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (b.mobileNumber || '').includes(searchTerm)
  );

  const selected = borrowers.find(b => b.id === value);

  const handleAddNew = async () => {
    if (!user?.id || !newBorrowerName) return;
    const newId = await addBorrower({ 
      ownerId: user.id.toString(), 
      fullName: newBorrowerName, 
      status: 'Active' 
    });
    if (newId) {
      const newBorrower = { id: newId, ownerId: user.id.toString(), fullName: newBorrowerName, status: 'Active' as const };
      onChange(newId, newBorrower);
      setShowAddModal(false);
      setNewBorrowerName('');
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button 
        type="button"
        className="w-full p-2 border rounded bg-white text-left flex justify-between items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selected ? `${selected.fullName} - ${selected.mobileNumber || ''}` : placeholder}
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full bg-white border mt-1 rounded shadow-lg">
          <div className="p-2 border-b">
            <input 
              autoFocus
              className="w-full p-1 border rounded"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.map(b => (
              <button 
                key={b.id} 
                className="w-full text-left p-2 hover:bg-zinc-100"
                onClick={() => { onChange(b.id, b); setIsOpen(false); }}
              >
                {b.fullName} - {b.mobileNumber}
              </button>
            ))}
            <button 
              className="w-full text-left p-2 text-indigo-600 font-bold flex items-center gap-1 hover:bg-zinc-100"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={16} /> Add New Borrower
            </button>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white p-6 rounded shadow-xl w-full max-w-sm">
            <h3 className="font-bold mb-4">Add New Borrower</h3>
            <input 
              autoFocus
              className="w-full p-2 border rounded mb-4"
              placeholder="Full Name"
              value={newBorrowerName}
              onChange={e => setNewBorrowerName(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => setShowAddModal(false)} className="flex-1 p-2 border rounded">Cancel</button>
              <button onClick={handleAddNew} className="flex-1 p-2 bg-indigo-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
