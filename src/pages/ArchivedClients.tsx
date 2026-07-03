/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNav } from '../context/NavContext';
import { crmApi } from '../services/api';
import { Client } from '../types';
import { ListSkeleton } from '../components/Skeleton';
import { 
  ArrowLeft, 
  Trash2, 
  RotateCcw, 
  Search, 
  Users, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatBDPhoneForDisplay } from '../utils';
import { DeleteClientConfirmationModal } from '../components/DeleteClientConfirmationModal';

export const ArchivedClients: React.FC = () => {
  const { navigateTo } = useNav();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const fetchArchivedClients = async () => {
    try {
      setLoading(true);
      const res = await crmApi.getClients();
      // Filter archived clients
      setClients(res.filter(c => c.isArchived));
    } catch (err: any) {
      console.error('Error fetching archived clients:', err);
      toast.error('Failed to load archived clients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedClients();
  }, []);

  const handleRestore = async (client: Client) => {
    try {
      const res = await crmApi.updateClient({ id: client.id, isArchived: false });
      if (res.success) {
        toast.success(`✅ Client "${client.name}" restored successfully.`);
        // Remove from list
        setClients(prev => prev.filter(c => c.id !== client.id));
        // Notify other pages
        window.dispatchEvent(new Event('clients-updated'));
      } else {
        toast.error('❌ Failed to restore client.');
      }
    } catch (err) {
      console.error(err);
      toast.error('❌ Failed to restore client.');
    }
  };

  const handleDeletePermanentClick = (client: Client) => {
    setClientToDelete(client);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!clientToDelete) return;
    try {
      const res = await crmApi.deleteClient(clientToDelete.id);
      if (res.success) {
        toast.success('🔥 Client permanently deleted.');
        setClients(prev => prev.filter(c => c.id !== clientToDelete.id));
        setDeleteModalOpen(false);
        setClientToDelete(null);
        window.dispatchEvent(new Event('clients-updated'));
      } else {
        toast.error('❌ Failed to delete client.');
      }
    } catch (err) {
      console.error(err);
      toast.error('❌ Failed to delete client.');
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery) ||
    (c.company && c.company.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigateTo('dashboard')}
          className="p-2.5 bg-white dark:bg-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
          id="archived-back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="space-y-0.5">
          <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Archived Clients</span>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-mono font-bold text-slate-500">
              {clients.length}
            </span>
          </h2>
          <p className="text-[10px] text-slate-400 font-medium">Archived contacts are hidden from search and dashboards.</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search archived clients by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-all text-slate-800 dark:text-slate-100"
          id="archived-search-input"
        />
      </div>

      {loading ? (
        <ListSkeleton />
      ) : (
        <div className="space-y-3">
          {filteredClients.length === 0 ? (
            <div className="p-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-100 dark:border-slate-800 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No archived clients found
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                {searchQuery ? 'Try matching another name or phone number.' : 'Clients will appear here when you choose to archive them.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClients.map(client => (
                <div
                  key={client.id}
                  className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col gap-3.5"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-800 dark:text-white">
                          {client.name}
                        </span>
                        <span className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                          Archived
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-medium">
                        {client.company || 'Individual Freelancer'} • <span className="font-mono">{formatBDPhoneForDisplay(client.phone)}</span>
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-extrabold font-mono">
                      {client.id}
                    </span>
                  </div>

                  <div className="flex gap-2 border-t border-slate-50 dark:border-slate-850 pt-3">
                    <button
                      onClick={() => handleRestore(client)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-xs hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors cursor-pointer border border-blue-100/10"
                      style={{ minHeight: '40px' }}
                      id={`restore-btn-${client.id}`}
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Restore Client</span>
                    </button>

                    <button
                      onClick={() => handleDeletePermanentClick(client)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-colors cursor-pointer border border-rose-100/10"
                      style={{ minHeight: '40px' }}
                      id={`delete-perm-btn-${client.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-rose-500" />
                      <span>Delete Permanently</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {clientToDelete && (
        <DeleteClientConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setClientToDelete(null);
          }}
          onConfirm={handleDeleteConfirm}
          clientName={clientToDelete.name}
          clientId={clientToDelete.id}
        />
      )}
    </div>
  );
};
export default ArchivedClients;