import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingView: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
    </div>
  );
};
