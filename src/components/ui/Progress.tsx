import clsx from 'clsx';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
}

export function Progress({ value, max = 100, className }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={clsx('h-2 bg-gray-200 rounded-full overflow-hidden', className)}>
      <div className="h-full bg-primary-600 rounded-full transition-all duration-300" style={{ width: `${percentage}%` }} />
    </div>
  );
}

interface StepProgressProps {
  steps: string[];
  current: number;
}

export function StepProgress({ steps, current }: StepProgressProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{current} de {steps.length}</span>
        <span className="font-medium text-gray-900">{steps[current - 1]}</span>
      </div>
      <Progress value={current} max={steps.length} />
    </div>
  );
}
