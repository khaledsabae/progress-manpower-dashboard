import { cn } from '@/lib/utils';

interface LoadingSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  count?: number;
  height?: number | string;
  width?: number | string;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  spacing?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
}

export function LoadingSkeleton({
  className,
  count = 1,
  height = 20,
  width = '100%',
  rounded = 'md',
  spacing = 'md',
  ...props
}: LoadingSkeletonProps) {
  const spacingMap = {
    none: 'mb-0',
    xs: 'mb-1',
    sm: 'mb-2',
    md: 'mb-4',
    lg: 'mb-6',
  };

  const roundedMap = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  return (
    <div className="w-full space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'bg-gray-200 dark:bg-gray-700 animate-pulse',
            roundedMap[rounded],
            spacing !== 'none' && i < count - 1 ? spacingMap[spacing] : '',
            className
          )}
          style={{
            height: typeof height === 'number' ? `${height}px` : height,
            width: typeof width === 'number' ? `${width}px` : width,
          }}
          {...props}
        />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-6 space-y-4 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <LoadingSkeleton width={120} height={24} rounded="lg" />
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>
      <div className="space-y-3">
        <LoadingSkeleton width="100%" height={16} rounded="md" />
        <LoadingSkeleton width="80%" height={16} rounded="md" />
        <div className="pt-4">
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
            <div 
              className="h-2 bg-blue-500 rounded-full animate-pulse" 
              style={{ width: '65%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
