interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
  available: { label: 'Available', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  occupied: { label: 'Occupied', className: 'bg-red-50 text-red-700 ring-1 ring-red-200', dot: 'bg-red-500' },
  maintenance: { label: 'Maintenance', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', dot: 'bg-amber-500' },
  reserved: { label: 'Reserved', className: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200', dot: 'bg-sky-500' },
  confirmed: { label: 'Confirmed', className: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200', dot: 'bg-sky-500' },
  checked_in: { label: 'Checked In', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  checked_out: { label: 'Checked Out', className: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200', dot: 'bg-slate-400' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 ring-1 ring-red-200', dot: 'bg-red-500' },
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', dot: 'bg-amber-500' },
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  partial: { label: 'Partial', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', dot: 'bg-amber-500' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200', dot: 'bg-slate-400' };
  return (
    <span className={`badge ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
