/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNav } from '../context/NavContext';
import { crmApi } from '../services/api';
import { useForm } from 'react-hook-form';
import { ClientStatus } from '../types';
import { User, Phone, Building2, Calendar, ShieldCheck, HelpCircle, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

import { validateAndFormatBDPhone, inputDateToBD } from '../utils';

interface ClientFormInputs {
  name: string;
  phone: string;
  company: string;
  status: ClientStatus;
  district: string;
}

export const AddClient: React.FC = () => {
  const { navigateTo, unsavedChanges, setUnsavedChanges, searchPrefilledPhone, setSearchPrefilledPhone } = useNav();
  const [submitting, setSubmitting] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<string>(''); // Default empty
  const originalFollowUp = React.useRef<string>('');
  
  const { register, handleSubmit, formState: { errors, isDirty }, reset } = useForm<ClientFormInputs>({
    defaultValues: {
      name: '',
      phone: searchPrefilledPhone || '',
      company: '',
      status: 'New',
      district: 'Dhaka'
    }
  });

  // Track isDirty and followUpDate to update setUnsavedChanges
  React.useEffect(() => {
    const hasUnsaved = isDirty || followUpDate !== '';
    if (hasUnsaved !== unsavedChanges) {
      Promise.resolve().then(() => {
        setUnsavedChanges(hasUnsaved);
      });
    }
    return () => {
      Promise.resolve().then(() => {
        setUnsavedChanges(false);
      });
    };
  }, [isDirty, followUpDate, setUnsavedChanges, unsavedChanges]);

  const onSubmit = async (data: ClientFormInputs) => {
    try {
      setSubmitting(true);
      const res = await crmApi.addClient({
        name: data.name.trim(),
        phone: data.phone.trim(),
        company: data.company.trim(),
        status: data.status,
        nextFollowUp: followUpDate, // optional string
        district: data.district.trim()
      });

      if (res.success && res.client) {
        toast.success(`Client ${res.client.name} created! ID: ${res.client.id}`);
        setUnsavedChanges(false);
        setSearchPrefilledPhone('');
        reset();
        setFollowUpDate('');
        // Navigate straight to the profile of the newly created client
        navigateTo('clientDetail', { clientId: res.client.id });
      } else {
        toast.error('Could not create client. Unknown error.');
      }
    } catch (err: any) {
      console.error('Error creating client:', err);
      toast.error(err.message || 'Error communicating with CRM database.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Intro */}
      <div className="space-y-1 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
          <ShieldCheck className="w-4.5 h-4.5 text-blue-500" />
          <span>New Customer Registration</span>
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Fill in client details. A unique Client ID (e.g., CLI-1004) will be generated automatically upon submission and synced to Google Sheets.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Client Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-350 flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            <span>Full Name *</span>
          </label>
          <input
            type="text"
            placeholder="John Doe"
            {...register('name', { required: 'Client Name is required' })}
            className={`w-full p-3.5 bg-white dark:bg-slate-900 border ${
              errors.name ? 'border-rose-500 focus:ring-rose-500/15' : 'border-slate-100 dark:border-slate-800 focus:ring-blue-500/15'
            } rounded-2xl shadow-sm text-sm dark:text-white focus:outline-none focus:ring-4 focus:border-blue-500 font-medium transition-all`}
          />
          {errors.name && (
            <p className="text-[10px] text-rose-500 font-bold">{errors.name.message}</p>
          )}
        </div>

        {/* Client Phone */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-350 flex items-center gap-1">
            <Phone className="w-3.5 h-3.5" />
            <span>Bangladeshi Phone Number *</span>
          </label>
          <input
            type="tel"
            placeholder="e.g. 01712345678"
            {...register('phone', { 
              required: 'Phone Number is required',
              validate: (val) => {
                const check = validateAndFormatBDPhone(val);
                return check.isValid || check.error || 'Invalid Bangladeshi mobile number';
              }
            })}
            className={`w-full p-3.5 bg-white dark:bg-slate-900 border ${
              errors.phone ? 'border-rose-500 focus:ring-rose-500/15' : 'border-slate-100 dark:border-slate-800 focus:ring-blue-500/15'
            } rounded-2xl shadow-sm text-sm dark:text-white focus:outline-none focus:ring-4 focus:border-blue-500 font-medium transition-all`}
          />
          {errors.phone && (
            <p className="text-[10px] text-rose-500 font-bold">{errors.phone.message}</p>
          )}
          <span className="text-[10px] text-slate-400">Accepted formats: 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX. Saved as +8801XXXXXXXXX</span>
        </div>

        {/* Company Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-350 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" />
            <span>Company Name</span>
          </label>
          <input
            type="text"
            placeholder="Acme Corp"
            {...register('company')}
            className="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm text-sm dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 font-medium transition-all"
          />
        </div>

        {/* District */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-350 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            <span>District / Location *</span>
          </label>
          <input
            type="text"
            list="bd-districts"
            placeholder="e.g. Dhaka"
            {...register('district', { required: 'District is required' })}
            className="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm text-sm dark:text-white focus:outline-none focus:ring-4 focus:border-blue-500/15 focus:border-blue-500 font-medium transition-all"
          />
          <datalist id="bd-districts">
            <option value="Dhaka" />
            <option value="Chittagong" />
            <option value="Sylhet" />
            <option value="Khulna" />
            <option value="Rajshahi" />
            <option value="Barisal" />
            <option value="Rangpur" />
            <option value="Mymensingh" />
            <option value="Cox's Bazar" />
            <option value="Comilla" />
            <option value="Jessore" />
            <option value="Gazipur" />
            <option value="Narayanganj" />
          </datalist>
        </div>

        {/* Status selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-350 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>CRM Stage Stage</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['New', 'Interested', 'Customer', 'Lost'] as ClientStatus[]).map((status) => (
              <label
                key={status}
                className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-98 transition-all shadow-sm"
              >
                <input
                  type="radio"
                  value={status}
                  {...register('status')}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{status}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Next Follow-up Date Field Group */}
        <div className="space-y-3 bg-slate-50/50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-350 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span>Next Follow Up Date</span>
          </label>
          
          <div className="space-y-2.5">
            {/* Status Display */}
            {!followUpDate ? (
              <div className="p-3 bg-slate-100/50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
                <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400">
                  No Follow-up Scheduled
                </span>
              </div>
            ) : (
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100/20 rounded-xl text-center">
                <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                  Scheduled: {inputDateToBD(followUpDate)}
                </span>
              </div>
            )}

            {/* Date Picker Input */}
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm text-sm dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 font-mono transition-all"
            />

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  setFollowUpDate(todayStr);
                }}
                className="flex items-center justify-center gap-1 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-100/10 rounded-xl text-[10px] font-black active:scale-95 transition-all cursor-pointer"
                style={{ minHeight: '44px' }}
                id="add-client-select-date-button"
              >
                <span>Select Date</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFollowUpDate('');
                }}
                className="flex items-center justify-center gap-1 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-100/10 rounded-xl text-[10px] font-black active:scale-95 transition-all cursor-pointer"
                style={{ minHeight: '44px' }}
                id="add-client-clear-date-button"
              >
                <span>🗑️ Clear Date</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFollowUpDate(originalFollowUp.current);
                }}
                className="flex items-center justify-center gap-1 py-2 bg-slate-100 hover:bg-slate-150 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-200/50 rounded-xl text-[10px] font-black active:scale-95 transition-all cursor-pointer"
                style={{ minHeight: '44px' }}
                id="add-client-cancel-date-button"
              >
                <span>Cancel</span>
              </button>
            </div>
            
            <div className="flex justify-end pt-0.5">
              <button
                type="button"
                onClick={() => setFollowUpDate('')}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                id="add-client-no-followup-button"
              >
                <span>No Follow-up</span>
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-normal">
            This schedule will appear on the 'Follow Ups' dashboard screen to trigger touch-points. Leave blank for no follow-up.
          </p>
        </div>

        {/* Save button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg hover:shadow-blue-500/15 active:scale-95 disabled:scale-100 disabled:opacity-50 transition-all cursor-pointer border border-blue-500/20 text-sm mt-6"
          style={{ minHeight: '44px' }}
          id="add-client-submit-button"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>Save Client Profile</span>
          )}
        </button>
      </form>
    </div>
  );
};
export default AddClient;
