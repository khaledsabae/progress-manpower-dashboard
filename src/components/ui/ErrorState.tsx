import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  error: {
    message: string;
    code?: string;
    status?: number;
  };
  onRetry?: () => void;
  className?: string;
  retryLabel?: string;
}

export function ErrorState({
  error,
  onRetry,
  className,
  retryLabel = 'Retry',
}: ErrorStateProps) {
  const isRetryable = onRetry !== undefined;
  const isServerError = error.status && error.status >= 500;
  
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-6 text-center rounded-lg',
        'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50',
        className
      )}
      role="alert"
    >
      <div className="p-3 mb-4 bg-red-100 dark:bg-red-900/30 rounded-full">
        <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
      </div>
      
      <h3 className="mb-2 text-lg font-medium text-red-800 dark:text-red-200">
        {isServerError ? 'Service Unavailable' : 'Something went wrong'}
      </h3>
      
      <p className="mb-4 text-sm text-red-700 dark:text-red-300">
        {error.message}
      </p>
      
      {error.code && (
        <code className="px-2 py-1 mb-4 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
          {error.code}
        </code>
      )}
      
      {isRetryable && (
        <Button
          variant="outline"
          onClick={onRetry}
          className="mt-2"
          size="sm"
        >
          <RefreshCw className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

// Specialized error states
export function DataErrorState({
  error,
  onRetry,
  className,
}: Omit<ErrorStateProps, 'retryLabel'>) {
  return (
    <ErrorState
      error={error}
      onRetry={onRetry}
      retryLabel="Reload Data"
      className={cn('min-h-[200px]', className)}
    />
  );
}
