import { FileText, Search, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

type EmptyStateVariant = 'default' | 'search' | 'error';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: EmptyStateVariant;
  className?: string;
}

const variantIcons = {
  default: <FileText className="w-8 h-8" />,
  search: <Search className="w-8 h-8" />,
  error: <AlertCircle className="w-8 h-8" />,
};

const variantColors = {
  default: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  search: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  error: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const IconComponent = icon || variantIcons[variant];
  
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-lg',
        'border border-dashed border-gray-200 dark:border-gray-700',
        'min-h-[200px]',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center w-16 h-16 rounded-full mb-4',
          variantColors[variant]
        )}
      >
        {IconComponent}
      </div>
      
      <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      
      {description && (
        <p className="max-w-md mx-auto mb-6 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
      
      {action && (
        <Button onClick={action.onClick} variant="outline">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Pre-configured empty states
export function NoDataState({
  title = 'No data available',
  description = 'There is no data to display at the moment.',
  action,
  className,
}: Omit<EmptyStateProps, 'variant'>) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={action}
      variant="default"
      className={className}
    />
  );
}

export function NoResultsState({
  title = 'No results found',
  description = 'Try adjusting your search or filter to find what you\'re looking for.',
  action,
  className,
}: Omit<EmptyStateProps, 'variant'>) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={action}
      variant="search"
      className={className}
    />
  );
}
