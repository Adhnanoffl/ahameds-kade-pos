import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your store preferences and system settings</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col items-center justify-center text-gray-400">
        <SettingsIcon size={64} className="mb-4 opacity-20" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Settings Module</h3>
        <p className="text-sm">Store configuration, tax rates, and receipt settings will appear here.</p>
      </div>
    </div>
  );
}